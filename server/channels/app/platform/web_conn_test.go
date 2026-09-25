// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	platform_mocks "github.com/mattermost/mattermost/server/v8/channels/app/platform/mocks"
)

type hookRunner struct {
}

func (h *hookRunner) RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks, _ *model.Manifest) bool, hookId int) {

}
func (h *hookRunner) HooksForPlugin(id string) (plugin.Hooks, error) {
	return nil, errors.New("not implemented")
}

func (h *hookRunner) GetPluginsEnvironment() *plugin.Environment {
	return nil
}

func TestWebConnAddDeadQueue(t *testing.T) {
	th := Setup(t)

	wc := th.Service.NewWebConn(&WebConnConfig{
		WebSocket: &websocket.Conn{},
	}, th.Suite, &hookRunner{})

	for i := range 2 {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	for i := range 2 {
		assert.Equal(t, int64(i), wc.deadQueue[i].GetSequence())
	}

	// Should push out the first two elements
	for i := range deadQueueSize {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i + 2))
		wc.addToDeadQueue(msg)
	}
	for i := range deadQueueSize {
		assert.Equal(t, int64(i+2), wc.deadQueue[(i+2)%deadQueueSize].GetSequence())
	}
}

func TestWebConnIsInDeadQueue(t *testing.T) {
	th := Setup(t)

	wc := th.Service.NewWebConn(&WebConnConfig{
		WebSocket: &websocket.Conn{},
	}, th.Suite, &hookRunner{})

	var i int
	for ; i < 2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.Sequence = int64(0)
	ok, ind := wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 0, ind)
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(1)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 1, ind)
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(2)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.False(t, ok)
	assert.Equal(t, 0, ind)
	assert.False(t, wc.hasMsgLoss())

	for ; i < deadQueueSize+2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.Sequence = int64(129)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 1, ind)
	wc.Sequence = int64(128)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 0, ind)
	wc.Sequence = int64(2)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 2, ind)
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(0)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.False(t, ok)
	assert.Equal(t, 0, ind)
	wc.Sequence = int64(130)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.False(t, ok)
	assert.Equal(t, 0, ind)
	assert.False(t, wc.hasMsgLoss())
}

func TestWebConnClearDeadQueue(t *testing.T) {
	th := Setup(t)

	wc := th.Service.NewWebConn(&WebConnConfig{
		WebSocket: &websocket.Conn{},
	}, th.Suite, &hookRunner{})

	var i int
	for ; i < 2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.clearDeadQueue()

	assert.Equal(t, 0, wc.deadQueuePointer)
}

