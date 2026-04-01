// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func setupBoardTest(t *testing.T) *TestHelper {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	return th
}

func TestCreateBoard(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBoardTest(t)
	client := th.Client

	t.Run("create open board", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "My Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th.BasicTeam.Id,
		}

		boardJSON, err := json.Marshal(board)
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), "/boards", string(boardJSON))
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var created model.Channel
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
		assert.Equal(t, model.ChannelTypeOpenBoard, created.Type)
		assert.NotEmpty(t, created.Id)

		// Verify view was created
		views, appErr := th.App.GetViewsForChannel(th.Context, created.Id, model.ViewQueryOpts{PerPage: 10})
		require.Nil(t, appErr)
		require.Len(t, views, 1)
		assert.Equal(t, model.ViewTypeKanban, views[0].Type)
	})

	t.Run("create private board", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "Private Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypePrivateBoard,
			TeamId:      th.BasicTeam.Id,
		}

		boardJSON, err := json.Marshal(board)
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), "/boards", string(boardJSON))
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("rejected when feature flag off", func(t *testing.T) {
		// Routes are registered at startup based on feature flag.
		// When the flag is off at startup, /boards route does not exist -> 404.
		// Use a separate TestHelper with the flag off.
		th2 := Setup(t).InitBasic(t)
		board := &model.Channel{
			DisplayName: "Disabled Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th2.BasicTeam.Id,
		}

		boardJSON, err := json.Marshal(board)
		require.NoError(t, err)

		resp, err := th2.Client.DoAPIPost(context.Background(), "/boards", string(boardJSON))
		require.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("board not in sidebar", func(t *testing.T) {
		board := &model.Channel{
			DisplayName: "Sidebar Check Board",
			Name:        GenerateTestChannelName(),
			Type:        model.ChannelTypeOpenBoard,
			TeamId:      th.BasicTeam.Id,
		}

		boardJSON, err := json.Marshal(board)
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), "/boards", string(boardJSON))
		require.NoError(t, err)
		defer resp.Body.Close()

		var created model.Channel
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))

		// Verify board doesn't appear in sidebar
		categories, _, catErr := client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, catErr)
		for _, cat := range categories.Categories {
			for _, chID := range cat.Channels {
				assert.NotEqual(t, created.Id, chID, "board should not appear in sidebar")
			}
		}
	})
}
