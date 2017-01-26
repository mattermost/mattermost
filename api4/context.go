// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type Context struct {
	Session   model.Session
	Params    *ApiParams
	Err       *model.AppError
	T         goi18n.TranslateFunc
	RequestId string
	IpAddress string
	Path      string
	siteURL   string
}

func ApiHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{
		handleFunc:     h,
		requireSession: false,
		trustRequester: false,
		requireMfa:     false,
	}
}

func ApiSessionRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{
		handleFunc:     h,
		requireSession: true,
		trustRequester: false,
		requireMfa:     true,
	}
}

func ApiSessionRequiredMfa(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{
		handleFunc:     h,
		requireSession: true,
		trustRequester: false,
		requireMfa:     false,
	}
}

func ApiHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{
		handleFunc:     h,
		requireSession: false,
		trustRequester: true,
		requireMfa:     false,
	}
}

func ApiSessionRequiredTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{
		handleFunc:     h,
		requireSession: true,
		trustRequester: true,
		requireMfa:     true,
	}
}

type handler struct {
	handleFunc     func(*Context, http.ResponseWriter, *http.Request)
	requireSession bool
	trustRequester bool
	requireMfa     bool
}

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	l4g.Debug("%v - %v", r.Method, r.URL.Path)

	c := &Context{}
	c.T, _ = utils.GetTranslationsAndLocale(w, r)
	c.RequestId = model.NewId()
	c.IpAddress = utils.GetIpAddress(r)
	c.Params = ApiParamsFromRequest(r)

	token := ""
	isTokenFromQueryString := false

	// Attempt to parse token out of the header
	authHeader := r.Header.Get(model.HEADER_AUTH)
	if len(authHeader) > 6 && strings.ToUpper(authHeader[0:6]) == model.HEADER_BEARER {
		// Default session token
		token = authHeader[7:]

	} else if len(authHeader) > 5 && strings.ToLower(authHeader[0:5]) == model.HEADER_TOKEN {
		// OAuth token
		token = authHeader[6:]
	}

	// Attempt to parse the token from the cookie
	if len(token) == 0 {
		if cookie, err := r.Cookie(model.SESSION_COOKIE_TOKEN); err == nil {
			token = cookie.Value

			if h.requireSession && !h.trustRequester {
				if r.Header.Get(model.HEADER_REQUESTED_WITH) != model.HEADER_REQUESTED_WITH_XML {
					c.Err = model.NewLocAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to be a CSRF attempt")
					token = ""
				}
			}
		}
	}

	// Attempt to parse token out of the query string
	if len(token) == 0 {
		token = r.URL.Query().Get("access_token")
		isTokenFromQueryString = true
	}

	if utils.GetSiteURL() == "" {
		protocol := app.GetProtocol(r)
		c.SetSiteURL(protocol + "://" + r.Host)
	}

	w.Header().Set(model.HEADER_REQUEST_ID, c.RequestId)
	w.Header().Set(model.HEADER_VERSION_ID, fmt.Sprintf("%v.%v.%v", model.CurrentVersion, model.BuildNumber, utils.CfgHash))
	if einterfaces.GetClusterInterface() != nil {
		w.Header().Set(model.HEADER_CLUSTER_ID, einterfaces.GetClusterInterface().GetClusterId())
	}

	w.Header().Set("Content-Type", "application/json")

	if r.Method == "GET" {
		w.Header().Set("Expires", "0")
	}

	if len(token) != 0 {
		session, err := app.GetSession(token)

		if err != nil {
			l4g.Error(utils.T("api.context.invalid_session.error"), err.Error())
			c.RemoveSessionCookie(w, r)
			if h.requireSession {
				c.Err = model.NewLocAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token)
				c.Err.StatusCode = http.StatusUnauthorized
			}
		} else if !session.IsOAuth && isTokenFromQueryString {
			c.Err = model.NewLocAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token)
			c.Err.StatusCode = http.StatusUnauthorized
		} else {
			c.Session = *session
		}
	}

	c.Path = r.URL.Path

	if c.Err == nil && h.requireSession {
		c.SessionRequired()
	}

	if c.Err == nil && h.requireMfa {
		c.MfaRequired()
	}

	if c.Err == nil {
		h.handleFunc(c, w, r)
	}

	// Handle errors that have occured
	if c.Err != nil {
		c.Err.Translate(c.T)
		c.Err.RequestId = c.RequestId
		c.LogError(c.Err)
		c.Err.Where = r.URL.Path

		// Block out detailed error when not in developer mode
		if !*utils.Cfg.ServiceSettings.EnableDeveloper {
			c.Err.DetailedError = ""
		}

		w.WriteHeader(c.Err.StatusCode)
		w.Write([]byte(c.Err.ToJson()))

		if einterfaces.GetMetricsInterface() != nil {
			einterfaces.GetMetricsInterface().IncrementHttpError()
		}
	}

	if einterfaces.GetMetricsInterface() != nil {
		einterfaces.GetMetricsInterface().IncrementHttpRequest()

		if r.URL.Path != model.API_URL_SUFFIX+"/users/websocket" {
			elapsed := float64(time.Since(now)) / float64(time.Second)
			einterfaces.GetMetricsInterface().ObserveHttpRequestDuration(elapsed)
		}
	}
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.Session.UserId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-app.Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {

	if len(c.Session.UserId) > 0 {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.Session.UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-app.Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogError(err *model.AppError) {

	// filter out endless reconnects
	if c.Path == "/api/v3/users/websocket" && err.StatusCode == 401 || err.Id == "web.check_browser_compatibility.app_error" {
		c.LogDebug(err)
	} else {
		l4g.Error(utils.T("api.context.log.error"), c.Path, err.Where, err.StatusCode,
			c.RequestId, c.Session.UserId, c.IpAddress, err.SystemMessage(utils.T), err.DetailedError)
	}
}

func (c *Context) LogDebug(err *model.AppError) {
	l4g.Debug(utils.T("api.context.log.error"), c.Path, err.Where, err.StatusCode,
		c.RequestId, c.Session.UserId, c.IpAddress, err.SystemMessage(utils.T), err.DetailedError)
}

func (c *Context) IsSystemAdmin() bool {
	return app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM)
}

func (c *Context) SessionRequired() {
	if len(c.Session.UserId) == 0 {
		c.Err = model.NewLocAppError("", "api.context.session_expired.app_error", nil, "UserRequired")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	}
}

func (c *Context) MfaRequired() {
	// Must be licensed for MFA and have it configured for enforcement
	if !utils.IsLicensed || !*utils.License.Features.MFA || !*utils.Cfg.ServiceSettings.EnableMultifactorAuthentication || !*utils.Cfg.ServiceSettings.EnforceMultifactorAuthentication {
		return
	}

	// OAuth integrations are excepted
	if c.Session.IsOAuth {
		return
	}

	if user, err := app.GetUser(c.Session.UserId); err != nil {
		c.Err = model.NewLocAppError("", "api.context.session_expired.app_error", nil, "MfaRequired")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	} else {
		// Only required for email and ldap accounts
		if user.AuthService != "" &&
			user.AuthService != model.USER_AUTH_SERVICE_EMAIL &&
			user.AuthService != model.USER_AUTH_SERVICE_LDAP {
			return
		}

		if !user.MfaActive {
			c.Err = model.NewLocAppError("", "api.context.mfa_required.app_error", nil, "MfaRequired")
			c.Err.StatusCode = http.StatusUnauthorized
			return
		}
	}
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter, r *http.Request) {
	cookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	}

	http.SetCookie(w, cookie)
}