func TestWebConnDrainDeadQueue(t *testing.T) {
	th := Setup(t)

	var dialConn = func(t *testing.T, th *TestHelper, addr net.Addr) *WebConn {
		d := websocket.Dialer{}
		c, _, err := d.Dial("ws://"+addr.String()+"/ws", nil)
		require.NoError(t, err)

		cfg := &WebConnConfig{
			WebSocket: c,
		}
		return th.Service.NewWebConn(cfg, th.Suite, &hookRunner{})
	}

	t.Run("Empty Queue", func(t *testing.T) {
		var handler = func(t *testing.T) http.HandlerFunc {
			return func(w http.ResponseWriter, req *http.Request) {
				upgrader := &websocket.Upgrader{}
				conn, err := upgrader.Upgrade(w, req, nil)
				cnt := 0
				for err == nil {
					_, _, err = conn.ReadMessage()
					cnt++
				}
				assert.Equal(t, 1, cnt)
				if _, ok := err.(*websocket.CloseError); !ok {
					require.NoError(t, err)
				}
			}
		}
		s := httptest.NewServer(handler(t))
		defer s.Close()

		wc := dialConn(t, th, s.Listener.Addr())
		defer wc.WebSocket.Close()
		wc.clearDeadQueue()

		err := wc.drainDeadQueue(0)
		require.NoError(t, err)
	})

	var handler = func(t *testing.T, seqNum int64, limit int) http.HandlerFunc {
		return func(w http.ResponseWriter, req *http.Request) {
			upgrader := &websocket.Upgrader{}
			conn, err := upgrader.Upgrade(w, req, nil)
			var buf []byte
			i := seqNum
			for err == nil {
				_, buf, err = conn.ReadMessage()
				if err != nil && len(buf) > 0 {
					ev, jsonErr := model.WebSocketEventFromJSON(bytes.NewReader(buf))
					require.NoError(t, jsonErr)
					require.LessOrEqual(t, int(i), limit)
					assert.Equal(t, i, ev.GetSequence())
					i++
				}
			}
			if _, ok := err.(*websocket.CloseError); !ok {
				require.NoError(t, err)
			}
		}
	}

	run := func(seqNum int64, limit int) {
		s := httptest.NewServer(handler(t, seqNum, limit))
		defer s.Close()

		wc := dialConn(t, th, s.Listener.Addr())
		defer wc.WebSocket.Close()

		for i := range limit {
			msg := model.NewWebSocketEvent("", "", "", "", map[string]bool{}, "")
			msg = msg.SetSequence(int64(i))
			wc.addToDeadQueue(msg)
		}
		wc.Sequence = seqNum
		ok, index := wc.isInDeadQueue(wc.Sequence)
		require.True(t, ok)

		err := wc.drainDeadQueue(index)
		require.NoError(t, err)
	}

	t.Run("Half-full Queue", func(t *testing.T) {
		t.Run("Middle", func(t *testing.T) { run(int64(2), 10) })
		t.Run("Beginning", func(t *testing.T) { run(int64(0), 10) })
		t.Run("End", func(t *testing.T) { run(int64(9), 10) })
		t.Run("Full", func(t *testing.T) { run(int64(deadQueueSize-1), deadQueueSize) })
	})

	t.Run("Cycled Queue", func(t *testing.T) {
		t.Run("First un-overwritten", func(t *testing.T) { run(int64(10), deadQueueSize+10) })
		t.Run("End", func(t *testing.T) { run(int64(127), deadQueueSize+10) })
		t.Run("Cycled End", func(t *testing.T) { run(int64(137), deadQueueSize+10) })
		t.Run("Overwritten First", func(t *testing.T) { run(int64(128), deadQueueSize+10) })
	})
}

func TestWebConnRejectBinaryFrameUnauthenticated(t *testing.T) {
	th := Setup(t)

	readPumpDone := make(chan struct{})
	upgradeErrCh := make(chan error, 1)

	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := &websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			upgradeErrCh <- err
			return
		}
		upgradeErrCh <- nil

		wc := th.Service.NewWebConn(&WebConnConfig{
			WebSocket: conn,
		}, th.Suite, &hookRunner{})

		require.False(t, wc.IsAuthenticated())

		go func() {
			wc.readPump()
			close(readPumpDone)
		}()
	}))
	defer s.Close()

	d := websocket.Dialer{}
	clientConn, _, err := d.Dial("ws://"+s.Listener.Addr().String()+"/ws", nil)
	require.NoError(t, err)
	defer clientConn.Close()

	require.NoError(t, <-upgradeErrCh)

	err = clientConn.WriteMessage(websocket.BinaryMessage, []byte{0x01, 0x02, 0x03})
	require.NoError(t, err)

	select {
	case <-readPumpDone:
	case <-time.After(5 * time.Second):
		require.Fail(t, "readPump did not exit after receiving binary frame")
	}
}

// newShouldSendEventBenchConn builds an authenticated WebConn for a normal user whose
// channel membership cache is warm with memberChannels entries, so that ShouldSendEvent
// exercises only the in-memory decision path (no store lookups, no cache refresh).
func newShouldSendEventBenchConn(tb testing.TB, th *TestHelper, memberChannels int) (*WebConn, []string) {
	tb.Helper()

	session := model.Session{
		Id:        model.NewId(),
		Token:     model.NewId(),
		UserId:    model.NewId(),
		Roles:     model.SystemUserRoleId,
		ExpiresAt: model.GetMillis() + 24*60*60*1000,
		Props:     map[string]string{},
	}
	wc := th.Service.NewWebConn(&WebConnConfig{
		WebSocket:    &websocket.Conn{},
		Session:      session,
		ConnectionID: model.NewId(),
		Active:       true,
	}, th.Suite, &hookRunner{})

	channelIDs := make([]string, 0, memberChannels)
	wc.allChannelMembers = make(map[string]string, memberChannels)
	for range memberChannels {
		id := model.NewId()
		channelIDs = append(channelIDs, id)
		wc.allChannelMembers[id] = model.ChannelUserRoleId
	}
	wc.lastAllChannelMembersTime = model.GetMillis()

	return wc, channelIDs
}

