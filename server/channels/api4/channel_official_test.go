// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestOfficialChannelValidation(t *testing.T) {
	// Set up official channel admin BEFORE Setup() to ensure sync.Once gets correct value
	officialAdminUsername := "official-admin-" + model.NewId()[0:8]
	cleanup := testutils.ResetIntegrationAdmin(officialAdminUsername)
	defer cleanup()

	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create official admin user
	officialAdmin := th.CreateUser()
	officialAdmin.Username = officialAdminUsername
	var err error
	_, appErr := th.App.UpdateUser(th.Context, officialAdmin, false)
	require.Nil(t, appErr)
	_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, officialAdmin.Id, "")
	require.Nil(t, appErr)

	// Grant team admin role to official admin for restore channel tests
	_, appErr = th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, officialAdmin.Id, model.TeamAdminRoleId+" "+model.TeamUserRoleId)
	require.Nil(t, appErr)

	// Create official channel (created by official admin)
	_, _, err = th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
	require.NoError(t, err)
	officialChannel := &model.Channel{
		DisplayName: "Official Test Channel",
		Name:        "official-test-channel",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	}
	officialChannel, _, err = th.Client.CreateChannel(context.Background(), officialChannel)
	require.NoError(t, err)

	// Create non-official channel (created by regular user)
	th.LoginBasic()
	regularChannel := &model.Channel{
		DisplayName: "Regular Test Channel",
		Name:        "regular-test-channel",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	}
	regularChannel, _, err = th.Client.CreateChannel(context.Background(), regularChannel)
	require.NoError(t, err)

	t.Run("updateChannel - Official Channel Title Restriction", func(t *testing.T) {
		// Debug: Check if channel is really official
		isOfficial, officialErr := th.App.IsOfficialChannel(th.Context, officialChannel)
		if officialErr != nil {
			t.Logf("Error checking if channel is official: %v", officialErr)
		} else {
			t.Logf("Official channel ID: %s, Creator: %s, IsOfficial: %v", officialChannel.Id, officialChannel.CreatorId, isOfficial)

			creator, userErr := th.App.GetUser(officialChannel.CreatorId)
			if userErr != nil {
				t.Logf("Error getting creator user: %v", userErr)
			} else {
				t.Logf("Creator username: %s, Expected: %s", creator.Username, officialAdminUsername)
			}
		}

		// Test 1: Official admin can update title
		_, _, err = th.Client.Login(context.Background(), officialAdmin.Username, "Pa$$word11")
		require.NoError(t, err)
		updatedChannel := *officialChannel
		updatedChannel.DisplayName = "Updated Official Title"
		_, _, updateErr := th.Client.UpdateChannel(context.Background(), &updatedChannel)
		assert.NoError(t, updateErr, "Official admin should be able to update title")

		// Test 2: System admin with permissions cannot update title due to official channel restriction
		th.LoginSystemAdmin()
		currentUserId := th.SystemAdminUser.Id
		t.Logf("System Admin ID: %s, Channel Creator ID: %s", currentUserId, officialChannel.CreatorId)
		updatedChannel.DisplayName = "Unauthorized Title Change"
		_, resp, updateErr := th.SystemAdminClient.UpdateChannel(context.Background(), &updatedChannel)
		assert.Error(t, updateErr)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 3: Official admin can update other properties
		_, _, err = th.Client.Login(context.Background(), officialAdmin.Username, "Pa$$word11")
		require.NoError(t, err)
		updatedChannel.DisplayName = officialChannel.DisplayName // Reset title
		updatedChannel.Purpose = "Updated purpose by official admin"
		_, _, updateErr = th.Client.UpdateChannel(context.Background(), &updatedChannel)
		assert.NoError(t, updateErr, "Official admin should be able to update non-title properties")

		// Test 4: Regular channel works normally with system admin
		th.LoginSystemAdmin()
		updatedRegular := *regularChannel
		updatedRegular.DisplayName = "Updated Regular Title"
		_, _, updateErr = th.SystemAdminClient.UpdateChannel(context.Background(), &updatedRegular)
		assert.NoError(t, updateErr, "Regular channel should work normally")
	})

	t.Run("patchChannel - Official Channel Title Restriction", func(t *testing.T) {
		// Test 1: Official admin can patch title
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		newTitle := "Patched Official Title"
		patch := &model.ChannelPatch{DisplayName: &newTitle}
		_, _, err = th.Client.PatchChannel(context.Background(), officialChannel.Id, patch)
		assert.NoError(t, err, "Official admin should be able to patch title")

		// Test 2: Regular user cannot patch title
		th.LoginBasic()
		unauthorizedTitle := "Unauthorized Patch Title"
		patch = &model.ChannelPatch{DisplayName: &unauthorizedTitle}
		_, resp, err := th.Client.PatchChannel(context.Background(), officialChannel.Id, patch)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 3: System Admin can patch non-title properties on official channel
		th.LoginSystemAdmin()
		newPurpose := "Patched purpose by system admin"
		patch = &model.ChannelPatch{Purpose: &newPurpose}
		_, _, err = th.SystemAdminClient.PatchChannel(context.Background(), officialChannel.Id, patch)
		assert.NoError(t, err, "System Admin should be able to patch non-title properties")

		// Test 4: Regular channel works normally
		regularTitle := "Patched Regular Title"
		patch = &model.ChannelPatch{DisplayName: &regularTitle}
		_, _, err = th.SystemAdminClient.PatchChannel(context.Background(), regularChannel.Id, patch)
		assert.NoError(t, err, "Regular channel should work normally")
	})

	t.Run("addChannelMember - Official Channel Member Management", func(t *testing.T) {
		// Create a new user to add
		newUser := th.CreateUser()
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser.Id, "")
		require.Nil(t, appErr)

		// Test 1: Official admin can add members
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		_, _, err = th.Client.AddChannelMember(context.Background(), officialChannel.Id, newUser.Id)
		assert.NoError(t, err, "Official admin should be able to add members")

		// Remove the member for next test
		_, err = th.Client.RemoveUserFromChannel(context.Background(), officialChannel.Id, newUser.Id)
		assert.NoError(t, err)

		// Test 2: Regular user cannot add members
		th.LoginBasic()
		_, resp, err := th.Client.AddChannelMember(context.Background(), officialChannel.Id, newUser.Id)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 3: Regular channel works normally
		_, _, err = th.Client.AddChannelMember(context.Background(), regularChannel.Id, newUser.Id)
		assert.NoError(t, err, "Regular channel should work normally")
	})

	t.Run("removeChannelMember - Official Channel Member Management", func(t *testing.T) {
		// Add a user to remove
		testUser := th.CreateUser()
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, testUser.Id, "")
		require.Nil(t, appErr)
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		_, _, err = th.Client.AddChannelMember(context.Background(), officialChannel.Id, testUser.Id)
		require.NoError(t, err)

		// Test 1: Official admin can remove members
		_, err = th.Client.RemoveUserFromChannel(context.Background(), officialChannel.Id, testUser.Id)
		assert.NoError(t, err, "Official admin should be able to remove members")

		// Re-add for next test
		_, _, err4 := th.Client.AddChannelMember(context.Background(), officialChannel.Id, testUser.Id)
		require.NoError(t, err4)

		// Test 2: Regular user cannot remove other members
		th.LoginBasic()
		resp, err := th.Client.RemoveUserFromChannel(context.Background(), officialChannel.Id, testUser.Id)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 3: Regular user tries to add members to official channel - should fail
		testUser, _, err5 := th.Client.CreateUser(context.Background(), &model.User{
			Email:    th.GenerateTestEmail(),
			Username: "testuser-" + model.NewId(),
			Password: "password123",
		})
		require.NoError(t, err5)

		th.LoginBasic2()
		_, resp, err = th.Client.AddChannelMember(context.Background(), officialChannel.Id, testUser.Id)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("deleteChannel - Official Channel Archive Restriction", func(t *testing.T) {
		// Create a temporary official channel for deletion test
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		tempOfficial := &model.Channel{
			DisplayName: "Temp Official Channel",
			Name:        "temp-official-" + model.NewId()[0:8],
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		tempOfficial, _, err2 := th.Client.CreateChannel(context.Background(), tempOfficial)
		require.NoError(t, err2)

		// Test 1: Regular user cannot delete official channel
		th.LoginBasic()
		resp, err := th.Client.DeleteChannel(context.Background(), tempOfficial.Id)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 2: Official admin can delete official channel
		_, _, err3 := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err3)
		_, err = th.Client.DeleteChannel(context.Background(), tempOfficial.Id)
		assert.NoError(t, err, "Official admin should be able to delete channel")
	})

	t.Run("restoreChannel - Official Channel Restore Restriction", func(t *testing.T) {
		// Create and delete a temporary official channel for restore test
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		tempOfficial := &model.Channel{
			DisplayName: "Temp Official Restore",
			Name:        "temp-official-restore-" + model.NewId()[0:8],
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		tempOfficial, _, err2 := th.Client.CreateChannel(context.Background(), tempOfficial)
		require.NoError(t, err2)

		// Delete the channel
		_, err = th.Client.DeleteChannel(context.Background(), tempOfficial.Id)
		require.NoError(t, err)

		// Test 1: Regular user cannot restore official channel
		th.LoginBasic()
		_, resp, err := th.Client.RestoreChannel(context.Background(), tempOfficial.Id)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 2: Official channel creator can restore official channel
		_, _, err3 := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err3)
		_, _, err = th.Client.RestoreChannel(context.Background(), tempOfficial.Id)
		assert.NoError(t, err, "Official channel creator should be able to restore channel")
	})

	t.Run("updateChannelMemberRoles - Official Channel Role Management", func(t *testing.T) {
		// Create test user for role changes
		testUser := th.CreateUser()

		// Add user to team first (required before adding to channel)
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, testUser.Id, "")
		require.Nil(t, appErr)

		// First add the user to the official channel as the creator
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		_, _, err2 := th.Client.AddChannelMember(context.Background(), officialChannel.Id, testUser.Id)
		require.NoError(t, err2)

		// Test: Non-creator System Admin tries to change member roles in official channel (should fail)
		th.LoginSystemAdmin()
		newRoles := "channel_user channel_admin"
		_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), officialChannel.Id, testUser.Id, newRoles)
		require.Error(t, err)
		if appErr, ok := err.(*model.AppError); ok {
			require.Equal(t, "api.channel.update_member_roles.official_channel.forbidden", appErr.Id)
		} else {
			t.Fatalf("Expected AppError, got %T", err)
		}

		// Test: Creator user changes member roles in official channel (should succeed)
		_, _, err3 := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err3)
		resp, err := th.Client.UpdateChannelRoles(context.Background(), officialChannel.Id, testUser.Id, "channel_user")
		require.NoError(t, err)
		require.NotNil(t, resp)

		// Test: Regular channel role management works normally
		th.LoginSystemAdmin()
		_, err = th.SystemAdminClient.UpdateChannelRoles(context.Background(), regularChannel.Id, th.BasicUser.Id, "channel_user channel_admin")
		require.NoError(t, err)
	})

	t.Run("updateChannelMemberSchemeRoles - Official Channel Scheme Role Management", func(t *testing.T) {
		// Add a test user to the official channel
		testUser := th.CreateUser()
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, testUser.Id, "")
		require.Nil(t, appErr)
		_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
		require.NoError(t, err)
		_, _, err2 := th.Client.AddChannelMember(context.Background(), officialChannel.Id, testUser.Id)
		require.NoError(t, err2)

		// Test 1: Official admin can update scheme roles
		schemeRoles := &model.SchemeRoles{
			SchemeAdmin: true,
			SchemeUser:  true,
			SchemeGuest: false,
		}
		_, err3 := th.Client.UpdateChannelMemberSchemeRoles(context.Background(), officialChannel.Id, testUser.Id, schemeRoles)
		assert.NoError(t, err3, "Official admin should be able to update scheme roles")

		// Test 2: Non-creator cannot update scheme roles
		th.LoginSystemAdmin()
		schemeRoles.SchemeAdmin = false
		resp, err := th.SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), officialChannel.Id, testUser.Id, schemeRoles)
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)

		// Test 3: Regular channel works normally - use SystemAdmin for consistency
		th.LoginSystemAdmin()
		_, _, appErr = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, appErr)
		_, _, err4 := th.SystemAdminClient.AddChannelMember(context.Background(), regularChannel.Id, th.BasicUser.Id)
		require.NoError(t, err4)
		_, err = th.SystemAdminClient.UpdateChannelMemberSchemeRoles(context.Background(), regularChannel.Id, th.BasicUser.Id, schemeRoles)
		assert.NoError(t, err, "Regular channel should work normally")
	})

	t.Run("Edge Cases and Error Handling", func(t *testing.T) {
		// Test with INTEGRATION_ADMIN_USERNAME not set
		os.Unsetenv("INTEGRATION_ADMIN_USERNAME")

		// Should still work for regular operations but not identify as official
		th.LoginBasic()
		updatedChannel := *regularChannel
		updatedChannel.DisplayName = "Title change without env var"
		_, _, err := th.Client.UpdateChannel(context.Background(), &updatedChannel)
		assert.NoError(t, err, "Regular operations should work without env var")

		// Reset env var
		os.Setenv("INTEGRATION_ADMIN_USERNAME", officialAdminUsername)

		// Test with non-existent user ID in channel creation
		nonExistentUser := &model.User{
			Id: model.NewId(),
		}
		tempChannel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "test-channel-" + model.NewId()[0:8],
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
			CreatorId:   nonExistentUser.Id,
		}

		// This should be handled gracefully by the IsOfficialChannel function
		// (it returns false for non-existent creators)
		th.LoginBasic()
		tempChannel.CreatorId = th.BasicUser.Id // Set valid creator for creation
		tempChannel, _, err = th.Client.CreateChannel(context.Background(), tempChannel)
		require.NoError(t, err)

		// Update with non-existent creator should not crash
		tempChannel.CreatorId = nonExistentUser.Id
		updatedTemp := *tempChannel
		updatedTemp.DisplayName = "Updated by regular user"
		_, _, err = th.Client.UpdateChannel(context.Background(), &updatedTemp)
		assert.NoError(t, err, "Should handle non-existent creator gracefully")
	})
}

