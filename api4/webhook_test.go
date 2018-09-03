// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestCreateIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostIconOverride = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	rhook, resp := th.SystemAdminClient.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	if rhook.ChannelId != hook.ChannelId {
		t.Fatal("channel ids didn't match")
	}

	if rhook.UserId != th.SystemAdminUser.Id {
		t.Fatal("user ids didn't match")
	}

	if rhook.TeamId != th.BasicTeam.Id {
		t.Fatal("team ids didn't match")
	}

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

	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostIconOverride = false })

	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })
	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNotImplementedStatus(t, resp)
}

func TestGetIncomingWebhooks(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

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

	if !found {
		t.Fatal("missing hook")
	}

	hooks, resp = th.SystemAdminClient.GetIncomingWebhooks(0, 1, "")
	CheckNoError(t, resp)

	if len(hooks) != 1 {
		t.Fatal("should only be 1")
	}

	hooks, resp = th.SystemAdminClient.GetIncomingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)

	found = false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	if !found {
		t.Fatal("missing hook")
	}

	hooks, resp = th.SystemAdminClient.GetIncomingWebhooksForTeam(model.NewId(), 0, 1000, "")
	CheckNoError(t, resp)

	if len(hooks) != 0 {
		t.Fatal("no hooks should be returned")
	}

	_, resp = Client.GetIncomingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

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

func TestGetIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	var resp *model.Response
	var rhook *model.IncomingWebhook
	var hook *model.IncomingWebhook

	t.Run("WhenHookExists", func(t *testing.T) {
		hook = &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		rhook, resp = Client.CreateIncomingWebhook(hook)
		CheckNoError(t, resp)

		hook, resp = Client.GetIncomingWebhook(rhook.Id, "")
		CheckOKStatus(t, resp)
	})

	t.Run("WhenHookDoesNotExist", func(t *testing.T) {
		hook, resp = Client.GetIncomingWebhook(model.NewId(), "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("WhenInvalidHookID", func(t *testing.T) {
		hook, resp = Client.GetIncomingWebhook("abc", "")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("WhenUserDoesNotHavePemissions", func(t *testing.T) {
		th.LoginBasic()
		Client = th.Client

		_, resp = Client.GetIncomingWebhook(rhook.Id, "")
		CheckForbiddenStatus(t, resp)
	})
}

func TestDeleteIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	var resp *model.Response
	var rhook *model.IncomingWebhook
	var hook *model.IncomingWebhook
	var status bool

	t.Run("WhenInvalidHookID", func(t *testing.T) {
		status, resp = Client.DeleteIncomingWebhook("abc")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("WhenHookDoesNotExist", func(t *testing.T) {
		status, resp = Client.DeleteIncomingWebhook(model.NewId())
		CheckNotFoundStatus(t, resp)
	})

	t.Run("WhenHookExists", func(t *testing.T) {
		hook = &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		rhook, resp = Client.CreateIncomingWebhook(hook)
		CheckNoError(t, resp)

		if status, resp = Client.DeleteIncomingWebhook(rhook.Id); !status {
			t.Fatal("Delete should have succeeded")
		} else {
			CheckOKStatus(t, resp)
		}

		// Get now should not return this deleted hook
		_, resp = Client.GetIncomingWebhook(rhook.Id, "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("WhenUserDoesNotHavePemissions", func(t *testing.T) {
		hook = &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}
		rhook, resp = Client.CreateIncomingWebhook(hook)
		CheckNoError(t, resp)

		th.LoginBasic()
		Client = th.Client

		_, resp = Client.DeleteIncomingWebhook(rhook.Id)
		CheckForbiddenStatus(t, resp)
	})
}

func TestCreateOutgoingWebhook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}, Username: "some-user-name", IconURL: "http://some-icon-url/"}

	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	if rhook.ChannelId != hook.ChannelId {
		t.Fatal("channel ids didn't match")
	} else if rhook.CreatorId != th.SystemAdminUser.Id {
		t.Fatal("user ids didn't match")
	} else if rhook.TeamId != th.BasicChannel.TeamId {
		t.Fatal("team ids didn't match")
	}

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

	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOutgoingWebhooks(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}
	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	hooks, resp := th.SystemAdminClient.GetOutgoingWebhooks(0, 1000, "")
	CheckNoError(t, resp)

	found := false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	if !found {
		t.Fatal("missing hook")
	}

	hooks, resp = th.SystemAdminClient.GetOutgoingWebhooks(0, 1, "")
	CheckNoError(t, resp)

	if len(hooks) != 1 {
		t.Fatal("should only be 1")
	}

	hooks, resp = th.SystemAdminClient.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)

	found = false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	if !found {
		t.Fatal("missing hook")
	}

	hooks, resp = th.SystemAdminClient.GetOutgoingWebhooksForTeam(model.NewId(), 0, 1000, "")
	CheckNoError(t, resp)

	if len(hooks) != 0 {
		t.Fatal("no hooks should be returned")
	}

	hooks, resp = th.SystemAdminClient.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	CheckNoError(t, resp)

	found = false
	for _, h := range hooks {
		if rhook.Id == h.Id {
			found = true
		}
	}

	if !found {
		t.Fatal("missing hook")
	}

	_, resp = th.SystemAdminClient.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetOutgoingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	_, resp = Client.GetOutgoingWebhooksForTeam(th.BasicTeam.Id, 0, 1000, "")
	CheckNoError(t, resp)

	_, resp = Client.GetOutgoingWebhooksForTeam(model.NewId(), 0, 1000, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetOutgoingWebhooksForChannel(th.BasicChannel.Id, 0, 1000, "")
	CheckNoError(t, resp)

	_, resp = Client.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetOutgoingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetOutgoingWebhooks(0, 1000, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestGetOutgoingWebhook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}

	rhook, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	getHook, resp := th.SystemAdminClient.GetOutgoingWebhook(rhook.Id)
	CheckNoError(t, resp)
	if getHook.Id != rhook.Id {
		t.Fatal("failed to retrieve the correct outgoing hook")
	}

	_, resp = Client.GetOutgoingWebhook(rhook.Id)
	CheckForbiddenStatus(t, resp)

	nonExistentHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id}
	_, resp = th.SystemAdminClient.GetOutgoingWebhook(nonExistentHook.Id)
	CheckNotFoundStatus(t, resp)

	nonExistentHook.Id = model.NewId()
	_, resp = th.SystemAdminClient.GetOutgoingWebhook(nonExistentHook.Id)
	CheckInternalErrorStatus(t, resp)
}

