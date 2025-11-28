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

func TestUpdateActiveWithUserLimits(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("unlicensed server", func(t *testing.T) {
		t.Run("reactivation allowed below hard limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			th.App.Srv().SetLicense(nil)

			// Deactivate user
			deactivatedUser, appErr := th.App.UpdateActive(th.Context, th.BasicUser, false)
			require.Nil(t, appErr)
			require.NotEqual(t, 0, deactivatedUser.DeleteAt)

			// Reactivate user (should succeed - below hard limit)
			updatedUser, appErr := th.App.UpdateActive(th.Context, th.BasicUser, true)
			require.Nil(t, appErr)
			require.Equal(t, int64(0), updatedUser.DeleteAt)
		})

		t.Run("reactivation blocked at hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			th.App.Srv().SetLicense(nil)

			// Mock user count at hard limit
			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(5000), nil) // At 5000 hard limit
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			user := &model.User{
				Id:       model.NewId(),
				Email:    "test@example.com",
				Username: "testuser",
				DeleteAt: model.GetMillis(),
			}

			// Try to reactivate user (should fail)
			updatedUser, appErr := th.App.UpdateActive(th.Context, user, true)
			require.NotNil(t, appErr)
			require.Nil(t, updatedUser)
			require.Equal(t, "app.user.update_active.user_limit.exceeded", appErr.Id)
		})

		t.Run("reactivation blocked above hard limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			th.App.Srv().SetLicense(nil)

			// Mock user count to exceed hard limit
			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(6000), nil) // Over 5000 hard limit
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			user := &model.User{
				Id:       model.NewId(),
				Email:    "test@example.com",
				Username: "testuser",
				DeleteAt: model.GetMillis(),
			}

			// Try to reactivate user (should fail)
			updatedUser, appErr := th.App.UpdateActive(th.Context, user, true)
			require.NotNil(t, appErr)
			require.Nil(t, updatedUser)
			require.Equal(t, "app.user.update_active.user_limit.exceeded", appErr.Id)
		})
	})

	t.Run("licensed server with seat count enforcement", func(t *testing.T) {
		t.Run("reactivation allowed below limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 100
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Deactivate user
			_, appErr := th.App.UpdateActive(th.Context, th.BasicUser, false)
			require.Nil(t, appErr)

			// Reactivate user (should succeed - below limit)
			updatedUser, appErr := th.App.UpdateActive(th.Context, th.BasicUser, true)
			require.Nil(t, appErr)
			require.Equal(t, int64(0), updatedUser.DeleteAt)
		})

		t.Run("reactivation blocked at grace limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			userLimit := 100
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Mock user count at grace limit (105 = 100 + 5% grace period)
			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(105), nil) // At grace limit
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			user := &model.User{
				Id:       model.NewId(),
				Email:    "test@example.com",
				Username: "testuser",
				DeleteAt: model.GetMillis(),
			}

			// Try to reactivate user (should fail)
			updatedUser, appErr := th.App.UpdateActive(th.Context, user, true)
			require.NotNil(t, appErr)
			require.Nil(t, updatedUser)
			require.Equal(t, "app.user.update_active.license_user_limit.exceeded", appErr.Id)
		})

		t.Run("reactivation allowed at base limit but below grace limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5 // Grace limit will be 6 (5 + 1 minimum)
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// InitBasic creates 3 users, create 2 more to reach base limit of 5
			th.CreateUser(t)
			th.CreateUser(t)

			// Deactivate a user
			_, appErr := th.App.UpdateActive(th.Context, th.BasicUser, false)
			require.Nil(t, appErr)

			// Reactivate user (should succeed - we're at base limit 5 but below grace limit 6)
			updatedUser, appErr := th.App.UpdateActive(th.Context, th.BasicUser, true)
			require.Nil(t, appErr)
			require.Equal(t, int64(0), updatedUser.DeleteAt)
		})

		t.Run("reactivation blocked above grace limit", func(t *testing.T) {
			th := SetupWithStoreMock(t)

			userLimit := 100
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = true
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Mock user count above grace limit (106 > 105 grace limit)
			mockUserStore := storemocks.UserStore{}
			mockUserStore.On("Count", mock.Anything).Return(int64(106), nil) // Above grace limit
			mockStore := th.App.Srv().Store().(*storemocks.Store)
			mockStore.On("User").Return(&mockUserStore)

			user := &model.User{
				Id:       model.NewId(),
				Email:    "test@example.com",
				Username: "testuser",
				DeleteAt: model.GetMillis(),
			}

			// Try to reactivate user (should fail)
			updatedUser, appErr := th.App.UpdateActive(th.Context, user, true)
			require.NotNil(t, appErr)
			require.Nil(t, updatedUser)
			require.Equal(t, "app.user.update_active.license_user_limit.exceeded", appErr.Id)
		})
	})

	t.Run("licensed server without seat count enforcement", func(t *testing.T) {
		t.Run("reactivation allowed below unenforced limit", func(t *testing.T) {
			th := Setup(t).InitBasic(t)

			userLimit := 5
			license := model.NewTestLicense("")
			license.IsSeatCountEnforced = false
			license.Features.Users = &userLimit
			th.App.Srv().SetLicense(license)

			// Create 2 additional users to have 3 total (below limit of 5)
			th.CreateUser(t)
			th.CreateUser(t)

			// Deactivate user
			_, appErr := th.App.UpdateActive(th.Context, th.BasicUser, false)
			require.Nil(t, appErr)

			// Reactivate user (should succeed - enforcement disabled and below limit)
			updatedUser, appErr := th.App.UpdateActive(th.Context, th.BasicUser, true)
			require.Nil(t, appErr)
			require.Equal(t, int64(0), updatedUser.DeleteAt)
		})

		t.Run("reactivation allowed at unenforced limit", func(t *testing.T) {
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

			// Create a user and then deactivate them
			testUser := th.CreateUser(t)
			_, appErr := th.App.UpdateActive(th.Context, testUser, false)
			require.Nil(t, appErr)

			// Reactivate user (should succeed - enforcement disabled)
			updatedUser, appErr := th.App.UpdateActive(th.Context, testUser, true)
			require.Nil(t, appErr)
			require.Equal(t, int64(0), updatedUser.DeleteAt)
		})

		t.Run("reactivation allowed above unenforced limit", func(t *testing.T) {
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

			// Create a user and then deactivate them
			testUser := th.CreateUser(t)
			_, appErr := th.App.UpdateActive(th.Context, testUser, false)
			require.Nil(t, appErr)

			// Reactivate user (should succeed - enforcement disabled)
			updatedUser, appErr := th.App.UpdateActive(th.Context, testUser, true)
			require.Nil(t, appErr)
			require.Equal(t, int64(0), updatedUser.DeleteAt)
		})
	})
}

