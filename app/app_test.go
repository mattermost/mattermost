// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

/* Temporarily comment out until MM-11108
func TestAppRace(t *testing.T) {
	for i := 0; i < 10; i++ {
		a, err := New()
		require.NoError(t, err)
		a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
		serverErr := a.StartServer()
		require.NoError(t, serverErr)
		a.Shutdown()
	}
}
*/

func TestUpdateConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

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
	}

	roles1, err1 := th.App.GetRolesByNames(roleNames)
	assert.Nil(t, err1)
	assert.Equal(t, len(roles1), len(roleNames))

	expected1 := map[string][]string{
		"channel_user": {
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_ADD_REACTION.Id,
			model.PERMISSION_REMOVE_REACTION.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_UPLOAD_FILE.Id,
			model.PERMISSION_GET_PUBLIC_LINK.Id,
			model.PERMISSION_CREATE_POST.Id,
			model.PERMISSION_USE_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_EDIT_POST.Id,
		},
		"channel_admin": {
			model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		},
		"team_user": {
			model.PERMISSION_LIST_TEAM_CHANNELS.Id,
			model.PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			model.PERMISSION_READ_PUBLIC_CHANNEL.Id,
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_INVITE_USER.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
		},
		"team_post_all": {
			model.PERMISSION_CREATE_POST.Id,
		},
		"team_post_all_public": {
			model.PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		"team_admin": {
			model.PERMISSION_REMOVE_USER_FROM_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM.Id,
			model.PERMISSION_IMPORT_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM_ROLES.Id,
			model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
			model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		},
		"system_user": {
			model.PERMISSION_LIST_PUBLIC_TEAMS.Id,
			model.PERMISSION_JOIN_PUBLIC_TEAMS.Id,
			model.PERMISSION_CREATE_DIRECT_CHANNEL.Id,
			model.PERMISSION_CREATE_GROUP_CHANNEL.Id,
			model.PERMISSION_VIEW_MEMBERS.Id,
			model.PERMISSION_CREATE_TEAM.Id,
		},
		"system_post_all": {
			model.PERMISSION_CREATE_POST.Id,
		},
		"system_post_all_public": {
			model.PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		"system_user_access_token": {
			model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
		},
		"system_admin": {
			model.PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE.Id,
			model.PERMISSION_MANAGE_SYSTEM.Id,
			model.PERMISSION_MANAGE_ROLES.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH.Id,
			model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_EDIT_OTHER_USERS.Id,
			model.PERMISSION_EDIT_OTHERS_POSTS.Id,
			model.PERMISSION_MANAGE_OAUTH.Id,
			model.PERMISSION_INVITE_USER.Id,
			model.PERMISSION_INVITE_GUEST.Id,
			model.PERMISSION_PROMOTE_GUEST.Id,
			model.PERMISSION_DEMOTE_TO_GUEST.Id,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
			model.PERMISSION_CREATE_TEAM.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
			model.PERMISSION_LIST_USERS_WITHOUT_TEAM.Id,
			model.PERMISSION_MANAGE_JOBS.Id,
			model.PERMISSION_CREATE_POST_PUBLIC.Id,
			model.PERMISSION_CREATE_POST_EPHEMERAL.Id,
			model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_CREATE_BOT.Id,
			model.PERMISSION_READ_BOTS.Id,
			model.PERMISSION_READ_OTHERS_BOTS.Id,
			model.PERMISSION_MANAGE_BOTS.Id,
			model.PERMISSION_MANAGE_OTHERS_BOTS.Id,
			model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id,
			model.PERMISSION_LIST_PRIVATE_TEAMS.Id,
			model.PERMISSION_JOIN_PRIVATE_TEAMS.Id,
			model.PERMISSION_VIEW_MEMBERS.Id,
			model.PERMISSION_LIST_TEAM_CHANNELS.Id,
			model.PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			model.PERMISSION_READ_PUBLIC_CHANNEL.Id,
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_ADD_REACTION.Id,
			model.PERMISSION_REMOVE_REACTION.Id,
			model.PERMISSION_UPLOAD_FILE.Id,
			model.PERMISSION_GET_PUBLIC_LINK.Id,
			model.PERMISSION_CREATE_POST.Id,
			model.PERMISSION_USE_SLASH_COMMANDS.Id,
			model.PERMISSION_REMOVE_USER_FROM_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM.Id,
			model.PERMISSION_IMPORT_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM_ROLES.Id,
			model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_EDIT_POST.Id,
		},
	}

	// Check the migration matches what's expected.
	for name, permissions := range expected1 {
		role, err := th.App.GetRoleByName(name)
		assert.Nil(t, err)
		assert.Equal(t, role.Permissions, permissions)
	}

	// Add a license and change the policy config.
	restrictPublicChannel := *th.App.Config().TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement
	restrictPrivateChannel := *th.App.Config().TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement

	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement = restrictPublicChannel
		})
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement = restrictPrivateChannel
		})
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPublicChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.DEPRECATED_DO_NOT_USE_RestrictPrivateChannelManagement = model.PERMISSIONS_TEAM_ADMIN
	})
	th.App.SetLicense(model.NewTestLicense())

	// Check the migration doesn't change anything if run again.
	th.App.DoAdvancedPermissionsMigration()

	roles2, err2 := th.App.GetRolesByNames(roleNames)
	assert.Nil(t, err2)
	assert.Equal(t, len(roles2), len(roleNames))

	for name, permissions := range expected1 {
		role, err := th.App.GetRoleByName(name)
		assert.Nil(t, err)
		assert.Equal(t, permissions, role.Permissions)
	}

	// Reset the database
	th.ResetRoleMigration()

	// Do the migration again with different policy config settings and a license.
	th.App.DoAdvancedPermissionsMigration()

	// Check the role permissions.
	expected2 := map[string][]string{
		"channel_user": {
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_ADD_REACTION.Id,
			model.PERMISSION_REMOVE_REACTION.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_UPLOAD_FILE.Id,
			model.PERMISSION_GET_PUBLIC_LINK.Id,
			model.PERMISSION_CREATE_POST.Id,
			model.PERMISSION_USE_SLASH_COMMANDS.Id,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_EDIT_POST.Id,
		},
		"channel_admin": {
			model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		},
		"team_user": {
			model.PERMISSION_LIST_TEAM_CHANNELS.Id,
			model.PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			model.PERMISSION_READ_PUBLIC_CHANNEL.Id,
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_INVITE_USER.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
		},
		"team_post_all": {
			model.PERMISSION_CREATE_POST.Id,
		},
		"team_post_all_public": {
			model.PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		"team_admin": {
			model.PERMISSION_REMOVE_USER_FROM_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM.Id,
			model.PERMISSION_IMPORT_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM_ROLES.Id,
			model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
			model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		},
		"system_user": {
			model.PERMISSION_LIST_PUBLIC_TEAMS.Id,
			model.PERMISSION_JOIN_PUBLIC_TEAMS.Id,
			model.PERMISSION_CREATE_DIRECT_CHANNEL.Id,
			model.PERMISSION_CREATE_GROUP_CHANNEL.Id,
			model.PERMISSION_VIEW_MEMBERS.Id,
			model.PERMISSION_CREATE_TEAM.Id,
		},
		"system_post_all": {
			model.PERMISSION_CREATE_POST.Id,
		},
		"system_post_all_public": {
			model.PERMISSION_CREATE_POST_PUBLIC.Id,
		},
		"system_user_access_token": {
			model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
		},
		"system_admin": {
			model.PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE.Id,
			model.PERMISSION_MANAGE_SYSTEM.Id,
			model.PERMISSION_MANAGE_ROLES.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
			model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
			model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
			model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH.Id,
			model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_EDIT_OTHER_USERS.Id,
			model.PERMISSION_EDIT_OTHERS_POSTS.Id,
			model.PERMISSION_MANAGE_OAUTH.Id,
			model.PERMISSION_INVITE_USER.Id,
			model.PERMISSION_INVITE_GUEST.Id,
			model.PERMISSION_PROMOTE_GUEST.Id,
			model.PERMISSION_DEMOTE_TO_GUEST.Id,
			model.PERMISSION_DELETE_POST.Id,
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
			model.PERMISSION_CREATE_TEAM.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
			model.PERMISSION_LIST_USERS_WITHOUT_TEAM.Id,
			model.PERMISSION_MANAGE_JOBS.Id,
			model.PERMISSION_CREATE_POST_PUBLIC.Id,
			model.PERMISSION_CREATE_POST_EPHEMERAL.Id,
			model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_READ_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
			model.PERMISSION_CREATE_BOT.Id,
			model.PERMISSION_READ_BOTS.Id,
			model.PERMISSION_READ_OTHERS_BOTS.Id,
			model.PERMISSION_MANAGE_BOTS.Id,
			model.PERMISSION_MANAGE_OTHERS_BOTS.Id,
			model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id,
			model.PERMISSION_LIST_PRIVATE_TEAMS.Id,
			model.PERMISSION_JOIN_PRIVATE_TEAMS.Id,
			model.PERMISSION_VIEW_MEMBERS.Id,
			model.PERMISSION_LIST_TEAM_CHANNELS.Id,
			model.PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
			model.PERMISSION_READ_PUBLIC_CHANNEL.Id,
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_ADD_REACTION.Id,
			model.PERMISSION_REMOVE_REACTION.Id,
			model.PERMISSION_UPLOAD_FILE.Id,
			model.PERMISSION_GET_PUBLIC_LINK.Id,
			model.PERMISSION_CREATE_POST.Id,
			model.PERMISSION_USE_SLASH_COMMANDS.Id,
			model.PERMISSION_REMOVE_USER_FROM_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM.Id,
			model.PERMISSION_IMPORT_TEAM.Id,
			model.PERMISSION_MANAGE_TEAM_ROLES.Id,
			model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_EDIT_POST.Id,
		},
	}

	roles3, err3 := th.App.GetRolesByNames(roleNames)
	assert.Nil(t, err3)
	assert.Equal(t, len(roles3), len(roleNames))

	for name, permissions := range expected2 {
		role, err := th.App.GetRoleByName(name)
		assert.Nil(t, err)
		assert.Equal(t, permissions, role.Permissions, fmt.Sprintf("'%v' did not have expected permissions", name))
	}

	// Remove the license.
	th.App.SetLicense(nil)

	// Do the migration again.
	th.ResetRoleMigration()
	th.App.DoAdvancedPermissionsMigration()

	// Check the role permissions.
	roles4, err4 := th.App.GetRolesByNames(roleNames)
	assert.Nil(t, err4)
	assert.Equal(t, len(roles4), len(roleNames))

	for name, permissions := range expected1 {
		role, err := th.App.GetRoleByName(name)
		assert.Nil(t, err)
		assert.Equal(t, permissions, role.Permissions)
	}

	// Check that the config setting for "always" and "time_limit" edit posts is updated correctly.
	th.ResetRoleMigration()

	allowEditPost := *th.App.Config().ServiceSettings.DEPRECATED_DO_NOT_USE_AllowEditPost
	postEditTimeLimit := *th.App.Config().ServiceSettings.PostEditTimeLimit

	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_AllowEditPost = allowEditPost })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.PostEditTimeLimit = postEditTimeLimit })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_AllowEditPost = "always"
		*cfg.ServiceSettings.PostEditTimeLimit = 300
	})

	th.App.DoAdvancedPermissionsMigration()

	config := th.App.Config()
	assert.Equal(t, -1, *config.ServiceSettings.PostEditTimeLimit)

	th.ResetRoleMigration()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_AllowEditPost = "time_limit"
		*cfg.ServiceSettings.PostEditTimeLimit = 300
	})

	th.App.DoAdvancedPermissionsMigration()
	config = th.App.Config()
	assert.Equal(t, 300, *config.ServiceSettings.PostEditTimeLimit)
}

