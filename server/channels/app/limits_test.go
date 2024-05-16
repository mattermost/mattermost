// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetUserLimits(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("base case", func(t *testing.T) {
		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), userLimits.ActiveUserCount)
		require.Equal(t, int64(10000), userLimits.MaxUsersLimit)
	})

	t.Run("user count should increase on creating new user and decrease on permanently deleting", func(t *testing.T) {
		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)

		// now we create a new user
		newUser := th.CreateUser()

		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), userLimits.ActiveUserCount)

		// now we'll delete the user
		_ = th.App.PermanentDeleteUser(th.Context, newUser)
		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)
	})

	t.Run("user count should increase on creating new guest user and decrease on permanently deleting", func(t *testing.T) {
		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)

		// now we create a new user
		newGuestUser := th.CreateGuest()

		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), userLimits.ActiveUserCount)

		// now we'll delete the user
		_ = th.App.PermanentDeleteUser(th.Context, newGuestUser)
		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)
	})

	t.Run("user count should increase on creating new user and decrease on soft deleting", func(t *testing.T) {
		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)

		// now we create a new user
		newUser := th.CreateUser()

		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), userLimits.ActiveUserCount)

		// now we'll delete the user
		_, appErr = th.App.UpdateActive(th.Context, newUser, false)
		require.Nil(t, appErr)
		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)
	})

	t.Run("user count should increase on creating new guest user and decrease on soft deleting", func(t *testing.T) {
		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)

		// now we create a new user
		newGuestUser := th.CreateGuest()

		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), userLimits.ActiveUserCount)

		// now we'll delete the user
		_, appErr = th.App.UpdateActive(th.Context, newGuestUser, false)
		require.Nil(t, appErr)
		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)
	})

	t.Run("user count should not change on creating or deleting bots", func(t *testing.T) {
		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)

		// now we create a new bot
		newBot := th.CreateBot()

		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)

		// now we'll delete the bot
		_ = th.App.PermanentDeleteBot(th.Context, newBot.UserId)
		userLimits, appErr = th.App.GetUserLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), userLimits.ActiveUserCount)
	})

	t.Run("limits should be empty when there is a license", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense())

		userLimits, appErr := th.App.GetUserLimits()
		require.Nil(t, appErr)

		require.Equal(t, int64(0), userLimits.ActiveUserCount)
		require.Equal(t, int64(0), userLimits.MaxUsersLimit)
	})
}
