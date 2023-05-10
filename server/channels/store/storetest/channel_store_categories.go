// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"database/sql"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

func TestChannelStoreCategories(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("CreateInitialSidebarCategories", func(t *testing.T) { testCreateInitialSidebarCategories(t, ss) })
	t.Run("CreateSidebarCategory", func(t *testing.T) { testCreateSidebarCategory(t, ss) })
	t.Run("GetSidebarCategory", func(t *testing.T) { testGetSidebarCategory(t, ss, s) })
	t.Run("GetSidebarCategories", func(t *testing.T) { testGetSidebarCategories(t, ss) })
	t.Run("UpdateSidebarCategories", func(t *testing.T) { testUpdateSidebarCategories(t, ss) })
	t.Run("ClearSidebarOnTeamLeave", func(t *testing.T) { testClearSidebarOnTeamLeave(t, ss, s) })
	t.Run("DeleteSidebarCategory", func(t *testing.T) { testDeleteSidebarCategory(t, ss, s) })
	t.Run("UpdateSidebarChannelsByPreferences", func(t *testing.T) { testUpdateSidebarChannelsByPreferences(t, ss) })
	t.Run("SidebarCategoryDeadlock", func(t *testing.T) { testSidebarCategoryDeadlock(t, ss) })
}

func setupTeam(t *testing.T, ss store.Store, userIds ...string) *model.Team {
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "Name",
		Name:        NewTestId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	assert.NoError(t, err)

	members := make([]*model.TeamMember, 0, len(userIds))
	for _, userId := range userIds {
		members = append(members, &model.TeamMember{
			TeamId: team.Id,
			UserId: userId,
		})
	}
	if len(members) > 0 {
		_, err = ss.Team().SaveMultipleMembers(members, len(userIds)+1)
		assert.NoError(t, err)
	}

	return team
}

func testCreateInitialSidebarCategories(t *testing.T, ss store.Store) {
	t.Run("should create initial favorites/channels/DMs categories", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}

		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		assert.NoError(t, nErr)
		require.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)

		res2, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		assert.NoError(t, err)
		assert.Equal(t, res, res2)
	})

	t.Run("should create initial favorites/channels/DMs categories for multiple users", func(t *testing.T) {
		userId := model.NewId()
		userId2 := model.NewId()

		team := setupTeam(t, ss, userId, userId2)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		res, nErr = ss.Channel().CreateInitialSidebarCategories(userId2, opts)
		assert.NoError(t, nErr)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)

		res2, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId2, team.Id)
		assert.NoError(t, err)
		assert.Equal(t, res, res2)
	})

	t.Run("should create initial favorites/channels/DMs categories on different teams", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)
		team2 := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		opts = &store.SidebarCategorySearchOpts{
			TeamID:      team2.Id,
			ExcludeTeam: false,
		}
		res, nErr = ss.Channel().CreateInitialSidebarCategories(userId, opts)
		assert.NoError(t, nErr)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)

		res2, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team2.Id)
		assert.NoError(t, err)
		assert.Equal(t, res, res2)
	})

	t.Run("shouldn't create additional categories when ones already exist", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		initialCategories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Equal(t, res, initialCategories)

		// Calling CreateInitialSidebarCategories a second time shouldn't create any new categories
		res, nErr = ss.Channel().CreateInitialSidebarCategories(userId, opts)
		assert.NoError(t, nErr)
		assert.NotEmpty(t, res)

		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		assert.NoError(t, err)
		assert.Equal(t, initialCategories.Categories, res.Categories)
	})

	t.Run("shouldn't create additional categories when ones already exist even when ran simultaneously", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		var wg sync.WaitGroup

		for i := 0; i < 10; i++ {
			wg.Add(1)

			go func() {
				defer wg.Done()

				opts := &store.SidebarCategorySearchOpts{
					TeamID:      team.Id,
					ExcludeTeam: false,
				}
				_, _ = ss.Channel().CreateInitialSidebarCategories(userId, opts)
			}()
		}

		wg.Wait()

		res, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		assert.NoError(t, err)
		assert.Len(t, res.Categories, 3)
	})

	t.Run("should populate the Favorites category with regular channels", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		// Set up two channels, one favorited and one not
		channel1, nErr := ss.Channel().Save(&model.Channel{
			TeamId: team.Id,
			Type:   model.ChannelTypeOpen,
			Name:   "channel1",
		}, 1000)
		require.NoError(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			TeamId: team.Id,
			Type:   model.ChannelTypeOpen,
			Name:   "channel2",
		}, 1000)
		require.NoError(t, nErr)
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel2.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		nErr = ss.Preference().Save(model.Preferences{
			{
				UserId:   userId,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel1.Id,
				Value:    "true",
			},
		})
		require.NoError(t, nErr)

		// Create the categories
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		categories, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{channel1.Id}, categories.Categories[0].Channels)
		assert.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Equal(t, []string{channel2.Id}, categories.Categories[1].Channels)

		// Get and check the categories for channels
		categories2, nErr := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, nErr)
		require.Equal(t, categories, categories2)
	})

	t.Run("should populate the Favorites category in alphabetical order", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		// Set up two channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      team.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "channel1",
			DisplayName: "zebra",
		}, 1000)
		require.NoError(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			TeamId:      team.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "channel2",
			DisplayName: "aardvark",
		}, 1000)
		require.NoError(t, nErr)
		_, err = ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel2.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		nErr = ss.Preference().Save(model.Preferences{
			{
				UserId:   userId,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel1.Id,
				Value:    "true",
			},
			{
				UserId:   userId,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel2.Id,
				Value:    "true",
			},
		})
		require.NoError(t, nErr)

		// Create the categories
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		categories, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, categories.Categories[0].Channels)

		// Get and check the categories for channels
		categories2, nErr := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, nErr)
		require.Equal(t, categories, categories2)
	})

	t.Run("should populate the Favorites category with DMs and GMs", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		otherUserId1 := model.NewId()
		otherUserId2 := model.NewId()

		// Set up two direct channels, one favorited and one not
		dmChannel1, err := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId1),
				Type: model.ChannelTypeDirect,
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
		require.NoError(t, err)

		dmChannel2, err := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId2),
				Type: model.ChannelTypeDirect,
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
		require.NoError(t, err)

		err = ss.Preference().Save(model.Preferences{
			{
				UserId:   userId,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     dmChannel1.Id,
				Value:    "true",
			},
		})
		require.NoError(t, err)

		// Create the categories
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		categories, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{dmChannel1.Id}, categories.Categories[0].Channels)
		assert.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)
		assert.Equal(t, []string{dmChannel2.Id}, categories.Categories[2].Channels)

		// Get and check the categories for channels
		categories2, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Equal(t, categories, categories2)
	})

	t.Run("should not populate the Favorites category with channels from other teams", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)
		team2 := setupTeam(t, ss, userId)

		// Set up a channel on another team and favorite it
		channel1, nErr := ss.Channel().Save(&model.Channel{
			TeamId: team2.Id,
			Type:   model.ChannelTypeOpen,
			Name:   "channel1",
		}, 1000)
		require.NoError(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			ChannelId:   channel1.Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		nErr = ss.Preference().Save(model.Preferences{
			{
				UserId:   userId,
				Category: model.PreferenceCategoryFavoriteChannel,
				Name:     channel1.Id,
				Value:    "true",
			},
		})
		require.NoError(t, nErr)

		// Create the categories
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		categories, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.Len(t, categories.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)
		assert.Equal(t, []string{}, categories.Categories[0].Channels)
		assert.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)
		assert.Equal(t, []string{}, categories.Categories[1].Channels)

		// Get and check the categories for channels
		categories2, nErr := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, nErr)
		require.Equal(t, categories, categories2)
	})

	t.Run("graphQL path to create initial favorites/channels/DMs categories on different teams", func(t *testing.T) {
		userId := model.NewId()

		t1 := &model.Team{
			DisplayName: "DisplayName",
			Name:        NewTestId(),
			Email:       MakeEmail(),
			Type:        model.TeamOpen,
			InviteId:    model.NewId(),
		}
		t1, err := ss.Team().Save(t1)
		require.NoError(t, err)

		m1 := &model.TeamMember{TeamId: t1.Id, UserId: userId}
		_, nErr := ss.Team().SaveMember(m1, -1)
		require.NoError(t, nErr)

		t2 := &model.Team{
			DisplayName: "DisplayName2",
			Name:        NewTestId(),
			Email:       MakeEmail(),
			Type:        model.TeamOpen,
			InviteId:    model.NewId(),
		}
		t2, err = ss.Team().Save(t2)
		require.NoError(t, err)

		m2 := &model.TeamMember{TeamId: t2.Id, UserId: userId}
		_, nErr = ss.Team().SaveMember(m2, -1)
		require.NoError(t, nErr)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      t1.Id,
			ExcludeTeam: true,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		for _, cat := range res.Categories {
			assert.Equal(t, t2.Id, cat.TeamId)
		}
	})
}

