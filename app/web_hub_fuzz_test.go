// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package app

import (
	"net/http/httptest"
	"sync"
	"testing"
	"testing/quick"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

type actionData struct {
	event                string
	createUserID         string
	selectChannelID      string
	selectTeamID         string
	invalidateConnUserID string
	updateConnUserID     string
	attachment           map[string]interface{}
}

func getActionData(data []byte, userIDs, teamIDs, channelIDs []string) *actionData {
	// Some sample events
	events := []string{
		model.WEBSOCKET_EVENT_CHANNEL_CREATED,
		model.WEBSOCKET_EVENT_CHANNEL_DELETED,
		model.WEBSOCKET_EVENT_USER_ADDED,
		model.WEBSOCKET_EVENT_USER_UPDATED,
		model.WEBSOCKET_EVENT_STATUS_CHANGE,
		model.WEBSOCKET_EVENT_HELLO,
		model.WEBSOCKET_AUTHENTICATION_CHALLENGE,
		model.WEBSOCKET_EVENT_REACTION_ADDED,
		model.WEBSOCKET_EVENT_REACTION_REMOVED,
		model.WEBSOCKET_EVENT_RESPONSE,
	}
	// We need atleast 10 bytes to get all the data we need
	if len(data) < 10 {
		return nil
	}
	input := &actionData{}
	//	Assign userID, channelID, teamID randomly from respective byte indices
	input.createUserID = userIDs[int(data[0])%len(userIDs)]
	input.selectChannelID = channelIDs[int(data[1])%len(channelIDs)]
	input.selectTeamID = teamIDs[int(data[2])%len(teamIDs)]
	input.invalidateConnUserID = userIDs[int(data[3])%len(userIDs)]
	input.updateConnUserID = userIDs[int(data[4])%len(userIDs)]
	input.event = events[int(data[5])%len(events)]
	data = data[6:]
	input.attachment = make(map[string]interface{})
	for len(data) >= 4 { // 2 bytes key, 2 bytes value
		k := data[:2]
		v := data[2:4]
		input.attachment[string(k)] = v
		data = data[4:]
	}

	return input
}

func TestHubFuzz(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	th.App.HubStart()
	defer th.App.HubStop()

	u1 := th.CreateUser()
	u2 := th.CreateUser()
	u3 := th.CreateUser()

	t1 := th.CreateTeam()
	t2 := th.CreateTeam()

	ch1 := th.CreateDmChannel(u1)
	ch2 := th.CreateChannel(t1)
	ch3 := th.CreateChannel(t2)

	th.LinkUserToTeam(u1, t1)
	th.LinkUserToTeam(u1, t2)
	th.LinkUserToTeam(u2, t1)
	th.LinkUserToTeam(u2, t2)
	th.LinkUserToTeam(u3, t1)
	th.LinkUserToTeam(u3, t2)

	th.AddUserToChannel(u1, ch2)
	th.AddUserToChannel(u2, ch2)
	th.AddUserToChannel(u3, ch2)
	th.AddUserToChannel(u1, ch3)
	th.AddUserToChannel(u2, ch3)
	th.AddUserToChannel(u3, ch3)

	sema := make(chan struct{}, 4) // A counting semaphore with concurrency of 4.
	dataChan := make(chan []byte)
	type panicData struct {
		data     []byte
		panicked bool
	}

	panicChan := make(chan panicData, 4) // buffer of 4 to keep reading panics.
	var wg sync.WaitGroup

	go func() {
		for {
			// get data
			data, ok := <-dataChan
			if !ok {
				return
			}
			// acquire semaphore
			sema <- struct{}{}
			wg.Add(1)
			go func(data []byte) {
				defer func() {
					// release semaphore
					<-sema
					wg.Done()
				}()
				var input *actionData
				defer func() {
					panicked := false
					if r := recover(); r != nil {
						t.Logf("recovered: %#v, %#v", r, input)
						panicked = true
					}
					// send to panic chan
					panicChan <- panicData{
						data:     data,
						panicked: panicked,
					}
				}()
				// assign data randomly
				// 3 users, 2 teams, 3 channels
				input = getActionData(data,
					[]string{u1.Id, u2.Id, u3.Id, ""},
					[]string{t1.Id, t2.Id, ""},
					[]string{ch1.Id, ch2.Id, ""})
				if input == nil {
					return // return 0 here
				}

				conn := registerDummyWebConn(t, th.App, s.Listener.Addr(), input.createUserID)
				defer func() {
					conn.Close()
					// A sleep of 2 seconds to allow other connections
					// from the same user to be created, before unregistering them.
					// This hits some additional code paths.
					go func() {
						time.Sleep(2 * time.Second)
						th.App.HubUnregister(conn)
					}()
				}()

				msg := model.NewWebSocketEvent(input.event,
					input.selectTeamID,
					input.selectChannelID,
					input.createUserID, nil)
				for k, v := range input.attachment {
					msg.Add(k, v)
				}
				th.App.Publish(msg)

				th.App.InvalidateWebConnSessionCacheForUser(input.invalidateConnUserID)

				sessions, err := th.App.GetSessions(input.updateConnUserID)
				if err != nil {
					panic(err)
				}
				if len(sessions) > 0 {
					th.App.UpdateWebConnUserActivity(*sessions[0], model.GetMillis())
				}
			}(data)
		}
	}()

	f := func(data []byte) (ok bool) {
		// send data to dataChan
		dataChan <- data

		// get data from panic chan
		result := <-panicChan
		ok = !result.panicked
		if !ok {
			t.Errorf("data: %v", result.data)
		}
		return
	}

	if err := quick.Check(f, &quick.Config{
		MaxCount: 10000,
	}); err != nil {
		data := err.(*quick.CheckError).In[0].([]byte)
		// This won't be a 1-1 map because the data chan is spread between multiple
		// workers, and the panicChan collects from all of them.
		t.Error(err)
		f(data)
	}
	close(dataChan)
	close(panicChan)
	// drain panicChan
	for res := range panicChan {
		ok := !res.panicked
		if !ok {
			t.Errorf("data: %v", res.data)
		}
	}

	wg.Wait()
}

func TestActionData(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	th.App.HubStart()
	defer th.App.HubStop()

	u1 := th.CreateUser()
	u2 := th.CreateUser()
	u3 := th.CreateUser()

	t1 := th.CreateTeam()
	t2 := th.CreateTeam()

	ch1 := th.CreateDmChannel(u1)
	ch2 := th.CreateChannel(t1)
	ch3 := th.CreateChannel(t2)

	th.LinkUserToTeam(u1, t1)
	th.LinkUserToTeam(u1, t2)
	th.LinkUserToTeam(u2, t1)
	th.LinkUserToTeam(u2, t2)
	th.LinkUserToTeam(u3, t1)
	th.LinkUserToTeam(u3, t2)

	th.AddUserToChannel(u1, ch2)
	th.AddUserToChannel(u2, ch2)
	th.AddUserToChannel(u3, ch2)
	th.AddUserToChannel(u1, ch3)
	th.AddUserToChannel(u2, ch3)
	th.AddUserToChannel(u3, ch3)

	buf := []byte{0xc3, 0x27, 0x5a, 0xdb, 0x73, 0xb3, 0xec, 0xcf, 0x41, 0xb6, 0x81, 0xa5, 0x95, 0x2a, 0xb0, 0xe1, 0xa7, 0xe5, 0xbc, 0x33, 0xc3, 0x7d}
	input := getActionData(buf,
		[]string{u1.Id, u2.Id, u3.Id},
		[]string{t1.Id, t2.Id},
		[]string{ch1.Id, ch2.Id})
	t.Log(input)

	conn := registerDummyWebConn(t, th.App, s.Listener.Addr(), input.createUserID)
	defer conn.Close()

	msg := model.NewWebSocketEvent(input.event,
		input.selectTeamID,
		input.selectChannelID,
		input.createUserID, nil)
	for k, v := range input.attachment {
		msg.Add(k, v)
	}
	th.App.Publish(msg)

	th.App.InvalidateWebConnSessionCacheForUser(input.invalidateConnUserID)

	sessions, err := th.App.GetSessions(input.updateConnUserID)
	if err != nil {
		panic(err)
	}
	if len(sessions) > 0 {
		th.App.UpdateWebConnUserActivity(*sessions[0], model.GetMillis())
	}

	th.App.HubUnregister(conn)
}
