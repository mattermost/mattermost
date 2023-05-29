// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/config"
)

func TestSetConfig(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("Test Update Config", func(t *testing.T) {
		require.False(t, th.App.config.EnablePublicSharedBoards)
		newConfiguration := config.Configuration{}
		newConfiguration.EnablePublicSharedBoards = true
		th.App.SetConfig(&newConfiguration)

		require.True(t, th.App.config.EnablePublicSharedBoards)
	})
}
