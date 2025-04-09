// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/klauspost/compress/gzhttp"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
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
		Srv:            w.srv,
		HandleFunc:     h,
		HandlerName:    GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
}

func (w *Web) NewStaticHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	// Determine the CSP SHA directive needed for subpath support, if any. This value is fixed
	// on server start and intentionally requires a restart to take effect.
	subpath, _ := utils.GetSubpathFromConfig(w.srv.Config())

	return &Handler{
		Srv:            w.srv,
		HandleFunc:     h,
		HandlerName:    GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       true,

		cspShaDirective: utils.GetSubpathScriptHash(subpath),
	}
}

type Handler struct {
	Srv                       *app.Server
	HandleFunc                func(*Context, http.ResponseWriter, *http.Request)
	HandlerName               string
	RequireSession            bool
	RequireCloudKey           bool
	RequireRemoteClusterToken bool
	TrustRequester            bool
	RequireMfa                bool
	IsStatic                  bool
	IsLocal                   bool
	DisableWhenBusy           bool
	FileAPI                   bool

	cspShaDirective string
}

func generateDevCSP(c Context) string {
	var devCSP []string

	// Add unsafe-eval to the content security policy for faster source maps in development mode
	if model.BuildNumber == "dev" {
		devCSP = append(devCSP, "'unsafe-eval'")
	}

	// Add unsafe-inline to unlock extensions like React & Redux DevTools in Firefox
	// see https://github.com/reduxjs/redux-devtools/issues/380
	if model.BuildNumber == "dev" {
		devCSP = append(devCSP, "'unsafe-inline'")
	}

	// Add supported flags for debugging during development, even if not on a dev build.
	if *c.App.Config().ServiceSettings.DeveloperFlags != "" {
		for _, devFlagKVStr := range strings.Split(*c.App.Config().ServiceSettings.DeveloperFlags, ",") {
			devFlagKVSplit := strings.SplitN(devFlagKVStr, "=", 2)
			if len(devFlagKVSplit) != 2 {
				c.Logger.Warn("Unable to parse developer flag", mlog.String("developer_flag", devFlagKVStr))
				continue
			}
			devFlagKey := devFlagKVSplit[0]
			devFlagValue := devFlagKVSplit[1]

			// Ignore disabled keys
			if devFlagValue != "true" {
				continue
			}

			// Honour only supported keys
			switch devFlagKey {
			case "unsafe-eval", "unsafe-inline":
				if model.BuildNumber == "dev" {
					// These flags are added automatically for dev builds
					continue
				}

				devCSP = append(devCSP, "'"+devFlagKey+"'")
			default:
				c.Logger.Warn("Unrecognized developer flag", mlog.String("developer_flag", devFlagKVStr))
			}
		}
	}

	if len(devCSP) == 0 {
		return ""
	}

	return " " + strings.Join(devCSP, " ")
}

