// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetPreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

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

	_, err := client.UpdatePreferences(context.Background(), user1.Id, preferences1)
	require.NoError(t, err)

	prefs, _, err := client.GetPreferences(context.Background(), user1.Id)
	require.NoError(t, err)

	// 6 because we have 3 initial preferences tutorial_step, recommended_next_steps and system_notification are added when creating a new user
	require.Equal(t, len(prefs), 6, "received the wrong number of preferences")

	for _, preference := range prefs {
		require.Equal(t, preference.UserId, th.BasicUser.Id, "user id does not match")
	}

	// recreate basic user2
	th.BasicUser2 = th.CreateUser()
	th.LoginBasic2()

	prefs, _, err = client.GetPreferences(context.Background(), th.BasicUser2.Id)
	require.NoError(t, err)

	require.Greater(t, len(prefs), 0, "received the wrong number of preferences")

	_, resp, err := client.GetPreferences(context.Background(), th.BasicUser.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPreferences(context.Background(), th.BasicUser2.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// GetPreferences API from System Admin and Local Client
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		prefs, resp, err := c.GetPreferences(context.Background(), user1.Id)
		require.NotNil(t, prefs)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestGetPreferencesByCategory(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

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

	_, err := client.UpdatePreferences(context.Background(), user1.Id, preferences1)
	require.NoError(t, err)

	prefs, _, err := client.GetPreferencesByCategory(context.Background(), user1.Id, category)
	require.NoError(t, err)

	require.Equal(t, len(prefs), 2, "received the wrong number of preferences")

	_, resp, err := client.GetPreferencesByCategory(context.Background(), user1.Id, "junk")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	th.LoginBasic2()

	_, resp, err = client.GetPreferencesByCategory(context.Background(), th.BasicUser2.Id, category)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetPreferencesByCategory(context.Background(), user1.Id, category)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	prefs, resp, err = client.GetPreferencesByCategory(context.Background(), th.BasicUser2.Id, "junk")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	require.Equal(t, len(prefs), 0, "received the wrong number of preferences")

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPreferencesByCategory(context.Background(), th.BasicUser2.Id, category)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// GetPreferencesByCategory API from System Admin and Local Client
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		prefs, resp, err := c.GetPreferencesByCategory(context.Background(), user1.Id, category)
		require.NotNil(t, prefs)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestGetPreferenceByCategoryAndName(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.LoginBasic()
	user := th.BasicUser
	name := model.NewId()
	value := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   user.Id,
			Category: model.PreferenceCategoryDirectChannelShow,
			Name:     name,
			Value:    value,
		},
		{
			UserId:   user.Id,
			Category: model.PreferenceCategoryDirectChannelShow,
			Name:     model.NewId(),
			Value:    model.NewId(),
		},
	}

	_, err := client.UpdatePreferences(context.Background(), user.Id, preferences)
	require.NoError(t, err)

	pref, _, err := client.GetPreferenceByCategoryAndName(context.Background(), user.Id, model.PreferenceCategoryDirectChannelShow, name)
	require.NoError(t, err)

	require.Equal(t, preferences[0].UserId, pref.UserId, "UserId preference not saved")
	require.Equal(t, preferences[0].Category, pref.Category, "Category preference not saved")
	require.Equal(t, preferences[0].Name, pref.Name, "Name preference not saved")

	preferences[0].Value = model.NewId()
	_, err = client.UpdatePreferences(context.Background(), user.Id, preferences)
	require.NoError(t, err)

	_, resp, err := client.GetPreferenceByCategoryAndName(context.Background(), user.Id, "junk", preferences[0].Name)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetPreferenceByCategoryAndName(context.Background(), user.Id, preferences[0].Category, "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetPreferenceByCategoryAndName(context.Background(), th.BasicUser2.Id, preferences[0].Category, "junk")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = client.GetPreferenceByCategoryAndName(context.Background(), user.Id, preferences[0].Category, preferences[0].Name)
	require.NoError(t, err)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetPreferenceByCategoryAndName(context.Background(), user.Id, preferences[0].Category, preferences[0].Name)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// GetPreferenceByCategoryAndName API from System Admin and Local Client
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		pref, resp, err := c.GetPreferenceByCategoryAndName(context.Background(), user.Id, preferences[0].Category, preferences[0].Name)
		require.NotNil(t, pref)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestUpdatePreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

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

	_, err := client.UpdatePreferences(context.Background(), user1.Id, preferences1)
	require.NoError(t, err)

	preferences := model.Preferences{
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     model.NewId(),
		},
	}

	resp, err := client.UpdatePreferences(context.Background(), user1.Id, preferences)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	preferences = model.Preferences{
		{
			UserId: user1.Id,
			Name:   model.NewId(),
		},
	}

	resp, err = client.UpdatePreferences(context.Background(), user1.Id, preferences)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	resp, err = client.UpdatePreferences(context.Background(), th.BasicUser2.Id, preferences)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.UpdatePreferences(context.Background(), user1.Id, preferences1)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// UpdatePreferences API from System Admin and Local Client
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		preferences := model.Preferences{
			{
				UserId:   user1.Id,
				Category: category,
				Name:     model.NewId(),
				Value:    "true",
			},
		}
		resp, err := c.UpdatePreferences(context.Background(), user1.Id, preferences)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestUpdatePreferencesOverload(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.LoginBasic()
	user1 := th.BasicUser

	t.Run("No preferences", func(t *testing.T) {
		preferences1 := model.Preferences{}
		// should error if no preferences
		resp, err := client.UpdatePreferences(context.Background(), user1.Id, preferences1)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Too many preferences", func(t *testing.T) {
		preferences1 := model.Preferences{}
		category := model.NewId()
		// should error if too many preferences
		for i := 0; i <= 100; i++ {
			preferences1 = append(preferences1, model.Preference{
				UserId:   user1.Id,
				Category: category,
				Name:     model.NewId(),
				Value:    model.NewId(),
			})
		}
		resp, err := client.UpdatePreferences(context.Background(), user1.Id, preferences1)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})
}

func TestUpdatePreferencesWebsocket(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	WebSocketClient := th.CreateConnectedWebSocketClient(t)

	userId := th.BasicUser.Id
	preferences := model.Preferences{
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

	_, err := th.Client.UpdatePreferences(context.Background(), userId, preferences)
	require.NoError(t, err)

	timeout := time.After(300 * time.Millisecond)

	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() != model.WebsocketEventPreferencesChanged {
				// Ignore any other events
				continue
			}

			var received model.Preferences
			jsonErr := json.Unmarshal([]byte(event.GetData()["preferences"].(string)), &received)
			require.NoError(t, jsonErr)

			for i, p := range preferences {
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

		_, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, team1.Id)
		th.AddUserToChannel(user, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Confirm that the channel was added to the Favorites
		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "false",
			},
		})
		require.NoError(t, err)

		// The channel should've been removed from the Favorites
		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
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
		_, err := th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     dmChannel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Confirm that the channel was added to the Favorites on all teams
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team2.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		// And unfavorite the channel
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     dmChannel.Id,
				Value:    "false",
			},
		})
		require.NoError(t, err)

		// The channel should've been removed from the Favorites on all teams
		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Contains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team2.Id, "")
		require.NoError(t, err)
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

		_, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		_, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, team1.Id)
		th.AddUserToChannel(user, channel)
		th.AddUserToChannel(user2, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Confirm that the channel was not added to Favorites for the second user
		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel for the second user
		_, err = client2.UpdatePreferences(context.Background(), user2.Id, model.Preferences{
			{
				UserId:   user2.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Confirm that the channel is now in the Favorites for the second user
		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "false",
			},
		})
		require.NoError(t, err)

		// The channel should still be in the second user's favorites
		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)
	})
}