func testCreateSidebarCategory(t *testing.T, ss store.Store) {
	t.Run("Creating category without initial categories should fail", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
		})
		require.Error(t, err)
		var errNotFound *store.ErrNotFound
		require.ErrorAs(t, err, &errNotFound)
		require.Nil(t, created)
	})

	t.Run("should place the new category second if Favorites comes first", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
		})
		require.NoError(t, err)

		// Confirm that it comes second
		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Len(t, res.Categories, 4)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)
		assert.Equal(t, created.Id, res.Categories[1].Id)
	})

	t.Run("should place the new category first if Favorites is not first", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		// Re-arrange the categories so that Favorites comes last
		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)
		require.Equal(t, model.SidebarCategoryFavorites, categories.Categories[0].Type)

		err = ss.Channel().UpdateSidebarCategoryOrder(userId, team.Id, []string{
			categories.Categories[1].Id,
			categories.Categories[2].Id,
			categories.Categories[0].Id,
		})
		require.NoError(t, err)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
		})
		require.NoError(t, err)

		// Confirm that it comes first
		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Len(t, res.Categories, 4)
		assert.Equal(t, model.SidebarCategoryCustom, res.Categories[0].Type)
		assert.Equal(t, created.Id, res.Categories[0].Id)
	})

	t.Run("should create the category with its channels", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		// Create some channels
		channel1, err := ss.Channel().Save(&model.Channel{
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
			Name:   model.NewId(),
		}, 100)
		require.NoError(t, err)
		channel2, err := ss.Channel().Save(&model.Channel{
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
			Name:   model.NewId(),
		}, 100)
		require.NoError(t, err)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
			Channels: []string{channel2.Id, channel1.Id},
		})
		require.NoError(t, err)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, created.Channels)

		// Get the channel again to ensure that the SidebarChannels were saved correctly
		res2, err := ss.Channel().GetSidebarCategory(created.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, res2.Channels)
	})

	t.Run("should remove any channels from their previous categories", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Len(t, categories.Categories, 3)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Create some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
			Name:   model.NewId(),
		}, 100)
		require.NoError(t, nErr)
		channel2, nErr := ss.Channel().Save(&model.Channel{
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
			Name:   model.NewId(),
		}, 100)
		require.NoError(t, nErr)

		// Assign them to categories
		favoritesCategory.Channels = []string{channel1.Id}
		channelsCategory.Channels = []string{channel2.Id}
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			favoritesCategory,
			channelsCategory,
		})
		require.NoError(t, err)

		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
			},
			Channels: []string{channel2.Id, channel1.Id},
		})
		require.NoError(t, err)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, created.Channels)

		// Confirm that the channels were removed from their original categories
		res2, err := ss.Channel().GetSidebarCategory(favoritesCategory.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{}, res2.Channels)

		res2, err = ss.Channel().GetSidebarCategory(channelsCategory.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{}, res2.Channels)
	})

	t.Run("should store the correct sorting value", func(t *testing.T) {
		userId := model.NewId()

		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)
		// Create the category
		created, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: model.NewId(),
				Sorting:     model.SidebarCategorySortManual,
			},
		})
		require.NoError(t, err)

		// Confirm that sorting value is correct
		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Len(t, res.Categories, 4)
		// first category will be favorites and second will be newly created
		assert.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)
		assert.Equal(t, created.Id, res.Categories[1].Id)
		assert.Equal(t, model.SidebarCategorySortManual, res.Categories[1].Sorting)
		assert.Equal(t, model.SidebarCategorySortManual, created.Sorting)
	})
}

