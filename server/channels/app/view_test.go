// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func makeTestView(channelID, userID string) *model.View {
	return &model.View{
		ChannelId: channelID,
		Type:      model.ViewTypeBoard,
		CreatorId: userID,
		Title:     "Test View",
		Props: &model.ViewBoardProps{
			Subviews:         []model.Subview{{Title: "Default", Type: model.SubviewTypeKanban}},
			LinkedProperties: []string{model.NewId()},
		},
	}
}

func TestAppCreateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("creates a view", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view)
		require.Nil(t, appErr)
		require.NotEmpty(t, saved.Id)
		assert.Equal(t, th.BasicChannel.Id, saved.ChannelId)
	})

	t.Run("board view without subviews fails validation", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		view.Props.Subviews = nil
		_, appErr := th.App.CreateView(th.Context, view)
		require.NotNil(t, appErr)
	})

	t.Run("board view without linked properties fails validation", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		view.Props.LinkedProperties = nil
		_, appErr := th.App.CreateView(th.Context, view)
		require.NotNil(t, appErr)
	})
}

func TestAppGetView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("gets a view by ID", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view)
		require.Nil(t, appErr)

		got, appErr := th.App.GetView(th.Context, saved.Id)
		require.Nil(t, appErr)
		assert.Equal(t, saved.Id, got.Id)
	})

	t.Run("returns error for non-existent view", func(t *testing.T) {
		_, appErr := th.App.GetView(th.Context, model.NewId())
		require.NotNil(t, appErr)
	})
}

func TestAppGetViewsForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("lists views for a channel", func(t *testing.T) {
		_, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)
		_, appErr = th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		views, appErr := th.App.GetViewsForChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)
		assert.GreaterOrEqual(t, len(views), 2)
	})
}

func TestAppUpdateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("updates a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		newTitle := "Updated Title"
		updated, appErr := th.App.UpdateView(th.Context, saved.Id, &model.ViewPatch{Title: &newTitle})
		require.Nil(t, appErr)
		assert.Equal(t, newTitle, updated.Title)
	})
}

func TestAppDeleteView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("deletes a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		appErr = th.App.DeleteView(th.Context, saved.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.GetView(th.Context, saved.Id)
		require.NotNil(t, appErr)
	})
}

func TestViewWebsocketEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	eventFilter := []model.WebsocketEventType{
		model.WebsocketEventViewCreated,
		model.WebsocketEventViewUpdated,
		model.WebsocketEventViewDeleted,
	}
	messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", eventFilter)
	defer closeWS()

	saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
	require.Nil(t, appErr)

	received := <-messages
	assert.Equal(t, model.WebsocketEventViewCreated, received.EventType())
	var createdView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &createdView))
	assert.Equal(t, saved.Id, createdView.Id)

	newTitle := "Updated Title"
	updated, appErr := th.App.UpdateView(th.Context, saved.Id, &model.ViewPatch{Title: &newTitle})
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewUpdated, received.EventType())
	var updatedView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &updatedView))
	assert.Equal(t, updated.Id, updatedView.Id)
	assert.Equal(t, newTitle, updatedView.Title)

	appErr = th.App.DeleteView(th.Context, saved.Id)
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewDeleted, received.EventType())
	var deletedView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &deletedView))
	assert.Equal(t, saved.Id, deletedView.Id)
}
