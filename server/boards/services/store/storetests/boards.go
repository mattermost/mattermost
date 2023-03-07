// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"

	"github.com/stretchr/testify/require"
)

func StoreTestBoardStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("GetBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetBoard(t, store)
	})
	t.Run("GetBoardsForUserAndTeam", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetBoardsForUserAndTeam(t, store)
	})
	t.Run("GetBoardsInTeamByIds", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetBoardsInTeamByIds(t, store)
	})
	t.Run("InsertBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testInsertBoard(t, store)
	})
	t.Run("PatchBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testPatchBoard(t, store)
	})
	t.Run("DeleteBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testDeleteBoard(t, store)
	})
	t.Run("UndeleteBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testUndeleteBoard(t, store)
	})
	t.Run("InsertBoardWithAdmin", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testInsertBoardWithAdmin(t, store)
	})
	t.Run("SaveMember", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testSaveMember(t, store)
	})
	t.Run("GetMemberForBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetMemberForBoard(t, store)
	})
	t.Run("GetMembersForBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetMembersForBoard(t, store)
	})
	t.Run("GetMembersForUser", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetMembersForUser(t, store)
	})
	t.Run("DeleteMember", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testDeleteMember(t, store)
	})
	t.Run("SearchBoardsForUser", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testSearchBoardsForUser(t, store)
	})
	t.Run("SearchBoardsForUserInTeam", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testSearchBoardsForUserInTeam(t, store)
	})
	t.Run("GetBoardHistory", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetBoardHistory(t, store)
	})
	t.Run("GetBoardCount", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetBoardCount(t, store)
	})
}

