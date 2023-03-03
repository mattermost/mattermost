// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/client"
	"github.com/mattermost/mattermost-server/v6/boards/model"
)

func TestStatisticsLocalMode(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	t.Run("an unauthenticated client should not be able to get statistics", func(t *testing.T) {
		th.Logout(th.Client)

		stats, resp := th.Client.GetStatistics()
		th.CheckUnauthorized(resp)
		require.Nil(t, stats)
	})

	t.Run("Check authenticated user, not admin", func(t *testing.T) {
		th.Login1()

		stats, resp := th.Client.GetStatistics()
		th.CheckNotImplemented(resp)
		require.Nil(t, stats)
	})
}

func TestStatisticsPluginMode(t *testing.T) {
	th := SetupTestHelperPluginMode(t)
	defer th.TearDown()

	// Permissions are tested in permissions_test.go
	// This tests the functionality.
	t.Run("Check authenticated user, admin", func(t *testing.T) {
		th.Client = client.NewClient(th.Server.Config().ServerRoot, "")
		th.Client.HTTPHeader["Mattermost-User-Id"] = userAdmin

		stats, resp := th.Client.GetStatistics()
		th.CheckOK(resp)
		require.NotNil(t, stats)

		numberCards := 2
		th.CreateBoardAndCards("testTeam", model.BoardTypeOpen, numberCards)

		stats, resp = th.Client.GetStatistics()
		th.CheckOK(resp)
		require.NotNil(t, stats)
		require.Equal(t, 1, stats.Boards)
		require.Equal(t, numberCards, stats.Cards)
	})
}