func testGetSidebarCategory(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("should return a custom category with its Channels field set", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		channelId1 := model.NewId()
		channelId2 := model.NewId()
		channelId3 := model.NewId()

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		// Create a category and assign some channels to it
		created, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      userId,
				TeamId:      team.Id,
				DisplayName: model.NewId(),
			},
			Channels: []string{channelId1, channelId2, channelId3},
		})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Ensure that they're returned in order
		res2, err := ss.Channel().GetSidebarCategory(created.Id)
		assert.NoError(t, err)
		assert.Equal(t, created.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryCustom, res2.Type)
		assert.Equal(t, created.DisplayName, res2.DisplayName)
		assert.Equal(t, []string{channelId1, channelId2, channelId3}, res2.Channels)
	})

	t.Run("should return any orphaned channels with the Channels category", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the channels category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Join some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel1",
			DisplayName: "DEF",
			TeamId:      team.Id,
			Type:        model.ChannelTypePrivate,
		}, 10)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel2",
			DisplayName: "ABC",
			TeamId:      team.Id,
			Type:        model.ChannelTypeOpen,
		}, 10)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		// Confirm that they're not in the Channels category in the DB
		var count int64
		countErr := s.GetMasterX().Get(&count, `
			SELECT
				COUNT(*)
			FROM
				SidebarChannels
			WHERE
				CategoryId = ?`, channelsCategory.Id)
		require.NoError(t, countErr)
		assert.Equal(t, int64(0), count)

		// Ensure that the Channels are returned in alphabetical order
		res2, err := ss.Channel().GetSidebarCategory(channelsCategory.Id)
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		assert.Equal(t, []string{channel2.Id, channel1.Id}, res2.Channels)
	})

	t.Run("shouldn't return orphaned channels on another team with the Channels category", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the channels category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryChannels, categories.Categories[1].Type)

		channelsCategory := categories.Categories[1]

		// Join a channel on another team
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:   "abc",
			TeamId: model.NewId(),
			Type:   model.ChannelTypeOpen,
		}, 10)
		require.NoError(t, nErr)
		defer ss.Channel().PermanentDelete(channel1.Id)

		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		// Ensure that no channels are returned
		res2, err := ss.Channel().GetSidebarCategory(channelsCategory.Id)
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		assert.Len(t, res2.Channels, 0)
	})

	t.Run("shouldn't return non-orphaned channels with the Channels category", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		// Create the initial categories and find the channels category
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Join some channels
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel1",
			DisplayName: "DEF",
			TeamId:      team.Id,
			Type:        model.ChannelTypePrivate,
		}, 10)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel1.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:        "channel2",
			DisplayName: "ABC",
			TeamId:      team.Id,
			Type:        model.ChannelTypeOpen,
		}, 10)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		// And assign one to another category
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{channel2.Id},
			},
		})
		require.NoError(t, err)

		// Ensure that the correct channel is returned in the Channels category
		res2, err := ss.Channel().GetSidebarCategory(channelsCategory.Id)
		assert.NoError(t, err)
		assert.Equal(t, channelsCategory.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)
		assert.Equal(t, []string{channel1.Id}, res2.Channels)
	})

	t.Run("should return any orphaned DM channels with the Direct Messages category", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the DMs category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)

		dmsCategory := categories.Categories[2]

		// Create a DM
		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.ChannelTypeDirect,
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
		require.NoError(t, nErr)

		// Ensure that the DM is returned
		res2, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res2.Type)
		assert.Equal(t, []string{dmChannel.Id}, res2.Channels)
	})

	t.Run("should return any orphaned GM channels with the Direct Messages category", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the DMs category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)

		dmsCategory := categories.Categories[2]

		// Create a GM
		gmChannel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "abc",
			TeamId: "",
			Type:   model.ChannelTypeGroup,
		}, 10)
		require.NoError(t, nErr)
		defer ss.Channel().PermanentDelete(gmChannel.Id)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   gmChannel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		// Ensure that the DM is returned
		res2, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res2.Type)
		assert.Equal(t, []string{gmChannel.Id}, res2.Channels)
	})

	t.Run("should return orphaned DM channels in the DMs category which are in a custom category on another team", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the DMs category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Equal(t, model.SidebarCategoryDirectMessages, categories.Categories[2].Type)

		dmsCategory := categories.Categories[2]

		// Create a DM
		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.ChannelTypeDirect,
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
		require.NoError(t, nErr)

		// Create another team and assign the DM to a custom category on that team
		otherTeam := setupTeam(t, ss, userId)
		opts = &store.SidebarCategorySearchOpts{
			TeamID:      otherTeam.Id,
			ExcludeTeam: false,
		}
		res, nErr = ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		_, err = ss.Channel().CreateSidebarCategory(userId, otherTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId: userId,
				TeamId: team.Id,
			},
			Channels: []string{dmChannel.Id},
		})
		require.NoError(t, err)

		// Ensure that the DM is returned with the DMs category on the original team
		res2, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, res2.Id)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res2.Type)
		assert.Equal(t, []string{dmChannel.Id}, res2.Channels)
	})
}

