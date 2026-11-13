// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"runtime"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/iotest"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/vmihailenco/msgpack/v5"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	platform_mocks "github.com/mattermost/mattermost/server/v8/channels/app/platform/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestPopulateWebConnConfigRejectedResume(t *testing.T) {
	mainHelper.Parallel(t)

	metricsMock := &mocks.MetricsInterface{}
	// Pumping a connection reports its gauges, and registering it sets the user online,
	// which broadcasts a status change.
	metricsMock.On("IncrementHTTPWebSockets", mock.Anything).Maybe()
	metricsMock.On("DecrementHTTPWebSockets", mock.Anything).Maybe()
	metricsMock.On("IncrementWebSocketBroadcastUsersRegistered", mock.Anything, mock.Anything).Maybe()
	metricsMock.On("DecrementWebSocketBroadcastUsersRegistered", mock.Anything, mock.Anything).Maybe()
	metricsMock.On("IncrementWebsocketEvent", mock.Anything).Maybe()
	metricsMock.On("IncrementWebSocketBroadcastBufferSize", mock.Anything, mock.Anything).Maybe()
	metricsMock.On("DecrementWebSocketBroadcastBufferSize", mock.Anything, mock.Anything).Maybe()
	metricsMock.On("IncrementWebSocketBroadcast", mock.Anything).Maybe()
	metricsMock.On("IncrementWebsocketReconnectEvent", reconnectNotFound, "1006", "mobile").Once()
	metricsMock.On("IncrementWebsocketReconnectFailure", "old_conn_still_open", false, "1006", "mobile").Once()
	th := Setup(t)
	th.Service.metricsIFace = metricsMock

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()
	wc := registerResumableWebConn(t, th, s.Listener.Addr(), model.NewId())

	cfg, err := th.Service.PopulateWebConnConfig(&model.Session{UserId: wc.UserId}, &WebConnConfig{
		ConnectionID:      wc.GetConnectionID(),
		OriginClient:      "mobile",
		DisconnectErrCode: "1006",
	}, "5")
	require.NoError(t, err)
	assert.NotEqual(t, wc.GetConnectionID(), cfg.ConnectionID)
	assert.Zero(t, cfg.sequence)
	metricsMock.AssertExpectations(t)
}

type hookRunner struct {
	disconnected atomic.Int64
}

