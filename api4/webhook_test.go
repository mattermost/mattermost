// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestCreateIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

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

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	utils.SetDefaultRolesBasedOnConfig()

	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNoError(t, resp)

	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false
	_, resp = Client.CreateIncomingWebhook(hook)
	CheckNotImplementedStatus(t, resp)
}

func TestGetIncomingWebhooks(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

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

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	utils.SetDefaultRolesBasedOnConfig()

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
	defer TearDown()
	Client := th.SystemAdminClient

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

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
	defer TearDown()
	Client := th.SystemAdminClient

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

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
	defer TearDown()
	Client := th.Client

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

	hook := &model.OutgoingWebhook{ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}}

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

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	utils.SetDefaultRolesBasedOnConfig()

	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckNoError(t, resp)

	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false
	_, resp = Client.CreateOutgoingWebhook(hook)
	CheckNotImplementedStatus(t, resp)
}

func TestGetOutgoingWebhooks(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true
	utils.SetDefaultRolesBasedOnConfig()

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

	hooks, resp = th.SystemAdminClient.GetOutgoingWebhooksForChannel(model.NewId(), 0, 1000, "")
	CheckNoError(t, resp)

	if len(hooks) != 0 {
		t.Fatal("no hooks should be returned")
	}

	_, resp = Client.GetOutgoingWebhooks(0, 1000, "")
	CheckForbiddenStatus(t, resp)

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false
	utils.SetDefaultRolesBasedOnConfig()

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
