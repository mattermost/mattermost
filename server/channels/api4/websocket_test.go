// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/channels/testlib"
	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func TestWebSocketTrailingSlash(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	url := fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port)
	_, _, err := websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket/", nil)
	require.NoError(t, err)
}

func TestWebSocketEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer WebSocketClient.Close()

	WebSocketClient.Listen()

	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk, "should have responded OK to authentication challenge")

	omitUser := make(map[string]bool, 1)
	omitUser["somerandomid"] = true
	evt1 := model.NewWebSocketEvent(model.WebsocketEventTyping, "", th.BasicChannel.Id, "", omitUser, "")
	evt1.Add("user_id", "somerandomid")
	th.App.Publish(evt1)

	time.Sleep(300 * time.Millisecond)

	stop := make(chan bool)
	eventHit := false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.EventType() == model.WebsocketEventTyping && resp.GetData()["user_id"].(string) == "somerandomid" {
					eventHit = true
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(400 * time.Millisecond)

	stop <- true

	require.True(t, eventHit, "did not receive typing event")

	evt2 := model.NewWebSocketEvent(model.WebsocketEventTyping, "", "somerandomid", "", nil, "")
	th.App.Publish(evt2)
	time.Sleep(300 * time.Millisecond)

	eventHit = false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.EventType() == model.WebsocketEventTyping {
					eventHit = true
				}
			case <-stop:
				return
			}
		}
	}()

	time.Sleep(400 * time.Millisecond)

	stop <- true

	require.False(t, eventHit, "got typing event for bad channel id")
}

func TestCreateDirectChannelWithSocket(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	user2 := th.BasicUser2

	users := make([]*model.User, 0)
	users = append(users, user2)

	for i := 0; i < 10; i++ {
		users = append(users, th.CreateUser())
	}

	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer WebSocketClient.Close()
	WebSocketClient.Listen()

	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk, "should have responded OK to authentication challenge")

	wsr := <-WebSocketClient.EventChannel
	require.Equal(t, wsr.EventType(), model.WebsocketEventHello, "missing hello")

	stop := make(chan bool)
	count := 0

	go func() {
		for {
			select {
			case wsr := <-WebSocketClient.EventChannel:
				if wsr != nil && wsr.EventType() == model.WebsocketEventDirectAdded {
					count = count + 1
				}

			case <-stop:
				return
			}
		}
	}()

	for _, user := range users {
		time.Sleep(100 * time.Millisecond)
		_, _, err := client.CreateDirectChannel(th.BasicUser.Id, user.Id)
		require.NoError(t, err, "failed to create DM channel")
	}

	time.Sleep(5000 * time.Millisecond)

	stop <- true

	require.Equal(t, count, len(users), "We didn't get the proper amount of direct_added messages")
}

func TestWebsocketOriginSecurity(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	url := fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port)

	// Should fail because origin doesn't match
	_, _, err := websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})

	require.Error(t, err, "Should have errored because Origin does not match host! SECURITY ISSUE!")

	// We are not a browser so we can spoof this just fine
	_, _, err = websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket", http.Header{
		"Origin": []string{fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port)},
	})
	require.NoError(t, err, err)

	// Should succeed now because open CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "*" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	require.NoError(t, err, err)

	// Should succeed now because matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.evil.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	require.NoError(t, err, err)

	// Should fail because non-matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.good.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket", http.Header{
		"Origin": []string{"http://www.evil.com"},
	})
	require.Error(t, err, "Should have errored because Origin contain AllowCorsFrom")

	// Should fail because non-matching CORS
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "http://www.good.com" })
	_, _, err = websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket", http.Header{
		"Origin": []string{"http://www.good.co"},
	})
	require.Error(t, err, "Should have errored because Origin does not match host! SECURITY ISSUE!")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowCorsFrom = "" })
}

func TestWebSocketReconnectRace(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer WebSocketClient.Close()
	WebSocketClient.Listen()

	ev := <-WebSocketClient.EventChannel
	require.Equal(t, model.WebsocketEventHello, ev.EventType())
	evData := ev.GetData()
	connID := evData["connection_id"].(string)
	seq := int(ev.GetSequence())

	var wg sync.WaitGroup
	n := 10
	wg.Add(n)

	WebSocketClient.Close()

	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			ws, err := th.CreateReliableWebSocketClient(connID, seq+1)
			require.NoError(t, err)
			defer ws.Close()
			ws.Listen()
		}()
	}

	wg.Wait()
}