func testGetSidebarCategories(t *testing.T, ss store.Store) {
	t.Run("should return channels in the same order between different ways of getting categories", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		channelIds := []string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
		}

		newCategory, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			Channels: channelIds,
		})
		require.NoError(t, err)
		require.NotNil(t, newCategory)

		gotCategory, err := ss.Channel().GetSidebarCategory(newCategory.Id)
		require.NoError(t, err)

		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)
		require.Len(t, res.Categories, 4)

		require.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)

		// This looks unnecessary, but I was getting different results from some of these before
		assert.Equal(t, newCategory.Channels, res.Categories[1].Channels)
		assert.Equal(t, gotCategory.Channels, res.Categories[1].Channels)
		assert.Equal(t, channelIds, res.Categories[1].Channels)
	})
	t.Run("should not return categories for teams deleted, or no longer a member", func(t *testing.T) {
		userId := model.NewId()

		teamMember1 := setupTeam(t, ss, userId)
		teamMember2 := setupTeam(t, ss, userId)
		teamDeleted := setupTeam(t, ss, userId)
		teamDeleted.DeleteAt = model.GetMillis()
		ss.Team().Update(teamDeleted)
		teamNotMember := setupTeam(t, ss)
		teamDeletedMember := setupTeam(t, ss, userId)

		members, err := ss.Team().GetMembersByIds(teamDeletedMember.Id, []string{userId}, nil)
		require.NoError(t, err)
		require.NotEmpty(t, members)
		member := members[0]
		member.DeleteAt = model.GetMillis()
		ss.Team().UpdateMember(member)

		teamIds := []string{
			teamMember1.Id,
			teamMember2.Id,
			teamDeleted.Id,
			teamNotMember.Id,
			teamDeletedMember.Id,
		}

		for _, id := range teamIds {
			res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, &store.SidebarCategorySearchOpts{TeamID: id})
			require.NoError(t, nErr)
			require.NotEmpty(t, res)
		}

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      teamMember1.Id,
			ExcludeTeam: false,
		}

		// Team member and not exclude
		res, err := ss.Channel().GetSidebarCategories(userId, opts)
		require.NoError(t, err)
		assert.Equal(t, 3, len(res.Categories))

		// No team member and not exclude
		opts.TeamID = teamDeleted.Id
		res, err = ss.Channel().GetSidebarCategories(userId, opts)
		require.NoError(t, err)
		assert.Equal(t, 0, len(res.Categories))

		// No team member and exclude
		opts.ExcludeTeam = true
		res, err = ss.Channel().GetSidebarCategories(userId, opts)
		require.NoError(t, err)
		assert.Equal(t, 6, len(res.Categories))

		// Team member and exclude
		opts.TeamID = teamMember1.Id
		res, err = ss.Channel().GetSidebarCategories(userId, opts)
		require.NoError(t, err)
		assert.Equal(t, 3, len(res.Categories))
	})
}

