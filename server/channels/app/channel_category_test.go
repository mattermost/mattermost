// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSidebarCategory(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	basicChannel2 := th.CreateChannel(th.Context, th.BasicTeam)
	defer func() {
		err := th.App.PermanentDeleteChannel(th.Context, basicChannel2)
		require.Nil(t, err)
	}()
	user := th.CreateUser()
	defer func() {
		err := th.App.Srv().Store().User().PermanentDelete(th.Context, user.Id)
		require.NoError(t, err)
	}()
	th.LinkUserToTeam(user, th.BasicTeam)
	th.AddUserToChannel(user, basicChannel2)

	var createdCategory *model.SidebarCategoryWithChannels
	t.Run("CreateSidebarCategory", func(t *testing.T) {
		catData := model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "TEST",
			},
			Channels: []string{th.BasicChannel.Id, basicChannel2.Id, basicChannel2.Id},
		}
		_, err := th.App.CreateSidebarCategory(th.Context, user.Id, th.BasicTeam.Id, &catData)
		require.NotNil(t, err, "Should return error due to duplicate IDs")
		catData.Channels = []string{th.BasicChannel.Id, basicChannel2.Id}
		cat, err := th.App.CreateSidebarCategory(th.Context, user.Id, th.BasicTeam.Id, &catData)
		require.Nil(t, err, "Expected no error")
		require.NotNil(t, cat, "Expected category object, got nil")
		createdCategory = cat
	})

	t.Run("UpdateSidebarCategories", func(t *testing.T) {
		require.NotNil(t, createdCategory)
		createdCategory.Channels = []string{th.BasicChannel.Id}
		updatedCat, err := th.App.UpdateSidebarCategories(th.Context, user.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{createdCategory})
		require.Nil(t, err, "Expected no error")
		require.NotNil(t, updatedCat, "Expected category object, got nil")
		require.Len(t, updatedCat, 1)
		require.Len(t, updatedCat[0].Channels, 1)
		require.Equal(t, updatedCat[0].Channels[0], th.BasicChannel.Id)
	})

	t.Run("UpdateSidebarCategoryOrder", func(t *testing.T) {
		err := th.App.UpdateSidebarCategoryOrder(th.Context, user.Id, th.BasicTeam.Id, []string{th.BasicChannel.Id, basicChannel2.Id})
		require.NotNil(t, err, "Should return error due to invalid order")

		actualOrder, err := th.App.GetSidebarCategoryOrder(th.Context, user.Id, th.BasicTeam.Id)
		require.Nil(t, err, "Should fetch order successfully")

		actualOrder[2], actualOrder[3] = actualOrder[3], actualOrder[2]
		err = th.App.UpdateSidebarCategoryOrder(th.Context, user.Id, th.BasicTeam.Id, actualOrder)
		require.Nil(t, err, "Should update order successfully")

		// We create a copy of actualOrder to prevent racy read
		// of the slice when the broadcast message is sent from webhub.
		newOrder := make([]string, len(actualOrder))
		copy(newOrder, actualOrder)
		newOrder[2] = "asd"
		err = th.App.UpdateSidebarCategoryOrder(th.Context, user.Id, th.BasicTeam.Id, newOrder)
		require.NotNil(t, err, "Should return error due to invalid id")
	})

	t.Run("GetSidebarCategoryOrder", func(t *testing.T) {
		catOrder, err := th.App.GetSidebarCategoryOrder(th.Context, user.Id, th.BasicTeam.Id)
		require.Nil(t, err, "Expected no error")
		require.Len(t, catOrder, 4)
		require.Equal(t, catOrder[1], createdCategory.Id, "the newly created category should be after favorites")
	})
}

func TestGetSidebarCategories(t *testing.T) {
	t.Run("should return the sidebar categories for the given user/team", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "new category",
			},
		})
		require.Nil(t, err)

		categories, err := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		assert.Nil(t, err)
		assert.Len(t, categories.Categories, 4)
	})

	t.Run("should create the initial categories even if migration hasn't ran yet", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Manually add the user to the team without going through the app layer to simulate a pre-existing user/team
		// relationship that hasn't been migrated yet
		team := th.CreateTeam()
		_, err := th.App.Srv().Store().Team().SaveMember(th.Context, &model.TeamMember{
			TeamId:     team.Id,
			UserId:     th.BasicUser.Id,
			SchemeUser: true,
		}, 100)
		require.NoError(t, err)

		categories, appErr := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, team.Id)
		assert.Nil(t, appErr)
		assert.Len(t, categories.Categories, 3)
	})

	t.Run("should return a store error if a db table is missing", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Temporarily renaming a table to force a DB error.
		sqlStore := mainHelper.GetSQLStore()
		_, err := sqlStore.GetMaster().Exec("ALTER TABLE SidebarCategories RENAME TO SidebarCategoriesTest")
		require.NoError(t, err)
		defer func() {
			_, err := sqlStore.GetMaster().Exec("ALTER TABLE SidebarCategoriesTest RENAME TO SidebarCategories")
			require.NoError(t, err)
		}()

		categories, appErr := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		assert.Nil(t, categories)
		assert.NotNil(t, appErr)
		assert.Equal(t, "app.channel.sidebar_categories.app_error", appErr.Id)
	})
}

