// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestHelpCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	HelpLink := *th.App.Config().SupportSettings.HelpLink
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SupportSettings.HelpLink = HelpLink })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.SupportSettings.HelpLink = "" })
	rs1, _, _ := client.ExecuteCommand(channel.Id, "/help ")
	assert.Contains(t, rs1.Text, model.SupportSettingsDefaultHelpLink, "failed to default help link")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.SupportSettings.HelpLink = "https://docs.mattermost.com/guides/user.html"
	})
	rs2, _, _ := client.ExecuteCommand(channel.Id, "/help ")
	assert.Contains(t, rs2.Text, "https://docs.mattermost.com/guides/user.html", "failed to help link")
}
