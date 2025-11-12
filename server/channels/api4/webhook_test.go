// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func addIncomingWebhookPermissions(t *testing.T, th *TestHelper, roleID string) {
	th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, roleID)
	th.AddPermissionToRole(t, model.PermissionBypassIncomingWebhookChannelLock.Id, roleID)
}

func addIncomingWebhookPermissionsWithOthers(t *testing.T, th *TestHelper, roleID string) {
	addIncomingWebhookPermissions(t, th, roleID)
	th.AddPermissionToRole(t, model.PermissionManageOthersIncomingWebhooks.Id, roleID)
}

func removeIncomingWebhookPermissions(t *testing.T, th *TestHelper, roleID string) {
	th.RemovePermissionFromRole(t, model.PermissionManageOwnIncomingWebhooks.Id, roleID)
	th.RemovePermissionFromRole(t, model.PermissionManageOthersIncomingWebhooks.Id, roleID)
	th.RemovePermissionFromRole(t, model.PermissionBypassIncomingWebhookChannelLock.Id, roleID)
}

func TestCreateIncomingWebhook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableIncomingWebhooks = true
		*cfg.ServiceSettings.EnablePostUsernameOverride = true
		*cfg.ServiceSettings.EnablePostIconOverride = true
	})

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	require.Equal(t, hook.ChannelId, rhook.ChannelId, "channel ids didn't match")
	require.Equal(t, th.SystemAdminUser.Id, rhook.UserId, "user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, rhook.TeamId, "team ids didn't match")

	hook.ChannelId = "junk"
	_, resp, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	hook.ChannelId = th.BasicChannel.Id
	th.LoginTeamAdmin(t)
	_, _, err = client.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	th.LoginBasic(t)
	_, resp, err = client.CreateIncomingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamUserRoleId)

	_, _, err = client.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	t.Run("channel lock enforced without bypass", func(t *testing.T) {
		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)

		unlockedHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, ChannelLocked: false}
		created, _, err2 := client.CreateIncomingWebhook(context.Background(), unlockedHook)
		require.NoError(t, err2)
		require.True(t, created.ChannelLocked)

		addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
	})

	t.Run("channel lock optional with bypass", func(t *testing.T) {
		hookWithBypass := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, ChannelLocked: false}
		created, _, err2 := client.CreateIncomingWebhook(context.Background(), hookWithBypass)
		require.NoError(t, err2)
		require.False(t, created.ChannelLocked)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = false })

	_, _, err = client.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.UserId = th.BasicUser2.Id
		defer func() { hook.UserId = "" }()

		newHook, _, err2 := client.CreateIncomingWebhook(context.Background(), hook)
		require.NoError(t, err2)
		require.Equal(t, th.BasicUser2.Id, newHook.UserId)
	}, "Create an incoming webhook for a different user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.UserId = "invalid-user"
		defer func() { hook.UserId = "" }()

		_, response, err2 := client.CreateIncomingWebhook(context.Background(), hook)
		require.Error(t, err2)
		CheckNotFoundStatus(t, response)
	}, "Create an incoming webhook for an invalid user")

	t.Run("Create an incoming webhook for a different user without permissions", func(t *testing.T) {
		hook.UserId = th.BasicUser2.Id
		defer func() { hook.UserId = "" }()

		_, response, err2 := client.CreateIncomingWebhook(context.Background(), hook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Create an incoming webhook in local mode without providing user", func(t *testing.T) {
		hook.UserId = ""

		_, response, err2 := th.LocalClient.CreateIncomingWebhook(context.Background(), hook)
		require.Error(t, err2)
		CheckBadRequestStatus(t, response)
	})

	t.Run("Cannot create for another user with only manage own permission", func(t *testing.T) {
		// Setup user with only "manage own" permission
		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)

		testHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser2.Id}
		_, response, err2 := client.CreateIncomingWebhook(context.Background(), testHook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, response)

		addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	_, resp, err = client.CreateIncomingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestCreateIncomingWebhook_BypassTeamPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	removeIncomingWebhookPermissions(t, th, model.SystemUserRoleId)
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, _, err := th.Client.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.UserId, th.BasicUser.Id)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam(t)
	team.AllowOpenInvite = false
	_, _, err = th.Client.UpdateTeam(context.Background(), team)
	require.NoError(t, err)
	_, err = th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.BasicUser.Id)
	require.NoError(t, err)
	channel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, team.Id)

	hook = &model.IncomingWebhook{ChannelId: channel.Id}
	_, resp, err := th.Client.CreateIncomingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetIncomingWebhooks(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
	rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	hooks, _, err := th.SystemAdminClient.GetIncomingWebhooks(context.Background(), 0, 1000, "")
	require.NoError(t, err)

	found := false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	require.True(t, found, "missing hook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hooks, _, err = client.GetIncomingWebhooks(context.Background(), 0, 1, "")
		require.NoError(t, err)

		require.Len(t, hooks, 1, "should only be 1 hook")

		hooks, _, err = client.GetIncomingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, _, err = client.GetIncomingWebhooksForTeam(context.Background(), model.NewId(), 0, 1000, "")
		require.NoError(t, err)

		require.Empty(t, hooks, "no hooks should be returned")
	})

	_, resp, err := client.GetIncomingWebhooks(context.Background(), 0, 1000, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	_, _, err = client.GetIncomingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)

	_, resp, err = client.GetIncomingWebhooksForTeam(context.Background(), model.NewId(), 0, 1000, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetIncomingWebhooks(context.Background(), 0, 1000, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	t.Run("User with only manage own cannot see others webhooks", func(t *testing.T) {
		// Create webhook as admin
		adminHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		adminCreatedHook, _, err2 := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), adminHook)
		require.NoError(t, err2)

		// Remove all permissions from team_user and give only "manage own"
		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)

		// Should NOT be able to see admin's webhook
		_, resp2, err2 := client.GetIncomingWebhook(context.Background(), adminCreatedHook.Id, "")
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp2)

		addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
	})

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetIncomingWebhooks(context.Background(), 0, 1000, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetIncomingWebhooksListByUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	BasicClient := th.Client
	th.LoginBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	addIncomingWebhookPermissions(t, th, model.SystemUserRoleId)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, _, err := BasicClient.CreateIncomingWebhook(context.Background(), bHook)
	require.NoError(t, err)

	basicHooks, _, err := BasicClient.GetIncomingWebhooks(context.Background(), 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	_, _, err = th.SystemAdminClient.CreateIncomingWebhook(context.Background(), aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetIncomingWebhooks(context.Background(), 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	// Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := BasicClient.GetIncomingWebhooks(context.Background(), 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetIncomingWebhooksByTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	BasicClient := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, _, err := BasicClient.CreateIncomingWebhook(context.Background(), bHook)
	require.NoError(t, err)

	basicHooks, _, err := BasicClient.GetIncomingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	_, _, err = th.SystemAdminClient.CreateIncomingWebhook(context.Background(), aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetIncomingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	// Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := BasicClient.GetIncomingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetIncomingWebhooksWithCount(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	BasicClient := th.Client
	th.LoginBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	addIncomingWebhookPermissionsWithOthers(t, th, model.SystemUserRoleId)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, _, err := BasicClient.CreateIncomingWebhook(context.Background(), bHook)
	require.NoError(t, err)

	basicHooksWithCount, _, err := BasicClient.GetIncomingWebhooksWithCount(context.Background(), 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooksWithCount.Webhooks))
	assert.Equal(t, int64(1), basicHooksWithCount.TotalCount)
	assert.Equal(t, basicHook.Id, basicHooksWithCount.Webhooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	adminHook, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooksWithCount, _, err2 := client.GetIncomingWebhooksWithCount(context.Background(), 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooksWithCount.Webhooks))
		assert.Equal(t, int64(2), adminHooksWithCount.TotalCount)

		foundBasicHook := false
		foundAdminHook := false

		for _, h := range adminHooksWithCount.Webhooks {
			if basicHook.Id == h.Id {
				foundBasicHook = true
			}
			if adminHook.Id == h.Id {
				foundAdminHook = true
			}
		}

		require.True(t, foundBasicHook, "missing basic user hook")
		require.True(t, foundAdminHook, "missing admin user hook")
	})
}

func TestGetIncomingWebhook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
	rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetIncomingWebhook(context.Background(), rhook.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "WhenHookExists")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetIncomingWebhook(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetIncomingWebhook(context.Background(), "abc", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	t.Run("WhenUserDoesNotHavePermissions", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.GetIncomingWebhook(context.Background(), rhook.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestDeleteIncomingWebhook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	// var rhook *model.IncomingWebhook
	// var hook *model.IncomingWebhook

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteIncomingWebhook(context.Background(), "abc")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteIncomingWebhook(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		// This request is performed by a system admin in both local
		// and sysadmin cases as it's not currently possible to create
		// a webhook via local mode
		rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook)
		require.NoError(t, err)

		resp, err := client.DeleteIncomingWebhook(context.Background(), rhook.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Get now should not return this deleted hook
		_, resp, err = client.GetIncomingWebhook(context.Background(), rhook.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookExists")

	t.Run("WhenUserDoesNotHavePermissions", func(t *testing.T) {
		hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook)
		require.NoError(t, err)

		th.LoginBasic(t)
		resp, err := th.Client.DeleteIncomingWebhook(context.Background(), rhook.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Cannot delete others webhook with only manage own permission", func(t *testing.T) {
		// Create webhook as admin
		adminHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		adminCreatedHook, _, err2 := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), adminHook)
		require.NoError(t, err2)

		// Give basic user only "manage own" permission
		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)
		th.RemovePermissionFromRole(t, model.PermissionManageOthersIncomingWebhooks.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)

		th.LoginBasic(t)
		resp, err2 := th.Client.DeleteIncomingWebhook(context.Background(), adminCreatedHook.Id)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})
}

func TestCreateOutgoingWebhook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}, Username: "some-user-name", IconURL: "http://some-icon-url/"}

	rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	assert.Equal(t, hook.ChannelId, rhook.ChannelId, "channel ids didn't match")
	assert.Equal(t, th.SystemAdminUser.Id, rhook.CreatorId, "user ids didn't match")
	assert.Equal(t, th.BasicChannel.TeamId, rhook.TeamId, "team ids didn't match")

	hook.ChannelId = "junk"
	_, resp, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	hook.ChannelId = th.BasicChannel.Id
	th.LoginTeamAdmin(t)
	_, _, err = client.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	th.LoginBasic(t)
	_, resp, err = client.CreateOutgoingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	_, _, err = client.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.CreatorId = th.BasicUser2.Id
		defer func() { hook.CreatorId = "" }()

		newHook, _, err2 := client.CreateOutgoingWebhook(context.Background(), hook)
		require.NoError(t, err2)
		require.Equal(t, th.BasicUser2.Id, newHook.CreatorId)
	}, "Create an outgoing webhook for a different user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.CreatorId = "invalid-user"
		defer func() { hook.CreatorId = "" }()

		_, response, err2 := client.CreateOutgoingWebhook(context.Background(), hook)
		require.Error(t, err2)
		CheckNotFoundStatus(t, response)
	}, "Create an incoming webhook for an invalid user")

	t.Run("Create an outgoing webhook for a different user without permissions", func(t *testing.T) {
		hook.CreatorId = th.BasicUser2.Id
		defer func() { hook.CreatorId = "" }()

		_, response, err2 := client.CreateOutgoingWebhook(context.Background(), hook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Create an outgoing webhook in local mode without providing user", func(t *testing.T) {
		hook.CreatorId = ""

		_, response, err2 := th.LocalClient.CreateOutgoingWebhook(context.Background(), hook)
		require.Error(t, err2)
		CheckBadRequestStatus(t, response)
	})

	t.Run("Cannot create for another user with only manage own permission", func(t *testing.T) {
		// Remove all permissions and give only "manage own"
		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

		testHook := &model.OutgoingWebhook{
			ChannelId:    th.BasicChannel.Id,
			TeamId:       th.BasicTeam.Id,
			CallbackURLs: []string{"http://nowhere.com"},
			TriggerWords: []string{"test2"},
			CreatorId:    th.BasicUser2.Id,
		}
		_, resp2, err2 := client.CreateOutgoingWebhook(context.Background(), testHook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp2)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp, err = client.CreateOutgoingWebhook(context.Background(), hook)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOutgoingWebhooks(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, _, err2 := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err2)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hooks, _, err := client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
		require.NoError(t, err)

		found := false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, _, err = client.GetOutgoingWebhooks(context.Background(), 0, 1, "")
		require.NoError(t, err)

		require.Len(t, hooks, 1, "should only be 1 hook")

		hooks, _, err = client.GetOutgoingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, _, err = client.GetOutgoingWebhooksForTeam(context.Background(), model.NewId(), 0, 1000, "")
		require.NoError(t, err)

		require.Empty(t, hooks, "no hooks should be returned")

		hooks, _, err = client.GetOutgoingWebhooksForChannel(context.Background(), th.BasicChannel.Id, 0, 1000, "")
		require.NoError(t, err)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		_, resp, err := client.GetOutgoingWebhooksForChannel(context.Background(), model.NewId(), 0, 1000, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	_, resp, err2 := th.Client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	_, _, err2 = th.Client.GetOutgoingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err2)

	_, resp, err2 = th.Client.GetOutgoingWebhooksForTeam(context.Background(), model.NewId(), 0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	_, _, err2 = th.Client.GetOutgoingWebhooksForChannel(context.Background(), th.BasicChannel.Id, 0, 1000, "")
	require.NoError(t, err2)

	_, resp, err2 = th.Client.GetOutgoingWebhooksForChannel(context.Background(), model.NewId(), 0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	_, resp, err2 = th.Client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	t.Run("User with only manage own cannot see others outgoing webhooks", func(t *testing.T) {
		// Create webhook as admin
		adminHook := &model.OutgoingWebhook{
			ChannelId:    th.BasicChannel.Id,
			TeamId:       th.BasicTeam.Id,
			CallbackURLs: []string{"http://nowhere.com"},
			TriggerWords: []string{"admin"},
		}
		adminCreatedHook, _, err3 := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), adminHook)
		require.NoError(t, err3)

		// Remove all permissions and give only "manage own"
		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

		// Should NOT be able to get admin's webhook
		_, resp2, err3 := th.Client.GetOutgoingWebhook(context.Background(), adminCreatedHook.Id)
		require.Error(t, err3)
		CheckForbiddenStatus(t, resp2)
	})

	_, err := th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err2 = th.Client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
	require.Error(t, err2)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetOutgoingWebhooksByTeam(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, _, err := th.Client.CreateOutgoingWebhook(context.Background(), bHook)
	require.NoError(t, err)

	basicHooks, _, err := th.Client.GetOutgoingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, _, err = th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetOutgoingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	// Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := th.Client.GetOutgoingWebhooksForTeam(context.Background(), th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhooksByChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, _, err := th.Client.CreateOutgoingWebhook(context.Background(), bHook)
	require.NoError(t, err)

	basicHooks, _, err := th.Client.GetOutgoingWebhooksForChannel(context.Background(), th.BasicChannel.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, _, err = th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetOutgoingWebhooksForChannel(context.Background(), th.BasicChannel.Id, 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	// Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := th.Client.GetOutgoingWebhooksForChannel(context.Background(), th.BasicChannel.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhooksListByUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.LoginBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.SystemUserRoleId)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, _, err := th.Client.CreateOutgoingWebhook(context.Background(), bHook)
	require.NoError(t, err)

	basicHooks, _, err := th.Client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, _, err = th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	// Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := th.Client.GetOutgoingWebhooks(context.Background(), 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}

	rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		getHook, _, err2 := client.GetOutgoingWebhook(context.Background(), rhook.Id)
		require.NoError(t, err2)

		require.Equal(t, getHook.Id, rhook.Id, "failed to retrieve the correct outgoing hook")
	})

	_, resp, err := th.Client.GetOutgoingWebhook(context.Background(), rhook.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.OutgoingWebhook{}
		_, resp, err = client.GetOutgoingWebhook(context.Background(), nonExistentHook.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp, err = client.GetOutgoingWebhook(context.Background(), nonExistentHook.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestUpdateIncomingHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	hook1 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	var createdHook *model.IncomingWebhook

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = false })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// webhook creations are always performed by a sysadmin
		// because it's not currently possible to create a webhook via
		// local mode
		var err error
		createdHook, _, err = th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook1)
		require.NoError(t, err)

		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, _, err := client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.NoError(t, err)

		require.NotNil(t, updatedHook, "should not be nil")
		require.Exactly(t, "hook2", updatedHook.DisplayName, "Hook name is not updated")
		require.Exactly(t, "description", updatedHook.Description, "Hook description is not updated")
		require.Equal(t, updatedHook.ChannelId, th.BasicChannel2.Id, "Hook channel is not updated")
		require.Empty(t, updatedHook.Username, "Hook username was incorrectly updated")
		require.Empty(t, updatedHook.IconURL, "Hook icon was incorrectly updated")

		// updatedHook, _ = th.App.GetIncomingWebhook(createdHook.Id)
		assert.Equal(t, updatedHook.ChannelId, createdHook.ChannelId)
	}, "UpdateIncomingHook, overrides disabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = true })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		var err error
		createdHook, _, err = th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook1)
		require.NoError(t, err)

		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, _, err := client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.NoError(t, err)

		require.NotNil(t, updatedHook, "should not be nil")
		require.Exactly(t, "hook2", updatedHook.DisplayName, "Hook name is not updated")
		require.Exactly(t, "description", updatedHook.Description, "Hook description is not updated")
		require.Equal(t, updatedHook.ChannelId, th.BasicChannel2.Id, "Hook channel is not updated")
		require.Exactly(t, "username", updatedHook.Username, "Hook username is not updated")
		require.Exactly(t, "icon", updatedHook.IconURL, "Hook icon is not updated")

		// updatedHook, _ = th.App.GetIncomingWebhook(createdHook.Id)
		assert.Equal(t, updatedHook.ChannelId, createdHook.ChannelId)
	}, "UpdateIncomingHook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook2 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, CreateAt: 100}

		createdHook2, _, err := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), hook2)
		require.NoError(t, err)

		createdHook2.DisplayName = "Name2"

		updatedHook, _, err := client.UpdateIncomingWebhook(context.Background(), createdHook2)
		require.NoError(t, err)
		require.NotNil(t, updatedHook)
		assert.Equal(t, createdHook2.CreateAt, updatedHook.CreateAt)
	}, "RetainCreateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.DisplayName = "Name3"

		updatedHook, _, err := client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.NoError(t, err)
		require.NotNil(t, updatedHook, "should not be nil")
		require.NotEqual(t, createdHook.UpdateAt, updatedHook.UpdateAt, "failed - hook updateAt is not updated")
	}, "ModifyUpdateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

		_, resp, err := client.UpdateIncomingWebhook(context.Background(), nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp, err = client.UpdateIncomingWebhook(context.Background(), nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateNonExistentHook")

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp, err := th.Client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)

	t.Run("update cannot clear channel lock without bypass", func(t *testing.T) {
		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)
		hookWithoutBypass := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		hookWithoutBypass, _, err := th.Client.CreateIncomingWebhook(context.Background(), hookWithoutBypass)
		require.NoError(t, err)
		require.True(t, hookWithoutBypass.ChannelLocked)

		hookWithoutBypass.ChannelLocked = false
		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)

		updated, _, err := th.Client.UpdateIncomingWebhook(context.Background(), hookWithoutBypass)
		require.NoError(t, err)
		require.True(t, updated.ChannelLocked)

		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
	})

	addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	t.Run("OnlyAdminIntegrationsDisabled", func(t *testing.T) {
		addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

		t.Run("UpdateHookOfSameUser", func(t *testing.T) {
			sameUserHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

			sameUserHook, _, err := th.Client.CreateIncomingWebhook(context.Background(), sameUserHook)
			require.NoError(t, err)

			sameUserHook.UserId = th.BasicUser2.Id
			_, _, err = th.Client.UpdateIncomingWebhook(context.Background(), sameUserHook)
			require.NoError(t, err)
		})

		t.Run("UpdateHookOfDifferentUser", func(t *testing.T) {
			_, resp, err := th.Client.UpdateIncomingWebhook(context.Background(), createdHook)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)

	_, err := th.Client.Logout(context.Background())
	require.NoError(t, err)
	th.UpdateUserToTeamAdmin(t, th.BasicUser2, th.BasicTeam)
	th.LoginBasic2(t)
	t.Run("UpdateByDifferentUser", func(t *testing.T) {
		var updatedHook *model.IncomingWebhook
		updatedHook, _, err = th.Client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.NoError(t, err)
		require.NotEqual(t, th.BasicUser2.Id, updatedHook.UserId, "Hook's creator userId is not retained")
	})

	t.Run("IncomingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
		var resp *model.Response
		_, resp, err = th.Client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "api.incoming_webhook.disabled.app_error")
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = "junk"
		var resp *model.Response
		_, resp, err = client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateToNonExistentChannel")

	t.Run("PrivateChannel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		_, err = th.Client.Logout(context.Background())
		require.NoError(t, err)
		th.LoginBasic(t)
		createdHook.ChannelId = privateChannel.Id

		var resp *model.Response
		_, resp, err = th.Client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	team := th.CreateTeamWithClient(t, th.Client)
	user := th.CreateUserWithClient(t, th.Client)
	th.LinkUserToTeam(t, user, team)
	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.Client.Login(context.Background(), user.Username, user.Password)
	require.NoError(t, err)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp, err := th.Client.UpdateIncomingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Cannot update others webhook with only manage own permission", func(t *testing.T) {
		// Create webhook as admin
		adminHook2 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		adminCreatedHook2, _, err2 := th.SystemAdminClient.CreateIncomingWebhook(context.Background(), adminHook2)
		require.NoError(t, err2)

		// Remove all permissions and give only "manage own"
		removeIncomingWebhookPermissions(t, th, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnIncomingWebhooks.Id, model.TeamUserRoleId)

		adminCreatedHook2.DisplayName = "Hacked"
		_, resp, err2 := th.Client.UpdateIncomingWebhook(context.Background(), adminCreatedHook2)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateIncomingWebhook_BypassTeamPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	removeIncomingWebhookPermissions(t, th, model.SystemUserRoleId)
	addIncomingWebhookPermissionsWithOthers(t, th, model.TeamAdminRoleId)
	addIncomingWebhookPermissions(t, th, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, _, err := th.Client.CreateIncomingWebhook(context.Background(), hook)
	require.NoError(t, err)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.UserId, th.BasicUser.Id)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam(t)
	team.AllowOpenInvite = false
	_, _, err = th.Client.UpdateTeam(context.Background(), team)
	require.NoError(t, err)
	_, err = th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.BasicUser.Id)
	require.NoError(t, err)
	channel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, team.Id)

	hook2 := &model.IncomingWebhook{Id: rhook.Id, ChannelId: channel.Id}
	_, resp, err := th.Client.UpdateIncomingWebhook(context.Background(), hook2)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}

func TestRegenOutgoingHookToken(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	_, resp, err := th.SystemAdminClient.RegenOutgoingHookToken(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// investigate why is act weird on jenkins
	// _, resp,_ = th.SystemAdminClient.RegenOutgoingHookToken(context.Background(), "")
	// CheckNotFoundStatus(t, resp)

	regenHookToken, _, err := th.SystemAdminClient.RegenOutgoingHookToken(context.Background(), rhook.Id)
	require.NoError(t, err)
	require.NotEqual(t, rhook.Token, regenHookToken.Token, "regen didn't work properly")

	_, resp, err = client.RegenOutgoingHookToken(context.Background(), rhook.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp, err = th.SystemAdminClient.RegenOutgoingHookToken(context.Background(), rhook.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestUpdateOutgoingHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer func() {
		th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	createdHook := &model.OutgoingWebhook{
		ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"},
	}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), createdHook)
		require.NoError(t, err)
		defer func() {
			_, err = client.DeleteOutgoingWebhook(context.Background(), rcreatedHook.Id)
			require.NoError(t, err)
		}()

		rcreatedHook.DisplayName = "Cats"
		rcreatedHook.Description = "Get me some cats"

		updatedHook, _, err := client.UpdateOutgoingWebhook(context.Background(), rcreatedHook)
		require.NoError(t, err)

		require.Exactly(t, "Cats", updatedHook.DisplayName, "did not update")
		require.Exactly(t, "Get me some cats", updatedHook.Description, "did not update")
	}, "UpdateOutgoingWebhook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), createdHook)
		require.NoError(t, err)
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
			_, err = client.DeleteOutgoingWebhook(context.Background(), rcreatedHook.Id)
			require.NoError(t, err)
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
		_, resp, err := client.UpdateOutgoingWebhook(context.Background(), rcreatedHook)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	}, "OutgoingHooksDisabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook2 := &model.OutgoingWebhook{
			ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"},
		}

		createdHook2, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook2)
		require.NoError(t, err)
		defer func() {
			_, err = client.DeleteOutgoingWebhook(context.Background(), createdHook2.Id)
			require.NoError(t, err)
		}()
		createdHook2.DisplayName = "Name2"

		updatedHook2, _, err := client.UpdateOutgoingWebhook(context.Background(), createdHook2)
		require.NoError(t, err)

		require.Equal(t, createdHook2.CreateAt, updatedHook2.CreateAt, "failed - hook create at should not be changed")
	}, "RetainCreateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), createdHook)
		require.NoError(t, err)
		defer func() {
			_, err = client.DeleteOutgoingWebhook(context.Background(), rcreatedHook.Id)
			require.NoError(t, err)
		}()
		rcreatedHook.DisplayName = "Name3"

		updatedHook2, _, err := client.UpdateOutgoingWebhook(context.Background(), rcreatedHook)
		require.NoError(t, err)

		require.NotEqual(t, createdHook.UpdateAt, updatedHook2.UpdateAt, "failed - hook updateAt is not updated")
	}, "ModifyUpdateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.OutgoingWebhook{
			ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"},
		}

		_, resp, err := client.UpdateOutgoingWebhook(context.Background(), nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp, err = client.UpdateOutgoingWebhook(context.Background(), nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateNonExistentHook")

	createdHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), createdHook)
	require.NoError(t, err)

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp, err2 := th.Client.UpdateOutgoingWebhook(context.Background(), createdHook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})

	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)
	hook2 := &model.OutgoingWebhook{
		ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"},
	}

	createdHook2, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook2)
	require.NoError(t, err)

	_, resp, err := th.Client.UpdateOutgoingWebhook(context.Background(), createdHook2)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	th.UpdateUserToTeamAdmin(t, th.BasicUser2, th.BasicTeam)
	th.LoginBasic2(t)
	t.Run("RetainHookCreator", func(t *testing.T) {
		createdHook.DisplayName = "Basic user 2"
		updatedHook, _, err2 := th.Client.UpdateOutgoingWebhook(context.Background(), createdHook)
		require.NoError(t, err2)

		require.Exactly(t, "Basic user 2", updatedHook.DisplayName, "should apply the change")
		require.Equal(t, th.SystemAdminUser.Id, updatedHook.CreatorId, "hook creator should not be changed")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		firstHook := &model.OutgoingWebhook{
			ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://someurl"}, TriggerWords: []string{"first"},
		}
		firstHook, _, err = th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), firstHook)
		require.NoError(t, err)

		baseHook := &model.OutgoingWebhook{
			ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://someurl"}, TriggerWords: []string{"base"},
		}
		baseHook, _, err = th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), baseHook)
		require.NoError(t, err)

		defer func() {
			_, err = client.DeleteOutgoingWebhook(context.Background(), firstHook.Id)
			require.NoError(t, err)
			_, err = client.DeleteOutgoingWebhook(context.Background(), baseHook.Id)
			require.NoError(t, err)
		}()

		t.Run("OnSameChannel", func(t *testing.T) {
			baseHook.TriggerWords = []string{"first"}

			_, resp, err2 := client.UpdateOutgoingWebhook(context.Background(), baseHook)
			require.Error(t, err2)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("OnDifferentChannel", func(t *testing.T) {
			baseHook.TriggerWords = []string{"first"}
			baseHook.ChannelId = th.BasicChannel2.Id

			_, _, err = client.UpdateOutgoingWebhook(context.Background(), baseHook)
			require.NoError(t, err)
		})
	}, "UpdateToExistingTriggerWordAndCallback")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = "junk"

		var resp *model.Response
		_, resp, err = client.UpdateOutgoingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateToNonExistentChannel")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		privateChannel := th.CreatePrivateChannel(t)
		createdHook.ChannelId = privateChannel.Id

		var resp *model.Response
		_, resp, err = client.UpdateOutgoingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	}, "UpdateToPrivateChannel")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = ""
		createdHook.TriggerWords = nil

		var resp *model.Response
		_, resp, err = client.UpdateOutgoingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
	}, "UpdateToBlankTriggerWordAndChannel")

	team := th.CreateTeamWithClient(t, th.Client)
	user := th.CreateUserWithClient(t, th.Client)
	th.LinkUserToTeam(t, user, team)
	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.Client.Login(context.Background(), user.Username, user.Password)
	require.NoError(t, err)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp, err := th.Client.UpdateOutgoingWebhook(context.Background(), createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Cannot update others webhook with only manage own permission", func(t *testing.T) {
		// Create webhook as admin
		adminHook := &model.OutgoingWebhook{
			ChannelId:    th.BasicChannel.Id,
			TeamId:       th.BasicTeam.Id,
			CallbackURLs: []string{"http://nowhere.com"},
			TriggerWords: []string{"admin2"},
		}
		adminCreatedHook, _, err2 := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), adminHook)
		require.NoError(t, err2)

		// Remove all permissions and give only "manage own"
		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

		adminCreatedHook.DisplayName = "Hacked"
		_, resp, err2 := th.Client.UpdateOutgoingWebhook(context.Background(), adminCreatedHook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateOutgoingWebhook_BypassTeamPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions(t)
	defer th.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.OutgoingWebhook{
		ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"},
	}

	rhook, _, err := th.Client.CreateOutgoingWebhook(context.Background(), hook)
	require.NoError(t, err)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam(t)
	team.AllowOpenInvite = false
	_, _, err = th.Client.UpdateTeam(context.Background(), team)
	require.NoError(t, err)
	_, err = th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.BasicUser.Id)
	require.NoError(t, err)
	channel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, team.Id)

	hook2 := &model.OutgoingWebhook{Id: rhook.Id, ChannelId: channel.Id}
	_, resp, err := th.Client.UpdateOutgoingWebhook(context.Background(), hook2)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestDeleteOutgoingHook(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteOutgoingWebhook(context.Background(), "abc")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteOutgoingWebhook(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook := &model.OutgoingWebhook{
			ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"},
		}
		rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
		require.NoError(t, err)

		resp, err := client.DeleteOutgoingWebhook(context.Background(), rhook.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Get now should not return this deleted hook
		_, resp, err = client.GetIncomingWebhook(context.Background(), rhook.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookExists")

	t.Run("WhenUserDoesNotHavePermissions", func(t *testing.T) {
		hook := &model.OutgoingWebhook{
			ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"dogs"},
		}
		rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), hook)
		require.NoError(t, err)

		th.LoginBasic(t)
		resp, err := th.Client.DeleteOutgoingWebhook(context.Background(), rhook.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Cannot delete others webhook with only manage own permission", func(t *testing.T) {
		// Create webhook as admin
		adminHook := &model.OutgoingWebhook{
			ChannelId:    th.BasicChannel.Id,
			TeamId:       th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"},
			TriggerWords: []string{"admin3"},
		}
		adminCreatedHook, _, err2 := th.SystemAdminClient.CreateOutgoingWebhook(context.Background(), adminHook)
		require.NoError(t, err2)

		// Give basic user only "manage own" permission
		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)
		th.AddPermissionToRole(t, model.PermissionManageOwnOutgoingWebhooks.Id, model.TeamUserRoleId)

		th.LoginBasic(t)
		resp, err2 := th.Client.DeleteOutgoingWebhook(context.Background(), adminCreatedHook.Id)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})
}