func TestWebSocketSendBinary(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.CreateClient()
	th.LoginBasicWithClient(client)
	WebSocketClient, err := th.CreateWebSocketClientWithClient(client)
	require.NoError(t, err)
	defer WebSocketClient.Close()
	WebSocketClient.Listen()
	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk)

	client2 := th.CreateClient()
	th.LoginBasic2WithClient(client2)
	WebSocketClient2, err := th.CreateWebSocketClientWithClient(client2)
	require.NoError(t, err)
	defer WebSocketClient2.Close()

	time.Sleep(1000 * time.Millisecond)

	WebSocketClient.SendBinaryMessage("get_statuses", nil)
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error, resp.Error)
	require.Equal(t, resp.SeqReply, WebSocketClient.Sequence-1)

	status, ok := resp.Data[th.BasicUser.Id]
	require.True(t, ok)
	require.Equal(t, model.StatusOnline, status)
	status, ok = resp.Data[th.BasicUser2.Id]
	require.True(t, ok)
	require.Equal(t, model.StatusOnline, status)

	WebSocketClient.SendBinaryMessage("get_statuses_by_ids", map[string]any{
		"user_ids": []string{th.BasicUser2.Id},
	})
	status, ok = resp.Data[th.BasicUser2.Id]
	require.True(t, ok)
	require.Equal(t, model.StatusOnline, status)
}

func TestWebSocketStatuses(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer WebSocketClient.Close()
	WebSocketClient.Listen()

	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk, "should have responded OK to authentication challenge")

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "test@nowhere.com", Type: model.TeamOpen}
	rteam, _, _ := client.CreateTeam(&team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _, err := client.CreateUser(&user)
	require.NoError(t, err)
	th.LinkUserToTeam(ruser, rteam)
	_, err = th.App.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
	require.NoError(t, err)

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser2, _, err := client.CreateUser(&user2)
	require.NoError(t, err)
	th.LinkUserToTeam(ruser2, rteam)
	_, err = th.App.Srv().Store().User().VerifyEmail(ruser2.Id, ruser2.Email)
	require.NoError(t, err)

	client.Login(user.Email, user.Password)

	th.LoginBasic2()

	WebSocketClient2, err := th.CreateWebSocketClient()
	require.NoError(t, err)

	time.Sleep(1000 * time.Millisecond)

	WebSocketClient.GetStatuses()
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error, resp.Error)

	require.Equal(t, resp.SeqReply, WebSocketClient.Sequence-1, "bad sequence number")

	allowedValues := [4]string{model.StatusOffline, model.StatusAway, model.StatusOnline, model.StatusDnd}
	for _, status := range resp.Data {
		require.Containsf(t, allowedValues, status, "one of the statuses had an invalid value status=%v", status)
	}

	status, ok := resp.Data[th.BasicUser2.Id]
	require.True(t, ok, "should have had user status")

	require.Equal(t, status, model.StatusOnline, "status should have been online status=%v", status)

	WebSocketClient.GetStatusesByIds([]string{th.BasicUser2.Id})
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error, resp.Error)

	require.Equal(t, resp.SeqReply, WebSocketClient.Sequence-1, "bad sequence number")

	allowedValues = [4]string{model.StatusOffline, model.StatusAway, model.StatusOnline}
	for _, status := range resp.Data {
		require.Containsf(t, allowedValues, status, "one of the statuses had an invalid value status")
	}

	status, ok = resp.Data[th.BasicUser2.Id]
	require.True(t, ok, "should have had user status")

	require.Equal(t, status, model.StatusOnline, "status should have been online status=%v", status)
	require.Equal(t, len(resp.Data), 1, "only 1 status should be returned")

	WebSocketClient.GetStatusesByIds([]string{ruser2.Id, "junk"})
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error, resp.Error)
	require.Equal(t, resp.SeqReply, WebSocketClient.Sequence-1, "bad sequence number")
	require.Equal(t, len(resp.Data), 2, "2 statuses should be returned")

	WebSocketClient.GetStatusesByIds([]string{})
	if resp2 := <-WebSocketClient.ResponseChannel; resp2.Error == nil {
		require.Equal(t, resp2.SeqReply, WebSocketClient.Sequence-1, "bad sequence number")
		require.NotNil(t, resp2.Error, "should have errored - empty user ids")
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
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error)

	require.Equal(t, resp.SeqReply, WebSocketClient.Sequence-1, "bad sequence number")
	_, ok = resp.Data[th.BasicUser2.Id]
	require.False(t, ok, "should not have had user status")

	stop := make(chan bool)
	onlineHit := false
	awayHit := false

	go func() {
		for {
			select {
			case resp := <-WebSocketClient.EventChannel:
				if resp.EventType() == model.WebsocketEventStatusChange && resp.GetData()["user_id"].(string) == th.BasicUser.Id {
					status := resp.GetData()["status"].(string)
					if status == model.StatusOnline {
						onlineHit = true
					} else if status == model.StatusAway {
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

	require.True(t, onlineHit, "didn't get online event")
	require.True(t, awayHit, "didn't get away event")

	time.Sleep(500 * time.Millisecond)

	WebSocketClient.Close()
}

func TestWebSocketUpgrade(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	url := fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port) + model.APIURLSuffix + "/websocket"
	resp, err := http.Get(url)
	require.NoError(t, err)
	require.Equal(t, resp.StatusCode, http.StatusBadRequest)
	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, th.LogBuffer, mlog.LvlDebug.Name, "Failed to upgrade websocket connection.")
}
