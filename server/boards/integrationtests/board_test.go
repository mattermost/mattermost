// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package integrationtests

import (
	"encoding/json"
	"sort"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/boards/client"
	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/stretchr/testify/require"
)

func TestGetBoards(t *testing.T) {
	t.Run("a non authenticated client should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		teamID := "0"
		newBoard := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
		}

		board, err := th.Server.App().CreateBoard(newBoard, "user-id", false)
		require.NoError(t, err)
		require.NotNil(t, board)

		boards, resp := th.Client.GetBoardsForTeam(teamID)
		th.CheckUnauthorized(resp)
		require.Nil(t, boards)
	})

	t.Run("should only return the boards that the user is a member of", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := "0"
		otherTeamID := "other-team-id"
		user1 := th.GetUser1()
		user2 := th.GetUser2()

		board1 := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
			Title:  "Board 1",
		}
		rBoard1, err := th.Server.App().CreateBoard(board1, user1.ID, true)
		require.NoError(t, err)
		require.NotNil(t, rBoard1)

		board2 := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypeOpen,
			Title:  "Board 2",
		}
		rBoard2, err := th.Server.App().CreateBoard(board2, user2.ID, false)
		require.NoError(t, err)
		require.NotNil(t, rBoard2)

		board3 := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypePrivate,
			Title:  "Board 3",
		}
		rBoard3, err := th.Server.App().CreateBoard(board3, user1.ID, true)
		require.NoError(t, err)
		require.NotNil(t, rBoard3)

		board4 := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypePrivate,
			Title:  "Board 4",
		}
		rBoard4, err := th.Server.App().CreateBoard(board4, user1.ID, false)
		require.NoError(t, err)
		require.NotNil(t, rBoard4)

		board5 := &model.Board{
			TeamID: teamID,
			Type:   model.BoardTypePrivate,
			Title:  "Board 5",
		}
		rBoard5, err := th.Server.App().CreateBoard(board5, user2.ID, true)
		require.NoError(t, err)
		require.NotNil(t, rBoard5)

		board6 := &model.Board{
			TeamID: otherTeamID,
			Type:   model.BoardTypeOpen,
		}
		rBoard6, err := th.Server.App().CreateBoard(board6, user1.ID, true)
		require.NoError(t, err)
		require.NotNil(t, rBoard6)

		boards, resp := th.Client.GetBoardsForTeam(teamID)
		th.CheckOK(resp)
		require.NotNil(t, boards)
		require.ElementsMatch(t, []*model.Board{
			rBoard1,
			rBoard2,
			rBoard3,
		}, boards)

		boardsFromOtherTeam, resp := th.Client.GetBoardsForTeam(otherTeamID)
		th.CheckOK(resp)
		require.NotNil(t, boardsFromOtherTeam)
		require.Len(t, boardsFromOtherTeam, 1)
		require.Equal(t, rBoard6.ID, boardsFromOtherTeam[0].ID)
	})
}

func TestCreateBoard(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		newBoard := &model.Board{
			Title:  "board title",
			Type:   model.BoardTypeOpen,
			TeamID: testTeamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckUnauthorized(resp)
		require.Nil(t, board)
	})

	t.Run("create public board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "board title 1"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		t.Run("creating a board should make the creator an admin", func(t *testing.T) {
			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 1)
			require.Equal(t, me.ID, members[0].UserID)
			require.Equal(t, board.ID, members[0].BoardID)
			require.True(t, members[0].SchemeAdmin)
		})

		t.Run("creator should be able to access the public board and its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rbBoard)
			require.Equal(t, board, rbBoard)

			rBlocks, resp := th.Client.GetBlocksForBoard(board.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks)
		})

		t.Run("A non-member user should be able to access the public board but not its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client2.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rbBoard)
			require.Equal(t, board, rbBoard)

			rBlocks, resp := th.Client2.GetBlocksForBoard(board.ID)
			th.CheckForbidden(resp)
			require.Nil(t, rBlocks)
		})
	})

	t.Run("create private board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "private board title"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypePrivate, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		t.Run("creating a board should make the creator an admin", func(t *testing.T) {
			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 1)
			require.Equal(t, me.ID, members[0].UserID)
			require.Equal(t, board.ID, members[0].BoardID)
			require.True(t, members[0].SchemeAdmin)
		})

		t.Run("creator should be able to access the private board and its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rbBoard)
			require.Equal(t, board, rbBoard)

			rBlocks, resp := th.Client.GetBlocksForBoard(board.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks)
		})

		t.Run("unauthorized user should not be able to access the private board or its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client2.GetBoard(board.ID, "")
			th.CheckForbidden(resp)
			require.Nil(t, rbBoard)

			rBlocks, resp := th.Client2.GetBlocksForBoard(board.ID)
			th.CheckForbidden(resp)
			require.Nil(t, rBlocks)
		})
	})

	t.Run("create invalid board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		title := "invalid board title"
		teamID := testTeamID
		user1 := th.GetUser1()

		t.Run("invalid board type", func(t *testing.T) {
			var invalidBoardType model.BoardType = "invalid"
			newBoard := &model.Board{
				Title:  title,
				TeamID: testTeamID,
				Type:   invalidBoardType,
			}

			board, resp := th.Client.CreateBoard(newBoard)
			th.CheckBadRequest(resp)
			require.Nil(t, board)

			boards, err := th.Server.App().GetBoardsForUserAndTeam(user1.ID, teamID, true)
			require.NoError(t, err)
			require.Empty(t, boards)
		})

		t.Run("no type", func(t *testing.T) {
			newBoard := &model.Board{
				Title:  title,
				TeamID: teamID,
			}
			board, resp := th.Client.CreateBoard(newBoard)
			th.CheckBadRequest(resp)
			require.Nil(t, board)

			boards, err := th.Server.App().GetBoardsForUserAndTeam(user1.ID, teamID, true)
			require.NoError(t, err)
			require.Empty(t, boards)
		})

		t.Run("no team ID", func(t *testing.T) {
			newBoard := &model.Board{
				Title: title,
			}
			board, resp := th.Client.CreateBoard(newBoard)
			// the request is unauthorized because the permission
			// check fails on an empty teamID
			th.CheckForbidden(resp)
			require.Nil(t, board)

			boards, err := th.Server.App().GetBoardsForUserAndTeam(user1.ID, teamID, true)
			require.NoError(t, err)
			require.Empty(t, boards)
		})
	})
}

