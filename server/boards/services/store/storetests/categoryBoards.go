// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

func StoreTestCategoryBoardsStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("GetUserCategoryBoards", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetUserCategoryBoards(t, store)
	})

	t.Run("AddUpdateCategoryBoard", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testAddUpdateCategoryBoard(t, store)
	})

	t.Run("SetBoardVisibility", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testSetBoardVisibility(t, store)
	})
}

func testGetUserCategoryBoards(t *testing.T, store store.Store) {
	now := utils.GetMillis()
	category1 := model.Category{
		ID:        "category_id_1",
		Name:      "Category 1",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  now,
		DeleteAt:  0,
		Collapsed: false,
	}
	err := store.CreateCategory(category1)
	assert.NoError(t, err)

	category2 := model.Category{
		ID:        "category_id_2",
		Name:      "Category 2",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  now,
		DeleteAt:  0,
		Collapsed: false,
	}
	err = store.CreateCategory(category2)
	assert.NoError(t, err)

	category3 := model.Category{
		ID:        "category_id_3",
		Name:      "Category 3",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  now,
		DeleteAt:  0,
		Collapsed: false,
	}
	err = store.CreateCategory(category3)
	assert.NoError(t, err)

	// Adding Board 1 and Board 2 to Category 1
	// The boards don't need to exists in DB for this test
	err = store.AddUpdateCategoryBoard("user_id_1", "category_id_1", []string{"board_1"})
	assert.NoError(t, err)

	err = store.AddUpdateCategoryBoard("user_id_1", "category_id_1", []string{"board_2"})
	assert.NoError(t, err)

	// Adding Board 3 to Category 2
	err = store.AddUpdateCategoryBoard("user_id_1", "category_id_2", []string{"board_3"})
	assert.NoError(t, err)

	// we'll leave category 3 empty

	userCategoryBoards, err := store.GetUserCategoryBoards("user_id_1", "team_id_1")
	assert.NoError(t, err)

	// we created 3 categories for the user
	assert.Equal(t, 3, len(userCategoryBoards))

	var category1BoardCategory model.CategoryBoards
	var category2BoardCategory model.CategoryBoards
	var category3BoardCategory model.CategoryBoards

	for i := range userCategoryBoards {
		switch userCategoryBoards[i].ID {
		case "category_id_1":
			category1BoardCategory = userCategoryBoards[i]
		case "category_id_2":
			category2BoardCategory = userCategoryBoards[i]
		case "category_id_3":
			category3BoardCategory = userCategoryBoards[i]
		}
	}

	assert.NotEmpty(t, category1BoardCategory)
	assert.Equal(t, 2, len(category1BoardCategory.BoardMetadata))

	assert.NotEmpty(t, category1BoardCategory)
	assert.Equal(t, 1, len(category2BoardCategory.BoardMetadata))

	assert.NotEmpty(t, category1BoardCategory)
	assert.Equal(t, 0, len(category3BoardCategory.BoardMetadata))

	t.Run("get empty category boards", func(t *testing.T) {
		userCategoryBoards, err := store.GetUserCategoryBoards("nonexistent-user-id", "nonexistent-team-id")
		assert.NoError(t, err)
		assert.Empty(t, userCategoryBoards)
	})
}

func testAddUpdateCategoryBoard(t *testing.T, store store.Store) {
	// creating few boards and categories to later associoate with the category
	_, _, err := store.CreateBoardsAndBlocksWithAdmin(&model.BoardsAndBlocks{
		Boards: []*model.Board{
			{
				ID:     "board_id_1",
				TeamID: "team_id",
			},
			{
				ID:     "board_id_2",
				TeamID: "team_id",
			},
		},
	}, "user_id")
	assert.NoError(t, err)

	err = store.CreateCategory(model.Category{
		ID:     "category_id",
		Name:   "Category",
		UserID: "user_id",
		TeamID: "team_id",
	})
	assert.NoError(t, err)

	// adding a few boards to the category
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{"board_id_1", "board_id_2"})
	assert.NoError(t, err)

	// verify inserted data
	categoryBoards, err := store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 2, len(categoryBoards[0].BoardMetadata))
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_1", Hidden: false})
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_2", Hidden: false})

	// adding new boards to the same category
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{"board_id_3"})
	assert.NoError(t, err)

	// verify inserted data
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 3, len(categoryBoards[0].BoardMetadata))
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_3", Hidden: false})

	// passing empty array
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{})
	assert.NoError(t, err)

	// verify inserted data
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 3, len(categoryBoards[0].BoardMetadata))

	// passing duplicate data in input
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{"board_id_4", "board_id_4"})
	assert.NoError(t, err)

	// verify inserted data
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 4, len(categoryBoards[0].BoardMetadata))
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_4", Hidden: false})

	// adding already added board
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{"board_id_1", "board_id_2"})
	assert.NoError(t, err)

	// verify inserted data
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 4, len(categoryBoards[0].BoardMetadata))

	// passing already added board along with a new board
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{"board_id_1", "board_id_5"})
	assert.NoError(t, err)

	// verify inserted data
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 5, len(categoryBoards[0].BoardMetadata))
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_5", Hidden: false})
}

func testSetBoardVisibility(t *testing.T, store store.Store) {
	_, _, err := store.CreateBoardsAndBlocksWithAdmin(&model.BoardsAndBlocks{
		Boards: []*model.Board{
			{
				ID:     "board_id_1",
				TeamID: "team_id",
			},
		},
	}, "user_id")
	assert.NoError(t, err)

	err = store.CreateCategory(model.Category{
		ID:     "category_id",
		Name:   "Category",
		UserID: "user_id",
		TeamID: "team_id",
	})
	assert.NoError(t, err)

	// adding a few boards to the category
	err = store.AddUpdateCategoryBoard("user_id", "category_id", []string{"board_id_1"})
	assert.NoError(t, err)

	err = store.SetBoardVisibility("user_id", "category_id", "board_id_1", true)
	assert.NoError(t, err)

	// verify set visibility
	categoryBoards, err := store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, "category_id", categoryBoards[0].ID)
	assert.Equal(t, 1, len(categoryBoards[0].BoardMetadata))
	assert.False(t, categoryBoards[0].BoardMetadata[0].Hidden)

	err = store.SetBoardVisibility("user_id", "category_id", "board_id_1", false)
	assert.NoError(t, err)

	// verify set visibility
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.True(t, categoryBoards[0].BoardMetadata[0].Hidden)
}
