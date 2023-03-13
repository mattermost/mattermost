// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/boards/utils"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
)

func TestAddMemberToBoard(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_1"

		boardMember := &model.BoardMember{
			BoardID:      boardID,
			UserID:       userID,
			SchemeEditor: true,
		}

		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:     "board_id_1",
			TeamID: "team_id_1",
		}, nil)

		th.Store.EXPECT().GetMemberForBoard(boardID, userID).Return(nil, nil)

		th.Store.EXPECT().SaveMember(mock.MatchedBy(func(i interface{}) bool {
			p := i.(*model.BoardMember)
			return p.BoardID == boardID && p.UserID == userID
		})).Return(&model.BoardMember{
			BoardID: boardID,
		}, nil)

		// for WS change broadcast
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil)

		th.Store.EXPECT().GetUserCategoryBoards("user_id_1", "team_id_1").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					ID:   "default_category_id",
					Name: "Boards",
					Type: "system",
				},
			},
		}, nil).Times(2)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id_1", "default_category_id", []string{"board_id_1"}).Return(nil)

		addedBoardMember, err := th.App.AddMemberToBoard(boardMember)
		require.NoError(t, err)
		require.Equal(t, boardID, addedBoardMember.BoardID)
	})

	t.Run("return existing non-synthetic membership if any", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_1"

		boardMember := &model.BoardMember{
			BoardID:      boardID,
			UserID:       userID,
			SchemeEditor: true,
		}

		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			TeamID: "team_id_1",
		}, nil)

		th.Store.EXPECT().GetMemberForBoard(boardID, userID).Return(&model.BoardMember{
			UserID:    userID,
			BoardID:   boardID,
			Synthetic: false,
		}, nil)

		addedBoardMember, err := th.App.AddMemberToBoard(boardMember)
		require.NoError(t, err)
		require.Equal(t, boardID, addedBoardMember.BoardID)
	})

	t.Run("should convert synthetic membership into natural membership", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_1"

		boardMember := &model.BoardMember{
			BoardID:      boardID,
			UserID:       userID,
			SchemeEditor: true,
		}

		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:     "board_id_1",
			TeamID: "team_id_1",
		}, nil)

		th.Store.EXPECT().GetMemberForBoard(boardID, userID).Return(&model.BoardMember{
			UserID:    userID,
			BoardID:   boardID,
			Synthetic: true,
		}, nil)

		th.Store.EXPECT().SaveMember(mock.MatchedBy(func(i interface{}) bool {
			p := i.(*model.BoardMember)
			return p.BoardID == boardID && p.UserID == userID
		})).Return(&model.BoardMember{
			UserID:    userID,
			BoardID:   boardID,
			Synthetic: false,
		}, nil)

		// for WS change broadcast
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil)

		th.Store.EXPECT().GetUserCategoryBoards("user_id_1", "team_id_1").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					ID:   "default_category_id",
					Name: "Boards",
					Type: "system",
				},
			},
		}, nil).Times(2)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id_1", "default_category_id", []string{"board_id_1"}).Return(nil)
		th.API.EXPECT().HasPermissionToTeam("user_id_1", "team_id_1", model.PermissionManageTeam).Return(false).Times(1)

		addedBoardMember, err := th.App.AddMemberToBoard(boardMember)
		require.NoError(t, err)
		require.Equal(t, boardID, addedBoardMember.BoardID)
	})
}