func testUpdateSidebarCategories(t *testing.T, ss store.Store) {
	t.Run("ensure the query to update SidebarCategories hasn't been polluted by UpdateSidebarCategoryOrder", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, err := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, err)
		require.NotEmpty(t, res)

		initialCategories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := initialCategories.Categories[0]
		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		// And then update one of them
		updated, _, err := ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			channelsCategory,
		})
		require.NoError(t, err)
		assert.Equal(t, channelsCategory, updated[0])
		assert.Equal(t, "Channels", updated[0].DisplayName)

		// And then reorder the categories
		err = ss.Channel().UpdateSidebarCategoryOrder(userId, team.Id, []string{dmsCategory.Id, favoritesCategory.Id, channelsCategory.Id})
		require.NoError(t, err)

		// Which somehow blanks out stuff because ???
		got, err := ss.Channel().GetSidebarCategory(favoritesCategory.Id)
		require.NoError(t, err)
		assert.Equal(t, "Favorites", got.DisplayName)
	})

	t.Run("categories should be returned in their original order", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, err := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, err)
		require.NotEmpty(t, res)

		initialCategories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := initialCategories.Categories[0]
		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		// And then update them
		updatedCategories, _, err := ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			favoritesCategory,
			channelsCategory,
			dmsCategory,
		})
		assert.NoError(t, err)
		assert.Equal(t, favoritesCategory.Id, updatedCategories[0].Id)
		assert.Equal(t, channelsCategory.Id, updatedCategories[1].Id)
		assert.Equal(t, dmsCategory.Id, updatedCategories[2].Id)
	})

	t.Run("should silently fail to update read only fields", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		initialCategories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := initialCategories.Categories[0]
		channelsCategory := initialCategories.Categories[1]
		dmsCategory := initialCategories.Categories[2]

		customCategory, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{})
		require.NoError(t, err)

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

		updatedCategories, _, err := ss.Channel().UpdateSidebarCategories(userId, team.Id, categoriesToUpdate)
		assert.NoError(t, err)

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
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the favorites category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)

		// Join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
		}, 10)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		// Assign it to favorites
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		assert.NoError(t, err)

		res2, nErr := ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		// And then remove it
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.Error(t, nErr)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res2)
	})

	t.Run("should add and remove favorites preferences for DMs", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create the initial categories and find the favorites category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)

		// Create a direct channel
		otherUserId := model.NewId()

		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.ChannelTypeDirect,
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
		assert.NoError(t, nErr)

		// Assign it to favorites
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.NoError(t, err)

		res2, nErr := ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, dmChannel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		// And then remove it
		dmsCategory := categories.Categories[2]
		require.Equal(t, model.SidebarCategoryDirectMessages, dmsCategory.Type)

		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: dmsCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, dmChannel.Id)
		assert.Error(t, nErr)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res2)
	})

	t.Run("should add and remove favorites preferences, even if the channel is already favorited in preferences", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)
		team2 := setupTeam(t, ss, userId)

		// Create the initial categories and find the favorites categories in each team
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)

		opts = &store.SidebarCategorySearchOpts{
			TeamID:      team2.Id,
			ExcludeTeam: false,
		}
		res, nErr = ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories2, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team2.Id)
		require.NoError(t, err)

		favoritesCategory2 := categories2.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory2.Type)

		// Create a direct channel
		otherUserId := model.NewId()

		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.ChannelTypeDirect,
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
		assert.NoError(t, nErr)

		// Assign it to favorites on the first team. The favorites preference gets set for all teams.
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.NoError(t, err)

		res2, nErr := ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, dmChannel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		// Assign it to favorites on the second team. The favorites preference is already set.
		updated, _, err := ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{dmChannel.Id},
			},
		})
		assert.NoError(t, err)
		assert.Equal(t, []string{dmChannel.Id}, updated[0].Channels)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, dmChannel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		// Remove it from favorites on the first team. This clears the favorites preference for all teams.
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, dmChannel.Id)
		require.Error(t, nErr)
		assert.Nil(t, res2)

		// Remove it from favorites on the second team. The favorites preference was already deleted.
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, dmChannel.Id)
		require.Error(t, nErr)
		assert.Nil(t, res2)
	})

	t.Run("should not affect other users' favorites preferences", func(t *testing.T) {
		userId := model.NewId()
		userId2 := model.NewId()
		team := setupTeam(t, ss, userId, userId2)

		// Create the initial categories and find the favorites category
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		favoritesCategory := categories.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory.Type)
		channelsCategory := categories.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory.Type)

		// Create the other users' categories
		res, nErr = ss.Channel().CreateInitialSidebarCategories(userId2, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		categories2, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId2, team.Id)
		require.NoError(t, err)

		favoritesCategory2 := categories2.Categories[0]
		require.Equal(t, model.SidebarCategoryFavorites, favoritesCategory2.Type)
		channelsCategory2 := categories2.Categories[1]
		require.Equal(t, model.SidebarCategoryChannels, channelsCategory2.Type)

		// Have both users join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
		}, 10)
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)
		_, nErr = ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId2,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, nErr)

		// Have user1 favorite it
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, err)

		res2, nErr := ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		res2, nErr = ss.Preference().Get(userId2, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res2)

		// And user2 favorite it
		_, _, err = ss.Channel().UpdateSidebarCategories(userId2, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: channelsCategory2.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		res2, nErr = ss.Preference().Get(userId2, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		// And then user1 unfavorite it
		_, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: favoritesCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res2)

		res2, nErr = ss.Preference().Get(userId2, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.NoError(t, nErr)
		assert.NotNil(t, res2)
		assert.Equal(t, "true", res2.Value)

		// And finally user2 favorite it
		_, _, err = ss.Channel().UpdateSidebarCategories(userId2, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory2.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: favoritesCategory2.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, err)

		res2, nErr = ss.Preference().Get(userId, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res2)

		res2, nErr = ss.Preference().Get(userId2, model.PreferenceCategoryFavoriteChannel, channel.Id)
		assert.True(t, errors.Is(nErr, sql.ErrNoRows))
		assert.Nil(t, res2)
	})

	t.Run("channels removed from Channels or DMs categories should be re-added", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Create some channels
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
		}, 10)
		require.NoError(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.ChannelTypeDirect,
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
		require.NoError(t, nErr)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		// And some categories
		initialCategories, nErr := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, nErr)

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

		updatedCategories, _, nErr := ss.Channel().UpdateSidebarCategories(userId, team.Id, categoriesToUpdate)
		assert.NoError(t, nErr)

		// The channels should still exist in the category because they would otherwise be orphaned
		assert.Equal(t, []string{channel.Id}, updatedCategories[0].Channels)
		assert.Equal(t, []string{dmChannel.Id}, updatedCategories[1].Channels)
	})

	t.Run("should be able to move DMs into and out of custom categories", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		otherUserId := model.NewId()
		dmChannel, nErr := ss.Channel().SaveDirectChannel(
			&model.Channel{
				Name: model.GetDMNameFromIds(userId, otherUserId),
				Type: model.ChannelTypeDirect,
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
		require.NoError(t, nErr)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		// The DM should start in the DMs category
		initialCategories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, err)

		dmsCategory := initialCategories.Categories[2]
		require.Equal(t, []string{dmChannel.Id}, dmsCategory.Channels)

		// Now move the DM into a custom category
		customCategory, err := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{})
		require.NoError(t, err)

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

		updatedCategories, _, err := ss.Channel().UpdateSidebarCategories(userId, team.Id, categoriesToUpdate)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, updatedCategories[0].Id)
		assert.Equal(t, []string{}, updatedCategories[0].Channels)
		assert.Equal(t, customCategory.Id, updatedCategories[1].Id)
		assert.Equal(t, []string{dmChannel.Id}, updatedCategories[1].Channels)

		updatedDmsCategory, err := ss.Channel().GetSidebarCategory(dmsCategory.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{}, updatedDmsCategory.Channels)

		updatedCustomCategory, err := ss.Channel().GetSidebarCategory(customCategory.Id)
		require.NoError(t, err)
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

		updatedCategories, _, err = ss.Channel().UpdateSidebarCategories(userId, team.Id, categoriesToUpdate)
		assert.NoError(t, err)
		assert.Equal(t, dmsCategory.Id, updatedCategories[0].Id)
		assert.Equal(t, []string{dmChannel.Id}, updatedCategories[0].Channels)
		assert.Equal(t, customCategory.Id, updatedCategories[1].Id)
		assert.Equal(t, []string{}, updatedCategories[1].Channels)

		updatedDmsCategory, err = ss.Channel().GetSidebarCategory(dmsCategory.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{dmChannel.Id}, updatedDmsCategory.Channels)

		updatedCustomCategory, err = ss.Channel().GetSidebarCategory(customCategory.Id)
		require.NoError(t, err)
		assert.Equal(t, []string{}, updatedCustomCategory.Channels)
	})

	t.Run("should successfully move channels between categories", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
		}, 10)
		require.NoError(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		// And then create the initial categories so that it includes the channel
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		initialCategories, nErr := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, nErr)

		channelsCategory := initialCategories.Categories[1]
		require.Equal(t, []string{channel.Id}, channelsCategory.Channels)

		customCategory, nErr := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{})
		require.NoError(t, nErr)

		// Move the channel one way
		updatedCategories, _, nErr := ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		assert.NoError(t, nErr)

		assert.Equal(t, []string{}, updatedCategories[0].Channels)
		assert.Equal(t, []string{channel.Id}, updatedCategories[1].Channels)

		// And then the other
		updatedCategories, _, nErr = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{},
			},
		})
		assert.NoError(t, nErr)
		assert.Equal(t, []string{channel.Id}, updatedCategories[0].Channels)
		assert.Equal(t, []string{}, updatedCategories[1].Channels)
	})

	t.Run("should correctly return the original categories that were modified", func(t *testing.T) {
		userId := model.NewId()
		team := setupTeam(t, ss, userId)

		// Join a channel
		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.ChannelTypeOpen,
			TeamId: team.Id,
		}, 10)
		require.NoError(t, nErr)
		_, err := ss.Channel().SaveMember(&model.ChannelMember{
			UserId:      userId,
			ChannelId:   channel.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		})
		require.NoError(t, err)

		// And then create the initial categories so that Channels includes the channel
		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team.Id,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		initialCategories, nErr := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
		require.NoError(t, nErr)

		channelsCategory := initialCategories.Categories[1]
		require.Equal(t, []string{channel.Id}, channelsCategory.Channels)

		customCategory, nErr := ss.Channel().CreateSidebarCategory(userId, team.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				DisplayName: "originalName",
			},
		})
		require.NoError(t, nErr)

		// Rename the custom category
		updatedCategories, originalCategories, nErr := ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: model.SidebarCategory{
					Id:          customCategory.Id,
					DisplayName: "updatedName",
				},
			},
		})
		require.NoError(t, nErr)
		require.Equal(t, len(updatedCategories), len(originalCategories))
		assert.Equal(t, "originalName", originalCategories[0].DisplayName)
		assert.Equal(t, "updatedName", updatedCategories[0].DisplayName)

		// Move a channel
		updatedCategories, originalCategories, nErr = ss.Channel().UpdateSidebarCategories(userId, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		require.NoError(t, nErr)
		require.Equal(t, len(updatedCategories), len(originalCategories))
		require.Equal(t, updatedCategories[0].Id, originalCategories[0].Id)
		require.Equal(t, updatedCategories[1].Id, originalCategories[1].Id)

		assert.Equal(t, []string{channel.Id}, originalCategories[0].Channels)
		assert.Equal(t, []string{}, updatedCategories[0].Channels)
		assert.Equal(t, []string{}, originalCategories[1].Channels)
		assert.Equal(t, []string{channel.Id}, updatedCategories[1].Channels)
	})
}