func TestCreateBoardTemplate(t *testing.T) {
	t.Run("create public board template", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "board template 1"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:      title,
			Type:       model.BoardTypeOpen,
			TeamID:     teamID,
			IsTemplate: true,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		t.Run("creating a board template should make the creator an admin", func(t *testing.T) {
			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 1)
			require.Equal(t, me.ID, members[0].UserID)
			require.Equal(t, board.ID, members[0].BoardID)
			require.True(t, members[0].SchemeAdmin)
		})

		t.Run("creator should be able to access the public board template and its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rbBoard)
			require.Equal(t, board, rbBoard)

			rBlocks, resp := th.Client.GetBlocksForBoard(board.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks)
		})

		t.Run("another user should be able to access the public board template and its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client2.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rbBoard)
			require.Equal(t, board, rbBoard)

			rBlocks, resp := th.Client2.GetBlocksForBoard(board.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks)
		})
	})

	t.Run("create private board template", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "private board template title"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:      title,
			Type:       model.BoardTypePrivate,
			TeamID:     teamID,
			IsTemplate: true,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypePrivate, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		t.Run("creating a board template should make the creator an admin", func(t *testing.T) {
			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 1)
			require.Equal(t, me.ID, members[0].UserID)
			require.Equal(t, board.ID, members[0].BoardID)
			require.True(t, members[0].SchemeAdmin)
		})

		t.Run("creator should be able to access the private board template and its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rbBoard)
			require.Equal(t, board, rbBoard)

			rBlocks, resp := th.Client.GetBlocksForBoard(board.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks)
		})

		t.Run("unauthorized user should not be able to access the private board template or its blocks", func(t *testing.T) {
			rbBoard, resp := th.Client2.GetBoard(board.ID, "")
			th.CheckForbidden(resp)
			require.Nil(t, rbBoard)

			rBlocks, resp := th.Client2.GetBlocksForBoard(board.ID)
			th.CheckForbidden(resp)
			require.Nil(t, rBlocks)
		})
	})
}

func TestGetAllBlocksForBoard(t *testing.T) {
	th := SetupTestHelperWithToken(t).Start()
	defer th.TearDown()

	board := th.CreateBoard("board-id", model.BoardTypeOpen)

	parentBlockID := utils.NewID(utils.IDTypeBlock)
	childBlockID1 := utils.NewID(utils.IDTypeBlock)
	childBlockID2 := utils.NewID(utils.IDTypeBlock)

	t.Run("Create the block structure", func(t *testing.T) {
		newBlocks := []*model.Block{
			{
				ID:       parentBlockID,
				BoardID:  board.ID,
				CreateAt: 1,
				UpdateAt: 1,
				Type:     model.TypeCard,
			},
			{
				ID:       childBlockID1,
				BoardID:  board.ID,
				ParentID: parentBlockID,
				CreateAt: 2,
				UpdateAt: 2,
				Type:     model.TypeCard,
			},
			{
				ID:       childBlockID2,
				BoardID:  board.ID,
				ParentID: parentBlockID,
				CreateAt: 2,
				UpdateAt: 2,
				Type:     model.TypeCard,
			},
		}

		insertedBlocks, resp := th.Client.InsertBlocks(board.ID, newBlocks, false)
		require.NoError(t, resp.Error)
		require.Len(t, insertedBlocks, len(newBlocks))

		insertedBlockIDs := make([]string, len(insertedBlocks))
		for i, b := range insertedBlocks {
			insertedBlockIDs[i] = b.ID
		}

		fetchedBlocks, resp := th.Client.GetAllBlocksForBoard(board.ID)
		require.NoError(t, resp.Error)
		require.Len(t, fetchedBlocks, len(newBlocks))

		fetchedblockIDs := make([]string, len(fetchedBlocks))
		for i, b := range fetchedBlocks {
			fetchedblockIDs[i] = b.ID
		}

		sort.Strings(insertedBlockIDs)
		sort.Strings(fetchedblockIDs)

		require.Equal(t, insertedBlockIDs, fetchedblockIDs)
	})
}

func TestSearchBoards(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		boards, resp := th.Client.SearchBoardsForTeam(testTeamID, "term")
		th.CheckUnauthorized(resp)
		require.Nil(t, boards)
	})

	t.Run("all the matching private boards that the user is a member of and all matching public boards should be returned", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := testTeamID
		user1 := th.GetUser1()

		board1 := &model.Board{
			Title:  "public board where user1 is admin",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard1, err := th.Server.App().CreateBoard(board1, user1.ID, true)
		require.NoError(t, err)

		board2 := &model.Board{
			Title:  "public board where user1 is not member",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard2, err := th.Server.App().CreateBoard(board2, user1.ID, false)
		require.NoError(t, err)

		board3 := &model.Board{
			Title:  "private board where user1 is admin",
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		rBoard3, err := th.Server.App().CreateBoard(board3, user1.ID, true)
		require.NoError(t, err)

		board4 := &model.Board{
			Title:  "private board where user1 is not member",
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		_, err = th.Server.App().CreateBoard(board4, user1.ID, false)
		require.NoError(t, err)

		board5 := &model.Board{
			Title:  "private board where user1 is admin, but in other team",
			Type:   model.BoardTypePrivate,
			TeamID: "other-team-id",
		}
		rBoard5, err := th.Server.App().CreateBoard(board5, user1.ID, true)
		require.NoError(t, err)

		testCases := []struct {
			Name        string
			Client      *client.Client
			Term        string
			ExpectedIDs []string
		}{
			{
				Name:        "should return all boards where user1 is member or that are public",
				Client:      th.Client,
				Term:        "board",
				ExpectedIDs: []string{rBoard1.ID, rBoard2.ID, rBoard3.ID, rBoard5.ID},
			},
			{
				Name:        "matching a full word",
				Client:      th.Client,
				Term:        "admin",
				ExpectedIDs: []string{rBoard1.ID, rBoard3.ID, rBoard5.ID},
			},
			{
				Name:        "matching part of the word",
				Client:      th.Client,
				Term:        "ubli",
				ExpectedIDs: []string{rBoard1.ID, rBoard2.ID},
			},
			{
				Name:        "case insensitive",
				Client:      th.Client,
				Term:        "UBLI",
				ExpectedIDs: []string{rBoard1.ID, rBoard2.ID},
			},
			{
				Name:        "user2 can only see the public boards, as he's not a member of any",
				Client:      th.Client2,
				Term:        "board",
				ExpectedIDs: []string{rBoard1.ID, rBoard2.ID},
			},
		}

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				boards, resp := tc.Client.SearchBoardsForTeam(teamID, tc.Term)
				th.CheckOK(resp)

				boardIDs := []string{}
				for _, board := range boards {
					boardIDs = append(boardIDs, board.ID)
				}

				require.ElementsMatch(t, tc.ExpectedIDs, boardIDs)
			})
		}
	})
}