func TestUpdateIncomingHook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	hook1 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

	createdHook, resp := th.SystemAdminClient.CreateIncomingWebhook(hook1)
	CheckNoError(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostUsernameOverride = false })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostIconOverride = false })

	t.Run("UpdateIncomingHook, overrides disabled", func(t *testing.T) {
		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, resp := th.SystemAdminClient.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook != nil {
			if updatedHook.DisplayName != "hook2" {
				t.Fatal("Hook name is not updated")
			}

			if updatedHook.Description != "description" {
				t.Fatal("Hook description is not updated")
			}

			if updatedHook.ChannelId != th.BasicChannel2.Id {
				t.Fatal("Hook channel is not updated")
			}

			if updatedHook.Username != "" {
				t.Fatal("Hook username was incorrectly updated")
			}

			if updatedHook.IconURL != "" {
				t.Fatal("Hook icon was incorrectly updated")
			}
		} else {
			t.Fatal("should not be nil")
		}

		//updatedHook, _ = th.App.GetIncomingWebhook(createdHook.Id)
		assert.Equal(t, updatedHook.ChannelId, createdHook.ChannelId)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostIconOverride = true })

	t.Run("UpdateIncomingHook", func(t *testing.T) {
		createdHook.DisplayName = "hook2"
		createdHook.Description = "description"
		createdHook.ChannelId = th.BasicChannel2.Id
		createdHook.Username = "username"
		createdHook.IconURL = "icon"

		updatedHook, resp := th.SystemAdminClient.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook != nil {
			if updatedHook.DisplayName != "hook2" {
				t.Fatal("Hook name is not updated")
			}

			if updatedHook.Description != "description" {
				t.Fatal("Hook description is not updated")
			}

			if updatedHook.ChannelId != th.BasicChannel2.Id {
				t.Fatal("Hook channel is not updated")
			}

			if updatedHook.Username != "username" {
				t.Fatal("Hook username is not updated")
			}

			if updatedHook.IconURL != "icon" {
				t.Fatal("Hook icon is not updated")
			}
		} else {
			t.Fatal("should not be nil")
		}

		//updatedHook, _ = th.App.GetIncomingWebhook(createdHook.Id)
		assert.Equal(t, updatedHook.ChannelId, createdHook.ChannelId)
	})

	t.Run("RetainCreateAt", func(t *testing.T) {
		hook2 := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, CreateAt: 100}

		createdHook, resp := th.SystemAdminClient.CreateIncomingWebhook(hook2)
		CheckNoError(t, resp)

		createdHook.DisplayName = "Name2"

		updatedHook, resp := th.SystemAdminClient.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook != nil {
			if updatedHook.CreateAt != createdHook.CreateAt {
				t.Fatal("failed - hook create at should not be changed")
			}
		} else {
			t.Fatal("should not be nil")
		}
	})

	t.Run("ModifyUpdateAt", func(t *testing.T) {
		createdHook.DisplayName = "Name3"

		updatedHook, resp := th.SystemAdminClient.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook != nil {
			if updatedHook.UpdateAt == createdHook.UpdateAt {
				t.Fatal("failed - hook updateAt is not updated")
			}
		} else {
			t.Fatal("should not be nil")
		}
	})

	t.Run("UpdateNonExistentHook", func(t *testing.T) {
		nonExistentHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id}

		_, resp := th.SystemAdminClient.UpdateIncomingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp = th.SystemAdminClient.UpdateIncomingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp := Client.UpdateIncomingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	})

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)

	t.Run("OnlyAdminIntegrationsDisabled", func(t *testing.T) {
		th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

		t.Run("UpdateHookOfSameUser", func(t *testing.T) {
			sameUserHook := &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser2.Id}

			sameUserHook, resp := Client.CreateIncomingWebhook(sameUserHook)
			CheckNoError(t, resp)

			_, resp = Client.UpdateIncomingWebhook(sameUserHook)
			CheckNoError(t, resp)
		})

		t.Run("UpdateHookOfDifferentUser", func(t *testing.T) {
			_, resp := Client.UpdateIncomingWebhook(createdHook)
			CheckForbiddenStatus(t, resp)
		})
	})

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)

	Client.Logout()
	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)
	th.LoginBasic2()
	t.Run("UpdateByDifferentUser", func(t *testing.T) {
		updatedHook, resp := Client.UpdateIncomingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook.UserId == th.BasicUser2.Id {
			t.Fatal("Hook's creator userId is not retained")
		}
	})

	t.Run("IncomingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })
		_, resp := Client.UpdateIncomingWebhook(createdHook)
		CheckNotImplementedStatus(t, resp)
		CheckErrorMessage(t, resp, "api.incoming_webhook.disabled.app_error")
	})

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	t.Run("PrivateChannel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		Client.Logout()
		th.LoginBasic()
		createdHook.ChannelId = privateChannel.Id

		_, resp := Client.UpdateIncomingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("UpdateToNonExistentChannel", func(t *testing.T) {
		createdHook.ChannelId = "junk"
		_, resp := th.SystemAdminClient.UpdateIncomingWebhook(createdHook)
		CheckNotFoundStatus(t, resp)
	})

	team := th.CreateTeamWithClient(Client)
	user := th.CreateUserWithClient(Client)
	th.LinkUserToTeam(user, team)
	Client.Logout()
	Client.Login(user.Id, user.Password)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp := Client.UpdateIncomingWebhook(createdHook)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestRegenOutgoingHookToken(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })

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
	if regenHookToken.Token == rhook.Token {
		t.Fatal("regen didn't work properly")
	}

	_, resp = Client.RegenOutgoingHookToken(rhook.Id)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	_, resp = th.SystemAdminClient.RegenOutgoingHookToken(rhook.Id)
	CheckNotImplementedStatus(t, resp)
}