func TestPatchBoard(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case, title patch", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_1"
		const teamID = "team_id_1"

		patchTitle := "Patched Title"
		patch := &model.BoardPatch{
			Title: &patchTitle,
		}

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
				Title:  patchTitle,
			},
			nil)

		// for WS BroadcastBoardChange
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil).Times(1)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, patchTitle, patchedBoard.Title)
	})

	t.Run("patch type open, no users", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		patchType := model.BoardTypeOpen
		patch := &model.BoardPatch{
			Type: &patchType,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
		}, nil).Times(2)

		// Type not null will retrieve team members
		th.Store.EXPECT().GetUsersByTeam(teamID, "", false, false).Return([]*model.User{}, nil)
		th.Store.EXPECT().GetUserByID(userID).Return(&model.User{ID: userID, Username: "UserName"}, nil)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 2 times
		// - for WS BroadcastBoardChange
		// - for AddTeamMembers check
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil).Times(2)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})

	t.Run("patch type private, no users", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		patchType := model.BoardTypePrivate
		patch := &model.BoardPatch{
			Type: &patchType,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
		}, nil).Times(2)

		// Type not null will retrieve team members
		th.Store.EXPECT().GetUsersByTeam(teamID, "", false, false).Return([]*model.User{}, nil)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 2 times
		// - for WS BroadcastBoardChange
		// - for AddTeamMembers check
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil).Times(2)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})

	t.Run("patch type open, single user", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		patchType := model.BoardTypeOpen
		patch := &model.BoardPatch{
			Type: &patchType,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
		}, nil).Times(2)
		// Type not null will retrieve team members
		th.Store.EXPECT().GetUsersByTeam(teamID, "", false, false).Return([]*model.User{{ID: userID}}, nil)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 3 times
		// for WS BroadcastBoardChange
		// for AddTeamMembers check
		// for WS BroadcastMemberChange
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil).Times(3)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})

	t.Run("patch type private, single user", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		patchType := model.BoardTypePrivate
		patch := &model.BoardPatch{
			Type: &patchType,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
		}, nil).Times(2)
		// Type not null will retrieve team members
		th.Store.EXPECT().GetUsersByTeam(teamID, "", false, false).Return([]*model.User{{ID: userID}}, nil)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 3 times
		// for WS BroadcastBoardChange
		// for AddTeamMembers check
		// for WS BroadcastMemberChange
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil).Times(3)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})

	t.Run("patch type open, user with member", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		patchType := model.BoardTypeOpen
		patch := &model.BoardPatch{
			Type: &patchType,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
		}, nil).Times(3)

		th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(false).Times(1)

		// Type not null will retrieve team members
		th.Store.EXPECT().GetUsersByTeam(teamID, "", false, false).Return([]*model.User{{ID: userID}}, nil)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 2 times
		// for WS BroadcastBoardChange
		// for AddTeamMembers check
		// We are returning the user as a direct Board Member, so BroadcastMemberDelete won't be called
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{{BoardID: boardID, UserID: userID, SchemeEditor: true}}, nil).Times(2)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})

	t.Run("patch type private, user with member", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		patchType := model.BoardTypePrivate
		patch := &model.BoardPatch{
			Type: &patchType,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
			ChannelID:  "",
		}, nil).Times(1)

		th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(false).Times(1)

		// Type not null will retrieve team members
		th.Store.EXPECT().GetUsersByTeam(teamID, "", false, false).Return([]*model.User{{ID: userID}}, nil)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 2 times
		// for WS BroadcastBoardChange
		// for AddTeamMembers check
		// We are returning the user as a direct Board Member, so BroadcastMemberDelete won't be called
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{{BoardID: boardID, UserID: userID, SchemeEditor: true}}, nil).Times(2)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})
	t.Run("patch type channel, user without post permissions", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		channelID := "myChannel"
		patchType := model.BoardTypeOpen
		patch := &model.BoardPatch{
			Type:      &patchType,
			ChannelID: &channelID,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
		}, nil).Times(1)

		th.API.EXPECT().HasPermissionToChannel(userID, channelID, model.PermissionCreatePost).Return(false).Times(1)
		_, err := th.App.PatchBoard(patch, boardID, userID)
		require.Error(t, err)
	})

	t.Run("patch type channel, user with post permissions", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		channelID := "myChannel"
		patch := &model.BoardPatch{
			ChannelID: &channelID,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:     boardID,
			TeamID: teamID,
		}, nil).Times(2)

		th.API.EXPECT().HasPermissionToChannel(userID, channelID, model.PermissionCreatePost).Return(true).Times(1)

		th.Store.EXPECT().PatchBoard(boardID, patch, userID).Return(
			&model.Board{
				ID:     boardID,
				TeamID: teamID,
			},
			nil)

		// Should call GetMembersForBoard 2 times
		// - for WS BroadcastBoardChange
		// - for AddTeamMembers check
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{}, nil).Times(2)

		th.Store.EXPECT().PostMessage(utils.Anything, "", "").Times(1)

		patchedBoard, err := th.App.PatchBoard(patch, boardID, userID)
		require.NoError(t, err)
		require.Equal(t, boardID, patchedBoard.ID)
	})

	t.Run("patch type remove channel, user without post permissions", func(t *testing.T) {
		const boardID = "board_id_1"
		const userID = "user_id_2"
		const teamID = "team_id_1"

		const channelID = "myChannel"
		clearChannel := ""
		patchType := model.BoardTypeOpen
		patch := &model.BoardPatch{
			Type:      &patchType,
			ChannelID: &clearChannel,
		}

		// Type not nil, will cause board to be reteived
		// to check isTemplate
		th.Store.EXPECT().GetBoard(boardID).Return(&model.Board{
			ID:         boardID,
			TeamID:     teamID,
			IsTemplate: true,
			ChannelID:  channelID,
		}, nil).Times(2)

		th.API.EXPECT().HasPermissionToChannel(userID, channelID, model.PermissionCreatePost).Return(false).Times(1)

		th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(false).Times(1)
		// Should call GetMembersForBoard 2 times
		// for WS BroadcastBoardChange
		// for AddTeamMembers check
		// We are returning the user as a direct Board Member, so BroadcastMemberDelete won't be called
		th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{{BoardID: boardID, UserID: userID, SchemeEditor: true}}, nil).Times(1)

		_, err := th.App.PatchBoard(patch, boardID, userID)
		require.Error(t, err)
	})
}