func setupInitialSidebarCategories(t *testing.T, ss store.Store) (string, string) {
	userId := model.NewId()
	team := setupTeam(t, ss, userId)

	opts := &store.SidebarCategorySearchOpts{
		TeamID:      team.Id,
		ExcludeTeam: false,
	}
	res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
	require.NoError(t, nErr)
	require.NotEmpty(t, res)

	res, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team.Id)
	require.NoError(t, err)
	require.Len(t, res.Categories, 3)

	return userId, team.Id
}

func testClearSidebarOnTeamLeave(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("should delete all sidebar categories and channels on the team", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)

		user := &model.User{
			Id: userId,
		}

		// Create some channels and assign them to a custom category
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: teamId,
			Type:   model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, nErr)

		dmChannel1, nErr := ss.Channel().CreateDirectChannel(user, &model.User{
			Id: model.NewId(),
		})
		require.NoError(t, nErr)

		_, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			Channels: []string{channel1.Id, dmChannel1.Id},
		})
		require.NoError(t, err)

		// Confirm that we start with the right number of categories and SidebarChannels entries
		var count int64
		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarCategories WHERE UserId = ?", userId)
		require.NoError(t, err)
		require.Equal(t, int64(4), count)

		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarChannels WHERE UserId = ?", userId)
		require.NoError(t, err)
		require.Equal(t, int64(2), count)

		// Leave the team
		err = ss.Channel().ClearSidebarOnTeamLeave(userId, teamId)
		assert.NoError(t, err)

		// Confirm that all the categories and SidebarChannel entries have been deleted
		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarCategories WHERE UserId = ?", userId)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)

		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarChannels WHERE UserId = ?", userId)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should not delete sidebar categories and channels on another the team", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)

		user := &model.User{
			Id: userId,
		}

		// Create some channels and assign them to a custom category
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: teamId,
			Type:   model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, nErr)

		dmChannel1, nErr := ss.Channel().CreateDirectChannel(user, &model.User{
			Id: model.NewId(),
		})
		require.NoError(t, nErr)

		_, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			Channels: []string{channel1.Id, dmChannel1.Id},
		})
		require.NoError(t, err)

		// Confirm that we start with the right number of categories and SidebarChannels entries
		var count int64
		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarCategories WHERE UserId = ?", userId)
		require.NoError(t, err)
		require.Equal(t, int64(4), count)

		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarChannels WHERE UserId = ?", userId)
		require.NoError(t, err)
		require.Equal(t, int64(2), count)

		// Leave another team
		err = ss.Channel().ClearSidebarOnTeamLeave(userId, model.NewId())
		assert.NoError(t, err)

		// Confirm that nothing has been deleted
		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarCategories WHERE UserId = ?", userId)
		require.NoError(t, err)
		assert.Equal(t, int64(4), count)

		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarChannels WHERE UserId = ?", userId)
		require.NoError(t, err)
		assert.Equal(t, int64(2), count)
	})

	t.Run("MM-30314 should not delete channels on another team under specific circumstances", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)

		user := &model.User{
			Id: userId,
		}
		user2 := &model.User{
			Id: model.NewId(),
		}

		// Create a second team and set up the sidebar categories for it
		team2 := setupTeam(t, ss, userId)

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      team2.Id,
			ExcludeTeam: false,
		}
		res, err := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, err)
		require.NotEmpty(t, res)

		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team2.Id)
		require.NoError(t, err)
		require.Len(t, res.Categories, 3)

		// On the first team, create some channels and assign them to a custom category
		channel1, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: teamId,
			Type:   model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, nErr)

		dmChannel1, nErr := ss.Channel().CreateDirectChannel(user, user2)
		require.NoError(t, nErr)

		_, err = ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			Channels: []string{channel1.Id, dmChannel1.Id},
		})
		require.NoError(t, err)

		// Do the same on the second team
		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: team2.Id,
			Type:   model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, nErr)

		_, err = ss.Channel().CreateSidebarCategory(userId, team2.Id, &model.SidebarCategoryWithChannels{
			Channels: []string{channel2.Id, dmChannel1.Id},
		})
		require.NoError(t, err)

		// Confirm that we start with the right number of categories and SidebarChannels entries
		var count int64
		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarCategories WHERE UserId = ?", userId)
		require.NoError(t, err)
		require.Equal(t, int64(8), count)

		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarChannels WHERE UserId = ?", userId)
		require.NoError(t, err)
		require.Equal(t, int64(4), count)

		// Leave the first team
		err = ss.Channel().ClearSidebarOnTeamLeave(userId, teamId)
		assert.NoError(t, err)

		// Confirm that we have the correct number of categories and SidebarChannels entries left over
		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarCategories WHERE UserId = ?", userId)
		require.NoError(t, err)
		assert.Equal(t, int64(4), count)

		err = s.GetMasterX().Get(&count, "SELECT COUNT(*) FROM SidebarChannels WHERE UserId = ?", userId)
		require.NoError(t, err)
		assert.Equal(t, int64(2), count)

		// Confirm that the categories on the second team are unchanged
		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, team2.Id)
		require.NoError(t, err)
		assert.Len(t, res.Categories, 4)

		assert.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)
		assert.Equal(t, []string{channel2.Id, dmChannel1.Id}, res.Categories[1].Channels)
	})
}

