// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestHelpCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	channel := th.BasicChannel

	HelpLink := *th.App.Config().SupportSettings.HelpLink
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SupportSettings.HelpLink = HelpLink })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SupportSettings.HelpLink = "" })
	rs1 := Client.Must(Client.Command(channel.Id, "/help ")).Data.(*model.CommandResponse)
	if rs1.GotoLocation != model.SUPPORT_SETTINGS_DEFAULT_HELP_LINK {
		t.Fatal("failed to default help link")
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.SupportSettings.HelpLink = "https://docs.mattermost.com/guides/user.html"
	})
	rs2 := Client.Must(Client.Command(channel.Id, "/help ")).Data.(*model.CommandResponse)
	if rs2.GotoLocation != "https://docs.mattermost.com/guides/user.html" {
		t.Fatal("failed to help link")
	}
}
