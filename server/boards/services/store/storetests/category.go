package storetests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

type testFunc func(t *testing.T, store store.Store)

func StoreTestCategoryStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	tests := map[string]testFunc{
		"CreateCategory":          testGetCreateCategory,
		"UpdateCategory":          testUpdateCategory,
		"DeleteCategory":          testDeleteCategory,
		"GetUserCategories":       testGetUserCategories,
		"ReorderCategories":       testReorderCategories,
		"ReorderCategoriesBoards": testReorderCategoryBoards,
	}

	for name, f := range tests {
		t.Run(name, func(t *testing.T) {
			store, tearDown := setup(t)
			defer tearDown()
			f(t, store)
		})
	}
}

func testGetCreateCategory(t *testing.T, store store.Store) {
	t.Run("save uncollapsed category", func(t *testing.T) {
		now := utils.GetMillis()
		category := model.Category{
			ID:        "category_id_1",
			Name:      "Category",
			UserID:    "user_id_1",
			TeamID:    "team_id_1",
			CreateAt:  now,
			UpdateAt:  now,
			DeleteAt:  0,
			Collapsed: false,
		}

		err := store.CreateCategory(category)
		assert.NoError(t, err)

		createdCategory, err := store.GetCategory("category_id_1")
		assert.NoError(t, err)
		assert.Equal(t, "Category", createdCategory.Name)
		assert.Equal(t, "user_id_1", createdCategory.UserID)
		assert.Equal(t, "team_id_1", createdCategory.TeamID)
		assert.Equal(t, false, createdCategory.Collapsed)
	})

	t.Run("save collapsed category", func(t *testing.T) {
		now := utils.GetMillis()
		category := model.Category{
			ID:        "category_id_2",
			Name:      "Category",
			UserID:    "user_id_1",
			TeamID:    "team_id_1",
			CreateAt:  now,
			UpdateAt:  now,
			DeleteAt:  0,
			Collapsed: true,
		}

		err := store.CreateCategory(category)
		assert.NoError(t, err)

		createdCategory, err := store.GetCategory("category_id_2")
		assert.NoError(t, err)
		assert.Equal(t, "Category", createdCategory.Name)
		assert.Equal(t, "user_id_1", createdCategory.UserID)
		assert.Equal(t, "team_id_1", createdCategory.TeamID)
		assert.Equal(t, true, createdCategory.Collapsed)
	})

	t.Run("get nonexistent category", func(t *testing.T) {
		category, err := store.GetCategory("nonexistent")
		assert.Error(t, err)
		var nf *model.ErrNotFound
		assert.ErrorAs(t, err, &nf)
		assert.Nil(t, category)
	})
}

func testUpdateCategory(t *testing.T, store store.Store) {
	now := utils.GetMillis()
	category := model.Category{
		ID:        "category_id_1",
		Name:      "Category 1",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  now,
		DeleteAt:  0,
		Collapsed: false,
	}

	err := store.CreateCategory(category)
	assert.NoError(t, err)

	updateNow := utils.GetMillis()
	updatedCategory := model.Category{
		ID:        "category_id_1",
		Name:      "Category 1 New",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  updateNow,
		DeleteAt:  0,
		Collapsed: true,
	}

	err = store.UpdateCategory(updatedCategory)
	assert.NoError(t, err)

	fetchedCategory, err := store.GetCategory("category_id_1")
	assert.NoError(t, err)
	assert.Equal(t, "category_id_1", fetchedCategory.ID)
	assert.Equal(t, "Category 1 New", fetchedCategory.Name)
	assert.Equal(t, true, fetchedCategory.Collapsed)

	// now lets try to un-collapse the same category
	updatedCategory.Collapsed = false
	err = store.UpdateCategory(updatedCategory)
	assert.NoError(t, err)

	fetchedCategory, err = store.GetCategory("category_id_1")
	assert.NoError(t, err)
	assert.Equal(t, "category_id_1", fetchedCategory.ID)
	assert.Equal(t, "Category 1 New", fetchedCategory.Name)
	assert.Equal(t, false, fetchedCategory.Collapsed)
}

func testDeleteCategory(t *testing.T, store store.Store) {
	now := utils.GetMillis()
	category := model.Category{
		ID:        "category_id_1",
		Name:      "Category 1",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  now,
		DeleteAt:  0,
		Collapsed: false,
	}

	err := store.CreateCategory(category)
	assert.NoError(t, err)

	err = store.DeleteCategory("category_id_1", "user_id_1", "team_id_1")
	assert.NoError(t, err)

	deletedCategory, err := store.GetCategory("category_id_1")
	assert.NoError(t, err)
	assert.Equal(t, "category_id_1", deletedCategory.ID)
	assert.Equal(t, "Category 1", deletedCategory.Name)
	assert.Equal(t, false, deletedCategory.Collapsed)
	assert.Greater(t, deletedCategory.DeleteAt, int64(0))
}

