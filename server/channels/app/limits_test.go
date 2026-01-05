// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestGetServerLimits(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server shows hard-coded limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(200), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(250), serverLimits.MaxUsersHardLimit)
	})

	t.Run("user count should increase on creating new user and decrease on permanently deleting", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newUser := th.CreateUser(t)

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
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newGuestUser := th.CreateGuest(t)

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
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newUser := th.CreateUser(t)

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
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new user
		newGuestUser := th.CreateGuest(t)

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
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)

		// now we create a new bot
		newBot := th.CreateBot(t)

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
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = false
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit)
	})

	t.Run("licensed server with seat count enforcement shows license limits with configurable extra users", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 100
		extraUsers := 10
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(100), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(110), serverLimits.MaxUsersHardLimit) // 100 + 10 extra users = 110
	})

	t.Run("licensed server with seat count enforcement and no ExtraUsers configured defaults to zero", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 100
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = nil // Not configured
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(100), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(100), serverLimits.MaxUsersHardLimit) // 100 + 0 extra users = 100 (hard cap)
	})

	t.Run("licensed server with seat count enforcement and zero ExtraUsers creates hard cap", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 100
		extraUsers := 0
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// InitBasic creates 3 users by default
		require.Equal(t, int64(3), serverLimits.ActiveUserCount)
		require.Equal(t, int64(100), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(100), serverLimits.MaxUsersHardLimit) // 100 + 0 extra users = 100 (hard cap)
	})

	t.Run("licensed server with seat count enforcement but no Users feature shows no limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

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

	t.Run("licensed server with seat count enforcement and zero Users shows zero limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 0
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit) // 0 + 0 (default) extra users = 0
	})
}

func TestIsAtUserLimit(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server", func(t *testing.T) {
		t.Run("below hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			th.App.Srv().SetLicense(nil)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(200), nil) // Under hard limit of 250
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("at hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			th.App.Srv().SetLicense(nil)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(250), nil) // At hard limit of 250
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})

		t.Run("above hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			th.App.Srv().SetLicense(nil)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(300), nil) // Over hard limit of 250
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})
	})

	t.Run("licensed server with seat count enforcement", func(t *testing.T) {
		t.Run("below base limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// InitBasic creates 3 users, so we're below the base limit of 5 and grace limit of 6
			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("at base limit but below hard limit with extra users", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5
			extraUsers := 2
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			license.ExtraUsers = &extraUsers
			th.App.Srv().SetLicense(license)

			// Create 2 additional users to have 5 total (at base limit of 5, but below hard limit of 7)
			th.CreateUser(t)
			th.CreateUser(t)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit) // Should be false due to extra users
		})

		t.Run("at hard limit with extra users", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			userLimit := 5
			extraUsers := 1
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			license.ExtraUsers = &extraUsers
			th.App.Srv().SetLicense(license)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(6), nil) // At hard limit of 6 (5 + 1)
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})

		t.Run("above hard limit with extra users", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			userLimit := 5
			extraUsers := 1
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			license.ExtraUsers = &extraUsers
			th.App.Srv().SetLicense(license)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(7), nil) // Above hard limit of 6
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})
	})

	t.Run("licensed server without seat count enforcement", func(t *testing.T) {
		t.Run("below unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 2 additional users to have 3 total (below limit of 5)
			th.CreateUser(t)
			th.CreateUser(t)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("at unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 4 additional users to have 5 total (at limit of 5)
			th.CreateUser(t)
			th.CreateUser(t)
			th.CreateUser(t)
			th.CreateUser(t)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})

		t.Run("above unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 5 additional users to have 6 total (above limit of 5)
			th.CreateUser(t)
			th.CreateUser(t)
			th.CreateUser(t)
			th.CreateUser(t)
			th.CreateUser(t)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit)
		})
	})
}

func TestExtraUsersBehavior(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("extra users examples", func(t *testing.T) {
		tests := []struct {
			name              string
			licenseUserLimit  int
			extraUsers        *int
			expectedBaseLimit int64
			expectedHardLimit int64
		}{
			{
				name:              "zero license users with extra users",
				licenseUserLimit:  0,
				extraUsers:        model.NewPointer(5),
				expectedBaseLimit: 0,
				expectedHardLimit: 5, // 0 + 5 extra users = 5
			},
			{
				name:              "license with configured extra users",
				licenseUserLimit:  10,
				extraUsers:        model.NewPointer(2),
				expectedBaseLimit: 10,
				expectedHardLimit: 12, // 10 + 2 extra users = 12
			},
			{
				name:              "license with zero extra users (hard cap)",
				licenseUserLimit:  100,
				extraUsers:        model.NewPointer(0),
				expectedBaseLimit: 100,
				expectedHardLimit: 100, // 100 + 0 extra users = 100 (hard cap)
			},
			{
				name:              "license with no extra users configured defaults to zero",
				licenseUserLimit:  100,
				extraUsers:        nil,
				expectedBaseLimit: 100,
				expectedHardLimit: 100, // 100 + 0 (default) extra users = 100 (hard cap)
			},
			{
				name:              "license with large number of extra users",
				licenseUserLimit:  1000,
				extraUsers:        model.NewPointer(200),
				expectedBaseLimit: 1000,
				expectedHardLimit: 1200, // 1000 + 200 extra users = 1200
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				th := Setup(t).InitBasic(t)

				license := model.NewTestLicense("")
				license.IsSeatCountEnforced = true
				license.Features.Users = &tt.licenseUserLimit
				license.ExtraUsers = tt.extraUsers
				th.App.Srv().SetLicense(license)

				serverLimits, appErr := th.App.GetServerLimits()
				require.Nil(t, appErr)

				require.Equal(t, tt.expectedBaseLimit, serverLimits.MaxUsersLimit)
				require.Equal(t, tt.expectedHardLimit, serverLimits.MaxUsersHardLimit)
			})
		}
	})

	t.Run("unlicensed server has no extra users", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Unlicensed servers use hard-coded limits without extra users
		require.Equal(t, int64(200), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(250), serverLimits.MaxUsersHardLimit)
	})
}

