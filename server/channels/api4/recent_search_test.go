// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestRecentSearchesAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("GET me returns empty items", func(t *testing.T) {
		list, resp, err := client.GetRecentSearches(context.Background(), "me")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, list)
		require.NotNil(t, list.Items)
		require.Empty(t, list.Items)
	})

	t.Run("GET other user is 403", func(t *testing.T) {
		_, resp, err := client.GetRecentSearches(context.Background(), th.BasicUser2.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("POST me and GET shows item first", func(t *testing.T) {
		saved, resp, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "hello from:me",
			SearchType: model.RecentSearchTypeMessages,
			TeamId:     th.BasicTeam.Id,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, "hello from:me", saved.Terms)
		require.Equal(t, th.BasicUser.Id, saved.UserId)

		list, resp, err := client.GetRecentSearches(context.Background(), th.BasicUser.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, list.Items)
		require.Equal(t, saved.Id, list.Items[0].Id)
	})

	t.Run("POST other user is 403", func(t *testing.T) {
		_, resp, err := client.SaveRecentSearch(context.Background(), th.BasicUser2.Id, &model.RecentSearch{
			Terms:      "nope",
			SearchType: model.RecentSearchTypeMessages,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("POST invalid type is 400", func(t *testing.T) {
		_, resp, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "hello",
			SearchType: "channels",
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("DELETE owner then 404 on missing", func(t *testing.T) {
		saved, _, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "delete me",
			SearchType: model.RecentSearchTypeFiles,
		})
		require.NoError(t, err)

		resp, err := client.DeleteRecentSearch(context.Background(), "me", saved.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = client.DeleteRecentSearch(context.Background(), "me", saved.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthenticated is 401", func(t *testing.T) {
		_, err := client.Logout(context.Background())
		require.NoError(t, err)
		_, resp, err := client.GetRecentSearches(context.Background(), "me")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestRecentSearchServerOwnedFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("POST ignores client id and create_at", func(t *testing.T) {
		clientID := model.NewId()
		before := model.GetMillis()

		saved, resp, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Id:         clientID,
			Terms:      "client owned fields",
			SearchType: model.RecentSearchTypeMessages,
			CreateAt:   1,
			UpdateAt:   1,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEqual(t, clientID, saved.Id)
		require.GreaterOrEqual(t, saved.CreateAt, before)
		require.GreaterOrEqual(t, saved.UpdateAt, before)
	})

	t.Run("POST with another user's id is not a 500 and keeps their row", func(t *testing.T) {
		original, _, err := client.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Terms:      "owned by user one",
			SearchType: model.RecentSearchTypeFiles,
		})
		require.NoError(t, err)

		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		saved, resp, err := client2.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
			Id:         original.Id,
			Terms:      "written by user two",
			SearchType: model.RecentSearchTypeFiles,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEqual(t, original.Id, saved.Id)
		require.Equal(t, th.BasicUser2.Id, saved.UserId)

		list, _, err := client.GetRecentSearches(context.Background(), "me")
		require.NoError(t, err)
		// Other subtests may save in the same millisecond; match the unchanged row by its complete value.
		require.Contains(t, list.Items, original)
	})
}

func TestRecentSearchIsolation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	clientA := th.Client
	userA := th.BasicUser.Id

	searchA, _, err := clientA.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
		Terms:      "private to user one",
		SearchType: model.RecentSearchTypeMessages,
	})
	require.NoError(t, err)

	clientB := th.CreateClient()
	th.LoginBasic2WithClient(t, clientB)

	requireSearchAIntact := func(t *testing.T) {
		t.Helper()
		list, _, err := clientA.GetRecentSearches(context.Background(), "me")
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, searchA.Id, list.Items[0].Id)
		require.Equal(t, searchA.Terms, list.Items[0].Terms)
	}

	t.Run("B cannot GET A's searches", func(t *testing.T) {
		_, resp, err := clientB.GetRecentSearches(context.Background(), userA)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("B cannot POST to A's searches", func(t *testing.T) {
		_, resp, err := clientB.SaveRecentSearch(context.Background(), userA, &model.RecentSearch{
			Terms:      "injected by user two",
			SearchType: model.RecentSearchTypeMessages,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		requireSearchAIntact(t)
	})

	t.Run("B cannot DELETE on A's route", func(t *testing.T) {
		resp, err := clientB.DeleteRecentSearch(context.Background(), userA, searchA.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		requireSearchAIntact(t)
	})

	t.Run("B deleting A's id on own route is 404", func(t *testing.T) {
		resp, err := clientB.DeleteRecentSearch(context.Background(), "me", searchA.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		requireSearchAIntact(t)
	})

	t.Run("system admin cannot GET another user's searches", func(t *testing.T) {
		adminClient := th.CreateClient()
		th.LoginSystemAdminWithClient(t, adminClient)

		_, resp, err := adminClient.GetRecentSearches(context.Background(), userA)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestRecentSearchWebSocketEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	clientA := th.Client
	clientB := th.CreateClient()
	th.LoginBasic2WithClient(t, clientB)

	wsA := th.CreateConnectedWebSocketClientWithClient(t, clientA)
	wsB := th.CreateConnectedWebSocketClientWithClient(t, clientB)

	waitForRecentSearchEvent := func(wsClient *model.WebSocketClient, action string) map[string]any {
		timer := time.NewTimer(5 * time.Second)
		defer timer.Stop()

		for {
			select {
			case event := <-wsClient.EventChannel:
				if event == nil || event.EventType() != model.WebsocketEventRecentSearchUpdated {
					continue
				}
				data := event.GetData()
				require.Equal(t, action, data["action"])
				return data
			case <-timer.C:
				require.FailNow(t, "timed out waiting for recent_search_updated")
				return nil
			}
		}
	}

	requireNoRecentSearchEvent := func(wsClient *model.WebSocketClient) {
		timer := time.NewTimer(250 * time.Millisecond)
		defer timer.Stop()

		for {
			select {
			case event := <-wsClient.EventChannel:
				if event != nil {
					require.NotEqual(t, model.WebsocketEventRecentSearchUpdated, event.EventType(),
						"received recent_search_updated for another user")
				}
			case <-timer.C:
				return
			}
		}
	}

	saved, resp, err := clientA.SaveRecentSearch(context.Background(), "me", &model.RecentSearch{
		Terms:      "websocket integration",
		SearchType: model.RecentSearchTypeMessages,
	})
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	saveEvent := waitForRecentSearchEvent(wsA, model.RecentSearchWSActionSave)
	itemJSON, ok := saveEvent["item"].(string)
	require.True(t, ok)
	var eventItem model.RecentSearch
	require.NoError(t, json.Unmarshal([]byte(itemJSON), &eventItem))
	require.Equal(t, *saved, eventItem)
	requireNoRecentSearchEvent(wsB)

	resp, err = clientA.DeleteRecentSearch(context.Background(), "me", saved.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	deleteEvent := waitForRecentSearchEvent(wsA, model.RecentSearchWSActionDelete)
	require.Equal(t, saved.Id, deleteEvent["id"])
	requireNoRecentSearchEvent(wsB)
}
