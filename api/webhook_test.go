// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"testing"
	"time"
)

func TestCreateIncomingHook(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}

	if utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
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
	} else {
		if _, err := Client.CreateIncomingWebhook(hook); err == nil {
			t.Fatal("should have errored - webhooks turned off")
		}
	}
}

func TestListIncomingHooks(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	if utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
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
	} else {
		if _, err := Client.ListIncomingWebhooks(); err == nil {
			t.Fatal("should have errored - webhooks turned off")
		}
	}
}

func TestDeleteIncomingHook(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	if utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		hook := &model.IncomingWebhook{ChannelId: channel1.Id}
		hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

		data := make(map[string]string)
		data["id"] = hook.Id

		if _, err := Client.DeleteIncomingWebhook(data); err != nil {
			t.Fatal(err)
		}

		hooks := Client.Must(Client.ListIncomingWebhooks()).Data.([]*model.IncomingWebhook)
		if len(hooks) != 0 {
			t.Fatal("delete didn't work properly")
		}
	} else {
		data := make(map[string]string)
		data["id"] = "123"

		if _, err := Client.DeleteIncomingWebhook(data); err == nil {
			t.Fatal("should have errored - webhooks turned off")
		}
	}
}

func TestZZWebSocketTearDown(t *testing.T) {
	// *IMPORTANT* - Kind of hacky
	// This should be the last function in any test file
	// that calls Setup()
	// Should be in the last file too sorted by name
	time.Sleep(2 * time.Second)
	TearDown()
}
