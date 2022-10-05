// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestCreateIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableIncomingWebhooks = true
		*cfg.ServiceSettings.EnablePostUsernameOverride = true
		*cfg.ServiceSettings.EnablePostIconOverride = true
	})

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	require.Equal(t, hook.ChannelId, rhook.ChannelId, "channel ids didn't match")
	require.Equal(t, th.SystemAdminUser.Id, rhook.UserId, "user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, rhook.TeamId, "team ids didn't match")

	hook.ChannelId = "junk"
	_, resp, err := th.SystemAdminClient.CreateIncomingWebhook(hook)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	hook.ChannelId = th.BasicChannel.Id
	th.LoginTeamAdmin()
	_, _, err = client.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	th.LoginBasic()
	_, resp, err = client.CreateIncomingWebhook(hook)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	_, _, err = client.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = false })

	_, _, err = client.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.UserId = th.BasicUser2.Id
		defer func() { hook.UserId = "" }()

		newHook, _, err2 := client.CreateIncomingWebhook(hook)
		require.NoError(t, err2)
		require.Equal(t, th.BasicUser2.Id, newHook.UserId)
	}, "Create an incoming webhook for a different user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.UserId = "invalid-user"
		defer func() { hook.UserId = "" }()

		_, response, err2 := client.CreateIncomingWebhook(hook)
		require.Error(t, err2)
		CheckNotFoundStatus(t, response)
	}, "Create an incoming webhook for an invalid user")

	t.Run("Create an incoming webhook for a different user without permissions", func(t *testing.T) {
		hook.UserId = th.BasicUser2.Id
		defer func() { hook.UserId = "" }()

		_, response, err2 := client.CreateIncomingWebhook(hook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Create an incoming webhook in local mode without providing user", func(t *testing.T) {
		hook.UserId = ""

		_, response, err2 := th.LocalClient.CreateIncomingWebhook(hook)
		require.Error(t, err2)
		CheckBadRequestStatus(t, response)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	_, resp, err = client.CreateIncomingWebhook(hook)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestCreateIncomingWebhook_BypassTeamPermissions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer th.RestoreDefaultRolePermissions(defaultRolePermissions)
	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, _, err := th.Client.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.UserId, th.BasicUser.Id)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam()
	team.AllowOpenInvite = false
	th.Client.UpdateTeam(team)
	th.SystemAdminClient.RemoveTeamMember(team.Id, th.BasicUser.Id)
	channel := th.CreateChannelWithClientAndTeam(th.SystemAdminClient, model.ChannelTypeOpen, team.Id)

	hook = &model.IncomingWebhook{ChannelId: channel.Id}
	_, resp, err := th.Client.CreateIncomingWebhook(hook)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetIncomingWebhooks(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
	rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	hooks, _, err := th.SystemAdminClient.GetIncomingWebhooks(0, 1000, "")
	require.NoError(t, err)

	found := false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	require.True(t, found, "missing hook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hooks, _, err = client.GetIncomingWebhooks(0, 1, "")
		require.NoError(t, err)

		require.Len(t, hooks, 1, "should only be 1 hook")

		hooks, _, err = client.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, _, err = client.GetIncomingWebhooksForTeam(model.NewId(), 0, 1000, "")
		require.NoError(t, err)

		require.Empty(t, hooks, "no hooks should be returned")
	})

	_, resp, err := client.GetIncomingWebhooks(0, 1000, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	_, _, err = client.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)

	_, resp, err = client.GetIncomingWebhooksForTeam(model.NewId(), 0, 1000, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.GetIncomingWebhooks(0, 1000, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetIncomingWebhooks(0, 1000, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetIncomingWebhooksListByUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	BasicClient := th.Client
	th.LoginBasic()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.SystemUserRoleId)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, _, err := BasicClient.CreateIncomingWebhook(bHook)
	require.NoError(t, err)

	basicHooks, _, err := BasicClient.GetIncomingWebhooks(0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	_, _, err = th.SystemAdminClient.CreateIncomingWebhook(aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetIncomingWebhooks(0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := BasicClient.GetIncomingWebhooks(0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetIncomingWebhooksByTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	BasicClient := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, _, err := BasicClient.CreateIncomingWebhook(bHook)
	require.NoError(t, err)

	basicHooks, _, err := BasicClient.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	_, _, err = th.SystemAdminClient.CreateIncomingWebhook(aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := BasicClient.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
	rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetIncomingWebhook(rhook.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "WhenHookExists")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetIncomingWebhook(model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetIncomingWebhook("abc", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	t.Run("WhenUserDoesNotHavePermissions", func(t *testing.T) {
		th.LoginBasic()
		_, resp, err := th.Client.GetIncomingWebhook(rhook.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestDeleteIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	//var rhook *model.IncomingWebhook
	//var hook *model.IncomingWebhook

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteIncomingWebhook("abc")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteIncomingWebhook(model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		// This request is performed by a system admin in both local
		// and sysadmin cases as it's not currently possible to create
		// a webhook via local mode
		rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(hook)
		require.NoError(t, err)

		resp, err := client.DeleteIncomingWebhook(rhook.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Get now should not return this deleted hook
		_, resp, err = client.GetIncomingWebhook(rhook.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookExists")

	t.Run("WhenUserDoesNotHavePermissions", func(t *testing.T) {
		hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		rhook, _, err := th.SystemAdminClient.CreateIncomingWebhook(hook)
		require.NoError(t, err)

		th.LoginBasic()
		resp, err := th.Client.DeleteIncomingWebhook(rhook.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestCreateOutgoingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}, Username: "some-user-name", IconURL: "http://some-icon-url/"}

	rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	require.NoError(t, err)

	assert.Equal(t, hook.ChannelId, rhook.ChannelId, "channel ids didn't match")
	assert.Equal(t, th.SystemAdminUser.Id, rhook.CreatorId, "user ids didn't match")
	assert.Equal(t, th.BasicChannel.TeamId, rhook.TeamId, "team ids didn't match")

	hook.ChannelId = "junk"
	_, resp, err := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	hook.ChannelId = th.BasicChannel.Id
	th.LoginTeamAdmin()
	_, _, err = client.CreateOutgoingWebhook(hook)
	require.NoError(t, err)

	th.LoginBasic()
	_, resp, err = client.CreateOutgoingWebhook(hook)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	_, _, err = client.CreateOutgoingWebhook(hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.CreatorId = th.BasicUser2.Id
		defer func() { hook.CreatorId = "" }()

		newHook, _, err2 := client.CreateOutgoingWebhook(hook)
		require.NoError(t, err2)
		require.Equal(t, th.BasicUser2.Id, newHook.CreatorId)
	}, "Create an outgoing webhook for a different user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.CreatorId = "invalid-user"
		defer func() { hook.CreatorId = "" }()

		_, response, err2 := client.CreateOutgoingWebhook(hook)
		require.Error(t, err2)
		CheckNotFoundStatus(t, response)
	}, "Create an incoming webhook for an invalid user")

	t.Run("Create an outgoing webhook for a different user without permissions", func(t *testing.T) {
		hook.CreatorId = th.BasicUser2.Id
		defer func() { hook.CreatorId = "" }()

		_, response, err2 := client.CreateOutgoingWebhook(hook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Create an outgoing webhook in local mode without providing user", func(t *testing.T) {
		hook.CreatorId = ""

		_, response, err2 := th.LocalClient.CreateOutgoingWebhook(hook)
		require.Error(t, err2)
		CheckBadRequestStatus(t, response)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp, err = client.CreateOutgoingWebhook(hook)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOutgoingWebhooks(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, _, err2 := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	require.NoError(t, err2)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hooks, _, err := client.GetOutgoingWebhooks(0, 1000, "")
		require.NoError(t, err)

		found := false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, _, err = client.GetOutgoingWebhooks(0, 1, "")
		require.NoError(t, err)

		require.Len(t, hooks, 1, "should only be 1 hook")

		hooks, _, err = client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, _, err = client.GetOutgoingWebhooksForTeam(model.NewId(), 0, 1000, "")
		require.NoError(t, err)

		require.Empty(t, hooks, "no hooks should be returned")

		hooks, _, err = client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
		require.NoError(t, err)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		_, resp, err := client.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	_, resp, err2 := th.Client.GetOutgoingWebhooks(0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	_, _, err2 = th.Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err2)

	_, resp, err2 = th.Client.GetOutgoingWebhooksForTeam(model.NewId(), 0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	_, _, err2 = th.Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	require.NoError(t, err2)

	_, resp, err2 = th.Client.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	_, resp, err2 = th.Client.GetOutgoingWebhooks(0, 1000, "")
	require.Error(t, err2)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp, err2 = th.Client.GetOutgoingWebhooks(0, 1000, "")
	require.Error(t, err2)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetOutgoingWebhooksByTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, _, err := th.Client.CreateOutgoingWebhook(bHook)
	require.NoError(t, err)

	basicHooks, _, err := th.Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, _, err = th.SystemAdminClient.CreateOutgoingWebhook(aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := th.Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhooksByChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, _, err := th.Client.CreateOutgoingWebhook(bHook)
	require.NoError(t, err)

	basicHooks, _, err := th.Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, _, err = th.SystemAdminClient.CreateOutgoingWebhook(aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := th.Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhooksListByUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.LoginBasic()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.SystemUserRoleId)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, _, err := th.Client.CreateOutgoingWebhook(bHook)
	require.NoError(t, err)

	basicHooks, _, err := th.Client.GetOutgoingWebhooks(0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, _, err = th.SystemAdminClient.CreateOutgoingWebhook(aHook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, _, err2 := client.GetOutgoingWebhooks(0, 1000, "")
		require.NoError(t, err2)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, _, err := th.Client.GetOutgoingWebhooks(0, 1000, "")
	require.NoError(t, err)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}

	rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	require.NoError(t, err)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		getHook, _, err2 := client.GetOutgoingWebhook(rhook.Id)
		require.NoError(t, err2)

		require.Equal(t, getHook.Id, rhook.Id, "failed to retrieve the correct outgoing hook")
	})

	_, resp, err := th.Client.GetOutgoingWebhook(rhook.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.OutgoingWebhook{}
		_, resp, err = client.GetOutgoingWebhook(nonExistentHook.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp, err = client.GetOutgoingWebhook(nonExistentHook.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestUpdateIncomingHook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	hook1 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	var createdHook *model.IncomingWebhook

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = false })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// webhook creations are always performed by a sysadmin
		// because it's not currently possible to create a webhook via
		// local mode
		var err error
		createdHook, _, err = th.SystemAdminClient.CreateIncomingWebhook(hook1)
		require.NoError(t, err)

		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, _, err := client.UpdateIncomingWebhook(createdHook)
		require.NoError(t, err)

		require.NotNil(t, updatedHook, "should not be nil")
		require.Exactly(t, "hook2", updatedHook.DisplayName, "Hook name is not updated")
		require.Exactly(t, "description", updatedHook.Description, "Hook description is not updated")
		require.Equal(t, updatedHook.ChannelId, th.BasicChannel2.Id, "Hook channel is not updated")
		require.Empty(t, updatedHook.Username, "Hook username was incorrectly updated")
		require.Empty(t, updatedHook.IconURL, "Hook icon was incorrectly updated")

		//updatedHook, _ = th.App.GetIncomingWebhook(createdHook.Id)
		assert.Equal(t, updatedHook.ChannelId, createdHook.ChannelId)
	}, "UpdateIncomingHook, overrides disabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = true })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		var err error
		createdHook, _, err = th.SystemAdminClient.CreateIncomingWebhook(hook1)
		require.NoError(t, err)

		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, _, err := client.UpdateIncomingWebhook(createdHook)
		require.NoError(t, err)

		require.NotNil(t, updatedHook, "should not be nil")
		require.Exactly(t, "hook2", updatedHook.DisplayName, "Hook name is not updated")
		require.Exactly(t, "description", updatedHook.Description, "Hook description is not updated")
		require.Equal(t, updatedHook.ChannelId, th.BasicChannel2.Id, "Hook channel is not updated")
		require.Exactly(t, "username", updatedHook.Username, "Hook username is not updated")
		require.Exactly(t, "icon", updatedHook.IconURL, "Hook icon is not updated")

		//updatedHook, _ = th.App.GetIncomingWebhook(createdHook.Id)
		assert.Equal(t, updatedHook.ChannelId, createdHook.ChannelId)
	}, "UpdateIncomingHook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook2 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, CreateAt: 100}

		createdHook2, _, err := th.SystemAdminClient.CreateIncomingWebhook(hook2)
		require.NoError(t, err)

		createdHook2.DisplayName = "Name2"

		updatedHook, _, err := client.UpdateIncomingWebhook(createdHook2)
		require.NoError(t, err)
		require.NotNil(t, updatedHook)
		assert.Equal(t, createdHook2.CreateAt, updatedHook.CreateAt)
	}, "RetainCreateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.DisplayName = "Name3"

		updatedHook, _, err := client.UpdateIncomingWebhook(createdHook)
		require.NoError(t, err)
		require.NotNil(t, updatedHook, "should not be nil")
		require.NotEqual(t, createdHook.UpdateAt, updatedHook.UpdateAt, "failed - hook updateAt is not updated")
	}, "ModifyUpdateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

		_, resp, err := client.UpdateIncomingWebhook(nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp, err = client.UpdateIncomingWebhook(nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateNonExistentHook")

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp, err := th.Client.UpdateIncomingWebhook(createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)

	t.Run("OnlyAdminIntegrationsDisabled", func(t *testing.T) {
		th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

		t.Run("UpdateHookOfSameUser", func(t *testing.T) {
			sameUserHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

			sameUserHook, _, err := th.Client.CreateIncomingWebhook(sameUserHook)
			require.NoError(t, err)

			sameUserHook.UserId = th.BasicUser2.Id
			_, _, err = th.Client.UpdateIncomingWebhook(sameUserHook)
			require.NoError(t, err)
		})

		t.Run("UpdateHookOfDifferentUser", func(t *testing.T) {
			_, resp, err := th.Client.UpdateIncomingWebhook(createdHook)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)

	th.Client.Logout()
	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)
	th.LoginBasic2()
	t.Run("UpdateByDifferentUser", func(t *testing.T) {
		updatedHook, _, err := th.Client.UpdateIncomingWebhook(createdHook)
		require.NoError(t, err)
		require.NotEqual(t, th.BasicUser2.Id, updatedHook.UserId, "Hook's creator userId is not retained")
	})

	t.Run("IncomingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
		_, resp, err := th.Client.UpdateIncomingWebhook(createdHook)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "api.incoming_webhook.disabled.app_error")
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	t.Run("PrivateChannel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		th.Client.Logout()
		th.LoginBasic()
		createdHook.ChannelId = privateChannel.Id

		_, resp, err := th.Client.UpdateIncomingWebhook(createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = "junk"
		_, resp, err := client.UpdateIncomingWebhook(createdHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateToNonExistentChannel")

	team := th.CreateTeamWithClient(th.Client)
	user := th.CreateUserWithClient(th.Client)
	th.LinkUserToTeam(user, team)
	th.Client.Logout()
	th.Client.Login(user.Id, user.Password)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp, err := th.Client.UpdateIncomingWebhook(createdHook)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestUpdateIncomingWebhook_BypassTeamPermissions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer th.RestoreDefaultRolePermissions(defaultRolePermissions)
	th.RemovePermissionFromRole(model.PermissionManageIncomingWebhooks.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageIncomingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, _, err := th.Client.CreateIncomingWebhook(hook)
	require.NoError(t, err)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.UserId, th.BasicUser.Id)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam()
	team.AllowOpenInvite = false
	th.Client.UpdateTeam(team)
	th.SystemAdminClient.RemoveTeamMember(team.Id, th.BasicUser.Id)
	channel := th.CreateChannelWithClientAndTeam(th.SystemAdminClient, model.ChannelTypeOpen, team.Id)

	hook2 := &model.IncomingWebhook{Id: rhook.Id, ChannelId: channel.Id}
	_, resp, err := th.Client.UpdateIncomingWebhook(hook2)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}

func TestRegenOutgoingHookToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	require.NoError(t, err)

	_, resp, err := th.SystemAdminClient.RegenOutgoingHookToken("junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	//investigate why is act weird on jenkins
	// _, resp,_ = th.SystemAdminClient.RegenOutgoingHookToken("")
	// CheckNotFoundStatus(t, resp)

	regenHookToken, _, err := th.SystemAdminClient.RegenOutgoingHookToken(rhook.Id)
	require.NoError(t, err)
	require.NotEqual(t, rhook.Token, regenHookToken.Token, "regen didn't work properly")

	_, resp, err = client.RegenOutgoingHookToken(rhook.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp, err = th.SystemAdminClient.RegenOutgoingHookToken(rhook.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestUpdateOutgoingHook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.RemovePermissionFromRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	createdHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"}}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
		require.NoError(t, err)
		defer func() {
			_, err = client.DeleteOutgoingWebhook(rcreatedHook.Id)
			require.NoError(t, err)
		}()

		rcreatedHook.DisplayName = "Cats"
		rcreatedHook.Description = "Get me some cats"

		updatedHook, _, err := client.UpdateOutgoingWebhook(rcreatedHook)
		require.NoError(t, err)

		require.Exactly(t, "Cats", updatedHook.DisplayName, "did not update")
		require.Exactly(t, "Get me some cats", updatedHook.Description, "did not update")
	}, "UpdateOutgoingWebhook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
		require.NoError(t, err)
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
			_, err = client.DeleteOutgoingWebhook(rcreatedHook.Id)
			require.NoError(t, err)
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
		_, resp, err := client.UpdateOutgoingWebhook(rcreatedHook)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	}, "OutgoingHooksDisabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook2 := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		createdHook2, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook2)
		require.NoError(t, err)
		defer func() {
			_, err = client.DeleteOutgoingWebhook(createdHook2.Id)
			require.NoError(t, err)
		}()
		createdHook2.DisplayName = "Name2"

		updatedHook2, _, err := client.UpdateOutgoingWebhook(createdHook2)
		require.NoError(t, err)

		require.Equal(t, createdHook2.CreateAt, updatedHook2.CreateAt, "failed - hook create at should not be changed")
	}, "RetainCreateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
		require.NoError(t, err)
		defer func() {
			_, err = client.DeleteOutgoingWebhook(rcreatedHook.Id)
			require.NoError(t, err)
		}()
		rcreatedHook.DisplayName = "Name3"

		updatedHook2, _, err := client.UpdateOutgoingWebhook(rcreatedHook)
		require.NoError(t, err)

		require.NotEqual(t, createdHook.UpdateAt, updatedHook2.UpdateAt, "failed - hook updateAt is not updated")
	}, "ModifyUpdateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		_, resp, err := client.UpdateOutgoingWebhook(nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp, err = client.UpdateOutgoingWebhook(nonExistentHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateNonExistentHook")

	createdHook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
	require.NoError(t, err)

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp, err2 := th.Client.UpdateOutgoingWebhook(createdHook)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})

	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)
	hook2 := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"}}

	createdHook2, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook2)
	require.NoError(t, err)

	_, resp, err := th.Client.UpdateOutgoingWebhook(createdHook2)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.RemovePermissionFromRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)

	th.Client.Logout()
	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)
	th.LoginBasic2()
	t.Run("RetainHookCreator", func(t *testing.T) {
		createdHook.DisplayName = "Basic user 2"
		updatedHook, _, err2 := th.Client.UpdateOutgoingWebhook(createdHook)
		require.NoError(t, err2)

		require.Exactly(t, "Basic user 2", updatedHook.DisplayName, "should apply the change")
		require.Equal(t, th.SystemAdminUser.Id, updatedHook.CreatorId, "hook creator should not be changed")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		firstHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://someurl"}, TriggerWords: []string{"first"}}
		firstHook, _, err = th.SystemAdminClient.CreateOutgoingWebhook(firstHook)
		require.NoError(t, err)

		baseHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://someurl"}, TriggerWords: []string{"base"}}
		baseHook, _, err = th.SystemAdminClient.CreateOutgoingWebhook(baseHook)
		require.NoError(t, err)

		defer func() {
			_, err = client.DeleteOutgoingWebhook(firstHook.Id)
			require.NoError(t, err)
			_, err = client.DeleteOutgoingWebhook(baseHook.Id)
			require.NoError(t, err)
		}()

		t.Run("OnSameChannel", func(t *testing.T) {
			baseHook.TriggerWords = []string{"first"}

			_, resp, err2 := client.UpdateOutgoingWebhook(baseHook)
			require.Error(t, err2)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("OnDifferentChannel", func(t *testing.T) {
			baseHook.TriggerWords = []string{"first"}
			baseHook.ChannelId = th.BasicChannel2.Id

			_, _, err = client.UpdateOutgoingWebhook(baseHook)
			require.NoError(t, err)
		})
	}, "UpdateToExistingTriggerWordAndCallback")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = "junk"

		_, resp, err := client.UpdateOutgoingWebhook(createdHook)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "UpdateToNonExistentChannel")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		privateChannel := th.CreatePrivateChannel()
		createdHook.ChannelId = privateChannel.Id

		_, resp, err := client.UpdateOutgoingWebhook(createdHook)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	}, "UpdateToPrivateChannel")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = ""
		createdHook.TriggerWords = nil

		_, resp, err := client.UpdateOutgoingWebhook(createdHook)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
	}, "UpdateToBlankTriggerWordAndChannel")

	team := th.CreateTeamWithClient(th.Client)
	user := th.CreateUserWithClient(th.Client)
	th.LinkUserToTeam(user, team)
	th.Client.Logout()
	th.Client.Login(user.Id, user.Password)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp, err := th.Client.UpdateOutgoingWebhook(createdHook)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestUpdateOutgoingWebhook_BypassTeamPermissions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer th.RestoreDefaultRolePermissions(defaultRolePermissions)
	th.RemovePermissionFromRole(model.PermissionManageOutgoingWebhooks.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamAdminRoleId)
	th.AddPermissionToRole(model.PermissionManageOutgoingWebhooks.Id, model.TeamUserRoleId)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"}}

	rhook, _, err := th.Client.CreateOutgoingWebhook(hook)
	require.NoError(t, err)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam()
	team.AllowOpenInvite = false
	th.Client.UpdateTeam(team)
	th.SystemAdminClient.RemoveTeamMember(team.Id, th.BasicUser.Id)
	channel := th.CreateChannelWithClientAndTeam(th.SystemAdminClient, model.ChannelTypeOpen, team.Id)

	hook2 := &model.OutgoingWebhook{Id: rhook.Id, ChannelId: channel.Id}
	_, resp, err := th.Client.UpdateOutgoingWebhook(hook2)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestDeleteOutgoingHook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteOutgoingWebhook("abc")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteOutgoingWebhook(model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"}}
		rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook)
		require.NoError(t, err)

		resp, err := client.DeleteOutgoingWebhook(rhook.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Get now should not return this deleted hook
		_, resp, err = client.GetIncomingWebhook(rhook.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	}, "WhenHookExists")

	t.Run("WhenUserDoesNotHavePermissions", func(t *testing.T) {
		hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"dogs"}}
		rhook, _, err := th.SystemAdminClient.CreateOutgoingWebhook(hook)
		require.NoError(t, err)

		th.LoginBasic()
		resp, err := th.Client.DeleteOutgoingWebhook(rhook.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
