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

func TestViewStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveView", func(t *testing.T) { testSaveView(t, ss) })
	t.Run("GetView", func(t *testing.T) { testGetView(t, ss) })
	t.Run("GetViewsForChannel", func(t *testing.T) { testGetViewsForChannel(t, ss) })
	t.Run("UpdateView", func(t *testing.T) { testUpdateView(t, ss) })
	t.Run("DeleteView", func(t *testing.T) { testDeleteView(t, ss) })
}

func makeView(channelID, creatorID string) *model.View {
	return &model.View{
		ChannelId: channelID,
		CreatorId: creatorID,
		Type:      model.ViewTypeBoard,
		Title:     "Test Board",
		Props: &model.ViewBoardProps{
			LinkedProperties: []string{model.NewId()},
			Subviews: []model.Subview{
				{Title: "Kanban", Type: model.SubviewTypeKanban},
			},
		},
	}
}

func testSaveView(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	creatorID := model.NewId()

	t.Run("saves a valid view and returns it with generated fields", func(t *testing.T) {
		v := makeView(channelID, creatorID)
		saved, err := ss.View().Save(v)
		require.NoError(t, err)
		require.NotNil(t, saved)

		assert.True(t, model.IsValidId(saved.Id))
		assert.NotZero(t, saved.CreateAt)
		assert.NotZero(t, saved.UpdateAt)
		assert.Equal(t, channelID, saved.ChannelId)
		assert.Equal(t, creatorID, saved.CreatorId)
		assert.Equal(t, model.ViewTypeBoard, saved.Type)
		assert.Equal(t, "Test Board", saved.Title)
	})

	t.Run("persists and round-trips props correctly", func(t *testing.T) {
		v := makeView(channelID, creatorID)
		v.Title = "Props Board"
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		require.NotNil(t, fetched.Props)
		assert.Equal(t, saved.Props.LinkedProperties, fetched.Props.LinkedProperties)
		assert.Len(t, fetched.Props.Subviews, 1)
		assert.Equal(t, model.SubviewTypeKanban, fetched.Props.Subviews[0].Type)
	})

	t.Run("round-trips nil props as nil", func(t *testing.T) {
		v := &model.View{
			ChannelId: channelID,
			CreatorId: creatorID,
			Type:      model.ViewTypeBoard,
			Title:     "Nil Props Board",
			Props:     nil,
		}
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		assert.Nil(t, fetched.Props)
	})

	t.Run("generates subview IDs via PreSave", func(t *testing.T) {
		v := makeView(channelID, creatorID)
		v.Title = "Subview ID Board"
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		require.Len(t, fetched.Props.Subviews, 1)
		assert.True(t, model.IsValidId(fetched.Props.Subviews[0].Id))
	})
}

func testGetView(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	creatorID := model.NewId()

	saved, err := ss.View().Save(makeView(channelID, creatorID))
	require.NoError(t, err)

	t.Run("returns the view by ID", func(t *testing.T) {
		v, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		assert.Equal(t, saved.Id, v.Id)
		assert.Equal(t, saved.ChannelId, v.ChannelId)
		assert.Equal(t, saved.Title, v.Title)
	})

	t.Run("returns not found for unknown ID", func(t *testing.T) {
		_, err := ss.View().Get(model.NewId())
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("returns not found for deleted view", func(t *testing.T) {
		err := ss.View().Delete(saved.Id, model.GetMillis())
		require.NoError(t, err)

		_, err = ss.View().Get(saved.Id)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testGetViewsForChannel(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	otherChannelID := model.NewId()
	creatorID := model.NewId()

	v1 := makeView(channelID, creatorID)
	v1.Title = "Board A"
	v1.SortOrder = 1
	saved1, err := ss.View().Save(v1)
	require.NoError(t, err)

	v2 := makeView(channelID, creatorID)
	v2.Title = "Board B"
	v2.SortOrder = 0
	saved2, err := ss.View().Save(v2)
	require.NoError(t, err)

	v3 := makeView(otherChannelID, creatorID)
	v3.Title = "Other Channel Board"
	_, err = ss.View().Save(v3)
	require.NoError(t, err)

	t.Run("returns only views for the given channel", func(t *testing.T) {
		views, err := ss.View().GetForChannel(channelID)
		require.NoError(t, err)
		assert.Len(t, views, 2)
		ids := []string{views[0].Id, views[1].Id}
		assert.Contains(t, ids, saved1.Id)
		assert.Contains(t, ids, saved2.Id)
	})

	t.Run("returns views ordered by sort_order ascending", func(t *testing.T) {
		views, err := ss.View().GetForChannel(channelID)
		require.NoError(t, err)
		assert.Equal(t, saved2.Id, views[0].Id) // SortOrder 0
		assert.Equal(t, saved1.Id, views[1].Id) // SortOrder 1
	})

	t.Run("excludes deleted views", func(t *testing.T) {
		err := ss.View().Delete(saved1.Id, model.GetMillis())
		require.NoError(t, err)

		views, err := ss.View().GetForChannel(channelID)
		require.NoError(t, err)
		assert.Len(t, views, 1)
		assert.Equal(t, saved2.Id, views[0].Id)
	})

	t.Run("returns empty slice for channel with no views", func(t *testing.T) {
		views, err := ss.View().GetForChannel(model.NewId())
		require.NoError(t, err)
		assert.Empty(t, views)
	})
}

func testUpdateView(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	creatorID := model.NewId()

	saved, err := ss.View().Save(makeView(channelID, creatorID))
	require.NoError(t, err)

	t.Run("updates mutable fields", func(t *testing.T) {
		updated := saved.Clone()
		updated.Title = "Updated Title"
		updated.Description = "A description"
		updated.Icon = "🚀"
		updated.SortOrder = 5

		result, err := ss.View().Update(updated)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", result.Title)
		assert.Equal(t, "A description", result.Description)
		assert.Equal(t, "🚀", result.Icon)
		assert.Equal(t, 5, result.SortOrder)
		assert.Greater(t, result.UpdateAt, saved.UpdateAt)
	})

	t.Run("persists updated props", func(t *testing.T) {
		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)

		fetched.Props = &model.ViewBoardProps{
			LinkedProperties: []string{"prop-a", "prop-b"},
		}
		_, err = ss.View().Update(fetched)
		require.NoError(t, err)

		refetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{"prop-a", "prop-b"}, refetched.Props.LinkedProperties)
	})

	t.Run("returns not found for unknown ID", func(t *testing.T) {
		ghost := makeView(channelID, creatorID)
		ghost.Id = model.NewId()
		ghost.PreSave()

		_, err := ss.View().Update(ghost)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}

func testDeleteView(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	creatorID := model.NewId()

	t.Run("soft deletes the view", func(t *testing.T) {
		saved, err := ss.View().Save(makeView(channelID, creatorID))
		require.NoError(t, err)

		deleteAt := model.GetMillis()
		err = ss.View().Delete(saved.Id, deleteAt)
		require.NoError(t, err)

		_, err = ss.View().Get(saved.Id)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("returns not found for unknown ID", func(t *testing.T) {
		err := ss.View().Delete(model.NewId(), model.GetMillis())
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("returns not found when deleting an already deleted view", func(t *testing.T) {
		saved, err := ss.View().Save(makeView(channelID, creatorID))
		require.NoError(t, err)

		deleteAt := model.GetMillis()
		err = ss.View().Delete(saved.Id, deleteAt)
		require.NoError(t, err)

		err = ss.View().Delete(saved.Id, model.GetMillis())
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})
}
