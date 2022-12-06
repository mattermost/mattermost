// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

/* Temporarily comment out until MM-11108
func TestAppRace(t *testing.T) {
	for i := 0; i < 10; i++ {
		a, err := New()
		require.NoError(t, err)
		a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
		serverErr := a.StartServer()
		require.NoError(t, serverErr)
		a.Srv().Shutdown()
	}
}
*/

var allPermissionIDs []string

func init() {
	for _, perm := range model.AllPermissions {
		allPermissionIDs = append(allPermissionIDs, perm.Id)
	}
}

func TestUnitUpdateConfig(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)
	mockLicenseStore := mocks.LicenseStore{}
	mockLicenseStore.On("Get", "").Return(&model.LicenseRecord{}, nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("License").Return(&mockLicenseStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	prev := *th.App.Config().ServiceSettings.SiteURL

	th.App.AddConfigListener(func(old, current *model.Config) {
		assert.Equal(t, prev, *old.ServiceSettings.SiteURL)
		assert.Equal(t, "http://foo.com", *current.ServiceSettings.SiteURL)
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://foo.com"
	})
}

func TestDoAdvancedPermissionsMigration(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.ResetRoleMigration()

	th.App.DoAdvancedPermissionsMigration()

	roleNames := []string{
		"system_user",
		"system_admin",
		"team_user",
		"team_admin",
		"channel_user",
		"channel_admin",
		"system_post_all",
		"system_post_all_public",
		"system_user_access_token",
		"team_post_all",
		"team_post_all_public",
		"playbook_admin",
		"playbook_member",
		"run_admin",
		"run_member",
	}

	roles1, err1 := th.App.GetRolesByNames(roleNames)
	assert.Nil(t, err1)
	assert.Equal(t, len(roles1), len(roleNames))

	expected1 := map[string][]string{
		"channel_user": {
			model.PermissionReadChannel.Id,
			model.PermissionAddReaction.Id,
			model.PermissionRemoveReaction.Id,
			model.PermissionManagePublicChannelMembers.Id,
			model.PermissionUploadFile.Id,
			model.PermissionGetPublicLink.Id,
			model.PermissionCreatePost.Id,
			model.PermissionUseChannelMentions.Id,
			model.PermissionUseSlashCommands.Id,
			model.PermissionManagePublicChannelProperties.Id,
			model.PermissionDeletePublicChannel.Id,
			model.PermissionManagePrivateChannelProperties.Id,
			model.PermissionDeletePrivateChannel.Id,
			model.PermissionManagePrivateChannelMembers.Id,
			model.PermissionDeletePost.Id,
			model.PermissionEditPost.Id,
		},
		"channel_admin": {
			model.PermissionManageChannelRoles.Id,
			model.PermissionUseGroupMentions.Id,
		},
		"team_user": {
			model.PermissionListTeamChannels.Id,
			model.PermissionJoinPublicChannels.Id,
			model.PermissionReadPublicChannel.Id,
			model.PermissionViewTeam.Id,
			model.PermissionCreatePublicChannel.Id,
			model.PermissionCreatePrivateChannel.Id,
			model.PermissionInviteUser.Id,
			model.PermissionAddUserToTeam.Id,
		},
		"team_post_all": {
			model.PermissionCreatePost.Id,
			model.PermissionUseChannelMentions.Id,
		},
		"team_post_all_public": {
			model.PermissionCreatePostPublic.Id,
			model.PermissionUseChannelMentions.Id,
		},
		"team_admin": {
			model.PermissionRemoveUserFromTeam.Id,
			model.PermissionManageTeam.Id,
			model.PermissionImportTeam.Id,
			model.PermissionManageTeamRoles.Id,
			model.PermissionManageChannelRoles.Id,
			model.PermissionManageOthersIncomingWebhooks.Id,
			model.PermissionManageOthersOutgoingWebhooks.Id,
			model.PermissionManageSlashCommands.Id,
			model.PermissionManageOthersSlashCommands.Id,
			model.PermissionManageIncomingWebhooks.Id,
			model.PermissionManageOutgoingWebhooks.Id,
			model.PermissionConvertPublicChannelToPrivate.Id,
			model.PermissionConvertPrivateChannelToPublic.Id,
			model.PermissionDeletePost.Id,
			model.PermissionDeleteOthersPosts.Id,
		},
		"system_user": {
			model.PermissionListPublicTeams.Id,
			model.PermissionJoinPublicTeams.Id,
			model.PermissionCreateDirectChannel.Id,
			model.PermissionCreateGroupChannel.Id,
			model.PermissionViewMembers.Id,
			model.PermissionCreateTeam.Id,
			model.PermissionCreateCustomGroup.Id,
			model.PermissionEditCustomGroup.Id,
			model.PermissionDeleteCustomGroup.Id,
			model.PermissionRestoreCustomGroup.Id,
			model.PermissionManageCustomGroupMembers.Id,
		},
		"system_post_all": {
			model.PermissionCreatePost.Id,
			model.PermissionUseChannelMentions.Id,
		},
		"system_post_all_public": {
			model.PermissionCreatePostPublic.Id,
			model.PermissionUseChannelMentions.Id,
		},
		"system_user_access_token": {
			model.PermissionCreateUserAccessToken.Id,
			model.PermissionReadUserAccessToken.Id,
			model.PermissionRevokeUserAccessToken.Id,
		},
		"system_admin": allPermissionIDs,
	}
	assert.Contains(t, allPermissionIDs, model.PermissionManageSharedChannels.Id, "manage_shared_channels permission not found")
	assert.Contains(t, allPermissionIDs, model.PermissionManageSecureConnections.Id, "manage_secure_connections permission not found")

	// Check the migration matches what's expected.
	for name, permissions := range expected1 {
		role, err := th.App.GetRoleByName(context.Background(), name)
		assert.Nil(t, err)
		assert.Equal(t, role.Permissions, permissions, fmt.Sprintf("role %q didn't match", name))
	}

	th.App.Srv().SetLicense(model.NewTestLicense())

	// Check the migration doesn't change anything if run again.
	th.App.DoAdvancedPermissionsMigration()

	roles2, err2 := th.App.GetRolesByNames(roleNames)
	assert.Nil(t, err2)
	assert.Equal(t, len(roles2), len(roleNames))

	for name, permissions := range expected1 {
		role, err := th.App.GetRoleByName(context.Background(), name)
		assert.Nil(t, err)
		assert.Equal(t, permissions, role.Permissions)
	}
}

func TestDoEmojisPermissionsMigration(t *testing.T) {
	th := SetupWithoutPreloadMigrations(t)
	defer th.TearDown()

	expectedSystemAdmin := allPermissionIDs
	sort.Strings(expectedSystemAdmin)

	th.ResetEmojisMigration()
	th.App.DoEmojisPermissionsMigration()

	role3, err3 := th.App.GetRoleByName(context.Background(), model.SystemUserRoleId)
	assert.Nil(t, err3)
	expected3 := []string{
		model.PermissionCreateCustomGroup.Id,
		model.PermissionEditCustomGroup.Id,
		model.PermissionDeleteCustomGroup.Id,
		model.PermissionRestoreCustomGroup.Id,
		model.PermissionManageCustomGroupMembers.Id,
		model.PermissionListPublicTeams.Id,
		model.PermissionJoinPublicTeams.Id,
		model.PermissionCreateDirectChannel.Id,
		model.PermissionCreateGroupChannel.Id,
		model.PermissionCreateTeam.Id,
		model.PermissionCreateEmojis.Id,
		model.PermissionDeleteEmojis.Id,
		model.PermissionViewMembers.Id,
	}
	sort.Strings(expected3)
	sort.Strings(role3.Permissions)
	assert.Equal(t, expected3, role3.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.SystemUserRoleId))

	systemAdmin2, systemAdminErr2 := th.App.GetRoleByName(context.Background(), model.SystemAdminRoleId)
	assert.Nil(t, systemAdminErr2)
	sort.Strings(systemAdmin2.Permissions)
	assert.Equal(t, expectedSystemAdmin, systemAdmin2.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.SystemAdminRoleId))
}

func TestDBHealthCheckWriteAndDelete(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	expectedKey := "health_check_" + th.App.GetClusterId()
	assert.Equal(t, expectedKey, th.App.dbHealthCheckKey())

	_, err := th.App.Srv().Store().System().GetByName(expectedKey)
	assert.Error(t, err)

	err = th.App.DBHealthCheckWrite()
	assert.NoError(t, err)

	systemVal, err := th.App.Srv().Store().System().GetByName(expectedKey)
	assert.NoError(t, err)
	assert.NotNil(t, systemVal)

	err = th.App.DBHealthCheckDelete()
	assert.NoError(t, err)

	_, err = th.App.Srv().Store().System().GetByName(expectedKey)
	assert.Error(t, err)
}