func TestDeletePreferences(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.LoginBasic()

	prefs, _, _ := client.GetPreferences(context.Background(), th.BasicUser.Id)
	originalCount := len(prefs)

	// save 10 preferences
	var preferences model.Preferences
	for i := 0; i < 10; i++ {
		preference := model.Preference{
			UserId:   th.BasicUser.Id,
			Category: model.PreferenceCategoryDirectChannelShow,
			Name:     model.NewId(),
		}
		preferences = append(preferences, preference)
	}

	_, err := client.UpdatePreferences(context.Background(), th.BasicUser.Id, preferences)
	require.NoError(t, err)

	// delete 10 preferences
	th.LoginBasic2()

	resp, err := client.DeletePreferences(context.Background(), th.BasicUser2.Id, preferences)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	_, err = client.DeletePreferences(context.Background(), th.BasicUser.Id, preferences)
	require.NoError(t, err)

	resp, err = client.DeletePreferences(context.Background(), th.BasicUser2.Id, preferences)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	prefs, _, _ = client.GetPreferences(context.Background(), th.BasicUser.Id)
	require.Len(t, prefs, originalCount, "should've deleted preferences")

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.DeletePreferences(context.Background(), th.BasicUser.Id, preferences)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// DeletePreferences API from System Admin and Local Client
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		// Creating Test Data
		var preferences model.Preferences
		preference := model.Preference{
			UserId:   th.BasicUser.Id,
			Category: model.PreferenceCategoryCustomStatus,
			Name:     model.NewId(),
			Value:    "true",
		}
		preferences = append(preferences, preference)
		_, err = c.UpdatePreferences(context.Background(), th.BasicUser.Id, preferences)
		require.NoError(t, err)

		// Delete Prefrerences Operation
		resp, err = c.DeletePreferences(context.Background(), th.BasicUser.Id, preferences)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestDeletePreferencesOverload(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.LoginBasic()
	user1 := th.BasicUser

	t.Run("No preferences", func(t *testing.T) {
		preferences1 := model.Preferences{}
		// should error if no preferences
		resp, err := client.DeletePreferences(context.Background(), user1.Id, preferences1)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Too many preferences", func(t *testing.T) {
		category := model.NewId()
		preferences1 := model.Preferences{}
		// should error if too many preferences
		for i := 0; i <= 100; i++ {
			preferences1 = append(preferences1, model.Preference{
				UserId:   user1.Id,
				Category: category,
				Name:     model.NewId(),
				Value:    model.NewId(),
			})
		}
		resp, err := client.DeletePreferences(context.Background(), user1.Id, preferences1)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.invalid_body_param.app_error")
		CheckBadRequestStatus(t, resp)
	})
}

func TestDeletePreferencesWebsocket(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	userId := th.BasicUser.Id
	preferences := model.Preferences{
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
	_, err := th.Client.UpdatePreferences(context.Background(), userId, preferences)
	require.NoError(t, err)

	WebSocketClient := th.CreateConnectedWebSocketClient(t)

	_, err = th.Client.DeletePreferences(context.Background(), userId, preferences)
	require.NoError(t, err)

	timeout := time.After(30000 * time.Millisecond)

	waiting := true
	for waiting {
		select {
		case event := <-WebSocketClient.EventChannel:
			if event.EventType() != model.WebsocketEventPreferencesDeleted {
				// Ignore any other events
				continue
			}

			var received model.Preferences
			jsonErr := json.Unmarshal([]byte(event.GetData()["preferences"].(string)), &received)
			require.NoError(t, jsonErr)

			for i, preference := range preferences {
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

		_, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, team1.Id)
		th.AddUserToChannel(user, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)
		// Confirm that the channel was added to the Favorites
		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel by deleting the preference
		_, err = th.Client.DeletePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
			},
		})
		require.NoError(t, err)

		// The channel should've been removed from the Favorites
		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
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
		_, err := th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     dmChannel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Confirm that the channel was added to the Favorites on all teams
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team2.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.NotContains(t, categories.Categories[2].Channels, dmChannel.Id)

		// And unfavorite the channel by deleting the preference
		_, err = th.Client.DeletePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     dmChannel.Id,
			},
		})
		require.NoError(t, err)

		// The channel should've been removed from the Favorites on all teams
		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, dmChannel.Id)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Contains(t, categories.Categories[2].Channels, dmChannel.Id)

		categories, _, err = th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team2.Id, "")
		require.NoError(t, err)
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

		_, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		_, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)

		channel := th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, team1.Id)
		th.AddUserToChannel(user, channel)
		th.AddUserToChannel(user2, channel)

		// Confirm that the sidebar is populated correctly to begin with
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		require.NotContains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		require.Contains(t, categories.Categories[1].Channels, channel.Id)

		// Favorite the channel for both users
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		_, err = client2.UpdatePreferences(context.Background(), user2.Id, model.Preferences{
			{
				UserId:   user2.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Confirm that the channel is in the Favorites for the second user
		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)

		// And unfavorite the channel for the first user by deleting the preference
		_, err = th.Client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel.Id,
				Value:    "false",
			},
		})
		require.NoError(t, err)

		// The channel should still be in the second user's favorites
		categories, _, err = client2.GetSidebarCategoriesForTeamForUser(context.Background(), user2.Id, team1.Id, "")
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Contains(t, categories.Categories[0].Channels, channel.Id)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.NotContains(t, categories.Categories[1].Channels, channel.Id)
	})
}