func TestUpdateSidebarCategories(t *testing.T) {
	t.Run("should mute and unmute all channels in a category when it is muted or unmuted", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		categories, err := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, err)

		channelsCategory := categories.Categories[1]

		// Create some channels to be part of the channels category
		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel1)

		channel2 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel2)

		// Mute the category
		updated, err := th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:    channelsCategory.Id,
					Muted: true,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
		})
		require.Nil(t, err)
		assert.True(t, updated[0].Muted)

		// Confirm that the channels are now muted
		member1, err := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member1.IsChannelMuted())
		member2, err := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member2.IsChannelMuted())

		// Unmute the category
		updated, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:    channelsCategory.Id,
					Muted: false,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
		})
		require.Nil(t, err)
		assert.False(t, updated[0].Muted)

		// Confirm that the channels are now unmuted
		member1, err = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member1.IsChannelMuted())
		member2, err = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member2.IsChannelMuted())
	})

	t.Run("should mute and unmute channels moved from an unmuted category to a muted one and back", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Create some channels
		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel1)

		channel2 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel2)

		// And some categories
		mutedCategory, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "muted",
				Muted:       true,
			},
		})
		require.Nil(t, err)
		require.True(t, mutedCategory.Muted)

		unmutedCategory, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "unmuted",
				Muted:       false,
			},
			Channels: []string{channel1.Id, channel2.Id},
		})
		require.Nil(t, err)
		require.False(t, unmutedCategory.Muted)

		// Move the channels
		_, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          mutedCategory.Id,
					DisplayName: mutedCategory.DisplayName,
					Muted:       mutedCategory.Muted,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          unmutedCategory.Id,
					DisplayName: unmutedCategory.DisplayName,
					Muted:       unmutedCategory.Muted,
				},
				Channels: []string{},
			},
		})
		require.Nil(t, err)

		// Confirm that the channels are now muted
		member1, err := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member1.IsChannelMuted())
		member2, err := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member2.IsChannelMuted())

		// Move the channels back
		_, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          mutedCategory.Id,
					DisplayName: mutedCategory.DisplayName,
					Muted:       mutedCategory.Muted,
				},
				Channels: []string{},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          unmutedCategory.Id,
					DisplayName: unmutedCategory.DisplayName,
					Muted:       unmutedCategory.Muted,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
		})
		require.Nil(t, err)

		// Confirm that the channels are now unmuted
		member1, err = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member1.IsChannelMuted())
		member2, err = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member2.IsChannelMuted())
	})

	t.Run("should not mute or unmute channels moved between muted categories", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Create some channels
		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel1)

		channel2 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel2)

		// And some categories
		category1, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "category1",
				Muted:       true,
			},
		})
		require.Nil(t, err)
		require.True(t, category1.Muted)

		category2, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "category2",
				Muted:       true,
			},
			Channels: []string{channel1.Id, channel2.Id},
		})
		require.Nil(t, err)
		require.True(t, category2.Muted)

		// Move the unmuted channels
		_, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category1.Id,
					DisplayName: category1.DisplayName,
					Muted:       category1.Muted,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category2.Id,
					DisplayName: category2.DisplayName,
					Muted:       category2.Muted,
				},
				Channels: []string{},
			},
		})
		require.Nil(t, err)

		// Confirm that the channels are still unmuted
		member1, err := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member1.IsChannelMuted())
		member2, err := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member2.IsChannelMuted())

		// Mute the channels manually
		_, err = th.App.ToggleMuteChannel(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		_, err = th.App.ToggleMuteChannel(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)

		// Move the muted channels back
		_, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category1.Id,
					DisplayName: category1.DisplayName,
					Muted:       category1.Muted,
				},
				Channels: []string{},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category2.Id,
					DisplayName: category2.DisplayName,
					Muted:       category2.Muted,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
		})
		require.Nil(t, err)

		// Confirm that the channels are still muted
		member1, err = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member1.IsChannelMuted())
		member2, err = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member2.IsChannelMuted())
	})

	t.Run("should not mute or unmute channels moved between unmuted categories", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Create some channels
		channel1 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel1)

		channel2 := th.CreateChannel(th.Context, th.BasicTeam)
		th.AddUserToChannel(th.BasicUser, channel2)

		// And some categories
		category1, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "category1",
				Muted:       false,
			},
		})
		require.Nil(t, err)
		require.False(t, category1.Muted)

		category2, err := th.App.CreateSidebarCategory(th.Context, th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "category2",
				Muted:       false,
			},
			Channels: []string{channel1.Id, channel2.Id},
		})
		require.Nil(t, err)
		require.False(t, category2.Muted)

		// Move the unmuted channels
		_, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category1.Id,
					DisplayName: category1.DisplayName,
					Muted:       category1.Muted,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category2.Id,
					DisplayName: category2.DisplayName,
					Muted:       category2.Muted,
				},
				Channels: []string{},
			},
		})
		require.Nil(t, err)

		// Confirm that the channels are still unmuted
		member1, err := th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member1.IsChannelMuted())
		member2, err := th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.False(t, member2.IsChannelMuted())

		// Mute the channels manually
		_, err = th.App.ToggleMuteChannel(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		_, err = th.App.ToggleMuteChannel(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)

		// Move the muted channels back
		_, err = th.App.UpdateSidebarCategories(th.Context, th.BasicUser.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category1.Id,
					DisplayName: category1.DisplayName,
					Muted:       category1.Muted,
				},
				Channels: []string{},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          category2.Id,
					DisplayName: category2.DisplayName,
					Muted:       category2.Muted,
				},
				Channels: []string{channel1.Id, channel2.Id},
			},
		})
		require.Nil(t, err)

		// Confirm that the channels are still muted
		member1, err = th.App.GetChannelMember(th.Context, channel1.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member1.IsChannelMuted())
		member2, err = th.App.GetChannelMember(th.Context, channel2.Id, th.BasicUser.Id)
		require.Nil(t, err)
		assert.True(t, member2.IsChannelMuted())
	})
}

