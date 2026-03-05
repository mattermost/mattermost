// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/dgryski/dgoogauth"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestWebSocketTrailingSlash(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	url := fmt.Sprintf("ws://localhost:%v", th.App.Srv().ListenAddr.Port)
	_, _, err := websocket.DefaultDialer.Dial(url+model.APIURLSuffix+"/websocket/", nil)
	require.NoError(t, err)
}

func TestWebSocketEvent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	WebSocketClient := th.CreateConnectedWebSocketClient(t)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	user2 := th.BasicUser2

	users := make([]*model.User, 0)
	users = append(users, user2)

	for range 10 {
		users = append(users, th.CreateUser(t))
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
		_, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user.Id)
		require.NoError(t, err, "failed to create DM channel")
	}

	time.Sleep(5000 * time.Millisecond)

	stop <- true

	require.Equal(t, count, len(users), "We didn't get the proper amount of direct_added messages")
}

func TestWebsocketOriginSecurity(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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

	for range n {
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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.CreateClient()
	th.LoginBasicWithClient(t, client)
	WebSocketClient := th.CreateConnectedWebSocketClientWithClient(t, client)
	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk)

	client2 := th.CreateClient()
	th.LoginBasic2WithClient(t, client2)
	_ = th.CreateConnectedWebSocketClientWithClient(t, client2)

	// Wait for statuses to be updated
	time.Sleep(time.Second)

	err := WebSocketClient.SendBinaryMessage("get_statuses", nil)
	require.NoError(t, err)
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error, resp.Error)
	require.Equal(t, resp.SeqReply, WebSocketClient.Sequence-1)

	status, ok := resp.Data[th.BasicUser.Id]
	require.True(t, ok)
	require.Equal(t, model.StatusOnline, status)
	status, ok = resp.Data[th.BasicUser2.Id]
	require.True(t, ok)
	require.Equal(t, model.StatusOnline, status)

	err = WebSocketClient.SendBinaryMessage("get_statuses_by_ids", map[string]any{
		"user_ids": []string{th.BasicUser2.Id},
	})
	require.NoError(t, err)
	status, ok = resp.Data[th.BasicUser2.Id]
	require.True(t, ok)
	require.Equal(t, model.StatusOnline, status)
}

func TestWebSocketStatuses(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	WebSocketClient := th.CreateConnectedWebSocketClient(t)

	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk, "should have responded OK to authentication challenge")

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewRandomTeamName() + "a", Email: "test@nowhere.com", Type: model.TeamOpen}
	rteam, _, _ := client.CreateTeam(context.Background(), &team)

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser, _, err := client.CreateUser(context.Background(), &user)
	require.NoError(t, err)
	th.LinkUserToTeam(t, ruser, rteam)
	_, err = th.App.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
	require.NoError(t, err)

	user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	ruser2, _, err := client.CreateUser(context.Background(), &user2)
	require.NoError(t, err)
	th.LinkUserToTeam(t, ruser2, rteam)
	_, err = th.App.Srv().Store().User().VerifyEmail(ruser2.Id, ruser2.Email)
	require.NoError(t, err)

	_, _, err = client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)

	th.LoginBasic2(t)

	WebSocketClient2 := th.CreateConnectedWebSocketClient(t)

	// Wait for statuses to be updated
	time.Sleep(time.Second)

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
}