func (h Handler) basicSecurityChecks(c *Context, w http.ResponseWriter, r *http.Request) {
	maxURLCharacters := *c.App.Config().ServiceSettings.MaximumURLLength
	if len(r.RequestURI) > maxURLCharacters {
		c.Err = model.NewAppError("basicSecurityChecks", "basic_security_check.url.too_long_error", nil, "", http.StatusRequestURITooLong)
		return
	}
}

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w = newWrappedWriter(w)
	now := time.Now()

	appInstance := app.New(app.ServerConnector(h.Srv.Channels()))

	c := &Context{
		AppContext: &request.Context{},
		App:        appInstance,
	}

	requestID := model.NewId()
	var rateLimitExceeded bool
	defer func() {
		responseLogFields := []mlog.Field{
			mlog.String("method", r.Method),
			mlog.String("url", r.URL.Path),
			mlog.String("request_id", requestID),
		}
		// if there is a session then include the user_id
		if c.AppContext.Session() != nil {
			responseLogFields = append(responseLogFields, mlog.String("user_id", c.AppContext.Session().UserId))
		}

		statusCode := strconv.Itoa(w.(*responseWriterWrapper).StatusCode())

		// Websockets are returning status code 0 to requests after closing the socket
		if statusCode != "0" {
			responseLogFields = append(responseLogFields, mlog.String("status_code", statusCode))
		}
		mlog.Debug("Received HTTP request", responseLogFields...)

		if !rateLimitExceeded {
			h.recordMetrics(c, r, now, statusCode)
		}
	}()

	t, _ := i18n.GetTranslationsAndLocaleFromRequest(r)
	c.AppContext = request.NewContext(
		context.Background(),
		requestID,
		utils.GetIPAddress(r, c.App.Config().ServiceSettings.TrustedProxyIPHeader),
		r.Header.Get("X-Forwarded-For"),
		r.URL.Path,
		r.UserAgent(),
		r.Header.Get("Accept-Language"),
		t,
	)

	c.Params = ParamsFromRequest(r)
	c.Logger = c.App.Log()

	h.basicSecurityChecks(c, w, r)
	if c.Err != nil {
		h.handleContextError(c, w, r)
		return
	}

	var maxBytes int64
	if h.FileAPI {
		// We add a buffer of bytes.MinRead so that file sizes close to max file size
		// do not get cut off.
		maxBytes = *c.App.Config().FileSettings.MaxFileSize + bytes.MinRead
	} else {
		maxBytes = *c.App.Config().ServiceSettings.MaximumPayloadSizeBytes + bytes.MinRead
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())
	siteURLHeader := app.GetProtocol(r) + "://" + r.Host + subpath
	if c.App.Channels().License().IsCloud() {
		siteURLHeader = *c.App.Config().ServiceSettings.SiteURL + subpath
	}
	c.SetSiteURLHeader(siteURLHeader)

	w.Header().Set(model.HeaderRequestId, c.AppContext.RequestId())
	w.Header().Set(model.HeaderVersionId, fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.BuildNumber, c.App.ClientConfigHash(), c.App.Channels().License() != nil))

	if *c.App.Config().ServiceSettings.TLSStrictTransport {
		w.Header().Set("Strict-Transport-Security", fmt.Sprintf("max-age=%d", *c.App.Config().ServiceSettings.TLSStrictTransportMaxAge))
	}

	// Hardcoded sensible default values for these security headers. Feel free to override in proxy or ingress
	w.Header().Set("Permissions-Policy", "")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")

	if h.IsStatic {
		// Instruct the browser not to display us in an iframe unless is the same origin for anti-clickjacking
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")

		devCSP := generateDevCSP(*c)

		// Set content security policy. This is also specified in the root.html of the webapp in a meta tag.
		w.Header().Set("Content-Security-Policy", fmt.Sprintf(
			"frame-ancestors 'self' %s; script-src 'self' cdn.rudderlabs.com%s%s",
			*c.App.Config().ServiceSettings.FrameAncestors,
			h.cspShaDirective,
			devCSP,
		))
	} else {
		// All api response bodies will be JSON formatted by default
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "GET" {
			w.Header().Set("Expires", "0")
		}
	}

	token, tokenLocation := app.ParseAuthTokenFromRequest(r)

	if token != "" && tokenLocation != app.TokenLocationCloudHeader && tokenLocation != app.TokenLocationRemoteClusterHeader {
		session, err := c.App.GetSession(token)

		if err != nil {
			c.Logger.Info("Invalid session", mlog.Err(err))
			if err.StatusCode == http.StatusInternalServerError {
				c.Err = err
			} else if h.RequireSession {
				c.RemoveSessionCookie(w, r)
				c.Err = model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
			}
		} else if !session.IsOAuth && tokenLocation == app.TokenLocationQueryString {
			c.Err = model.NewAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token, http.StatusUnauthorized)
		} else {
			c.AppContext = c.AppContext.WithSession(session)
		}

		// Rate limit by UserID
		if c.App.Srv().RateLimiter != nil {
			rateLimitExceeded = c.App.Srv().RateLimiter.UserIdRateLimit(c.AppContext.Session().UserId, w)
			if rateLimitExceeded {
				return
			}
		}

		h.checkCSRFToken(c, r, token, tokenLocation, session)
	} else if token != "" && c.App.Channels().License().IsCloud() && tokenLocation == app.TokenLocationCloudHeader {
		// Check to see if this provided token matches our CWS Token
		session, err := c.App.GetCloudSession(token)
		if err != nil {
			c.Logger.Warn("Invalid CWS token", mlog.Err(err))
			c.Err = err
		} else {
			c.AppContext = c.AppContext.WithSession(session)
		}
	} else if token != "" && c.App.Channels().License() != nil && c.App.Channels().License().HasRemoteClusterService() && tokenLocation == app.TokenLocationRemoteClusterHeader {
		// Get the remote cluster
		if remoteId := c.GetRemoteID(r); remoteId == "" {
			c.Logger.Warn("Missing remote cluster id") //
			c.Err = model.NewAppError("ServeHTTP", "api.context.remote_id_missing.app_error", nil, "", http.StatusUnauthorized)
		} else {
			// Check the token is correct for the remote cluster id.
			session, err := c.App.GetRemoteClusterSession(token, remoteId)
			if err != nil {
				c.Logger.Warn("Invalid remote cluster token", mlog.Err(err))
				c.Err = err
			} else {
				c.AppContext = c.AppContext.WithSession(session)
			}
		}
	}

	c.Logger = c.App.Log().With(
		mlog.String("path", c.AppContext.Path()),
		mlog.String("request_id", c.AppContext.RequestId()),
		mlog.String("ip_addr", c.AppContext.IPAddress()),
		mlog.String("user_id", c.AppContext.Session().UserId),
		mlog.String("method", r.Method),
	)
	c.AppContext = c.AppContext.WithLogger(c.Logger)

	if c.Err == nil && h.RequireSession {
		c.SessionRequired()
	}

	if c.Err == nil && h.RequireMfa {
		c.MfaRequired()
	}

	if c.Err == nil && h.DisableWhenBusy && c.App.Srv().Platform().Busy.IsBusy() {
		c.SetServerBusyError()
	}

	if c.Err == nil && h.RequireCloudKey {
		c.CloudKeyRequired()
	}

	if c.Err == nil && h.RequireRemoteClusterToken {
		c.RemoteClusterTokenRequired()
	}

	if c.Err == nil && h.IsLocal {
		// if the connection is local, RemoteAddr shouldn't have the
		// shape IP:PORT (it will be "@" in Linux, for example)
		isLocalOrigin := !strings.Contains(r.RemoteAddr, ":")
		if *c.App.Config().ServiceSettings.EnableLocalMode && isLocalOrigin {
			c.AppContext = c.AppContext.WithSession(&model.Session{Local: true})
		} else if !isLocalOrigin {
			c.Err = model.NewAppError("", "api.context.local_origin_required.app_error", nil, "LocalOriginRequired", http.StatusUnauthorized)
		}
	}

	if c.Err == nil {
		h.HandleFunc(c, w, r)
	}

	// Handle errors that have occurred
	if c.Err != nil {
		h.handleContextError(c, w, r)
		return
	}
}

