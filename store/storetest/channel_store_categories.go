// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"errors"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelStoreCategories(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("CreateInitialSidebarCategories", func(t *testing.T) { testCreateInitialSidebarCategories(t, ss) })
	t.Run("CreateSidebarCategory", func(t *testing.T) { testCreateSidebarCategory(t, ss) })
	t.Run("GetSidebarCategory", func(t *testing.T) { testGetSidebarCategory(t, ss, s) })
	t.Run("GetSidebarCategories", func(t *testing.T) { testGetSidebarCategories(t, ss) })
	t.Run("UpdateSidebarCategories", func(t *testing.T) { testUpdateSidebarCategories(t, ss, s) })
	t.Run("DeleteSidebarCategory", func(t *testing.T) { testDeleteSidebarCategory(t, ss, s) })
	t.Run("UpdateSidebarChannelsByPreferences", func(t *testing.T) { testUpdateSidebarChannelsByPreferences(t, ss) })
}

func testCreateInitialSidebarCategories(t *testing.T, ss store.Store) {
	t.Run("should create initial favorites/channels/DMs categories", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		assert.Nil(t, nErr)

		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		assert.Nil(t, err)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)
	})

	t.Run("should create initial favorites/channels/DMs categories for multiple users", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		userId2 := model.NewId()

		nErr = ss.Channel().CreateInitialSidebarCategories(userId2, teamId)
		assert.Nil(t, nErr)

		res, err := ss.Channel().GetSidebarCategories(userId2, teamId)
		assert.Nil(t, err)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)
	})

	t.Run("should create initial favorites/channels/DMs categories on different teams", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		teamId2 := model.NewId()

		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId2)
		assert.Nil(t, nErr)

		res, err := ss.Channel().GetSidebarCategories(userId, teamId2)
		assert.Nil(t, err)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)
	})

	t.Run("shouldn't create additional categories when ones already exist", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		initialCategories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		// Calling CreateInitialSidebarCategories a second time shouldn't create any new categories
		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		assert.Nil(t, nErr)

		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		assert.Nil(t, err)
		assert.Equal(t, initialCategories.Categories, res.Categories)
	})

	t.Run("shouldn't create additional categories when ones already exist even when ran simultaneously", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		var wg sync.WaitGroup

		for i := 0; i < 10; i++ {
			wg.Add(1)

			go func() {
				defer wg.Done()

				_ = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
			}()
		}

		wg.Wait()

		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		assert.Nil(t, err)
		assert.Len(t, res.Categories, 3)
	})

	t.Run("should populate the Favorites category with regular channels", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Set up two channels, one favorited and one not
		channel1, nErr := ss.Channel().Save(&model.Channel{
			TeamId: teamId,
			Type:   model.CHANNEL_OPEN,
			Name:   "channel1",
		}, 1000)
		require.Nil(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			TeamId: teamId,
			Type:   model.CHANNEL_OPEN,
			Name:   "channel2",
		}, 1000)
		require.Nil(t, nErr)
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel2.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		nErr = ss.Preference().Save(&model.Preferences{
			{
				UserId:   userId,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel1.Id,
				Value:    "true",
			},
		})
		require.Nil(t, nErr)

		// Create the categories
		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Get and check the categories for channels
		categories, nErr := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{channel1.Id}, categories.Categories[0].Channels)
		assert.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Equal(t, []string{channel2.Id}, categories.Categories[1].Channels)
	})

	t.Run("should populate the Favorites category in alphabetical order", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Set up two channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			Type:        model.CHANNEL_OPEN,
			Name:        "channel1",
			DisplayName: "zebra",
		}, 1000)
		require.Nil(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      teamId,
			Type:        model.CHANNEL_OPEN,
			Name:        "channel2",
			DisplayName: "aardvark",
		}, 1000)
		require.Nil(t, nErr)
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel2.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		nErr = ss.Preference().Save(&model.Preferences{
			{
				UserId:   userId,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel1.Id,
				Value:    "true",
			},
			{
				UserId:   userId,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel2.Id,
				Value:    "true",
			},
		})
		require.Nil(t, nErr)

		// Create the categories
		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Get and check the categories for channels
		categories, nErr := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, categories.Categories[0].Channels)
	})

	t.Run("should populate the Favorites category with DMs and GMs", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		otherUserId1 := model.NewId()
		otherUserId2 := model.NewId()

		// Set up two direct channels, one favorited and one not
		dmChannel1, err := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId1),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId1,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		require.Nil(t, err)

		dmChannel2, err := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId2),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId2,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		require.Nil(t, err)

		err = ss.Preference().Save(&model.Preferences{
			{
				UserId:   userId,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     dmChannel1.Id,
				Value:    "true",
			},
		})
		require.Nil(t, err)

		// Create the categories
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Get and check the categories for channels
		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{dmChannel1.Id}, categories.Categories[0].Channels)
		assert.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Equal(t, []string{dmChannel2.Id}, categories.Categories[2].Channels)
	})

	t.Run("should not populate the Favorites category with channels from other teams", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()
		teamId2 := model.NewId()

		// Set up a channel on another team and favorite it
		channel1, nErr := ss.Channel().Save(&model.Channel{
			TeamId: teamId2,
			Type:   model.CHANNEL_OPEN,
			Name:   "channel1",
		}, 1000)
		require.Nil(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		nErr = ss.Preference().Save(&model.Preferences{
			{
				UserId:   userId,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Name:     channel1.Id,
				Value:    "true",
			},
		})
		require.Nil(t, nErr)

		// Create the categories
		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Get and check the categories for channels
		categories, nErr := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{}, categories.Categories[0].Channels)
		assert.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Equal(t, []string{}, categories.Categories[1].Channels)
	})
}

