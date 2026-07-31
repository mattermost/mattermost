// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	brrr "github.com/molecule-man/go-brrr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func handlerForGzip(t *testing.T) func(*Context, http.ResponseWriter, *http.Request) {
	return func(_ *Context, w http.ResponseWriter, _ *http.Request) {
		// gziphandler default requires body size greater than 1400 bytes
		var body [1400]byte
		_, err := w.Write(body[:])
		require.NoError(t, err)
	}
}

func testAPIHandlerGzipMode(t *testing.T, name string, h http.Handler, token string) {
	t.Run("Handler: "+name+" No Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set(model.HeaderAuth, "Bearer "+token)
		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Handler: "+name+" With Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set(model.HeaderAuth, "Bearer "+token)

		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "gzip", resp.Header().Get("Content-Encoding"))
	})
}

func testAPIHandlerNoGzipMode(t *testing.T, name string, h http.Handler, token string) {
	t.Run("Handler: "+name+" No Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set(model.HeaderAuth, "Bearer "+token)

		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Handler: "+name+" With Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set(model.HeaderAuth, "Bearer "+token)

		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})
}

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
		// brotliBufferedWriter implements http.Hijacker by delegating to the underlying
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
	})

	t.Run("no encoding when no Accept-Encoding header and compression enabled", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)

		h.ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("brotli response sets X-Uncompressed-Content-Length header", func(t *testing.T) {
		h := compressionHandler(innerHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "br")

		h.ServeHTTP(resp, req)

		assert.Equal(t, "br", resp.Header().Get("Content-Encoding"))
		assert.Equal(t, "1400", resp.Header().Get("X-Uncompressed-Content-Length"))
	})
}

func TestAPIHandlersWithGzip(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	api, err := Init(th.Server)
	require.NoError(t, err)
	session, _ := th.App.GetSession(th.Client.AuthToken)

	t.Run("with WebserverMode == \"gzip\"", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "gzip" })

		testAPIHandlerGzipMode(t, "ApiHandler", api.APIHandler(handlerForGzip(t)), "")
		testAPIHandlerGzipMode(t, "ApiSessionRequired", api.APISessionRequired(handlerForGzip(t)), session.Token)
		testAPIHandlerGzipMode(t, "ApiSessionRequiredMfa", api.APISessionRequiredMfa(handlerForGzip(t)), session.Token)
		testAPIHandlerGzipMode(t, "ApiHandlerTrustRequester", api.APIHandlerTrustRequester(handlerForGzip(t)), "")
		testAPIHandlerGzipMode(t, "ApiSessionRequiredTrustRequester", api.APISessionRequiredTrustRequester(handlerForGzip(t)), session.Token)
	})

	t.Run("with WebserverMode == \"nogzip\"", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "nogzip" })

		testAPIHandlerNoGzipMode(t, "ApiHandler", api.APIHandler(handlerForGzip(t)), "")
		testAPIHandlerNoGzipMode(t, "ApiSessionRequired", api.APISessionRequired(handlerForGzip(t)), session.Token)
		testAPIHandlerNoGzipMode(t, "ApiSessionRequiredMfa", api.APISessionRequiredMfa(handlerForGzip(t)), session.Token)
		testAPIHandlerNoGzipMode(t, "ApiHandlerTrustRequester", api.APIHandlerTrustRequester(handlerForGzip(t)), "")
		testAPIHandlerNoGzipMode(t, "ApiSessionRequiredTrustRequester", api.APISessionRequiredTrustRequester(handlerForGzip(t)), session.Token)
	})

	t.Run("with WebserverMode == \"gzip\" and Accept-Encoding: br", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "gzip" })

		for _, tc := range []struct {
			name    string
			handler http.Handler
		}{
			{"ApiHandler", api.APIHandler(handlerForBrotli(t))},
			{"ApiSessionRequired", api.APISessionRequired(handlerForBrotli(t))},
			{"ApiSessionRequiredMfa", api.APISessionRequiredMfa(handlerForBrotli(t))},
			{"ApiHandlerTrustRequester", api.APIHandlerTrustRequester(handlerForBrotli(t))},
			{"ApiSessionRequiredTrustRequester", api.APISessionRequiredTrustRequester(handlerForBrotli(t))},
		} {
			t.Run(tc.name, func(t *testing.T) {
				resp := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
				req.Header.Set("Accept-Encoding", "br, gzip")
				if tc.name != "ApiHandler" && tc.name != "ApiHandlerTrustRequester" {
					req.Header.Set(model.HeaderAuth, "Bearer "+session.Token)
				}
				tc.handler.ServeHTTP(resp, req)
				assert.Equal(t, http.StatusOK, resp.Code)
				assert.Equal(t, "br", resp.Header().Get("Content-Encoding"), "handler %s should use brotli", tc.name)
			})
		}
	})
}
