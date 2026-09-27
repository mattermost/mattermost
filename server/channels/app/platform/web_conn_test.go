// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"runtime"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/vmihailenco/msgpack/v5"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
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