func (h *hookRunner) RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks, _ *model.Manifest) bool, hookId int) {
	if hookId == plugin.OnWebSocketDisconnectID {
		h.disconnected.Add(1)
	}
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

type visibilitySuite struct {
	mockSuite
	canSee bool
	// restrictions, when set, is returned as is instead of the canSee-derived one.
	restrictions            *model.ViewUsersRestrictions
	restrictionsCalls       int
	userCanSeeOtherUserCall int
}

// GetViewUsersRestrictions returns no restrictions (sees everyone) when canSee is
// set, and empty restrictions (sees no one) otherwise.
func (vs *visibilitySuite) GetViewUsersRestrictions(rctx request.CTX, userID string) (*model.ViewUsersRestrictions, *model.AppError) {
	vs.restrictionsCalls++
	if vs.restrictions != nil {
		return vs.restrictions, nil
	}
	if vs.canSee {
		return nil, nil
	}
	return &model.ViewUsersRestrictions{}, nil
}

func (vs *visibilitySuite) UserCanSeeOtherUser(rctx request.CTX, userID string, otherUserID string) (bool, *model.AppError) {
	vs.userCanSeeOtherUserCall++
	return vs.canSee, nil
}

func TestWebConnShouldSendEventToGuest(t *testing.T) {
	th := Setup(t)

	targetUserID := model.NewId()

	newGuestConn := func(canSee bool) *WebConn {
		return &WebConn{
			Platform: th.Service,
			Suite:    &visibilitySuite{canSee: canSee},
			UserId:   model.NewId(),
		}
	}

	cpaEvent := func(userID any) *model.WebSocketEvent {
		msg := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
		if userID != nil {
			msg.Add("user_id", userID)
		}
		msg.Add("values", map[string]string{"fieldID": "secret"})
		return msg
	}

	propertyEvent := func(objectType any, targetID any) *model.WebSocketEvent {
		msg := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, "", "", "", nil, "")
		if objectType != nil {
			msg.Add("object_type", objectType)
		}
		if targetID != nil {
			msg.Add("target_id", targetID)
		}
		msg.Add("values", `[{"value":"secret"}]`)
		return msg
	}

	t.Run("CPA values updated is not sent to a guest who cannot see the target user", func(t *testing.T) {
		assert.False(t, newGuestConn(false).ShouldSendEventToGuest(cpaEvent(targetUserID)))
	})

	t.Run("CPA values updated is sent to a guest who can see the target user", func(t *testing.T) {
		assert.True(t, newGuestConn(true).ShouldSendEventToGuest(cpaEvent(targetUserID)))
	})

	t.Run("CPA values updated is not sent when the target user is missing or malformed", func(t *testing.T) {
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(cpaEvent(nil)))
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(cpaEvent("")))
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(cpaEvent(42)))
	})

	t.Run("user property values updated is not sent to a guest who cannot see the target user", func(t *testing.T) {
		assert.False(t, newGuestConn(false).ShouldSendEventToGuest(propertyEvent(model.PropertyFieldObjectTypeUser, targetUserID)))
	})

	t.Run("user property values updated is sent to a guest who can see the target user", func(t *testing.T) {
		assert.True(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent(model.PropertyFieldObjectTypeUser, targetUserID)))
	})

	t.Run("user property values updated is not sent when the target user is missing or malformed", func(t *testing.T) {
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent(model.PropertyFieldObjectTypeUser, nil)))
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent(model.PropertyFieldObjectTypeUser, "")))
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent(model.PropertyFieldObjectTypeUser, 42)))
	})

	t.Run("non-user property values updated is unaffected", func(t *testing.T) {
		for _, objectType := range []string{
			model.PropertyFieldObjectTypePost,
			model.PropertyFieldObjectTypeChannel,
			model.PropertyFieldObjectTypeSystem,
		} {
			assert.True(t, newGuestConn(false).ShouldSendEventToGuest(propertyEvent(objectType, model.NewId())), objectType)
		}
	})

	t.Run("property values updated is not sent when object_type is missing or malformed", func(t *testing.T) {
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent(nil, targetUserID)))
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent("", targetUserID)))
		assert.False(t, newGuestConn(true).ShouldSendEventToGuest(propertyEvent(42, targetUserID)))
	})

	fieldClearedEvent := func() *model.WebSocketEvent {
		msg := model.NewWebSocketEvent(model.WebsocketEventPropertyValuesUpdated, "", "", "", nil, "")
		msg.Add("field_id", model.NewId())
		msg.Add("values", "[]")
		return msg
	}

	t.Run("field-wide property values cleared is sent to a guest", func(t *testing.T) {
		assert.True(t, newGuestConn(false).ShouldSendEventToGuest(fieldClearedEvent()))
	})

	t.Run("field-wide property values event is not sent when it carries a target or values", func(t *testing.T) {
		withValues := fieldClearedEvent()
		withValues.Add("values", `[{"value":"secret"}]`)
		assert.False(t, newGuestConn(false).ShouldSendEventToGuest(withValues))

		withTarget := fieldClearedEvent()
		withTarget.Add("target_id", targetUserID)
		assert.False(t, newGuestConn(false).ShouldSendEventToGuest(withTarget))

		withoutField := fieldClearedEvent()
		withoutField.Add("field_id", "")
		assert.False(t, newGuestConn(false).ShouldSendEventToGuest(withoutField))
	})

	t.Run("unrelated events are unaffected", func(t *testing.T) {
		msg := model.NewWebSocketEvent(model.WebsocketEventTyping, "", "", "", nil, "")
		assert.True(t, newGuestConn(false).ShouldSendEventToGuest(msg))
	})
}

