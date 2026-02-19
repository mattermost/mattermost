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
	}
}

func TestAppCreateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("channel member can create a view", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view)
		require.Nil(t, appErr)
		require.NotEmpty(t, saved.Id)
		assert.Equal(t, th.BasicChannel.Id, saved.ChannelId)
	})

	t.Run("non-member cannot create a view", func(t *testing.T) {
		nonMember := th.CreateUser(t)
		view := makeTestView(th.BasicChannel.Id, nonMember.Id)
		_, appErr := th.App.CreateView(th.Context, view)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.view.create.no_permission.app_error", appErr.Id)
	})
}

func TestAppGetView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("channel member can get a view", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view)
		require.Nil(t, appErr)

		got, appErr := th.App.GetView(th.Context, saved.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.Equal(t, saved.Id, got.Id)
	})

	t.Run("non-member cannot get a view", func(t *testing.T) {
		view := makeTestView(th.BasicChannel.Id, th.BasicUser.Id)
		saved, appErr := th.App.CreateView(th.Context, view)
		require.Nil(t, appErr)

		nonMember := th.CreateUser(t)
		_, appErr = th.App.GetView(th.Context, saved.Id, nonMember.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.view.get.no_permission.app_error", appErr.Id)
	})

	t.Run("returns error for non-existent view", func(t *testing.T) {
		_, appErr := th.App.GetView(th.Context, model.NewId(), th.BasicUser.Id)
		require.NotNil(t, appErr)
	})
}

func TestAppGetViewsForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("channel member can list views", func(t *testing.T) {
		_, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)
		_, appErr = th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		views, appErr := th.App.GetViewsForChannel(th.Context, th.BasicChannel.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		assert.GreaterOrEqual(t, len(views), 2)
	})

	t.Run("non-member cannot list views", func(t *testing.T) {
		nonMember := th.CreateUser(t)
		_, appErr := th.App.GetViewsForChannel(th.Context, th.BasicChannel.Id, nonMember.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.view.get_for_channel.no_permission.app_error", appErr.Id)
	})
}

func TestAppUpdateView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("channel member can update a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		newTitle := "Updated Title"
		updated, appErr := th.App.UpdateView(th.Context, saved.Id, th.BasicUser.Id, &model.ViewPatch{Title: &newTitle})
		require.Nil(t, appErr)
		assert.Equal(t, newTitle, updated.Title)
	})

	t.Run("non-member cannot update a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		nonMember := th.CreateUser(t)
		newTitle := "Hijacked Title"
		_, appErr = th.App.UpdateView(th.Context, saved.Id, nonMember.Id, &model.ViewPatch{Title: &newTitle})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.view.get.no_permission.app_error", appErr.Id)
	})
}

func TestAppDeleteView(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("channel member can delete a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		appErr = th.App.DeleteView(th.Context, saved.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, appErr = th.App.GetView(th.Context, saved.Id, th.BasicUser.Id)
		require.NotNil(t, appErr)
	})

	t.Run("non-member cannot delete a view", func(t *testing.T) {
		saved, appErr := th.App.CreateView(th.Context, makeTestView(th.BasicChannel.Id, th.BasicUser.Id))
		require.Nil(t, appErr)

		nonMember := th.CreateUser(t)
		appErr = th.App.DeleteView(th.Context, saved.Id, nonMember.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.view.get.no_permission.app_error", appErr.Id)
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
	updated, appErr := th.App.UpdateView(th.Context, saved.Id, th.BasicUser.Id, &model.ViewPatch{Title: &newTitle})
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewUpdated, received.EventType())
	var updatedView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &updatedView))
	assert.Equal(t, updated.Id, updatedView.Id)
	assert.Equal(t, newTitle, updatedView.Title)

	appErr = th.App.DeleteView(th.Context, saved.Id, th.BasicUser.Id)
	require.Nil(t, appErr)

	received = <-messages
	assert.Equal(t, model.WebsocketEventViewDeleted, received.EventType())
	var deletedView model.View
	require.NoError(t, json.Unmarshal([]byte(received.GetData()["view"].(string)), &deletedView))
	assert.Equal(t, saved.Id, deletedView.Id)
}