func TestUpdateLimitVisibleDMsGMs(t *testing.T) {
	t.Run("Update limit_visible_dms_gms to a valid value", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		client := th.Client

		th.LoginBasic()
		user := th.BasicUser

		_, err := client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategorySidebarSettings,
				Name:     model.PreferenceLimitVisibleDmsGms,
				Value:    "40",
			},
		})
		require.NoError(t, err)

		pref, _, err := client.GetPreferenceByCategoryAndName(context.Background(), user.Id, model.PreferenceCategorySidebarSettings, model.PreferenceLimitVisibleDmsGms)
		require.NoError(t, err)

		require.Equal(t, "40", pref.Value, "Value was not updated")
	})

	t.Run("Update limit_visible_dms_gms to a value greater PreferenceMaxLimitVisibleDmsGmsValue", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		client := th.Client

		th.LoginBasic()
		user := th.BasicUser

		resp, err := client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategorySidebarSettings,
				Name:     model.PreferenceLimitVisibleDmsGms,
				Value:    "10000",
			},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Update limit_visible_dms_gms to an invalid value", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		client := th.Client

		th.LoginBasic()
		user := th.BasicUser

		resp, err := client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategorySidebarSettings,
				Name:     model.PreferenceLimitVisibleDmsGms,
				Value:    "one thousand",
			},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Update limit_visible_dms_gms to a negative number", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()
		client := th.Client

		th.LoginBasic()
		user := th.BasicUser

		resp, err := client.UpdatePreferences(context.Background(), user.Id, model.Preferences{
			{
				UserId:   user.Id,
				Category: model.PreferenceCategorySidebarSettings,
				Name:     model.PreferenceLimitVisibleDmsGms,
				Value:    "-20",
			},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}
