// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"testing"
	"github.com/mattermost/platform/utils"
)

func TestHelpCommand(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	rs := Client.Must(Client.Command(channel.Id, "/help ")).Data.(*model.CommandResponse)
	if *utils.Cfg.SupportSettings.HelpLink != rs.GotoLocation {
		t.Fatal("failed to get help link")
	}
}
