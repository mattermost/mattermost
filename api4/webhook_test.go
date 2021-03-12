// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCreateIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableIncomingWebhooks = true
		*cfg.ServiceSettings.EnablePostUsernameOverride = true
		*cfg.ServiceSettings.EnablePostIconOverride = true
	})

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, resp := th.SystemAdminClient.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	require.Equal(t, hook.ChannelId, rhook.ChannelId, "channel ids didn't match")
	require.Equal(t, th.SystemAdminUser.Id, rhook.UserId, "user ids didn't match")
	require.Equal(t, th.BasicTeam.Id, rhook.TeamId, "team ids didn't match")

	hook.ChannelId = "junk"
	_, resp = th.SystemAdminClient.CreateIncomingWebhook(hook)
	CheckNotFoundStatus(t, resp)

	hook.ChannelId = th.BasicChannel.Id
	th.LoginTeamAdmin()
	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	th.LoginBasic()
	_, resp = Client.CreateIncomingWebhook(hook)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = false })

	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.UserId = th.BasicUser2.Id
		defer func() { hook.UserId = "" }()

		newHook, response := client.CreateIncomingWebhook(hook)
		CheckNoError(t, response)
		require.Equal(t, th.BasicUser2.Id, newHook.UserId)
	}, "Create an incoming webhook for a different user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.UserId = "invalid-user"
		defer func() { hook.UserId = "" }()

		_, response := client.CreateIncomingWebhook(hook)
		CheckNotFoundStatus(t, response)
	}, "Create an incoming webhook for an invalid user")

	t.Run("Create an incoming webhook for a different user without permissions", func(t *testing.T) {
		hook.UserId = th.BasicUser2.Id
		defer func() { hook.UserId = "" }()

		_, response := Client.CreateIncomingWebhook(hook)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Create an incoming webhook in local mode without providing user", func(t *testing.T) {
		hook.UserId = ""

		_, response := th.LocalClient.CreateIncomingWebhook(hook)
		CheckBadRequestStatus(t, response)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	_, resp = Client.CreateIncomingWebhook(hook)
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
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.SYSTEM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, resp := th.Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.UserId, th.BasicUser.Id)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam()
	team.AllowOpenInvite = false
	th.Client.UpdateTeam(team)
	th.SystemAdminClient.RemoveTeamMember(team.Id, th.BasicUser.Id)
	channel := th.CreateChannelWithClientAndTeam(th.SystemAdminClient, model.CHANNEL_OPEN, team.Id)

	hook = &model.IncomingWebhook{ChannelId: channel.Id}
	rhook, resp = th.Client.CreateIncomingWebhook(hook)
	CheckForbiddenStatus(t, resp)
}

func TestGetIncomingWebhooks(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
	rhook, resp := th.SystemAdminClient.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	hooks, resp := th.SystemAdminClient.GetIncomingWebhooks(0, 1000, "")
	CheckNoError(t, resp)

	found := false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	require.True(t, found, "missing hook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hooks, resp = client.GetIncomingWebhooks(0, 1, "")
		CheckNoError(t, resp)

		require.Len(t, hooks, 1, "should only be 1 hook")

		hooks, resp = client.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		CheckNoError(t, resp)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, resp = client.GetIncomingWebhooksForTeam(model.NewId(), 0, 1000, "")
		CheckNoError(t, resp)

		require.Empty(t, hooks, "no hooks should be returned")
	})

	_, resp = Client.GetIncomingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = Client.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)

	_, resp = Client.GetIncomingWebhooksForTeam(model.NewId(), 0, 1000, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetIncomingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetIncomingWebhooks(0, 1000, "")
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.SYSTEM_USER_ROLE_ID)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, resp := BasicClient.CreateIncomingWebhook(bHook)
	CheckNoError(t, resp)

	basicHooks, resp := BasicClient.GetIncomingWebhooks(0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	_, resp = th.SystemAdminClient.CreateIncomingWebhook(aHook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, rresp := client.GetIncomingWebhooks(0, 1000, "")
		CheckNoError(t, rresp)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, resp := BasicClient.GetIncomingWebhooks(0, 1000, "")
	CheckNoError(t, resp)
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	// Basic user webhook
	bHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}
	basicHook, resp := BasicClient.CreateIncomingWebhook(bHook)
	CheckNoError(t, resp)

	basicHooks, resp := BasicClient.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicTeam.Id, UserId: th.SystemAdminUser.Id}
	_, resp = th.SystemAdminClient.CreateIncomingWebhook(aHook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, rresp := client.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		CheckNoError(t, rresp)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, resp := BasicClient.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
	rhook, resp := th.SystemAdminClient.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook, resp = client.GetIncomingWebhook(rhook.Id, "")
		CheckOKStatus(t, resp)
	}, "WhenHookExists")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook, resp = client.GetIncomingWebhook(model.NewId(), "")
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook, resp = client.GetIncomingWebhook("abc", "")
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	t.Run("WhenUserDoesNotHavePemissions", func(t *testing.T) {
		th.LoginBasic()
		_, resp = th.Client.GetIncomingWebhook(rhook.Id, "")
		CheckForbiddenStatus(t, resp)
	})
}

func TestDeleteIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	var resp *model.Response
	var rhook *model.IncomingWebhook
	var hook *model.IncomingWebhook
	var status bool

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		status, resp = client.DeleteIncomingWebhook("abc")
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		status, resp = client.DeleteIncomingWebhook(model.NewId())
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook = &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		// This request is performed by a system admin in both local
		// and sysadmin cases as it's not currently possible to create
		// a webhook via local mode
		rhook, resp = th.SystemAdminClient.CreateIncomingWebhook(hook)
		CheckNoError(t, resp)

		status, resp = client.DeleteIncomingWebhook(rhook.Id)
		require.True(t, status, "Delete should have succeeded")

		CheckOKStatus(t, resp)

		// Get now should not return this deleted hook
		_, resp = client.GetIncomingWebhook(rhook.Id, "")
		CheckNotFoundStatus(t, resp)
	}, "WhenHookExists")

	t.Run("WhenUserDoesNotHavePemissions", func(t *testing.T) {
		hook = &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		rhook, resp = th.SystemAdminClient.CreateIncomingWebhook(hook)
		CheckNoError(t, resp)

		th.LoginBasic()
		_, resp = th.Client.DeleteIncomingWebhook(rhook.Id)
		CheckForbiddenStatus(t, resp)
	})
}

func TestCreateOutgoingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}, Username: "some-user-name", IconURL: "http://some-icon-url/"}

	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	assert.Equal(t, hook.ChannelId, rhook.ChannelId, "channel ids didn't match")
	assert.Equal(t, th.SystemAdminUser.Id, rhook.CreatorId, "user ids didn't match")
	assert.Equal(t, th.BasicChannel.TeamId, rhook.TeamId, "team ids didn't match")

	hook.ChannelId = "junk"
	_, resp = th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNotFoundStatus(t, resp)

	hook.ChannelId = th.BasicChannel.Id
	th.LoginTeamAdmin()
	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	th.LoginBasic()
	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.CreatorId = th.BasicUser2.Id
		defer func() { hook.CreatorId = "" }()

		newHook, response := client.CreateOutgoingWebhook(hook)
		CheckNoError(t, response)
		require.Equal(t, th.BasicUser2.Id, newHook.CreatorId)
	}, "Create an outgoing webhook for a different user")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook.CreatorId = "invalid-user"
		defer func() { hook.CreatorId = "" }()

		_, response := client.CreateOutgoingWebhook(hook)
		CheckNotFoundStatus(t, response)
	}, "Create an incoming webhook for an invalid user")

	t.Run("Create an outgoing webhook for a different user without permissions", func(t *testing.T) {
		hook.CreatorId = th.BasicUser2.Id
		defer func() { hook.CreatorId = "" }()

		_, response := Client.CreateOutgoingWebhook(hook)
		CheckForbiddenStatus(t, response)
	})

	t.Run("Create an outgoing webhook in local mode without providing user", func(t *testing.T) {
		hook.CreatorId = ""

		_, response := th.LocalClient.CreateOutgoingWebhook(hook)
		CheckBadRequestStatus(t, response)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp = Client.CreateOutgoingWebhook(hook)
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hooks, rresp := client.GetOutgoingWebhooks(0, 1000, "")
		CheckNoError(t, rresp)

		found := false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, rresp = client.GetOutgoingWebhooks(0, 1, "")
		CheckNoError(t, rresp)

		require.Len(t, hooks, 1, "should only be 1 hook")

		hooks, rresp = client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		CheckNoError(t, rresp)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		hooks, rresp = client.GetOutgoingWebhooksForTeam(model.NewId(), 0, 1000, "")
		CheckNoError(t, rresp)

		require.Empty(t, hooks, "no hooks should be returned")

		hooks, rresp = client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
		CheckNoError(t, rresp)

		found = false
		for _, h := range hooks {
			if rhook.Id == h.Id {
				found = true
			}
		}

		require.True(t, found, "missing hook")

		_, rresp = client.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
		CheckForbiddenStatus(t, rresp)
	})

	_, resp = th.Client.GetOutgoingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = th.Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)

	_, resp = th.Client.GetOutgoingWebhooksForTeam(model.NewId(), 0, 1000, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	CheckNoError(t, resp)

	_, resp = th.Client.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
	CheckForbiddenStatus(t, resp)

	_, resp = th.Client.GetOutgoingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()
	_, resp = th.Client.GetOutgoingWebhooks(0, 1000, "")
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, resp := th.Client.CreateOutgoingWebhook(bHook)
	CheckNoError(t, resp)

	basicHooks, resp := th.Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, resp = th.SystemAdminClient.CreateOutgoingWebhook(aHook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, rresp := client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
		CheckNoError(t, rresp)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, resp := th.Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, resp := th.Client.CreateOutgoingWebhook(bHook)
	CheckNoError(t, resp)

	basicHooks, resp := th.Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, resp = th.SystemAdminClient.CreateOutgoingWebhook(aHook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, rresp := client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
		CheckNoError(t, rresp)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, resp := th.Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	CheckNoError(t, resp)
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.SYSTEM_USER_ROLE_ID)

	// Basic user webhook
	bHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	basicHook, resp := th.Client.CreateOutgoingWebhook(bHook)
	CheckNoError(t, resp)

	basicHooks, resp := th.Client.GetOutgoingWebhooks(0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(basicHooks))
	assert.Equal(t, basicHook.Id, basicHooks[0].Id)

	// Admin User webhook
	aHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	_, resp = th.SystemAdminClient.CreateOutgoingWebhook(aHook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		adminHooks, rresp := client.GetOutgoingWebhooks(0, 1000, "")
		CheckNoError(t, rresp)
		assert.Equal(t, 2, len(adminHooks))
	})

	//Re-check basic user that has no MANAGE_OTHERS permission
	filteredHooks, resp := th.Client.GetOutgoingWebhooks(0, 1000, "")
	CheckNoError(t, resp)
	assert.Equal(t, 1, len(filteredHooks))
	assert.Equal(t, basicHook.Id, filteredHooks[0].Id)
}

func TestGetOutgoingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}

	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		getHook, rresp := client.GetOutgoingWebhook(rhook.Id)
		CheckNoError(t, rresp)

		require.Equal(t, getHook.Id, rhook.Id, "failed to retrieve the correct outgoing hook")
	})

	_, resp = th.Client.GetOutgoingWebhook(rhook.Id)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id}
		_, resp = client.GetOutgoingWebhook(nonExistentHook.Id)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp = client.GetOutgoingWebhook(nonExistentHook.Id)
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook1 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	var resp *model.Response
	var createdHook *model.IncomingWebhook

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnablePostIconOverride = false })

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// webhook creations are allways performed by a sysadmin
		// because it's not currently possible to create a webhook via
		// local mode
		createdHook, resp = th.SystemAdminClient.CreateIncomingWebhook(hook1)
		CheckNoError(t, resp)

		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, rresp := client.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, rresp)

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
		createdHook, resp = th.SystemAdminClient.CreateIncomingWebhook(hook1)
		CheckNoError(t, resp)

		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, resp := client.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)

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

		createdHook2, resp := th.SystemAdminClient.CreateIncomingWebhook(hook2)
		CheckNoError(t, resp)

		createdHook2.DisplayName = "Name2"

		updatedHook, resp := client.UpdateIncomingWebhook(createdHook2)
		CheckNoError(t, resp)
		require.NotNil(t, updatedHook)
		assert.Equal(t, createdHook2.CreateAt, updatedHook.CreateAt)
	}, "RetainCreateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.DisplayName = "Name3"

		updatedHook, resp := client.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		require.NotNil(t, updatedHook, "should not be nil")
		require.NotEqual(t, createdHook.UpdateAt, updatedHook.UpdateAt, "failed - hook updateAt is not updated")
	}, "ModifyUpdateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

		_, resp := client.UpdateIncomingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp = client.UpdateIncomingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)
	}, "UpdateNonExistentHook")

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp := th.Client.UpdateIncomingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	})

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)

	t.Run("OnlyAdminIntegrationsDisabled", func(t *testing.T) {
		th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

		t.Run("UpdateHookOfSameUser", func(t *testing.T) {
			sameUserHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

			sameUserHook, resp := th.Client.CreateIncomingWebhook(sameUserHook)
			CheckNoError(t, resp)

			sameUserHook.UserId = th.BasicUser2.Id
			_, resp = th.Client.UpdateIncomingWebhook(sameUserHook)
			CheckNoError(t, resp)
		})

		t.Run("UpdateHookOfDifferentUser", func(t *testing.T) {
			_, resp := th.Client.UpdateIncomingWebhook(createdHook)
			CheckForbiddenStatus(t, resp)
		})
	})

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)

	th.Client.Logout()
	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)
	th.LoginBasic2()
	t.Run("UpdateByDifferentUser", func(t *testing.T) {
		updatedHook, resp := th.Client.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		require.NotEqual(t, th.BasicUser2.Id, updatedHook.UserId, "Hook's creator userId is not retained")
	})

	t.Run("IncomingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
		_, resp := th.Client.UpdateIncomingWebhook(createdHook)
		CheckNotImplementedStatus(t, resp)
		CheckErrorMessage(t, resp, "api.incoming_webhook.disabled.app_error")
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	t.Run("PrivateChannel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		th.Client.Logout()
		th.LoginBasic()
		createdHook.ChannelId = privateChannel.Id

		_, resp := th.Client.UpdateIncomingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = "junk"
		_, resp := client.UpdateIncomingWebhook(createdHook)
		CheckNotFoundStatus(t, resp)
	}, "UpdateToNonExistentChannel")

	team := th.CreateTeamWithClient(th.Client)
	user := th.CreateUserWithClient(th.Client)
	th.LinkUserToTeam(user, team)
	th.Client.Logout()
	th.Client.Login(user.Id, user.Password)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp := th.Client.UpdateIncomingWebhook(createdHook)
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
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.SYSTEM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, resp := th.Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.UserId, th.BasicUser.Id)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam()
	team.AllowOpenInvite = false
	th.Client.UpdateTeam(team)
	th.SystemAdminClient.RemoveTeamMember(team.Id, th.BasicUser.Id)
	channel := th.CreateChannelWithClientAndTeam(th.SystemAdminClient, model.CHANNEL_OPEN, team.Id)

	hook2 := &model.IncomingWebhook{Id: rhook.Id, ChannelId: channel.Id}
	rhook, resp = th.Client.UpdateIncomingWebhook(hook2)
	CheckBadRequestStatus(t, resp)
}

func TestRegenOutgoingHookToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.RegenOutgoingHookToken("junk")
	CheckBadRequestStatus(t, resp)

	//investigate why is act weird on jenkins
	// _, resp = th.SystemAdminClient.RegenOutgoingHookToken("")
	// CheckNotFoundStatus(t, resp)

	regenHookToken, resp := th.SystemAdminClient.RegenOutgoingHookToken(rhook.Id)
	CheckNoError(t, resp)
	require.NotEqual(t, rhook.Token, regenHookToken.Token, "regen didn't work properly")

	_, resp = Client.RegenOutgoingHookToken(rhook.Id)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp = th.SystemAdminClient.RegenOutgoingHookToken(rhook.Id)
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
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	createdHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"}}

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, webookResp := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
		CheckNoError(t, webookResp)
		defer func() {
			_, resp := client.DeleteOutgoingWebhook(rcreatedHook.Id)
			CheckNoError(t, resp)
		}()

		rcreatedHook.DisplayName = "Cats"
		rcreatedHook.Description = "Get me some cats"

		updatedHook, resp := client.UpdateOutgoingWebhook(rcreatedHook)
		CheckNoError(t, resp)

		require.Exactly(t, "Cats", updatedHook.DisplayName, "did not update")
		require.Exactly(t, "Get me some cats", updatedHook.Description, "did not update")
	}, "UpdateOutgoingWebhook")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, webookResp := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
		CheckNoError(t, webookResp)
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
			_, resp := client.DeleteOutgoingWebhook(rcreatedHook.Id)
			CheckNoError(t, resp)
		}()

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
		_, resp := client.UpdateOutgoingWebhook(rcreatedHook)
		CheckNotImplementedStatus(t, resp)
	}, "OutgoingHooksDisabled")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook2 := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		createdHook2, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook2)
		CheckNoError(t, resp)
		defer func() {
			_, rresp := client.DeleteOutgoingWebhook(createdHook2.Id)
			CheckNoError(t, rresp)
		}()
		createdHook2.DisplayName = "Name2"

		updatedHook2, resp := client.UpdateOutgoingWebhook(createdHook2)
		CheckNoError(t, resp)

		require.Equal(t, createdHook2.CreateAt, updatedHook2.CreateAt, "failed - hook create at should not be changed")
	}, "RetainCreateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		rcreatedHook, resp := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
		CheckNoError(t, resp)
		defer func() {
			_, rresp := client.DeleteOutgoingWebhook(rcreatedHook.Id)
			CheckNoError(t, rresp)
		}()
		rcreatedHook.DisplayName = "Name3"

		updatedHook2, resp := client.UpdateOutgoingWebhook(rcreatedHook)
		CheckNoError(t, resp)

		require.NotEqual(t, createdHook.UpdateAt, updatedHook2.UpdateAt, "failed - hook updateAt is not updated")
	}, "ModifyUpdateAt")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		nonExistentHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		_, resp := client.UpdateOutgoingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp = client.UpdateOutgoingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)
	}, "UpdateNonExistentHook")

	createdHook, resp := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
	CheckNoError(t, resp)

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, rresp := th.Client.UpdateOutgoingWebhook(createdHook)
		CheckForbiddenStatus(t, rresp)
	})

	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	hook2 := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"}}

	createdHook2, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook2)
	CheckNoError(t, resp)

	_, resp = th.Client.UpdateOutgoingWebhook(createdHook2)
	CheckForbiddenStatus(t, resp)

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)

	th.Client.Logout()
	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)
	th.LoginBasic2()
	t.Run("RetainHookCreator", func(t *testing.T) {
		createdHook.DisplayName = "Basic user 2"
		updatedHook, rresp := th.Client.UpdateOutgoingWebhook(createdHook)
		CheckNoError(t, rresp)

		require.Exactly(t, "Basic user 2", updatedHook.DisplayName, "should apply the change")
		require.Equal(t, th.SystemAdminUser.Id, updatedHook.CreatorId, "hook creator should not be changed")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		firstHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://someurl"}, TriggerWords: []string{"first"}}
		firstHook, resp = th.SystemAdminClient.CreateOutgoingWebhook(firstHook)
		CheckNoError(t, resp)

		baseHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://someurl"}, TriggerWords: []string{"base"}}
		baseHook, resp = th.SystemAdminClient.CreateOutgoingWebhook(baseHook)
		CheckNoError(t, resp)

		defer func() {
			_, resp := client.DeleteOutgoingWebhook(firstHook.Id)
			CheckNoError(t, resp)
			_, resp = client.DeleteOutgoingWebhook(baseHook.Id)
			CheckNoError(t, resp)
		}()

		t.Run("OnSameChannel", func(t *testing.T) {
			baseHook.TriggerWords = []string{"first"}

			_, resp := client.UpdateOutgoingWebhook(baseHook)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("OnDifferentChannel", func(t *testing.T) {
			baseHook.TriggerWords = []string{"first"}
			baseHook.ChannelId = th.BasicChannel2.Id

			_, resp := client.UpdateOutgoingWebhook(baseHook)
			CheckNoError(t, resp)
		})
	}, "UpdateToExistingTriggerWordAndCallback")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = "junk"

		_, resp := client.UpdateOutgoingWebhook(createdHook)
		CheckNotFoundStatus(t, resp)
	}, "UpdateToNonExistentChannel")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		privateChannel := th.CreatePrivateChannel()
		createdHook.ChannelId = privateChannel.Id

		_, resp := client.UpdateOutgoingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	}, "UpdateToPrivateChannel")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		createdHook.ChannelId = ""
		createdHook.TriggerWords = nil

		_, resp := client.UpdateOutgoingWebhook(createdHook)
		CheckInternalErrorStatus(t, resp)
	}, "UpdateToBlankTriggerWordAndChannel")

	team := th.CreateTeamWithClient(th.Client)
	user := th.CreateUserWithClient(th.Client)
	th.LinkUserToTeam(user, team)
	th.Client.Logout()
	th.Client.Login(user.Id, user.Password)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp := th.Client.UpdateOutgoingWebhook(createdHook)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestUpdateOutgoingWebhook_BypassTeamPermissions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer th.RestoreDefaultRolePermissions(defaultRolePermissions)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.SYSTEM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"}}

	rhook, resp := th.Client.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	require.Equal(t, rhook.ChannelId, hook.ChannelId)
	require.Equal(t, rhook.TeamId, th.BasicTeam.Id)

	team := th.CreateTeam()
	team.AllowOpenInvite = false
	th.Client.UpdateTeam(team)
	th.SystemAdminClient.RemoveTeamMember(team.Id, th.BasicUser.Id)
	channel := th.CreateChannelWithClientAndTeam(th.SystemAdminClient, model.CHANNEL_OPEN, team.Id)

	hook2 := &model.OutgoingWebhook{Id: rhook.Id, ChannelId: channel.Id}
	rhook, resp = th.Client.UpdateOutgoingWebhook(hook2)
	CheckForbiddenStatus(t, resp)
}