func testCreateSidebarCategory(t *testing.T, ss store.Store) {
	t.Run("should place the new category second if Favorites comes first", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
		})
		require.Nil(t, err)

		// Confirm that it comes second
		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 4)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)
		assert.Equal(t, created.Id, res.Categories[1].Id)
	})

	t.Run("should place the new category first if Favorites is not first", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Re-arrange the categories so that Favorites comes last
		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, categories.Categories, 3)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)

		err = ss.Channel().UpdateSidebarCategoryOrder(userId, teamId, []string{
			categories.Categories[1].Id,
			categories.Categories[2].Id,
			categories.Categories[0].Id,
		})
		require.Nil(t, err)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
		})
		require.Nil(t, err)

		// Confirm that it comes first
		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 4)
		assert.Equal(t, model.SidebarCategoryCustom, res.Categories[0].Type)
		assert.Equal(t, created.Id, res.Categories[0].Id)
	})

	t.Run("should create the category with its channels", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Create some channels
		channel1, err := ss.Channel().Save(&model.Channel{
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
			Name:   model.NewId(),
		}, 100)
		require.Nil(t, err)
		channel2, err := ss.Channel().Save(&model.Channel{
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
			Name:   model.NewId(),
		}, 100)
		require.Nil(t, err)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
			Channels: []string{channel2.Id, channel1.Id},
		})
		require.Nil(t, err)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, created.Channels)

		// Get the channel again to ensure that the SidebarChannels were saved correctly
		res, err := ss.Channel().GetSidebarCategory(created.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, res.Channels)
	})

	t.Run("should remove any channels from their previous categories", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, categories.Categories, 3)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Create some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
			Name:   model.NewId(),
		}, 100)
		require.Nil(t, nErr)
		channel2, nErr := ss.Channel().Save(&model.Channel{
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
			Name:   model.NewId(),
		}, 100)
		require.Nil(t, nErr)

		// Assign them to categories
		favoritesCategory.Channels = []string{channel1.Id}
		channelsCategory.Channels = []string{channel2.Id}
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			favoritesCategory,
			channelsCategory,
		})
		require.Nil(t, err)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
			Channels: []string{channel2.Id, channel1.Id},
		})
		require.Nil(t, err)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, created.Channels)

		// Confirm that the channels were removed from their original categories
		res, err := ss.Channel().GetSidebarCategory(favoritesCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{}, res.Channels)

		res, err = ss.Channel().GetSidebarCategory(channelsCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{}, res.Channels)
	})
}