func testGetBoard(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("existing board", func(t *testing.T) {
		board := &model.Board{
			ID:     "id-1",
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		_, err := store.InsertBoard(board, userID)
		require.NoError(t, err)

		rBoard, err := store.GetBoard(board.ID)
		require.NoError(t, err)
		require.Equal(t, board.ID, rBoard.ID)
		require.Equal(t, board.TeamID, rBoard.TeamID)
		require.Equal(t, userID, rBoard.CreatedBy)
		require.Equal(t, userID, rBoard.ModifiedBy)
		require.Equal(t, board.Type, rBoard.Type)
		require.NotZero(t, rBoard.CreateAt)
		require.NotZero(t, rBoard.UpdateAt)
	})

	t.Run("nonexisting board", func(t *testing.T) {
		rBoard, err := store.GetBoard("nonexistent-id")
		var nf *model.ErrNotFound
		require.ErrorAs(t, err, &nf)
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
		require.Nil(t, rBoard)
	})
}

func testGetBoardsForUserAndTeam(t *testing.T, store store.Store) {
	userID := "user-id-1"

	t.Run("should return empty list if no results are found", func(t *testing.T) {
		boards, err := store.GetBoardsForUserAndTeam(testUserID, testTeamID, true)
		require.NoError(t, err)
		require.Empty(t, boards)
	})

	t.Run("should return only the boards of the team that the user is a member of", func(t *testing.T) {
		teamID1 := "team-id-1"
		teamID2 := "team-id-2"

		// team 1 boards
		board1 := &model.Board{
			ID:     "board-id-1",
			TeamID: teamID1,
			Type:   model.BoardTypeOpen,
		}
		rBoard1, _, err := store.InsertBoardWithAdmin(board1, userID)
		require.NoError(t, err)

		board2 := &model.Board{
			ID:     "board-id-2",
			TeamID: teamID1,
			Type:   model.BoardTypePrivate,
		}
		rBoard2, _, err := store.InsertBoardWithAdmin(board2, userID)
		require.NoError(t, err)

		board3 := &model.Board{
			ID:     "board-id-3",
			TeamID: teamID1,
			Type:   model.BoardTypeOpen,
		}
		rBoard3, err := store.InsertBoard(board3, "other-user")
		require.NoError(t, err)

		board4 := &model.Board{
			ID:     "board-id-4",
			TeamID: teamID1,
			Type:   model.BoardTypePrivate,
		}
		_, err = store.InsertBoard(board4, "other-user")
		require.NoError(t, err)

		// team 2 boards
		board5 := &model.Board{
			ID:     "board-id-5",
			TeamID: teamID2,
			Type:   model.BoardTypeOpen,
		}
		_, _, err = store.InsertBoardWithAdmin(board5, userID)
		require.NoError(t, err)

		board6 := &model.Board{
			ID:     "board-id-6",
			TeamID: teamID1,
			Type:   model.BoardTypePrivate,
		}
		_, err = store.InsertBoard(board6, "other-user")
		require.NoError(t, err)

		t.Run("should only find the two boards that the user is a member of for team 1 plus the one open board", func(t *testing.T) {
			boards, err := store.GetBoardsForUserAndTeam(userID, teamID1, true)
			require.NoError(t, err)
			require.ElementsMatch(t, []*model.Board{
				rBoard1,
				rBoard2,
				rBoard3,
			}, boards)
		})

		t.Run("should only find the two boards that the user is a member of for team 1", func(t *testing.T) {
			boards, err := store.GetBoardsForUserAndTeam(userID, teamID1, false)
			require.NoError(t, err)
			require.ElementsMatch(t, []*model.Board{
				rBoard1,
				rBoard2,
			}, boards)
		})

		t.Run("should only find the board that the user is a member of for team 2", func(t *testing.T) {
			boards, err := store.GetBoardsForUserAndTeam(userID, teamID2, true)
			require.NoError(t, err)
			require.Len(t, boards, 1)
			require.Equal(t, board5.ID, boards[0].ID)
		})
	})
}

func testGetBoardsInTeamByIds(t *testing.T, store store.Store) {
	t.Run("should return err not all found if one or more of the ids are not found", func(t *testing.T) {
		for _, boardID := range []string{"board-id-1", "board-id-2"} {
			board := &model.Board{
				ID:     boardID,
				TeamID: testTeamID,
				Type:   model.BoardTypeOpen,
			}
			rBoard, _, err := store.InsertBoardWithAdmin(board, testUserID)
			require.NoError(t, err)
			require.NotNil(t, rBoard)
		}

		testCases := []struct {
			Name          string
			BoardIDs      []string
			ExpectedError bool
			ExpectedLen   int
		}{
			{
				Name:          "if none of the IDs are found",
				BoardIDs:      []string{"nonexistent-1", "nonexistent-2"},
				ExpectedError: true,
				ExpectedLen:   0,
			},
			{
				Name:          "if not all of the IDs are found",
				BoardIDs:      []string{"nonexistent-1", "board-id-1"},
				ExpectedError: true,
				ExpectedLen:   1,
			},
			{
				Name:          "if all of the IDs are found",
				BoardIDs:      []string{"board-id-1", "board-id-2"},
				ExpectedError: false,
				ExpectedLen:   2,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				boards, err := store.GetBoardsInTeamByIds(tc.BoardIDs, testTeamID)
				if tc.ExpectedError {
					var naf *model.ErrNotAllFound
					require.ErrorAs(t, err, &naf)
					require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
				} else {
					require.NoError(t, err)
				}
				require.Len(t, boards, tc.ExpectedLen)
			})
		}
	})
}

