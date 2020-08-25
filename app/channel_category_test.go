// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestSidebarCategory(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	basicChannel2 := th.CreateChannel(th.BasicTeam)
	defer th.App.PermanentDeleteChannel(basicChannel2)
	user := th.CreateUser()
	defer th.App.Srv().Store.User().PermanentDelete(user.Id)
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
		_, err := th.App.CreateSidebarCategory(user.Id, th.BasicTeam.Id, &catData)
		require.NotNil(t, err, "Should return error due to duplicate IDs")
		catData.Channels = []string{th.BasicChannel.Id, basicChannel2.Id}
		cat, err := th.App.CreateSidebarCategory(user.Id, th.BasicTeam.Id, &catData)
		require.Nil(t, err, "Expected no error")
		require.NotNil(t, cat, "Expected category object, got nil")
		createdCategory = cat
	})

	t.Run("UpdateSidebarCategories", func(t *testing.T) {
		require.NotNil(t, createdCategory)
		createdCategory.Channels = []string{th.BasicChannel.Id}
		updatedCat, err := th.App.UpdateSidebarCategories(user.Id, th.BasicTeam.Id, []*model.SidebarCategoryWithChannels{createdCategory})
		require.Nil(t, err, "Expected no error")
		require.NotNil(t, updatedCat, "Expected category object, got nil")
		require.Len(t, updatedCat, 1)
		require.Len(t, updatedCat[0].Channels, 1)
		require.Equal(t, updatedCat[0].Channels[0], th.BasicChannel.Id)
	})

	t.Run("UpdateSidebarCategoryOrder", func(t *testing.T) {
		err := th.App.UpdateSidebarCategoryOrder(user.Id, th.BasicTeam.Id, []string{th.BasicChannel.Id, basicChannel2.Id})
		require.NotNil(t, err, "Should return error due to invalid order")

		actualOrder, err := th.App.GetSidebarCategoryOrder(user.Id, th.BasicTeam.Id)
		require.Nil(t, err, "Should fetch order successfully")

		actualOrder[2], actualOrder[3] = actualOrder[3], actualOrder[2]
		err = th.App.UpdateSidebarCategoryOrder(user.Id, th.BasicTeam.Id, actualOrder)
		require.Nil(t, err, "Should update order successfully")

		actualOrder[2] = "asd"
		err = th.App.UpdateSidebarCategoryOrder(user.Id, th.BasicTeam.Id, actualOrder)
		require.NotNil(t, err, "Should return error due to invalid id")
	})

	t.Run("GetSidebarCategoryOrder", func(t *testing.T) {
		catOrder, err := th.App.GetSidebarCategoryOrder(user.Id, th.BasicTeam.Id)
		require.Nil(t, err, "Expected no error")
		require.Len(t, catOrder, 4)
		require.Equal(t, catOrder[1], createdCategory.Id, "the newly created category should be after favorites")
	})
}

func TestGetSidebarCategories(t *testing.T) {
	t.Run("should return the sidebar categories for the given user/team", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		_, err := th.App.CreateSidebarCategory(th.BasicUser.Id, th.BasicTeam.Id, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      th.BasicUser.Id,
				TeamId:      th.BasicTeam.Id,
				DisplayName: "new category",
			},
		})
		require.Nil(t, err)

		categories, err := th.App.GetSidebarCategories(th.BasicUser.Id, th.BasicTeam.Id)
		assert.Nil(t, err)
		assert.Len(t, categories.Categories, 4)
	})

	t.Run("should create the initial categories even if migration hasn't ran yet", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Manually add the user to the team without going through the app layer to simulate a pre-existing user/team
		// relationship that hasn't been migrated yet
		team := th.CreateTeam()
		_, err := th.App.Srv().Store.Team().SaveMember(&model.TeamMember{
			TeamId:     team.Id,
			UserId:     th.BasicUser.Id,
			SchemeUser: true,
		}, 100)
		require.Nil(t, err)

		categories, err := th.App.GetSidebarCategories(th.BasicUser.Id, team.Id)
		assert.Nil(t, err)
		assert.Len(t, categories.Categories, 3)
	})

	t.Run("should return a store error if a db table is missing", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Temporarily renaming a table to force a DB error.
		sqlSupplier := mainHelper.GetSQLSupplier()
		_, err := sqlSupplier.GetMaster().Exec("ALTER TABLE SidebarCategories RENAME TO SidebarCategoriesTest")
		require.Nil(t, err)
		defer func() {
			_, err := sqlSupplier.GetMaster().Exec("ALTER TABLE SidebarCategoriesTest RENAME TO SidebarCategories")
			require.Nil(t, err)
		}()

		categories, appErr := th.App.GetSidebarCategories(th.BasicUser.Id, th.BasicTeam.Id)
		assert.Nil(t, categories)
		assert.NotNil(t, appErr)
		assert.Equal(t, "store.sql_channel.sidebar_categories.app_error", appErr.Id)
	})
}
