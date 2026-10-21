// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSaveRecentSearch(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("rejects invalid search type with 400", func(t *testing.T) {
		saved, appErr := th.App.SaveRecentSearch(th.Context, th.BasicUser.Id, &model.RecentSearch{
			Terms:      "hello",
			SearchType: "channels",
		})
		require.Nil(t, saved)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("saves and lists for the owner", func(t *testing.T) {
		saved, appErr := th.App.SaveRecentSearch(th.Context, th.BasicUser.Id, &model.RecentSearch{
			Terms:      "  hello from:me  ",
			SearchType: model.RecentSearchTypeMessages,
			TeamId:     th.BasicTeam.Id,
		})
		require.Nil(t, appErr)
		require.NotNil(t, saved)
		require.Equal(t, "hello from:me", saved.Terms)
		require.Equal(t, th.BasicUser.Id, saved.UserId)

		list, appErr := th.App.GetRecentSearchesForUser(th.Context, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotEmpty(t, list.Items)
		require.Equal(t, saved.Id, list.Items[0].Id)
	})

	t.Run("publishes a user-scoped recent_search_updated event", func(t *testing.T) {
		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketEventRecentSearchUpdated})
		defer closeWS()

		saved, appErr := th.App.SaveRecentSearch(th.Context, th.BasicUser.Id, &model.RecentSearch{
			Terms:      "ws event",
			SearchType: model.RecentSearchTypeMessages,
		})
		require.Nil(t, appErr)

		deadline := time.After(5 * time.Second)
		select {
		case msg := <-messages:
			require.Equal(t, model.WebsocketEventRecentSearchUpdated, msg.EventType())
			require.Equal(t, model.RecentSearchWSActionSave, msg.GetData()["action"])
			require.Contains(t, msg.GetData()["item"].(string), saved.Id)
		case <-deadline:
			require.Fail(t, "timed out waiting for recent_search_updated")
		}
	})
}

func TestDeleteRecentSearch(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	saved, appErr := th.App.SaveRecentSearch(th.Context, th.BasicUser.Id, &model.RecentSearch{
		Terms:      "to delete",
		SearchType: model.RecentSearchTypeFiles,
	})
	require.Nil(t, appErr)

	t.Run("foreign delete is 404", func(t *testing.T) {
		appErr := th.App.DeleteRecentSearch(th.Context, th.BasicUser2.Id, saved.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("owner can delete", func(t *testing.T) {
		appErr := th.App.DeleteRecentSearch(th.Context, th.BasicUser.Id, saved.Id)
		require.Nil(t, appErr)

		list, appErr := th.App.GetRecentSearchesForUser(th.Context, th.BasicUser.Id)
		require.Nil(t, appErr)
		for _, item := range list.Items {
			require.NotEqual(t, saved.Id, item.Id)
		}
	})
}