func TestGetBoard(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		board, resp := th.Client.GetBoard("boar-id", "")
		th.CheckUnauthorized(resp)
		require.Nil(t, board)
	})

	t.Run("valid read token should be enough to get the board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Server.Config().EnablePublicSharedBoards = true

		teamID := testTeamID
		sharingToken := utils.NewID(utils.IDTypeToken)

		board := &model.Board{
			Title:  "public board where user1 is admin",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard, err := th.Server.App().CreateBoard(board, th.GetUser1().ID, true)
		require.NoError(t, err)

		sharing := &model.Sharing{
			ID:       rBoard.ID,
			Enabled:  true,
			Token:    sharingToken,
			UpdateAt: 1,
		}

		success, resp := th.Client.PostSharing(sharing)
		th.CheckOK(resp)
		require.True(t, success)

		// the client logs out
		th.Logout(th.Client)

		// we make sure that the client cannot currently retrieve the
		// board with no session
		board, resp = th.Client.GetBoard(rBoard.ID, "")
		th.CheckUnauthorized(resp)
		require.Nil(t, board)

		// it should be able to retrieve it with the read token
		board, resp = th.Client.GetBoard(rBoard.ID, sharingToken)
		th.CheckOK(resp)
		require.NotNil(t, board)
	})

	t.Run("nonexisting board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		board, resp := th.Client.GetBoard("nonexistent board", "")
		th.CheckNotFound(resp)
		require.Nil(t, board)
	})

	t.Run("a user that doesn't have permissions to a private board cannot retrieve it", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := testTeamID
		newBoard := &model.Board{
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, false)
		require.NoError(t, err)

		rBoard, resp := th.Client.GetBoard(board.ID, "")
		th.CheckForbidden(resp)
		require.Nil(t, rBoard)
	})

	t.Run("a user that has permissions to a private board can retrieve it", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := testTeamID
		newBoard := &model.Board{
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		rBoard, resp := th.Client.GetBoard(board.ID, "")
		th.CheckOK(resp)
		require.NotNil(t, rBoard)
	})

	t.Run("a user that doesn't have permissions to a public board but have them to its team can retrieve it", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		teamID := testTeamID
		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, false)
		require.NoError(t, err)

		rBoard, resp := th.Client.GetBoard(board.ID, "")
		th.CheckOK(resp)
		require.NotNil(t, rBoard)
	})
}

