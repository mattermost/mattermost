// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"github.com/stretchr/testify/require"
	"strconv"
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

func TestCreateIncomingWebhook(t *testing.T) {
	th := api4.Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

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

	// should fail because you need to specify valid channel
	require.Error(t, RunCommand(t, "webhook", "create-incoming"))
	require.Error(t, RunCommand(t, "webhook", "create-incoming", "--channel", th.BasicTeam.Name+":doesnotexist"))

	// should fail because you need to specify valid user
	require.Error(t, RunCommand(t, "webhook", "create-incoming", "--channel", th.BasicChannel.Id))
	require.Error(t, RunCommand(t, "webhook", "create-incoming", "--channel", th.BasicChannel.Id, "--user", "doesnotexist"))

	description := "myhookinc"
	displayName := "myhookinc"
	CheckCommand(t, "webhook", "create-incoming", "--channel", th.BasicChannel.Id, "--user", th.BasicUser.Email, "--description", description, "--display-name", displayName)

	webhooks, err := th.App.GetIncomingWebhooksPage(0, 1000)
	if err != nil {
		t.Fatal("unable to retrieve incoming webhooks")
	}

	found := false
	for _, webhook := range webhooks {
		if webhook.Description == description && webhook.UserId == th.BasicUser.Id {
			found = true
		}
	}
	if !found {
		t.Fatal("Failed to create incoming webhook")
	}
}

func TestModifyIncomingWebhook(t *testing.T) {
	th := api4.Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

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

	description := "myhookincdesc"
	displayName := "myhookincname"

	incomingWebhook := &model.IncomingWebhook{
		ChannelId:     th.BasicChannel.Id,
		DisplayName:   displayName,
		Description:   description,
	}

	oldHook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, incomingWebhook)
	if err != nil {
		t.Fatal("unable to create incoming webhooks")
	}
	defer func() {
		th.App.DeleteIncomingWebhook(oldHook.Id)
	}()

	// should fail because you need to specify valid incoming webhook
	require.Error(t, RunCommand(t, "webhook", "modify-incoming", "doesnotexist"))
	// should fail because you need to specify valid channel
	require.Error(t, RunCommand(t, "webhook", "modify-incoming", oldHook.Id, "--channel", th.BasicTeam.Name+":doesnotexist"))

	modifiedDescription := "myhookincdesc2"
	modifiedDisplayName := "myhookincname2"
	modifiedIconUrl := "myhookincicon2"
	modifiedChannelLocked := true
	modifiedChannelId := th.BasicChannel2.Id

	CheckCommand(t, "webhook", "modify-incoming", oldHook.Id, "--channel", modifiedChannelId, "--description", modifiedDescription, "--display-name", modifiedDisplayName, "--icon", modifiedIconUrl, "--lock-to-channel", strconv.FormatBool(modifiedChannelLocked))

	modifiedHook, err := th.App.GetIncomingWebhook(oldHook.Id)
	if err != nil {
		t.Fatal("unable to retrieve modified incoming webhook")
	}
	if modifiedHook.DisplayName != modifiedDisplayName || modifiedHook.Description != modifiedDescription || modifiedHook.IconURL != modifiedIconUrl || modifiedHook.ChannelLocked != modifiedChannelLocked || modifiedHook.ChannelId != modifiedChannelId {
		t.Fatal("Failed to update incoming webhook")
	}
}
