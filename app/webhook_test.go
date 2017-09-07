// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreateWebhookPost(t *testing.T) {
	a := Global()
	th := a.Setup().InitBasic()
	defer a.TearDown()

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.SetDefaultRolesBasedOnConfig()
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	utils.SetDefaultRolesBasedOnConfig()

	hook, err := a.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer a.DeleteIncomingWebhook(hook.Id)

	post, err := a.CreateWebhookPost(hook.UserId, th.BasicChannel, "foo", "user", "http://iconurl", model.StringInterface{
		"attachments": []*model.SlackAttachment{
			&model.SlackAttachment{
				Text: "text",
			},
		},
	}, model.POST_SLACK_ATTACHMENT)
	if err != nil {
		t.Fatal(err.Error())
	}

	for _, k := range []string{"from_webhook", "attachments"} {
		if _, ok := post.Props[k]; !ok {
			t.Fatal(k)
		}
	}
}
