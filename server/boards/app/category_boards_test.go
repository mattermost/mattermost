// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

func TestGetUserCategoryBoards(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("user had no default category and had boards", func(t *testing.T) {
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{}, nil).Times(1)
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					ID:   "boards_category_id",
					Type: model.CategoryTypeSystem,
					Name: "Boards",
				},
			},
		}, nil).Times(1)
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Name: "Boards",
		}, nil)

		board1 := &model.Board{
			ID: "board_id_1",
		}

		board2 := &model.Board{
			ID: "board_id_2",
		}

		board3 := &model.Board{
			ID: "board_id_3",
		}

		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{board1, board2, board3}, nil)

		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{
			{
				BoardID:   "board_id_1",
				Synthetic: false,
			},
			{
				BoardID:   "board_id_2",
				Synthetic: false,
			},
			{
				BoardID:   "board_id_3",
				Synthetic: false,
			},
		}, nil)
		th.Store.EXPECT().GetBoard(utils.Anything).Return(nil, nil).Times(3)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id", "boards_category_id", []string{"board_id_1", "board_id_2", "board_id_3"}).Return(nil)

		categoryBoards, err := th.App.GetUserCategoryBoards("user_id", "team_id")
		assert.NoError(t, err)
		assert.Equal(t, 1, len(categoryBoards))
		assert.Equal(t, "Boards", categoryBoards[0].Name)
		assert.Equal(t, 3, len(categoryBoards[0].BoardMetadata))
		assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_1", Hidden: false})
		assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_2", Hidden: false})
		assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_3", Hidden: false})
	})

	t.Run("user had no default category BUT had no boards", func(t *testing.T) {
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{}, nil)
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Name: "Boards",
		}, nil)

		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{}, nil)

		categoryBoards, err := th.App.GetUserCategoryBoards("user_id", "team_id")
		assert.NoError(t, err)
		assert.Equal(t, 1, len(categoryBoards))
		assert.Equal(t, "Boards", categoryBoards[0].Name)
		assert.Equal(t, 0, len(categoryBoards[0].BoardMetadata))
	})

	t.Run("user already had a default Boards category with boards in it", func(t *testing.T) {
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{Name: "Boards"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_1", Hidden: false},
					{BoardID: "board_id_2", Hidden: false},
				},
			},
		}, nil)

		categoryBoards, err := th.App.GetUserCategoryBoards("user_id", "team_id")
		assert.NoError(t, err)
		assert.Equal(t, 1, len(categoryBoards))
		assert.Equal(t, "Boards", categoryBoards[0].Name)
		assert.Equal(t, 2, len(categoryBoards[0].BoardMetadata))
	})
}

