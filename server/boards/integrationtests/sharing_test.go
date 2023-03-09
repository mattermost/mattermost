// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/utils"
)

func TestSharing(t *testing.T) {
	th := SetupTestHelper(t).InitBasic()
	defer th.TearDown()

	var boardID string
	token := utils.NewID(utils.IDTypeToken)

	t.Run("an unauthenticated client should not be able to get a sharing", func(t *testing.T) {
		th.Logout(th.Client)

		sharing, resp := th.Client.GetSharing("board-id")
		th.CheckUnauthorized(resp)
		require.Nil(t, sharing)
	})

	t.Run("Check no initial sharing", func(t *testing.T) {
		th.Login1()

		teamID := "0"
		newBoard := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}

		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)
		require.NotNil(t, board)
		boardID = board.ID

		s, err := th.Server.App().GetSharing(boardID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, s)

		sharing, resp := th.Client.GetSharing(boardID)
		th.CheckNotFound(resp)
		require.Nil(t, sharing)
	})

	t.Run("POST sharing, config = false", func(t *testing.T) {
		sharing := model.Sharing{
			ID:       boardID,
			Token:    token,
			Enabled:  true,
			UpdateAt: 1,
		}

		// it will fail with default config
		success, resp := th.Client.PostSharing(&sharing)
		require.False(t, success)
		require.Error(t, resp.Error)

		t.Run("GET sharing", func(t *testing.T) {
			sharing, resp := th.Client.GetSharing(boardID)
			// Expect empty sharing object
			th.CheckNotFound(resp)
			require.Nil(t, sharing)
		})
	})

	t.Run("POST sharing, config = true", func(t *testing.T) {
		th.Server.Config().EnablePublicSharedBoards = true
		sharing := model.Sharing{
			ID:       boardID,
			Token:    token,
			Enabled:  true,
			UpdateAt: 1,
		}

		// it will succeed with updated config
		success, resp := th.Client.PostSharing(&sharing)
		require.True(t, success)
		require.NoError(t, resp.Error)

		t.Run("GET sharing", func(t *testing.T) {
			sharing, resp := th.Client.GetSharing(boardID)
			require.NoError(t, resp.Error)
			require.NotNil(t, sharing)
			require.Equal(t, sharing.ID, boardID)
			require.True(t, sharing.Enabled)
			require.Equal(t, sharing.Token, token)
		})
	})
}
