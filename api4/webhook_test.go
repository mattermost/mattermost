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
	CheckBadRequestStatus(t, resp)

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