func TestCreateBoardsCategory(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("user doesn't have any boards - implicit or explicit", func(t *testing.T) {
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Type: "system",
			Name: "Boards",
		}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{}, nil)
		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{}, nil)

		existingCategoryBoards := []model.CategoryBoards{}
		boardsCategory, err := th.App.createBoardsCategory("user_id", "team_id", existingCategoryBoards)
		assert.NoError(t, err)
		assert.NotNil(t, boardsCategory)
		assert.Equal(t, "Boards", boardsCategory.Name)
		assert.Equal(t, 0, len(boardsCategory.BoardMetadata))
	})

	t.Run("user has implicit access to some board", func(t *testing.T) {
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Type: "system",
			Name: "Boards",
		}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{}, nil)
		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{
			{
				BoardID:   "board_id_1",
				Synthetic: true,
			},
			{
				BoardID:   "board_id_2",
				Synthetic: true,
			},
			{
				BoardID:   "board_id_3",
				Synthetic: true,
			},
		}, nil)
		th.Store.EXPECT().GetBoard(utils.Anything).Return(nil, nil).Times(3)

		existingCategoryBoards := []model.CategoryBoards{}
		boardsCategory, err := th.App.createBoardsCategory("user_id", "team_id", existingCategoryBoards)
		assert.NoError(t, err)
		assert.NotNil(t, boardsCategory)
		assert.Equal(t, "Boards", boardsCategory.Name)

		// there should still be no boards in the default category as
		// the user had only implicit access to boards
		assert.Equal(t, 0, len(boardsCategory.BoardMetadata))
	})

	t.Run("user has explicit access to some board", func(t *testing.T) {
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Type: "system",
			Name: "Boards",
		}, nil)

		board1 := &model.Board{
			ID: "board_id_1",
		}
		board2 := &model.Board{
			ID: "board_id_2",
		}
		board3 := &model.Board{
			ID: "board_id_3",
		}
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{board1, board2, board3}, nil)
		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{
			{
				BoardID:   "board_id_1",
				Synthetic: false,
			},
			{
				BoardID:   "board_id_2",
				Synthetic: false,
			},
			{
				BoardID:   "board_id_3",
				Synthetic: false,
			},
		}, nil)
		th.Store.EXPECT().GetBoard(utils.Anything).Return(nil, nil).Times(3)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id", "boards_category_id", []string{"board_id_1", "board_id_2", "board_id_3"}).Return(nil)

		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					Type: model.CategoryTypeSystem,
					ID:   "boards_category_id",
					Name: "Boards",
				},
			},
		}, nil)

		existingCategoryBoards := []model.CategoryBoards{}
		boardsCategory, err := th.App.createBoardsCategory("user_id", "team_id", existingCategoryBoards)
		assert.NoError(t, err)
		assert.NotNil(t, boardsCategory)
		assert.Equal(t, "Boards", boardsCategory.Name)

		// since user has explicit access to three boards,
		// they should all end up in the default category
		assert.Equal(t, 3, len(boardsCategory.BoardMetadata))
	})

	t.Run("user has both implicit and explicit access to some board", func(t *testing.T) {
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Type: "system",
			Name: "Boards",
		}, nil)

		board1 := &model.Board{
			ID: "board_id_1",
		}
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id", "team_id", false).Return([]*model.Board{board1}, nil)
		th.Store.EXPECT().GetMembersForUser("user_id").Return([]*model.BoardMember{
			{
				BoardID:   "board_id_1",
				Synthetic: false,
			},
			{
				BoardID:   "board_id_2",
				Synthetic: true,
			},
			{
				BoardID:   "board_id_3",
				Synthetic: true,
			},
		}, nil)
		th.Store.EXPECT().GetBoard(utils.Anything).Return(nil, nil).Times(3)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id", "boards_category_id", []string{"board_id_1"}).Return(nil)

		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					Type: model.CategoryTypeSystem,
					ID:   "boards_category_id",
					Name: "Boards",
				},
			},
		}, nil)

		existingCategoryBoards := []model.CategoryBoards{}
		boardsCategory, err := th.App.createBoardsCategory("user_id", "team_id", existingCategoryBoards)
		assert.NoError(t, err)
		assert.NotNil(t, boardsCategory)
		assert.Equal(t, "Boards", boardsCategory.Name)

		// there was only one explicit board access,
		// and so only that one should end up in the
		// default category
		assert.Equal(t, 1, len(boardsCategory.BoardMetadata))
	})
}

func TestReorderCategoryBoards(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{ID: "category_id_1", Name: "Category 1"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_1", Hidden: false},
					{BoardID: "board_id_2", Hidden: false},
				},
			},
			{
				Category: model.Category{ID: "category_id_2", Name: "Boards", Type: "system"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_3", Hidden: false},
				},
			},
			{
				Category:      model.Category{ID: "category_id_3", Name: "Category 3"},
				BoardMetadata: []model.CategoryBoardMetadata{},
			},
		}, nil)

		th.Store.EXPECT().ReorderCategoryBoards("category_id_1", []string{"board_id_2", "board_id_1"}).Return([]string{"board_id_2", "board_id_1"}, nil)

		newOrder, err := th.App.ReorderCategoryBoards("user_id", "team_id", "category_id_1", []string{"board_id_2", "board_id_1"})
		assert.NoError(t, err)
		assert.Equal(t, 2, len(newOrder))
		assert.Equal(t, "board_id_2", newOrder[0])
		assert.Equal(t, "board_id_1", newOrder[1])
	})

	t.Run("not specifying all boards", func(t *testing.T) {
		th.Store.EXPECT().GetUserCategoryBoards("user_id", "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{ID: "category_id_1", Name: "Category 1"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_1", Hidden: false},
					{BoardID: "board_id_2", Hidden: false},
					{BoardID: "board_id_3", Hidden: false},
				},
			},
			{
				Category: model.Category{ID: "category_id_2", Name: "Boards", Type: "system"},
				BoardMetadata: []model.CategoryBoardMetadata{
					{BoardID: "board_id_3", Hidden: false},
				},
			},
			{
				Category:      model.Category{ID: "category_id_3", Name: "Category 3"},
				BoardMetadata: []model.CategoryBoardMetadata{},
			},
		}, nil)

		newOrder, err := th.App.ReorderCategoryBoards("user_id", "team_id", "category_id_1", []string{"board_id_2", "board_id_1"})
		assert.Error(t, err)
		assert.Nil(t, newOrder)
	})
}
