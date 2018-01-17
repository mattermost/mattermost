// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

type Context struct {
	App           *app.App
	Session       model.Session
	RequestId     string
	IpAddress     string
	Path          string
	Err           *model.AppError
	siteURLHeader string
	teamURLValid  bool
	teamURL       string
	T             goi18n.TranslateFunc
	Locale        string
	TeamId        string
}

func (api *API) ApiAppHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, false, false, true, false, false, false, false}
}

func (api *API) AppHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, false, false, false, false, false, false, false}
}

func (api *API) AppHandlerIndependent(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, false, false, false, false, true, false, false}
}

func (api *API) ApiUserRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, true, false, true, false, false, false, true}
}

func (api *API) ApiUserRequiredActivity(h func(*Context, http.ResponseWriter, *http.Request), isUserActivity bool) http.Handler {
	return &handler{api.App, h, true, false, true, isUserActivity, false, false, true}
}

func (api *API) ApiUserRequiredMfa(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, true, false, true, false, false, false, false}
}

func (api *API) UserRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, true, false, false, false, false, false, true}
}

func (api *API) AppHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, false, false, false, false, false, true, false}
}

func (api *API) ApiAdminSystemRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, true, true, true, false, false, false, true}
}

func (api *API) ApiAdminSystemRequiredTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, true, true, true, false, false, true, true}
}

func (api *API) ApiAppHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, false, false, true, false, false, true, false}
}

func (api *API) ApiUserRequiredTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, true, false, true, false, false, true, true}
}

func (api *API) ApiAppHandlerTrustRequesterIndependent(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{api.App, h, false, false, true, false, true, true, false}
}