type shouldSendEventBenchCase struct {
	name     string
	event    *model.WebSocketEvent
	expected bool
}

// shouldSendEventBenchCases returns the four event shapes that dominate hub traffic:
// channel-scoped events for a channel the connection is not a member of (posted and typing),
// a channel-scoped event for a member channel, and a user-scoped event for another user.
func shouldSendEventBenchCases(memberChannelID string) []shouldSendEventBenchCase {
	nonMemberChannelID := model.NewId()
	return []shouldSendEventBenchCase{
		{"posted_non_member", model.NewWebSocketEvent(model.WebsocketEventPosted, "", nonMemberChannelID, "", nil, ""), false},
		{"typing_non_member", model.NewWebSocketEvent(model.WebsocketEventTyping, "", nonMemberChannelID, "", nil, ""), false},
		{"posted_member", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, ""), true},
		{"user_scoped_other_user", model.NewWebSocketEvent(model.WebsocketEventPreferencesChanged, "", "", model.NewId(), nil, ""), false},
	}
}

// TestWebConnShouldSendEventDecisions pins the decisions ShouldSendEvent makes on the
// in-memory path (warm membership cache, EnableWebHubChannelIteration off), using a mock
// suite so that permission denials can be exercised.
func TestWebConnShouldSendEventDecisions(t *testing.T) {
	th := Setup(t)
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableWebHubChannelIteration = false
	})

	const grantedPermission = "granted_permission"
	const deniedPermission = "denied_permission"
	roles := []string{model.SystemUserRoleId}

	mockSuite := platform_mocks.NewSuiteIFace(t)
	mockSuite.On("MFARequired", mock.Anything, http.MethodGet).Return(nil)
	mockSuite.On("RolesGrantPermission", roles, model.PermissionManageSystem.Id).Return(false)
	mockSuite.On("RolesGrantPermission", roles, grantedPermission).Return(true)
	mockSuite.On("RolesGrantPermission", roles, deniedPermission).Return(false)
	th.Suite = mockSuite

	wc, channelIDs := newShouldSendEventBenchConn(t, th, 200)
	memberChannelID := channelIDs[0]
	nonMemberChannelID := model.NewId()
	otherUserID := model.NewId()

	viewNothing := func() {
		wc.SetActiveChannelID(UnsetPresenceIndicator)
		wc.SetActiveRHSThreadChannelID(UnsetPresenceIndicator)
		wc.SetActiveThreadViewThreadChannelID(UnsetPresenceIndicator)
	}
	viewOtherChannel := func() {
		wc.SetActiveChannelID(nonMemberChannelID)
		wc.SetActiveRHSThreadChannelID(nonMemberChannelID)
		wc.SetActiveThreadViewThreadChannelID(nonMemberChannelID)
	}
	viewMemberChannel := func() {
		wc.SetActiveChannelID(memberChannelID)
		wc.SetActiveRHSThreadChannelID(UnsetPresenceIndicator)
		wc.SetActiveThreadViewThreadChannelID(UnsetPresenceIndicator)
	}

	cases := []struct {
		name     string
		event    *model.WebSocketEvent
		view     func()
		expected bool
	}{
		{"posted to non-member channel", model.NewWebSocketEvent(model.WebsocketEventPosted, "", nonMemberChannelID, "", nil, ""), viewNothing, false},
		{"posted to member channel", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, ""), viewNothing, true},
		{"typing in non-member channel, nothing viewed", model.NewWebSocketEvent(model.WebsocketEventTyping, "", nonMemberChannelID, "", nil, ""), viewNothing, false},
		{"typing in member channel, nothing viewed", model.NewWebSocketEvent(model.WebsocketEventTyping, "", memberChannelID, "", nil, ""), viewNothing, true},
		{"typing in member channel while viewing another channel and threads", model.NewWebSocketEvent(model.WebsocketEventTyping, "", memberChannelID, "", nil, ""), viewOtherChannel, false},
		{"typing in member channel while viewing it", model.NewWebSocketEvent(model.WebsocketEventTyping, "", memberChannelID, "", nil, ""), viewMemberChannel, true},
		{"reaction in member channel while viewing another channel and threads", model.NewWebSocketEvent(model.WebsocketEventReactionAdded, "", memberChannelID, "", nil, ""), viewOtherChannel, false},
		{"posted to member channel while viewing another channel", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, ""), viewOtherChannel, true},
		{"scoped to this connection", model.NewWebSocketEvent(model.WebsocketEventHello, "", "", "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ConnectionId: wc.GetConnectionID()}), viewNothing, true},
		{"scoped to another connection", model.NewWebSocketEvent(model.WebsocketEventHello, "", "", "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ConnectionId: model.NewId()}), viewNothing, false},
		{"scoped to this user", model.NewWebSocketEvent(model.WebsocketEventPreferencesChanged, "", "", wc.UserId, nil, ""), viewNothing, true},
		{"scoped to another user", model.NewWebSocketEvent(model.WebsocketEventPreferencesChanged, "", "", otherUserID, nil, ""), viewNothing, false},
		{"this user omitted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", map[string]bool{wc.UserId: true}, ""), viewNothing, false},
		{"another user omitted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", map[string]bool{otherUserID: true}, ""), viewNothing, true},
		{"this connection omitted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, OmitConnectionId: wc.GetConnectionID()}), viewNothing, false},
		{"required permission granted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, RequiredPermissions: []string{grantedPermission}}), viewNothing, true},
		{"required permission denied", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, RequiredPermissions: []string{deniedPermission}}), viewNothing, false},
		{"all required permissions must be granted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, RequiredPermissions: []string{grantedPermission, deniedPermission}}), viewNothing, false},
		{"sanitized data goes to non-admin", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, ContainsSanitizedData: true}), viewNothing, true},
		{"sensitive data does not go to non-admin", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, ContainsSensitiveData: true}), viewNothing, false},
		{"sensitive data with granted required permission takes precedence", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, ContainsSensitiveData: true, RequiredPermissions: []string{grantedPermission}}), viewNothing, true},
		{"team the session is not a member of", model.NewWebSocketEvent(model.WebsocketEventUpdateTeam, model.NewId(), "", "", nil, ""), viewNothing, false},
		{"unscoped event", model.NewWebSocketEvent(model.WebsocketEventConfigChanged, "", "", "", nil, ""), viewNothing, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.view()
			assert.Equal(t, tc.expected, wc.ShouldSendEvent(tc.event))
		})
	}
}

