// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetServerLimits(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("admin users can get full server limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set up unlicensed server
		th.App.Srv().SetLicense(nil)

		// Test with system admin
		serverLimits, resp, err := th.SystemAdminClient.GetServerLimits(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Should have full access to all limits data
		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(200), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(250), serverLimits.MaxUsersHardLimit)
		require.Equal(t, int64(0), serverLimits.PostHistoryLimit)
		require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
	})

	t.Run("non-admin users get limited data with licensed server", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set up licensed server with user limits
		userLimit := 100
		extraUsers := 10
		postHistoryLimit := int64(10000)
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.ExtraUsers = &extraUsers
		license.Limits = &model.LicenseLimits{
			PostHistory: postHistoryLimit,
		}
		th.App.Srv().SetLicense(license)

		// Test with regular user
		serverLimits, resp, err := th.Client.GetServerLimits(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Non-admin users should get zero for user count data (privacy)
		require.Equal(t, int64(0), serverLimits.ActiveUserCount)
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit)

		// But should get message history limits (needed for UI)
		require.Equal(t, postHistoryLimit, serverLimits.PostHistoryLimit)
	})

	t.Run("admin users get full limts", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set up licensed server with post history limits
		userLimit := 100
		postHistoryLimit := int64(10000)
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.Limits = &model.LicenseLimits{
			PostHistory: postHistoryLimit,
		}
		th.App.Srv().SetLicense(license)

		// Test with system admin
		serverLimits, resp, err := th.SystemAdminClient.GetServerLimits(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Should have full access to all limits data
		require.Greater(t, serverLimits.ActiveUserCount, int64(0))
		require.Equal(t, int64(100), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(100), serverLimits.MaxUsersHardLimit)

		// Should have post history limits
		require.Equal(t, postHistoryLimit, serverLimits.PostHistoryLimit)
		// LastAccessiblePostTime may be 0 if no posts exist in test database, which is expected
		require.GreaterOrEqual(t, serverLimits.LastAccessiblePostTime, int64(0))
	})

	t.Run("non-admin users get post history limits when configured", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set up licensed server with post history limits
		userLimit := 100
		postHistoryLimit := int64(10000)
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.Limits = &model.LicenseLimits{
			PostHistory: postHistoryLimit,
		}
		th.App.Srv().SetLicense(license)

		// Test with regular user
		serverLimits, resp, err := th.Client.GetServerLimits(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Non-admin users should get zero for user count data (privacy)
		require.Equal(t, int64(0), serverLimits.ActiveUserCount)
		require.Equal(t, int64(0), serverLimits.MaxUsersLimit)
		require.Equal(t, int64(0), serverLimits.MaxUsersHardLimit)

		// But should get post history limits (needed for UI)
		require.Equal(t, postHistoryLimit, serverLimits.PostHistoryLimit)

		// LastAccessiblePostTime may be 0 if no posts exist in test database, which is expected
		require.GreaterOrEqual(t, serverLimits.LastAccessiblePostTime, int64(0))
	})

	t.Run("zero post history limit shows no limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set up licensed server with zero post history limit
		userLimit := 100
		postHistoryLimit := int64(0)
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.Limits = &model.LicenseLimits{
			PostHistory: postHistoryLimit,
		}
		th.App.Srv().SetLicense(license)

		// Test with both admin and regular user
		clients := []*model.Client4{th.SystemAdminClient, th.Client}
		for i, client := range clients {
			serverLimits, resp, err := client.GetServerLimits(context.Background())
			require.NoError(t, err, "Failed for client %d", i)
			CheckOKStatus(t, resp)

			// Should have no post history limits
			require.Equal(t, int64(0), serverLimits.PostHistoryLimit)

			require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
		}
	})

	t.Run("license with nil Limits shows no post history limits", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Set up licensed server with nil Limits
		userLimit := 100
		license := model.NewTestLicense("")
		license.IsSeatCountEnforced = true
		license.Features.Users = &userLimit
		license.Limits = nil // Explicitly set to nil
		th.App.Srv().SetLicense(license)

		// Test with both admin and regular user
		clients := []*model.Client4{th.SystemAdminClient, th.Client}
		for i, client := range clients {
			serverLimits, resp, err := client.GetServerLimits(context.Background())
			require.NoError(t, err, "Failed for client %d", i)
			CheckOKStatus(t, resp)

			// Should have no post history limits
			require.Equal(t, int64(0), serverLimits.PostHistoryLimit)

			require.Equal(t, int64(0), serverLimits.LastAccessiblePostTime)
		}
	})
}