func testInsertBoard(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("valid public board", func(t *testing.T) {
		board := &model.Board{
			ID:     "id-test-public",
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.Equal(t, board.ID, newBoard.ID)
		require.Equal(t, newBoard.Type, model.BoardTypeOpen)
		require.NotZero(t, newBoard.CreateAt)
		require.NotZero(t, newBoard.UpdateAt)
		require.Zero(t, newBoard.DeleteAt)
		require.Equal(t, userID, newBoard.CreatedBy)
		require.Equal(t, newBoard.CreatedBy, newBoard.ModifiedBy)
	})

	t.Run("valid private board", func(t *testing.T) {
		board := &model.Board{
			ID:     "id-test-private",
			TeamID: testTeamID,
			Type:   model.BoardTypePrivate,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.Equal(t, board.ID, newBoard.ID)
		require.Equal(t, newBoard.Type, model.BoardTypePrivate)
		require.NotZero(t, newBoard.CreateAt)
		require.NotZero(t, newBoard.UpdateAt)
		require.Zero(t, newBoard.DeleteAt)
		require.Equal(t, userID, newBoard.CreatedBy)
		require.Equal(t, newBoard.CreatedBy, newBoard.ModifiedBy)
	})

	t.Run("invalid properties field board", func(t *testing.T) {
		board := &model.Board{
			ID:         "id-test-props",
			TeamID:     testTeamID,
			Properties: map[string]interface{}{"no-serializable-value": t.Run},
		}

		_, err := store.InsertBoard(board, userID)
		require.Error(t, err)

		rBoard, err := store.GetBoard(board.ID)
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
		require.Nil(t, rBoard)
	})

	t.Run("update board", func(t *testing.T) {
		board := &model.Board{
			ID:     "id-test-public",
			TeamID: testTeamID,
			Title:  "New title",
		}

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		newBoard, err := store.InsertBoard(board, "user2")
		require.NoError(t, err)
		require.Equal(t, "New title", newBoard.Title)
		require.Equal(t, "user2", newBoard.ModifiedBy)
	})

	t.Run("test update board type", func(t *testing.T) {
		board := &model.Board{
			ID:    "id-test-type-board",
			Title: "Public board",
			Type:  model.BoardTypeOpen,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.Equal(t, model.BoardTypeOpen, newBoard.Type)

		boardUpdate := &model.Board{
			ID:   "id-test-type-board",
			Type: model.BoardTypePrivate,
		}

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		modifiedBoard, err := store.InsertBoard(boardUpdate, userID)
		require.NoError(t, err)
		require.Equal(t, model.BoardTypePrivate, modifiedBoard.Type)
	})
}

func testPatchBoard(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("should return error if the board doesn't exist", func(t *testing.T) {
		newTitle := "A new title"
		patch := &model.BoardPatch{Title: &newTitle}

		board, err := store.PatchBoard("nonexistent-board-id", patch, userID)
		require.Error(t, err)
		require.Nil(t, board)
	})

	t.Run("should correctly apply a simple patch", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)
		userID2 := "user-id-2"

		board := &model.Board{
			ID:          boardID,
			TeamID:      testTeamID,
			Type:        model.BoardTypeOpen,
			Title:       "A simple title",
			Description: "A simple description",
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)
		require.Equal(t, userID, newBoard.CreatedBy)

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		newTitle := "A new title"
		newDescription := "A new description"
		patch := &model.BoardPatch{Title: &newTitle, Description: &newDescription}
		patchedBoard, err := store.PatchBoard(boardID, patch, userID2)
		require.NoError(t, err)
		require.Equal(t, newTitle, patchedBoard.Title)
		require.Equal(t, newDescription, patchedBoard.Description)
		require.Equal(t, userID, patchedBoard.CreatedBy)
		require.Equal(t, userID2, patchedBoard.ModifiedBy)
	})

	t.Run("should correctly update the board properties", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)

		board := &model.Board{
			ID:     boardID,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
			Properties: map[string]interface{}{
				"one": "1",
				"two": "2",
			},
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)
		require.Equal(t, "1", newBoard.Properties["one"].(string))
		require.Equal(t, "2", newBoard.Properties["two"].(string))

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		patch := &model.BoardPatch{
			UpdatedProperties: map[string]interface{}{"three": "3"},
			DeletedProperties: []string{"one"},
		}
		patchedBoard, err := store.PatchBoard(boardID, patch, userID)
		require.NoError(t, err)
		require.NotContains(t, patchedBoard.Properties, "one")
		require.Equal(t, "2", patchedBoard.Properties["two"].(string))
		require.Equal(t, "3", patchedBoard.Properties["three"].(string))
	})

	t.Run("should correctly modify the board's type", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)

		board := &model.Board{
			ID:     boardID,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)
		require.Equal(t, newBoard.Type, model.BoardTypeOpen)

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		newType := model.BoardTypePrivate
		patch := &model.BoardPatch{Type: &newType}
		patchedBoard, err := store.PatchBoard(boardID, patch, userID)
		require.NoError(t, err)
		require.Equal(t, model.BoardTypePrivate, patchedBoard.Type)
	})

	t.Run("a patch that doesn't include any of the properties should not modify them", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)
		properties := map[string]interface{}{"prop1": "val1"}
		cardProperties := []map[string]interface{}{{"prop2": "val2"}}

		board := &model.Board{
			ID:             boardID,
			TeamID:         testTeamID,
			Type:           model.BoardTypeOpen,
			Properties:     properties,
			CardProperties: cardProperties,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)
		require.Equal(t, newBoard.Type, model.BoardTypeOpen)
		require.Equal(t, properties, newBoard.Properties)
		require.Equal(t, cardProperties, newBoard.CardProperties)

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		newType := model.BoardTypePrivate
		patch := &model.BoardPatch{Type: &newType}
		patchedBoard, err := store.PatchBoard(boardID, patch, userID)
		require.NoError(t, err)
		require.Equal(t, model.BoardTypePrivate, patchedBoard.Type)
		require.Equal(t, properties, patchedBoard.Properties)
		require.Equal(t, cardProperties, patchedBoard.CardProperties)
	})

	t.Run("a patch that removes a card property and updates another should work correctly", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)
		prop1 := map[string]interface{}{"id": "prop1", "value": "val1"}
		prop2 := map[string]interface{}{"id": "prop2", "value": "val2"}
		prop3 := map[string]interface{}{"id": "prop3", "value": "val3"}
		cardProperties := []map[string]interface{}{prop1, prop2, prop3}

		board := &model.Board{
			ID:             boardID,
			TeamID:         testTeamID,
			Type:           model.BoardTypeOpen,
			CardProperties: cardProperties,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)
		require.Equal(t, newBoard.Type, model.BoardTypeOpen)
		require.Equal(t, cardProperties, newBoard.CardProperties)

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		newProp1 := map[string]interface{}{"id": "prop1", "value": "newval1"}
		expectedCardProperties := []map[string]interface{}{newProp1, prop3}
		patch := &model.BoardPatch{
			UpdatedCardProperties: []map[string]interface{}{newProp1},
			DeletedCardProperties: []string{"prop2"},
		}
		patchedBoard, err := store.PatchBoard(boardID, patch, userID)
		require.NoError(t, err)
		require.ElementsMatch(t, expectedCardProperties, patchedBoard.CardProperties)
	})
}