func TestWebSocketPresence(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	wsClient := th.CreateConnectedWebSocketClient(t)

	resp := <-wsClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk, "should have responded OK to authentication challenge")

	wsClient.UpdateActiveChannel("chID")
	resp = <-wsClient.ResponseChannel
	require.Nil(t, resp.Error)
	require.Equal(t, resp.SeqReply, wsClient.Sequence-1, "bad sequence number")

	wsClient.UpdateActiveTeam("teamID")
	resp = <-wsClient.ResponseChannel
	require.Nil(t, resp.Error)
	require.Equal(t, resp.SeqReply, wsClient.Sequence-1, "bad sequence number")

	wsClient.UpdateActiveThread(true, "threadID")
	resp = <-wsClient.ResponseChannel
	require.Nil(t, resp.Error)
	require.Equal(t, resp.SeqReply, wsClient.Sequence-1, "bad sequence number")

	wsClient.UpdateActiveThread(false, "threadID")
	resp = <-wsClient.ResponseChannel
	require.Nil(t, resp.Error)
	require.Equal(t, resp.SeqReply, wsClient.Sequence-1, "bad sequence number")
}

func TestWebSocketUpgrade(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	buffer := &mlog.Buffer{}
	err := mlog.AddWriterTarget(th.TestLogger, buffer, true, mlog.StdAll...)
	require.NoError(t, err)

	url := fmt.Sprintf("http://localhost:%v", th.App.Srv().ListenAddr.Port) + model.APIURLSuffix + "/websocket"
	resp, err := http.Get(url)
	require.NoError(t, err)
	require.Equal(t, resp.StatusCode, http.StatusBadRequest)
	require.NoError(t, th.TestLogger.Flush())
	testlib.AssertLog(t, buffer, mlog.LvlDebug.Name, "URL Blocked because of CORS. Url: ")
}

func TestValidateDisconnectErrCode(t *testing.T) {
	testCases := []struct {
		name    string
		errCode string
		valid   bool
	}{
		{
			name:    "empty string",
			errCode: "",
			valid:   false,
		},
		{
			name:    "non-numeric string",
			errCode: "not-a-number",
			valid:   false,
		},
		{
			name:    "valid standard close code - 1000",
			errCode: "1000",
			valid:   true,
		},
		{
			name:    "valid standard close code - 1001",
			errCode: "1001",
			valid:   true,
		},
		{
			name:    "valid standard close code - 1015",
			errCode: "1015",
			valid:   true,
		},
		{
			name:    "valid standard close code - 1016",
			errCode: "1016",
			valid:   true,
		},
		{
			name:    "out of range (too low)",
			errCode: "999",
			valid:   false,
		},
		{
			name:    "out of range (too high)",
			errCode: "1017",
			valid:   false,
		},
		{
			name:    "valid custom code - client ping timeout",
			errCode: "4000",
			valid:   true,
		},
		{
			name:    "valid custom code - client sequence mismatch",
			errCode: "4001",
			valid:   true,
		},
		{
			name:    "invalid custom code",
			errCode: "5000",
			valid:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := validateDisconnectErrCode(tc.errCode)
			require.Equal(t, tc.valid, result)
		})
	}
}

// Helper function to enable MFA enforcement in config
func enableMFAEnforcement(th *TestHelper) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
		*cfg.ServiceSettings.EnforceMultifactorAuthentication = true
	})
}

// Helper function to set up MFA for a user
func setupUserWithMFA(t *testing.T, th *TestHelper, user *model.User) string {
	// Setup MFA properly - following authentication_test.go pattern
	secret, appErr := th.App.GenerateMfaSecret(user.Id)
	require.Nil(t, appErr)
	err := th.Server.Store().User().UpdateMfaActive(user.Id, true)
	require.NoError(t, err)
	err = th.Server.Store().User().UpdateMfaSecret(user.Id, secret.Secret)
	require.NoError(t, err)
	return secret.Secret
}