func (c *Context) SetInvalidParam(parameter string) {
	c.Err = NewInvalidParamError(parameter)
}

func (c *Context) SetInvalidUrlParam(parameter string) {
	c.Err = NewInvalidUrlParamError(parameter)
}

func NewInvalidParamError(parameter string) *model.AppError {
	err := model.NewLocAppError("Context", "api.context.invalid_body_param.app_error", map[string]interface{}{"Name": parameter}, "")
	err.StatusCode = http.StatusBadRequest
	return err
}
func NewInvalidUrlParamError(parameter string) *model.AppError {
	err := model.NewLocAppError("Context", "api.context.invalid_url_param.app_error", map[string]interface{}{"Name": parameter}, "")
	err.StatusCode = http.StatusBadRequest
	return err
}

func (c *Context) SetPermissionError(permission *model.Permission) {
	c.Err = model.NewLocAppError("Permissions", "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", "+"permission="+permission.Id)
	c.Err.StatusCode = http.StatusForbidden
}

func (c *Context) SetSiteURL(url string) {
	c.siteURL = strings.TrimRight(url, "/")
}

func (c *Context) GetSiteURL() string {
	return c.siteURL
}

func (c *Context) RequireUserId() *Context {
	if len(c.Params.UserId) != 26 {
		c.SetInvalidUrlParam("user_id")
	}
	return c
}

func (c *Context) RequireTeamId() *Context {
	if len(c.Params.TeamId) != 26 {
		c.SetInvalidUrlParam("team_id")
	}
	return c
}

func (c *Context) RequireChannelId() *Context {
	if len(c.Params.ChannelId) != 26 {
		c.SetInvalidUrlParam("channel_id")
	}
	return c
}
