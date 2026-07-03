// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

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
