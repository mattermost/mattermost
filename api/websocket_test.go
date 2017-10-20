// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	//"encoding/json"
	//"net/http"
	"net/http"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mattermost/mattermost-server/model"
)

/*func TestWebSocketAuthentication(t *testing.T) {
	th := Setup().InitBasic()
	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
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

	WebSocketClient.Close()

	authToken := WebSocketClient.AuthToken
	WebSocketClient.AuthToken = "junk"
	if err := WebSocketClient.Connect(); err != nil {
		t.Fatal(err)
	}
	WebSocketClient.Listen()

	if resp := <-WebSocketClient.ResponseChannel; resp != nil {
		t.Fatal("should have closed")
	}

	if conn, _, err := websocket.DefaultDialer.Dial(WebSocketClient.ApiUrl+"/users/websocket", nil); err != nil {
		t.Fatal("should have connected")
	} else {
		req := &model.WebSocketRequest{}
		req.Seq = 1
		req.Action = "ping"
		conn.WriteJSON(req)

		closedAutomatically := false
		hitNotAuthedError := false

		go func() {
			time.Sleep(10 * time.Second)
			conn.Close()

			if !closedAutomatically {
				t.Fatal("should have closed automatically in 5 seconds")
			}
		}()

		for {
			if _, rawMsg, err := conn.ReadMessage(); err != nil {
				closedAutomatically = true
				conn.Close()
				break
			} else {
				var response model.WebSocketResponse
				if err := json.Unmarshal(rawMsg, &response); err != nil && !response.IsValid() {
					t.Fatal("should not have failed")
				} else {
					if response.Error == nil || response.Error.Id != "api.web_socket_router.not_authenticated.app_error" {
						t.Log(response.Error.Id)
						t.Fatal("wrong error")
						continue
					}

					hitNotAuthedError = true
				}
			}
		}

		if !hitNotAuthedError {
			t.Fatal("should have received a not authenticated response")
		}
	}

	header := http.Header{}
	header.Set(model.HEADER_AUTH, "BEARER "+authToken)
	if conn, _, err := websocket.DefaultDialer.Dial(WebSocketClient.ApiUrl+"/users/websocket", header); err != nil {
		t.Fatal("should have connected")
	} else {
		if _, rawMsg, err := conn.ReadMessage(); err != nil {
			t.Fatal("should not have closed automatically")
		} else {
			var event model.WebSocketEvent
			if err := json.Unmarshal(rawMsg, &event); err != nil && !event.IsValid() {
				t.Fatal("should not have failed")
			} else if event.Event != model.WEBSOCKET_EVENT_HELLO {
				t.Log(event.ToJson())
				t.Fatal("should have helloed")
			}
		}

		conn.Close()
	}
}*/

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
	go th.App.Publish(evt2)
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

	Client := th.BasicClient
	user2 := th.BasicUser2

	users := make([]*model.User, 0)
	users = append(users, user2)

	for i := 0; i < 10; i++ {
		users = append(users, th.CreateUser(Client))
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
				if wsr.Event == model.WEBSOCKET_EVENT_DIRECT_ADDED {
					count = count + 1
				}

			case <-stop:
				return
			}
		}
	}()

	for _, user := range users {
		time.Sleep(100 * time.Millisecond)
		if _, err := Client.CreateDirectChannel(user.Id); err != nil {
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
	_, _, err := websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX_V3+"/users/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err == nil {
		t.Fatal("Should have errored because Origin does not match host! SECURITY ISSUE!")
	}

	// We are not a browser so we can spoof this just fine
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX_V3+"/users/websocket", http.Header{
		"Origin": []string{fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port)},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Should succeed now because open CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "*" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX_V3+"/users/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Should succeed now because matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.evil.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX_V3+"/users/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Should fail because non-matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.good.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX_V3+"/users/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	if err == nil {
		t.Fatal("Should have errored because Origin contain AllowCorsFrom")
	}

	// Should fail because non-matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.good.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.API_URL_SUFFIX_V3+"/users/websocket", http.Header{
		"Origin": []string{"http://www.good.co"},
	})
	if err == nil {
		t.Fatal("Should have errored because Origin does not match host! SECURITY ISSUE!")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "" })
}