func TestUpdateOutgoingHook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	createdHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"}}

	createdHook, resp := th.SystemAdminClient.CreateOutgoingWebhook(createdHook)
	CheckNoError(t, resp)

	t.Run("UpdateOutgoingWebhook", func(t *testing.T) {
		createdHook.DisplayName = "Cats"
		createdHook.Description = "Get me some cats"

		updatedHook, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook.DisplayName != "Cats" {
			t.Fatal("did not update")
		}
		if updatedHook.Description != "Get me some cats" {
			t.Fatal("did not update")
		}
	})

	t.Run("OutgoingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })
		_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
		CheckNotImplementedStatus(t, resp)
	})

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	t.Run("RetainCreateAt", func(t *testing.T) {
		hook2 := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		createdHook2, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook2)
		CheckNoError(t, resp)
		createdHook2.DisplayName = "Name2"

		updatedHook2, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook2)
		CheckNoError(t, resp)

		if updatedHook2.CreateAt != createdHook2.CreateAt {
			t.Fatal("failed - hook create at should not be changed")
		}
	})

	t.Run("ModifyUpdateAt", func(t *testing.T) {
		createdHook.DisplayName = "Name3"

		updatedHook2, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
		CheckNoError(t, resp)

		if updatedHook2.UpdateAt == createdHook.UpdateAt {
			t.Fatal("failed - hook updateAt is not updated")
		}
	})

	t.Run("UpdateNonExistentHook", func(t *testing.T) {
		nonExistentHook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(nonExistentHook)
		CheckNotFoundStatus(t, resp)

		nonExistentHook.Id = model.NewId()
		_, resp = th.SystemAdminClient.UpdateOutgoingWebhook(nonExistentHook)
		CheckInternalErrorStatus(t, resp)
	})

	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		_, resp := Client.UpdateOutgoingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	})

	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	hook2 := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
		CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats2"}}

	createdHook2, resp := th.SystemAdminClient.CreateOutgoingWebhook(hook2)
	CheckNoError(t, resp)

	_, resp = Client.UpdateOutgoingWebhook(createdHook2)
	CheckForbiddenStatus(t, resp)

	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)

	Client.Logout()
	th.UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)
	th.LoginBasic2()
	t.Run("RetainHookCreator", func(t *testing.T) {
		createdHook.DisplayName = "Basic user 2"
		updatedHook, resp := Client.UpdateOutgoingWebhook(createdHook)
		CheckNoError(t, resp)
		if updatedHook.DisplayName != "Basic user 2" {
			t.Fatal("should apply the change")
		}
		if updatedHook.CreatorId != th.SystemAdminUser.Id {
			t.Fatal("hook creator should not be changed")
		}
	})

	t.Run("UpdateToExistingTriggerWordAndCallback", func(t *testing.T) {
		t.Run("OnSameChannel", func(t *testing.T) {
			createdHook.TriggerWords = []string{"rats"}

			_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("OnDifferentChannel", func(t *testing.T) {
			createdHook.TriggerWords = []string{"cats"}
			createdHook.ChannelId = th.BasicChannel2.Id

			_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
			CheckNoError(t, resp)
		})
	})

	t.Run("UpdateToNonExistentChannel", func(t *testing.T) {
		createdHook.ChannelId = "junk"

		_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("UpdateToPrivateChannel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		createdHook.ChannelId = privateChannel.Id

		_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("UpdateToBlankTriggerWordAndChannel", func(t *testing.T) {
		createdHook.ChannelId = ""
		createdHook.TriggerWords = nil

		_, resp := th.SystemAdminClient.UpdateOutgoingWebhook(createdHook)
		CheckInternalErrorStatus(t, resp)
	})

	team := th.CreateTeamWithClient(Client)
	user := th.CreateUserWithClient(Client)
	th.LinkUserToTeam(user, team)
	Client.Logout()
	Client.Login(user.Id, user.Password)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		_, resp := Client.UpdateOutgoingWebhook(createdHook)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestDeleteOutgoingHook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	var resp *model.Response
	var rhook *model.OutgoingWebhook
	var hook *model.OutgoingWebhook
	var status bool

	t.Run("WhenInvalidHookID", func(t *testing.T) {
		status, resp = Client.DeleteOutgoingWebhook("abc")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("WhenHookDoesNotExist", func(t *testing.T) {
		status, resp = Client.DeleteOutgoingWebhook(model.NewId())
		CheckInternalErrorStatus(t, resp)
	})

	t.Run("WhenHookExists", func(t *testing.T) {
		hook = &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"cats"}}
		rhook, resp = Client.CreateOutgoingWebhook(hook)
		CheckNoError(t, resp)

		if status, resp = Client.DeleteOutgoingWebhook(rhook.Id); !status {
			t.Fatal("Delete should have succeeded")
		} else {
			CheckOKStatus(t, resp)
		}

		// Get now should not return this deleted hook
		_, resp = Client.GetIncomingWebhook(rhook.Id, "")
		CheckNotFoundStatus(t, resp)
	})

	t.Run("WhenUserDoesNotHavePemissions", func(t *testing.T) {
		hook = &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId,
			CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"dogs"}}
		rhook, resp = Client.CreateOutgoingWebhook(hook)
		CheckNoError(t, resp)

		th.LoginBasic()
		Client = th.Client

		_, resp = Client.DeleteOutgoingWebhook(rhook.Id)
		CheckForbiddenStatus(t, resp)
	})
}
