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

	t.Run("licensed server with seat count enforcement shows license limits with grace period", func(t *testing.T) {
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
		require.Equal(t, int64(105), serverLimits.MaxUsersHardLimit) // 100 + 5% = 105
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

	t.Run("licensed server with seat count enforcement and zero Users shows zero limits", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		userLimit := 0
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		th.App.Srv().SetLicense(license)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit) // No grace for 0 users
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
		t.Run("below base limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

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

		t.Run("at base limit but below grace limit", func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 2 additional users to have 5 total (at base limit of 5, but below grace limit of 6)
			th.CreateUser()
			th.CreateUser()

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.False(t, atLimit) // Should be false due to grace period
		})

		t.Run("at grace limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(6), nil) // At grace limit of 6 (5 + 1)
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			atLimit, appErr := th.App.isAtUserLimit()
			require.Nil(t, appErr)
			require.True(t, atLimit)
		})

		t.Run("above grace limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)
			defer th.TearDown()

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(7), nil) // Above grace limit of 6
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

func TestGracePeriodBehavior(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("grace period examples", func(t *testing.T) {
		tests := []struct {
			name               string
			licenseUserLimit   int
			expectedBaseLimit  int64
			expectedGraceLimit int64
		}{
			{
				name:               "zero license users gets zero grace",
				licenseUserLimit:   0,
				expectedBaseLimit:  0,
				expectedGraceLimit: 0, // Special case: 0 users = 0 grace limit
			},
			{
				name:               "small license uses floor (10 users)",
				licenseUserLimit:   10,
				expectedBaseLimit:  10,
				expectedGraceLimit: 11, // 10 + max(5%, 1) = 10 + 1
			},
			{
				name:               "medium license uses percentage (100 users)",
				licenseUserLimit:   100,
				expectedBaseLimit:  100,
				expectedGraceLimit: 105, // 100 + max(5%, 1) = 100 + 5
			},
			{
				name:               "large license uses percentage (1000 users)",
				licenseUserLimit:   1000,
				expectedBaseLimit:  1000,
				expectedGraceLimit: 1050, // 1000 + max(5%, 1) = 1000 + 50
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				th := Setup(t).InitBasic()
				defer th.TearDown()

				license := model.NewTestLicense("")
				license.IsSeatCountEnforced = true
				license.Features.Users = &tt.licenseUserLimit
				th.App.Srv().SetLicense(license)

				serverLimits, appErr := th.App.GetServerLimits()
				require.Nil(t, appErr)

				require.Equal(t, tt.expectedBaseLimit, serverLimits.MaxUsersLimit)
				require.Equal(t, tt.expectedGraceLimit, serverLimits.MaxUsersHardLimit)
			})
		}
	})

	t.Run("unlicensed server has no grace period", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		th.App.Srv().SetLicense(nil)

		serverLimits, appErr := th.App.GetServerLimits()
		require.Nil(t, appErr)

		// Unlicensed servers should not get grace period
		require.Equal(t, int64(2500), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(5000), serverLimits.MaxUsersHardLimit) // No grace, stays at 5000
	})
}

func TestCalculateGraceLimit(t *testing.T) {
	mainHelper.Parallel(t)

	tests := []struct {
		name      string
		baseLimit int64
		expected  int64
	}{
		{
			name:      "zero base limit",
			baseLimit: 0,
			expected:  0, // Special case: 0 users = 0 grace limit
		},
		{
			name:      "one user base limit",
			baseLimit: 1,
			expected:  2, // max(1 * 1.05, 1 + 1) = max(1.05 -> 1, 2) = 2
		},
		{
			name:      "small base limit where floor applies",
			baseLimit: 10,
			expected:  11, // max(10 * 1.05, 10 + 1) = max(10.5 -> 10, 11) = 11
		},
		{
			name:      "small base limit where percentage applies",
			baseLimit: 20,
			expected:  21, // max(20 * 1.05, 20 + 1) = max(21, 21) = 21
		},
		{
			name:      "medium base limit where percentage applies",
			baseLimit: 100,
			expected:  105, // max(100 * 1.05, 100 + 1) = max(105, 101) = 105
		},
		{
			name:      "large base limit where percentage applies",
			baseLimit: 1000,
			expected:  1050, // max(1000 * 1.05, 1000 + 1) = max(1050, 1001) = 1050
		},
		{
			name:      "very large base limit",
			baseLimit: 5000,
			expected:  5250, // max(5000 * 1.05, 5000 + 1) = max(5250, 5001) = 5250
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateGraceLimit(tt.baseLimit)
			require.Equal(t, tt.expected, result, "calculateGraceLimit(%d) = %d, expected %d", tt.baseLimit, result, tt.expected)
		})
	}
}