func TestGetBoardMetadata(t *testing.T) {
	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelperWithLicense(t, LicenseEnterprise).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		boardMetadata, resp := th.Client.GetBoardMetadata("boar-id", "")
		th.CheckUnauthorized(resp)
		require.Nil(t, boardMetadata)
	})

	t.Run("getBoardMetadata query is correct", func(t *testing.T) {
		th := SetupTestHelperWithLicense(t, LicenseEnterprise).InitBasic()
		defer th.TearDown()
		th.Server.Config().EnablePublicSharedBoards = true

		teamID := testTeamID

		board := &model.Board{
			Title:  "public board where user1 is admin",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard, err := th.Server.App().CreateBoard(board, th.GetUser1().ID, true)
		require.NoError(t, err)

		// Check metadata
		boardMetadata, resp := th.Client.GetBoardMetadata(rBoard.ID, "")
		th.CheckOK(resp)
		require.NotNil(t, boardMetadata)

		require.Equal(t, rBoard.CreatedBy, boardMetadata.CreatedBy)
		require.Equal(t, rBoard.CreateAt, boardMetadata.DescendantFirstUpdateAt)
		require.Equal(t, rBoard.UpdateAt, boardMetadata.DescendantLastUpdateAt)
		require.Equal(t, rBoard.ModifiedBy, boardMetadata.LastModifiedBy)

		// Insert card1
		card1 := &model.Block{
			ID:      "card1",
			BoardID: rBoard.ID,
			Title:   "Card 1",
		}
		time.Sleep(20 * time.Millisecond)
		require.NoError(t, th.Server.App().InsertBlock(card1, th.GetUser2().ID))
		rCard1, err := th.Server.App().GetBlockByID(card1.ID)
		require.NoError(t, err)

		// Check updated metadata
		boardMetadata, resp = th.Client.GetBoardMetadata(rBoard.ID, "")
		th.CheckOK(resp)
		require.NotNil(t, boardMetadata)

		require.Equal(t, rBoard.CreatedBy, boardMetadata.CreatedBy)
		require.Equal(t, rBoard.CreateAt, boardMetadata.DescendantFirstUpdateAt)
		require.Equal(t, rCard1.UpdateAt, boardMetadata.DescendantLastUpdateAt)
		require.Equal(t, rCard1.ModifiedBy, boardMetadata.LastModifiedBy)

		// Insert card2
		card2 := &model.Block{
			ID:      "card2",
			BoardID: rBoard.ID,
			Title:   "Card 2",
		}
		time.Sleep(20 * time.Millisecond)
		require.NoError(t, th.Server.App().InsertBlock(card2, th.GetUser1().ID))
		rCard2, err := th.Server.App().GetBlockByID(card2.ID)
		require.NoError(t, err)

		// Check updated metadata
		boardMetadata, resp = th.Client.GetBoardMetadata(rBoard.ID, "")
		th.CheckOK(resp)
		require.NotNil(t, boardMetadata)
		require.Equal(t, rBoard.CreatedBy, boardMetadata.CreatedBy)
		require.Equal(t, rBoard.CreateAt, boardMetadata.DescendantFirstUpdateAt)
		require.Equal(t, rCard2.UpdateAt, boardMetadata.DescendantLastUpdateAt)
		require.Equal(t, rCard2.ModifiedBy, boardMetadata.LastModifiedBy)

		t.Run("After delete board", func(t *testing.T) {
			// Delete board
			time.Sleep(20 * time.Millisecond)
			require.NoError(t, th.Server.App().DeleteBoard(rBoard.ID, th.GetUser1().ID))

			// Check updated metadata
			boardMetadata, resp = th.Client.GetBoardMetadata(rBoard.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, boardMetadata)
			require.Equal(t, rBoard.CreatedBy, boardMetadata.CreatedBy)
			require.Equal(t, rBoard.CreateAt, boardMetadata.DescendantFirstUpdateAt)
			require.Greater(t, boardMetadata.DescendantLastUpdateAt, rCard2.UpdateAt)
			require.Equal(t, th.GetUser1().ID, boardMetadata.LastModifiedBy)
		})
	})

	t.Run("getBoardMetadata should fail with no license", func(t *testing.T) {
		th := SetupTestHelperWithLicense(t, LicenseNone).InitBasic()
		defer th.TearDown()
		th.Server.Config().EnablePublicSharedBoards = true

		teamID := testTeamID

		board := &model.Board{
			Title:  "public board where user1 is admin",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard, err := th.Server.App().CreateBoard(board, th.GetUser1().ID, true)
		require.NoError(t, err)

		// Check metadata
		boardMetadata, resp := th.Client.GetBoardMetadata(rBoard.ID, "")
		th.CheckNotImplemented(resp)
		require.Nil(t, boardMetadata)
	})

	t.Run("getBoardMetadata should fail on Professional license", func(t *testing.T) {
		th := SetupTestHelperWithLicense(t, LicenseProfessional).InitBasic()
		defer th.TearDown()
		th.Server.Config().EnablePublicSharedBoards = true

		teamID := testTeamID

		board := &model.Board{
			Title:  "public board where user1 is admin",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard, err := th.Server.App().CreateBoard(board, th.GetUser1().ID, true)
		require.NoError(t, err)

		// Check metadata
		boardMetadata, resp := th.Client.GetBoardMetadata(rBoard.ID, "")
		th.CheckNotImplemented(resp)
		require.Nil(t, boardMetadata)
	})

	t.Run("valid read token should not get the board metadata", func(t *testing.T) {
		th := SetupTestHelperWithLicense(t, LicenseEnterprise).InitBasic()
		defer th.TearDown()
		th.Server.Config().EnablePublicSharedBoards = true

		teamID := testTeamID
		sharingToken := utils.NewID(utils.IDTypeToken)
		userID := th.GetUser1().ID

		board := &model.Board{
			Title:  "public board where user1 is admin",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		rBoard, err := th.Server.App().CreateBoard(board, userID, true)
		require.NoError(t, err)

		sharing := &model.Sharing{
			ID:       rBoard.ID,
			Enabled:  true,
			Token:    sharingToken,
			UpdateAt: 1,
		}

		success, resp := th.Client.PostSharing(sharing)
		th.CheckOK(resp)
		require.True(t, success)

		// the client logs out
		th.Logout(th.Client)

		// we make sure that the client cannot currently retrieve the
		// board with no session
		boardMetadata, resp := th.Client.GetBoardMetadata(rBoard.ID, "")
		th.CheckUnauthorized(resp)
		require.Nil(t, boardMetadata)

		// it should not be able to retrieve it with the read token either
		boardMetadata, resp = th.Client.GetBoardMetadata(rBoard.ID, sharingToken)
		th.CheckUnauthorized(resp)
		require.Nil(t, boardMetadata)
	})
}

func TestPatchBoard(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		initialTitle := "title 1"
		newBoard := &model.Board{
			Title:  initialTitle,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "user-id", false)
		require.NoError(t, err)

		newTitle := "a new title 1"
		patch := &model.BoardPatch{Title: &newTitle}

		rBoard, resp := th.Client.PatchBoard(board.ID, patch)
		th.CheckUnauthorized(resp)
		require.Nil(t, rBoard)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.NoError(t, err)
		require.Equal(t, initialTitle, dbBoard.Title)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newTitle := "a new title 2"
		patch := &model.BoardPatch{Title: &newTitle}

		board, resp := th.Client.PatchBoard("non-existing-board", patch)
		th.CheckNotFound(resp)
		require.Nil(t, board)
	})

	t.Run("invalid patch on a board with permissions", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		user1 := th.GetUser1()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, user1.ID, true)
		require.NoError(t, err)

		var invalidPatchType model.BoardType = "invalid"
		patch := &model.BoardPatch{Type: &invalidPatchType}

		rBoard, resp := th.Client.PatchBoard(board.ID, patch)
		th.CheckBadRequest(resp)
		require.Nil(t, rBoard)
	})

	t.Run("valid patch on a board with permissions", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		user1 := th.GetUser1()

		initialTitle := "title"
		newBoard := &model.Board{
			Title:  initialTitle,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, user1.ID, true)
		require.NoError(t, err)

		newTitle := "a new title"
		patch := &model.BoardPatch{Title: &newTitle}

		rBoard, resp := th.Client.PatchBoard(board.ID, patch)
		th.CheckOK(resp)
		require.NotNil(t, rBoard)
		require.Equal(t, newTitle, rBoard.Title)
	})

	t.Run("valid patch on a board without permissions", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		user1 := th.GetUser1()

		initialTitle := "title"
		newBoard := &model.Board{
			Title:  initialTitle,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, user1.ID, false)
		require.NoError(t, err)

		newTitle := "a new title"
		patch := &model.BoardPatch{Title: &newTitle}

		rBoard, resp := th.Client.PatchBoard(board.ID, patch)
		th.CheckForbidden(resp)
		require.Nil(t, rBoard)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.NoError(t, err)
		require.Equal(t, initialTitle, dbBoard.Title)
	})
}

func TestDeleteBoard(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "user-id", false)
		require.NoError(t, err)

		success, resp := th.Client.DeleteBoard(board.ID)
		th.CheckUnauthorized(resp)
		require.False(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.NoError(t, err)
		require.NotNil(t, dbBoard)
	})

	t.Run("a user without permissions should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "some-user-id", false)
		require.NoError(t, err)

		success, resp := th.Client.DeleteBoard(board.ID)
		th.CheckForbidden(resp)
		require.False(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.NoError(t, err)
		require.NotNil(t, dbBoard)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		success, resp := th.Client.DeleteBoard("non-existing-board")
		th.CheckNotFound(resp)
		require.False(t, success)
	})

	t.Run("an existing board should be correctly deleted", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		success, resp := th.Client.DeleteBoard(board.ID)
		th.CheckOK(resp)
		require.True(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, dbBoard)
	})
}

