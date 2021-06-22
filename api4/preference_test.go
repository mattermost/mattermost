// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetPreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	// recreate basic user (cached has no default preferences)
	th.BasicUser = th.CreateUser()
	th.LoginBasic()

	user1 := th.BasicUser

	category := model.NewId()
	preferences1 := model.Preferences{
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}

	Client.UpdatePreferences(user1.Id, &preferences1)

	prefs, resp := Client.GetPreferences(user1.Id)
	CheckNoError(t, resp)
	require.Equal(t, len(prefs), 4, "received the wrong number of preferences")

	for _, preference := range prefs {
		require.Equal(t, preference.UserId, th.BasicUser.Id, "user id does not match")
	}

	// recreate basic user2
	th.BasicUser2 = th.CreateUser()
	th.LoginBasic2()

	prefs, resp = Client.GetPreferences(th.BasicUser2.Id)
	CheckNoError(t, resp)

	require.Greater(t, len(prefs), 0, "received the wrong number of preferences")

	_, resp = Client.GetPreferences(th.BasicUser.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPreferences(th.BasicUser2.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetPreferencesByCategory(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.LoginBasic()
	user1 := th.BasicUser

	category := model.NewId()
	preferences1 := model.Preferences{
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}

	Client.UpdatePreferences(user1.Id, &preferences1)

	prefs, resp := Client.GetPreferencesByCategory(user1.Id, category)
	CheckNoError(t, resp)

	require.Equal(t, len(prefs), 2, "received the wrong number of preferences")

	_, resp = Client.GetPreferencesByCategory(user1.Id, "junk")
	CheckNotFoundStatus(t, resp)

	th.LoginBasic2()

	_, resp = Client.GetPreferencesByCategory(th.BasicUser2.Id, category)
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetPreferencesByCategory(user1.Id, category)
	CheckForbiddenStatus(t, resp)

	prefs, resp = Client.GetPreferencesByCategory(th.BasicUser2.Id, "junk")
	CheckNotFoundStatus(t, resp)

	require.Equal(t, len(prefs), 0, "received the wrong number of preferences")

	Client.Logout()
	_, resp = Client.GetPreferencesByCategory(th.BasicUser2.Id, category)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetPreferenceByCategoryAndName(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.LoginBasic()
	user := th.BasicUser
	name := model.NewId()
	value := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     name,
			Value:    value,
		},
		{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
			Value:    model.NewId(),
		},
	}

	Client.UpdatePreferences(user.Id, &preferences)

	pref, resp := Client.GetPreferenceByCategoryAndName(user.Id, model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, name)
	CheckNoError(t, resp)

	require.Equal(t, preferences[0].UserId, pref.UserId, "UserId preference not saved")
	require.Equal(t, preferences[0].Category, pref.Category, "Category preference not saved")
	require.Equal(t, preferences[0].Name, pref.Name, "Name preference not saved")

	preferences[0].Value = model.NewId()
	Client.UpdatePreferences(user.Id, &preferences)

	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, "junk", preferences[0].Name)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, preferences[0].Category, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(th.BasicUser2.Id, preferences[0].Category, "junk")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, preferences[0].Category, preferences[0].Name)
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, preferences[0].Category, preferences[0].Name)
	CheckUnauthorizedStatus(t, resp)

}

func TestUpdatePreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.LoginBasic()
	user1 := th.BasicUser

	category := model.NewId()
	preferences1 := model.Preferences{
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}

	_, resp := Client.UpdatePreferences(user1.Id, &preferences1)
	CheckNoError(t, resp)

	preferences := model.Preferences{
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     model.NewId(),
		},
	}

	_, resp = Client.UpdatePreferences(user1.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	preferences = model.Preferences{
		{
			UserId: user1.Id,
			Name:   model.NewId(),
		},
	}

	_, resp = Client.UpdatePreferences(user1.Id, &preferences)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdatePreferences(th.BasicUser2.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdatePreferences(user1.Id, &preferences1)
	CheckUnauthorizedStatus(t, resp)
}

func TestUpdatePreferencesWebsocket(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	WebSocketClient, err := th.CreateWebSocketClient()
	require.Nil(t, err)

	WebSocketClient.Listen()
	time.Sleep(300 * time.Millisecond)
	wsResp := <-WebSocketClient.ResponseChannel
	require.Equal(t, wsResp.Status, model.STATUS_OK, "expected OK from auth challenge")

	userId := th.BasicUser.Id
	preferences := &model.Preferences{
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}

	_, resp := th.Client.UpdatePreferences(userId, preferences)
	CheckNoError(t, resp)

	timeout := time.After(300 * time.Millisecond)

	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() != model.WEBSOCKET_EVENT_PREFERENCES_CHANGED {
				// Ignore any other events
				continue
			}

			received, err := model.PreferencesFromJson(strings.NewReader(event.GetData()["preferences"].(string)))
			require.NoError(t, err)

			for i, p := range *preferences {
				require.Equal(t, received[i].UserId, p.UserId, "received incorrect UserId")
				require.Equal(t, received[i].Category, p.Category, "received incorrect Category")
				require.Equal(t, received[i].Name, p.Name, "received incorrect Name")
			}

			waiting = false
		case <-timeout:
			require.Fail(t, "timed timed out waiting for preference update event")
		}
	}
}

func TestUpdateSidebarPreferences(t *testing.T) {
	t.Run("when favoriting a channel, should add it to the Favorites sidebar category", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser

		team1 := th.CreateTeam()
		th.LinkUserToTeam(user, team1)

		_, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.CHANNEL_OPEN, team1.Id)
		th.AddUserToChannel(user, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel was added to the Favorites
		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "false",
			},
		})
		require.Nil(t, resp.Error)

		// The channel should've been removed from the Favorites
		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Contains(t, categories.Categories[1].Channels, channel.Id)
	})

	t.Run("when favoriting a DM channel, should add it to the Favorites sidebar category for all teams", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser
		user2 := th.BasicUser2

		team1 := th.CreateTeam()
		th.LinkUserToTeam(user, team1)
		team2 := th.CreateTeam()
		th.LinkUserToTeam(user, team2)

		dmChannel := th.CreateDmChannel(user2)

		// Favorite the channel
		_, resp := th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     dmChannel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel was added to the Favorites on all teams
		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team2.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		// And unfavorite the channel
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     dmChannel.Id,
				Value:    "false",
			},
		})
		require.Nil(t, resp.Error)

		// The channel should've been removed from the Favorites on all teams
		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Contains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team2.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Contains(t, categories.Categories[2].Channels, dmChannel.Id)
	})

	t.Run("when favoriting a channel, should not affect other users' favorites categories", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser
		user2 := th.BasicUser2

		client2 := th.CreateClient()
		th.LoginBasic2WithClient(client2)

		team1 := th.CreateTeam()
		th.LinkUserToTeam(user, team1)
		th.LinkUserToTeam(user2, team1)

		_, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		_, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.CHANNEL_OPEN, team1.Id)
		th.AddUserToChannel(user, channel)
		th.AddUserToChannel(user2, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel was not added to Favorites for the second user
		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel for the second user
		_, resp = client2.UpdatePreferences(user2.Id, &model.Preferences{
			{
				UserId:   user2.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel is now in the Favorites for the second user
		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "false",
			},
		})
		require.Nil(t, resp.Error)

		// The channel should still be in the second user's favorites
		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)
	})
}

func TestDeletePreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.LoginBasic()

	prefs, _ := Client.GetPreferences(th.BasicUser.Id)
	originalCount := len(prefs)

	// save 10 preferences
	var preferences model.Preferences
	for i := 0; i < 10; i++ {
		preference := model.Preference{
			UserId:   th.BasicUser.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
		}
		preferences = append(preferences, preference)
	}

	Client.UpdatePreferences(th.BasicUser.Id, &preferences)

	// delete 10 preferences
	th.LoginBasic2()

	_, resp := Client.DeletePreferences(th.BasicUser2.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	_, resp = Client.DeletePreferences(th.BasicUser.Id, &preferences)
	CheckNoError(t, resp)

	_, resp = Client.DeletePreferences(th.BasicUser2.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	prefs, _ = Client.GetPreferences(th.BasicUser.Id)
	require.Len(t, prefs, originalCount, "should've deleted preferences")

	Client.Logout()
	_, resp = Client.DeletePreferences(th.BasicUser.Id, &preferences)
	CheckUnauthorizedStatus(t, resp)
}

func TestDeletePreferencesWebsocket(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	userId := th.BasicUser.Id
	preferences := &model.Preferences{
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
		{
			UserId:   userId,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}
	_, resp := th.Client.UpdatePreferences(userId, preferences)
	CheckNoError(t, resp)

	WebSocketClient, err := th.CreateWebSocketClient()
	require.Nil(t, err)

	WebSocketClient.Listen()
	wsResp := <-WebSocketClient.ResponseChannel
	require.Equal(t, model.STATUS_OK, wsResp.Status, "should have responded OK to authentication challenge")

	_, resp = th.Client.DeletePreferences(userId, preferences)
	CheckNoError(t, resp)

	timeout := time.After(30000 * time.Millisecond)

	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() != model.WEBSOCKET_EVENT_PREFERENCES_DELETED {
				// Ignore any other events
				continue
			}

			received, err := model.PreferencesFromJson(strings.NewReader(event.GetData()["preferences"].(string)))
			require.NoError(t, err)

			for i, preference := range *preferences {
				require.Equal(t, preference.UserId, received[i].UserId)
				require.Equal(t, preference.Category, received[i].Category)
				require.Equal(t, preference.Name, received[i].Name)
			}

			waiting = false
		case <-timeout:
			require.Fail(t, "timed out waiting for preference delete event")
		}
	}
}

func TestDeleteSidebarPreferences(t *testing.T) {
	t.Run("when removing a favorited channel preference, should remove it from the Favorites sidebar category", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser

		team1 := th.CreateTeam()
		th.LinkUserToTeam(user, team1)

		_, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.CHANNEL_OPEN, team1.Id)
		th.AddUserToChannel(user, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel was added to the Favorites
		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel by deleting the preference
		_, resp = th.Client.DeletePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
			},
		})
		require.Nil(t, resp.Error)

		// The channel should've been removed from the Favorites
		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Contains(t, categories.Categories[1].Channels, channel.Id)
	})

	t.Run("when removing a favorited DM preference, should remove it from the Favorites sidebar category", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser
		user2 := th.BasicUser2

		team1 := th.CreateTeam()
		th.LinkUserToTeam(user, team1)
		team2 := th.CreateTeam()
		th.LinkUserToTeam(user, team2)

		dmChannel := th.CreateDmChannel(user2)

		// Favorite the channel
		_, resp := th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     dmChannel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel was added to the Favorites on all teams
		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team2.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		// And unfavorite the channel by deleting the preference
		_, resp = th.Client.DeletePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     dmChannel.Id,
			},
		})
		require.Nil(t, resp.Error)

		// The channel should've been removed from the Favorites on all teams
		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Contains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, resp = th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team2.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Contains(t, categories.Categories[2].Channels, dmChannel.Id)
	})

	t.Run("when removing a favorited channel preference, should not affect other users' favorites categories", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user := th.BasicUser
		user2 := th.BasicUser2

		client2 := th.CreateClient()
		th.LoginBasic2WithClient(client2)

		team1 := th.CreateTeam()
		th.LinkUserToTeam(user, team1)
		th.LinkUserToTeam(user2, team1)

		_, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		_, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.CHANNEL_OPEN, team1.Id)
		th.AddUserToChannel(user, channel)
		th.AddUserToChannel(user2, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(user.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel for both users
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		_, resp = client2.UpdatePreferences(user2.Id, &model.Preferences{
			{
				UserId:   user2.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.Nil(t, resp.Error)

		// Confirm that the channel is in the Favorites for the second user
		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel for the first user by deleting the preference
		_, resp = th.Client.UpdatePreferences(user.Id, &model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel.Id,
				Value:    "false",
			},
		})
		require.Nil(t, resp.Error)

		// The channel should still be in the second user's favorites
		categories, resp = client2.GetSidebarCategoriesForTeamForUser(user2.Id, team1.Id, "")
		require.Nil(t, resp.Error)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)
	})
}