func (h Handler) recordMetrics(c *Context, r *http.Request, now time.Time, statusCode string) {
	if c.App.Metrics() != nil {
		c.App.Metrics().IncrementHTTPRequest()

		if r.URL.Path != model.APIURLSuffix+"/websocket" {
			elapsed := float64(time.Since(now)) / float64(time.Second)

			pageLoadContext := r.Header.Get("X-Page-Load-Context")
			if pageLoadContext != "page_load" && pageLoadContext != "reconnect" {
				pageLoadContext = ""
			}

			c.App.Metrics().ObserveAPIEndpointDuration(h.HandlerName, r.Method, statusCode, string(GetOriginClient(r)), pageLoadContext, elapsed)
		}
	}
}

func (h Handler) handleContextError(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err == nil {
		return
	}

	// We're handling payload limit error here because it needs to be handled globally.
	var maxBytesErr *http.MaxBytesError
	// check if error is a MaxBytesError error, which occurs when you read more bytes from buffer than configured
	if ok := errors.As(c.Err, &maxBytesErr); ok {
		// replace the context error with this error if so,
		newErr := model.NewAppError(c.Err.Where, "api.context.request_body_too_large.app_error", nil, "Use the setting `MaximumPayloadSizeBytes` in Mattermost config to configure allowed payload limit. Learn more about this setting in Mattermost docs at https://docs.mattermost.com/configure/environment-configuration-settings.html#maximum-payload-size", http.StatusRequestEntityTooLarge)
		c.Err = newErr
	}

	c.Err.RequestId = c.AppContext.RequestId()
	c.LogErrorByCode(c.Err)
	// The locale translation needs to happen after we have logged it.
	// We don't want the server logs to be translated as per user locale.
	c.Err.Translate(c.AppContext.T)

	c.Err.Where = r.URL.Path

	// Block out detailed error when not in developer mode
	if !*c.App.Config().ServiceSettings.EnableDeveloper {
		c.Err.WipeDetailed()
	}

	// Sanitize all 5xx error messages in hardened mode
	if *c.App.Config().ServiceSettings.ExperimentalEnableHardenedMode && c.Err.StatusCode >= 500 {
		c.Err.Id = ""
		c.Err.Message = "Internal Server Error"
		c.Err.WipeDetailed()
		c.Err.StatusCode = 500
		c.Err.Where = ""
	}

	if IsAPICall(c.App, r) || IsWebhookCall(c.App, r) || IsOAuthAPICall(c.App, r) || r.Header.Get("X-Mobile-App") != "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(c.Err.StatusCode)
		if _, err := w.Write([]byte(c.Err.ToJSON())); err != nil {
			c.Logger.Warn("Failed to write error response", mlog.Err(err))
		}
	} else {
		utils.RenderWebAppError(c.App.Config(), w, r, c.Err, c.App.AsymmetricSigningKey())
	}

	if c.App.Metrics() != nil {
		c.App.Metrics().IncrementHTTPError()
	}
}