func testDeleteSidebarCategory(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("should correctly remove an empty category", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)
		defer ss.User().PermanentDelete(userId)

		newCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{})
		require.NoError(t, err)
		require.NotNil(t, newCategory)

		// Ensure that the category was created properly
		res, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, teamId)
		require.NoError(t, err)
		require.Len(t, res.Categories, 4)

		// Then delete it and confirm that was done correctly
		err = ss.Channel().DeleteSidebarCategory(newCategory.Id)
		assert.NoError(t, err)

		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, teamId)
		require.NoError(t, err)
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
			Type:   model.ChannelTypeOpen,
		}, 1000)
		require.NoError(t, nErr)
		defer ss.Channel().PermanentDelete(channel1.Id)

		channel2, nErr := ss.Channel().Save(&model.Channel{
			Name:   model.NewId(),
			TeamId: teamId,
			Type:   model.ChannelTypePrivate,
		}, 1000)
		require.NoError(t, nErr)
		defer ss.Channel().PermanentDelete(channel2.Id)

		dmChannel1, nErr := ss.Channel().CreateDirectChannel(user, &model.User{
			Id: model.NewId(),
		})
		require.NoError(t, nErr)
		defer ss.Channel().PermanentDelete(dmChannel1.Id)

		// Assign some of those channels to a custom category
		newCategory, err := ss.Channel().CreateSidebarCategory(userId, teamId, &model.SidebarCategoryWithChannels{
			Channels: []string{channel1.Id, channel2.Id, dmChannel1.Id},
		})
		require.NoError(t, err)
		require.NotNil(t, newCategory)

		// Ensure that the categories are set up correctly
		res, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, teamId)
		require.NoError(t, err)
		require.Len(t, res.Categories, 4)

		require.Equal(t, model.SidebarCategoryCustom, res.Categories[1].Type)
		require.Equal(t, []string{channel1.Id, channel2.Id, dmChannel1.Id}, res.Categories[1].Channels)

		// Actually delete the channel
		err = ss.Channel().DeleteSidebarCategory(newCategory.Id)
		assert.NoError(t, err)

		// Confirm that the category was deleted...
		res, err = ss.Channel().GetSidebarCategoriesForTeamForUser(userId, teamId)
		assert.NoError(t, err)
		assert.Len(t, res.Categories, 3)

		// ...and that the corresponding SidebarChannel entries were deleted
		var count int64
		countErr := s.GetMasterX().Get(&count, `
			SELECT
				COUNT(*)
			FROM
				SidebarChannels
			WHERE
				CategoryId = ?`, newCategory.Id)
		require.NoError(t, countErr)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should not allow you to remove non-custom categories", func(t *testing.T) {
		userId, teamId := setupInitialSidebarCategories(t, ss)
		defer ss.User().PermanentDelete(userId)
		res, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userId, teamId)
		require.NoError(t, err)
		require.Len(t, res.Categories, 3)
		require.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		require.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		require.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)

		err = ss.Channel().DeleteSidebarCategory(res.Categories[0].Id)
		assert.Error(t, err)

		err = ss.Channel().DeleteSidebarCategory(res.Categories[1].Id)
		assert.Error(t, err)

		err = ss.Channel().DeleteSidebarCategory(res.Categories[2].Id)
		assert.Error(t, err)
	})
}