func testDeleteBoard(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("should return an error if the board doesn't exist", func(t *testing.T) {
		require.Error(t, store.DeleteBoard("nonexistent-board-id", userID))
	})

	t.Run("should correctly delete the board", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)

		board := &model.Board{
			ID:     boardID,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)

		rBoard, err := store.GetBoard(boardID)
		require.NoError(t, err)
		require.NotNil(t, rBoard)

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		require.NoError(t, store.DeleteBoard(boardID, userID))

		r2Board, err := store.GetBoard(boardID)
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
		require.Nil(t, r2Board)
	})
}

func testInsertBoardWithAdmin(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("should correctly create a board and the admin membership with the creator", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)

		board := &model.Board{
			ID:     boardID,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		newBoard, newMember, err := store.InsertBoardWithAdmin(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)
		require.Equal(t, userID, newBoard.CreatedBy)
		require.Equal(t, userID, newBoard.ModifiedBy)
		require.NotNil(t, newMember)
		require.Equal(t, userID, newMember.UserID)
		require.Equal(t, boardID, newMember.BoardID)
		require.True(t, newMember.SchemeAdmin)
		require.True(t, newMember.SchemeEditor)
	})
}

func testSaveMember(t *testing.T, store store.Store) {
	userID := testUserID
	boardID := testBoardID

	t.Run("should correctly create a member", func(t *testing.T) {
		bm := &model.BoardMember{
			UserID:      userID,
			BoardID:     boardID,
			SchemeAdmin: true,
		}

		memberHistory, err := store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		initialMemberHistory := len(memberHistory)

		nbm, err := store.SaveMember(bm)
		require.NoError(t, err)
		require.Equal(t, userID, nbm.UserID)
		require.Equal(t, boardID, nbm.BoardID)

		require.True(t, nbm.SchemeAdmin)

		memberHistory, err = store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		require.Len(t, memberHistory, initialMemberHistory+1)
	})

	t.Run("should correctly update a member", func(t *testing.T) {
		bm := &model.BoardMember{
			UserID:       userID,
			BoardID:      boardID,
			SchemeEditor: true,
			SchemeViewer: true,
		}

		memberHistory, err := store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		initialMemberHistory := len(memberHistory)

		nbm, err := store.SaveMember(bm)
		require.NoError(t, err)
		require.Equal(t, userID, nbm.UserID)
		require.Equal(t, boardID, nbm.BoardID)

		require.False(t, nbm.SchemeAdmin)
		require.True(t, nbm.SchemeEditor)
		require.True(t, nbm.SchemeViewer)

		memberHistory, err = store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		require.Len(t, memberHistory, initialMemberHistory)
	})

	t.Run("should return empty list if no results are found", func(t *testing.T) {
		memberHistory, err := store.GetBoardMemberHistory(boardID, "nonexistent-user", 0)
		require.NoError(t, err)
		require.Empty(t, memberHistory)
	})
}