func TestDoEmojisPermissionsMigration(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Add a license and change the policy config.
	restrictCustomEmojiCreation := *th.App.Config().ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation

	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation = restrictCustomEmojiCreation
		})
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation = model.RESTRICT_EMOJI_CREATION_SYSTEM_ADMIN
	})

	th.ResetEmojisMigration()
	th.App.DoEmojisPermissionsMigration()

	expectedSystemAdmin := []string{
		model.PERMISSION_ASSIGN_SYSTEM_ADMIN_ROLE.Id,
		model.PERMISSION_MANAGE_SYSTEM.Id,
		model.PERMISSION_MANAGE_ROLES.Id,
		model.PERMISSION_MANAGE_PUBLIC_CHANNEL_PROPERTIES.Id,
		model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
		model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
		model.PERMISSION_DELETE_PUBLIC_CHANNEL.Id,
		model.PERMISSION_CREATE_PUBLIC_CHANNEL.Id,
		model.PERMISSION_MANAGE_PRIVATE_CHANNEL_PROPERTIES.Id,
		model.PERMISSION_DELETE_PRIVATE_CHANNEL.Id,
		model.PERMISSION_CREATE_PRIVATE_CHANNEL.Id,
		model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH.Id,
		model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS.Id,
		model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS.Id,
		model.PERMISSION_EDIT_OTHER_USERS.Id,
		model.PERMISSION_EDIT_OTHERS_POSTS.Id,
		model.PERMISSION_MANAGE_OAUTH.Id,
		model.PERMISSION_INVITE_USER.Id,
		model.PERMISSION_INVITE_GUEST.Id,
		model.PERMISSION_PROMOTE_GUEST.Id,
		model.PERMISSION_DEMOTE_TO_GUEST.Id,
		model.PERMISSION_DELETE_POST.Id,
		model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		model.PERMISSION_CREATE_TEAM.Id,
		model.PERMISSION_ADD_USER_TO_TEAM.Id,
		model.PERMISSION_LIST_USERS_WITHOUT_TEAM.Id,
		model.PERMISSION_MANAGE_JOBS.Id,
		model.PERMISSION_CREATE_POST_PUBLIC.Id,
		model.PERMISSION_CREATE_POST_EPHEMERAL.Id,
		model.PERMISSION_CREATE_USER_ACCESS_TOKEN.Id,
		model.PERMISSION_READ_USER_ACCESS_TOKEN.Id,
		model.PERMISSION_REVOKE_USER_ACCESS_TOKEN.Id,
		model.PERMISSION_CREATE_BOT.Id,
		model.PERMISSION_READ_BOTS.Id,
		model.PERMISSION_READ_OTHERS_BOTS.Id,
		model.PERMISSION_MANAGE_BOTS.Id,
		model.PERMISSION_MANAGE_OTHERS_BOTS.Id,
		model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id,
		model.PERMISSION_LIST_PRIVATE_TEAMS.Id,
		model.PERMISSION_JOIN_PRIVATE_TEAMS.Id,
		model.PERMISSION_LIST_TEAM_CHANNELS.Id,
		model.PERMISSION_JOIN_PUBLIC_CHANNELS.Id,
		model.PERMISSION_READ_PUBLIC_CHANNEL.Id,
		model.PERMISSION_VIEW_TEAM.Id,
		model.PERMISSION_READ_CHANNEL.Id,
		model.PERMISSION_ADD_REACTION.Id,
		model.PERMISSION_REMOVE_REACTION.Id,
		model.PERMISSION_UPLOAD_FILE.Id,
		model.PERMISSION_GET_PUBLIC_LINK.Id,
		model.PERMISSION_CREATE_POST.Id,
		model.PERMISSION_USE_SLASH_COMMANDS.Id,
		model.PERMISSION_REMOVE_USER_FROM_TEAM.Id,
		model.PERMISSION_MANAGE_TEAM.Id,
		model.PERMISSION_IMPORT_TEAM.Id,
		model.PERMISSION_MANAGE_TEAM_ROLES.Id,
		model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
		model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
		model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
		model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
		model.PERMISSION_EDIT_POST.Id,
		model.PERMISSION_CREATE_EMOJIS.Id,
		model.PERMISSION_DELETE_EMOJIS.Id,
		model.PERMISSION_DELETE_OTHERS_EMOJIS.Id,
		model.PERMISSION_VIEW_MEMBERS.Id,
	}
	sort.Strings(expectedSystemAdmin)

	role1, err1 := th.App.GetRoleByName(model.SYSTEM_ADMIN_ROLE_ID)
	assert.Nil(t, err1)
	sort.Strings(role1.Permissions)
	assert.Equal(t, expectedSystemAdmin, role1.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.SYSTEM_ADMIN_ROLE_ID))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation = model.RESTRICT_EMOJI_CREATION_ADMIN
	})

	th.ResetEmojisMigration()
	th.App.DoEmojisPermissionsMigration()

	role2, err2 := th.App.GetRoleByName(model.TEAM_ADMIN_ROLE_ID)
	assert.Nil(t, err2)
	expected2 := []string{
		model.PERMISSION_REMOVE_USER_FROM_TEAM.Id,
		model.PERMISSION_MANAGE_TEAM.Id,
		model.PERMISSION_IMPORT_TEAM.Id,
		model.PERMISSION_MANAGE_TEAM_ROLES.Id,
		model.PERMISSION_MANAGE_CHANNEL_ROLES.Id,
		model.PERMISSION_MANAGE_OTHERS_INCOMING_WEBHOOKS.Id,
		model.PERMISSION_MANAGE_OTHERS_OUTGOING_WEBHOOKS.Id,
		model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
		model.PERMISSION_MANAGE_OTHERS_SLASH_COMMANDS.Id,
		model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
		model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
		model.PERMISSION_DELETE_POST.Id,
		model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		model.PERMISSION_CREATE_EMOJIS.Id,
		model.PERMISSION_DELETE_EMOJIS.Id,
	}
	sort.Strings(expected2)
	sort.Strings(role2.Permissions)
	assert.Equal(t, expected2, role2.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.TEAM_ADMIN_ROLE_ID))

	systemAdmin1, systemAdminErr1 := th.App.GetRoleByName(model.SYSTEM_ADMIN_ROLE_ID)
	assert.Nil(t, systemAdminErr1)
	sort.Strings(systemAdmin1.Permissions)
	assert.Equal(t, expectedSystemAdmin, systemAdmin1.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.SYSTEM_ADMIN_ROLE_ID))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.DEPRECATED_DO_NOT_USE_RestrictCustomEmojiCreation = model.RESTRICT_EMOJI_CREATION_ALL
	})

	th.ResetEmojisMigration()
	th.App.DoEmojisPermissionsMigration()

	role3, err3 := th.App.GetRoleByName(model.SYSTEM_USER_ROLE_ID)
	assert.Nil(t, err3)
	expected3 := []string{
		model.PERMISSION_LIST_PUBLIC_TEAMS.Id,
		model.PERMISSION_JOIN_PUBLIC_TEAMS.Id,
		model.PERMISSION_CREATE_DIRECT_CHANNEL.Id,
		model.PERMISSION_CREATE_GROUP_CHANNEL.Id,
		model.PERMISSION_CREATE_TEAM.Id,
		model.PERMISSION_CREATE_EMOJIS.Id,
		model.PERMISSION_DELETE_EMOJIS.Id,
		model.PERMISSION_VIEW_MEMBERS.Id,
	}
	sort.Strings(expected3)
	sort.Strings(role3.Permissions)
	assert.Equal(t, expected3, role3.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.SYSTEM_USER_ROLE_ID))

	systemAdmin2, systemAdminErr2 := th.App.GetRoleByName(model.SYSTEM_ADMIN_ROLE_ID)
	assert.Nil(t, systemAdminErr2)
	sort.Strings(systemAdmin2.Permissions)
	assert.Equal(t, expectedSystemAdmin, systemAdmin2.Permissions, fmt.Sprintf("'%v' did not have expected permissions", model.SYSTEM_ADMIN_ROLE_ID))
}
