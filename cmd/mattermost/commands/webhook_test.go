// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/model"
)

func TestListWebhooks(t *testing.T) {
	th := api4.Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	adminClient := th.SystemAdminClient

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostUsernameOverride = true })
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnablePostIconOverride = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()
	th.AddPermissionToRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_ADMIN_ROLE_ID)
	th.RemovePermissionFromRole(model.PERMISSION_MANAGE_WEBHOOKS.Id, model.TEAM_USER_ROLE_ID)

	dispName := "myhookinc"
	hook := &model.IncomingWebhook{DisplayName: dispName, ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId}
	_, resp := adminClient.CreateIncomingWebhook(hook)
	api4.CheckNoError(t, resp)

	dispName2 := "myhookout"
	outHook := &model.OutgoingWebhook{DisplayName: dispName2, ChannelId: th.BasicChannel.Id, TeamId: th.BasicChannel.TeamId, CallbackURLs: []string{"http://nowhere.com"}, Username: "some-user-name", IconURL: "http://some-icon-url/"}
	_, resp = adminClient.CreateOutgoingWebhook(outHook)
	api4.CheckNoError(t, resp)

	output := CheckCommand(t, "webhook", "list", th.BasicTeam.Name)

	if !strings.Contains(string(output), dispName) {
		t.Fatal("should have incoming webhooks")
	}

	if !strings.Contains(string(output), dispName2) {
		t.Fatal("should have outgoing webhooks")
	}

}