func TestUndeleteBoard(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "user-id", false)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		err = th.Server.App().DeleteBoard(newBoard.ID, "user-id")
		require.NoError(t, err)

		success, resp := th.Client.UndeleteBoard(board.ID)
		th.CheckUnauthorized(resp)
		require.False(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, dbBoard)
	})

	t.Run("a user without membership should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "some-user-id", false)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		err = th.Server.App().DeleteBoard(newBoard.ID, "some-user-id")
		require.NoError(t, err)

		success, resp := th.Client.UndeleteBoard(board.ID)
		th.CheckForbidden(resp)
		require.False(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, dbBoard)
	})

	t.Run("a user with membership but without permissions should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "some-user-id", false)
		require.NoError(t, err)

		newUser2Member := &model.BoardMember{
			UserID:       "user-id",
			BoardID:      board.ID,
			SchemeEditor: true,
		}
		_, err = th.Server.App().AddMemberToBoard(newUser2Member)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		err = th.Server.App().DeleteBoard(newBoard.ID, "some-user-id")
		require.NoError(t, err)

		success, resp := th.Client.UndeleteBoard(board.ID)
		th.CheckForbidden(resp)
		require.False(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.Error(t, err)
		require.True(t, model.IsErrNotFound(err))
		require.Nil(t, dbBoard)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		success, resp := th.Client.UndeleteBoard("non-existing-board")
		th.CheckForbidden(resp)
		require.False(t, success)
	})

	t.Run("an existing deleted board should be correctly undeleted", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		err = th.Server.App().DeleteBoard(newBoard.ID, "user-id")
		require.NoError(t, err)

		success, resp := th.Client.UndeleteBoard(board.ID)
		th.CheckOK(resp)
		require.True(t, success)

		dbBoard, err := th.Server.App().GetBoard(board.ID)
		require.NoError(t, err)
		require.NotNil(t, dbBoard)
	})
}

func TestGetMembersForBoard(t *testing.T) {
	teamID := testTeamID

	createBoardWithUsers := func(th *TestHelper) *model.Board {
		user1 := th.GetUser1()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, user1.ID, true)
		require.NoError(t, err)

		newUser2Member := &model.BoardMember{
			UserID:       th.GetUser2().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}
		user2Member, err := th.Server.App().AddMemberToBoard(newUser2Member)
		require.NoError(t, err)
		require.NotNil(t, user2Member)

		return board
	}

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		board := createBoardWithUsers(th)
		th.Logout(th.Client)

		members, resp := th.Client.GetMembersForBoard(board.ID)
		th.CheckUnauthorized(resp)
		require.Empty(t, members)
	})

	t.Run("a user without permissions should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		board := createBoardWithUsers(th)

		_ = th.Server.App().DeleteBoardMember(board.ID, th.GetUser2().ID)

		members, resp := th.Client2.GetMembersForBoard(board.ID)
		th.CheckForbidden(resp)
		require.Empty(t, members)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		members, resp := th.Client.GetMembersForBoard("non-existing-board")
		th.CheckForbidden(resp)
		require.Empty(t, members)
	})

	t.Run("should correctly return board members for a valid board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		board := createBoardWithUsers(th)

		members, resp := th.Client.GetMembersForBoard(board.ID)
		th.CheckOK(resp)
		require.Len(t, members, 2)
	})
}

func TestAddMember(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()
		th.Logout(th.Client)

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "user-id", false)
		require.NoError(t, err)

		newMember := &model.BoardMember{
			UserID:       "user1",
			BoardID:      board.ID,
			SchemeEditor: true,
		}

		member, resp := th.Client.AddMemberToBoard(newMember)
		th.CheckUnauthorized(resp)
		require.Nil(t, member)
	})

	t.Run("a user without permissions should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, "user-id", false)
		require.NoError(t, err)

		newMember := &model.BoardMember{
			UserID:       "user1",
			BoardID:      board.ID,
			SchemeEditor: true,
		}

		member, resp := th.Client.AddMemberToBoard(newMember)
		th.CheckForbidden(resp)
		require.Nil(t, member)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newMember := &model.BoardMember{
			UserID:       "user1",
			BoardID:      "non-existing-board-id",
			SchemeEditor: true,
		}

		member, resp := th.Client.AddMemberToBoard(newMember)
		th.CheckNotFound(resp)
		require.Nil(t, member)
	})

	t.Run("should correctly add a new member for a valid board", func(t *testing.T) {
		t.Run("a private board through an admin user", func(t *testing.T) {
			th := SetupTestHelper(t).InitBasic()
			defer th.TearDown()

			newBoard := &model.Board{
				Title:  "title",
				Type:   model.BoardTypePrivate,
				TeamID: teamID,
			}
			board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
			require.NoError(t, err)

			newMember := &model.BoardMember{
				UserID:       th.GetUser2().ID,
				BoardID:      board.ID,
				SchemeEditor: true,
			}

			member, resp := th.Client.AddMemberToBoard(newMember)
			th.CheckOK(resp)
			require.Equal(t, newMember.UserID, member.UserID)
			require.Equal(t, newMember.BoardID, member.BoardID)
			require.Equal(t, newMember.SchemeAdmin, member.SchemeAdmin)
			require.Equal(t, newMember.SchemeEditor, member.SchemeEditor)
			require.False(t, member.SchemeCommenter)
			require.False(t, member.SchemeViewer)
		})

		t.Run("a public board through a user that is not yet a member", func(t *testing.T) {
			th := SetupTestHelper(t).InitBasic()
			defer th.TearDown()

			newBoard := &model.Board{
				Title:  "title",
				Type:   model.BoardTypeOpen,
				TeamID: teamID,
			}
			board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
			require.NoError(t, err)

			newMember := &model.BoardMember{
				UserID:       th.GetUser2().ID,
				BoardID:      board.ID,
				SchemeEditor: true,
			}

			member, resp := th.Client2.AddMemberToBoard(newMember)
			th.CheckForbidden(resp)
			require.Nil(t, member)

			members, resp := th.Client2.GetMembersForBoard(board.ID)
			th.CheckForbidden(resp)
			require.Nil(t, members)

			// Join board - will become an editor
			member, resp = th.Client2.JoinBoard(board.ID)
			th.CheckOK(resp)
			require.NoError(t, resp.Error)
			require.NotNil(t, member)
			require.Equal(t, board.ID, member.BoardID)
			require.Equal(t, th.GetUser2().ID, member.UserID)

			member, resp = th.Client2.AddMemberToBoard(newMember)
			th.CheckOK(resp)
			require.NotNil(t, member)

			members, resp = th.Client2.GetMembersForBoard(board.ID)
			th.CheckOK(resp)
			require.Len(t, members, 2)
		})

		t.Run("should always add a new member as given board role", func(t *testing.T) {
			th := SetupTestHelper(t).InitBasic()
			defer th.TearDown()

			newBoard := &model.Board{
				Title:  "title",
				Type:   model.BoardTypePrivate,
				TeamID: teamID,
			}
			board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
			require.NoError(t, err)

			newMember := &model.BoardMember{
				UserID:          th.GetUser2().ID,
				BoardID:         board.ID,
				SchemeAdmin:     false,
				SchemeEditor:    false,
				SchemeCommenter: true,
			}

			member, resp := th.Client.AddMemberToBoard(newMember)
			th.CheckOK(resp)
			require.Equal(t, newMember.UserID, member.UserID)
			require.Equal(t, newMember.BoardID, member.BoardID)
			require.False(t, member.SchemeAdmin)
			require.False(t, member.SchemeEditor)
			require.True(t, member.SchemeCommenter)
		})
	})

	t.Run("should do nothing if the member already exists", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		newMember := &model.BoardMember{
			UserID:       th.GetUser1().ID,
			BoardID:      board.ID,
			SchemeAdmin:  false,
			SchemeEditor: true,
		}

		members, err := th.Server.App().GetMembersForBoard(board.ID)
		require.NoError(t, err)
		require.Len(t, members, 1)
		require.True(t, members[0].SchemeAdmin)
		require.True(t, members[0].SchemeEditor)

		member, resp := th.Client.AddMemberToBoard(newMember)
		th.CheckOK(resp)
		require.True(t, member.SchemeAdmin)
		require.True(t, member.SchemeEditor)

		members, err = th.Server.App().GetMembersForBoard(board.ID)
		require.NoError(t, err)
		require.Len(t, members, 1)
		require.True(t, members[0].SchemeAdmin)
		require.True(t, members[0].SchemeEditor)
	})
}