type handler struct {
	app                *app.App
	handleFunc         func(*Context, http.ResponseWriter, *http.Request)
	requireUser        bool
	requireSystemAdmin bool
	isApi              bool
	isUserActivity     bool
	isTeamIndependent  bool
	trustRequester     bool
	requireMfa         bool
}

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	l4g.Debug("%v", r.URL.Path)

	c := &Context{}
	c.App = h.app
	c.T, c.Locale = utils.GetTranslationsAndLocale(w, r)
	c.RequestId = model.NewId()
	c.IpAddress = utils.GetIpAddress(r)
	c.TeamId = mux.Vars(r)["team_id"]

	if metrics := c.App.Metrics; metrics != nil && h.isApi {
		metrics.IncrementHttpRequest()
	}

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

			if (h.requireSystemAdmin || h.requireUser) && !h.trustRequester {
				if r.Header.Get(model.HEADER_REQUESTED_WITH) != model.HEADER_REQUESTED_WITH_XML {
					c.Err = model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to be a CSRF attempt", http.StatusUnauthorized)
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

	c.SetSiteURLHeader(app.GetProtocol(r) + "://" + r.Host)

	w.Header().Set(model.HEADER_REQUEST_ID, c.RequestId)
	w.Header().Set(model.HEADER_VERSION_ID, fmt.Sprintf("%v.%v.%v.%v", model.CurrentVersion, model.BuildNumber, utils.ClientCfgHash, utils.IsLicensed()))

	// Instruct the browser not to display us in an iframe unless is the same origin for anti-clickjacking
	if !h.isApi {
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'self'")
	} else {
		// All api response bodies will be JSON formatted by default
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "GET" {
			w.Header().Set("Expires", "0")
		}
	}

	if len(token) != 0 {
		session, err := c.App.GetSession(token)

		if err != nil {
			l4g.Error(utils.T("api.context.invalid_session.error"), err.Error())
			c.RemoveSessionCookie(w, r)
			if h.requireUser || h.requireSystemAdmin {
				c.Err = model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
			}
		} else if !session.IsOAuth && isTokenFromQueryString {
			c.Err = model.NewAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token, http.StatusUnauthorized)
		} else {
			c.Session = *session
		}
	}

	if h.isApi || h.isTeamIndependent {
		c.setTeamURL(c.GetSiteURLHeader(), false)
		c.Path = r.URL.Path
	} else {
		splitURL := strings.Split(r.URL.Path, "/")
		c.setTeamURL(c.GetSiteURLHeader()+"/"+splitURL[1], true)
		c.Path = "/" + strings.Join(splitURL[2:], "/")
	}

	if h.isApi && !*c.App.Config().ServiceSettings.EnableAPIv3 {
		c.Err = model.NewAppError("ServeHTTP", "api.context.v3_disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if c.Err == nil && h.requireUser {
		c.UserRequired()
	}

	if c.Err == nil && h.requireMfa {
		c.MfaRequired()
	}

	if c.Err == nil && h.requireSystemAdmin {
		c.SystemAdminRequired()
	}

	if c.Err == nil && h.isUserActivity && token != "" && len(c.Session.UserId) > 0 {
		c.App.SetStatusOnline(c.Session.UserId, c.Session.Id, false)
		c.App.UpdateLastActivityAtIfNeeded(c.Session)
	}

	if c.Err == nil && (h.requireUser || h.requireSystemAdmin) {
		//check if teamId exist
		c.CheckTeamId()
	}

	if h.isApi {
		atomic.StoreInt32(model.UsedApiV3, 1)
	}

	if c.Err == nil {
		h.handleFunc(c, w, r)
	}

	// Handle errors that have occoured
	if c.Err != nil {
		c.Err.Translate(c.T)
		c.Err.RequestId = c.RequestId
		c.LogError(c.Err)
		c.Err.Where = r.URL.Path

		// Block out detailed error when not in developer mode
		if !*c.App.Config().ServiceSettings.EnableDeveloper {
			c.Err.DetailedError = ""
		}

		if h.isApi {
			w.WriteHeader(c.Err.StatusCode)
			w.Write([]byte(c.Err.ToJson()))

			if c.App.Metrics != nil {
				c.App.Metrics.IncrementHttpError()
			}
		} else {
			if c.Err.StatusCode == http.StatusUnauthorized {
				http.Redirect(w, r, c.GetTeamURL()+"/?redirect="+url.QueryEscape(r.URL.Path), http.StatusTemporaryRedirect)
			} else {
				utils.RenderWebError(c.Err, w, r)
			}
		}

	}

	if h.isApi && c.App.Metrics != nil {
		if r.URL.Path != model.API_URL_SUFFIX_V3+"/users/websocket" {
			elapsed := float64(time.Since(now)) / float64(time.Second)
			c.App.Metrics.ObserveHttpRequestDuration(elapsed)
		}
	}
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.Session.UserId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-c.App.Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {

	if len(c.Session.UserId) > 0 {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.Session.UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-c.App.Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogError(err *model.AppError) {

	// filter out endless reconnects
	if c.Path == "/api/v3/users/websocket" && err.StatusCode == 401 || err.Id == "web.check_browser_compatibility.app_error" {
		c.LogDebug(err)
	} else if err.Id != "api.post.create_post.town_square_read_only" {
		l4g.Error(utils.TDefault("api.context.log.error"), c.Path, err.Where, err.StatusCode,
			c.RequestId, c.Session.UserId, c.IpAddress, err.SystemMessage(utils.TDefault), err.DetailedError)
	}
}

func (c *Context) LogDebug(err *model.AppError) {
	l4g.Debug(utils.TDefault("api.context.log.error"), c.Path, err.Where, err.StatusCode,
		c.RequestId, c.Session.UserId, c.IpAddress, err.SystemMessage(utils.TDefault), err.DetailedError)
}

func (c *Context) UserRequired() {
	if !*c.App.Config().ServiceSettings.EnableUserAccessTokens && c.Session.Props[model.SESSION_PROP_TYPE] == model.SESSION_TYPE_USER_ACCESS_TOKEN {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserAccessToken", http.StatusUnauthorized)
		return
	}

	if len(c.Session.UserId) == 0 {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) MfaRequired() {
	// Must be licensed for MFA and have it configured for enforcement
	if !utils.IsLicensed() || !*utils.License().Features.MFA || !*c.App.Config().ServiceSettings.EnableMultifactorAuthentication || !*c.App.Config().ServiceSettings.EnforceMultifactorAuthentication {
		return
	}

	// OAuth integrations are excepted
	if c.Session.IsOAuth {
		return
	}

	if result := <-c.App.Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "MfaRequired", http.StatusUnauthorized)
		return
	} else {
		user := result.Data.(*model.User)

		// Only required for email and ldap accounts
		if user.AuthService != "" &&
			user.AuthService != model.USER_AUTH_SERVICE_EMAIL &&
			user.AuthService != model.USER_AUTH_SERVICE_LDAP {
			return
		}

		if !user.MfaActive {
			c.Err = model.NewAppError("", "api.context.mfa_required.app_error", nil, "MfaRequired", http.StatusUnauthorized)
			return
		}
	}
}

func (c *Context) SystemAdminRequired() {
	if len(c.Session.UserId) == 0 {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "SystemAdminRequired", http.StatusUnauthorized)
		return
	} else if !c.IsSystemAdmin() {
		c.Err = model.NewAppError("", "api.context.permissions.app_error", nil, "AdminRequired", http.StatusForbidden)
		return
	}
}

func (c *Context) IsSystemAdmin() bool {
	return c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM)
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter, r *http.Request) {
	cookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	}

	userCookie := &http.Cookie{
		Name:   model.SESSION_COOKIE_USER,
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	}

	http.SetCookie(w, cookie)
	http.SetCookie(w, userCookie)
}

