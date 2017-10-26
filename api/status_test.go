// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestStatuses(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	defer WebSocketClient.Close()
	WebSocketClient.Listen()

	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Status != model.STATUS_OK {
		t.Fatal("should have responded OK to authentication challenge")
	}

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Id))

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser2 := Client.Must(Client.CreateUser(&user2, "")).Data.(*model.User)
	th.LinkUserToTeam(ruser2, rteam.Data.(*model.Team))
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser2.Id))

	Client.Login(user.Email, user.Password)
	Client.SetTeamId(team.Id)

	r1, err := Client.GetStatuses()
	if err != nil {
		t.Fatal(err)
	}

	statuses := r1.Data.(map[string]string)

	for _, status := range statuses {
		if status != model.STATUS_OFFLINE && status != model.STATUS_AWAY && status != model.STATUS_ONLINE {
			t.Fatal("one of the statuses had an invalid value")
		}
	}

	th.LoginBasic2()

	WebSocketClient2, err2 := th.CreateWebSocketClient()
	if err2 != nil {
		t.Fatal(err2)
	}

	time.Sleep(1000 * time.Millisecond)

	WebSocketClient.GetStatuses()
	if resp := <-WebSocketClient.ResponseChannel; resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if resp.SeqReply != WebSocketClient.Sequence-1 {
			t.Fatal("bad sequence number")
		}

		for _, status := range resp.Data {
			if status != model.STATUS_OFFLINE && status != model.STATUS_AWAY && status != model.STATUS_ONLINE {
				t.Fatal("one of the statuses had an invalid value")
			}
		}

		if status, ok := resp.Data[th.BasicUser2.Id]; !ok {
			t.Log(resp.Data)
			t.Fatal("should have had user status")
		} else if status != model.STATUS_ONLINE {
			t.Log(status)
			t.Fatal("status should have been online")
		}
	}

	WebSocketClient.GetStatusesByIds([]string{th.BasicUser2.Id})
	if resp := <-WebSocketClient.ResponseChannel; resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if resp.SeqReply != WebSocketClient.Sequence-1 {
			t.Fatal("bad sequence number")
		}

		for _, status := range resp.Data {
			if status != model.STATUS_OFFLINE && status != model.STATUS_AWAY && status != model.STATUS_ONLINE {
				t.Fatal("one of the statuses had an invalid value")
			}
		}

		if status, ok := resp.Data[th.BasicUser2.Id]; !ok {
			t.Log(len(resp.Data))
			t.Fatal("should have had user status")
		} else if status != model.STATUS_ONLINE {
			t.Log(status)
			t.Fatal("status should have been online")
		} else if len(resp.Data) != 1 {
			t.Fatal("only 1 status should be returned")
		}
	}

	WebSocketClient.GetStatusesByIds([]string{ruser2.Id, "junk"})
	if resp := <-WebSocketClient.ResponseChannel; resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if resp.SeqReply != WebSocketClient.Sequence-1 {
			t.Fatal("bad sequence number")
		}

		if len(resp.Data) != 2 {
			t.Fatal("2 statuses should be returned")
		}
	}

	WebSocketClient.GetStatusesByIds([]string{})
	if resp := <-WebSocketClient.ResponseChannel; resp.Error == nil {
		if resp.SeqReply != WebSocketClient.Sequence-1 {
			t.Fatal("bad sequence number")
		}
		t.Fatal("should have errored - empty user ids")
	}

	WebSocketClient2.Close()

	th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, false)

	awayTimeout := *th.App.Config().TeamSettings.UserStatusAwayTimeout
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.UserStatusAwayTimeout = awayTimeout })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.UserStatusAwayTimeout = 1 })

	time.Sleep(1500 * time.Millisecond)

	th.App.SetStatusAwayIfNeeded(th.BasicUser.Id, false)
	th.App.SetStatusOnline(th.BasicUser.Id, "junk", false)

	time.Sleep(1500 * time.Millisecond)

	WebSocketClient.GetStatuses()
	if resp := <-WebSocketClient.ResponseChannel; resp.Error != nil {
		t.Fatal(resp.Error)
	} else {
		if resp.SeqReply != WebSocketClient.Sequence-1 {
			t.Fatal("bad sequence number")
		}

		if _, ok := resp.Data[th.BasicUser2.Id]; ok {
			t.Fatal("should not have had user status")
		}
	}

	stop := make(chan bool)
	onlineHit := false
	awayHit := false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.Event == model.WEBSOCKET_EVENT_STATUS_CHANGE && resp.Data["user_id"].(string) == th.BasicUser.Id {
					status := resp.Data["status"].(string)
					if status == model.STATUS_ONLINE {
						onlineHit = true
					} else if status == model.STATUS_AWAY {
						awayHit = true
					}
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(500 * time.Millisecond)

	stop <- true

	if !onlineHit {
		t.Fatal("didn't get online event")
	}
	if !awayHit {
		t.Fatal("didn't get away event")
	}

	time.Sleep(500 * time.Millisecond)

	WebSocketClient.Close()
}

func TestGetStatusesByIds(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	if result, err := Client.GetStatusesByIds([]string{th.BasicUser.Id}); err != nil {
		t.Fatal(err)
	} else {
		statuses := result.Data.(map[string]string)
		if len(statuses) != 1 {
			t.Fatal("should only have 1 status")
		}
	}

	if result, err := Client.GetStatusesByIds([]string{th.BasicUser.Id, th.BasicUser2.Id, "junk"}); err != nil {
		t.Fatal(err)
	} else {
		statuses := result.Data.(map[string]string)
		if len(statuses) != 3 {
			t.Fatal("should have 3 statuses")
		}
	}

	if _, err := Client.GetStatusesByIds([]string{}); err == nil {
		t.Fatal("should have errored")
	}
}