func testUpdateSidebarChannelsByPreferences(t *testing.T, ss store.Store) {
	t.Run("Should be able to update sidebar channels", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      teamId,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		require.NoError(t, nErr)
		require.NotEmpty(t, res)

		channel, nErr := ss.Channel().Save(&model.Channel{
			Name:   "channel",
			Type:   model.ChannelTypeOpen,
			TeamId: teamId,
		}, 10)
		require.NoError(t, nErr)

		err := ss.Channel().UpdateSidebarChannelsByPreferences(model.Preferences{
			model.Preference{
				Name:     channel.Id,
				Category: model.PreferenceCategoryFavoriteChannel,
				Value:    "true",
			},
		})
		assert.NoError(t, err)
	})

	t.Run("Should not panic if channel is not found", func(t *testing.T) {
		userId := model.NewId()
		teamId := model.NewId()

		opts := &store.SidebarCategorySearchOpts{
			TeamID:      teamId,
			ExcludeTeam: false,
		}
		res, nErr := ss.Channel().CreateInitialSidebarCategories(userId, opts)
		assert.NoError(t, nErr)
		require.NotEmpty(t, res)

		require.NotPanics(t, func() {
			_ = ss.Channel().UpdateSidebarChannelsByPreferences(model.Preferences{
				model.Preference{
					Name:     "fakeid",
					Category: model.PreferenceCategoryFavoriteChannel,
					Value:    "true",
				},
			})
		})
	})
}

// testSidebarCategoryDeadlock tries to delete and update a category at the same time
// in the hope of triggering a deadlock. This is a best-effort test case, and is not guaranteed
// to catch a bug.
func testSidebarCategoryDeadlock(t *testing.T, ss store.Store) {
	userID := model.NewId()
	team := setupTeam(t, ss, userID)

	// Join a channel
	channel, err := ss.Channel().Save(&model.Channel{
		Name:   "channel",
		Type:   model.ChannelTypeOpen,
		TeamId: team.Id,
	}, 10)
	require.NoError(t, err)
	_, err = ss.Channel().SaveMember(&model.ChannelMember{
		UserId:      userID,
		ChannelId:   channel.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	// And then create the initial categories so that it includes the channel
	opts := &store.SidebarCategorySearchOpts{
		TeamID:      team.Id,
		ExcludeTeam: false,
	}
	res, err := ss.Channel().CreateInitialSidebarCategories(userID, opts)
	require.NoError(t, err)
	require.NotEmpty(t, res)

	initialCategories, err := ss.Channel().GetSidebarCategoriesForTeamForUser(userID, team.Id)
	require.NoError(t, err)

	channelsCategory := initialCategories.Categories[1]
	require.Equal(t, []string{channel.Id}, channelsCategory.Channels)

	customCategory, err := ss.Channel().CreateSidebarCategory(userID, team.Id, &model.SidebarCategoryWithChannels{})
	require.NoError(t, err)

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		_, _, err := ss.Channel().UpdateSidebarCategories(userID, team.Id, []*model.SidebarCategoryWithChannels{
			{
				SidebarCategory: channelsCategory.SidebarCategory,
				Channels:        []string{},
			},
			{
				SidebarCategory: customCategory.SidebarCategory,
				Channels:        []string{channel.Id},
			},
		})
		if err != nil {
			var nfErr *store.ErrNotFound
			require.True(t, errors.As(err, &nfErr))
		}
	}()

	go func() {
		defer wg.Done()
		err := ss.Channel().DeleteSidebarCategory(customCategory.Id)
		require.NoError(t, err)
	}()

	wg.Wait()
}