func TestWebConnCanSeeUserCached(t *testing.T) {
	th := Setup(t)

	team := th.CreateTeam(t)
	guest := th.CreateUserOrGuest(t, true)
	sharing := th.CreateUserOrGuest(t, false)
	notSharing := th.CreateUserOrGuest(t, false)

	addToChannel := func(user *model.User, channel *model.Channel) {
		_, err := th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeUser:  true,
		})
		require.NoError(t, err)
	}

	shared := th.CreateChannel(t, team)
	addToChannel(guest, shared)
	addToChannel(sharing, shared)
	addToChannel(notSharing, th.CreateChannel(t, team))

	restrictionsFor := func(userID string) *model.ViewUsersRestrictions {
		members, err := th.Service.Store.Channel().GetAllChannelMembersForUser(th.Context, userID, false, true)
		require.NoError(t, err)
		restrictions := &model.ViewUsersRestrictions{Teams: []string{}, Channels: []string{}}
		for id := range members {
			restrictions.Channels = append(restrictions.Channels, id)
		}
		return restrictions
	}

	newConn := func(suite *visibilitySuite) *WebConn {
		return &WebConn{Platform: th.Service, Suite: suite, UserId: guest.Id}
	}

	t.Run("sees only users it shares a channel with", func(t *testing.T) {
		wc := newConn(&visibilitySuite{restrictions: restrictionsFor(guest.Id)})

		canSee, appErr := wc.canSeeUserCached(th.Context, sharing.Id)
		require.Nil(t, appErr)
		assert.True(t, canSee)

		canSee, appErr = wc.canSeeUserCached(th.Context, notSharing.Id)
		require.Nil(t, appErr)
		assert.False(t, canSee)
	})

	t.Run("always sees itself, even without restrictions loaded", func(t *testing.T) {
		suite := &visibilitySuite{restrictions: restrictionsFor(guest.Id)}
		canSee, appErr := newConn(suite).canSeeUserCached(th.Context, guest.Id)
		require.Nil(t, appErr)
		assert.True(t, canSee)
		assert.Zero(t, suite.restrictionsCalls)
	})

	t.Run("sees everyone when it has no restrictions", func(t *testing.T) {
		canSee, appErr := newConn(&visibilitySuite{canSee: true}).canSeeUserCached(th.Context, notSharing.Id)
		require.Nil(t, appErr)
		assert.True(t, canSee)
	})

	t.Run("sees no one when it has no channels", func(t *testing.T) {
		canSee, appErr := newConn(&visibilitySuite{canSee: false}).canSeeUserCached(th.Context, sharing.Id)
		require.Nil(t, appErr)
		assert.False(t, canSee)
	})

	t.Run("falls back to UserCanSeeOtherUser when team-wide visibility applies", func(t *testing.T) {
		suite := &visibilitySuite{canSee: true, restrictions: &model.ViewUsersRestrictions{Teams: []string{team.Id}}}
		wc := newConn(suite)
		canSee, appErr := wc.canSeeUserCached(th.Context, notSharing.Id)
		require.Nil(t, appErr)
		assert.True(t, canSee)
		assert.Equal(t, 1, suite.userCanSeeOtherUserCall)
	})

	t.Run("loads restrictions once across many events", func(t *testing.T) {
		suite := &visibilitySuite{restrictions: restrictionsFor(guest.Id)}
		wc := newConn(suite)
		for range 100 {
			_, appErr := wc.canSeeUserCached(th.Context, sharing.Id)
			require.Nil(t, appErr)
			_, appErr = wc.canSeeUserCached(th.Context, notSharing.Id)
			require.Nil(t, appErr)
		}
		assert.Equal(t, 1, suite.restrictionsCalls)
		assert.Zero(t, suite.userCanSeeOtherUserCall)
	})

	t.Run("InvalidateCache picks up new memberships", func(t *testing.T) {
		later := th.CreateUserOrGuest(t, false)
		suite := &visibilitySuite{}
		wc := newConn(suite)

		suite.restrictions = restrictionsFor(guest.Id)
		canSee, appErr := wc.canSeeUserCached(th.Context, later.Id)
		require.Nil(t, appErr)
		assert.False(t, canSee)

		// The guest joins a channel that `later` is in.
		other := th.CreateChannel(t, team)
		addToChannel(later, other)
		addToChannel(guest, other)
		// The app layer invalidates the per-user caches on membership changes.
		th.Service.InvalidateChannelCacheForUser(later.Id)
		th.Service.InvalidateChannelCacheForUser(guest.Id)
		suite.restrictions = restrictionsFor(guest.Id)

		wc.InvalidateCache()
		canSee, appErr = wc.canSeeUserCached(th.Context, later.Id)
		require.Nil(t, appErr)
		assert.True(t, canSee)
	})

	t.Run("invalidating a user drops the cached channels immediately", func(t *testing.T) {
		target := th.CreateUserOrGuest(t, false)
		joined := th.CreateChannel(t, team)
		addToChannel(guest, joined)
		addToChannel(target, joined)

		wc := newConn(&visibilitySuite{restrictions: restrictionsFor(guest.Id)})
		canSee, appErr := wc.canSeeUserCached(th.Context, target.Id)
		require.Nil(t, appErr)
		require.True(t, canSee)

		require.NoError(t, th.Service.Store.Channel().RemoveMember(th.Context, joined.Id, target.Id))
		th.Service.InvalidateChannelCacheForUser(target.Id)

		canSee, appErr = wc.canSeeUserCached(th.Context, target.Id)
		require.Nil(t, appErr)
		assert.False(t, canSee)
	})

	t.Run("ShouldSendEventToGuest does not query the suite per event", func(t *testing.T) {
		suite := &visibilitySuite{restrictions: restrictionsFor(guest.Id)}
		wc := newConn(suite)
		event := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
		event.Add("user_id", sharing.Id)
		for range 50 {
			assert.True(t, wc.ShouldSendEventToGuest(event))
		}
		assert.Equal(t, 1, suite.restrictionsCalls)
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

// recordingWebSocketHandler hands every request it is given back to the test.
type recordingWebSocketHandler struct {
	requests chan *model.WebSocketRequest
}

func (h *recordingWebSocketHandler) ServeWebSocket(_ *WebConn, req *model.WebSocketRequest) {
	h.requests <- req
}

// authenticatedWebConnServer serves each incoming websocket connection with a
// readPump running on a WebConn that carries the given session.
type authenticatedWebConnServer struct {
	*httptest.Server

	conns        chan *WebConn
	readPumpDone chan struct{}
}

func newAuthenticatedWebConnServer(tb testing.TB, th *TestHelper, session model.Session, capacity int) *authenticatedWebConnServer {
	s := &authenticatedWebConnServer{
		conns:        make(chan *WebConn, capacity),
		readPumpDone: make(chan struct{}, capacity),
	}

	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := &websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		wc := th.Service.NewWebConn(&WebConnConfig{
			WebSocket: conn,
			Session:   session,
		}, th.Suite, &hookRunner{})
		s.conns <- wc

		go func() {
			wc.readPump()
			s.readPumpDone <- struct{}{}
		}()
	}))
	tb.Cleanup(s.Close)

	return s
}

