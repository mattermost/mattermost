// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"net/http"
	"strconv"
	"strings"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/gzhttp"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

// brotliBufferedWriter captures the response body into a buffer so we can
// set headers before writing compressed output.
type brotliBufferedWriter struct {
	http.ResponseWriter
	buf  bytes.Buffer
	code int
}

func newBrotliBufferedWriter(w http.ResponseWriter) *brotliBufferedWriter {
	return &brotliBufferedWriter{ResponseWriter: w, code: http.StatusOK}
}

func (b *brotliBufferedWriter) WriteHeader(code int)        { b.code = code }
func (b *brotliBufferedWriter) Write(p []byte) (int, error) { return b.buf.Write(p) }

func (b *brotliBufferedWriter) flush() {
	h := b.ResponseWriter.Header()
	h.Set("Content-Encoding", "br")
	h.Del("Content-Length")
	if n := b.buf.Len(); n > 0 {
		h.Set("X-Uncompressed-Content-Length", strconv.Itoa(n))
	}
	b.ResponseWriter.WriteHeader(b.code)
	bw := brotli.NewWriterLevel(b.ResponseWriter, brotli.DefaultCompression)
	_, _ = bw.Write(b.buf.Bytes())
	_ = bw.Close()
}

// compressionHandler wraps h to prefer Brotli when the client supports it,
// falling back to gzip, and passing through uncompressed otherwise.
func compressionHandler(h http.Handler, useCompression bool) http.Handler {
	gzipWrapped := h
	if useCompression {
		gzipWrapped = gzhttp.GzipHandler(h)
	}
	isWebSocketUpgrade := func(r *http.Request) bool {
		return strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
	}
	acceptsBrotli := func(r *http.Request) bool {
		return strings.Contains(r.Header.Get("Accept-Encoding"), "br")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// brotliBufferedWriter embeds http.ResponseWriter as an interface, so Hijack()
		// is not promoted — WebSocket upgrades must bypass it. gzhttp.GzipHandler
		// already handles this internally for gzip.
		if useCompression && acceptsBrotli(r) && !isWebSocketUpgrade(r) {
			bbw := newBrotliBufferedWriter(w)
			h.ServeHTTP(bbw, r)
			bbw.flush()
			return
		}
		gzipWrapped.ServeHTTP(w, r)
	})
}

type Context = web.Context

type handlerFunc func(*Context, http.ResponseWriter, *http.Request)

type APIHandlerOption string

const (
	handlerParamFileAPI = APIHandlerOption("fileAPI")
)

// APIHandler provides a handler for API endpoints which do not require the user to be logged in order for access to be
// granted.
func (api *API) APIHandler(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// APISessionRequired provides a handler for API endpoints which require the user to be logged in in order for access to
// be granted.
func (api *API) APISessionRequired(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     true,
		IsStatic:       false,
		IsLocal:        false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// CloudAPIKeyRequired provides a handler for webhook endpoints to access Cloud installations from CWS
func (api *API) CloudAPIKeyRequired(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:             api.srv,
		HandleFunc:      h,
		HandlerName:     web.GetHandlerName(h),
		RequireSession:  false,
		RequireCloudKey: true,
		TrustRequester:  false,
		RequireMfa:      false,
		IsStatic:        false,
		IsLocal:         false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// RemoteClusterTokenRequired provides a handler for remote cluster requests to /remotecluster endpoints.
func (api *API) RemoteClusterTokenRequired(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:                       api.srv,
		HandleFunc:                h,
		HandlerName:               web.GetHandlerName(h),
		RequireSession:            false,
		RequireCloudKey:           false,
		RequireRemoteClusterToken: true,
		TrustRequester:            false,
		RequireMfa:                false,
		IsStatic:                  false,
		IsLocal:                   false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// APISessionRequiredMfa provides a handler for API endpoints which require a logged-in user session  but when accessed,
// if MFA is enabled, the MFA process is not yet complete, and therefore the requirement to have completed the MFA
// authentication must be waived.
func (api *API) APISessionRequiredMfa(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// APIHandlerTrustRequester provides a handler for API endpoints which do not require the user to be logged in and are
// allowed to be requested directly rather than via javascript/XMLHttpRequest, such as site branding images or the
// websocket.
func (api *API) APIHandlerTrustRequester(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: false,
		TrustRequester: true,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// APISessionRequiredTrustRequester provides a handler for API endpoints which do require the user to be logged in and
// are allowed to be requested directly rather than via javascript/XMLHttpRequest, such as emoji or file uploads.
func (api *API) APISessionRequiredTrustRequester(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: true,
		TrustRequester: true,
		RequireMfa:     true,
		IsStatic:       false,
		IsLocal:        false,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// DisableWhenBusy provides a handler for API endpoints which should be disabled when the server is under load,
// responding with HTTP 503 (Service Unavailable).
func (api *API) APISessionRequiredDisableWhenBusy(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:             api.srv,
		HandleFunc:      h,
		HandlerName:     web.GetHandlerName(h),
		RequireSession:  true,
		TrustRequester:  false,
		RequireMfa:      true,
		IsStatic:        false,
		IsLocal:         false,
		DisableWhenBusy: true,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

// APILocal provides a handler for API endpoints to be used in local
// mode, this is, through a UNIX socket and without an authenticated
// session, but with one that has no user set and no permission
// restrictions
func (api *API) APILocal(h handlerFunc, opts ...APIHandlerOption) http.Handler {
	handler := &web.Handler{
		Srv:            api.srv,
		HandleFunc:     h,
		HandlerName:    web.GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        true,
	}
	setHandlerOpts(handler, opts...)

	return compressionHandler(handler, *api.srv.Config().ServiceSettings.WebserverMode == "gzip")
}

func (api *API) RateLimitedHandler(apiHandler http.Handler, settings model.RateLimitSettings) http.Handler {
	if !*api.srv.Config().RateLimitSettings.Enable {
		return apiHandler
	}

	settings.SetDefaults()

	rateLimiter, err := app.NewRateLimiter(&settings, []string{})
	if err != nil {
		api.srv.Log().Error("getRateLimitedHandler", mlog.Err(err))
		return nil
	}
	return rateLimiter.RateLimitHandler(apiHandler)
}

func requireLicense(c *Context) *model.AppError {
	if c.App.Channels().License() == nil {
		err := model.NewAppError("", "api.license_error", nil, "", http.StatusNotImplemented)
		return err
	}
	return nil
}

func setHandlerOpts(handler *web.Handler, opts ...APIHandlerOption) {
	if len(opts) == 0 {
		return
	}

	for _, option := range opts {
		switch option {
		case handlerParamFileAPI:
			handler.FileAPI = true
		}
	}
}