func TestCreateUserOrGuestSeatCountEnforcement(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("seat count enforced - allows user creation when under limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 5
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		th.App.Srv().SetLicense(license)

		// InitBasic creates 3 users, so we're under the limit of 5
		user := &model.User{
			Email:         "TestCreateUserOrGuest@example.com",
			Username:      "username_123",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.NotNil(t, createdUser)
		require.Equal(t, "username_123", createdUser.Username)
	})

	t.Run("seat count enforced - blocks user creation when at limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 5
		extraUsers := 1
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		th.App.Srv().SetLicense(license)

		// Create 3 additional users to reach the hard limit of 6 (3 from InitBasic + 3)
		// Hard limit = 5 base users + 1 extra user = 6 total
		th.CreateUser(t)
		th.CreateUser(t)
		th.CreateUser(t)

		// Now at hard limit - attempting to create another user should fail
		user := &model.User{
			Email:         "TestSeatCount@example.com",
			Username:      "seat_test_user",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.NotNil(t, appErr)
		require.Nil(t, createdUser)
		require.Equal(t, "api.user.create_user.license_user_limits.exceeded", appErr.Id)
	})

	t.Run("seat count enforced - blocks user creation when over limit", func(t *testing.T) {
		// Use mocks for this test since we can't actually create users beyond the safety limit
		th := SetupWithStoreMock(t)

		userLimit := 5
		extraUsers := 0
		currentUserCount := int64(6) // Over limit (limit=5, hard limit=5+0=5, current=6)

		mockUserStore := storemocks.UserStore{}
		mockUserStore.On("Count", mock.Anything).Return(currentUserCount, nil)
		mockUserStore.On("IsEmpty", true).Return(false, nil)

		mockGroupStore := storemocks.GroupStore{}
		mockGroupStore.On("GetByName", "seat_test_user", mock.Anything).Return(nil, nil)

		mockStore := th.App.Srv().Store().(*storemocks.Store)
		mockStore.On("User").Return(&mockUserStore)
		mockStore.On("Group").Return(&mockGroupStore)

		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		th.App.Srv().SetLicense(license)

		user := &model.User{
			Email:         "TestSeatCount@example.com",
			Username:      "seat_test_user",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.NotNil(t, appErr)
		require.Nil(t, createdUser)
		require.Equal(t, "api.user.create_user.license_user_limits.exceeded", appErr.Id)
	})

	t.Run("seat count not enforced - allows user creation even when over limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 5
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = false
		license.Features.Users = &userLimit
		th.App.Srv().SetLicense(license)

		// Create additional users to exceed the limit (3 from InitBasic + 3 = 6, over limit of 5)
		th.CreateUser(t)
		th.CreateUser(t)
		th.CreateUser(t)

		// Should still allow creation since enforcement is disabled
		user := &model.User{
			Email:         "TestSeatCount@example.com",
			Username:      "seat_test_user",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.NotNil(t, createdUser)
		require.Equal(t, "seat_test_user", createdUser.Username)
	})

	t.Run("no license - uses existing hard limit logic", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		th.App.Srv().SetLicense(nil)

		// Should allow creation under hard limit
		user := &model.User{
			Email:         "TestSeatCount@example.com",
			Username:      "seat_test_user",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.NotNil(t, createdUser)
		require.Equal(t, "seat_test_user", createdUser.Username)
	})

	t.Run("license without Users feature - no seat count enforcement", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = nil
		th.App.Srv().SetLicense(license)

		// Should allow creation since Users feature is nil
		user := &model.User{
			Email:         "TestSeatCount@example.com",
			Username:      "seat_test_user",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, false)
		require.Nil(t, appErr)
		require.NotNil(t, createdUser)
		require.Equal(t, "seat_test_user", createdUser.Username)
	})

	t.Run("guest creation with seat count enforcement - blocks when at limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 5
		extraUsers := 1
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		th.App.Srv().SetLicense(license)

		// Create 3 additional users to reach the hard limit of 6 (3 from InitBasic + 3)
		// Hard limit = 5 base users + 1 extra user = 6 total
		th.CreateUser(t)
		th.CreateUser(t)
		th.CreateUser(t)

		// Now at hard limit - attempting to create a guest should fail
		user := &model.User{
			Email:         "TestSeatCountGuest@example.com",
			Username:      "seat_test_guest",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, true)
		require.NotNil(t, appErr)
		require.Nil(t, createdUser)
		require.Equal(t, "api.user.create_user.license_user_limits.exceeded", appErr.Id)
	})

	t.Run("guest creation with seat count enforcement - allows when under limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		userLimit := 5
		extraUsers := 0
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		th.App.Srv().SetLicense(license)

		// InitBasic creates 3 users, so we're under the limit of 5
		user := &model.User{
			Email:         "TestSeatCountGuest@example.com",
			Username:      "seat_test_guest",
			Password:      "Password1",
			EmailVerified: true,
		}

		createdUser, appErr := th.App.createUserOrGuest(th.Context, user, true)
		require.Nil(t, appErr)
		require.NotNil(t, createdUser)
		require.Equal(t, "seat_test_guest", createdUser.Username)
	})
}
