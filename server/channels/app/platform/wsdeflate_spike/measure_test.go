// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsdeflate_spike

import (
	"bytes"
	"compress/flate"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
)

const measureIterations = 100

// countingConn counts bytes read from the underlying connection (client side =
// server→client wire bytes including WebSocket framing).
type countingConn struct {
	net.Conn
	n atomic.Int64
}

func (c *countingConn) Read(p []byte) (int, error) {
	n, err := c.Conn.Read(p)
	if n > 0 {
		c.n.Add(int64(n))
	}
	return n, err
}

func (c *countingConn) Bytes() int64 { return c.n.Load() }

type wsPair struct {
	server *websocket.Conn
	client *websocket.Conn
	count  *countingConn
	close  func()
}

func dialPair(t testing.TB, compress bool, level int) *wsPair {
	t.Helper()

	upgrader := websocket.Upgrader{
		CheckOrigin:       func(r *http.Request) bool { return true },
		EnableCompression: compress,
	}

	var serverConn atomic.Pointer[websocket.Conn]
	ready := make(chan struct{})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		if compress && level != 0 {
			if err := c.SetCompressionLevel(level); err != nil {
				t.Errorf("SetCompressionLevel(%d): %v", level, err)
				c.Close()
				return
			}
		}
		serverConn.Store(c)
		close(ready)
		// Keep handler alive until the test closes the server conn.
		select {
		case <-r.Context().Done():
		case <-time.After(2 * time.Minute):
		}
	}))

	var counted *countingConn
	dialer := websocket.Dialer{
		EnableCompression: compress,
		NetDial: func(network, addr string) (net.Conn, error) {
			c, err := net.Dial(network, addr)
			if err != nil {
				return nil, err
			}
			counted = &countingConn{Conn: c}
			return counted, nil
		},
	}

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	client, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)

	select {
	case <-ready:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for server websocket upgrade")
	}

	sc := serverConn.Load()
	require.NotNil(t, sc)
	require.NotNil(t, counted)

	return &wsPair{
		server: sc,
		client: client,
		count:  counted,
		close: func() {
			_ = client.Close()
			_ = sc.Close()
			srv.Close()
		},
	}
}

func measureWireAvg(t *testing.T, pair *wsPair, kind PayloadKind, n int) (rawAvg, wireAvg float64) {
	t.Helper()
	var rawTotal, wireTotal int64
	for i := 0; i < n; i++ {
		payload, err := GeneratePayloadJSON(kind, i, int64(i+1))
		require.NoError(t, err)
		rawTotal += int64(len(payload))

		before := pair.count.Bytes()
		require.NoError(t, pair.server.WriteMessage(websocket.TextMessage, payload))
		_, msg, err := pair.client.ReadMessage()
		require.NoError(t, err)
		require.Equal(t, payload, msg, "client should receive identical payload bytes")
		wireTotal += pair.count.Bytes() - before
	}
	return float64(rawTotal) / float64(n), float64(wireTotal) / float64(n)
}

// measureContextTakeoverAvg compresses varied payloads with a single reused
// flate.Writer (level 6), simulating permessage-deflate *with* context takeover.
// Returns average compressed payload bytes after a short warmup (no WS framing).
func measureContextTakeoverAvg(t *testing.T, kind PayloadKind, n int) float64 {
	t.Helper()

	var buf bytes.Buffer
	fw, err := flate.NewWriter(&buf, flate.DefaultCompression) // level 6
	require.NoError(t, err)

	warmup := 10
	var total int64
	var counted int
	for i := 0; i < n+warmup; i++ {
		payload, err := GeneratePayloadJSON(kind, i, int64(i+1))
		require.NoError(t, err)

		buf.Reset()
		_, err = fw.Write(payload)
		require.NoError(t, err)
		require.NoError(t, fw.Flush())

		// Match permessage-deflate: strip trailing 0x00 0x00 0xff 0xff sync marker.
		comp := buf.Bytes()
		if len(comp) >= 4 && bytes.Equal(comp[len(comp)-4:], []byte{0x00, 0x00, 0xff, 0xff}) {
			comp = comp[:len(comp)-4]
		}
		if i >= warmup {
			total += int64(len(comp))
			counted++
		}
	}
	require.NoError(t, fw.Close())
	require.Positive(t, counted)
	return float64(total) / float64(counted)
}

type row struct {
	name        string
	raw         float64
	uncomp      float64
	deflateL1   float64
	deflateL6   float64
	ctxTakeover float64
}