// dial opens a client connection and returns it together with the server side
// WebConn serving it.
func (s *authenticatedWebConnServer) dial(tb testing.TB) (*websocket.Conn, *WebConn) {
	d := websocket.Dialer{}
	clientConn, _, err := d.Dial("ws://"+s.Listener.Addr().String()+"/ws", nil)
	require.NoError(tb, err)
	tb.Cleanup(func() {
		clientConn.Close()
	})

	select {
	case wc := <-s.conns:
		return clientConn, wc
	case <-time.After(5 * time.Second):
		require.FailNow(tb, "server did not accept the websocket connection")
		return nil, nil
	}
}

func (s *authenticatedWebConnServer) waitForReadPumps(tb testing.TB, count int) {
	for range count {
		select {
		case <-s.readPumpDone:
		case <-time.After(10 * time.Second):
			require.FailNow(tb, "readPump did not return for every connection")
		}
	}
}

func TestWebConnDecodeAllocationTracksFrameSize(t *testing.T) {
	th := Setup(t)

	user := th.CreateUserOrGuest(t, false)
	session := model.Session{
		UserId:    user.Id,
		Token:     model.NewId(),
		ExpiresAt: model.GetMillis() + 100000,
	}

	// Number of connections decoding a frame at the same time, and the amount
	// by which a run may exceed the reference run below. The reference run
	// allocates on the order of a MiB in total, so the allowance leaves a wide
	// band for run to run variance.
	const (
		concurrentConnections = 20
		allowance             = 32 << 20
		declaredEntries       = 1_000_000
		declaredShortEntries  = 65535
	)

	msgpackString := func(s string) []byte {
		require.Less(t, len(s), 32, "only fixstr lengths are built here")
		return append([]byte{0xA0 | byte(len(s))}, s...)
	}

	// frame builds {"action": "custom_x", "data": <data>}. The action is
	// plugin prefixed so a decoded frame is handed to the plugin hooks
	// without going through the websocket router.
	frame := func(data []byte) []byte {
		b := []byte{0x82} // two entry map
		b = append(b, msgpackString("action")...)
		b = append(b, msgpackString("custom_x")...)
		b = append(b, msgpackString("data")...)
		return append(b, data...)
	}

	// map32 and array32 headers declare an entry count in the frame header,
	// independently of how many entries the frame goes on to carry.
	map32Header := func(entries uint32) []byte {
		return binary.BigEndian.AppendUint32([]byte{0xDF}, entries)
	}
	array32Header := func(elements uint32) []byte {
		return binary.BigEndian.AppendUint32([]byte{0xDD}, elements)
	}

	// map16 declares its entry count in two header bytes instead of four.
	map16Header := func(entries uint16) []byte {
		return binary.BigEndian.AppendUint16([]byte{0xDE}, entries)
	}

	oneEntryMap := func(key string, value []byte) []byte {
		b := []byte{0x81}
		b = append(b, msgpackString(key)...)
		return append(b, value...)
	}

	// nestedDeclaredMaps builds {"k1": "v1", "k2": <count headers>, "k3": "v3"},
	// where each header sits in the value position of the entry opened by the
	// header before it, below two entries the frame does carry.
	nestedDeclaredMaps := func(count int) []byte {
		b := []byte{0x83} // three entry map
		b = append(b, msgpackString("k1")...)
		b = append(b, msgpackString("v1")...)
		b = append(b, msgpackString("k2")...)
		for range count {
			b = append(b, map16Header(declaredShortEntries)...)
			b = append(b, msgpackString("")...) // key of the entry each header opens
		}
		b = append(b, msgpackString("k3")...)
		return append(b, msgpackString("v3")...)
	}

	// The reference frame carries the entries it declares: {"data": {"a": "b"}}.
	referenceFrame := frame(oneEntryMap("a", msgpackString("b")))

	asMiB := func(b uint64) float64 {
		return float64(b) / (1 << 20)
	}

	sendFrame := func(t *testing.T, payload []byte) {
		s := newAuthenticatedWebConnServer(t, th, session, concurrentConnections)

		clientConns := make([]*websocket.Conn, 0, concurrentConnections)
		for range concurrentConnections {
			clientConn, wc := s.dial(t)
			require.True(t, wc.IsAuthenticated())
			clientConns = append(clientConns, clientConn)
		}

		start := make(chan struct{})
		var wg sync.WaitGroup
		for _, clientConn := range clientConns {
			wg.Go(func() {
				<-start
				assert.NoError(t, clientConn.WriteMessage(websocket.BinaryMessage, payload))
			})
		}
		close(start)
		wg.Wait()

		for _, clientConn := range clientConns {
			clientConn.Close()
		}
		s.waitForReadPumps(t, concurrentConnections)
	}

	measure := func(t *testing.T, payload []byte) uint64 {
		var before, after runtime.MemStats

		runtime.GC()
		runtime.ReadMemStats(&before)

		sendFrame(t, payload)

		runtime.GC()
		runtime.ReadMemStats(&after)

		return after.TotalAlloc - before.TotalAlloc
	}

	testCases := []struct {
		name  string
		frame []byte
	}{
		{
			name:  "declared map length",
			frame: frame(map32Header(declaredEntries)),
		},
		{
			name:  "declared array length",
			frame: frame(oneEntryMap("a", array32Header(declaredEntries))),
		},
		{
			name:  "declared map length in a short header",
			frame: frame(map16Header(declaredShortEntries)),
		},
		{
			name:  "declared lengths nested below entries the frame carries",
			frame: frame(nestedDeclaredMaps(3)),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			reference := measure(t, referenceFrame)
			allocated := measure(t, tc.frame)

			require.LessOrEqualf(t, allocated, reference+allowance,
				"%d connections sending a %d byte frame allocated %.1f MiB, while the same number of connections sending a %d byte frame carrying its entries allocated %.1f MiB (allowance %.1f MiB)",
				concurrentConnections, len(tc.frame), asMiB(allocated), len(referenceFrame), asMiB(reference), asMiB(allowance))
		})
	}
}

