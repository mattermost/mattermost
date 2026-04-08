// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func makeTestView(channelID, userID string) *model.View {
	return &model.View{
		ChannelId: channelID,
		Type:      model.ViewTypeKanban,
		CreatorId: userID,
		Title:     "Test View",
	}
}

func TestAppCreateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("creates a view", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view, "")
		require.Nil(t, appErr)
		require.NotEmpty(t, saved.Id)
		assert.Equal(t, th.BasicChannel.Id, saved.ChannelId)
	})

	t.Run("exceeding max views per channel returns error", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)

		for i := range model.MaxViewsPerChannel {
			_, appErr := th.App.CreateView(th.Context, makeTestView(channel.Id, th.BasicUser.Id), "")
			require.Nil(t, appErr, "failed to create view %d", i)
		}

		_, appErr := th.App.CreateView(th.Context, makeTestView(channel.Id, th.BasicUser.Id), "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.view.create.limit.app_error", appErr.Id)
	})
}

func TestAppGetView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("gets a view by ID", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view, "")
		require.Nil(t, appErr)

		got, appErr := th.App.GetView(th.Context, saved.Id)
		require.Nil(t, appErr)
		assert.Equal(t, saved.Id, got.Id)
	})

	t.Run("returns 404 for non-existent view", func(t *testing.T) {
		_, appErr := th.App.GetView(th.Context, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestAppGetViewsForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("lists views for a channel", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		_, appErr := th.App.CreateView(th.Context, makeTestView(channel.Id, th.BasicUser.Id), "")
		require.Nil(t, appErr)
		_, appErr = th.App.CreateView(th.Context, makeTestView(channel.Id, th.BasicUser.Id), "")
		require.Nil(t, appErr)

		views, appErr := th.App.GetViewsForChannel(th.Context, channel.Id, model.ViewQueryOpts{})
		require.Nil(t, appErr)
		assert.Len(t, views, 2)
	})

	t.Run("empty channel returns empty list", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		views, appErr := th.App.GetViewsForChannel(th.Context, channel.Id, model.ViewQueryOpts{})
		require.Nil(t, appErr)
		assert.Empty(t, views)
	})

	t.Run("returns 400 for empty channelID", func(t *testing.T) {
		_, appErr := th.App.GetViewsForChannel(th.Context, "", model.ViewQueryOpts{})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestAppUpdateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("updates a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id), "")
		require.Nil(t, appErr)

		newTitle := "Updated Title"
		updated, appErr := th.App.UpdateView(th.Context, saved, &model.ViewPatch{Title: &newTitle}, "")
		require.Nil(t, appErr)
		assert.Equal(t, newTitle, updated.Title)
	})

	t.Run("nil view returns error", func(t *testing.T) {
		newTitle := "Title"
		_, appErr := th.App.UpdateView(th.Context, nil, &model.ViewPatch{Title: &newTitle}, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("validation error returns 400", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id), "")
		require.Nil(t, appErr)

		emptyTitle := ""
		_, appErr = th.App.UpdateView(th.Context, saved, &model.ViewPatch{Title: &emptyTitle}, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("not found returns 404", func(t *testing.T) {
		ghost := &model.View{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			Type:      model.ViewTypeKanban,
			CreatorId: th.BasicUser.Id,
			Title:     "Ghost",
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
		}
		newTitle := "Title"
		_, appErr := th.App.UpdateView(th.Context, ghost, &model.ViewPatch{Title: &newTitle}, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestAppDeleteView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("deletes a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id), "")
		require.Nil(t, appErr)

		appErr = th.App.DeleteView(th.Context, saved, "")
		require.Nil(t, appErr)

		_, appErr = th.App.GetView(th.Context, saved.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("nil view returns error", func(t *testing.T) {
		appErr := th.App.DeleteView(th.Context, nil, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("not found returns 404", func(t *testing.T) {
		ghost := &model.View{Id: model.NewId(), ChannelId: th.BasicChannel.Id}
		appErr := th.App.DeleteView(th.Context, ghost, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestAppUpdateViewSortOrder(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("reorders views", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		var created []*model.View
		for i := range 3 {
			v := makeTestView(channel.Id, th.BasicUser.Id)
			v.Title = "Reorder View"
			v.SortOrder = i
			saved, appErr := th.App.CreateView(th.Context, v, "")
			require.Nil(t, appErr)
			created = append(created, saved)
		}

		views, appErr := th.App.UpdateViewSortOrder(th.Context, created[2].Id, channel.Id, 0, "")
		require.Nil(t, appErr)
		require.Len(t, views, 3)
		assert.Equal(t, created[2].Id, views[0].Id)
		assert.Equal(t, created[0].Id, views[1].Id)
		assert.Equal(t, created[1].Id, views[2].Id)
	})

	t.Run("invalid index returns 400", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		v := makeTestView(channel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, v, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateViewSortOrder(th.Context, saved.Id, channel.Id, 99, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("non-existent view returns 404", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		v := makeTestView(channel.Id, th.BasicUser.Id)
		_, appErr := th.App.CreateView(th.Context, v, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpdateViewSortOrder(th.Context, model.NewId(), channel.Id, 0, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("empty channel returns 400", func(t *testing.T) {
		_, appErr := th.App.UpdateViewSortOrder(th.Context, model.NewId(), model.NewId(), 0, "")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestViewWebsocketEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	eventFilter := []model.WebsocketEventType{
		model.WebsocketEventViewCreated,
		model.WebsocketEventViewUpdated,
		model.WebsocketEventViewDeleted,
		model.WebsocketEventViewSorted,
	}
	messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventFilter)
	defer closeWS()

	saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id), "")
	require.Nil(t, appErr)

	received := <-messages
	assert.Equal(t, model.WebsocketEventViewCreated, received.EventType())
	var createdView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &createdView))
	assert.Equal(t, saved.Id, createdView.Id)

	newTitle := "Updated Title"
	updated, appErr := th.App.UpdateView(th.Context, saved, &model.ViewPatch{Title: &newTitle}, "")
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewUpdated, received.EventType())
	var updatedView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &updatedView))
	assert.Equal(t, updated.Id, updatedView.Id)
	assert.Equal(t, newTitle, updatedView.Title)

	// Create a second view for sort-order testing
	saved2, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id), "")
	require.Nil(t, appErr)
	received = <-messages
	assert.Equal(t, model.WebsocketEventViewCreated, received.EventType())

	sortedViews, appErr := th.App.UpdateViewSortOrder(th.Context, saved2.Id, th.BasicChannel.Id, 0, "")
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewSorted, received.EventType())
	var wsViews []*model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["views"].(string)), &wsViews))
	assert.Len(t, wsViews, len(sortedViews))

	appErr = th.App.DeleteView(th.Context, saved, "")
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewDeleted, received.EventType())
	assert.Equal(t, saved.Id, received.GetData()["view_id"])
}
