// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateCategoryForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should silently prevent the user from creating a category with an invalid channel ID", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		// Attempt to create the category
		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      user.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "test",
			},
			Channels: []string{th.BasicChannel.Id, "notachannel", th.BasicChannel2.Id},
		}

		received, _, err := client.CreateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, category)
		require.NoError(t, err)
		assert.NotContains(t, received.Channels, "notachannel")
		assert.Equal(t, []string{th.BasicChannel.Id, th.BasicChannel2.Id}, received.Channels)
	})

	t.Run("should silently prevent the user from creating a category with a channel that they're not a member of", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		// Have another user create a channel that user isn't a part of
		channel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "testchannel",
			DisplayName: "testchannel",
		})
		require.NoError(t, err)

		// Attempt to create the category
		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      user.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "test",
			},
			Channels: []string{th.BasicChannel.Id, channel.Id},
		}

		received, _, err := client.CreateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, category)
		require.NoError(t, err)
		assert.NotContains(t, received.Channels, channel.Id)
		assert.Equal(t, []string{th.BasicChannel.Id}, received.Channels)
	})

	t.Run("should return expected sort order value", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		customCategory, _, err := client.CreateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      user.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "custom123",
			},
		})
		require.NoError(t, err)

		// Initial new category sort order is 10 (first)
		require.Equal(t, int64(10), customCategory.SortOrder)
	})

	t.Run("should not crash with null input", func(t *testing.T) {
		require.NotPanics(t, func() {
			user, client := setupUserForSubtest(t, th)
			payload := []byte(`null`)
			route := fmt.Sprintf("/users/%s/teams/%s/channels/categories", user.Id, th.BasicTeam.Id)
			r, err := client.DoAPIPostBytes(context.Background(), route, payload)
			require.Error(t, err)
			closeBody(r)
		})
	})

	t.Run("should publish expected WS payload", func(t *testing.T) {
		userWSClient := th.CreateConnectedWebSocketClient(t)

		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "test",
			},
			Channels: []string{th.BasicChannel.Id, "notachannel", th.BasicChannel2.Id},
		}

		received, _, err := th.Client.CreateSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, category)
		require.NoError(t, err)

		testCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:      received.Id,
					UserId:  th.BasicUser.Id,
					TeamId:  th.BasicTeam.Id,
					Sorting: model.SidebarCategorySortRecent,
					Muted:   true,
				},
				Channels: []string{th.BasicChannel.Id},
			},
		}

		testCategories, _, err = th.Client.UpdateSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, testCategories)
		require.NoError(t, err)

		b, err := json.Marshal(testCategories)
		require.NoError(t, err)
		expected := string(b)

		var caught bool
		func() {
			for {
				select {
				case ev := <-userWSClient.EventChannel:
					if ev.EventType() == model.WebsocketEventSidebarCategoryUpdated {
						caught = true
						data := ev.GetData()

						updatedCategoriesData, ok := data["updatedCategories"]
						require.True(t, ok)
						require.EqualValues(t, expected, updatedCategoriesData)
					}
				case <-time.After(2 * time.Second):
					return
				}
			}
		}()

		require.Truef(t, caught, "User should have received %s event", model.WebsocketEventSidebarCategoryUpdated)
	})
}

func TestUpdateCategoryForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should update the channel order of the Channels category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		require.Len(t, channelsCategory.Channels, 5) // Town Square, Off Topic, and the 3 channels created by InitBasic

		// Should return the correct values from the API
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        []string{channelsCategory.Channels[1], channelsCategory.Channels[0], channelsCategory.Channels[4], channelsCategory.Channels[3], channelsCategory.Channels[2]},
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)

		// And when requesting the category later
		received, _, err = client.GetSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, "")
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)
	})

	t.Run("should update the sort order of the DM category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		dmsCategory := categories.Categories[2]
		require.Equal(t, model.SidebarCategoryDirectMessages, dmsCategory.Type)
		require.Equal(t, model.SidebarCategorySortRecent, dmsCategory.Sorting)

		// Should return the correct values from the API
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: dmsCategory.SidebarCategory,
			Channels:        dmsCategory.Channels,
		}
		updatedCategory.Sorting = model.SidebarCategorySortAlphabetical

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, dmsCategory.Id, updatedCategory)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.Equal(t, model.SidebarCategorySortAlphabetical, received.Sorting)

		// And when requesting the category later
		received, _, err = client.GetSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, dmsCategory.Id, "")
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.Equal(t, model.SidebarCategorySortAlphabetical, received.Sorting)
	})

	t.Run("should update the display name of a custom category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		customCategory, _, err := client.CreateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      user.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "custom123",
			},
		})
		require.NoError(t, err)
		require.Equal(t, "custom123", customCategory.DisplayName)

		// Should return the correct values from the API
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: customCategory.SidebarCategory,
			Channels:        customCategory.Channels,
		}
		updatedCategory.DisplayName = "abcCustom"

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, customCategory.Id, updatedCategory)
		assert.NoError(t, err)
		assert.Equal(t, customCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.DisplayName, received.DisplayName)

		// And when requesting the category later
		received, _, err = client.GetSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, customCategory.Id, "")
		assert.NoError(t, err)
		assert.Equal(t, customCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.DisplayName, received.DisplayName)
	})

	t.Run("should update the channel order of the category even if it contains archived channels", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		require.Len(t, channelsCategory.Channels, 5) // Town Square, Off Topic, and the 3 channels created by InitBasic

		// Delete one of the channels
		_, err = client.DeleteChannel(context.Background(), th.BasicChannel.Id)
		require.NoError(t, err)

		// Should still be able to reorder the channels
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        []string{channelsCategory.Channels[1], channelsCategory.Channels[0], channelsCategory.Channels[4], channelsCategory.Channels[3], channelsCategory.Channels[2]},
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)
	})

	t.Run("should silently prevent the user from adding an invalid channel ID", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, "notachannel"),
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.NotContains(t, received.Channels, "notachannel")
		assert.Equal(t, channelsCategory.Channels, received.Channels)
	})

	t.Run("should silently prevent the user from adding a channel that they're not a member of", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Have another user create a channel that user isn't a part of
		channel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "testchannel",
			DisplayName: "testchannel",
		})
		require.NoError(t, err)

		// Attempt to update the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, channel.Id),
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.NotContains(t, received.Channels, channel.Id)
		assert.Equal(t, channelsCategory.Channels, received.Channels)
	})

	t.Run("muting a category should mute all of its channels", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		require.True(t, len(channelsCategory.Channels) > 0)

		// Mute the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				Id:      channelsCategory.Id,
				UserId:  user.Id,
				TeamId:  th.BasicTeam.Id,
				Sorting: channelsCategory.Sorting,
				Muted:   true,
			},
			Channels: channelsCategory.Channels,
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.True(t, received.Muted)

		// Check that the muted category was saved in the database
		received, _, err = client.GetSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, channelsCategory.Id, "")
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.True(t, received.Muted)

		// Confirm that the channels in the category were muted
		member, _, err := client.GetChannelMember(context.Background(), channelsCategory.Channels[0], user.Id, "")
		require.NoError(t, err)
		assert.True(t, member.IsChannelMuted())
	})

	t.Run("should not be able to mute DM category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		dmsCategory := categories.Categories[2]
		require.Equal(t, model.SidebarCategoryDirectMessages, dmsCategory.Type)
		require.Len(t, dmsCategory.Channels, 0)

		// Ensure a DM channel exists
		dmChannel, _, err := client.CreateDirectChannel(context.Background(), user.Id, th.BasicUser.Id)
		require.NoError(t, err)

		// Attempt to mute the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				Id:      dmsCategory.Id,
				UserId:  user.Id,
				TeamId:  th.BasicTeam.Id,
				Sorting: dmsCategory.Sorting,
				Muted:   true,
			},
			Channels: []string{dmChannel.Id},
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, dmsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.False(t, received.Muted)

		// Check that the muted category was not saved in the database
		received, _, err = client.GetSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, dmsCategory.Id, "")
		require.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.False(t, received.Muted)

		// Confirm that the channels in the category were not muted
		member, _, err := client.GetChannelMember(context.Background(), dmChannel.Id, user.Id, "")
		require.NoError(t, err)
		assert.False(t, member.IsChannelMuted())
	})

	t.Run("should not crash with null input", func(t *testing.T) {
		require.NotPanics(t, func() {
			user, client := setupUserForSubtest(t, th)

			categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
			require.NoError(t, err)
			require.Len(t, categories.Categories, 3)
			require.Len(t, categories.Order, 3)

			dmsCategory := categories.Categories[2]

			payload := []byte(`null`)
			route := fmt.Sprintf("/users/%s/teams/%s/channels/categories/%s", user.Id, th.BasicTeam.Id, dmsCategory.Id)
			r, err := client.DoAPIPutBytes(context.Background(), route, payload)
			require.Error(t, err)
			closeBody(r)
		})
	})
}

func TestUpdateCategoriesForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should silently prevent the user from adding an invalid channel ID", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, "notachannel"),
		}

		received, _, err := client.UpdateSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{updatedCategory})
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received[0].Id)
		assert.NotContains(t, received[0].Channels, "notachannel")
		assert.Equal(t, channelsCategory.Channels, received[0].Channels)
	})

	t.Run("should silently prevent the user from adding a channel that they're not a member of", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Have another user create a channel that user isn't a part of
		channel, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "testchannel",
			DisplayName: "testchannel",
		})
		require.NoError(t, err)

		// Attempt to update the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, channel.Id),
		}

		received, _, err := client.UpdateSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{updatedCategory})
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received[0].Id)
		assert.NotContains(t, received[0].Channels, channel.Id)
		assert.Equal(t, channelsCategory.Channels, received[0].Channels)
	})

	t.Run("should update order", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		_, _, err = client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, []string{categories.Order[1], categories.Order[0], categories.Order[2]})
		require.NoError(t, err)

		categories, _, err = client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory = categories.Categories[0]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// validate order
		newOrder, _, err := client.GetSidebarCategoryOrderForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.EqualValues(t, newOrder, categories.Order)

		// try to update with missing category
		_, _, err = client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, []string{categories.Order[1], categories.Order[0]})
		require.Error(t, err)

		// try to update with invalid category
		_, _, err = client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, []string{categories.Order[1], categories.Order[0], "asd"})
		require.Error(t, err)
	})
}

func TestGetCategoriesForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should return categories when user has permission", func(t *testing.T) {
		// Get categories for the basic user
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotNil(t, categories)
		require.Len(t, categories.Categories, 3) // Default categories: Channels, Favorites, Direct Messages
		require.Len(t, categories.Order, 3)
	})

	t.Run("should return error when user doesn't have permission", func(t *testing.T) {
		// Create a new user that's not on the team
		user, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:    th.GenerateTestEmail(),
			Username: "user_" + model.NewId(),
			Password: "password",
		})
		require.Nil(t, appErr)

		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), user.Email, "password")
		require.NoError(t, err)

		// Attempt to get categories for the basic user
		_, resp, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return error with invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), "invalid_user_id", th.BasicTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, "invalid_team_id", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error when user is not logged in", func(t *testing.T) {
		client := th.CreateClient()
		_, resp, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

func TestGetCategoryOrderForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should return category order when user has permission", func(t *testing.T) {
		// Get categories first to ensure order exists
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotNil(t, categories)
		require.Len(t, categories.Order, 3) // Default categories: Channels, Favorites, Direct Messages

		// Get order
		order, _, err := th.Client.GetSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotNil(t, order)
		require.Len(t, order, 3)
		require.ElementsMatch(t, categories.Order, order)
	})

	t.Run("should return error when user doesn't have permission", func(t *testing.T) {
		// Create a new user that's not on the team
		user, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:    th.GenerateTestEmail(),
			Username: "user_" + model.NewId(),
			Password: "password",
		})
		require.Nil(t, appErr)

		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), user.Email, "password")
		require.NoError(t, err)

		// Attempt to get order for the basic user
		_, resp, err := client.GetSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return error with invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetSidebarCategoryOrderForTeamForUser(context.Background(), "invalid_user_id", th.BasicTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, "invalid_team_id", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error when user is not logged in", func(t *testing.T) {
		client := th.CreateClient()
		_, resp, err := client.GetSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

func TestUpdateCategoryOrderForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should update order", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Update order
		newOrder := []string{categories.Order[1], categories.Order[0], categories.Order[2]}
		updatedOrder, _, err := client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, newOrder)
		require.NoError(t, err)
		require.EqualValues(t, newOrder, updatedOrder)

		// Verify order was updated
		categories, _, err = client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)
		require.EqualValues(t, newOrder, categories.Order)
	})

	t.Run("should return error when user doesn't have permission", func(t *testing.T) {
		// Create a new user that's not on the team
		user, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:    th.GenerateTestEmail(),
			Username: "user_" + model.NewId(),
			Password: "password",
		})
		require.Nil(t, appErr)

		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), user.Email, "password")
		require.NoError(t, err)

		// Get categories for basic user to try to update
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		// Attempt to update order for the basic user
		newOrder := []string{categories.Order[1], categories.Order[0], categories.Order[2]}
		_, resp, err := client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, newOrder)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return error with invalid category id", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		// Try to update with an invalid category ID
		newOrder := []string{categories.Order[0], "invalid_category_id", categories.Order[2]}
		_, resp, err := th.Client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, newOrder)
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return error with missing category", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		// Try to update with a missing category
		newOrder := []string{categories.Order[1], categories.Order[0]} // Missing one category
		_, resp, err := th.Client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, newOrder)
		require.Error(t, err)
		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("should return error with invalid user id", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		newOrder := []string{categories.Order[1], categories.Order[0], categories.Order[2]}
		_, resp, err := th.Client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), "invalid_user_id", th.BasicTeam.Id, newOrder)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid team id", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		newOrder := []string{categories.Order[1], categories.Order[0], categories.Order[2]}
		_, resp, err := th.Client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, "invalid_team_id", newOrder)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error when user is not logged in", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		client := th.CreateClient()
		newOrder := []string{categories.Order[1], categories.Order[0], categories.Order[2]}
		_, resp, err := client.UpdateSidebarCategoryOrderForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, newOrder)
		require.Error(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("should not crash with null input", func(t *testing.T) {
		require.NotPanics(t, func() {
			user, client := setupUserForSubtest(t, th)
			payload := []byte(`null`)
			route := fmt.Sprintf("/users/%s/teams/%s/channels/categories/order", user.Id, th.BasicTeam.Id)
			r, err := client.DoAPIPutBytes(context.Background(), route, payload)
			require.Error(t, err)
			closeBody(r)
		})
	})
}

func TestGetCategoryForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should return category when user has permission", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		// Get categories first to get a valid category ID
		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		// Get specific category
		category := categories.Categories[0]
		received, _, err := client.GetSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, category.Id, "")
		require.NoError(t, err)
		require.NotNil(t, received)
		require.Equal(t, category.Id, received.Id)
		require.Equal(t, category.DisplayName, received.DisplayName)
		require.Equal(t, category.Type, received.Type)
	})

	t.Run("should return error when user doesn't have permission", func(t *testing.T) {
		// Create a new user that's not on the team
		user, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:    th.GenerateTestEmail(),
			Username: "user_" + model.NewId(),
			Password: "password",
		})
		require.Nil(t, appErr)

		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), user.Email, "password")
		require.NoError(t, err)

		// Get categories for basic user to get a valid category ID
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		// Attempt to get category for the basic user
		_, resp, err := client.GetSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, categories.Categories[0].Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return error with invalid user id", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		_, resp, err := th.Client.GetSidebarCategoryForTeamForUser(context.Background(), "invalid_user_id", th.BasicTeam.Id, categories.Categories[0].Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid team id", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		_, resp, err := th.Client.GetSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, "invalid_team_id", categories.Categories[0].Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid category id", func(t *testing.T) {
		_, resp, err := th.Client.GetSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "invalid_category_id", "")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return error when user is not logged in", func(t *testing.T) {
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		client := th.CreateClient()
		_, resp, err := client.GetSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, categories.Categories[0].Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("should not crash with null input", func(t *testing.T) {
		require.NotPanics(t, func() {
			user, client := setupUserForSubtest(t, th)
			categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
			require.NoError(t, err)
			require.NotEmpty(t, categories.Categories)

			route := fmt.Sprintf("/users/%s/teams/%s/channels/categories/%s", user.Id, th.BasicTeam.Id, categories.Categories[0].Id)
			r, err := client.DoAPIGet(context.Background(), route, "")
			require.NoError(t, err)
			closeBody(r)
		})
	})
}

func TestValidateSidebarCategory(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create a test context with logger once for all subtests
	c := &Context{
		App:        th.App,
		AppContext: th.Context,
		Logger:     th.App.Log(),
	}

	t.Run("should validate category with valid channels", func(t *testing.T) {
		user, _ := setupUserForSubtest(t, th)

		// Create a category with channels the user is a member of
		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: user.Id,
				TeamId: th.BasicTeam.Id,
			},
			Channels: []string{th.BasicChannel.Id, th.BasicChannel2.Id},
		}

		err := validateSidebarCategory(c, th.BasicTeam.Id, user.Id, category)
		require.Nil(t, err)
		require.Len(t, category.Channels, 2)
		require.Contains(t, category.Channels, th.BasicChannel.Id)
		require.Contains(t, category.Channels, th.BasicChannel2.Id)
	})

	t.Run("should filter out invalid channel IDs", func(t *testing.T) {
		user, _ := setupUserForSubtest(t, th)

		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: user.Id,
				TeamId: th.BasicTeam.Id,
			},
			Channels: []string{th.BasicChannel.Id, "invalid_channel_id"},
		}

		err := validateSidebarCategory(c, th.BasicTeam.Id, user.Id, category)
		require.Nil(t, err)
		require.Len(t, category.Channels, 1)
		require.Contains(t, category.Channels, th.BasicChannel.Id)
		require.NotContains(t, category.Channels, "invalid_channel_id")
	})

	t.Run("should filter out channels user is not a member of", func(t *testing.T) {
		user, _ := setupUserForSubtest(t, th)

		// Create a channel that the user is not a member of
		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "testchannel",
			DisplayName: "Test Channel",
		}, false)
		require.Nil(t, appErr)

		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: user.Id,
				TeamId: th.BasicTeam.Id,
			},
			Channels: []string{th.BasicChannel.Id, channel.Id},
		}

		err := validateSidebarCategory(c, th.BasicTeam.Id, user.Id, category)
		require.Nil(t, err)
		require.Len(t, category.Channels, 1)
		require.Contains(t, category.Channels, th.BasicChannel.Id)
		require.NotContains(t, category.Channels, channel.Id)
	})

	t.Run("should return error with invalid team id", func(t *testing.T) {
		user, _ := setupUserForSubtest(t, th)

		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: user.Id,
				TeamId: "invalid_team_id",
			},
			Channels: []string{th.BasicChannel.Id},
		}

		err := validateSidebarCategory(c, "invalid_team_id", user.Id, category)
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("should return error with invalid user id", func(t *testing.T) {
		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: "invalid_user_id",
				TeamId: th.BasicTeam.Id,
			},
			Channels: []string{th.BasicChannel.Id},
		}

		err := validateSidebarCategory(c, th.BasicTeam.Id, "invalid_user_id", category)
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("should handle empty channel list", func(t *testing.T) {
		user, _ := setupUserForSubtest(t, th)

		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: user.Id,
				TeamId: th.BasicTeam.Id,
			},
			Channels: []string{},
		}

		err := validateSidebarCategory(c, th.BasicTeam.Id, user.Id, category)
		require.Nil(t, err)
		require.Empty(t, category.Channels)
	})
}

func TestValidateSidebarCategoryChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create a test context with logger once for all subtests
	c := &Context{
		App:        th.App,
		AppContext: th.Context,
		Logger:     th.App.Log(),
	}

	t.Run("should filter valid channels", func(t *testing.T) {
		// Create test channels
		channels := model.ChannelList{
			th.BasicChannel,
			th.BasicChannel2,
		}

		// Test with valid channel IDs
		channelIds := []string{
			th.BasicChannel.Id,
			th.BasicChannel2.Id,
		}

		filtered := validateSidebarCategoryChannels(c, th.BasicUser.Id, channelIds, channels)
		require.Len(t, filtered, 2)
		require.ElementsMatch(t, channelIds, filtered)
	})

	t.Run("should filter out invalid channels", func(t *testing.T) {
		channels := model.ChannelList{
			th.BasicChannel,
		}

		channelIds := []string{
			th.BasicChannel.Id,
			"invalid_channel_id",
		}

		filtered := validateSidebarCategoryChannels(c, th.BasicUser.Id, channelIds, channels)
		require.Len(t, filtered, 1)
		require.Contains(t, filtered, th.BasicChannel.Id)
		require.NotContains(t, filtered, "invalid_channel_id")
	})

	t.Run("should handle empty channel list", func(t *testing.T) {
		channels := model.ChannelList{}
		channelIds := []string{th.BasicChannel.Id}

		filtered := validateSidebarCategoryChannels(c, th.BasicUser.Id, channelIds, channels)
		require.Empty(t, filtered)
	})

	t.Run("should handle empty channelIds", func(t *testing.T) {
		channels := model.ChannelList{
			th.BasicChannel,
			th.BasicChannel2,
		}

		filtered := validateSidebarCategoryChannels(c, th.BasicUser.Id, []string{}, channels)
		require.Empty(t, filtered)
	})

	t.Run("should handle nil inputs", func(t *testing.T) {
		filtered := validateSidebarCategoryChannels(c, th.BasicUser.Id, nil, nil)
		require.Empty(t, filtered)
	})

	t.Run("should preserve duplicate channel IDs", func(t *testing.T) {
		channels := model.ChannelList{
			th.BasicChannel,
		}

		// Include duplicate channel IDs
		channelIds := []string{
			th.BasicChannel.Id,
			th.BasicChannel.Id,
		}

		filtered := validateSidebarCategoryChannels(c, th.BasicUser.Id, channelIds, channels)
		require.Len(t, filtered, 2) // Function preserves duplicates as per implementation
		require.Equal(t, []string{th.BasicChannel.Id, th.BasicChannel.Id}, filtered)
	})
}

func TestDeleteCategoryForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	t.Run("should move channels to default categories when custom category is deleted", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		// Create a custom category with different types of channels
		customCategory, _, err := client.CreateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      user.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "Custom Category",
				Type:        model.SidebarCategoryCustom,
			},
			// Add public, private channels and DM
			Channels: []string{th.BasicChannel.Id, th.BasicPrivateChannel.Id},
		})
		require.NoError(t, err)
		require.NotNil(t, customCategory)

		// Create a DM channel
		dmChannel, _, err := client.CreateDirectChannel(context.Background(), user.Id, th.BasicUser2.Id)
		require.NoError(t, err)

		// Add DM to custom category
		customCategory.Channels = append(customCategory.Channels, dmChannel.Id)
		updatedCategory, _, err := client.UpdateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, customCategory.Id, customCategory)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{th.BasicChannel.Id, th.BasicPrivateChannel.Id, dmChannel.Id}, updatedCategory.Channels)

		// Delete the custom category
		resp, err := client.DeleteSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, customCategory.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Get all categories to verify channel redistribution
		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)

		// Find default categories
		var channelsCategory, dmsCategory *model.SidebarCategoryWithChannels
		for _, cat := range categories.Categories {
			switch cat.Type {
			case model.SidebarCategoryChannels:
				channelsCategory = cat
			case model.SidebarCategoryDirectMessages:
				dmsCategory = cat
			}
		}

		require.NotNil(t, channelsCategory, "Channels category should exist")
		require.NotNil(t, dmsCategory, "DMs category should exist")

		// Verify public and private channels moved to channels category
		require.Contains(t, channelsCategory.Channels, th.BasicChannel.Id, "Public channel should be in channels category")
		require.Contains(t, channelsCategory.Channels, th.BasicPrivateChannel.Id, "Private channel should be in channels category")

		// Verify DM moved to DMs category
		require.Contains(t, dmsCategory.Channels, dmChannel.Id, "DM should be in direct messages category")
	})

	t.Run("should delete category when user has permission", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		// Create a new custom category to delete (don't delete default categories)
		category, _, err := client.CreateSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      user.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "Custom Category",
				Type:        model.SidebarCategoryCustom,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, category)

		// Delete the category
		resp, err := client.DeleteSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, category.Id)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Verify category was deleted
		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		for _, cat := range categories.Categories {
			require.NotEqual(t, category.Id, cat.Id)
		}
	})

	t.Run("should return error when user doesn't have permission", func(t *testing.T) {
		// Create a new user that's not on the team
		user, appErr := th.App.CreateUser(th.Context, &model.User{
			Email:    th.GenerateTestEmail(),
			Username: "user_" + model.NewId(),
			Password: "password",
		})
		require.Nil(t, appErr)

		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), user.Email, "password")
		require.NoError(t, err)

		// Get categories for basic user to get a valid category ID
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		// Attempt to delete category for the basic user
		resp, err := client.DeleteSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, categories.Categories[0].Id)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("should return error with invalid user id", func(t *testing.T) {
		// Get a valid category ID first
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		resp, err := th.Client.DeleteSidebarCategoryForTeamForUser(context.Background(), "invalid_user_id", th.BasicTeam.Id, categories.Categories[0].Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid team id", func(t *testing.T) {
		// Get a valid category ID first
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		resp, err := th.Client.DeleteSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, "invalid_team_id", categories.Categories[0].Id)
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return error with invalid category id", func(t *testing.T) {
		resp, err := th.Client.DeleteSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "invalid_category_id")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return error when user is not logged in", func(t *testing.T) {
		// Get a valid category ID first
		categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		client := th.CreateClient()
		resp, err := client.DeleteSidebarCategoryForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, categories.Categories[0].Id)
		require.Error(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("should not allow deletion of default categories", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, categories.Categories)

		// Try to delete each default category
		for _, category := range categories.Categories {
			if category.Type != model.SidebarCategoryCustom {
				resp, err := client.DeleteSidebarCategoryForTeamForUser(context.Background(), user.Id, th.BasicTeam.Id, category.Id)
				require.Error(t, err)
				require.Equal(t, http.StatusBadRequest, resp.StatusCode)
			}
		}
	})
}

func setupUserForSubtest(t *testing.T, th *TestHelper) (*model.User, *model.Client4) {
	password := "password"
	user, appErr := th.App.CreateUser(th.Context, &model.User{
		Email:    th.GenerateTestEmail(),
		Username: "user_" + model.NewId(),
		Password: password,
	})
	require.Nil(t, appErr)

	th.LinkUserToTeam(user, th.BasicTeam)
	th.AddUserToChannel(user, th.BasicChannel)
	th.AddUserToChannel(user, th.BasicChannel2)
	th.AddUserToChannel(user, th.BasicPrivateChannel)

	client := th.CreateClient()
	user, _, err := client.Login(context.Background(), user.Email, password)
	require.NoError(t, err)

	return user, client
}
