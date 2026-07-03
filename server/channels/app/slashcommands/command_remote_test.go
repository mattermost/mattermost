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

	// Display names are chosen so the store's alphabetical ordering interleaves
	// active and deleted entries (AAA active, BBB deleted, CCC active, DDD deleted).
	// CreateAt values enforce a deterministic secondary ordering within each group.
	seedRemote(t, "AAA Active", 100, false)
	seedRemote(t, "BBB Deleted", 200, true)
	seedRemote(t, "CCC Active", 300, false)
	seedRemote(t, "DDD Deleted", 400, true)

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

	t.Run("header separator has exactly nine cells matching the columns", func(t *testing.T) {
		require.Contains(t, output, "| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |",
			"expected a nine-cell separator row aligned with the nine column header")
		require.NotContains(t, output, "| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | | :---- |",
			"the malformed ten-cell separator with a spurious empty cell must not be present")
	})

	t.Run("active connections are listed before deleted ones, ordered by CreateAt", func(t *testing.T) {
		rowOrder := []string{"AAA Active", "CCC Active", "BBB Deleted", "DDD Deleted"}
		lastIdx := -1
		for _, name := range rowOrder {
			idx := strings.Index(output, name)
			require.GreaterOrEqual(t, idx, 0, "expected %q to appear in the status output", name)
			require.Greater(t, idx, lastIdx, "expected %q to appear after the previous row; active entries must precede deleted ones", name)
			lastIdx = idx
		}
	})
}
