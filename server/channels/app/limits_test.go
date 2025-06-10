// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetServerLimits(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server shows hard-coded limits", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(2500), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(5000), serverLimits.MaxUsersHardLimit)
	})

	t.Run("user count should increase on creating new user and decrease on permanently deleting", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(nil)

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

		th.App.Srv().SetLicense(nil)

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

		th.App.Srv().SetLicense(nil)

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

		th.App.Srv().SetLicense(nil)

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

		th.App.Srv().SetLicense(nil)

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

	t.Run("licensed server without seat count enforcement shows no limits", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = false
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit)
	})

	t.Run("licensed server with seat count enforcement shows license limits", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		userLimit := 100
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(100), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(100), serverLimits.MaxUsersHardLimit)
	})

	t.Run("licensed server with seat count enforcement but no Users feature shows no limits", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = nil
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit)
	})

	t.Run("handles license being set to nil gracefully", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// First set a license with seat count enforcement
		userLimit := 100
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		th.App.Srv().SetLicense(license)

		// Verify license limits are applied
		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(100), serverLimits.MaxUsersLimit)

		// Now set license to nil - should fall back to hard-coded limits
		th.App.Srv().SetLicense(nil)

		serverLimits, appErr = th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Should now show unlicensed server limits
		require.Equal(t, int64(2500), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(5000), serverLimits.MaxUsersHardLimit)
	})
}

func TestIsAtUserLimit(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server", func(t *testing.T) {
		t.Run("below hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			th.App.Srv().SetLicense(nil)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(4000), nil) // Under hard limit of 5000
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("at hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			th.App.Srv().SetLicense(nil)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(5000), nil) // At hard limit of 5000
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})

		t.Run("above hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			th.App.Srv().SetLicense(nil)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(6000), nil) // Over hard limit of 5000
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})
	})

	t.Run("licensed server with seat count enforcement", func(t *testing.T) {
		t.Run("below limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// InitBasic creates 3 users, so we're below the limit of 5
			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("at limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 2 additional users to have 5 total (at limit of 5)
			th.CreateUser()
			th.CreateUser()

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})

		t.Run("above limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(6), nil) // Above limit of 5
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})
	})

	t.Run("licensed server without seat count enforcement", func(t *testing.T) {
		t.Run("below unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 2 additional users to have 3 total (below limit of 5)
			th.CreateUser()
			th.CreateUser()

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("at unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 4 additional users to have 5 total (at limit of 5)
			th.CreateUser()
			th.CreateUser()
			th.CreateUser()
			th.CreateUser()

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("above unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 5 additional users to have 6 total (above limit of 5)
			th.CreateUser()
			th.CreateUser()
			th.CreateUser()
			th.CreateUser()
			th.CreateUser()

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})
	})
}
