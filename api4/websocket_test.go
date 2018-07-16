// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestWebSocket(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	defer WebSocketClient.Close()

	time.Sleep(300 * time.Millisecond)

	// Test closing and reconnecting
	WebSocketClient.Close()
	if err := WebSocketClient.Connect(); err != nil {
		t.Fatal(err)
	}

	WebSocketClient.Listen()

	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Status != model.STATUS_OK {
		t.Fatal("should have responded OK to authentication challenge")
	}

	WebSocketClient.SendMessage("ping", nil)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Data["text"].(string) != "pong" {
		t.Fatal("wrong response")
	}

	WebSocketClient.SendMessage("", nil)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.web_socket_router.no_action.app_error" {
		t.Fatal("should have been no action response")
	}

	WebSocketClient.SendMessage("junk", nil)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.web_socket_router.bad_action.app_error" {
		t.Fatal("should have been bad action response")
	}

	req := &model.WebSocketRequest{}
	req.Seq = 0
	req.Action = "ping"
	WebSocketClient.Conn.WriteJSON(req)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.web_socket_router.bad_seq.app_error" {
		t.Fatal("should have been bad action response")
	}

	WebSocketClient.UserTyping("", "")
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.websocket_handler.invalid_param.app_error" {
		t.Fatal("should have been invalid param response")
	} else {
		if resp.Error.DetailedError != "" {
			t.Fatal("detailed error not cleared")
		}
	}
}

func TestWebSocketEvent(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

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

	omitUser := make(map[string]bool, 1)
	omitUser["somerandomid"] = true
	evt1 := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_TYPING, "", th.BasicChannel.Id, "", omitUser)
	evt1.Add("user_id", "somerandomid")
	th.App.Publish(evt1)

	time.Sleep(300 * time.Millisecond)

	stop := make(chan bool)
	eventHit := false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.Event == model.WEBSOCKET_EVENT_TYPING && resp.Data["user_id"].(string) == "somerandomid" {
					eventHit = true
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(400 * time.Millisecond)

	stop <- true

	if !eventHit {
		t.Fatal("did not receive typing event")
	}

	evt2 := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_TYPING, "", "somerandomid", "", nil)
	th.App.Publish(evt2)
	time.Sleep(300 * time.Millisecond)

	eventHit = false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.Event == model.WEBSOCKET_EVENT_TYPING {
					eventHit = true
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(400 * time.Millisecond)

	stop <- true

	if eventHit {
		t.Fatal("got typing event for bad channel id")
	}
}

func TestCreateDirectChannelWithSocket(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.Client
	user2 := th.BasicUser2

	users := make([]*model.User, 0)
	users = append(users, user2)

	for i := 0; i < 10; i++ {
		users = append(users, th.CreateUser())
	}

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

	wsr := <-WebSocketClient.EventChannel
	if wsr.Event != model.WEBSOCKET_EVENT_HELLO {
		t.Fatal("missing hello")
	}

	stop := make(chan bool)
	count := 0

	go func() {
		for {
			select {
			case wsr := <-WebSocketClient.EventChannel:
				if wsr != nil && wsr.Event == model.WEBSOCKET_EVENT_DIRECT_ADDED {
					count = count + 1
				}

			case <-stop:
				return
			}
		}
	}()

	for _, user := range users {
		time.Sleep(100 * time.Millisecond)
		if _, resp := Client.CreateDirectChannel(th.BasicUser.Id, user.Id); resp.Error != nil {
			t.Fatal("failed to create DM channel")
		}
	}

	time.Sleep(5000 * time.Millisecond)

	stop <- true

	if count != len(users) {
		t.Fatal("We didn't get the proper amount of direct_added messages")
	}

}

func TestWebsocketOriginSecurity(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	url := fmt.Sprintf("ws://localhost:%v", th.App.Srv.ListenAddr.Port)

	// Should fail because origin doesn't match
	_, _, err := websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err == nil {
		t.Fatal("Should have errored because Origin does not match host! SECURITY ISSUE!")
	}

	// We are not a browser so we can spoof this just fine
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX+"/websocket", http.Header{
		"Origin": []string{fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port)},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Should succeed now because open CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "*" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Should succeed now because matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.evil.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Should fail because non-matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.good.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err == nil {
		t.Fatal("Should have errored because Origin contain AllowCorsFrom")
	}

	// Should fail because non-matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.good.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX+"/websocket", http.Header{
		"Origin": []string{"http://www.good.co"},
	})
	if err == nil {
		t.Fatal("Should have errored because Origin does not match host! SECURITY ISSUE!")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "" })
}

func TestWebSocketStatuses(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.Client
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
	ruser := Client.Must(Client.CreateUser(&user)).(*model.User)
	th.LinkUserToTeam(ruser, rteam)
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser.Id))

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser2 := Client.Must(Client.CreateUser(&user2)).(*model.User)
	th.LinkUserToTeam(ruser2, rteam)
	store.Must(th.App.Srv.Store.User().VerifyEmail(ruser2.Id))

	Client.Login(user.Email, user.Password)

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
			if status != model.STATUS_OFFLINE && status != model.STATUS_AWAY && status != model.STATUS_ONLINE && status != model.STATUS_DND {
				t.Fatalf("one of the statuses had an invalid value status=%v", status)
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
	th.App.SetStatusOnline(th.BasicUser.Id, false)

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
