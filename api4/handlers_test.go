// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func handlerForGzip(c *Context, w http.ResponseWriter, r *http.Request) {
	// gziphandler default requires body size greater than 1400 bytes
	var body [1400]byte
	w.Write(body[:])
}

func testAPIHandlerGzipMode(t *testing.T, name string, h http.Handler, token string) {
	t.Run("Handler: "+name+" No Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set(model.HEADER_AUTH, "Bearer "+token)
		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Handler: "+name+" With Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set(model.HEADER_AUTH, "Bearer "+token)

		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "gzip", resp.Header().Get("Content-Encoding"))
	})
}

func testAPIHandlerNoGzipMode(t *testing.T, name string, h http.Handler, token string) {
	t.Run("Handler: "+name+" No Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set(model.HEADER_AUTH, "Bearer "+token)

		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Handler: "+name+" With Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set(model.HEADER_AUTH, "Bearer "+token)

		h.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusOK, resp.Code)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})
}

func TestAPIHandlersWithGzip(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	api := Init(th.Server, th.Server.AppOptions, th.Server.Router)
	session, _ := th.App.GetSession(th.Client.AuthToken)

	t.Run("with WebserverMode == \"gzip\"", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "gzip" })

		testAPIHandlerGzipMode(t, "ApiHandler", api.ApiHandler(handlerForGzip), "")
		testAPIHandlerGzipMode(t, "ApiSessionRequired", api.ApiSessionRequired(handlerForGzip), session.Token)
		testAPIHandlerGzipMode(t, "ApiSessionRequiredMfa", api.ApiSessionRequiredMfa(handlerForGzip), session.Token)
		testAPIHandlerGzipMode(t, "ApiHandlerTrustRequester", api.ApiHandlerTrustRequester(handlerForGzip), "")
		testAPIHandlerGzipMode(t, "ApiSessionRequiredTrustRequester", api.ApiSessionRequiredTrustRequester(handlerForGzip), session.Token)
	})

	t.Run("with WebserverMode == \"nogzip\"", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "nogzip" })

		testAPIHandlerNoGzipMode(t, "ApiHandler", api.ApiHandler(handlerForGzip), "")
		testAPIHandlerNoGzipMode(t, "ApiSessionRequired", api.ApiSessionRequired(handlerForGzip), session.Token)
		testAPIHandlerNoGzipMode(t, "ApiSessionRequiredMfa", api.ApiSessionRequiredMfa(handlerForGzip), session.Token)
		testAPIHandlerNoGzipMode(t, "ApiHandlerTrustRequester", api.ApiHandlerTrustRequester(handlerForGzip), "")
		testAPIHandlerNoGzipMode(t, "ApiSessionRequiredTrustRequester", api.ApiSessionRequiredTrustRequester(handlerForGzip), session.Token)
	})
}