func testGetUserCategories(t *testing.T, store store.Store) {
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
		Name:      "Category 2",
		UserID:    "user_id_1",
		TeamID:    "team_id_1",
		CreateAt:  now,
		UpdateAt:  now,
		DeleteAt:  0,
		Collapsed: false,
	}
	err = store.CreateCategory(category3)
	assert.NoError(t, err)

	userCategories, err := store.GetUserCategoryBoards("user_id_1", "team_id_1")
	assert.NoError(t, err)
	assert.Equal(t, 3, len(userCategories))
}

func testReorderCategories(t *testing.T, store store.Store) {
	// setup
	err := store.CreateCategory(model.Category{
		ID:     "category_id_1",
		Name:   "Category 1",
		Type:   "custom",
		UserID: "user_id",
		TeamID: "team_id",
	})
	assert.NoError(t, err)

	err = store.CreateCategory(model.Category{
		ID:     "category_id_2",
		Name:   "Category 2",
		Type:   "custom",
		UserID: "user_id",
		TeamID: "team_id",
	})
	assert.NoError(t, err)

	err = store.CreateCategory(model.Category{
		ID:     "category_id_3",
		Name:   "Category 3",
		Type:   "custom",
		UserID: "user_id",
		TeamID: "team_id",
	})
	assert.NoError(t, err)

	// verify the current order
	categories, err := store.GetUserCategories("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 3, len(categories))

	// the categories should show up in reverse insertion order (latest one first)
	assert.Equal(t, "category_id_3", categories[0].ID)
	assert.Equal(t, "category_id_2", categories[1].ID)
	assert.Equal(t, "category_id_1", categories[2].ID)

	// re-ordering categories normally
	_, err = store.ReorderCategories("user_id", "team_id", []string{
		"category_id_2",
		"category_id_3",
		"category_id_1",
	})
	assert.NoError(t, err)

	// verify the board order
	categories, err = store.GetUserCategories("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 3, len(categories))
	assert.Equal(t, "category_id_2", categories[0].ID)
	assert.Equal(t, "category_id_3", categories[1].ID)
	assert.Equal(t, "category_id_1", categories[2].ID)

	// lets try specifying a non existing category ID.
	// It shouldn't cause any problem
	_, err = store.ReorderCategories("user_id", "team_id", []string{
		"category_id_1",
		"category_id_2",
		"category_id_3",
		"non-existing-category-id",
	})
	assert.NoError(t, err)

	categories, err = store.GetUserCategories("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 3, len(categories))
	assert.Equal(t, "category_id_1", categories[0].ID)
	assert.Equal(t, "category_id_2", categories[1].ID)
	assert.Equal(t, "category_id_3", categories[2].ID)
}

func testReorderCategoryBoards(t *testing.T, store store.Store) {
	// setup
	err := store.CreateCategory(model.Category{
		ID:     "category_id_1",
		Name:   "Category 1",
		Type:   "custom",
		UserID: "user_id",
		TeamID: "team_id",
	})
	assert.NoError(t, err)

	err = store.AddUpdateCategoryBoard("user_id", "category_id_1", []string{
		"board_id_1",
		"board_id_2",
		"board_id_3",
		"board_id_4",
	})
	assert.NoError(t, err)

	// verify current order
	categoryBoards, err := store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, 4, len(categoryBoards[0].BoardMetadata))
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_1", Hidden: false})
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_2", Hidden: false})
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_3", Hidden: false})
	assert.Contains(t, categoryBoards[0].BoardMetadata, model.CategoryBoardMetadata{BoardID: "board_id_4", Hidden: false})

	// reordering
	newOrder, err := store.ReorderCategoryBoards("category_id_1", []string{
		"board_id_3",
		"board_id_1",
		"board_id_2",
		"board_id_4",
	})
	assert.NoError(t, err)
	assert.Equal(t, "board_id_3", newOrder[0])
	assert.Equal(t, "board_id_1", newOrder[1])
	assert.Equal(t, "board_id_2", newOrder[2])
	assert.Equal(t, "board_id_4", newOrder[3])

	// verify new order
	categoryBoards, err = store.GetUserCategoryBoards("user_id", "team_id")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(categoryBoards))
	assert.Equal(t, 4, len(categoryBoards[0].BoardMetadata))
	assert.Equal(t, "board_id_3", categoryBoards[0].BoardMetadata[0].BoardID)
	assert.Equal(t, "board_id_1", categoryBoards[0].BoardMetadata[1].BoardID)
	assert.Equal(t, "board_id_2", categoryBoards[0].BoardMetadata[2].BoardID)
	assert.Equal(t, "board_id_4", categoryBoards[0].BoardMetadata[3].BoardID)
}