func TestGetServerLimitsWithPostHistory(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server has no post history limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Unlicensed servers should have no post history limits
		require.Equal(t, int64(0), serverLimits.PostHistoryLimit)
		require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
	})

	t.Run("licensed server without post history limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.Limits = nil // No limits configured
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Should have no post history limits when Limits is nil
		require.Equal(t, int64(0), serverLimits.PostHistoryLimit)
		require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
	})

	t.Run("licensed server with zero post history limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.Limits = &model.LicenseLimits{
			PostHistory: 0, // Zero limit
		}
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Should have no post history limits when PostHistory is 0
		require.Equal(t, int64(0), serverLimits.PostHistoryLimit)
		require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
	})

	t.Run("licensed server with positive post history limit and successful GetLastAccessiblePostTime", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		// Mock user store for existing functionality
		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(5), nil)
		mockStore.On("User").Return(&mockUserStore)

		// Mock system store for GetLastAccessiblePostTime
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("GetByName", model.SystemLastAccessiblePostTime).Return(&model.System{
			Name:  model.SystemLastAccessiblePostTime,
			Value: "1234567890",
		}, nil)
		mockStore.On("System").Return(&mockSystemStore)

		// Create Entry license with post history limit
		license := model.NewTestLicenseSKU(model.LicenseShortSkuMattermostEntry)
		license.Limits = &model.LicenseLimits{
			PostHistory: 1000,
		}
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Should have proper post history limits set
		require.Equal(t, int64(1000), serverLimits.PostHistoryLimit)
		require.Equal(t, int64(1234567890), serverLimits.LastAccessiblePostTime)
		require.Equal(t, int64(5), serverLimits.ActiveUserCount)
	})

	t.Run("licensed server with post history limit but GetLastAccessiblePostTime fails", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		// Mock user store for existing functionality
		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(5), nil)
		mockStore.On("User").Return(&mockUserStore)

		// Mock system store to return error
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("GetByName", model.SystemLastAccessiblePostTime).Return(nil, errors.New("database error"))
		mockStore.On("System").Return(&mockSystemStore)

		// Create Entry license with post history limit
		license := model.NewTestLicenseSKU(model.LicenseShortSkuMattermostEntry)
		license.Limits = &model.LicenseLimits{
			PostHistory: 1000,
		}
		th.App.Srv().SetLicense(license)

		_, appErr := th.App.GetServerLimits()
		require.NotNil(t, appErr)
		require.Contains(t, appErr.Message, "Unable to find the system variable")
	})

	t.Run("licensed server with post history limit but no system value found", func(t *testing.T) {
		th := SetupWithStoreMock(t)

		// Mock user store for existing functionality
		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(int64(5), nil)
		mockStore.On("User").Return(&mockUserStore)

		// Mock system store to return ErrNotFound (all posts accessible)
		mockSystemStore := storemocks.SystemStore{}
		mockSystemStore.On("GetByName", model.SystemLastAccessiblePostTime).Return(nil, store.NewErrNotFound("", ""))
		mockStore.On("System").Return(&mockSystemStore)

		// Create Entry license with post history limit
		license := model.NewTestLicenseSKU(model.LicenseShortSkuMattermostEntry)
		license.Limits = &model.LicenseLimits{
			PostHistory: 1000,
		}
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Should have post history limit set but LastAccessiblePostTime should be 0 (all posts accessible)
		require.Equal(t, int64(1000), serverLimits.PostHistoryLimit)
		require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
		require.Equal(t, int64(5), serverLimits.ActiveUserCount)
	})
}
func TestGetPostHistoryLimit(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server returns zero limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		limit := th.App.GetPostHistoryLimit()
		require.Equal(t, int64(0), limit)
	})

	t.Run("licensed server with no Limits returns zero", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.Limits = nil // No limits configured
		th.App.Srv().SetLicense(license)

		limit := th.App.GetPostHistoryLimit()
		require.Equal(t, int64(0), limit)
	})

	t.Run("licensed server with zero PostHistory returns zero", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.Limits = &model.LicenseLimits{
			PostHistory: 0,
		}
		th.App.Srv().SetLicense(license)

		limit := th.App.GetPostHistoryLimit()
		require.Equal(t, int64(0), limit)
	})

	t.Run("licensed server with positive PostHistory returns exact value", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.Limits = &model.LicenseLimits{
			PostHistory: 1500,
		}
		th.App.Srv().SetLicense(license)

		limit := th.App.GetPostHistoryLimit()
		require.Equal(t, int64(1500), limit)
	})

	t.Run("Entry license with PostHistory returns exact value", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicenseSKU(model.LicenseShortSkuMattermostEntry)

		license.Limits = &model.LicenseLimits{
			PostHistory: 2000,
		}
		th.App.Srv().SetLicense(license)

		limit := th.App.GetPostHistoryLimit()
		require.Equal(t, int64(2000), limit)
	})
}
