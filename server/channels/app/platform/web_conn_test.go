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
	metricsMock.On("IncrementWebsocketReconnectFailure", "old_conn_still_open", model.NewPointer(false), "1006", "mobile").Once()
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

func TestDeadQueueBounds(t *testing.T) {
	fill := func(n int) ([]*model.WebSocketEvent, int) {
		dq := make([]*model.WebSocketEvent, deadQueueSize)
		var ptr int
		for i := range n {
			dq[ptr] = model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "").SetSequence(int64(i))
			ptr = (ptr + 1) % deadQueueSize
		}
		return dq, ptr
	}

	t.Run("partially filled", func(t *testing.T) {
		oldest, newest := deadQueueBounds(fill(3))
		assert.Equal(t, int64(0), oldest)
		assert.Equal(t, int64(2), newest)
	})

	t.Run("exactly full", func(t *testing.T) {
		oldest, newest := deadQueueBounds(fill(deadQueueSize))
		assert.Equal(t, int64(0), oldest)
		assert.Equal(t, int64(deadQueueSize-1), newest)
	})

	t.Run("wrapped", func(t *testing.T) {
		oldest, newest := deadQueueBounds(fill(deadQueueSize + 10))
		assert.Equal(t, int64(10), oldest)
		assert.Equal(t, int64(deadQueueSize+9), newest)
	})
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
