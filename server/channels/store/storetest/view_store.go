// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"testing"
	"time"

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
	t.Run("UpdateSortOrder", func(t *testing.T) { testUpdateViewSortOrder(t, ss) })
}

func makeView(channelID, creatorID string) *model.View {
	return &model.View{
		ChannelId: channelID,
		CreatorId: creatorID,
		Type:      model.ViewTypeKanban,
		Title:     "Test Kanban",
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
		assert.Equal(t, model.ViewTypeKanban, saved.Type)
		assert.Equal(t, "Test Kanban", saved.Title)
	})

	t.Run("persists and round-trips props correctly", func(t *testing.T) {
		v := makeView(channelID, creatorID)
		v.Title = "Props Kanban"
		v.Props = model.StringInterface{"color": "blue", "count": float64(3)}
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		require.NotNil(t, fetched.Props)
		assert.Equal(t, "blue", fetched.Props["color"])
		assert.Equal(t, float64(3), fetched.Props["count"])
	})

	t.Run("nil props round-trips as nil", func(t *testing.T) {
		v := makeView(channelID, creatorID)
		v.Title = "Nil Props Kanban"
		v.Props = nil
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		assert.Nil(t, fetched.Props)
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
	v1.Title = "Kanban A"
	v1.SortOrder = 1
	saved1, err := ss.View().Save(v1)
	require.NoError(t, err)

	v2 := makeView(channelID, creatorID)
	v2.Title = "Kanban B"
	v2.SortOrder = 0
	saved2, err := ss.View().Save(v2)
	require.NoError(t, err)

	v3 := makeView(otherChannelID, creatorID)
	v3.Title = "Other Channel Kanban"
	_, err = ss.View().Save(v3)
	require.NoError(t, err)

	t.Run("returns only views for the given channel", func(t *testing.T) {
		views, err := ss.View().GetForChannel(channelID, model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Len(t, views, 2)
		ids := []string{views[0].Id, views[1].Id}
		assert.Contains(t, ids, saved1.Id)
		assert.Contains(t, ids, saved2.Id)
	})

	t.Run("returns views ordered by sort_order ascending", func(t *testing.T) {
		views, err := ss.View().GetForChannel(channelID, model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Equal(t, saved2.Id, views[0].Id) // SortOrder 0
		assert.Equal(t, saved1.Id, views[1].Id) // SortOrder 1
	})

	t.Run("excludes deleted views", func(t *testing.T) {
		err := ss.View().Delete(saved1.Id, model.GetMillis())
		require.NoError(t, err)

		views, err := ss.View().GetForChannel(channelID, model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Len(t, views, 1)
		assert.Equal(t, saved2.Id, views[0].Id)
	})

	t.Run("returns empty slice for channel with no views", func(t *testing.T) {
		views, err := ss.View().GetForChannel(model.NewId(), model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Empty(t, views)
	})

	t.Run("paginates with page/offset", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		var saved []*model.View
		for i := range 3 {
			v := makeView(ch, creator)
			v.Title = "Paginate Kanban"
			v.SortOrder = i
			s, err := ss.View().Save(v)
			require.NoError(t, err)
			saved = append(saved, s)
		}

		page1, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2, Page: 0})
		require.NoError(t, err)
		assert.Len(t, page1, 2)
		assert.Equal(t, saved[0].Id, page1[0].Id)
		assert.Equal(t, saved[1].Id, page1[1].Id)

		page2, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2, Page: 1})
		require.NoError(t, err)
		require.Len(t, page2, 1)
		assert.Equal(t, saved[2].Id, page2[0].Id)
	})

	t.Run("respects SortOrder ordering across pages", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		orders := []int{0, 5, 10}
		var created []*model.View
		for _, so := range orders {
			v := makeView(ch, creator)
			v.Title = "SortOrder Kanban"
			v.SortOrder = so
			s, err := ss.View().Save(v)
			require.NoError(t, err)
			created = append(created, s)
		}

		page1, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2, Page: 0})
		require.NoError(t, err)
		require.Len(t, page1, 2)
		assert.Equal(t, created[0].Id, page1[0].Id)
		assert.Equal(t, created[1].Id, page1[1].Id)

		page2, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2, Page: 1})
		require.NoError(t, err)
		assert.Len(t, page2, 1)
		assert.Equal(t, created[2].Id, page2[0].Id)
	})

	t.Run("defaults PerPage to 20 when 0", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		for i := range model.ViewQueryDefaultPerPage + 1 {
			v := makeView(ch, creator)
			v.Title = "Default PerPage Kanban"
			v.SortOrder = i
			_, err := ss.View().Save(v)
			require.NoError(t, err)
		}

		views, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 0})
		require.NoError(t, err)
		assert.Len(t, views, model.ViewQueryDefaultPerPage)
	})

	t.Run("rejects empty channelID", func(t *testing.T) {
		_, err := ss.View().GetForChannel("", model.ViewQueryOpts{})
		require.Error(t, err)
		var invErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &invErr)
	})

	t.Run("clamps PerPage above max to max", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		for i := range model.ViewQueryMaxPerPage + 1 {
			v := makeView(ch, creator)
			v.Title = "Clamp Kanban"
			v.SortOrder = i
			_, err := ss.View().Save(v)
			require.NoError(t, err)
		}

		views, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 9999})
		require.NoError(t, err)
		assert.Len(t, views, model.ViewQueryMaxPerPage)
	})

	t.Run("negative page defaults to 0", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		v := makeView(ch, creator)
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		views, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{Page: -1})
		require.NoError(t, err)
		require.Len(t, views, 1)
		assert.Equal(t, saved.Id, views[0].Id)
	})

	t.Run("out-of-bounds page returns empty slice", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		for range 3 {
			_, err := ss.View().Save(makeView(ch, creator))
			require.NoError(t, err)
		}

		views, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2, Page: 999})
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
		updated.SortOrder = 5

		result, err := ss.View().Update(updated)
		require.NoError(t, err)
		assert.Equal(t, "Updated Title", result.Title)
		assert.Equal(t, "A description", result.Description)
		assert.Equal(t, 5, result.SortOrder)
		assert.GreaterOrEqual(t, result.UpdateAt, saved.UpdateAt)
	})

	t.Run("persists updated props", func(t *testing.T) {
		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)

		fetched.Props = model.StringInterface{"foo": "bar", "count": float64(42)}
		_, err = ss.View().Update(fetched)
		require.NoError(t, err)

		refetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		assert.Equal(t, "bar", refetched.Props["foo"])
		assert.Equal(t, float64(42), refetched.Props["count"])
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

func testUpdateViewSortOrder(t *testing.T, ss store.Store) {
	channelID := model.NewId()
	creatorID := model.NewId()

	// Create 3 views with different sort orders
	var views []*model.View
	for i := range 3 {
		v := makeView(channelID, creatorID)
		v.Title = fmt.Sprintf("View %d", i)
		v.SortOrder = i
		saved, err := ss.View().Save(v)
		require.NoError(t, err)
		views = append(views, saved)
	}

	// Extract IDs for clarity across stateful subtests
	idA, idB, idC := views[0].Id, views[1].Id, views[2].Id

	t.Run("moves last to first", func(t *testing.T) {
		// BEFORE: A, B, C — AFTER: C, A, B
		result, err := ss.View().UpdateSortOrder(idC, channelID, 0)
		require.NoError(t, err)
		require.Len(t, result, 3)
		assert.Equal(t, idC, result[0].Id)
		assert.Equal(t, idA, result[1].Id)
		assert.Equal(t, idB, result[2].Id)
		assert.Equal(t, 0, result[0].SortOrder)
		assert.Equal(t, 1, result[1].SortOrder)
		assert.Equal(t, 2, result[2].SortOrder)
	})

	t.Run("moves first to last", func(t *testing.T) {
		// BEFORE: C, A, B — AFTER: A, B, C
		result, err := ss.View().UpdateSortOrder(idC, channelID, 2)
		require.NoError(t, err)
		require.Len(t, result, 3)
		assert.Equal(t, idA, result[0].Id)
		assert.Equal(t, idB, result[1].Id)
		assert.Equal(t, idC, result[2].Id)
	})

	t.Run("moves to middle", func(t *testing.T) {
		// BEFORE: A, B, C — AFTER: A, C, B
		result, err := ss.View().UpdateSortOrder(idC, channelID, 1)
		require.NoError(t, err)
		require.Len(t, result, 3)
		assert.Equal(t, idA, result[0].Id)
		assert.Equal(t, idC, result[1].Id)
		assert.Equal(t, idB, result[2].Id)
	})

	t.Run("negative index returns error", func(t *testing.T) {
		_, err := ss.View().UpdateSortOrder(idA, channelID, -1)
		require.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("out of bounds index returns error", func(t *testing.T) {
		_, err := ss.View().UpdateSortOrder(idA, channelID, 99)
		require.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("non-existent view returns not found", func(t *testing.T) {
		_, err := ss.View().UpdateSortOrder(model.NewId(), channelID, 0)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("empty channel returns error", func(t *testing.T) {
		_, err := ss.View().UpdateSortOrder(idA, model.NewId(), 0)
		require.Error(t, err)
		var iiErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &iiErr)
	})

	t.Run("does not include deleted views", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		var created []*model.View
		for i := range 3 {
			v := makeView(ch, creator)
			v.Title = fmt.Sprintf("Del View %d", i)
			v.SortOrder = i
			s, err := ss.View().Save(v)
			require.NoError(t, err)
			created = append(created, s)
		}

		// Delete the middle one
		err := ss.View().Delete(created[1].Id, model.GetMillis())
		require.NoError(t, err)

		result, err := ss.View().UpdateSortOrder(created[2].Id, ch, 0)
		require.NoError(t, err)
		require.Len(t, result, 2)
		assert.Equal(t, created[2].Id, result[0].Id)
		assert.Equal(t, created[0].Id, result[1].Id)
	})

	t.Run("updates timestamps on all views", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		var created []*model.View
		for i := range 2 {
			v := makeView(ch, creator)
			v.Title = fmt.Sprintf("TS View %d", i)
			v.SortOrder = i
			s, err := ss.View().Save(v)
			require.NoError(t, err)
			created = append(created, s)
		}

		time.Sleep(2 * time.Millisecond)

		result, err := ss.View().UpdateSortOrder(created[1].Id, ch, 0)
		require.NoError(t, err)
		for _, v := range result {
			assert.Greater(t, v.UpdateAt, created[0].UpdateAt)
		}
	})
}