func (c *Context) SetInvalidParam(where string, name string) {
	c.Err = NewInvalidParamError(where, name)
}

func NewInvalidParamError(where string, name string) *model.AppError {
	err := model.NewAppError(where, "api.context.invalid_param.app_error", map[string]interface{}{"Name": name}, "", http.StatusBadRequest)
	return err
}

func (c *Context) SetUnknownError(where string, details string) {
	c.Err = model.NewAppError(where, "api.context.unknown.app_error", nil, details, http.StatusInternalServerError)
}

func (c *Context) SetPermissionError(permission *model.Permission) {
	c.Err = model.NewAppError("Permissions", "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", "+"permission="+permission.Id, http.StatusForbidden)
}

func (c *Context) setTeamURL(url string, valid bool) {
	c.teamURL = url
	c.teamURLValid = valid
}

func (c *Context) SetTeamURLFromSession() {
	if result := <-c.App.Srv.Store.Team().Get(c.TeamId); result.Err == nil {
		c.setTeamURL(c.GetSiteURLHeader()+"/"+result.Data.(*model.Team).Name, true)
	}
}

func (c *Context) SetSiteURLHeader(url string) {
	c.siteURLHeader = strings.TrimRight(url, "/")
}

// TODO see where these are used
func (c *Context) GetTeamURLFromTeam(team *model.Team) string {
	return c.GetSiteURLHeader() + "/" + team.Name
}

func (c *Context) GetTeamURL() string {
	if !c.teamURLValid {
		c.SetTeamURLFromSession()
		if !c.teamURLValid {
			l4g.Debug(utils.T("api.context.invalid_team_url.debug"))
		}
	}
	return c.teamURL
}

func (c *Context) GetSiteURLHeader() string {
	return c.siteURLHeader
}

func (c *Context) GetCurrentTeamMember() *model.TeamMember {
	return c.Session.GetTeamByTeamId(c.TeamId)
}

func (c *Context) HandleEtag(etag string, routeName string, w http.ResponseWriter, r *http.Request) bool {
	metrics := c.App.Metrics
	if et := r.Header.Get(model.HEADER_ETAG_CLIENT); len(etag) > 0 {
		if et == etag {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
			w.WriteHeader(http.StatusNotModified)
			if metrics != nil {
				metrics.IncrementEtagHitCounter(routeName)
			}
			return true
		}
	}

	if metrics != nil {
		metrics.IncrementEtagMissCounter(routeName)
	}

	return false
}

func IsApiCall(r *http.Request) bool {
	return strings.Index(r.URL.Path, "/api/") == 0
}

func Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewAppError("Handle404", "api.context.404.app_error", nil, "", http.StatusNotFound)
	err.Translate(utils.T)

	l4g.Debug("%v: code=404 ip=%v", r.URL.Path, utils.GetIpAddress(r))

	if IsApiCall(r) {
		w.WriteHeader(err.StatusCode)
		err.DetailedError = "There doesn't appear to be an api call for the url='" + r.URL.Path + "'.  Typo? are you missing a team_id or user_id as part of the url?"
		w.Write([]byte(err.ToJson()))
	} else {
		utils.RenderWebError(err, w, r)
	}
}

func (c *Context) CheckTeamId() {
	if c.TeamId != "" && c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			if result := <-c.App.Srv.Store.Team().Get(c.TeamId); result.Err != nil {
				c.Err = result.Err
				c.Err.StatusCode = http.StatusBadRequest
				return
			}
		} else {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}
}