func TestIntegrationAdminConfiguration(t *testing.T) {
	t.Run("IsOfficialChannel function behavior without environment variable", func(t *testing.T) {
		// Reset the integration admin cache and clear environment variable
		cleanup := testutils.ResetIntegrationAdmin("")
		defer cleanup()

		// Reset the app cache as well
		th := Setup(t).InitBasic()
		defer th.TearDown()
		th.App.ResetIntegrationAdminUsernameCache()

		// Create a test channel
		th.LoginBasic()
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "test-channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		channel, _, err := th.Client.CreateChannel(context.Background(), channel)
		require.NoError(t, err)

		// Test that IsOfficialChannel returns false when no admin is configured
		isOfficial, officialErr := th.App.IsOfficialChannel(th.Context, channel)
		t.Logf("IsOfficialChannel result: isOfficial=%v, err=%v", isOfficial, officialErr)
		require.Nil(t, officialErr)
		assert.False(t, isOfficial)

		// Note: Normal API operations will receive 500 errors when INTEGRATION_ADMIN_USERNAME
		// is not configured, which is the expected behavior to ensure proper configuration
	})
}

// Benchmark tests for performance impact
func BenchmarkOfficialChannelValidation(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	// Set up official admin
	officialAdminUsername := "bench-admin"
	os.Setenv("INTEGRATION_ADMIN_USERNAME", officialAdminUsername)
	defer os.Unsetenv("INTEGRATION_ADMIN_USERNAME")

	officialAdmin := th.CreateUser()
	officialAdmin.Username = officialAdminUsername
	_, appErr2 := th.App.UpdateUser(th.Context, officialAdmin, false)
	if appErr2 != nil {
		b.Fatal(appErr2)
	}
	_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, officialAdmin.Id, "")
	if appErr != nil {
		b.Fatal(appErr)
	}

	// Create official channel
	_, _, err := th.Client.Login(context.Background(), officialAdmin.Email, "Pa$$word11")
	if err != nil {
		b.Fatal(err)
	}
	officialChannel := &model.Channel{
		DisplayName: "Benchmark Official Channel",
		Name:        "benchmark-official",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
	}
	officialChannel, _, _ = th.Client.CreateChannel(context.Background(), officialChannel)

	b.ResetTimer()

	b.Run("UpdateChannel Performance", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			updated := *officialChannel
			updated.DisplayName = fmt.Sprintf("Updated Title %d", i)
			_, _, _ = th.Client.UpdateChannel(context.Background(), &updated)
		}
	})
}