func TestUpdateMember(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		updatedMember := &model.BoardMember{
			UserID:       th.GetUser1().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}

		th.Logout(th.Client)
		member, resp := th.Client.UpdateBoardMember(updatedMember)
		th.CheckUnauthorized(resp)
		require.Nil(t, member)
	})

	t.Run("a user without permissions should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		updatedMember := &model.BoardMember{
			UserID:       th.GetUser1().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}

		member, resp := th.Client2.UpdateBoardMember(updatedMember)
		th.CheckForbidden(resp)
		require.Nil(t, member)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		updatedMember := &model.BoardMember{
			UserID:       th.GetUser1().ID,
			BoardID:      "non-existent-board-id",
			SchemeEditor: true,
		}

		member, resp := th.Client.UpdateBoardMember(updatedMember)
		th.CheckForbidden(resp)
		require.Nil(t, member)
	})

	t.Run("should correctly update a member for a valid board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		newUser2Member := &model.BoardMember{
			UserID:       th.GetUser2().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}
		user2Member, err := th.Server.App().AddMemberToBoard(newUser2Member)
		require.NoError(t, err)
		require.NotNil(t, user2Member)
		require.False(t, user2Member.SchemeAdmin)
		require.True(t, user2Member.SchemeEditor)

		memberUpdate := &model.BoardMember{
			UserID:       th.GetUser2().ID,
			BoardID:      board.ID,
			SchemeAdmin:  true,
			SchemeEditor: true,
		}

		updatedUser2Member, resp := th.Client.UpdateBoardMember(memberUpdate)
		th.CheckOK(resp)
		require.True(t, updatedUser2Member.SchemeAdmin)
		require.True(t, updatedUser2Member.SchemeEditor)
	})

	t.Run("should not update a member if that means that a board will not have any admin", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		memberUpdate := &model.BoardMember{
			UserID:       th.GetUser1().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}

		updatedUser1Member, resp := th.Client.UpdateBoardMember(memberUpdate)
		th.CheckBadRequest(resp)
		require.Nil(t, updatedUser1Member)

		members, err := th.Server.App().GetMembersForBoard(board.ID)
		require.NoError(t, err)
		require.Len(t, members, 1)
		require.True(t, members[0].SchemeAdmin)
	})

	t.Run("should always disable the admin role on update member if the user is a guest", func(t *testing.T) {
		th := SetupTestHelperPluginMode(t)
		defer th.TearDown()
		clients := setupClients(th)

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, userAdmin, true)
		require.NoError(t, err)

		newGuestMember := &model.BoardMember{
			UserID:          userGuest,
			BoardID:         board.ID,
			SchemeViewer:    true,
			SchemeCommenter: true,
			SchemeEditor:    true,
			SchemeAdmin:     false,
		}
		guestMember, err := th.Server.App().AddMemberToBoard(newGuestMember)
		require.NoError(t, err)
		require.NotNil(t, guestMember)
		require.True(t, guestMember.SchemeViewer)
		require.True(t, guestMember.SchemeCommenter)
		require.True(t, guestMember.SchemeEditor)
		require.False(t, guestMember.SchemeAdmin)

		memberUpdate := &model.BoardMember{
			UserID:          userGuest,
			BoardID:         board.ID,
			SchemeAdmin:     true,
			SchemeViewer:    true,
			SchemeCommenter: true,
			SchemeEditor:    true,
		}

		updatedGuestMember, resp := clients.Admin.UpdateBoardMember(memberUpdate)
		th.CheckOK(resp)
		require.True(t, updatedGuestMember.SchemeViewer)
		require.True(t, updatedGuestMember.SchemeCommenter)
		require.True(t, updatedGuestMember.SchemeEditor)
		require.False(t, updatedGuestMember.SchemeAdmin)
	})
}