func TestGetBoardCount(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		boardCount := int64(100)
		th.Store.EXPECT().GetBoardCount().Return(boardCount, nil)

		count, err := th.App.GetBoardCount()
		require.NoError(t, err)
		require.Equal(t, boardCount, count)
	})
}

func TestBoardCategory(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("no boards default category exists", func(t *testing.T) {
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{ID: "category_id_1", Name: "Category 1"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_1"},
					{BoardID: "board_id_2"},
				},
			},
			{
				Category: model.Category{ID: "category_id_2", Name: "Category 2"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_3"},
				},
			},
			{
				Category:      model.Category{ID: "category_id_3", Name: "Category 3"},
				BoardMetadata: []model.CategoryBoardMetadata{},
			},
		}, nil).Times(1)

		// when this function is called the second time, the default category is created
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{ID: "category_id_1", Name: "Category 1"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_1"},
					{BoardID: "board_id_2"},
				},
			},
			{
				Category: model.Category{ID: "category_id_2", Name: "Category 2"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_3"},
				},
			},
			{
				Category:      model.Category{ID: "category_id_3", Name: "Category 3"},
				BoardMetadata: []model.CategoryBoardMetadata{},
			},
			{
				Category: model.Category{ID: "default_category_id", Type: model.CategoryTypeSystem, Name: "Boards"},
			},
		}, nil).Times(1)

		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "default_category_id",
			Name: "Boards",
		}, nil)
		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{}, nil)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id", "default_category_id", []string{
			"board_id_1",
			"board_id_2",
			"board_id_3",
		}).Return(nil)

		boards := []*model.Board{
			{ID: "board_id_1"},
			{ID: "board_id_2"},
			{ID: "board_id_3"},
		}

		err := th.App.addBoardsToDefaultCategory("user_id", "team_id", boards)
		assert.NoError(t, err)
	})
}

