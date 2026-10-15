// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"errors"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type failingDeleteRemoteClusterStore struct {
	store.RemoteClusterStore
	wrapper *failingDeleteStoreWrapper
}

func (s *failingDeleteRemoteClusterStore) Delete(remoteClusterId string) (bool, error) {
	s.wrapper.deleteCalls.Add(1)
	if remoteClusterId == s.wrapper.failDeleteID {
		return false, errors.New("database is unavailable")
	}
	return s.RemoteClusterStore.Delete(remoteClusterId)
}

// failingDeleteStoreWrapper fails RemoteCluster().Delete for failDeleteID and counts
// every Delete call; all other calls use the real store.
type failingDeleteStoreWrapper struct {
	store.Store
	failDeleteID string
	deleteCalls  atomic.Int32
}

func (w *failingDeleteStoreWrapper) RemoteCluster() store.RemoteClusterStore {
	return &failingDeleteRemoteClusterStore{RemoteClusterStore: w.Store.RemoteCluster(), wrapper: w}
}

func TestRemoteProviderDoRemove(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	// The wrapper is installed before the server starts so the live store is never swapped.
	wrapper := &failingDeleteStoreWrapper{Store: dbStore, failDeleteID: model.NewId()}
	th := setupTestHelper(wrapper, false, true, t, nil).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	runRemove := func(t *testing.T, command string) string {
		t.Helper()
		args := &model.CommandArgs{
			T:         i18n.GetUserTranslations("en"),
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			ChannelId: th.BasicChannel.Id,
			Command:   command,
		}
		resp := (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "")
		require.NotNil(t, resp)
		return resp.Text
	}

	t.Run("removes an existing connection", func(t *testing.T) {
		rc, appErr := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:  model.NewId(),
			Name:      "remote-" + model.NewId(),
			SiteURL:   "https://" + model.NewId() + ".example.com",
			Token:     model.NewId(),
			CreatorId: th.BasicUser.Id,
		})
		require.Nil(t, appErr)

		output := runRemove(t, "/secure-connection remove --connectionID "+rc.RemoteId)

		require.Equal(t, "##### Secure connection "+rc.RemoteId+" removed.", output)
		_, appErr = th.App.GetRemoteCluster(rc.RemoteId, false)
		require.NotNil(t, appErr, "removed connection must no longer be returned as active")
		deletedRC, appErr := th.App.GetRemoteCluster(rc.RemoteId, true)
		require.Nil(t, appErr)
		require.NotZero(t, deletedRC.DeleteAt)
	})

	t.Run("reports an unknown connection as not found", func(t *testing.T) {
		id := model.NewId()

		output := runRemove(t, "/secure-connection remove --connectionID "+id)

		require.Equal(t, "##### Secure connection "+id+" **NOT FOUND**.", output)
	})

	t.Run("reports a store error instead of not found", func(t *testing.T) {
		output := runRemove(t, "/secure-connection remove --connectionID "+wrapper.failDeleteID)

		require.Equal(t, "Could not remove secure connection: We encountered an error deleting the secure connection.", output)
	})

	t.Run("rejects a missing, empty or malformed connectionID without deleting", func(t *testing.T) {
		for name, tc := range map[string]struct {
			command string
			reply   string
		}{
			"missing":   {"/secure-connection remove", "Missing or empty `connectionID`"},
			"empty":     {"/secure-connection remove --connectionID", "Missing or empty `connectionID`"},
			"malformed": {"/secure-connection remove --connectionID foo", "`foo` is not a valid `connectionID`"},
		} {
			t.Run(name, func(t *testing.T) {
				callsBefore := wrapper.deleteCalls.Load()

				output := runRemove(t, tc.command)

				require.Equal(t, tc.reply, output)
				require.Equal(t, callsBefore, wrapper.deleteCalls.Load(), "DeleteRemoteCluster must not be called without a valid connectionID")
			})
		}
	})
}

func TestRemoteProviderDoStatus(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	// seedRemote creates a remote cluster. When deleted is true it is soft-deleted
	// after creation so it carries a non-zero DeleteAt, mirroring a removed connection.
	seedRemote := func(t *testing.T, displayName string, createAt int64, deleted bool) {
		t.Helper()
		rc, appErr := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "remote-" + model.NewId(),
			DisplayName: displayName,
			SiteURL:     "https://" + model.NewId() + ".example.com",
			Token:       model.NewId(),
			CreateAt:    createAt,
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, appErr)

		if deleted {
			_, appErr = th.App.DeleteRemoteCluster(rc.RemoteId)
			require.Nil(t, appErr)
		}
	}

	// The store returns rows ordered by DisplayName (see sqlRemoteClusterStore.GetAll),
	// so without the fix the rows come back interleaved: AAA, BBB, CCC, DDD.
	//
	// CreateAt values are chosen so the fix's behavior is unambiguous:
	//   - Active group: CCC (100) must sort before AAA (300), proving the CreateAt
	//     ordering overrides the store's alphabetical order.
	//   - Deleted group: BBB and DDD share a CreateAt, so the stable sort must
	//     preserve their store order (BBB before DDD).
	// Expected final order: CCC, AAA, BBB, DDD.
	seedRemote(t, "AAA Active", 300, false)
	seedRemote(t, "BBB Deleted", 200, true)
	seedRemote(t, "CCC Active", 100, false)
	seedRemote(t, "DDD Deleted", 200, true)

	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		UserId:    th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		ChannelId: th.BasicChannel.Id,
		Command:   "/secure-connection status",
	}

	resp := (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "")
	require.NotNil(t, resp)
	output := resp.Text

	// separatorLine returns the Markdown table separator row (the line made up of
	// alignment cells) from the command output.
	separatorLine := func() string {
		for line := range strings.SplitSeq(output, "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "| :----") {
				return line
			}
		}
		return ""
	}

	t.Run("header separator has exactly nine cells matching the columns", func(t *testing.T) {
		sep := separatorLine()
		require.NotEmpty(t, sep, "expected a Markdown separator row in the output")
		require.Equal(t, "| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |", sep,
			"separator row must have exactly nine cells to match the nine-column header and data rows")
		require.Equal(t, 9, strings.Count(sep, ":----"), "separator must contain exactly nine alignment cells")
	})

	t.Run("data rows have nine cells matching the header", func(t *testing.T) {
		for line := range strings.SplitSeq(output, "\n") {
			if strings.Contains(line, "AAA Active") {
				// A row with 9 cells is delimited by 10 pipe characters.
				require.Equal(t, 10, strings.Count(line, "|"), "each data row must have nine cells")
				return
			}
		}
		require.Fail(t, "expected to find the AAA Active data row in the output")
	})

	t.Run("active connections sort before deleted ones, by CreateAt then stably", func(t *testing.T) {
		rowOrder := []string{"CCC Active", "AAA Active", "BBB Deleted", "DDD Deleted"}
		lastIdx := -1
		for _, name := range rowOrder {
			idx := strings.Index(output, name)
			require.GreaterOrEqual(t, idx, 0, "expected %q to appear in the status output", name)
			require.Greater(t, idx, lastIdx, "expected %q to appear after the previous row", name)
			lastIdx = idx
		}
	})
}
