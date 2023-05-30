// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func TestCreateCategoryForTeamForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should silently prevent the user from creating a category with an invalid channel ID", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
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

		received, _, err := client.CreateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, category)
		require.NoError(t, err)
		assert.NotContains(t, received.Channels, "notachannel")
		assert.Equal(t, []string{th.BasicChannel.Id, th.BasicChannel2.Id}, received.Channels)
	})

	t.Run("should silently prevent the user from creating a category with a channel that they're not a member of", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		// Have another user create a channel that user isn't a part of
		channel, _, err := th.SystemAdminClient.CreateChannel(&model.Channel{
			TeamId: th.BasicTeam.Id,
			Type:   model.ChannelTypeOpen,
			Name:   "testchannel",
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

		received, _, err := client.CreateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, category)
		require.NoError(t, err)
		assert.NotContains(t, received.Channels, channel.Id)
		assert.Equal(t, []string{th.BasicChannel.Id}, received.Channels)
	})

	t.Run("should return expected sort order value", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		customCategory, _, err := client.CreateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
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
			r, err := client.DoAPIPostBytes(route, payload)
			require.Error(t, err)
			closeBody(r)
		})
	})

	t.Run("should publish expected WS payload", func(t *testing.T) {
		t.Skip("MM-42652")
		userWSClient, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer userWSClient.Close()
		userWSClient.Listen()

		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "test",
			},
			Channels: []string{th.BasicChannel.Id, "notachannel", th.BasicChannel2.Id},
		}

		received, _, err := th.Client.CreateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, category)
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

		testCategories, _, err = th.Client.UpdateSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, testCategories)
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
				case <-time.After(1 * time.Second):
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

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
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

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)

		// And when requesting the category later
		received, _, err = client.GetSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, "")
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)
	})

	t.Run("should update the sort order of the DM category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
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

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, dmsCategory.Id, updatedCategory)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.Equal(t, model.SidebarCategorySortAlphabetical, received.Sorting)

		// And when requesting the category later
		received, _, err = client.GetSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, dmsCategory.Id, "")
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.Equal(t, model.SidebarCategorySortAlphabetical, received.Sorting)
	})

	t.Run("should update the display name of a custom category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		customCategory, _, err := client.CreateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
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

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, customCategory.Id, updatedCategory)
		assert.NoError(t, err)
		assert.Equal(t, customCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.DisplayName, received.DisplayName)

		// And when requesting the category later
		received, _, err = client.GetSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, customCategory.Id, "")
		assert.NoError(t, err)
		assert.Equal(t, customCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.DisplayName, received.DisplayName)
	})

	t.Run("should update the channel order of the category even if it contains archived channels", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		require.Len(t, channelsCategory.Channels, 5) // Town Square, Off Topic, and the 3 channels created by InitBasic

		// Delete one of the channels
		_, err = client.DeleteChannel(th.BasicChannel.Id)
		require.NoError(t, err)

		// Should still be able to reorder the channels
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        []string{channelsCategory.Channels[1], channelsCategory.Channels[0], channelsCategory.Channels[4], channelsCategory.Channels[3], channelsCategory.Channels[2]},
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)
	})

	t.Run("should silently prevent the user from adding an invalid channel ID", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, "notachannel"),
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.NotContains(t, received.Channels, "notachannel")
		assert.Equal(t, channelsCategory.Channels, received.Channels)
	})

	t.Run("should silently prevent the user from adding a channel that they're not a member of", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Have another user create a channel that user isn't a part of
		channel, _, err := th.SystemAdminClient.CreateChannel(&model.Channel{
			TeamId: th.BasicTeam.Id,
			Type:   model.ChannelTypeOpen,
			Name:   "testchannel",
		})
		require.NoError(t, err)

		// Attempt to update the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, channel.Id),
		}

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.NotContains(t, received.Channels, channel.Id)
		assert.Equal(t, channelsCategory.Channels, received.Channels)
	})

	t.Run("muting a category should mute all of its channels", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
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

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.True(t, received.Muted)

		// Check that the muted category was saved in the database
		received, _, err = client.GetSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, channelsCategory.Id, "")
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.True(t, received.Muted)

		// Confirm that the channels in the category were muted
		member, _, err := client.GetChannelMember(channelsCategory.Channels[0], user.Id, "")
		require.NoError(t, err)
		assert.True(t, member.IsChannelMuted())
	})

	t.Run("should not be able to mute DM category", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		dmsCategory := categories.Categories[2]
		require.Equal(t, model.SidebarCategoryDirectMessages, dmsCategory.Type)
		require.Len(t, dmsCategory.Channels, 0)

		// Ensure a DM channel exists
		dmChannel, _, err := client.CreateDirectChannel(user.Id, th.BasicUser.Id)
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

		received, _, err := client.UpdateSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, dmsCategory.Id, updatedCategory)
		require.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.False(t, received.Muted)

		// Check that the muted category was not saved in the database
		received, _, err = client.GetSidebarCategoryForTeamForUser(user.Id, th.BasicTeam.Id, dmsCategory.Id, "")
		require.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.False(t, received.Muted)

		// Confirm that the channels in the category were not muted
		member, _, err := client.GetChannelMember(dmChannel.Id, user.Id, "")
		require.NoError(t, err)
		assert.False(t, member.IsChannelMuted())
	})

	t.Run("should not crash with null input", func(t *testing.T) {
		require.NotPanics(t, func() {
			user, client := setupUserForSubtest(t, th)

			categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
			require.NoError(t, err)
			require.Len(t, categories.Categories, 3)
			require.Len(t, categories.Order, 3)

			dmsCategory := categories.Categories[2]

			payload := []byte(`null`)
			route := fmt.Sprintf("/users/%s/teams/%s/channels/categories/%s", user.Id, th.BasicTeam.Id, dmsCategory.Id)
			r, err := client.DoAPIPutBytes(route, payload)
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

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, "notachannel"),
		}

		received, _, err := client.UpdateSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{updatedCategory})
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received[0].Id)
		assert.NotContains(t, received[0].Channels, "notachannel")
		assert.Equal(t, channelsCategory.Channels, received[0].Channels)
	})

	t.Run("should silently prevent the user from adding a channel that they're not a member of", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Have another user create a channel that user isn't a part of
		channel, _, err := th.SystemAdminClient.CreateChannel(&model.Channel{
			TeamId: th.BasicTeam.Id,
			Type:   model.ChannelTypeOpen,
			Name:   "testchannel",
		})
		require.NoError(t, err)

		// Attempt to update the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, channel.Id),
		}

		received, _, err := client.UpdateSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{updatedCategory})
		require.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, received[0].Id)
		assert.NotContains(t, received[0].Channels, channel.Id)
		assert.Equal(t, channelsCategory.Channels, received[0].Channels)
	})

	t.Run("should update order", func(t *testing.T) {
		user, client := setupUserForSubtest(t, th)

		categories, _, err := client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		_, _, err = client.UpdateSidebarCategoryOrderForTeamForUser(user.Id, th.BasicTeam.Id, []string{categories.Order[1], categories.Order[0], categories.Order[2]})
		require.NoError(t, err)

		categories, _, err = client.GetSidebarCategoriesForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory = categories.Categories[0]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// validate order
		newOrder, _, err := client.GetSidebarCategoryOrderForTeamForUser(user.Id, th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.EqualValues(t, newOrder, categories.Order)

		// try to update with missing category
		_, _, err = client.UpdateSidebarCategoryOrderForTeamForUser(user.Id, th.BasicTeam.Id, []string{categories.Order[1], categories.Order[0]})
		require.Error(t, err)

		// try to update with invalid category
		_, _, err = client.UpdateSidebarCategoryOrderForTeamForUser(user.Id, th.BasicTeam.Id, []string{categories.Order[1], categories.Order[0], "asd"})
		require.Error(t, err)
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
	user, _, err := client.Login(user.Email, password)
	require.NoError(t, err)

	return user, client
}