// TestWebConnShouldSendEventAllocs asserts that the per-connection filtering the hub does
// for every broadcast event does not allocate once the membership cache is warm.
func TestWebConnShouldSendEventAllocs(t *testing.T) {
	th := Setup(t)
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableWebHubChannelIteration = false
	})

	wc, channelIDs := newShouldSendEventBenchConn(t, th, 200)
	memberChannelID := channelIDs[len(channelIDs)/2]

	cases := shouldSendEventBenchCases(memberChannelID)
	cases = append(cases,
		shouldSendEventBenchCase{"required_permission_granted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, RequiredPermissions: []string{model.PermissionReadChannel.Id}}), true},
		shouldSendEventBenchCase{"sensitive_data_admin", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, ContainsSensitiveData: true}), true},
	)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, wc.ShouldSendEvent(tc.event))
			// Background goroutines started by Setup may allocate; AllocsPerRun averages
			// (with integer division) over the runs, so a large run count absorbs that noise.
			allocs := testing.AllocsPerRun(5000, func() {
				wc.ShouldSendEvent(tc.event)
			})
			assert.Zero(t, allocs, "ShouldSendEvent should not allocate")
		})
	}
}

func BenchmarkShouldSendEvent(b *testing.B) {
	th := Setup(b)
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableWebHubChannelIteration = false
	})

	wc, channelIDs := newShouldSendEventBenchConn(b, th, 200)

	for _, tc := range shouldSendEventBenchCases(channelIDs[len(channelIDs)/2]) {
		b.Run(tc.name, func(b *testing.B) {
			require.Equal(b, tc.expected, wc.ShouldSendEvent(tc.event))
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				wc.ShouldSendEvent(tc.event)
			}
		})
	}
}