func testGetMemberForBoard(t *testing.T, store store.Store) {
	userID := testUserID
	boardID := testBoardID

	t.Run("should return an error not found for nonexisting membership", func(t *testing.T) {
		bm, err := store.GetMemberForBoard(boardID, userID)
		var nf *model.ErrNotFound
		require.ErrorAs(t, err, &nf)
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
		require.Nil(t, bm)
	})

	t.Run("should return the membership if exists", func(t *testing.T) {
		bm := &model.BoardMember{
			UserID:      userID,
			BoardID:     boardID,
			SchemeAdmin: true,
		}

		nbm, err := store.SaveMember(bm)
		require.NoError(t, err)
		require.NotNil(t, nbm)

		rbm, err := store.GetMemberForBoard(boardID, userID)
		require.NoError(t, err)
		require.NotNil(t, rbm)
		require.Equal(t, userID, rbm.UserID)
		require.Equal(t, boardID, rbm.BoardID)
		require.True(t, rbm.SchemeAdmin)
	})
}

func testGetMembersForBoard(t *testing.T, store store.Store) {
	t.Run("should return empty list if there are no members on a board", func(t *testing.T) {
		members, err := store.GetMembersForBoard(testBoardID)
		require.NoError(t, err)
		require.Empty(t, members)
	})

	t.Run("should return the members of the board", func(t *testing.T) {
		boardID1 := "board-id-1"
		boardID2 := "board-id-2"

		userID1 := "user-id-11"
		userID2 := "user-id-12"
		userID3 := "user-id-13"

		bm1 := &model.BoardMember{BoardID: boardID1, UserID: userID1, SchemeAdmin: true}
		_, err1 := store.SaveMember(bm1)
		require.NoError(t, err1)

		bm2 := &model.BoardMember{BoardID: boardID1, UserID: userID2, SchemeEditor: true}
		_, err2 := store.SaveMember(bm2)
		require.NoError(t, err2)

		bm3 := &model.BoardMember{BoardID: boardID2, UserID: userID3, SchemeAdmin: true}
		_, err3 := store.SaveMember(bm3)
		require.NoError(t, err3)

		getMemberIDs := func(members []*model.BoardMember) []string {
			ids := make([]string, len(members))
			for i, member := range members {
				ids[i] = member.UserID
			}
			return ids
		}

		board1Members, err := store.GetMembersForBoard(boardID1)
		require.NoError(t, err)
		require.Len(t, board1Members, 2)
		require.ElementsMatch(t, []string{userID1, userID2}, getMemberIDs(board1Members))

		board2Members, err := store.GetMembersForBoard(boardID2)
		require.NoError(t, err)
		require.Len(t, board2Members, 1)
		require.ElementsMatch(t, []string{userID3}, getMemberIDs(board2Members))
	})
}

func testGetMembersForUser(t *testing.T, store store.Store) {
	t.Run("should return empty list if there are no memberships for a user", func(t *testing.T) {
		members, err := store.GetMembersForUser(testUserID)
		require.NoError(t, err)
		require.Empty(t, members)
	})
}

func testDeleteMember(t *testing.T, store store.Store) {
	userID := testUserID
	boardID := testBoardID

	t.Run("should return nil if deleting a nonexistent member", func(t *testing.T) {
		memberHistory, err := store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		initialMemberHistory := len(memberHistory)

		require.NoError(t, store.DeleteMember(boardID, userID))

		memberHistory, err = store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		require.Len(t, memberHistory, initialMemberHistory)
	})

	t.Run("should correctly delete a member", func(t *testing.T) {
		bm := &model.BoardMember{
			UserID:      userID,
			BoardID:     boardID,
			SchemeAdmin: true,
		}

		nbm, err := store.SaveMember(bm)
		require.NoError(t, err)
		require.NotNil(t, nbm)

		memberHistory, err := store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		initialMemberHistory := len(memberHistory)

		require.NoError(t, store.DeleteMember(boardID, userID))

		rbm, err := store.GetMemberForBoard(boardID, userID)
		require.True(t, model.IsErrNotFound(err), "Should be ErrNotFound compatible error")
		require.Nil(t, rbm)

		memberHistory, err = store.GetBoardMemberHistory(boardID, userID, 0)
		require.NoError(t, err)
		require.Len(t, memberHistory, initialMemberHistory+1)
	})
}