func testGetSidebarCategory(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("should return a custom category with its Channels field set", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		channelId1 := model.NewId()
		channelId2 := model.NewId()
		channelId3 := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// Create a category and assign some channels to it
		created, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      userId,
				TeamId:      teamId,
				DisplayName: model.NewId(),
			},
			Channels: []string{channelId1, channelId2, channelId3},
		})
		require.Nil(t, err)
		require.NotNil(t, created)

		// Ensure that they're returned in order
		res, err := ss.Channel().GetSidebarCategory(created.Id)
		assert.Nil(t, err)
		assert.Equal(t, created.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryCustom, res.Type)
		assert.Equal(t, created.DisplayName, res.DisplayName)
		assert.Equal(t, []string{channelId1, channelId2, channelId3}, res.Channels)
	})

	t.Run("should return any orphaned channels with the Channels category", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the channels category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Join some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel1",
			DisplayName: "DEF",
			TeamId:      teamId,
			Type:        model.CHANNEL_PRIVATE,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel2",
			DisplayName: "ABC",
			TeamId:      teamId,
			Type:        model.CHANNEL_OPEN,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		// Confirm that they're not in the Channels category in the DB
		count, countErr := s.GetMaster().SelectInt(`
			SELECT
				COUNT(*)
			FROM
				SidebarChannels
			WHERE
				CategoryId = :CategoryId`, map[string]interface{}{"CategoryId": channelsCategory.Id})
		require.Nil(t, countErr)
		assert.Equal(t, int64(0), count)

		// Ensure that the Channels are returned in alphabetical order
		res, err := ss.Channel().GetSidebarCategory(channelsCategory.Id)
		assert.Nil(t, err)
		assert.Equal(t, channelsCategory.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, res.Channels)
	})

	t.Run("shouldn't return orphaned channels on another team with the Channels category", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the channels category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)

		channelsCategory := categories.Categories[1]

		// Join a channel on another team
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:   "abc",
			TeamId: model.NewId(),
			Type:   model.CHANNEL_OPEN,
		}, 10)
		require.Nil(t, nErr)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		// Ensure that no channels are returned
		res, err := ss.Channel().GetSidebarCategory(channelsCategory.Id)
		assert.Nil(t, err)
		assert.Equal(t, channelsCategory.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		assert.Len(t, res.Channels, 0)
	})

	t.Run("shouldn't return non-orphaned channels with the Channels category", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the channels category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Join some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel1",
			DisplayName: "DEF",
			TeamId:      teamId,
			Type:        model.CHANNEL_PRIVATE,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel2",
			DisplayName: "ABC",
			TeamId:      teamId,
			Type:        model.CHANNEL_OPEN,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		// And assign one to another category
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{channel2.Id},
			},
		})
		require.Nil(t, err)

		// Ensure that the correct channel is returned in the Channels category
		res, err := ss.Channel().GetSidebarCategory(channelsCategory.Id)
		assert.Nil(t, err)
		assert.Equal(t, channelsCategory.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		assert.Equal(t, []string{channel1.Id}, res.Channels)
	})

	t.Run("should return any orphaned DM channels with the Direct Messages category", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the DMs category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)

		dmsCategory := categories.Categories[2]

		// Create a DM
		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		require.Nil(t, nErr)

		// Ensure that the DM is returned
		res, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		assert.Nil(t, err)
		assert.Equal(t, dmsCategory.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Type)
		assert.Equal(t, []string{dmChannel.Id}, res.Channels)
	})

	t.Run("should return any orphaned GM channels with the Direct Messages category", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the DMs category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)

		dmsCategory := categories.Categories[2]

		// Create a GM
		gmChannel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "abc",
			TeamId: "",
			Type:   model.CHANNEL_GROUP,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   gmChannel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		// Ensure that the DM is returned
		res, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		assert.Nil(t, err)
		assert.Equal(t, dmsCategory.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Type)
		assert.Equal(t, []string{gmChannel.Id}, res.Channels)
	})

	t.Run("should return orphaned DM channels in the DMs categorywhich are in a custom category on another team", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the DMs category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)

		dmsCategory := categories.Categories[2]

		// Create a DM
		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		require.Nil(t, nErr)

		// Create another team and assign the DM to a custom category on that team
		otherTeamId := model.NewId()

		nErr = ss.Channel().CreateInitialSidebarCategories(userId, otherTeamId)
		require.Nil(t, nErr)

		_, err = ss.Channel().CreateSidebarCategory(userId, otherTeamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: userId,
				TeamId: teamId,
			},
			Channels: []string{dmChannel.Id},
		})
		require.Nil(t, err)

		// Ensure that the DM is returned with the DMs category on the original team
		res, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		assert.Nil(t, err)
		assert.Equal(t, dmsCategory.Id, res.Id)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Type)
		assert.Equal(t, []string{dmChannel.Id}, res.Channels)
	})
}

