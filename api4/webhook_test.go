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
