// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/store"
	"github.com/mattermost/mattermost/server/v8/boards/utils"
)

func StoreTestComplianceHistoryStore(t *testing.T, runStoreTests func(*testing.T, func(*testing.T, store.Store))) {
	t.Run("GetBoardsForCompliance", func(t *testing.T) {
		runStoreTests(t, testGetBoardsForCompliance)
	})
	t.Run("GetBoardsComplianceHistory", func(t *testing.T) {
		runStoreTests(t, testGetBoardsComplianceHistory)
	})
	t.Run("GetBlocksComplianceHistory", func(t *testing.T) {
		runStoreTests(t, testGetBlocksComplianceHistory)
	})
}

func testGetBoardsForCompliance(t *testing.T, store store.Store) {
	team1 := testTeamID
	team2 := utils.NewID(utils.IDTypeTeam)

	boardsAdded1 := createTestBoards(t, store, team1, testUserID, 10)
	boardsAdded2 := createTestBoards(t, store, team2, testUserID, 7)

	deleteTestBoard(t, store, boardsAdded1[0].ID, testUserID)
	deleteTestBoard(t, store, boardsAdded1[1].ID, testUserID)
	boardsAdded1 = boardsAdded1[2:]

	t.Run("Invalid teamID", func(t *testing.T) {
		opts := model.QueryBoardsForComplianceOptions{
			TeamID: utils.NewID(utils.IDTypeTeam),
		}

		boards, hasMore, err := store.GetBoardsForCompliance(opts)

		assert.Empty(t, boards)
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("All teams", func(t *testing.T) {
		opts := model.QueryBoardsForComplianceOptions{}

		boards, hasMore, err := store.GetBoardsForCompliance(opts)

		assert.ElementsMatch(t, extractIDs(t, boards), extractIDs(t, boardsAdded1, boardsAdded2))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("Specific team", func(t *testing.T) {
		opts := model.QueryBoardsForComplianceOptions{
			TeamID: team1,
		}

		boards, hasMore, err := store.GetBoardsForCompliance(opts)

		assert.ElementsMatch(t, extractIDs(t, boards), extractIDs(t, boardsAdded1))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("Pagination", func(t *testing.T) {
		opts := model.QueryBoardsForComplianceOptions{
			Page:    0,
			PerPage: 3,
		}

		reps := 0
		allBoards := make([]*model.Board, 0, 20)

		for {
			boards, hasMore, err := store.GetBoardsForCompliance(opts)
			require.NoError(t, err)
			require.NotEmpty(t, boards)
			allBoards = append(allBoards, boards...)

			if !hasMore {
				break
			}
			opts.Page++
			reps++
		}

		assert.ElementsMatch(t, extractIDs(t, allBoards), extractIDs(t, boardsAdded1, boardsAdded2))
	})
}

func testGetBoardsComplianceHistory(t *testing.T, store store.Store) {
	team1 := testTeamID
	team2 := utils.NewID(utils.IDTypeTeam)

	boardsTeam1 := createTestBoards(t, store, team1, testUserID, 11)
	boardsTeam2 := createTestBoards(t, store, team2, testUserID, 7)
	boardsAdded := make([]*model.Board, 0)
	boardsAdded = append(boardsAdded, boardsTeam1...)
	boardsAdded = append(boardsAdded, boardsTeam2...)

	deleteTestBoard(t, store, boardsTeam1[0].ID, testUserID)
	deleteTestBoard(t, store, boardsTeam1[1].ID, testUserID)
	boardsDeleted := boardsTeam1[0:2]
	boardsTeam1 = boardsTeam1[2:]

	t.Log("boardsTeam1: ", extractIDs(t, boardsTeam1))
	t.Log("boardsTeam2: ", extractIDs(t, boardsTeam2))
	t.Log("boardsAdded: ", extractIDs(t, boardsAdded))
	t.Log("boardsDeleted: ", extractIDs(t, boardsDeleted))

	t.Run("Invalid teamID", func(t *testing.T) {
		opts := model.QueryBoardsComplianceHistoryOptions{
			TeamID: utils.NewID(utils.IDTypeTeam),
		}

		boardHistories, hasMore, err := store.GetBoardsComplianceHistory(opts)

		assert.Empty(t, boardHistories)
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("All teams, include deleted", func(t *testing.T) {
		opts := model.QueryBoardsComplianceHistoryOptions{
			IncludeDeleted: true,
		}

		boardHistories, hasMore, err := store.GetBoardsComplianceHistory(opts)

		// boardHistories should contain a record for each board added, plus a record for the 2 deleted.
		assert.ElementsMatch(t, extractIDs(t, boardHistories), extractIDs(t, boardsAdded, boardsDeleted))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("All teams, exclude deleted", func(t *testing.T) {
		opts := model.QueryBoardsComplianceHistoryOptions{
			IncludeDeleted: false,
		}

		boardHistories, hasMore, err := store.GetBoardsComplianceHistory(opts)

		// boardHistories should contain a record for each board added, minus the two deleted.
		assert.ElementsMatch(t, extractIDs(t, boardHistories), extractIDs(t, boardsTeam1, boardsTeam2))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("Specific team", func(t *testing.T) {
		opts := model.QueryBoardsComplianceHistoryOptions{
			TeamID: team1,
		}

		boardHistories, hasMore, err := store.GetBoardsComplianceHistory(opts)

		assert.ElementsMatch(t, extractIDs(t, boardHistories), extractIDs(t, boardsTeam1))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("Pagination", func(t *testing.T) {
		opts := model.QueryBoardsComplianceHistoryOptions{
			Page:    0,
			PerPage: 3,
		}

		reps := 0
		allHistories := make([]*model.BoardHistory, 0)

		for {
			reps++
			boardHistories, hasMore, err := store.GetBoardsComplianceHistory(opts)
			require.NoError(t, err)
			require.NotEmpty(t, boardHistories)
			allHistories = append(allHistories, boardHistories...)

			if !hasMore {
				break
			}
			opts.Page++
		}

		assert.ElementsMatch(t, extractIDs(t, allHistories), extractIDs(t, boardsTeam1, boardsTeam2))
		expectedCount := len(boardsTeam1) + len(boardsTeam2)
		assert.Equal(t, math.Floor(float64(expectedCount/opts.PerPage)+1), float64(reps))
	})
}

func testGetBlocksComplianceHistory(t *testing.T, store store.Store) {
	team1 := testTeamID
	team2 := utils.NewID(utils.IDTypeTeam)

	boardsTeam1 := createTestBoards(t, store, team1, testUserID, 3)
	boardsTeam2 := createTestBoards(t, store, team2, testUserID, 1)

	// add cards (13 in total)
	cards1Team1 := createTestCards(t, store, testUserID, boardsTeam1[0].ID, 3)
	cards2Team1 := createTestCards(t, store, testUserID, boardsTeam1[1].ID, 5)
	cards3Team1 := createTestCards(t, store, testUserID, boardsTeam1[2].ID, 2)
	cards1Team2 := createTestCards(t, store, testUserID, boardsTeam2[0].ID, 3)

	deleteTestBoard(t, store, boardsTeam1[0].ID, testUserID)
	cardsDeleted := cards1Team1

	t.Run("Invalid teamID", func(t *testing.T) {
		opts := model.QueryBlocksComplianceHistoryOptions{
			TeamID: utils.NewID(utils.IDTypeTeam),
		}

		boards, hasMore, err := store.GetBlocksComplianceHistory(opts)

		assert.Empty(t, boards)
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("All teams, include deleted", func(t *testing.T) {
		opts := model.QueryBlocksComplianceHistoryOptions{
			IncludeDeleted: true,
		}

		blockHistories, hasMore, err := store.GetBlocksComplianceHistory(opts)

		// blockHistories should have records for all cards added, plus all cards deleted
		assert.ElementsMatch(t, extractIDs(t, blockHistories, nil),
			extractIDs(t, cards1Team1, cards2Team1, cards3Team1, cards1Team2, cardsDeleted))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("All teams, exclude deleted", func(t *testing.T) {
		opts := model.QueryBlocksComplianceHistoryOptions{}

		blockHistories, hasMore, err := store.GetBlocksComplianceHistory(opts)

		// blockHistories should have records for all cards added that have not been deleted
		assert.ElementsMatch(t, extractIDs(t, blockHistories, nil),
			extractIDs(t, cards2Team1, cards3Team1, cards1Team2))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("Specific team", func(t *testing.T) {
		opts := model.QueryBlocksComplianceHistoryOptions{
			TeamID: team1,
		}

		blockHistories, hasMore, err := store.GetBlocksComplianceHistory(opts)

		assert.ElementsMatch(t, extractIDs(t, blockHistories), extractIDs(t, cards2Team1, cards3Team1))
		assert.False(t, hasMore)
		assert.NoError(t, err)
	})

	t.Run("Pagination", func(t *testing.T) {
		opts := model.QueryBlocksComplianceHistoryOptions{
			Page:    0,
			PerPage: 3,
		}

		reps := 0
		allHistories := make([]*model.BlockHistory, 0)

		for {
			reps++
			blockHistories, hasMore, err := store.GetBlocksComplianceHistory(opts)
			require.NoError(t, err)
			require.NotEmpty(t, blockHistories)
			allHistories = append(allHistories, blockHistories...)

			if !hasMore {
				break
			}
			opts.Page++
		}

		assert.ElementsMatch(t, extractIDs(t, allHistories), extractIDs(t, cards2Team1, cards3Team1, cards1Team2))

		expectedCount := len(cards2Team1) + len(cards3Team1) + len(cards1Team2)
		assert.Equal(t, math.Floor(float64(expectedCount/opts.PerPage)+1), float64(reps))
	})
}
