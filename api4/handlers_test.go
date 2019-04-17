package api4

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func handlerForGzip(c *Context, w http.ResponseWriter, r *http.Request) {
	// gziphandler default requires body size greater than 1400 bytes
	var body [1400]byte
	w.Write(body[:])
}

func testAPIHandlerGzipMode(t *testing.T, name string, h http.Handler) {
	t.Run("Handler: "+name+" No Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		h.ServeHTTP(resp, req)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Handler: "+name+" With Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		h.ServeHTTP(resp, req)
		assert.Equal(t, "gzip", resp.Header().Get("Content-Encoding"))
	})
}

func testAPIHandlerNoGzipMode(t *testing.T, name string, h http.Handler) {
	t.Run("Handler: "+name+" No Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		h.ServeHTTP(resp, req)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})

	t.Run("Handler: "+name+" With Accept-Encoding", func(t *testing.T) {
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/api/v4/test", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		h.ServeHTTP(resp, req)
		assert.Equal(t, "", resp.Header().Get("Content-Encoding"))
	})
}

func TestAPIHandlersWithGzip(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	api := Init(th.Server, th.Server.AppOptions, th.Server.Router)

	t.Run("with WebserverMode == \"gzip\"", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "gzip" })

		testAPIHandlerGzipMode(t, "ApiHandler", api.ApiHandler(handlerForGzip))
		testAPIHandlerGzipMode(t, "ApiSessionRequired", api.ApiSessionRequired(handlerForGzip))
		testAPIHandlerGzipMode(t, "ApiSessionRequiredMfa", api.ApiSessionRequiredMfa(handlerForGzip))
		testAPIHandlerGzipMode(t, "ApiHandlerTrustRequester", api.ApiHandlerTrustRequester(handlerForGzip))
		testAPIHandlerGzipMode(t, "ApiSessionRequiredTrustRequester", api.ApiSessionRequiredTrustRequester(handlerForGzip))
	})

	// WebserverMode = "nogzip"
	t.Run("with WebserverMode == \"nogzip\"", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.WebserverMode = "nogzip" })

		testAPIHandlerNoGzipMode(t, "ApiHandler", api.ApiHandler(handlerForGzip))
		testAPIHandlerNoGzipMode(t, "ApiSessionRequired", api.ApiSessionRequired(handlerForGzip))
		testAPIHandlerNoGzipMode(t, "ApiSessionRequiredMfa", api.ApiSessionRequiredMfa(handlerForGzip))
		testAPIHandlerNoGzipMode(t, "ApiHandlerTrustRequester", api.ApiHandlerTrustRequester(handlerForGzip))
		testAPIHandlerNoGzipMode(t, "ApiSessionRequiredTrustRequester", api.ApiSessionRequiredTrustRequester(handlerForGzip))

	})
}