type OriginClient string

const (
	OriginClientUnknown OriginClient = "unknown"
	OriginClientWeb     OriginClient = "web"
	OriginClientMobile  OriginClient = "mobile"
	OriginClientDesktop OriginClient = "desktop"
)

// GetOriginClient returns the device from which the provided request was issued. The algorithm roughly looks like:
// - If the URL contains the query mobilev2=true, then it's mobile
// - If the first field of the user agent starts with either "rnbeta" or "Mattermost", then it's mobile
// - If the last field of the user agent starts with "Mattermost", then it's desktop
// - Otherwise, it's web
func GetOriginClient(r *http.Request) OriginClient {
	userAgent := r.Header.Get("User-Agent")
	fields := strings.Fields(userAgent)
	if len(fields) < 1 {
		return OriginClientUnknown
	}

	// Is mobile post v2?
	queryParam := r.URL.Query().Get("mobilev2")
	if queryParam == "true" {
		return OriginClientMobile
	}

	// Is mobile pre v2?
	clientAgent := fields[0]
	if strings.HasPrefix(clientAgent, "rnbeta") || strings.HasPrefix(clientAgent, "Mattermost") {
		return OriginClientMobile
	}

	// Is desktop?
	if strings.HasPrefix(fields[len(fields)-1], "Mattermost") {
		return OriginClientDesktop
	}

	// Default to web
	return OriginClientWeb
}

// checkCSRFToken performs a CSRF check on the provided request with the given CSRF token. Returns whether
// a CSRF check occurred and whether it succeeded.
func (h *Handler) checkCSRFToken(c *Context, r *http.Request, token string, tokenLocation app.TokenLocation, session *model.Session) (checked bool, passed bool) {
	csrfCheckNeeded := session != nil && c.Err == nil && tokenLocation == app.TokenLocationCookie && !h.TrustRequester && r.Method != "GET"
	csrfCheckPassed := false

	if csrfCheckNeeded {
		csrfHeader := r.Header.Get(model.HeaderCsrfToken)

		if csrfHeader == session.GetCSRF() {
			csrfCheckPassed = true
		} else if r.Header.Get(model.HeaderRequestedWith) == model.HeaderRequestedWithXML {
			// ToDo(DSchalla) 2019/01/04: Remove after deprecation period and only allow CSRF Header (MM-13657)
			csrfErrorMessage := "CSRF Header check failed for request - Please upgrade your web application or custom app to set a CSRF Header"

			fields := []mlog.Field{
				mlog.String("path", r.URL.Path),
				mlog.String("ip", r.RemoteAddr),
				mlog.String("session_id", session.Id),
				mlog.String("user_id", session.UserId),
			}

			if *c.App.Config().ServiceSettings.ExperimentalStrictCSRFEnforcement {
				c.Logger.Warn(csrfErrorMessage, fields...)
			} else {
				c.Logger.Debug(csrfErrorMessage, fields...)
				csrfCheckPassed = true
			}
		}

		if !csrfCheckPassed {
			c.AppContext = c.AppContext.WithSession(&model.Session{})
			c.Err = model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to be a CSRF attempt", http.StatusUnauthorized)
		}
	}

	return csrfCheckNeeded, csrfCheckPassed
}

// APIHandler provides a handler for API endpoints which do not require the user to be logged in order for access to be
// granted.
func (w *Web) APIHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	handler := &Handler{
		Srv:            w.srv,
		HandleFunc:     h,
		HandlerName:    GetHandlerName(h),
		RequireSession: false,
		TrustRequester: false,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *w.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gzhttp.GzipHandler(handler)
	}
	return handler
}

// APIHandlerTrustRequester provides a handler for API endpoints which do not require the user to be logged in and are
// allowed to be requested directly rather than via javascript/XMLHttpRequest, such as site branding images or the
// websocket.
func (w *Web) APIHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	handler := &Handler{
		Srv:            w.srv,
		HandleFunc:     h,
		HandlerName:    GetHandlerName(h),
		RequireSession: false,
		TrustRequester: true,
		RequireMfa:     false,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *w.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gzhttp.GzipHandler(handler)
	}
	return handler
}

// APISessionRequired provides a handler for API endpoints which require the user to be logged in in order for access to
// be granted.
func (w *Web) APISessionRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	handler := &Handler{
		Srv:            w.srv,
		HandleFunc:     h,
		HandlerName:    GetHandlerName(h),
		RequireSession: true,
		TrustRequester: false,
		RequireMfa:     true,
		IsStatic:       false,
		IsLocal:        false,
	}
	if *w.srv.Config().ServiceSettings.WebserverMode == "gzip" {
		return gzhttp.GzipHandler(handler)
	}
	return handler
}