func TestDeleteOutgoingHook(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })

	var resp *model.Response
	var rhook *model.OutgoingWebhook
	var hook *model.OutgoingWebhook
	var status bool

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		status, resp = client.DeleteOutgoingWebhook("abc")
		CheckBadRequestStatus(t, resp)
	}, "WhenInvalidHookID")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		status, resp = client.DeleteOutgoingWebhook(model.NewId())
		CheckNotFoundStatus(t, resp)
	}, "WhenHookDoesNotExist")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		hook = &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"}}
		rhook, resp = th.SystemAdminClient.CreateOutgoingWebhook(hook)
		CheckNoError(t, resp)

		status, resp = client.DeleteOutgoingWebhook(rhook.Id)

		require.True(t, status, "Delete should have succeeded")
		CheckOKStatus(t, resp)

		// Get now should not return this deleted hook
		_, resp = client.GetIncomingWebhook(rhook.Id, "")
		CheckNotFoundStatus(t, resp)
	}, "WhenHookExists")

	t.Run("WhenUserDoesNotHavePemissions", func(t *testing.T) {
		hook = &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"dogs"}}
		rhook, resp = th.SystemAdminClient.CreateOutgoingWebhook(hook)
		CheckNoError(t, resp)

		th.LoginBasic()
		_, resp = th.Client.DeleteOutgoingWebhook(rhook.Id)
		CheckForbiddenStatus(t, resp)
	})
}
