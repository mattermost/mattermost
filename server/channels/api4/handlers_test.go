// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andybalholm/brotli"
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
		r := brotli.NewReader(resp.Body)
		decompressed, err := io.ReadAll(r)
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

	t.Run("WebSocket upgrade bypasses brotli even when client accepts br", func(t *testing.T) {
		// compressionHandler must not wrap WS upgrades in brotliBufferedWriter because
		// that writer does not implement http.Hijacker, which the WS library requires.
		wsUpgradeHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			// Verify we can still call WriteHeader without panic — the brotliBufferedWriter
			// path must have been bypassed, so the real ResponseWriter is used here.
			w.WriteHeader(http.StatusSwitchingProtocols)
		})
		h := compressionHandler(wsUpgradeHandler, true)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v4/websocket", nil)
		req.Header.Set("Accept-Encoding", "br")
		req.Header.Set("Upgrade", "websocket")
		req.Header.Set("Connection", "Upgrade")

		h.ServeHTTP(resp, req)

		// The response must NOT be brotli-encoded — brotliBufferedWriter was bypassed.
		assert.NotEqual(t, "br", resp.Header().Get("Content-Encoding"))
		assert.Equal(t, http.StatusSwitchingProtocols, resp.Code)
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