func testGetSidebarCategories(t *testing.T, ss store.Store) {
	t.Run("should return channels in the same order between different ways of getting categories", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		channelIds := []string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
		}

		newCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			Channels: channelIds,
		})
		require.Nil(t, err)
		require.NotNil(t, newCategory)

		gotCategory, err := ss.Channel().GetSidebarCategory(newCategory.Id)
		require.Nil(t, err)

		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 4)

		require.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)

		// This looks unnecessary, but I was getting different results from some of these before
		assert.Equal(t, newCategory.Channels, res.Categories[1].Channels)
		assert.Equal(t, gotCategory.Channels, res.Categories[1].Channels)
		assert.Equal(t, channelIds, res.Categories[1].Channels)
	})
}

func testUpdateSidebarCategories(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("ensure the query to update SidebarCategories hasn't been polluted by UpdateSidebarCategoryOrder", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories
		err := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, err)

		initialCategories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := initialCategories.Categories[0]
		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		// And then update one of them
		updated, err := ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			channelsCategory,
		})
		require.Nil(t, err)
		assert.Equal(t, channelsCategory, updated[0])
		assert.Equal(t, "Channels", updated[0].DisplayName)

		// And then reorder the categories
		err = ss.Channel().UpdateSidebarCategoryOrder(userId, teamId, []string{dmsCategory.Id, favoritesCategory.Id, channelsCategory.Id})
		require.Nil(t, err)

		// Which somehow blanks out stuff because ???
		got, err := ss.Channel().GetSidebarCategory(favoritesCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, "Favorites", got.DisplayName)
	})

	t.Run("categories should be returned in their original order", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories
		err := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, err)

		initialCategories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := initialCategories.Categories[0]
		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		// And then update them
		updatedCategories, err := ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			favoritesCategory,
			channelsCategory,
			dmsCategory,
		})
		assert.Nil(t, err)
		assert.Equal(t, favoritesCategory.Id, updatedCategories[0].Id)
		assert.Equal(t, channelsCategory.Id, updatedCategories[1].Id)
		assert.Equal(t, dmsCategory.Id, updatedCategories[2].Id)
	})

	t.Run("should silently fail to update read only fields", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		initialCategories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := initialCategories.Categories[0]
		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		customCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{})
		require.Nil(t, err)

		categoriesToUpdate := []*model.SidebarCategoryWithChannels{
			// Try to change the type of Favorites
			{
				SidebarCategory: model.SidebarCategory{
					Id:          favoritesCategory.Id,
					DisplayName: "something else",
				},
				Channels: favoritesCategory.Channels,
			},
			// Try to change the type of Channels
			{
				SidebarCategory: model.SidebarCategory{
					Id:   channelsCategory.Id,
					Type: model.SidebarCategoryDirectMessages,
				},
				Channels: channelsCategory.Channels,
			},
			// Try to change the Channels of DMs
			{
				SidebarCategory: dmsCategory.SidebarCategory,
				Channels:        []string{"fakechannel"},
			},
			// Try to change the UserId/TeamId of a custom category
			{
				SidebarCategory: model.SidebarCategory{
					Id:          customCategory.Id,
					UserId:      model.NewId(),
					TeamId:      model.NewId(),
					Sorting:     customCategory.Sorting,
					DisplayName: customCategory.DisplayName,
				},
				Channels: customCategory.Channels,
			},
		}

		updatedCategories, err := ss.Channel().UpdateSidebarCategories(userId, teamId, categoriesToUpdate)
		assert.Nil(t, err)

		assert.NotEqual(t, "Favorites", categoriesToUpdate[0].DisplayName)
		assert.Equal(t, "Favorites", updatedCategories[0].DisplayName)
		assert.NotEqual(t, model.SidebarCategoryChannels, categoriesToUpdate[1].Type)
		assert.Equal(t, model.SidebarCategoryChannels, updatedCategories[1].Type)
		assert.NotEqual(t, []string{}, categoriesToUpdate[2].Channels)
		assert.Equal(t, []string{}, updatedCategories[2].Channels)
		assert.NotEqual(t, userId, categoriesToUpdate[3].UserId)
		assert.Equal(t, userId, updatedCategories[3].UserId)
	})

	t.Run("should add and remove favorites preferences based on the Favorites category", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the favorites category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)

		// Join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		// Assign it to favorites
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		assert.Nil(t, err)

		res, nErr := ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		// And then remove it
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.NotNil(t, nErr)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res)
	})

	t.Run("should add and remove favorites preferences for DMs", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the favorites category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)

		// Create a direct channel
		otherUserId := model.NewId()

		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		assert.Nil(t, nErr)

		// Assign it to favorites
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.Nil(t, err)

		res, nErr := ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, dmChannel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		// And then remove it
		dmsCategory := categories.Categories[2]
		require.Equal(t, model.SidebarCategoryDirectMessages, dmsCategory.Type)

		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: dmsCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, dmChannel.Id)
		assert.NotNil(t, nErr)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res)
	})

	t.Run("should add and remove favorites preferences, even if the channel is already favorited in preferences", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()
		teamId2 := model.NewId()

		// Create the initial categories and find the favorites categories in each team
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)

		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId2)
		require.Nil(t, nErr)

		categories2, err := ss.Channel().GetSidebarCategories(userId, teamId2)
		require.Nil(t, err)

		favoritesCategory2 := categories2.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory2.Type)

		// Create a direct channel
		otherUserId := model.NewId()

		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		assert.Nil(t, nErr)

		// Assign it to favorites on the first team. The favorites preference gets set for all teams.
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.Nil(t, err)

		res, nErr := ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, dmChannel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		// Assign it to favorites on the second team. The favorites preference is already set.
		updated, err := ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.Nil(t, err)
		assert.Equal(t, []string{dmChannel.Id}, updated[0].Channels)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, dmChannel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		// Remove it from favorites on the first team. This clears the favorites preference for all teams.
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, dmChannel.Id)
		require.Error(t, nErr)
		assert.Nil(t, res)

		// Remove it from favorites on the second team. The favorites preference was already deleted.
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId2, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, dmChannel.Id)
		require.Error(t, nErr)
		assert.Nil(t, res)
	})

	t.Run("should not affect other users' favorites preferences", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the initial categories and find the favorites category
		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		categories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Create the other users' categories
		userId2 := model.NewId()

		nErr = ss.Channel().CreateInitialSidebarCategories(userId2, teamId)
		require.Nil(t, nErr)

		categories2, err := ss.Channel().GetSidebarCategories(userId2, teamId)
		require.Nil(t, err)

		favoritesCategory2 := categories2.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory2.Type)
		channelsCategory2 := categories2.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory2.Type)

		// Have both users join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
		}, 10)
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId2,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, nErr)

		// Have user1 favorite it
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, err)

		res, nErr := ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		res, nErr = ss.Preference().Get(userId2, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res)

		// And user2 favorite it
		_, err = ss.Channel().UpdateSidebarCategories(userId2, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: channelsCategory2.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		res, nErr = ss.Preference().Get(userId2, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		// And then user1 unfavorite it
		_, err = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res)

		res, nErr = ss.Preference().Get(userId2, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.Nil(t, nErr)
		assert.NotNil(t, res)
		assert.Equal(t, "true", res.Value)

		// And finally user2 favorite it
		_, err = ss.Channel().UpdateSidebarCategories(userId2, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory2.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, err)

		res, nErr = ss.Preference().Get(userId, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res)

		res, nErr = ss.Preference().Get(userId2, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res)
	})

	t.Run("channels removed from Channels or DMs categories should be re-added", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create some channels
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
		}, 10)
		require.Nil(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		require.Nil(t, nErr)

		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// And some categories
		initialCategories, nErr := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		require.Equal(t, []string{channel.Id}, channelsCategory.Channels)
		require.Equal(t, []string{dmChannel.Id}, dmsCategory.Channels)

		// Try to save the categories with no channels in them
		categoriesToUpdate := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
			{
				SidebarCategory: dmsCategory.SidebarCategory,
				Channels:        []string{},
			},
		}

		updatedCategories, nErr := ss.Channel().UpdateSidebarCategories(userId, teamId, categoriesToUpdate)
		assert.Nil(t, nErr)

		// The channels should still exist in the category because they would otherwise be orphaned
		assert.Equal(t, []string{channel.Id}, updatedCategories[0].Channels)
		assert.Equal(t, []string{dmChannel.Id}, updatedCategories[1].Channels)
	})

	t.Run("should be able to move DMs into and out of custom categories", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.CHANNEL_DIRECT,
			},
			&model.ChannelMember{
				UserId:      userId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
			&model.ChannelMember{
				UserId:      otherUserId,
				NotifyProps: model.GetDefaultChannelNotifyProps(),
			},
		)
		require.Nil(t, nErr)

		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		// The DM should start in the DMs category
		initialCategories, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)

		dmsCategory := initialCategories.Categories[2]
		require.Equal(t, []string{dmChannel.Id}, dmsCategory.Channels)

		// Now move the DM into a custom category
		customCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{})
		require.Nil(t, err)

		categoriesToUpdate := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: dmsCategory.SidebarCategory,
				Channels:        []string{},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		}

		updatedCategories, err := ss.Channel().UpdateSidebarCategories(userId, teamId, categoriesToUpdate)
		assert.Nil(t, err)
		assert.Equal(t, dmsCategory.Id, updatedCategories[0].Id)
		assert.Equal(t, []string{}, updatedCategories[0].Channels)
		assert.Equal(t, customCategory.Id, updatedCategories[1].Id)
		assert.Equal(t, []string{dmChannel.Id}, updatedCategories[1].Channels)

		updatedDmsCategory, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{}, updatedDmsCategory.Channels)

		updatedCustomCategory, err := ss.Channel().GetSidebarCategory(customCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{dmChannel.Id}, updatedCustomCategory.Channels)

		// And move it back out of the custom category
		categoriesToUpdate = []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: dmsCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{},
			},
		}

		updatedCategories, err = ss.Channel().UpdateSidebarCategories(userId, teamId, categoriesToUpdate)
		assert.Nil(t, err)
		assert.Equal(t, dmsCategory.Id, updatedCategories[0].Id)
		assert.Equal(t, []string{dmChannel.Id}, updatedCategories[0].Channels)
		assert.Equal(t, customCategory.Id, updatedCategories[1].Id)
		assert.Equal(t, []string{}, updatedCategories[1].Channels)

		updatedDmsCategory, err = ss.Channel().GetSidebarCategory(dmsCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{dmChannel.Id}, updatedDmsCategory.Channels)

		updatedCustomCategory, err = ss.Channel().GetSidebarCategory(customCategory.Id)
		require.Nil(t, err)
		assert.Equal(t, []string{}, updatedCustomCategory.Channels)
	})

	t.Run("should successfully move channels between categories", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
		}, 10)
		require.Nil(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.Nil(t, err)

		// And then create the initial categories so that it includes the channel
		nErr = ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		initialCategories, nErr := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		channelsCategory := initialCategories.Categories[1]
		require.Equal(t, []string{channel.Id}, channelsCategory.Channels)

		customCategory, nErr := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{})
		require.Nil(t, nErr)

		// Move the channel one way
		updatedCategories, nErr := ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		assert.Nil(t, nErr)

		assert.Equal(t, []string{}, updatedCategories[0].Channels)
		assert.Equal(t, []string{channel.Id}, updatedCategories[1].Channels)

		// And then the other
		updatedCategories, nErr = ss.Channel().UpdateSidebarCategories(userId, teamId, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.Nil(t, nErr)
		assert.Equal(t, []string{channel.Id}, updatedCategories[0].Channels)
		assert.Equal(t, []string{}, updatedCategories[1].Channels)
	})
}