func TestWebSocketMFAEnforcement(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("WebSocket works when MFA enforcement is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// MFA enforcement disabled - should work normally
		webSocketClient := th.CreateConnectedWebSocketClient(t)
		defer webSocketClient.Close()

		webSocketClient.GetStatuses()

		select {
		case resp := <-webSocketClient.ResponseChannel:
			require.Nil(t, resp.Error, "WebSocket should work when MFA enforcement is disabled")
			require.Equal(t, resp.Status, model.StatusOk)
		case <-time.After(3 * time.Second):
			require.Fail(t, "Expected WebSocket response but got timeout")
		}
	})

	t.Run("WebSocket blocked when MFA required but user has no MFA", func(t *testing.T) {
		th := SetupEnterprise(t).InitBasic(t)

		// Enable MFA enforcement in config
		enableMFAEnforcement(th)
		// Defer the teardown to reset the config after the test
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnforceMultifactorAuthentication = false
			})
		}()

		// Create user without MFA using existing basic user to avoid license timing issues
		user := th.BasicUser

		// Login user (this should work for initial authentication)
		client := th.CreateClient()
		_, _, err := client.Login(context.Background(), user.Email, "Pa$$word11")
		require.NoError(t, err)

		// Create WebSocket client - initial connection succeeds, but subsequent API requests require completed MFA
		webSocketClient, err := th.CreateWebSocketClientWithClient(client)
		require.NoError(t, err)
		require.NotNil(t, webSocketClient, "webSocketClient should not be nil")
		webSocketClient.Listen()
		defer webSocketClient.Close()

		// First, consume the successful authentication challenge response
		authResp := <-webSocketClient.ResponseChannel
		require.Nil(t, authResp.Error, "Authentication challenge should succeed")
		require.Equal(t, authResp.Status, model.StatusOk)

		// Individual WebSocket requests should be blocked due to MFA requirement
		webSocketClient.GetStatuses()

		// Should get authentication error due to MFA requirement on the second request
		select {
		case resp := <-webSocketClient.ResponseChannel:
			t.Logf("Received response: Error=%v, Status=%s, SeqReply=%d", resp.Error, resp.Status, resp.SeqReply)
			require.NotNil(t, resp.Error, "Should get authentication error due to MFA requirement")
			require.Equal(t, "api.web_socket_router.not_authenticated.app_error", resp.Error.Id,
				"Should get specific 'not authenticated' error ID due to MFA requirement")
		case <-time.After(3 * time.Second):
			require.Fail(t, "Expected WebSocket error response but got timeout")
		}
	})

	t.Run("WebSocket connection allowed when user has MFA active", func(t *testing.T) {
		th := SetupEnterprise(t).InitBasic(t)

		// Enable MFA enforcement in config
		enableMFAEnforcement(th)
		// Defer the teardown to reset the config after the test
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnforceMultifactorAuthentication = false
			})
		}()

		// Create user and set up MFA
		user := &model.User{
			Email:    th.GenerateTestEmail(),
			Username: model.NewUsername(),
			Password: "password123",
		}
		ruser, _, err := th.Client.CreateUser(context.Background(), user)
		require.NoError(t, err)

		th.LinkUserToTeam(t, ruser, th.BasicTeam)
		_, err = th.App.Srv().Store().User().VerifyEmail(ruser.Id, ruser.Email)
		require.NoError(t, err)

		// Setup MFA for the user and get the secret
		secretString := setupUserWithMFA(t, th, ruser)

		// Generate TOTP token from the user's MFA secret
		code := dgoogauth.ComputeCode(secretString, time.Now().UTC().Unix()/30)
		token := fmt.Sprintf("%06d", code)

		client := th.CreateClient()
		_, _, err = client.LoginWithMFA(context.Background(), user.Email, user.Password, token)
		require.NoError(t, err)

		// WebSocket connection should work
		webSocketClient := th.CreateConnectedWebSocketClientWithClient(t, client)
		defer webSocketClient.Close()

		// Should be able to get statuses
		webSocketClient.GetStatuses()

		select {
		case resp := <-webSocketClient.ResponseChannel:
			require.Nil(t, resp.Error, "WebSocket should work when MFA is properly set up")
			require.Equal(t, resp.Status, model.StatusOk)
		case <-time.After(5 * time.Second):
			require.Fail(t, "Expected WebSocket response but got timeout")
		}
	})
}
