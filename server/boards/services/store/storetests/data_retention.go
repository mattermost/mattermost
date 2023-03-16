// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package storetests

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/server/boards/utils"

	"github.com/stretchr/testify/require"
)

const (
	boardID    = "board-id-test"
	categoryID = "category-id-test"
)

func StoreTestDataRetention(t *testing.T, runStoreTests func(*testing.T, func(*testing.T, store.Store))) {
	t.Run("RunDataRetention", func(t *testing.T) {
		runStoreTests(t, func(t *testing.T, store store.Store) {
			category := model.Category{
				ID:     categoryID,
				Name:   "TestCategory",
				UserID: testUserID,
				TeamID: testTeamID,
			}
			err := store.CreateCategory(category)
			require.NoError(t, err)

			testRunDataRetention(t, store, 0)
			testRunDataRetention(t, store, 2)
			testRunDataRetention(t, store, 10)
		})
	})
}

func LoadData(t *testing.T, store store.Store) {
	validBoard := model.Board{
		ID:         boardID,
		IsTemplate: false,
		ModifiedBy: testUserID,
		TeamID:     testTeamID,
	}
	board, err := store.InsertBoard(&validBoard, testUserID)
	require.NoError(t, err)

	validBlock := &model.Block{
		ID:         "id-test",
		BoardID:    board.ID,
		ModifiedBy: testUserID,
	}

	validBlock2 := &model.Block{
		ID:         "id-test2",
		BoardID:    board.ID,
		ModifiedBy: testUserID,
	}
	validBlock3 := &model.Block{
		ID:         "id-test3",
		BoardID:    board.ID,
		ModifiedBy: testUserID,
	}

	validBlock4 := &model.Block{
		ID:         "id-test4",
		BoardID:    board.ID,
		ModifiedBy: testUserID,
	}

	newBlocks := []*model.Block{validBlock, validBlock2, validBlock3, validBlock4}

	err = store.InsertBlocks(newBlocks, testUserID)
	require.NoError(t, err)

	member := &model.BoardMember{
		UserID:      testUserID,
		BoardID:     boardID,
		SchemeAdmin: true,
	}
	_, err = store.SaveMember(member)
	require.NoError(t, err)

	sharing := model.Sharing{
		ID:      boardID,
		Enabled: true,
		Token:   "testToken",
	}
	err = store.UpsertSharing(sharing)
	require.NoError(t, err)

	err = store.AddUpdateCategoryBoard(testUserID, categoryID, []string{boardID})
	require.NoError(t, err)
}

func testRunDataRetention(t *testing.T, store store.Store, batchSize int) {
	LoadData(t, store)

	blocks, err := store.GetBlocksForBoard(boardID)
	require.NoError(t, err)
	require.Len(t, blocks, 4)
	initialCount := len(blocks)

	t.Run("test no deletions", func(t *testing.T) {
		deletions, err := store.RunDataRetention(utils.GetMillisForTime(time.Now().Add(-time.Hour*1)), int64(batchSize))
		require.NoError(t, err)
		require.Equal(t, int64(0), deletions)
	})

	t.Run("test all deletions", func(t *testing.T) {
		deletions, err := store.RunDataRetention(utils.GetMillisForTime(time.Now().Add(time.Hour*1)), int64(batchSize))
		require.NoError(t, err)
		require.True(t, deletions > int64(initialCount))

		// expect all blocks to be deleted.
		blocks, errBlocks := store.GetBlocksForBoard(boardID)
		require.NoError(t, errBlocks)
		require.Equal(t, 0, len(blocks))

		// GetMemberForBoard throws error on now rows found
		member, err := store.GetMemberForBoard(boardID, testUserID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err), err)
		require.Nil(t, member)

		// GetSharing throws error on now rows found
		sharing, err := store.GetSharing(boardID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err), err)
		require.Nil(t, sharing)

		category, err := store.GetUserCategoryBoards(boardID, testTeamID)
		require.NoError(t, err)
		require.Empty(t, category)
	})
}
