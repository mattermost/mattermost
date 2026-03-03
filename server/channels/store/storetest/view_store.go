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
		views, _, err := ss.View().GetForChannel(channelID, model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Len(t, views, 2)
		ids := []string{views[0].Id, views[1].Id}
		assert.Contains(t, ids, saved1.Id)
		assert.Contains(t, ids, saved2.Id)
	})

	t.Run("returns views ordered by sort_order ascending", func(t *testing.T) {
		views, _, err := ss.View().GetForChannel(channelID, model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Equal(t, saved2.Id, views[0].Id) // SortOrder 0
		assert.Equal(t, saved1.Id, views[1].Id) // SortOrder 1
	})

	t.Run("excludes deleted views", func(t *testing.T) {
		err := ss.View().Delete(saved1.Id, model.GetMillis())
		require.NoError(t, err)

		views, _, err := ss.View().GetForChannel(channelID, model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Len(t, views, 1)
		assert.Equal(t, saved2.Id, views[0].Id)
	})

	t.Run("returns empty slice for channel with no views", func(t *testing.T) {
		views, cursor, err := ss.View().GetForChannel(model.NewId(), model.ViewQueryOpts{})
		require.NoError(t, err)
		assert.Empty(t, views)
		assert.True(t, cursor.IsEmpty())
	})

	t.Run("paginates with cursor", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		var saved []*model.View
		for i := 0; i < 3; i++ {
			v := makeView(ch, creator)
			v.Title = "Paginate Board"
			v.SortOrder = i
			s, err := ss.View().Save(v)
			require.NoError(t, err)
			saved = append(saved, s)
		}

		page1, cursor1, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2})
		require.NoError(t, err)
		assert.Len(t, page1, 2)
		assert.False(t, cursor1.IsEmpty())

		page2, cursor2, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{
			PerPage: 2,
			Cursor:  cursor1,
		})
		require.NoError(t, err)
		require.Len(t, page2, 1)
		assert.Equal(t, saved[2].Id, page2[0].Id)
		assert.True(t, cursor2.IsEmpty(), "cursor should be empty when no more pages")
	})

	t.Run("includes deleted when IncludeDeleted=true", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		v := makeView(ch, creator)
		v.Title = "IncDel Board"
		saved, err := ss.View().Save(v)
		require.NoError(t, err)

		err = ss.View().Delete(saved.Id, model.GetMillis())
		require.NoError(t, err)

		views, _, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{IncludeDeleted: true})
		require.NoError(t, err)
		assert.Len(t, views, 1)
		assert.Equal(t, saved.Id, views[0].Id)
	})

	t.Run("respects SortOrder in cursor", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		orders := []int{0, 5, 10}
		var created []*model.View
		for _, so := range orders {
			v := makeView(ch, creator)
			v.Title = "SortCursor Board"
			v.SortOrder = so
			s, err := ss.View().Save(v)
			require.NoError(t, err)
			created = append(created, s)
		}

		page1, cursor1, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 2})
		require.NoError(t, err)
		require.Len(t, page1, 2)
		assert.Equal(t, created[0].Id, page1[0].Id)
		assert.Equal(t, created[1].Id, page1[1].Id)

		page2, _, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{
			PerPage: 2,
			Cursor:  cursor1,
		})
		require.NoError(t, err)
		assert.Len(t, page2, 1)
		assert.Equal(t, created[2].Id, page2[0].Id)
	})

	t.Run("cursor with SortOrder=0", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		for i := 0; i < 2; i++ {
			v := makeView(ch, creator)
			v.Title = "SO0 Board"
			v.SortOrder = 0
			_, err := ss.View().Save(v)
			require.NoError(t, err)
		}

		page1, cursor1, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 1})
		require.NoError(t, err)
		require.Len(t, page1, 1)

		page2, _, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{
			PerPage: 1,
			Cursor:  cursor1,
		})
		require.NoError(t, err)
		assert.Len(t, page2, 1)
		assert.NotEqual(t, page1[0].Id, page2[0].Id)
	})

	t.Run("tiebreak on identical SortOrder and CreateAt", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		now := model.GetMillis()
		for i := 0; i < 2; i++ {
			v := makeView(ch, creator)
			v.Title = "Tiebreak Board"
			v.SortOrder = 1
			v.CreateAt = now
			_, err := ss.View().Save(v)
			require.NoError(t, err)
		}

		page1, cursor1, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 1})
		require.NoError(t, err)
		require.Len(t, page1, 1)

		page2, _, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{
			PerPage: 1,
			Cursor:  cursor1,
		})
		require.NoError(t, err)
		require.Len(t, page2, 1)
		assert.NotEqual(t, page1[0].Id, page2[0].Id)
	})

	t.Run("defaults PerPage to ViewQueryDefaultPerPage when 0", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		for i := 0; i < model.ViewQueryDefaultPerPage+1; i++ {
			v := makeView(ch, creator)
			v.Title = "Default PerPage Board"
			v.SortOrder = i
			_, err := ss.View().Save(v)
			require.NoError(t, err)
		}

		views, cursor, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 0})
		require.NoError(t, err)
		assert.Len(t, views, model.ViewQueryDefaultPerPage)
		assert.False(t, cursor.IsEmpty(), "cursor should point to last returned element")
	})

	t.Run("rejects empty channelID", func(t *testing.T) {
		_, _, err := ss.View().GetForChannel("", model.ViewQueryOpts{})
		require.Error(t, err)
		var invErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &invErr)
	})

	t.Run("clamps PerPage above max to max", func(t *testing.T) {
		ch := model.NewId()
		creator := model.NewId()
		for i := 0; i < model.ViewQueryMaxPerPage+1; i++ {
			v := makeView(ch, creator)
			v.Title = "Clamp Board"
			v.SortOrder = i
			_, err := ss.View().Save(v)
			require.NoError(t, err)
		}

		views, _, err := ss.View().GetForChannel(ch, model.ViewQueryOpts{PerPage: 9999})
		require.NoError(t, err)
		assert.Len(t, views, model.ViewQueryMaxPerPage)
	})

	t.Run("rejects invalid cursor", func(t *testing.T) {
		_, _, err := ss.View().GetForChannel(model.NewId(), model.ViewQueryOpts{
			Cursor: model.ViewQueryCursor{
				ViewID:   "not-a-valid-id",
				CreateAt: 1,
			},
		})
		require.Error(t, err)
		var invErr *store.ErrInvalidInput
		assert.ErrorAs(t, err, &invErr)
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
		assert.GreaterOrEqual(t, result.UpdateAt, saved.UpdateAt)
	})

	t.Run("persists updated props", func(t *testing.T) {
		fetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)

		propA := model.NewId()
		propB := model.NewId()
		fetched.Props = &model.ViewBoardProps{
			LinkedProperties: []string{propA, propB},
			Subviews:         []model.Subview{{Title: "Kanban", Type: model.SubviewTypeKanban}},
		}
		_, err = ss.View().Update(fetched)
		require.NoError(t, err)

		refetched, err := ss.View().Get(saved.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{propA, propB}, refetched.Props.LinkedProperties)
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
