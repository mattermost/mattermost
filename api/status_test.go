// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestStatuses(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	defer WebSocketClient.Close()
	WebSocketClient.Listen()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser := Client.Must(Client.CreateUser(&user, "")).Data.(*model.User)
	LinkUserToTeam(ruser, rteam.Data.(*model.Team))
	store.Must(Srv.Store.User().VerifyEmail(ruser.Id))

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser2 := Client.Must(Client.CreateUser(&user2, "")).Data.(*model.User)
	LinkUserToTeam(ruser2, rteam.Data.(*model.Team))
	store.Must(Srv.Store.User().VerifyEmail(ruser2.Id))

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

	time.Sleep(300 * time.Millisecond)

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
			t.Fatal("should have had user status")
		} else if status != model.STATUS_ONLINE {
			t.Log(status)
			t.Fatal("status should have been online")
		}
	}

	SetStatusAwayIfNeeded(th.BasicUser2.Id)

	awayTimeout := *utils.Cfg.TeamSettings.UserStatusAwayTimeout
	defer func() {
		*utils.Cfg.TeamSettings.UserStatusAwayTimeout = awayTimeout
	}()
	*utils.Cfg.TeamSettings.UserStatusAwayTimeout = 1

	time.Sleep(1500 * time.Millisecond)

	SetStatusAwayIfNeeded(th.BasicUser2.Id)

	WebSocketClient2.Close()
	time.Sleep(300 * time.Millisecond)

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
	offlineHit := false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.Event == model.WEBSOCKET_EVENT_STATUS_CHANGE && resp.UserId == th.BasicUser2.Id {
					status := resp.Data["status"].(string)
					if status == model.STATUS_ONLINE {
						onlineHit = true
					} else if status == model.STATUS_AWAY {
						awayHit = true
					} else if status == model.STATUS_OFFLINE {
						offlineHit = true
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
	if !offlineHit {
		t.Fatal("didn't get offline event")
	}
}