func TestDeleteMember(t *testing.T) {
	teamID := testTeamID

	t.Run("a non authenticated user should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		member := &model.BoardMember{
			UserID:  th.GetUser1().ID,
			BoardID: board.ID,
		}

		th.Logout(th.Client)
		success, resp := th.Client.DeleteBoardMember(member)
		th.CheckUnauthorized(resp)
		require.False(t, success)
	})

	t.Run("a user without permissions should be rejected", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		member := &model.BoardMember{
			UserID:  th.GetUser1().ID,
			BoardID: board.ID,
		}

		success, resp := th.Client2.DeleteBoardMember(member)
		th.CheckForbidden(resp)
		require.False(t, success)
	})

	t.Run("non existing board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		updatedMember := &model.BoardMember{
			UserID:  th.GetUser1().ID,
			BoardID: "non-existent-board-id",
		}

		success, resp := th.Client.DeleteBoardMember(updatedMember)
		th.CheckNotFound(resp)
		require.False(t, success)
	})

	t.Run("should correctly delete a member for a valid board", func(t *testing.T) {
		//nolint:dupl
		t.Run("admin removing a user", func(t *testing.T) {
			th := SetupTestHelper(t).InitBasic()
			defer th.TearDown()

			newBoard := &model.Board{
				Title:  "title",
				Type:   model.BoardTypePrivate,
				TeamID: teamID,
			}
			board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
			require.NoError(t, err)

			newUser2Member := &model.BoardMember{
				UserID:       th.GetUser2().ID,
				BoardID:      board.ID,
				SchemeEditor: true,
			}
			user2Member, err := th.Server.App().AddMemberToBoard(newUser2Member)
			require.NoError(t, err)
			require.NotNil(t, user2Member)
			require.False(t, user2Member.SchemeAdmin)
			require.True(t, user2Member.SchemeEditor)

			memberToDelete := &model.BoardMember{
				UserID:  th.GetUser2().ID,
				BoardID: board.ID,
			}

			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 2)

			success, resp := th.Client.DeleteBoardMember(memberToDelete)
			th.CheckOK(resp)
			require.True(t, success)

			members, err = th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 1)
		})

		//nolint:dupl
		t.Run("user removing themselves", func(t *testing.T) {
			th := SetupTestHelper(t).InitBasic()
			defer th.TearDown()

			newBoard := &model.Board{
				Title:  "title",
				Type:   model.BoardTypePrivate,
				TeamID: teamID,
			}
			board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
			require.NoError(t, err)

			newUser2Member := &model.BoardMember{
				UserID:       th.GetUser2().ID,
				BoardID:      board.ID,
				SchemeEditor: true,
			}
			user2Member, err := th.Server.App().AddMemberToBoard(newUser2Member)
			require.NoError(t, err)
			require.NotNil(t, user2Member)
			require.False(t, user2Member.SchemeAdmin)
			require.True(t, user2Member.SchemeEditor)

			memberToDelete := &model.BoardMember{
				UserID:  th.GetUser2().ID,
				BoardID: board.ID,
			}

			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 2)

			// Should fail - must call leave to leave a board
			success, resp := th.Client2.DeleteBoardMember(memberToDelete)
			th.CheckForbidden(resp)
			require.False(t, success)

			members, err = th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 2)
		})

		//nolint:dupl
		t.Run("a non admin user should not be able to remove another user", func(t *testing.T) {
			th := SetupTestHelper(t).InitBasic()
			defer th.TearDown()

			newBoard := &model.Board{
				Title:  "title",
				Type:   model.BoardTypePrivate,
				TeamID: teamID,
			}
			board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
			require.NoError(t, err)

			newUser2Member := &model.BoardMember{
				UserID:       th.GetUser2().ID,
				BoardID:      board.ID,
				SchemeEditor: true,
			}
			user2Member, err := th.Server.App().AddMemberToBoard(newUser2Member)
			require.NoError(t, err)
			require.NotNil(t, user2Member)
			require.False(t, user2Member.SchemeAdmin)
			require.True(t, user2Member.SchemeEditor)

			memberToDelete := &model.BoardMember{
				UserID:  th.GetUser1().ID,
				BoardID: board.ID,
			}

			members, err := th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 2)

			success, resp := th.Client2.DeleteBoardMember(memberToDelete)
			th.CheckForbidden(resp)
			require.False(t, success)

			members, err = th.Server.App().GetMembersForBoard(board.ID)
			require.NoError(t, err)
			require.Len(t, members, 2)
		})
	})

	t.Run("should not delete a member if that means that a board will not have any admin", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		newBoard := &model.Board{
			Title:  "title",
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, err := th.Server.App().CreateBoard(newBoard, th.GetUser1().ID, true)
		require.NoError(t, err)

		memberToDelete := &model.BoardMember{
			UserID:  th.GetUser1().ID,
			BoardID: board.ID,
		}

		success, resp := th.Client.DeleteBoardMember(memberToDelete)
		th.CheckBadRequest(resp)
		require.False(t, success)

		members, err := th.Server.App().GetMembersForBoard(board.ID)
		require.NoError(t, err)
		require.Len(t, members, 1)
		require.True(t, members[0].SchemeAdmin)
	})
}

func TestGetTemplates(t *testing.T) {
	t.Run("should be able to retrieve built-in templates", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		err := th.Server.App().InitTemplates()
		require.NoError(t, err, "InitTemplates should not fail")

		teamID := "my-team-id"
		rBoards, resp := th.Client.GetTemplatesForTeam("0")
		th.CheckOK(resp)
		require.NotNil(t, rBoards)
		require.GreaterOrEqual(t, len(rBoards), 6)

		t.Log("\n\n")
		for _, board := range rBoards {
			t.Logf("Test get template: %s - %s\n", board.Title, board.ID)
			rBoard, resp := th.Client.GetBoard(board.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rBoard)
			require.Equal(t, board, rBoard)

			rBlocks, resp := th.Client.GetAllBlocksForBoard(board.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks)
			require.Greater(t, len(rBlocks), 0)
			t.Logf("Got %d block(s)\n", len(rBlocks))

			rBoardsAndBlock, resp := th.Client.DuplicateBoard(board.ID, false, teamID)
			th.CheckOK(resp)
			require.NotNil(t, rBoardsAndBlock)
			require.Greater(t, len(rBoardsAndBlock.Boards), 0)
			require.Greater(t, len(rBoardsAndBlock.Blocks), 0)

			rBoard2 := rBoardsAndBlock.Boards[0]
			require.Contains(t, board.Title, rBoard2.Title)
			require.False(t, rBoard2.IsTemplate)

			t.Logf("Duplicate template: %s - %s, %d block(s)\n", rBoard2.Title, rBoard2.ID, len(rBoardsAndBlock.Blocks))
			rBoard3, resp := th.Client.GetBoard(rBoard2.ID, "")
			th.CheckOK(resp)
			require.NotNil(t, rBoard3)
			require.Equal(t, rBoard2, rBoard3)

			rBlocks2, resp := th.Client.GetAllBlocksForBoard(rBoard2.ID)
			th.CheckOK(resp)
			require.NotNil(t, rBlocks2)
			require.Equal(t, len(rBoardsAndBlock.Blocks), len(rBlocks2))
		}
		t.Log("\n\n")
	})
}

