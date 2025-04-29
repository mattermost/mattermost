// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetServerLimits(t *testing.T) {
	t.Run("base case", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(2500), serverLimits.MaxUsersLimit)
	})

	t.Run("user count should increase on creating new user and decrease on permanently deleting", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newUser := th.CreateUser()

		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), serverLimits.ActiveUserCount)

		// now we'll delete the user
		_ = th.App.PermanentDeleteUser(th.Context, newUser)
		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
	})

	t.Run("user count should increase on creating new guest user and decrease on permanently deleting", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newGuestUser := th.CreateGuest()

		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), serverLimits.ActiveUserCount)

		// now we'll delete the user
		_ = th.App.PermanentDeleteUser(th.Context, newGuestUser)
		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
	})

	t.Run("user count should increase on creating new user and decrease on soft deleting", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newUser := th.CreateUser()

		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), serverLimits.ActiveUserCount)

		// now we'll delete the user
		_, appErr = th.App.UpdateActive(th.Context, newUser, false)
		require.Nil(t, appErr)
		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
	})

	t.Run("user count should increase on creating new guest user and decrease on soft deleting", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newGuestUser := th.CreateGuest()

		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(4), serverLimits.ActiveUserCount)

		// now we'll delete the user
		_, appErr = th.App.UpdateActive(th.Context, newGuestUser, false)
		require.Nil(t, appErr)
		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
	})

	t.Run("user count should not change on creating or deleting bots", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new bot
		newBot := th.CreateBot()

		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we'll delete the bot
		_ = th.App.PermanentDeleteBot(th.Context, newBot.UserId)
		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
	})

	t.Run("limits should be empty when there is a license", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(model.NewTestLicense())

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		require.Equal(t, int64(0), serverLimits.ActiveUserCount)
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
	})
}
