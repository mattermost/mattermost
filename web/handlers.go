// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"fmt"
	"net/http"
	"reflect"
	"runtime"
	"strings"
	"time"

	"github.com/NYTimes/gziphandler"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func GetHandlerName(h func(*Context, http.ResponseWriter, *http.Request)) string {
	handlerName := runtime.FuncForPC(reflect.ValueOf(h).Pointer()).Name()
	pos := strings.LastIndex(handlerName, ".")
	if pos != -1 && len(handlerName) > pos {
		handlerName = handlerName[pos+1:]
	}
	return handlerName
}

func (w *Web) NewHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &Handler{
		GetGlobalAppOptions: w.GetGlobalAppOptions,
		HandleFunc:          h,
		HandlerName:         GetHandlerName(h),
		RequireSession:      false,
		TrustRequester:      false,
		RequireMfa:          false,
		IsStatic:            false,
	}
}

func (w *Web) NewStaticHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	// Determine the CSP SHA directive needed for subpath support, if any. This value is fixed
	// on server start and intentionally requires a restart to take effect.
	subpath, _ := utils.GetSubpathFromConfig(w.ConfigService.Config())

	return &Handler{
		GetGlobalAppOptions: w.GetGlobalAppOptions,
		HandleFunc:          h,
		HandlerName:         GetHandlerName(h),
		RequireSession:      false,
		TrustRequester:      false,
		RequireMfa:          false,
		IsStatic:            true,

		cspShaDirective: utils.GetSubpathScriptHash(subpath),
	}
}

type Handler struct {
	GetGlobalAppOptions app.AppOptionCreator
	HandleFunc          func(*Context, http.ResponseWriter, *http.Request)
	HandlerName         string
	RequireSession      bool
	TrustRequester      bool
	RequireMfa          bool
	IsStatic            bool
	DisableWhenBusy     bool

	cspShaDirective string
}

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	now := time.Now()

	requestID := model.NewId()
	mlog.Debug("Received HTTP request", mlog.String("method", r.Method), mlog.String("url", r.URL.Path), mlog.String("request_id", requestID))

	c := &Context{}
	c.App = app.New(
		h.GetGlobalAppOptions()...,
	)
	c.App.T, _ = utils.GetTranslationsAndLocale(w, r)
	c.App.RequestId = requestID
	c.App.IpAddress = utils.GetIpAddress(r, c.App.Config().ServiceSettings.TrustedProxyIPHeader)
	c.App.UserAgent = r.UserAgent()
	c.App.AcceptLanguage = r.Header.Get("Accept-Language")
	c.Params = ParamsFromRequest(r)
	c.App.Path = r.URL.Path
	c.Log = c.App.Log

	// Set the max request body size to be equal to MaxFileSize.
	// Ideally, non-file request bodies should be smaller than file request bodies,
	// but we don't have a clean way to identify all file upload handlers.
	// So to keep it simple, we clamp it to the max file size.
	// We add a buffer of bytes.MinRead so that file sizes close to max file size
	// do not get cut off.
	r.Body = http.MaxBytesReader(w, r.Body, *c.App.Config().FileSettings.MaxFileSize+bytes.MinRead)

	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())
	siteURLHeader := app.GetProtocol(r) + "://" + r.Host + subpath
	c.SetSiteURLHeader(siteURLHeader)

	w.Header().Set(model.HEADER_REQUEST_ID, c.App.RequestId)
	w.Header().Set(model.HEADER_VERSION_ID, fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.BuildNumber, c.App.ClientConfigHash(), c.App.License() != nil))

	if *c.App.Config().ServiceSettings.TLSStrictTransport {
		w.Header().Set("Strict-Transport-Security", fmt.Sprintf("max-age=%d", *c.App.Config().ServiceSettings.TLSStrictTransportMaxAge))
	}

	if h.IsStatic {
		// Instruct the browser not to display us in an iframe unless is the same origin for anti-clickjacking
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		// Set content security policy. This is also specified in the root.html of the webapp in a meta tag.
		w.Header().Set("Content-Security-Policy", fmt.Sprintf(
			"frame-ancestors 'self'; script-src 'self' cdn.segment.com/analytics.js/%s",
			h.cspShaDirective,
		))
	} else {
		// All api response bodies will be JSON formatted by default
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "GET" {
			w.Header().Set("Expires", "0")
		}
	}

	token, tokenLocation := app.ParseAuthTokenFromRequest(r)

	if len(token) != 0 {
		session, err := c.App.GetSession(token)
		if err != nil {
			c.Log.Info("Invalid session", mlog.Err(err))
			if err.StatusCode == http.StatusInternalServerError {
				c.Err = err
			} else if h.RequireSession {
				c.RemoveSessionCookie(w, r)
				c.Err = model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
			}
		} else if !session.IsOAuth && tokenLocation == app.TokenLocationQueryString {
			c.Err = model.NewAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token, http.StatusUnauthorized)
		} else {
			c.App.Session = *session
		}

		// Rate limit by UserID
		if c.App.Srv.RateLimiter != nil && c.App.Srv.RateLimiter.UserIdRateLimit(c.App.Session.UserId, w) {
			return
		}

		h.checkCSRFToken(c, r, token, tokenLocation, session)
	}

	c.Log = c.App.Log.With(
		mlog.String("path", c.App.Path),
		mlog.String("request_id", c.App.RequestId),
		mlog.String("ip_addr", c.App.IpAddress),
		mlog.String("user_id", c.App.Session.UserId),
		mlog.String("method", r.Method),
	)

	if c.Err == nil && h.RequireSession {
		c.SessionRequired()
	}

	if c.Err == nil && h.RequireMfa {
		c.MfaRequired()
	}

	if c.Err == nil && h.DisableWhenBusy && c.App.Srv.Busy.IsBusy() {
		c.SetServerBusyError()
	}

	if c.Err == nil {
		h.HandleFunc(c, w, r)
	}

	// Handle errors that have occurred
	if c.Err != nil {
		c.Err.Translate(c.App.T)
		c.Err.RequestId = c.App.RequestId

		if c.Err.Id == "api.context.session_expired.app_error" {
			c.LogInfo(c.Err)
		} else {
			c.LogError(c.Err)
		}

		c.Err.Where = r.URL.Path

		// Block out detailed error when not in developer mode
		if !*c.App.Config().ServiceSettings.EnableDeveloper {
			c.Err.DetailedError = ""
		}

		// Sanitize all 5xx error messages in hardened mode
		if *c.App.Config().ServiceSettings.ExperimentalEnableHardenedMode && c.Err.StatusCode >= 500 {
			c.Err.Id = ""
			c.Err.Message = "Internal Server Error"
			c.Err.DetailedError = ""
			c.Err.StatusCode = 500
			c.Err.Where = ""
			c.Err.IsOAuth = false
		}

		if IsApiCall(c.App, r) || IsWebhookCall(c.App, r) || IsOAuthApiCall(c.App, r) || len(r.Header.Get("X-Mobile-App")) > 0 {
			w.WriteHeader(c.Err.StatusCode)
			w.Write([]byte(c.Err.ToJson()))
		} else {
			utils.RenderWebAppError(c.App.Config(), w, r, c.Err, c.App.AsymmetricSigningKey())
		}

		if c.App.Metrics != nil {
			c.App.Metrics.IncrementHttpError()
		}
	}

	if c.App.Metrics != nil {
		c.App.Metrics.IncrementHttpRequest()

		if r.URL.Path != model.API_URL_SUFFIX+"/websocket" {
			elapsed := float64(time.Since(now)) / float64(time.Second)
			c.App.Metrics.ObserveHttpRequestDuration(elapsed)
			c.App.Metrics.ObserveApiEndpointDuration(h.HandlerName, r.Method, elapsed)
		}
	}
}

