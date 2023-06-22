// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/store"
)

const (
	testInsightsUserID1 = "user-id-1"
)

func StoreTestBoardsInsightsStore(t *testing.T, runStoreTests func(*testing.T, func(*testing.T, store.Store))) {
	t.Run("GetBoardsInsights", func(t *testing.T) {
		runStoreTests(t, getBoardsInsightsTest)
	})
}

func getBoardsInsightsTest(t *testing.T, store store.Store) {
	// creating sample data
	teamID := testTeamID
	userID := testUserID
	newBab := &model.BoardsAndBlocks{
		Boards: []*model.Board{
			{ID: "board-id-1", TeamID: teamID, Type: model.BoardTypeOpen, Icon: "💬"},
			{ID: "board-id-2", TeamID: teamID, Type: model.BoardTypePrivate},
			{ID: "board-id-3", TeamID: teamID, Type: model.BoardTypeOpen},
		},
		Blocks: []*model.Block{
			{ID: "block-id-1", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-2", BoardID: "board-id-2", Type: model.TypeCard},
			{ID: "block-id-3", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-4", BoardID: "board-id-2", Type: model.TypeCard},
			{ID: "block-id-5", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-6", BoardID: "board-id-2", Type: model.TypeCard},
			{ID: "block-id-7", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-8", BoardID: "board-id-2", Type: model.TypeCard},
			{ID: "block-id-9", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-10", BoardID: "board-id-3", Type: model.TypeCard},
			{ID: "block-id-11", BoardID: "board-id-3", Type: model.TypeCard},
			{ID: "block-id-12", BoardID: "board-id-3", Type: model.TypeCard},
		},
	}

	bab, err := store.CreateBoardsAndBlocks(newBab, userID)
	require.NoError(t, err)
	require.NotNil(t, bab)

	newBab = &model.BoardsAndBlocks{
		Blocks: []*model.Block{
			{ID: "block-id-13", BoardID: "board-id-1", Type: model.TypeCard},
			{ID: "block-id-14", BoardID: "board-id-1", Type: model.TypeCard},
		},
	}
	bab, err = store.CreateBoardsAndBlocks(newBab, testInsightsUserID1)
	require.NoError(t, err)
	require.NotNil(t, bab)
	bm := &model.BoardMember{
		UserID:      userID,
		BoardID:     "board-id-2",
		SchemeAdmin: true,
	}

	_, _ = store.SaveMember(bm)

	boardsUser1, _ := store.GetBoardsForUserAndTeam(testUserID, testTeamID, true)
	boardsUser2, _ := store.GetBoardsForUserAndTeam(testInsightsUserID1, testTeamID, true)
	t.Run("team insights", func(t *testing.T) {
		boardIDs := []string{boardsUser1[0].ID, boardsUser1[1].ID, boardsUser1[2].ID}
		topTeamBoards, err := store.GetTeamBoardsInsights(testTeamID,
			0, 0, 10, boardIDs)
		require.NoError(t, err)
		require.Len(t, topTeamBoards.Items, 3)
		// validate board insight content
		require.Equal(t, topTeamBoards.Items[0].ActivityCount, strconv.Itoa(8))
		require.Equal(t, topTeamBoards.Items[0].Icon, "💬")
		require.Equal(t, topTeamBoards.Items[1].ActivityCount, strconv.Itoa(5))
		require.Equal(t, topTeamBoards.Items[2].ActivityCount, strconv.Itoa(4))
	})

	t.Run("user insights", func(t *testing.T) {
		boardIDs := []string{boardsUser1[0].ID, boardsUser1[1].ID, boardsUser1[2].ID}
		topUser1Boards, err := store.GetUserBoardsInsights(testTeamID, testUserID, 0, 0, 10, boardIDs)
		require.NoError(t, err)
		require.Len(t, topUser1Boards.Items, 3)
		require.Equal(t, topUser1Boards.Items[0].Icon, "💬")
		require.Equal(t, topUser1Boards.Items[0].BoardID, "board-id-1")
		boardIDs = []string{boardsUser2[0].ID, boardsUser2[1].ID}
		topUser2Boards, err := store.GetUserBoardsInsights(testTeamID, testInsightsUserID1, 0, 0, 10, boardIDs)
		require.NoError(t, err)
		require.Len(t, topUser2Boards.Items, 1)
		require.Equal(t, topUser2Boards.Items[0].BoardID, "board-id-1")
	})
}
