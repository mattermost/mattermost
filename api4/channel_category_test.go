// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateCategoryForTeamForUser(t *testing.T) {
	t.Run("should silently prevent the user from creating a category with an invalid channel ID", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		// Attempt to create the category
		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "test",
			},
			Channels: []string{th.BasicChannel.Id, "notachannel", th.BasicChannel2.Id},
		}

		received, resp := th.Client.CreateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, category)
		require.Nil(t, resp.Error)
		assert.NotContains(t, received.Channels, "notachannel")
		assert.Equal(t, []string{th.BasicChannel.Id, th.BasicChannel2.Id}, received.Channels)
	})

	t.Run("should silently prevent the user from creating a category with a channel that they're not a member of", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		// Have another user create a channel that th.BasicUser isn't a part of
		channel, resp := th.SystemAdminClient.CreateChannel(&model.Channel{
			TeamId: th.BasicTeam.Id,
			Type:   model.CHANNEL_OPEN,
			Name:   "testchannel",
		})
		require.Nil(t, resp.Error)

		// Attempt to create the category
		category := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "test",
			},
			Channels: []string{th.BasicChannel.Id, channel.Id},
		}

		received, resp := th.Client.CreateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, category)
		require.Nil(t, resp.Error)
		assert.NotContains(t, received.Channels, channel.Id)
		assert.Equal(t, []string{th.BasicChannel.Id}, received.Channels)
	})
}

func TestUpdateCategoryForTeamForUser(t *testing.T) {
	t.Run("should update the channel order of the Channels category", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
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

		received, resp := th.Client.UpdateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		assert.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)

		// And when requesting the category later
		received, resp = th.Client.GetSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, channelsCategory.Id, "")
		assert.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)
	})

	t.Run("should update the sort order of the DM category", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
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

		received, resp := th.Client.UpdateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, dmsCategory.Id, updatedCategory)
		assert.Nil(t, resp.Error)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.Equal(t, model.SidebarCategorySortAlphabetical, received.Sorting)

		// And when requesting the category later
		received, resp = th.Client.GetSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, dmsCategory.Id, "")
		assert.Nil(t, resp.Error)
		assert.Equal(t, dmsCategory.Id, received.Id)
		assert.Equal(t, model.SidebarCategorySortAlphabetical, received.Sorting)
	})

	t.Run("should update the display name of a custom category", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		customCategory, resp := th.Client.CreateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "custom123",
			},
		})
		require.Nil(t, resp.Error)
		require.Equal(t, "custom123", customCategory.DisplayName)

		// Should return the correct values from the API
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: customCategory.SidebarCategory,
			Channels:        customCategory.Channels,
		}
		updatedCategory.DisplayName = "abcCustom"

		received, resp := th.Client.UpdateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, customCategory.Id, updatedCategory)
		assert.Nil(t, resp.Error)
		assert.Equal(t, customCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.DisplayName, received.DisplayName)

		// And when requesting the category later
		received, resp = th.Client.GetSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, customCategory.Id, "")
		assert.Nil(t, resp.Error)
		assert.Equal(t, customCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.DisplayName, received.DisplayName)
	})

	t.Run("should update the channel order of the category even if it contains archived channels", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		require.Len(t, channelsCategory.Channels, 5) // Town Square, Off Topic, and the 3 channels created by InitBasic

		// Delete one of the channels
		_, resp = th.Client.DeleteChannel(th.BasicChannel.Id)
		require.Nil(t, resp.Error)

		// Should still be able to reorder the channels
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        []string{channelsCategory.Channels[1], channelsCategory.Channels[0], channelsCategory.Channels[4], channelsCategory.Channels[3], channelsCategory.Channels[2]},
		}

		received, resp := th.Client.UpdateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.Equal(t, updatedCategory.Channels, received.Channels)
	})

	t.Run("should silently prevent the user from adding an invalid channel ID", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, "notachannel"),
		}

		received, resp := th.Client.UpdateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.NotContains(t, received.Channels, "notachannel")
		assert.Equal(t, channelsCategory.Channels, received.Channels)
	})

	t.Run("should silently prevent the user from adding a channel that they're not a member of", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Have another user create a channel that th.BasicUser isn't a part of
		channel, resp := th.SystemAdminClient.CreateChannel(&model.Channel{
			TeamId: th.BasicTeam.Id,
			Type:   model.CHANNEL_OPEN,
			Name:   "testchannel",
		})
		require.Nil(t, resp.Error)

		// Attempt to update the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, channel.Id),
		}

		received, resp := th.Client.UpdateSidebarCategoryForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, channelsCategory.Id, updatedCategory)
		require.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received.Id)
		assert.NotContains(t, received.Channels, channel.Id)
		assert.Equal(t, channelsCategory.Channels, received.Channels)
	})
}

func TestUpdateCategoriesForTeamForUser(t *testing.T) {
	t.Run("should silently prevent the user from adding an invalid channel ID", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, "notachannel"),
		}

		received, resp := th.Client.UpdateSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{updatedCategory})
		require.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received[0].Id)
		assert.NotContains(t, received[0].Channels, "notachannel")
		assert.Equal(t, channelsCategory.Channels, received[0].Channels)
	})

	t.Run("should silently prevent the user from adding a channel that they're not a member of", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, resp := th.Client.GetSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, "")
		require.Nil(t, resp.Error)
		require.Len(t, categories.Categories, 3)
		require.Len(t, categories.Order, 3)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Have another user create a channel that th.BasicUser isn't a part of
		channel, resp := th.SystemAdminClient.CreateChannel(&model.Channel{
			TeamId: th.BasicTeam.Id,
			Type:   model.CHANNEL_OPEN,
			Name:   "testchannel",
		})
		require.Nil(t, resp.Error)

		// Attempt to update the category
		updatedCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: channelsCategory.SidebarCategory,
			Channels:        append(channelsCategory.Channels, channel.Id),
		}

		received, resp := th.Client.UpdateSidebarCategoriesForTeamForUser(th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{updatedCategory})
		require.Nil(t, resp.Error)
		assert.Equal(t, channelsCategory.Id, received[0].Id)
		assert.NotContains(t, received[0].Channels, channel.Id)
		assert.Equal(t, channelsCategory.Channels, received[0].Channels)
	})
}