// checkCSRFToken performs a CSRF check on the provided request with the given CSRF token. Returns whether or not
// a CSRF check occurred and whether or not it succeeded.
func (h *Handler) checkCSRFToken(c *Context, r *http.Request, token string, tokenLocation app.TokenLocation, session *model.Session) (checked bool, passed bool) {
	csrfCheckNeeded := session != nil && c.Err == nil && tokenLocation == app.TokenLocationCookie && !h.TrustRequester && r.Method != "GET"
	csrfCheckPassed := false

	if csrfCheckNeeded {
		csrfHeader := r.Header.Get(model.HEADER_CSRF_TOKEN)

		if csrfHeader == session.GetCSRF() {
			csrfCheckPassed = true
		} else if r.Header.Get(model.HEADER_REQUESTED_WITH) == model.HEADER_REQUESTED_WITH_XML {
			// ToDo(DSchalla) 2019/01/04: Remove after deprecation period and only allow CSRF Header (MM-13657)
			csrfErrorMessage := "CSRF Header check failed for request - Please upgrade your web application or custom app to set a CSRF Header"

			sid := ""
			userId := ""

			if session != nil {
				sid = session.Id
				userId = session.UserId
			}

			fields := []mlog.Field{
				mlog.String("path", r.URL.Path),
				mlog.String("ip", r.RemoteAddr),
				mlog.String("session_id", sid),
				mlog.String("user_id", userId),
			}

			if *c.App.Config().ServiceSettings.ExperimentalStrictCSRFEnforcement {
				c.Log.Warn(csrfErrorMessage, fields...)
			} else {
				c.Log.Debug(csrfErrorMessage, fields...)
				csrfCheckPassed = true
			}
		}

		if !csrfCheckPassed {
			c.App.Session = model.Session{}
			c.Err = model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to be a CSRF attempt", http.StatusUnauthorized)
		}
	}

	return csrfCheckNeeded, csrfCheckPassed
}

// ApiHandler provides a handler for API endpoints which do not require the user to be logged in order for access to be
// granted.
func (w *Web) ApiHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	handler := &Handler{
		GetGlobalAppOptions: w.GetGlobalAppOptions,
		HandleFunc:          h,
		HandlerName:         GetHandlerName(h),
		RequireSession:      false,
		TrustRequester:      false,
		RequireMfa:          false,
		IsStatic:            false,
	}
	if *w.ConfigService.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler
}

// ApiHandlerTrustRequester provides a handler for API endpoints which do not require the user to be logged in and are
// allowed to be requested directly rather than via javascript/XMLHttpRequest, such as site branding images or the
// websocket.
func (w *Web) ApiHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	handler := &Handler{
		GetGlobalAppOptions: w.GetGlobalAppOptions,
		HandleFunc:          h,
		HandlerName:         GetHandlerName(h),
		RequireSession:      false,
		TrustRequester:      true,
		RequireMfa:          false,
		IsStatic:            false,
	}
	if *w.ConfigService.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler
}

// ApiSessionRequired provides a handler for API endpoints which require the user to be logged in in order for access to
// be granted.
func (w *Web) ApiSessionRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	handler := &Handler{
		GetGlobalAppOptions: w.GetGlobalAppOptions,
		HandleFunc:          h,
		HandlerName:         GetHandlerName(h),
		RequireSession:      true,
		TrustRequester:      false,
		RequireMfa:          true,
		IsStatic:            false,
	}
	if *w.ConfigService.Config().ServiceSettings.WebserverMode == "gzip" {
		return gziphandler.GzipHandler(handler)
	}
	return handler
}