func testSearchBoardsForUser(t *testing.T, store store.Store) {
	teamID1 := "team-id-1"
	teamID2 := "team-id-2"
	userID := "user-id-1"

	t.Run("should return empty if user is not a member of any board and there are no public boards on the team", func(t *testing.T) {
		boards, err := store.SearchBoardsForUser("", model.BoardSearchFieldTitle, userID, true)
		require.NoError(t, err)
		require.Empty(t, boards)
	})

	board1 := &model.Board{
		ID:         "board-id-1",
		TeamID:     teamID1,
		Type:       model.BoardTypeOpen,
		Title:      "Public Board with admin",
		Properties: map[string]any{"foo": "bar1"},
	}
	_, _, err := store.InsertBoardWithAdmin(board1, userID)
	require.NoError(t, err)

	board2 := &model.Board{
		ID:         "board-id-2",
		TeamID:     teamID1,
		Type:       model.BoardTypeOpen,
		Title:      "Public Board",
		Properties: map[string]any{"foo": "bar2"},
	}
	_, err = store.InsertBoard(board2, userID)
	require.NoError(t, err)

	board3 := &model.Board{
		ID:     "board-id-3",
		TeamID: teamID1,
		Type:   model.BoardTypePrivate,
		Title:  "Private Board with admin",
	}
	_, _, err = store.InsertBoardWithAdmin(board3, userID)
	require.NoError(t, err)

	board4 := &model.Board{
		ID:     "board-id-4",
		TeamID: teamID1,
		Type:   model.BoardTypePrivate,
		Title:  "Private Board",
	}
	_, err = store.InsertBoard(board4, userID)
	require.NoError(t, err)

	board5 := &model.Board{
		ID:     "board-id-5",
		TeamID: teamID2,
		Type:   model.BoardTypeOpen,
		Title:  "Public Board with admin in team 2",
	}
	_, _, err = store.InsertBoardWithAdmin(board5, userID)
	require.NoError(t, err)

	testCases := []struct {
		Name             string
		TeamID           string
		UserID           string
		Term             string
		SearchField      model.BoardSearchField
		IncludePublic    bool
		ExpectedBoardIDs []string
	}{
		{
			Name:             "should find all private boards that the user is a member of and public boards with an empty term",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "",
			SearchField:      model.BoardSearchFieldTitle,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{board1.ID, board2.ID, board3.ID, board5.ID},
		},
		{
			Name:             "should find all with term board",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "board",
			SearchField:      model.BoardSearchFieldTitle,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{board1.ID, board2.ID, board3.ID, board5.ID},
		},
		{
			Name:             "should find all with term board where the user is member of",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "board",
			SearchField:      model.BoardSearchFieldTitle,
			IncludePublic:    false,
			ExpectedBoardIDs: []string{board1.ID, board3.ID, board5.ID},
		},
		{
			Name:             "should find only public as per the term, wether user is a member or not",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "public",
			SearchField:      model.BoardSearchFieldTitle,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{board1.ID, board2.ID, board5.ID},
		},
		{
			Name:             "should find only private as per the term, wether user is a member or not",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "priv",
			SearchField:      model.BoardSearchFieldTitle,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{board3.ID},
		},
		{
			Name:             "should find no board in team 2 with a non matching term",
			TeamID:           teamID2,
			UserID:           userID,
			Term:             "non-matching-term",
			SearchField:      model.BoardSearchFieldTitle,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{},
		},
		{
			Name:             "should find all boards with a named property",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "foo",
			SearchField:      model.BoardSearchFieldPropertyName,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{board1.ID, board2.ID},
		},
		{
			Name:             "should find no boards with a non-existing named property",
			TeamID:           teamID1,
			UserID:           userID,
			Term:             "bogus",
			SearchField:      model.BoardSearchFieldPropertyName,
			IncludePublic:    true,
			ExpectedBoardIDs: []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			boards, err := store.SearchBoardsForUser(tc.Term, tc.SearchField, tc.UserID, tc.IncludePublic)
			require.NoError(t, err)

			boardIDs := []string{}
			for _, board := range boards {
				boardIDs = append(boardIDs, board.ID)
			}
			require.ElementsMatch(t, tc.ExpectedBoardIDs, boardIDs)
		})
	}
}

