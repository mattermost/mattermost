// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestHelpCommand(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	HelpLink := *utils.Cfg.SupportSettings.HelpLink
	defer func() {
		*utils.Cfg.SupportSettings.HelpLink = HelpLink
	}()

	*utils.Cfg.SupportSettings.HelpLink = ""
	rs1 := Client.Must(Client.Command(channel.Id, "/help ")).Data.(*model.CommandResponse)
	if rs1.GotoLocation != model.SUPPORT_SETTINGS_DEFAULT_HELP_LINK {
		t.Fatal("failed to default help link")
	}

	*utils.Cfg.SupportSettings.HelpLink = "https://docs.mattermost.com/guides/user.html"
	rs2 := Client.Must(Client.Command(channel.Id, "/help ")).Data.(*model.CommandResponse)
	if rs2.GotoLocation != "https://docs.mattermost.com/guides/user.html" {
		t.Fatal("failed to help link")
	}
}
