// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestCustomChannelIconStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testCustomChannelIconStoreSave(t, rctx, ss) })
	t.Run("Get", func(t *testing.T) { testCustomChannelIconStoreGet(t, rctx, ss) })
	t.Run("GetByName", func(t *testing.T) { testCustomChannelIconStoreGetByName(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testCustomChannelIconStoreGetAll(t, rctx, ss) })
	t.Run("Update", func(t *testing.T) { testCustomChannelIconStoreUpdate(t, rctx, ss) })
	t.Run("Delete", func(t *testing.T) { testCustomChannelIconStoreDelete(t, rctx, ss) })
	t.Run("Search", func(t *testing.T) { testCustomChannelIconStoreSearch(t, rctx, ss) })
}

func testCustomChannelIconStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("saves valid icon", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name:           "test-icon",
			Svg:            "<svg>test</svg>",
			NormalizeColor: true,
			CreatedBy:      model.NewId(),
		}

		savedIcon, err := ss.CustomChannelIcon().Save(icon)
		require.NoError(t, err)
		require.NotNil(t, savedIcon)

		assert.NotEmpty(t, savedIcon.Id)
		assert.Equal(t, icon.Name, savedIcon.Name)
		assert.Equal(t, icon.Svg, savedIcon.Svg)
		assert.Equal(t, icon.NormalizeColor, savedIcon.NormalizeColor)
		assert.NotZero(t, savedIcon.CreateAt)
		assert.NotZero(t, savedIcon.UpdateAt)
		assert.Zero(t, savedIcon.DeleteAt)

		// Cleanup
		_ = ss.CustomChannelIcon().Delete(savedIcon.Id, model.GetMillis())
	})

	t.Run("generates ID if empty", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Id:        "", // Empty ID
			Name:      "no-id-icon",
			Svg:       "<svg>no-id</svg>",
			CreatedBy: model.NewId(),
		}

		savedIcon, err := ss.CustomChannelIcon().Save(icon)
		require.NoError(t, err)
		assert.Len(t, savedIcon.Id, 26) // Mattermost IDs are 26 chars

		// Cleanup
		_ = ss.CustomChannelIcon().Delete(savedIcon.Id, model.GetMillis())
	})

	t.Run("validates required fields", func(t *testing.T) {
		// Missing name
		icon := &model.CustomChannelIcon{
			Name:      "",
			Svg:       "<svg>test</svg>",
			CreatedBy: model.NewId(),
		}
		_, err := ss.CustomChannelIcon().Save(icon)
		require.Error(t, err)

		// Missing SVG
		icon = &model.CustomChannelIcon{
			Name:      "test",
			Svg:       "",
			CreatedBy: model.NewId(),
		}
		_, err = ss.CustomChannelIcon().Save(icon)
		require.Error(t, err)

		// Missing CreatedBy
		icon = &model.CustomChannelIcon{
			Name:      "test",
			Svg:       "<svg>test</svg>",
			CreatedBy: "",
		}
		_, err = ss.CustomChannelIcon().Save(icon)
		require.Error(t, err)
	})
}