func testSearchBoardsForUserInTeam(t *testing.T, store store.Store) {
	t.Run("should return empty list if there are no resutls", func(t *testing.T) {
		boards, err := store.SearchBoardsForUserInTeam("nonexistent-team-id", "", testUserID)
		require.NoError(t, err)
		require.Empty(t, boards)
	})
}

func testUndeleteBoard(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("existing id", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)

		board := &model.Board{
			ID:              boardID,
			TeamID:          testTeamID,
			Type:            model.BoardTypeOpen,
			Title:           "Dunder Mifflin Scranton",
			MinimumRole:     model.BoardRoleCommenter,
			Description:     "Bears, beets, Battlestar Gallectica",
			Icon:            "🐻",
			ShowDescription: true,
			IsTemplate:      false,
			Properties: map[string]interface{}{
				"prop_1": "value_1",
			},
			CardProperties: []map[string]interface{}{
				{
					"prop_1": "value_1",
				},
			},
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)

		// Wait for not colliding the ID+insert_at key
		time.Sleep(1 * time.Millisecond)
		err = store.DeleteBoard(boardID, userID)
		require.NoError(t, err)

		board, err = store.GetBoard(boardID)
		require.Error(t, err)
		require.Nil(t, board)

		time.Sleep(1 * time.Millisecond)
		err = store.UndeleteBoard(boardID, userID)
		require.NoError(t, err)

		board, err = store.GetBoard(boardID)
		require.NoError(t, err)
		require.NotNil(t, board)

		// verifying the data after un-delete
		require.Equal(t, "Dunder Mifflin Scranton", board.Title)
		require.Equal(t, "user-id", board.CreatedBy)
		require.Equal(t, "user-id", board.ModifiedBy)
		require.Equal(t, model.BoardRoleCommenter, board.MinimumRole)
		require.Equal(t, "Bears, beets, Battlestar Gallectica", board.Description)
		require.Equal(t, "🐻", board.Icon)
		require.True(t, board.ShowDescription)
		require.False(t, board.IsTemplate)
		require.Equal(t, board.Properties["prop_1"].(string), "value_1")
		require.Equal(t, 1, len(board.CardProperties))
		require.Equal(t, board.CardProperties[0]["prop_1"], "value_1")
		require.Equal(t, board.CardProperties[0]["prop_1"], "value_1")
	})

	t.Run("existing id multiple times", func(t *testing.T) {
		boardID := utils.NewID(utils.IDTypeBoard)

		board := &model.Board{
			ID:     boardID,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		newBoard, err := store.InsertBoard(board, userID)
		require.NoError(t, err)
		require.NotNil(t, newBoard)

		// Wait for not colliding the ID+insert_at key
		time.Sleep(1 * time.Millisecond)
		err = store.DeleteBoard(boardID, userID)
		require.NoError(t, err)

		board, err = store.GetBoard(boardID)
		require.Error(t, err)
		require.Nil(t, board)

		// Wait for not colliding the ID+insert_at key
		time.Sleep(1 * time.Millisecond)
		err = store.UndeleteBoard(boardID, userID)
		require.NoError(t, err)

		board, err = store.GetBoard(boardID)
		require.NoError(t, err)
		require.NotNil(t, board)

		// Wait for not colliding the ID+insert_at key
		time.Sleep(1 * time.Millisecond)
		err = store.UndeleteBoard(boardID, userID)
		require.NoError(t, err)

		board, err = store.GetBoard(boardID)
		require.NoError(t, err)
		require.NotNil(t, board)
	})

	t.Run("from not existing id", func(t *testing.T) {
		// Wait for not colliding the ID+insert_at key
		time.Sleep(1 * time.Millisecond)
		err := store.UndeleteBoard("not-exists", userID)
		require.NoError(t, err)

		block, err := store.GetBoard("not-exists")
		require.Error(t, err)
		require.Nil(t, block)
	})
}