func TestDuplicateBoard(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		board := &model.Board{
			ID:    "board_id_2",
			Title: "Duplicated Board",
		}

		block := &model.Block{
			ID:   "block_id_1",
			Type: "image",
		}

		th.Store.EXPECT().DuplicateBoard("board_id_1", "user_id_1", "team_id_1", false).Return(
			&model.BoardsAndBlocks{
				Boards: []*model.Board{
					board,
				},
				Blocks: []*model.Block{
					block,
				},
			},
			[]*model.BoardMember{},
			nil,
		)

		th.Store.EXPECT().GetBoard("board_id_1").Return(&model.Board{}, nil)

		th.Store.EXPECT().GetUserCategoryBoards("user_id_1", "team_id_1").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					ID:   "category_id_1",
					Name: "Boards",
					Type: "system",
				},
			},
		}, nil).Times(3)

		th.Store.EXPECT().AddUpdateCategoryBoard("user_id_1", "category_id_1", utils.Anything).Return(nil)

		// for WS change broadcast
		th.Store.EXPECT().GetMembersForBoard(utils.Anything).Return([]*model.BoardMember{}, nil).Times(2)

		bab, members, err := th.App.DuplicateBoard("board_id_1", "user_id_1", "team_id_1", false)
		assert.NoError(t, err)
		assert.NotNil(t, bab)
		assert.NotNil(t, members)
	})

	t.Run("duplicating board as template should not set it's category", func(t *testing.T) {
		board := &model.Board{
			ID:    "board_id_2",
			Title: "Duplicated Board",
		}

		block := &model.Block{
			ID:   "block_id_1",
			Type: "image",
		}

		th.Store.EXPECT().DuplicateBoard("board_id_1", "user_id_1", "team_id_1", true).Return(
			&model.BoardsAndBlocks{
				Boards: []*model.Board{
					board,
				},
				Blocks: []*model.Block{
					block,
				},
			},
			[]*model.BoardMember{},
			nil,
		)

		th.Store.EXPECT().GetBoard("board_id_1").Return(&model.Board{}, nil)

		// for WS change broadcast
		th.Store.EXPECT().GetMembersForBoard(utils.Anything).Return([]*model.BoardMember{}, nil).Times(2)

		bab, members, err := th.App.DuplicateBoard("board_id_1", "user_id_1", "team_id_1", true)
		assert.NoError(t, err)
		assert.NotNil(t, bab)
		assert.NotNil(t, members)
	})
}

func TestGetMembersForBoard(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	const boardID = "board_id_1"
	const userID = "user_id_1"
	const teamID = "team_id_1"

	th.Store.EXPECT().GetMembersForBoard(boardID).Return([]*model.BoardMember{
		{
			BoardID:      boardID,
			UserID:       userID,
			SchemeEditor: true,
		},
	}, nil).Times(3)
	th.Store.EXPECT().GetBoard(boardID).Return(nil, nil).Times(1)
	t.Run("-base case", func(t *testing.T) {
		members, err := th.App.GetMembersForBoard(boardID)
		assert.NoError(t, err)
		assert.NotNil(t, members)
		assert.False(t, members[0].SchemeAdmin)
	})

	board := &model.Board{
		ID:     boardID,
		TeamID: teamID,
	}
	th.Store.EXPECT().GetBoard(boardID).Return(board, nil).Times(2)
	th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(false).Times(1)

	t.Run("-team check false ", func(t *testing.T) {
		members, err := th.App.GetMembersForBoard(boardID)
		assert.NoError(t, err)
		assert.NotNil(t, members)

		assert.False(t, members[0].SchemeAdmin)
	})

	th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(true).Times(1)
	t.Run("-team check true", func(t *testing.T) {
		members, err := th.App.GetMembersForBoard(boardID)
		assert.NoError(t, err)
		assert.NotNil(t, members)

		assert.True(t, members[0].SchemeAdmin)
	})
}

func TestGetMembersForUser(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	const boardID = "board_id_1"
	const userID = "user_id_1"
	const teamID = "team_id_1"

	th.Store.EXPECT().GetMembersForUser(userID).Return([]*model.BoardMember{
		{
			BoardID:      boardID,
			UserID:       userID,
			SchemeEditor: true,
		},
	}, nil).Times(3)
	th.Store.EXPECT().GetBoard(boardID).Return(nil, nil)
	t.Run("-base case", func(t *testing.T) {
		members, err := th.App.GetMembersForUser(userID)
		assert.NoError(t, err)
		assert.NotNil(t, members)
		assert.False(t, members[0].SchemeAdmin)
	})

	board := &model.Board{
		ID:     boardID,
		TeamID: teamID,
	}
	th.Store.EXPECT().GetBoard(boardID).Return(board, nil).Times(2)

	th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(false).Times(1)
	t.Run("-team check false ", func(t *testing.T) {
		members, err := th.App.GetMembersForUser(userID)
		assert.NoError(t, err)
		assert.NotNil(t, members)

		assert.False(t, members[0].SchemeAdmin)
	})

	th.API.EXPECT().HasPermissionToTeam(userID, teamID, model.PermissionManageTeam).Return(true).Times(1)
	t.Run("-team check true", func(t *testing.T) {
		members, err := th.App.GetMembersForUser(userID)
		assert.NoError(t, err)
		assert.NotNil(t, members)

		assert.True(t, members[0].SchemeAdmin)
	})
}