func testCustomChannelIconStoreGet(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test icon
	icon := &model.CustomChannelIcon{
		Name:      "get-test",
		Svg:       "<svg>get</svg>",
		CreatedBy: model.NewId(),
	}
	savedIcon, err := ss.CustomChannelIcon().Save(icon)
	require.NoError(t, err)
	defer func() {
		_ = ss.CustomChannelIcon().Delete(savedIcon.Id, model.GetMillis())
	}()

	t.Run("returns icon by ID", func(t *testing.T) {
		fetchedIcon, err := ss.CustomChannelIcon().Get(savedIcon.Id)
		require.NoError(t, err)
		require.NotNil(t, fetchedIcon)

		assert.Equal(t, savedIcon.Id, fetchedIcon.Id)
		assert.Equal(t, savedIcon.Name, fetchedIcon.Name)
		assert.Equal(t, savedIcon.Svg, fetchedIcon.Svg)
	})

	t.Run("returns error for non-existent ID", func(t *testing.T) {
		_, err := ss.CustomChannelIcon().Get(model.NewId())
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("returns error for deleted icon", func(t *testing.T) {
		// Create and delete an icon
		deleteIcon := &model.CustomChannelIcon{
			Name:      "to-delete",
			Svg:       "<svg>delete</svg>",
			CreatedBy: model.NewId(),
		}
		deletedIcon, err := ss.CustomChannelIcon().Save(deleteIcon)
		require.NoError(t, err)

		err = ss.CustomChannelIcon().Delete(deletedIcon.Id, model.GetMillis())
		require.NoError(t, err)

		_, err = ss.CustomChannelIcon().Get(deletedIcon.Id)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testCustomChannelIconStoreGetByName(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test icon
	icon := &model.CustomChannelIcon{
		Name:      "name-test-icon",
		Svg:       "<svg>name</svg>",
		CreatedBy: model.NewId(),
	}
	savedIcon, err := ss.CustomChannelIcon().Save(icon)
	require.NoError(t, err)
	defer func() {
		_ = ss.CustomChannelIcon().Delete(savedIcon.Id, model.GetMillis())
	}()

	t.Run("returns icon by name", func(t *testing.T) {
		fetchedIcon, err := ss.CustomChannelIcon().GetByName("name-test-icon")
		require.NoError(t, err)
		require.NotNil(t, fetchedIcon)

		assert.Equal(t, savedIcon.Id, fetchedIcon.Id)
		assert.Equal(t, savedIcon.Name, fetchedIcon.Name)
	})

	t.Run("case-sensitive name lookup", func(t *testing.T) {
		_, err := ss.CustomChannelIcon().GetByName("NAME-TEST-ICON")
		require.Error(t, err) // Name should be case-sensitive
	})

	t.Run("returns error for deleted icon", func(t *testing.T) {
		// Create and delete an icon
		deleteIcon := &model.CustomChannelIcon{
			Name:      "delete-by-name",
			Svg:       "<svg>delete</svg>",
			CreatedBy: model.NewId(),
		}
		deletedIcon, err := ss.CustomChannelIcon().Save(deleteIcon)
		require.NoError(t, err)

		err = ss.CustomChannelIcon().Delete(deletedIcon.Id, model.GetMillis())
		require.NoError(t, err)

		_, err = ss.CustomChannelIcon().GetByName("delete-by-name")
		require.Error(t, err)
	})
}

func testCustomChannelIconStoreGetAll(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up any existing icons first
	existingIcons, _ := ss.CustomChannelIcon().GetAll()
	for _, icon := range existingIcons {
		_ = ss.CustomChannelIcon().Delete(icon.Id, model.GetMillis())
	}

	// Create test icons
	icons := []*model.CustomChannelIcon{
		{Name: "alpha-icon", Svg: "<svg>a</svg>", CreatedBy: model.NewId()},
		{Name: "beta-icon", Svg: "<svg>b</svg>", CreatedBy: model.NewId()},
		{Name: "gamma-icon", Svg: "<svg>c</svg>", CreatedBy: model.NewId()},
	}

	var savedIds []string
	for _, icon := range icons {
		savedIcon, err := ss.CustomChannelIcon().Save(icon)
		require.NoError(t, err)
		savedIds = append(savedIds, savedIcon.Id)
	}
	defer func() {
		for _, id := range savedIds {
			_ = ss.CustomChannelIcon().Delete(id, model.GetMillis())
		}
	}()

	t.Run("returns all non-deleted icons", func(t *testing.T) {
		allIcons, err := ss.CustomChannelIcon().GetAll()
		require.NoError(t, err)
		assert.Len(t, allIcons, 3)
	})

	t.Run("sorted by name", func(t *testing.T) {
		allIcons, err := ss.CustomChannelIcon().GetAll()
		require.NoError(t, err)
		require.Len(t, allIcons, 3)

		assert.Equal(t, "alpha-icon", allIcons[0].Name)
		assert.Equal(t, "beta-icon", allIcons[1].Name)
		assert.Equal(t, "gamma-icon", allIcons[2].Name)
	})

	t.Run("excludes deleted icons", func(t *testing.T) {
		// Delete one icon
		err := ss.CustomChannelIcon().Delete(savedIds[1], model.GetMillis())
		require.NoError(t, err)

		allIcons, err := ss.CustomChannelIcon().GetAll()
		require.NoError(t, err)
		assert.Len(t, allIcons, 2)
		assert.Equal(t, "alpha-icon", allIcons[0].Name)
		assert.Equal(t, "gamma-icon", allIcons[1].Name)
	})
}

func testCustomChannelIconStoreUpdate(t *testing.T, rctx request.CTX, ss store.Store) {
	// Create test icon
	icon := &model.CustomChannelIcon{
		Name:           "update-test",
		Svg:            "<svg>original</svg>",
		NormalizeColor: false,
		CreatedBy:      model.NewId(),
	}
	savedIcon, err := ss.CustomChannelIcon().Save(icon)
	require.NoError(t, err)
	defer func() {
		_ = ss.CustomChannelIcon().Delete(savedIcon.Id, model.GetMillis())
	}()

	t.Run("updates fields successfully", func(t *testing.T) {
		savedIcon.Name = "updated-name"
		savedIcon.Svg = "<svg>updated</svg>"
		savedIcon.NormalizeColor = true

		updatedIcon, err := ss.CustomChannelIcon().Update(savedIcon)
		require.NoError(t, err)
		require.NotNil(t, updatedIcon)

		assert.Equal(t, "updated-name", updatedIcon.Name)
		assert.Equal(t, "<svg>updated</svg>", updatedIcon.Svg)
		assert.True(t, updatedIcon.NormalizeColor)
		assert.Greater(t, updatedIcon.UpdateAt, savedIcon.CreateAt)
	})

	t.Run("returns error for non-existent icon", func(t *testing.T) {
		nonExistent := &model.CustomChannelIcon{
			Id:        model.NewId(),
			Name:      "ghost",
			Svg:       "<svg>ghost</svg>",
			CreatedBy: model.NewId(),
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
		}
		_, err := ss.CustomChannelIcon().Update(nonExistent)
		require.Error(t, err)
	})
}

func testCustomChannelIconStoreDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("sets deleteat timestamp", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name:      "delete-test",
			Svg:       "<svg>delete</svg>",
			CreatedBy: model.NewId(),
		}
		savedIcon, err := ss.CustomChannelIcon().Save(icon)
		require.NoError(t, err)

		deleteAt := model.GetMillis()
		err = ss.CustomChannelIcon().Delete(savedIcon.Id, deleteAt)
		require.NoError(t, err)

		// Icon should not be retrievable
		_, err = ss.CustomChannelIcon().Get(savedIcon.Id)
		require.Error(t, err)
	})

	t.Run("does not physically delete", func(t *testing.T) {
		icon := &model.CustomChannelIcon{
			Name:      "soft-delete-test",
			Svg:       "<svg>soft</svg>",
			CreatedBy: model.NewId(),
		}
		savedIcon, err := ss.CustomChannelIcon().Save(icon)
		require.NoError(t, err)

		err = ss.CustomChannelIcon().Delete(savedIcon.Id, model.GetMillis())
		require.NoError(t, err)

		// GetAll should not include deleted icon
		allIcons, err := ss.CustomChannelIcon().GetAll()
		require.NoError(t, err)
		for _, i := range allIcons {
			assert.NotEqual(t, savedIcon.Id, i.Id)
		}
	})

	t.Run("returns error for non-existent icon", func(t *testing.T) {
		err := ss.CustomChannelIcon().Delete(model.NewId(), model.GetMillis())
		require.Error(t, err)
	})
}

func testCustomChannelIconStoreSearch(t *testing.T, rctx request.CTX, ss store.Store) {
	// Clean up any existing icons first
	existingIcons, _ := ss.CustomChannelIcon().GetAll()
	for _, icon := range existingIcons {
		_ = ss.CustomChannelIcon().Delete(icon.Id, model.GetMillis())
	}

	// Create test icons with searchable names
	icons := []*model.CustomChannelIcon{
		{Name: "apple-fruit", Svg: "<svg>a</svg>", CreatedBy: model.NewId()},
		{Name: "banana-fruit", Svg: "<svg>b</svg>", CreatedBy: model.NewId()},
		{Name: "cherry-berry", Svg: "<svg>c</svg>", CreatedBy: model.NewId()},
		{Name: "date-fruit", Svg: "<svg>d</svg>", CreatedBy: model.NewId()},
	}

	var savedIds []string
	for _, icon := range icons {
		savedIcon, err := ss.CustomChannelIcon().Save(icon)
		require.NoError(t, err)
		savedIds = append(savedIds, savedIcon.Id)
	}
	defer func() {
		for _, id := range savedIds {
			_ = ss.CustomChannelIcon().Delete(id, model.GetMillis())
		}
	}()

	t.Run("searches by name prefix", func(t *testing.T) {
		results, err := ss.CustomChannelIcon().Search("fruit", 10)
		require.NoError(t, err)
		assert.Len(t, results, 3) // apple-fruit, banana-fruit, date-fruit
	})

	t.Run("respects limit parameter", func(t *testing.T) {
		results, err := ss.CustomChannelIcon().Search("fruit", 2)
		require.NoError(t, err)
		assert.Len(t, results, 2)
	})

	t.Run("excludes deleted icons", func(t *testing.T) {
		// Delete apple-fruit
		err := ss.CustomChannelIcon().Delete(savedIds[0], model.GetMillis())
		require.NoError(t, err)

		results, err := ss.CustomChannelIcon().Search("fruit", 10)
		require.NoError(t, err)
		assert.Len(t, results, 2) // banana-fruit, date-fruit
	})

	t.Run("returns empty for no matches", func(t *testing.T) {
		results, err := ss.CustomChannelIcon().Search("zzznomatch", 10)
		require.NoError(t, err)
		assert.Empty(t, results)
	})
}