func TestDiffChannelsBetweenCategories(t *testing.T) {
	t.Run("should return nothing when the categories contain identical channels", func(t *testing.T) {
		originalCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category1",
					DisplayName: "Category One",
				},
				Channels: []string{"channel1", "channel2", "channel3"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category2",
					DisplayName: "Category Two",
				},
				Channels: []string{"channel4", "channel5"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category3",
					DisplayName: "Category Three",
				},
				Channels: []string{},
			},
		}

		updatedCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category1",
					DisplayName: "Category Won",
				},
				Channels: []string{"channel1", "channel2", "channel3"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category2",
					DisplayName: "Category Too",
				},
				Channels: []string{"channel4", "channel5"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category3",
					DisplayName: "Category 🌲",
				},
				Channels: []string{},
			},
		}

		channelsDiff := diffChannelsBetweenCategories(updatedCategories, originalCategories)
		assert.Equal(t, map[string]*categoryChannelDiff{}, channelsDiff)
	})

	t.Run("should return nothing when the categories contain identical channels", func(t *testing.T) {
		originalCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category1",
					DisplayName: "Category One",
				},
				Channels: []string{"channel1", "channel2", "channel3"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category2",
					DisplayName: "Category Two",
				},
				Channels: []string{"channel4", "channel5"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category3",
					DisplayName: "Category Three",
				},
				Channels: []string{},
			},
		}

		updatedCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category1",
					DisplayName: "Category Won",
				},
				Channels: []string{},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category2",
					DisplayName: "Category Too",
				},
				Channels: []string{"channel5", "channel2"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category3",
					DisplayName: "Category 🌲",
				},
				Channels: []string{"channel4", "channel1", "channel3"},
			},
		}

		channelsDiff := diffChannelsBetweenCategories(updatedCategories, originalCategories)
		assert.Equal(
			t,
			map[string]*categoryChannelDiff{
				"channel1": {
					fromCategoryId: "category1",
					toCategoryId:   "category3",
				},
				"channel2": {
					fromCategoryId: "category1",
					toCategoryId:   "category2",
				},
				"channel3": {
					fromCategoryId: "category1",
					toCategoryId:   "category3",
				},
				"channel4": {
					fromCategoryId: "category2",
					toCategoryId:   "category3",
				},
			},
			channelsDiff,
		)
	})

	t.Run("should not return channels that are moved in our out of the categories implicitly", func(t *testing.T) {
		// This case could change to actually return the channels in the future, but we don't need to handle it right now
		originalCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category1",
					DisplayName: "Category One",
				},
				Channels: []string{"channel1", "channel2"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category2",
					DisplayName: "Category Two",
				},
				Channels: []string{"channel3"},
			},
		}

		updatedCategories := []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category1",
					DisplayName: "Category Won",
				},
				Channels: []string{"channel1", "channel3"},
			},
			{
				SidebarCategory: model.SidebarCategory{
					Id:          "category2",
					DisplayName: "Category Too",
				},
				Channels: []string{"channel4"},
			},
		}

		channelsDiff := diffChannelsBetweenCategories(updatedCategories, originalCategories)
		assert.Equal(
			t,
			map[string]*categoryChannelDiff{
				"channel3": {
					fromCategoryId: "category2",
					toCategoryId:   "category1",
				},
			},
			channelsDiff,
		)
	})
}