func TestMeasureDeflateSavings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping deflate wire measurement in short mode")
	}

	rows := make([]row, 0, len(AllKinds))
	for _, kind := range AllKinds {
		kind := kind
		t.Run(string(kind), func(t *testing.T) {
			uncompPair := dialPair(t, false, 0)
			defer uncompPair.close()
			rawAvg, uncompWire := measureWireAvg(t, uncompPair, kind, measureIterations)

			l1Pair := dialPair(t, true, 1)
			defer l1Pair.close()
			_, l1Wire := measureWireAvg(t, l1Pair, kind, measureIterations)

			l6Pair := dialPair(t, true, 6)
			defer l6Pair.close()
			_, l6Wire := measureWireAvg(t, l6Pair, kind, measureIterations)

			ctxAvg := measureContextTakeoverAvg(t, kind, measureIterations)

			rows = append(rows, row{
				name:        string(kind),
				raw:         rawAvg,
				uncomp:      uncompWire,
				deflateL1:   l1Wire,
				deflateL6:   l6Wire,
				ctxTakeover: ctxAvg,
			})
		})
	}

	// Print after subtests so the table is contiguous in -v output.
	t.Log("\n" + formatResultsTable(rows))
}

func formatResultsTable(rows []row) string {
	var b strings.Builder
	b.WriteString("WebSocket permessage-deflate wire-size measurement (avg over 100 varied messages)\n")
	b.WriteString("gorilla/websocket v1.5.3 negotiates no-context-takeover only.\n")
	b.WriteString("Wire columns include WebSocket framing; ctx-takeover is compressed payload only (no framing).\n\n")

	fmt.Fprintf(&b, "%-26s %8s %10s %10s %10s %10s %8s %8s %8s\n",
		"payload", "rawJSON", "uncomp", "deflL1", "deflL6", "ctxTO", "saveL1%", "saveL6%", "saveCT%")
	b.WriteString(strings.Repeat("-", 110) + "\n")

	for _, r := range rows {
		fmt.Fprintf(&b, "%-26s %8.0f %10.1f %10.1f %10.1f %10.1f %7.1f%% %7.1f%% %7.1f%%\n",
			r.name,
			r.raw,
			r.uncomp,
			r.deflateL1,
			r.deflateL6,
			r.ctxTakeover,
			pctSaved(r.uncomp, r.deflateL1),
			pctSaved(r.uncomp, r.deflateL6),
			pctSaved(r.raw, r.ctxTakeover), // vs raw JSON; framing-free reference
		)
	}
	return b.String()
}

func pctSaved(baseline, compressed float64) float64 {
	if baseline <= 0 {
		return 0
	}
	return (baseline - compressed) / baseline * 100
}

// BenchmarkDeflateWrite compares WriteMessage CPU cost for a representative
// posted_long event over compressed vs uncompressed connections.
func BenchmarkDeflateWrite(b *testing.B) {
	payload, err := GeneratePayloadJSON(KindPostedLong, 0, 1)
	require.NoError(b, err)

	b.Run("uncompressed", func(b *testing.B) {
		benchWrite(b, false, 0, payload)
	})
	b.Run("compressed_level1", func(b *testing.B) {
		benchWrite(b, true, 1, payload)
	})
	b.Run("compressed_level6", func(b *testing.B) {
		benchWrite(b, true, 6, payload)
	})
}

func benchWrite(b *testing.B, compress bool, level int, payload []byte) {
	b.Helper()

	upgrader := websocket.Upgrader{
		CheckOrigin:       func(r *http.Request) bool { return true },
		EnableCompression: compress,
	}

	var serverConn atomic.Pointer[websocket.Conn]
	ready := make(chan struct{})

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			b.Errorf("upgrade: %v", err)
			return
		}
		if compress {
			if err := c.SetCompressionLevel(level); err != nil {
				b.Errorf("SetCompressionLevel: %v", err)
				c.Close()
				return
			}
		}
		serverConn.Store(c)
		close(ready)
		select {
		case <-r.Context().Done():
		case <-time.After(5 * time.Minute):
		}
	}))
	defer srv.Close()

	dialer := websocket.Dialer{EnableCompression: compress}
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	client, _, err := dialer.Dial(wsURL, nil)
	require.NoError(b, err)
	defer client.Close()

	select {
	case <-ready:
	case <-time.After(5 * time.Second):
		b.Fatal("timed out waiting for upgrade")
	}
	sc := serverConn.Load()
	require.NotNil(b, sc)
	defer sc.Close()

	// Drain client reads so the writer is not blocked on TCP window.
	var wg sync.WaitGroup
	wg.Add(1)
	done := make(chan struct{})
	go func() {
		defer wg.Done()
		for {
			if _, _, err := client.ReadMessage(); err != nil {
				return
			}
			select {
			case <-done:
				return
			default:
			}
		}
	}()

	b.ReportAllocs()
	b.SetBytes(int64(len(payload)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := sc.WriteMessage(websocket.TextMessage, payload); err != nil {
			b.Fatal(err)
		}
	}
	b.StopTimer()
	close(done)
	_ = client.Close()
	wg.Wait()
}