func testDeleteSidebarCategory(t *testing.T, ss store.Store, s SqlSupplier) {
	setupInitialSidebarCategories := func(t *testing.T, ss store.Store) (string, string) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 3)

		return userId, teamId
	}

	t.Run("should correctly remove an empty category", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)
		defer ss.User().PermanentDelete(userId)

		newCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{})
		require.Nil(t, err)
		require.NotNil(t, newCategory)

		// Ensure that the category was created properly
		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 4)

		// Then delete it and confirm that was done correctly
		err = ss.Channel().DeleteSidebarCategory(newCategory.Id)
		assert.Nil(t, err)

		res, err = ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 3)
	})

	t.Run("should correctly remove a category and its channels", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)
		defer ss.User().PermanentDelete(userId)

		user := &model.User{
			Id: userId,
		}

		// Create some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: teamId,
			Type:   model.CHANNEL_OPEN,
		}, 1000)
		require.Nil(t, nErr)
		defer ss.Channel().PermanentDelete(channel1.Id)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: teamId,
			Type:   model.CHANNEL_PRIVATE,
		}, 1000)
		require.Nil(t, nErr)
		defer ss.Channel().PermanentDelete(channel2.Id)

		dmChannel1, nErr := ss.Channel().CreateDirectChannel(user, &model.User{
			Id: model.NewId(),
		})
		require.Nil(t, nErr)
		defer ss.Channel().PermanentDelete(dmChannel1.Id)

		// Assign some of those channels to a custom category
		newCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			Channels: []string{channel1.Id, channel2.Id, dmChannel1.Id},
		})
		require.Nil(t, err)
		require.NotNil(t, newCategory)

		// Ensure that the categories are set up correctly
		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 4)

		require.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)
		require.Equal(t, []string{channel1.Id, channel2.Id, dmChannel1.Id}, res.Categories[1].Channels)

		// Actually delete the channel
		err = ss.Channel().DeleteSidebarCategory(newCategory.Id)
		assert.Nil(t, err)

		// Confirm that the category was deleted...
		res, err = ss.Channel().GetSidebarCategories(userId, teamId)
		assert.Nil(t, err)
		assert.Len(t, res.Categories, 3)

		// ...and that the corresponding SidebarChannel entries were deleted
		count, countErr := s.GetMaster().SelectInt(`
			SELECT
				COUNT(*)
			FROM
				SidebarChannels
			WHERE
				CategoryId = :CategoryId`, map[string]interface{}{"CategoryId": newCategory.Id})
		require.Nil(t, countErr)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should not allow you to remove non-custom categories", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)
		defer ss.User().PermanentDelete(userId)
		res, err := ss.Channel().GetSidebarCategories(userId, teamId)
		require.Nil(t, err)
		require.Len(t, res.Categories, 3)
		require.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		require.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		require.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)

		err = ss.Channel().DeleteSidebarCategory(res.Categories[0].Id)
		assert.NotNil(t, err)

		err = ss.Channel().DeleteSidebarCategory(res.Categories[1].Id)
		assert.NotNil(t, err)

		err = ss.Channel().DeleteSidebarCategory(res.Categories[2].Id)
		assert.NotNil(t, err)
	})
}

func testUpdateSidebarChannelsByPreferences(t *testing.T, ss store.Store) {
	t.Run("Should be able to update sidebar channels", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		require.Nil(t, nErr)

		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.CHANNEL_OPEN,
			TeamId: teamId,
		}, 10)
		require.Nil(t, nErr)

		err := ss.Channel().UpdateSidebarChannelsByPreferences(&model.Preferences{
			model.Preference{
				Name:     channel.Id,
				Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
				Value:    "true",
			},
		})
		assert.NoError(t, err)
	})

	t.Run("Should not panic if channel is not found", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		nErr := ss.Channel().CreateInitialSidebarCategories(userId, teamId)
		assert.Nil(t, nErr)

		require.NotPanics(t, func() {
			_ = ss.Channel().UpdateSidebarChannelsByPreferences(&model.Preferences{
				model.Preference{
					Name:     "fakeid",
					Category: model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL,
					Value:    "true",
				},
			})
		})
	})
}