// haltingHandler is a websocket handler whose execution ends before it returns
// to its caller. It stands in for any handler that does not run to completion.
type haltingHandler struct {
	served atomic.Int64
}

func (h *haltingHandler) ServeWebSocket(_ *WebConn, _ *model.WebSocketRequest) {
	h.served.Add(1)
	panic(errors.New("handler did not run to completion"))
}

func TestWebConnPumpCompletesTeardown(t *testing.T) {
	th := Setup(t)

	const action = "test_conn_teardown"
	handler := &haltingHandler{}
	th.Service.WebSocketRouter.Handle(action, handler)

	// The number of simultaneous connections the teardown contract has to hold for.
	const numConns = 20

	runner := &hookRunner{}
	serverConns := make(chan *WebConn, numConns)
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upgrader := &websocket.Upgrader{}
		conn, err := upgrader.Upgrade(w, r, nil)
		if !assert.NoError(t, err) {
			return
		}

		wc := th.Service.NewWebConn(&WebConnConfig{
			WebSocket:    conn,
			ConnectionID: model.NewId(),
			Session: model.Session{
				UserId:    model.NewId(),
				Token:     model.NewId(),
				ExpiresAt: model.GetMillis() + 100000,
			},
		}, th.Suite, runner)
		// the router only dispatches to a registered handler on an authenticated
		// connection, so the request would never reach it otherwise
		assert.True(t, wc.IsAuthenticated())
		serverConns <- wc

		go func() {
			defer func() {
				_ = recover()
			}()
			wc.Pump()
		}()
	}))
	defer s.Close()

	var wg sync.WaitGroup
	clientConns := make(chan *websocket.Conn, numConns)
	wg.Add(numConns)
	for range numConns {
		go func() {
			defer wg.Done()

			d := websocket.Dialer{}
			c, _, err := d.Dial("ws://"+s.Listener.Addr().String()+"/ws", nil)
			if !assert.NoError(t, err) {
				return
			}
			clientConns <- c

			assert.NoError(t, c.WriteJSON(&model.WebSocketRequest{Seq: 1, Action: action}))
		}()
	}
	wg.Wait()
	close(clientConns)
	clients := make([]*websocket.Conn, 0, numConns)
	for c := range clientConns {
		clients = append(clients, c)
	}
	// the client side stays open until the assertions below are done, so that
	// the handler is what ends each connection
	t.Cleanup(func() {
		for _, c := range clients {
			c.Close()
		}
	})

	wcs := make([]*WebConn, 0, numConns)
	for range numConns {
		select {
		case wc := <-serverConns:
			wcs = append(wcs, wc)
		case <-time.After(10 * time.Second):
			require.FailNow(t, "not every connection was established")
		}
	}

	// the request reaches the registered handler on every connection, so each
	// one exercises the same path
	require.Eventually(t, func() bool {
		return handler.served.Load() == int64(numConns)
	}, 10*time.Second, 50*time.Millisecond, "every request should have reached the registered handler")

	deadline := time.After(20 * time.Second)
	for i, wc := range wcs {
		// every connection releases its resources, whatever the handler did
		select {
		case <-wc.pumpFinished:
		case <-deadline:
			require.FailNow(t, fmt.Sprintf("connection %d did not complete its teardown", i))
		}

		// the queue the per-connection consumer ranges over is released, so
		// that consumer is no longer running
		select {
		case _, open := <-wc.pluginPosted:
			assert.False(t, open, "connection %d still holds its message queue", i)
		default:
			assert.Fail(t, fmt.Sprintf("connection %d still holds its message queue", i))
		}
	}

	// every connection reports its disconnect, so hooks watching the
	// connection lifecycle still run
	require.Eventually(t, func() bool {
		return runner.disconnected.Load() == int64(numConns)
	}, 10*time.Second, 50*time.Millisecond, "every connection should have reported its disconnect")
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
	members := make(map[string]string, memberChannels)
	for range memberChannels {
		id := model.NewId()
		channelIDs = append(channelIDs, id)
		members[id] = model.ChannelUserRoleId
	}
	wc.allChannelMembers = newChannelSet(members)
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
			assert.Equal(t, tc.expected, wc.ShouldSendEvent(tc.event, decodeChannelID(tc.event.GetBroadcast().ChannelId)))
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

	// Give the session the admin role so that the sensitive-data case below is
	// delivered to it. The helper's suite grants every permission regardless, so
	// this only makes the case read as what it is.
	session := wc.GetSession().DeepCopy()
	session.Roles = model.SystemUserRoleId + " " + model.SystemAdminRoleId
	wc.SetSession(session)

	cases := shouldSendEventBenchCases(memberChannelID)
	cases = append(cases,
		shouldSendEventBenchCase{"required_permission_granted", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, RequiredPermissions: []string{model.PermissionReadChannel.Id}}), true},
		shouldSendEventBenchCase{"sensitive_data_admin", model.NewWebSocketEvent(model.WebsocketEventPosted, "", memberChannelID, "", nil, "").SetBroadcast(&model.WebsocketBroadcast{ChannelId: memberChannelID, ContainsSensitiveData: true}), true},
	)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			channelKey := decodeChannelID(tc.event.GetBroadcast().ChannelId)
			require.Equal(t, tc.expected, wc.ShouldSendEvent(tc.event, channelKey))
			// Background goroutines started by Setup may allocate; AllocsPerRun averages
			// (with integer division) over the runs, so a large run count absorbs that noise.
			allocs := testing.AllocsPerRun(5000, func() {
				wc.ShouldSendEvent(tc.event, channelKey)
			})
			assert.Zero(t, allocs, "ShouldSendEvent should not allocate")
		})
	}
}