func TestDuplicateBoard(t *testing.T) {
	t.Run("create and duplicate public board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "Public board"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		newBlocks := []*model.Block{
			{
				ID:       utils.NewID(utils.IDTypeBlock),
				BoardID:  board.ID,
				CreateAt: 1,
				UpdateAt: 1,
				Title:    "View 1",
				Type:     model.TypeView,
			},
		}

		newBlocks, resp = th.Client.InsertBlocks(board.ID, newBlocks, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 1)

		newUserMember := &model.BoardMember{
			UserID:       th.GetUser2().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}
		th.Client.AddMemberToBoard(newUserMember)

		members, err := th.Server.App().GetMembersForBoard(board.ID)
		require.NoError(t, err)
		require.Len(t, members, 2)

		// Duplicate the board
		rBoardsAndBlock, resp := th.Client.DuplicateBoard(board.ID, false, teamID)
		th.CheckOK(resp)
		require.NotNil(t, rBoardsAndBlock)
		require.Equal(t, len(rBoardsAndBlock.Boards), 1)
		require.Equal(t, len(rBoardsAndBlock.Blocks), 1)
		duplicateBoard := rBoardsAndBlock.Boards[0]
		require.Equal(t, duplicateBoard.Type, model.BoardTypePrivate, "Duplicated board should be private")

		members, err = th.Server.App().GetMembersForBoard(duplicateBoard.ID)
		require.NoError(t, err)
		require.Len(t, members, 1, "Duplicated board should only have one member")
		require.Equal(t, me.ID, members[0].UserID)
		require.Equal(t, duplicateBoard.ID, members[0].BoardID)
		require.True(t, members[0].SchemeAdmin)
	})

	t.Run("create and duplicate public board from a custom category", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()
		teamID := testTeamID

		category := model.Category{
			Name:   "My Category",
			UserID: me.ID,
			TeamID: teamID,
		}
		createdCategory, resp := th.Client.CreateCategory(category)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, createdCategory)
		require.Equal(t, "My Category", createdCategory.Name)
		require.Equal(t, me.ID, createdCategory.UserID)
		require.Equal(t, teamID, createdCategory.TeamID)

		title := "Public board"
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		// move board to custom category
		resp = th.Client.UpdateCategoryBoard(teamID, createdCategory.ID, board.ID)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)

		newBlocks := []*model.Block{
			{
				ID:       utils.NewID(utils.IDTypeBlock),
				BoardID:  board.ID,
				CreateAt: 1,
				UpdateAt: 1,
				Title:    "View 1",
				Type:     model.TypeView,
			},
		}

		newBlocks, resp = th.Client.InsertBlocks(board.ID, newBlocks, false)
		require.NoError(t, resp.Error)
		require.Len(t, newBlocks, 1)

		newUserMember := &model.BoardMember{
			UserID:       th.GetUser2().ID,
			BoardID:      board.ID,
			SchemeEditor: true,
		}
		th.Client.AddMemberToBoard(newUserMember)

		members, err := th.Server.App().GetMembersForBoard(board.ID)
		require.NoError(t, err)
		require.Len(t, members, 2)

		// Duplicate the board
		rBoardsAndBlock, resp := th.Client.DuplicateBoard(board.ID, false, teamID)
		th.CheckOK(resp)
		require.NotNil(t, rBoardsAndBlock)
		require.Equal(t, len(rBoardsAndBlock.Boards), 1)
		require.Equal(t, len(rBoardsAndBlock.Blocks), 1)

		duplicateBoard := rBoardsAndBlock.Boards[0]
		require.Equal(t, duplicateBoard.Type, model.BoardTypePrivate, "Duplicated board should be private")
		require.Equal(t, "Public board copy", duplicateBoard.Title)

		members, err = th.Server.App().GetMembersForBoard(duplicateBoard.ID)
		require.NoError(t, err)
		require.Len(t, members, 1, "Duplicated board should only have one member")
		require.Equal(t, me.ID, members[0].UserID)
		require.Equal(t, duplicateBoard.ID, members[0].BoardID)
		require.True(t, members[0].SchemeAdmin)

		// verify duplicated board is in the same custom category
		userCategoryBoards, resp := th.Client.GetUserCategoryBoards(teamID)
		th.CheckOK(resp)
		require.NotNil(t, rBoardsAndBlock)

		var duplicateBoardCategoryID string
		for _, categoryBoard := range userCategoryBoards {
			for _, boardMetadata := range categoryBoard.BoardMetadata {
				if boardMetadata.BoardID == duplicateBoard.ID {
					duplicateBoardCategoryID = categoryBoard.Category.ID
				}
			}
		}
		require.Equal(t, createdCategory.ID, duplicateBoardCategoryID)
	})
}

func TestJoinBoard(t *testing.T) {
	t.Run("create and join public board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "Test Public board"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)
		require.Equal(t, model.BoardRoleNone, board.MinimumRole)

		member, resp := th.Client2.JoinBoard(board.ID)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, member)
		require.Equal(t, board.ID, member.BoardID)
		require.Equal(t, th.GetUser2().ID, member.UserID)

		s, _ := json.MarshalIndent(member, "", "\t")
		t.Log(string(s))
	})

	t.Run("create and join public board should match the minimumRole in the membership", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "Public board for commenters"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:       title,
			Type:        model.BoardTypeOpen,
			TeamID:      teamID,
			MinimumRole: model.BoardRoleCommenter,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		member, resp := th.Client2.JoinBoard(board.ID)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, member)
		require.Equal(t, board.ID, member.BoardID)
		require.Equal(t, th.GetUser2().ID, member.UserID)
		require.False(t, member.SchemeAdmin, "new member should not be admin")
		require.False(t, member.SchemeEditor, "new member should not be editor")
		require.True(t, member.SchemeCommenter, "new member should be commenter")
		require.False(t, member.SchemeViewer, "new member should not be viewer")

		s, _ := json.MarshalIndent(member, "", "\t")
		t.Log(string(s))
	})

	t.Run("create and join public board should match editor role in the membership when MinimumRole is empty", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "Public board for editors"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypeOpen,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypeOpen, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		member, resp := th.Client2.JoinBoard(board.ID)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, member)
		require.Equal(t, board.ID, member.BoardID)
		require.Equal(t, th.GetUser2().ID, member.UserID)
		require.False(t, member.SchemeAdmin, "new member should not be admin")
		require.True(t, member.SchemeEditor, "new member should be editor")
		require.False(t, member.SchemeCommenter, "new member should not be commenter")
		require.False(t, member.SchemeViewer, "new member should not be viewer")

		s, _ := json.MarshalIndent(member, "", "\t")
		t.Log(string(s))
	})

	t.Run("create and join private board (should not succeed)", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		me := th.GetUser1()

		title := "Private board"
		teamID := testTeamID
		newBoard := &model.Board{
			Title:  title,
			Type:   model.BoardTypePrivate,
			TeamID: teamID,
		}
		board, resp := th.Client.CreateBoard(newBoard)
		th.CheckOK(resp)
		require.NoError(t, resp.Error)
		require.NotNil(t, board)
		require.NotNil(t, board.ID)
		require.Equal(t, title, board.Title)
		require.Equal(t, model.BoardTypePrivate, board.Type)
		require.Equal(t, teamID, board.TeamID)
		require.Equal(t, me.ID, board.CreatedBy)
		require.Equal(t, me.ID, board.ModifiedBy)

		member, resp := th.Client2.JoinBoard(board.ID)
		th.CheckForbidden(resp)
		require.Nil(t, member)
	})

	t.Run("join invalid board", func(t *testing.T) {
		th := SetupTestHelper(t).InitBasic()
		defer th.TearDown()

		member, resp := th.Client2.JoinBoard("nonexistent-board-ID")
		th.CheckNotFound(resp)
		require.Nil(t, member)
	})
}