func testGetBoardHistory(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("testGetBoardHistory: create board", func(t *testing.T) {
		originalTitle := "Board: original title"
		boardID := utils.NewID(utils.IDTypeBoard)
		board := &model.Board{
			ID:     boardID,
			Title:  originalTitle,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		rBoard1, err := store.InsertBoard(board, userID)
		require.NoError(t, err)

		opts := model.QueryBoardHistoryOptions{
			Limit:      0,
			Descending: false,
		}

		boards, err := store.GetBoardHistory(board.ID, opts)
		require.NoError(t, err)
		require.Len(t, boards, 1)

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		userID2 := "user-id-2"
		newTitle := "Board: A new title"
		newDescription := "A new description"
		patch := &model.BoardPatch{Title: &newTitle, Description: &newDescription}
		patchedBoard, err := store.PatchBoard(boardID, patch, userID2)
		require.NoError(t, err)

		// Updated history
		boards, err = store.GetBoardHistory(board.ID, opts)
		require.NoError(t, err)
		require.Len(t, boards, 2)
		require.Equal(t, boards[0].Title, originalTitle)
		require.Equal(t, boards[1].Title, newTitle)
		require.Equal(t, boards[1].Description, newDescription)

		// Check history against latest board
		rBoard2, err := store.GetBoard(board.ID)
		require.NoError(t, err)
		require.Equal(t, rBoard2.Title, newTitle)
		require.Equal(t, rBoard2.Title, boards[1].Title)
		require.NotZero(t, rBoard2.UpdateAt)
		require.Equal(t, rBoard1.UpdateAt, boards[0].UpdateAt)
		require.Equal(t, rBoard2.UpdateAt, patchedBoard.UpdateAt)
		require.Equal(t, rBoard2.UpdateAt, boards[1].UpdateAt)
		require.Equal(t, rBoard1, boards[0])
		require.Equal(t, rBoard2, boards[1])

		// wait to avoid hitting pk uniqueness constraint in history
		time.Sleep(10 * time.Millisecond)

		newTitle2 := "Board: A new title 2"
		patch2 := &model.BoardPatch{Title: &newTitle2}
		patchBoard2, err := store.PatchBoard(boardID, patch2, userID2)
		require.NoError(t, err)

		// Updated history
		opts = model.QueryBoardHistoryOptions{
			Limit:      1,
			Descending: true,
		}
		boards, err = store.GetBoardHistory(board.ID, opts)
		require.NoError(t, err)
		require.Len(t, boards, 1)
		require.Equal(t, boards[0].Title, newTitle2)
		require.Equal(t, boards[0], patchBoard2)

		// Delete board
		time.Sleep(10 * time.Millisecond)
		err = store.DeleteBoard(boardID, userID)
		require.NoError(t, err)

		// Updated history after delete
		opts = model.QueryBoardHistoryOptions{
			Limit:      0,
			Descending: true,
		}
		boards, err = store.GetBoardHistory(board.ID, opts)
		require.NoError(t, err)
		require.Len(t, boards, 4)
		require.NotZero(t, boards[0].UpdateAt)
		require.Greater(t, boards[0].UpdateAt, patchBoard2.UpdateAt)
		require.NotZero(t, boards[0].DeleteAt)
		require.Greater(t, boards[0].DeleteAt, patchBoard2.UpdateAt)
	})

	t.Run("testGetBoardHistory: nonexisting board", func(t *testing.T) {
		opts := model.QueryBoardHistoryOptions{
			Limit:      0,
			Descending: false,
		}
		boards, err := store.GetBoardHistory("nonexistent-id", opts)
		require.NoError(t, err)
		require.Len(t, boards, 0)
	})
}

func testGetBoardCount(t *testing.T, store store.Store) {
	userID := testUserID

	t.Run("test GetBoardCount", func(t *testing.T) {
		originalCount, err := store.GetBoardCount()
		require.NoError(t, err)

		title := "Board: original title"
		boardID := utils.NewID(utils.IDTypeBoard)
		board := &model.Board{
			ID:     boardID,
			Title:  title,
			TeamID: testTeamID,
			Type:   model.BoardTypeOpen,
		}

		_, err = store.InsertBoard(board, userID)
		require.NoError(t, err)

		newCount, err := store.GetBoardCount()
		require.NoError(t, err)
		require.Equal(t, originalCount+1, newCount)
	})
}