func TestWebConnDecodesAuthenticatedFrames(t *testing.T) {
	th := Setup(t)

	user := th.CreateUserOrGuest(t, false)
	session := model.Session{
		UserId:    user.Id,
		Token:     model.NewId(),
		ExpiresAt: model.GetMillis() + 100000,
	}

	const action = "test_decoded_action"
	routed := make(chan *model.WebSocketRequest, 1)
	th.Service.WebSocketRouter.Handle(action, &recordingWebSocketHandler{requests: routed})

	req := &model.WebSocketRequest{
		Seq:    1,
		Action: action,
		Data: map[string]any{
			"channel_id":     model.NewId(),
			"is_thread_view": true,
			"ids":            []any{"first", "second", "third"},
			"options": map[string]any{
				"one":   "1",
				"two":   "2",
				"three": "3",
				"four":  "4",
			},
		},
	}

	// Collections whose declared lengths are zero, and collections nested
	// several levels below the top of the frame.
	sparseReq := &model.WebSocketRequest{
		Seq:    2,
		Action: action,
		Data: map[string]any{
			"empty_map":  map[string]any{},
			"empty_list": []any{},
			"nested": map[string]any{
				"second": map[string]any{
					"third": []any{map[string]any{"fourth": []any{"leaf"}}},
				},
			},
		},
	}

	testCases := []struct {
		name        string
		messageType int
		request     *model.WebSocketRequest
	}{
		{
			name:        "binary msgpack frame",
			messageType: websocket.BinaryMessage,
			request:     req,
		},
		{
			name:        "text JSON frame",
			messageType: websocket.TextMessage,
			request:     req,
		},
		{
			name:        "binary frame of empty and nested collections",
			messageType: websocket.BinaryMessage,
			request:     sparseReq,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var frame []byte
			var err error
			if tc.messageType == websocket.BinaryMessage {
				frame, err = msgpack.Marshal(tc.request)
			} else {
				frame, err = json.Marshal(tc.request)
			}
			require.NoError(t, err)

			s := newAuthenticatedWebConnServer(t, th, session, 1)

			clientConn, wc := s.dial(t)
			require.True(t, wc.IsAuthenticated())

			require.NoError(t, clientConn.WriteMessage(tc.messageType, frame))

			select {
			case got := <-routed:
				assert.Equal(t, tc.request.Seq, got.Seq)
				assert.Equal(t, tc.request.Action, got.Action)
				assert.Equal(t, tc.request.Data, got.Data)
			case <-time.After(5 * time.Second):
				require.FailNow(t, "the request was not dispatched to its handler")
			}

			select {
			case posted := <-wc.pluginPosted:
				assert.Equal(t, tc.request.Action, posted.req.Action)
				for key, value := range tc.request.Data {
					assert.Equal(t, value, posted.req.Data[key])
				}
			case <-time.After(5 * time.Second):
				require.FailNow(t, "the request was not forwarded to the plugin hooks")
			}

			clientConn.Close()
			s.waitForReadPumps(t, 1)
		})
	}
}

