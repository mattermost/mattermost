// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	brrr "github.com/molecule-man/go-brrr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hijackableResponseWriter adds http.Hijacker support to httptest.ResponseRecorder,
// which doesn't implement it, so tests can exercise the real WebSocket upgrade path.
type hijackableResponseWriter struct {
	*httptest.ResponseRecorder
	conn net.Conn
}

func (w *hijackableResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.conn, bufio.NewReadWriter(bufio.NewReader(w.conn), bufio.NewWriter(w.conn)), nil
}

// handlerForBrotli writes a body large enough that compression is worthwhile.
func handlerForBrotli(t *testing.T) func(*Context, http.ResponseWriter, *http.Request) {
	return func(_ *Context, w http.ResponseWriter, _ *http.Request) {
		var body [1400]byte
		_, err := w.Write(body[:])
		require.NoError(t, err)
	}
}

func TestCompressionHandlerBrotli(t *testing.T) {
	innerHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		var body [1400]byte
		_, err := w.Write(body[:])
		require.NoError(t, err)
	})

	t.Run("serves brotli when Accept-Encoding contains br and compression enabled", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br, gzip")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "br", resp.Header().Get("Content-Encoding"))

		// Verify the body is valid brotli-compressed data.
		decompressed, err := brrr.Decompress(resp.Body.Bytes())
		require.NoError(t, err)
		assert.Len(t, decompressed, 1400)
	})

	t.Run("falls back to gzip when Accept-Encoding does not contain br", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "gzip", resp.Header().Get("Content-Encoding"))
	})

	t.Run("no compression when compression disabled even if client accepts br", func(t *testing.T) {
		h := compressionHandler(innerHandler, false)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br, gzip")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("WebSocket upgrade can hijack the connection through the brotli path", func(t *testing.T) {
		// brotliResponseWriter implements http.Hijacker by delegating to the underlying
		// ResponseWriter, so WS upgrades no longer need to bypass the compression path.
		clientConn, serverConn := net.Pipe()
		defer clientConn.Close()
		defer serverConn.Close()
		hw := &hijackableResponseWriter{
			ResponseRecorder: httptest.NewRecorder(),
			conn:             serverConn,
		}

		wsUpgradeHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			hj, ok := w.(http.Hijacker)
			require.True(t, ok, "ResponseWriter passed to the handler must implement http.Hijacker")
			conn, _, err := hj.Hijack()
			require.NoError(t, err)
			assert.Same(t, serverConn, conn)
		})
		h := compressionHandler(wsUpgradeHandler, true)
		req := httptest.NewRequest(http.MethodGet, "/api/v4/websocket", nil)
		req.Header.Set("Accept-Encoding", "br")
		req.Header.Set("Upgrade", "websocket")
		req.Header.Set("Connection", "Upgrade")

		h.ServeHTTP(hw, req)

		// Close() must not write to the ResponseRecorder once the connection has
		// been hijacked — the recorder is orphaned at that point, and writing to
		// it (or to the real connection) would be incorrect.
		assert.Empty(t, hw.Body.Bytes())
		assert.Empty(t, hw.Header().Get("Content-Encoding"))
	})

	t.Run("br;q=0 is treated as declining brotli", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br;q=0, gzip")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "gzip", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Vary: Accept-Encoding is set on brotli responses", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "Accept-Encoding", resp.Header().Get("Vary"))
	})

	t.Run("204 response is not brotli-encoded and Content-Encoding is left unset", func(t *testing.T) {
		noContentHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})
		h := compressionHandler(noContentHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusNoContent, resp.Code)
		assert.Empty(t, resp.Header().Get("Content-Encoding"))
		assert.Empty(t, resp.Body.Bytes())
	})

	t.Run("small response below the min-size threshold is not compressed", func(t *testing.T) {
		smallHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, err := w.Write([]byte("tiny body"))
			require.NoError(t, err)
		})
		h := compressionHandler(smallHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Empty(t, resp.Header().Get("Content-Encoding"))
		assert.Equal(t, "tiny body", resp.Body.String())
	})

	t.Run("JPEG content type is not brotli-encoded even when large", func(t *testing.T) {
		jpegHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "image/jpeg")
			var body [2000]byte
			_, err := w.Write(body[:])
			require.NoError(t, err)
		})
		h := compressionHandler(jpegHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Empty(t, resp.Header().Get("Content-Encoding"))
		assert.Len(t, resp.Body.Bytes(), 2000)
	})

	t.Run("no encoding when no Accept-Encoding header and compression enabled", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("response larger than minSize is split across multiple Write calls and still decodes correctly", func(t *testing.T) {
		// Exercises the streaming path: the handler writes in chunks straddling
		// the minSize threshold, so some bytes go through the buffer-then-decide
		// path and some go directly through the already-initialized brotli writer.
		multiWriteHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			chunk := make([]byte, 512)
			for range 5 {
				_, err := w.Write(chunk)
				require.NoError(t, err)
			}
		})
		h := compressionHandler(multiWriteHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "br", resp.Header().Get("Content-Encoding"))
		decompressed, err := brrr.Decompress(resp.Body.Bytes())
		require.NoError(t, err)
		assert.Len(t, decompressed, 512*5)
	})

	t.Run("Flush before minSize is reached starts compression and sends buffered data", func(t *testing.T) {
		flushingHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, err := w.Write([]byte("small but flushed"))
			require.NoError(t, err)
			w.(http.Flusher).Flush()
		})
		h := compressionHandler(flushingHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "br", resp.Header().Get("Content-Encoding"))
		decompressed, err := brrr.Decompress(resp.Body.Bytes())
		require.NoError(t, err)
		assert.Equal(t, "small but flushed", string(decompressed))
	})

	t.Run("Content-Length set by the handler is removed once compression starts", func(t *testing.T) {
		clHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			var body [1400]byte
			w.Header().Set("Content-Length", "1400")
			_, err := w.Write(body[:])
			require.NoError(t, err)
		})
		h := compressionHandler(clHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "br", resp.Header().Get("Content-Encoding"))
		assert.Empty(t, resp.Header().Get("Content-Length"),
			"a Content-Length describing the uncompressed size must not survive into a compressed response")
	})

	t.Run("a handler that already set Content-Encoding is passed through unchanged", func(t *testing.T) {
		preEncodedHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			var body [1400]byte
			w.Header().Set("Content-Encoding", "identity")
			_, err := w.Write(body[:])
			require.NoError(t, err)
		})
		h := compressionHandler(preEncodedHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "identity", resp.Header().Get("Content-Encoding"),
			"must not overwrite or double-compress a response that already declared its own Content-Encoding")
		assert.Len(t, resp.Body.Bytes(), 1400)
	})

	t.Run("Content-Type is detected from the buffered body when the handler never sets it", func(t *testing.T) {
		noContentTypeHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, err := w.Write([]byte("<html><body>" + strings.Repeat("x", 1100) + "</body></html>"))
			require.NoError(t, err)
		})
		h := compressionHandler(noContentTypeHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "br", resp.Header().Get("Content-Encoding"))
		assert.Contains(t, resp.Header().Get("Content-Type"), "text/html",
			"Content-Type must be sniffed from the plain buffered bytes before compression starts")
	})

	t.Run("explicitly empty Content-Type is preserved and not overwritten by sniffing", func(t *testing.T) {
		emptyContentTypeHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "")
			_, err := w.Write([]byte(strings.Repeat("x", 1100)))
			require.NoError(t, err)
		})
		h := compressionHandler(emptyContentTypeHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "", resp.Header().Get("Content-Type"),
			"a handler-set empty Content-Type must not be overwritten by sniffing")
	})
}
