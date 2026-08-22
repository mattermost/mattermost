// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bufio"
	"bytes"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/klauspost/compress/gzhttp"
	brrr "github.com/molecule-man/go-brrr"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/web"
)

// brotliCompressionLevel is chosen for its cost/benefit ratio: benchmarked across
// response sizes from a few hundred bytes to tens of megabytes, it consistently beats
// gzip's default level on ratio and speed while keeping memory use close to (small/medium
// responses) or a bounded multiple of (large responses) gzip's own footprint. Higher
// levels buy only marginal ratio gains for a steep rise in memory and CPU cost.
const brotliCompressionLevel = 2

// brotliMinSize reuses gzhttp's own minimum-size threshold so both compression
// paths in compressionHandler apply the same "is this worth compressing" policy.
const brotliMinSize = gzhttp.DefaultMinSize

// brotliBufferedWriter captures the response body into a buffer so we can
// set headers before writing compressed output.
type brotliBufferedWriter struct {
	http.ResponseWriter
	buf      bytes.Buffer
	code     int
	hijacked bool
}

func newBrotliBufferedWriter(w http.ResponseWriter) *brotliBufferedWriter {
	return &brotliBufferedWriter{ResponseWriter: w, code: http.StatusOK}
}

func (b *brotliBufferedWriter) WriteHeader(code int)        { b.code = code }
func (b *brotliBufferedWriter) Write(p []byte) (int, error) { return b.buf.Write(p) }

// Flush implements http.Flusher by delegating to the underlying ResponseWriter
// if it supports it, so long-lived/streamed responses aren't held hostage
// until ServeHTTP fully returns, matching gzhttp.GzipResponseWriter's Flush.
func (b *brotliBufferedWriter) Flush() {
	if f, ok := b.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Hijack implements http.Hijacker by delegating to the underlying ResponseWriter,
// the same pattern gzhttp.GzipResponseWriter uses — without it, WebSocket upgrades
// routed through this writer would fail to take over the connection. Once hijacked,
// flush must not write to the now-hijacked connection.
func (b *brotliBufferedWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hj, ok := b.ResponseWriter.(http.Hijacker); ok {
		conn, rw, err := hj.Hijack()
		if err == nil {
			b.hijacked = true
		}
		return conn, rw, err
	}
	return nil, nil, fmt.Errorf("http.Hijacker interface is not supported")
}

// bodyAllowedForStatus reports whether a given response status code permits a
// body, mirroring gzhttp's own helper of the same name (RFC 7230, section 3.3).
func bodyAllowedForStatus(status int) bool {
	switch {
	case status >= 100 && status <= 199:
		return false
	case status == http.StatusNoContent:
		return false
	case status == http.StatusNotModified:
		return false
	}
	return true
}

// brotliContentTypeAllowed mirrors gzhttp.DefaultContentTypeFilter: content
// that's already compressed (video, audio, most images) gains nothing from
// brotli and isn't worth buffering entirely into memory, e.g. for the file,
// thumbnail, and preview download handlers.
func brotliContentTypeAllowed(contentType string) bool {
	return gzhttp.DefaultContentTypeFilter(contentType)
}

func (b *brotliBufferedWriter) flush() {
	if b.hijacked {
		return
	}

	h := b.ResponseWriter.Header()
	h.Add("Vary", "Accept-Encoding")

	if !bodyAllowedForStatus(b.code) || b.buf.Len() < brotliMinSize || !brotliContentTypeAllowed(h.Get("Content-Type")) {
		b.ResponseWriter.WriteHeader(b.code)
		if b.buf.Len() > 0 {
			if _, err := b.ResponseWriter.Write(b.buf.Bytes()); err != nil {
				mlog.Warn("Failed to write uncompressed response", mlog.Err(err))
			}
		}
		return
	}

	h.Set("Content-Encoding", "br")
	h.Del("Content-Length")
	h.Set("X-Uncompressed-Content-Length", strconv.Itoa(b.buf.Len()))
	b.ResponseWriter.WriteHeader(b.code)
	bw, err := brrr.NewWriter(b.ResponseWriter, brotliCompressionLevel)
	if err != nil {
		mlog.Warn("Failed to create brotli writer", mlog.Err(err))
		return
	}
	if _, err := bw.Write(b.buf.Bytes()); err != nil {
		mlog.Warn("Failed to write brotli response", mlog.Err(err))
	}
	if err := bw.Close(); err != nil {
		mlog.Warn("Failed to close brotli writer", mlog.Err(err))
	}
}

// acceptsBrotli reports whether the client's Accept-Encoding header accepts
// the "br" coding, honoring q-values (e.g. "br;q=0" means "not accepted")
// rather than doing a naive substring match.
func acceptsBrotli(r *http.Request) bool {
	header := r.Header.Get("Accept-Encoding")
	for token := range strings.SplitSeq(header, ",") {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		coding, params, _ := strings.Cut(token, ";")
		coding = strings.TrimSpace(coding)
		if !strings.EqualFold(coding, "br") {
			continue
		}
		if params == "" {
			return true
		}
		return acceptEncodingQAllowsCompression(params)
	}
	return false
}

// acceptEncodingQAllowsCompression parses the ";q=..." parameter portion of an
// Accept-Encoding token and reports whether it permits use of that coding
// (i.e. is absent, unparsable, or a non-zero quality value).
func acceptEncodingQAllowsCompression(params string) bool {
	for param := range strings.SplitSeq(params, ";") {
		name, value, found := strings.Cut(param, "=")
		if !found || !strings.EqualFold(strings.TrimSpace(name), "q") {
			continue
		}
		q, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return true
		}
		return q > 0
	}
	return true
}

// compressionHandler wraps h to prefer Brotli when the client supports it,
// falling back to gzip, and passing through uncompressed otherwise.
func compressionHandler(h http.Handler, useCompression bool) http.Handler {
	gzipWrapped := h
	if useCompression {
		gzipWrapped = gzhttp.GzipHandler(h)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if useCompression && acceptsBrotli(r) {
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
