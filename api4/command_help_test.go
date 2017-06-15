// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestHelpCommand(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.Client
	channel := th.BasicChannel

	rs, _ := Client.ExecuteCommand(channel.Id, "/help ")

	if *utils.Cfg.SupportSettings.HelpLink != rs.GotoLocation {
		t.Fatal("failed to get help link")
	}
}