// binaryFrameOfSize returns the msgpack encoding of a request for action,
// padded so the encoding is exactly size bytes.
func binaryFrameOfSize(tb testing.TB, action string, size int) []byte {
	padding := size
	for range 10 {
		encoded, err := msgpack.Marshal(&model.WebSocketRequest{
			Seq:    1,
			Action: action,
			Data:   map[string]any{"padding": strings.Repeat("x", padding)},
		})
		require.NoError(tb, err)
		if len(encoded) == size {
			return encoded
		}
		padding += size - len(encoded)
		require.Positive(tb, padding)
	}

	require.FailNow(tb, "could not encode a request of the requested size")
	return nil
}

func TestWebConnReadsBinaryFramesUpToTheReadLimit(t *testing.T) {
	th := Setup(t)

	user := th.CreateUserOrGuest(t, false)
	session := model.Session{
		UserId:    user.Id,
		Token:     model.NewId(),
		ExpiresAt: model.GetMillis() + 100000,
	}

	const action = "test_read_limit_action"
	routed := make(chan *model.WebSocketRequest, 1)
	th.Service.WebSocketRouter.Handle(action, &recordingWebSocketHandler{requests: routed})

	atLimit := binaryFrameOfSize(t, action, model.SocketMaxMessageSizeKb)

	// One byte past the limit, trailing an encoding that is complete without it.
	pastLimit := append(slices.Clone(atLimit), 0xC0)

	testCases := []struct {
		name           string
		frame          []byte
		wantDispatched bool
	}{
		{
			name:           "frame at the read limit",
			frame:          atLimit,
			wantDispatched: true,
		},
		{
			name:           "frame past the read limit",
			frame:          pastLimit,
			wantDispatched: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := newAuthenticatedWebConnServer(t, th, session, 1)

			clientConn, wc := s.dial(t)
			require.True(t, wc.IsAuthenticated())

			require.NoError(t, clientConn.WriteMessage(websocket.BinaryMessage, tc.frame))

			select {
			case got := <-routed:
				require.Truef(t, tc.wantDispatched,
					"a %d byte frame was dispatched to its handler, over a read limit of %d bytes",
					len(tc.frame), model.SocketMaxMessageSizeKb)
				assert.Equal(t, action, got.Action)

				clientConn.Close()
				s.waitForReadPumps(t, 1)
			case <-s.readPumpDone:
				require.Falsef(t, tc.wantDispatched,
					"readPump returned without dispatching a %d byte frame, under a read limit of %d bytes",
					len(tc.frame), model.SocketMaxMessageSizeKb)

				clientConn.Close()
			case <-time.After(5 * time.Second):
				require.FailNow(t, "the connection neither dispatched the frame nor closed")
			}
		})
	}
}

