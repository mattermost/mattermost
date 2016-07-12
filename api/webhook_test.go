// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"testing"
)

func TestCreateIncomingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	channel2 := th.CreatePrivateChannel(Client, team)
	channel3 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}

	var rhook *model.IncomingWebhook
	if result, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		rhook = result.Data.(*model.IncomingWebhook)
	}

	if hook.ChannelId != rhook.ChannelId {
		t.Fatal("channel ids didn't match")
	}

	if rhook.UserId != user.Id {
		t.Fatal("user ids didn't match")
	}

	if rhook.TeamId != team.Id {
		t.Fatal("team ids didn't match")
	}

	hook = &model.IncomingWebhook{ChannelId: "junk"}
	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have failed - bad channel id")
	}

	hook = &model.IncomingWebhook{ChannelId: channel2.Id, UserId: "123", TeamId: "456"}
	if result, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.IncomingWebhook).UserId != user.Id {
			t.Fatal("bad user id wasn't overwritten")
		}
		if result.Data.(*model.IncomingWebhook).TeamId != team.Id {
			t.Fatal("bad team id wasn't overwritten")
		}
	}

	Client.Must(Client.LeaveChannel(channel3.Id))

	hook = &model.IncomingWebhook{ChannelId: channel3.Id, UserId: user.Id, TeamId: team.Id}
	if _, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	hook = &model.IncomingWebhook{ChannelId: channel1.Id}

	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	if _, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	hook = &model.IncomingWebhook{ChannelId: channel2.Id}

	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have failed - channel is private and not a member")
	}

	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false

	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestListIncomingHooks(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook1 := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook1 = Client.Must(Client.CreateIncomingWebhook(hook1)).Data.(*model.IncomingWebhook)

	hook2 := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook2 = Client.Must(Client.CreateIncomingWebhook(hook2)).Data.(*model.IncomingWebhook)

	if result, err := Client.ListIncomingWebhooks(); err != nil {
		t.Fatal(err)
	} else {
		hooks := result.Data.([]*model.IncomingWebhook)

		if len(hooks) != 2 {
			t.Fatal("incorrect number of hooks")
		}
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.ListIncomingWebhooks(); err == nil {
		t.Fatal("should have errored - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	if _, err := Client.ListIncomingWebhooks(); err != nil {
		t.Fatal(err)
	}

	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false

	if _, err := Client.ListIncomingWebhooks(); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestDeleteIncomingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DeleteIncomingWebhook("junk"); err == nil {
		t.Fatal("should have failed - bad id")
	}

	if _, err := Client.DeleteIncomingWebhook(""); err == nil {
		t.Fatal("should have failed - empty id")
	}

	hooks := Client.Must(Client.ListIncomingWebhooks()).Data.([]*model.IncomingWebhook)
	if len(hooks) != 0 {
		t.Fatal("delete didn't work properly")
	}

	hook = &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not creator or team admin")
	}

	hook = &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestCreateOutgoingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam
	team2 := th.CreateTeam(Client)
	channel1 := th.CreateChannel(Client, team)
	channel2 := th.CreatePrivateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)
	user3 := th.CreateUser(Client)
	LinkUserToTeam(user3, team2)

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}

	var rhook *model.OutgoingWebhook
	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		rhook = result.Data.(*model.OutgoingWebhook)
	}

	if hook.ChannelId != rhook.ChannelId {
		t.Fatal("channel ids didn't match")
	}

	if rhook.CreatorId != user.Id {
		t.Fatal("user ids didn't match")
	}

	if rhook.TeamId != team.Id {
		t.Fatal("team ids didn't match")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, TriggerWords: []string{"cats", "dogs"}, CallbackURLs: []string{"http://nowhere.com", "http://cats.com"}}
	hook1 := &model.OutgoingWebhook{ChannelId: channel1.Id, TriggerWords: []string{"cats"}, CallbackURLs: []string{"http://nowhere.com"}}

	if _, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal("multiple trigger words and urls failed")
	}

	if _, err := Client.CreateOutgoingWebhook(hook1); err == nil {
		t.Fatal("should have failed - duplicate trigger words and urls")
	}

	hook = &model.OutgoingWebhook{ChannelId: "junk", CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - bad channel id")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CreatorId: "123", TeamId: "456", CallbackURLs: []string{"http://nowhere.com"}}
	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.OutgoingWebhook).CreatorId != user.Id {
			t.Fatal("bad user id wasn't overwritten")
		}
		if result.Data.(*model.OutgoingWebhook).TeamId != team.Id {
			t.Fatal("bad team id wasn't overwritten")
		}
	}

	hook = &model.OutgoingWebhook{ChannelId: channel2.Id, CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - private channel")
	}

	hook = &model.OutgoingWebhook{CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - blank channel and trigger words")
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	if _, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team2.Id)

	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - wrong team")
	}

	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false

	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestListOutgoingHooks(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook1 := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook1 = Client.Must(Client.CreateOutgoingWebhook(hook1)).Data.(*model.OutgoingWebhook)

	hook2 := &model.OutgoingWebhook{TriggerWords: []string{"trigger"}, CallbackURLs: []string{"http://nowhere.com"}}
	hook2 = Client.Must(Client.CreateOutgoingWebhook(hook2)).Data.(*model.OutgoingWebhook)

	if result, err := Client.ListOutgoingWebhooks(); err != nil {
		t.Fatal(err)
	} else {
		hooks := result.Data.([]*model.OutgoingWebhook)

		if len(hooks) != 2 {
			t.Fatal("incorrect number of hooks")
		}
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.ListOutgoingWebhooks(); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	if _, err := Client.ListOutgoingWebhooks(); err != nil {
		t.Fatal(err)
	}

	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false

	if _, err := Client.ListOutgoingWebhooks(); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestDeleteOutgoingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.DeleteOutgoingWebhook("junk"); err == nil {
		t.Fatal("should have failed - bad hook id")
	}

	if _, err := Client.DeleteOutgoingWebhook(""); err == nil {
		t.Fatal("should have failed - empty hook id")
	}

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	hooks := Client.Must(Client.ListOutgoingWebhooks()).Data.([]*model.OutgoingWebhook)
	if len(hooks) != 0 {
		t.Fatal("delete didn't work properly")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not creator or team admin")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestRegenOutgoingHookToken(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	team2 := th.CreateTeam(Client)
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)
	user3 := th.CreateUser(Client)
	LinkUserToTeam(user3, team2)

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	enableAdminOnlyHooks := utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
		utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = enableAdminOnlyHooks
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true
	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = true

	hook := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.RegenOutgoingWebhookToken("junk"); err == nil {
		t.Fatal("should have failed - bad id")
	}

	if _, err := Client.RegenOutgoingWebhookToken(""); err == nil {
		t.Fatal("should have failed - empty id")
	}

	if result, err := Client.RegenOutgoingWebhookToken(hook.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.OutgoingWebhook).Token == hook.Token {
			t.Fatal("regen didn't work properly")
		}
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	*utils.Cfg.ServiceSettings.EnableOnlyAdminIntegrations = false

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team2.Id)

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have failed - wrong team")
	}

	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = false

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestIncomingWebhooks(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	LinkUserToTeam(user2, team)

	enableIncomingHooks := utils.Cfg.ServiceSettings.EnableIncomingWebhooks
	defer func() {
		utils.Cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks
	}()
	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = true

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	url := "/hooks/" + hook.Id
	text := `this is a \"test\"
	that contains a newline and a tab`

	if _, err := Client.DoPost(url, "{\"text\":\"this is a test\"}", "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "{\"text\":\""+text+"\"}", "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", channel1.Name), "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"#%s\"}", channel1.Name), "application/json"); err != nil {
		t.Fatal(err)
	}

	Client.Must(Client.CreateDirectChannel(user2.Id))

	if _, err := Client.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"@%s\"}", user2.Username), "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "payload={\"text\":\"this is a test\"}", "application/x-www-form-urlencoded"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "payload={\"text\":\""+text+"\"}", "application/x-www-form-urlencoded"); err != nil {
		t.Fatal(err)
	}

	attachmentPayload := `{
        "text": "this is a test",
        "attachments": [
            {
                "fallback": "Required plain-text summary of the attachment.",

                "color": "#36a64f",

                "pretext": "Optional text that appears above the attachment block",

                "author_name": "Bobby Tables",
                "author_link": "http://flickr.com/bobby/",
                "author_icon": "http://flickr.com/icons/bobby.jpg",

                "title": "Slack API Documentation",
                "title_link": "https://api.slack.com/",

                "text": "Optional text that appears within the attachment",

                "fields": [
                    {
                        "title": "Priority",
                        "value": "High",
                        "short": false
                    }
                ],

                "image_url": "http://my-website.com/path/to/image.jpg",
                "thumb_url": "http://example.com/path/to/thumb.png"
            }
        ]
    }`

	if _, err := Client.DoPost(url, attachmentPayload, "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "{\"text\":\"\"}", "application/json"); err == nil {
		t.Fatal("should have failed - no text")
	}

	utils.Cfg.ServiceSettings.EnableIncomingWebhooks = false

	if _, err := Client.DoPost(url, "{\"text\":\"this is a test\"}", "application/json"); err == nil {
		t.Fatal("should have failed - webhooks turned off")
	}
}