func TestDecodeBinaryRequestEnforcesMaxSize(t *testing.T) {
	const action = "test_decode_size_action"
	atLimit := binaryFrameOfSize(t, action, model.SocketMaxMessageSizeKb)

	t.Run("frame at the max size decodes", func(t *testing.T) {
		var req model.WebSocketRequest
		require.NoError(t, decodeBinaryRequest(bytes.NewReader(atLimit), &req))
		assert.Equal(t, action, req.Action)
	})

	t.Run("frame past the max size is rejected rather than truncated", func(t *testing.T) {
		pastLimit := append(slices.Clone(atLimit), 0xC0)
		var req model.WebSocketRequest
		require.ErrorIs(t, decodeBinaryRequest(bytes.NewReader(pastLimit), &req), errBinaryFrameTooLarge)
		assert.Empty(t, req.Action)
	})

	t.Run("reader errors are returned", func(t *testing.T) {
		readErr := errors.New("read failed")
		var req model.WebSocketRequest
		require.ErrorIs(t, decodeBinaryRequest(io.MultiReader(bytes.NewReader(atLimit[:10]), iotest.ErrReader(readErr)), &req), readErr)
	})

	t.Run("decoded values do not share the pooled buffer", func(t *testing.T) {
		var first model.WebSocketRequest
		require.NoError(t, decodeBinaryRequest(bytes.NewReader(atLimit), &first))
		padding := first.Data["padding"].(string)

		overwrite := bytes.ReplaceAll(atLimit, []byte("x"), []byte("y"))
		var second model.WebSocketRequest
		require.NoError(t, decodeBinaryRequest(bytes.NewReader(overwrite), &second))

		assert.Equal(t, strings.Repeat("x", len(padding)), padding)
	})
}

func BenchmarkShouldSendEvent(b *testing.B) {
	th := Setup(b)
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableWebHubChannelIteration = false
	})

	wc, channelIDs := newShouldSendEventBenchConn(b, th, 200)

	for _, tc := range shouldSendEventBenchCases(channelIDs[len(channelIDs)/2]) {
		b.Run(tc.name, func(b *testing.B) {
			channelKey := decodeChannelID(tc.event.GetBroadcast().ChannelId)
			require.Equal(b, tc.expected, wc.ShouldSendEvent(tc.event, channelKey))
			b.ReportAllocs()
			b.ResetTimer()
			for b.Loop() {
				wc.ShouldSendEvent(tc.event, channelKey)
			}
		})
	}
}

// MM-70121: re-resolving the session behind a live websocket logs on both the
// rejected and the failed-lookup branch, and neither may carry the token.
func TestWebConnIsBasicAuthenticatedDoesNotLogToken(t *testing.T) {
	th := Setup(t)

	testCases := []struct {
		name       string
		statusCode int
		wantLog    string
		resolve    func(wc *WebConn) bool
	}{
		{"session rejected", http.StatusUnauthorized, "Invalid session.", func(wc *WebConn) bool { return wc.IsBasicAuthenticated() }},
		{"session lookup failed", http.StatusInternalServerError, "Could not get session", func(wc *WebConn) bool { return wc.IsBasicAuthenticated() }},
		{"team membership lookup failed", http.StatusInternalServerError, "Could not get session", func(wc *WebConn) bool {
			wc.SetSession(nil)
			return wc.isMemberOfTeam(model.NewId())
		}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			logBuffer := &mlog.Buffer{}
			require.NoError(t, mlog.AddWriterTarget(th.Service.Logger(), logBuffer, true, mlog.StdAll...))

			token := model.NewId()

			suite := &platform_mocks.SuiteIFace{}
			suite.On("GetSession", token).Return(nil, model.NewAppError("GetSession", "api.context.invalid_session.error", nil, "", tc.statusCode))

			wc := th.Service.NewWebConn(&WebConnConfig{
				WebSocket: &websocket.Conn{},
				Session:   model.Session{Token: token, ExpiresAt: model.GetMillis() - 1000},
			}, suite, &hookRunner{})

			assert.False(t, tc.resolve(wc))
			require.NoError(t, th.Service.Logger().Flush())

			logs := logBuffer.String()
			require.Contains(t, logs, tc.wantLog)
			assert.NotContains(t, logs, token)
		})
	}
}
