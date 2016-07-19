// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

var sessionCache *utils.Cache = utils.NewLru(model.SESSION_CACHE_SIZE)
var statusCache *utils.Cache = utils.NewLru(model.STATUS_CACHE_SIZE)

var allowedMethods []string = []string{
	"POST",
	"GET",
	"OPTIONS",
	"PUT",
	"PATCH",
	"DELETE",
}

type Context struct {
	Session      model.Session
	RequestId    string
	IpAddress    string
	Path         string
	Err          *model.AppError
	teamURLValid bool
	teamURL      string
	siteURL      string
	T            goi18n.TranslateFunc
	Locale       string
	TeamId       string
}

func ApiAppHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, true, false, false, false}
}

func AppHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, false, false, false, false}
}

func AppHandlerIndependent(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, false, false, true, false}
}

func ApiUserRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, false, true, true, false, false}
}

func ApiUserRequiredActivity(h func(*Context, http.ResponseWriter, *http.Request), isUserActivity bool) http.Handler {
	return &handler{h, true, false, true, isUserActivity, false, false}
}

func UserRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, false, false, false, false, false}
}

func AppHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, false, false, false, true}
}

func ApiAdminSystemRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, true, true, false, false, false}
}

func ApiAppHandlerTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, true, false, false, true}
}

func ApiUserRequiredTrustRequester(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, false, true, true, false, true}
}

func ApiAppHandlerTrustRequesterIndependent(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, true, false, true, true}
}

type handler struct {
	handleFunc         func(*Context, http.ResponseWriter, *http.Request)
	requireUser        bool
	requireSystemAdmin bool
	isApi              bool
	isUserActivity     bool
	isTeamIndependent  bool
	trustRequester     bool
}

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	l4g.Debug("%v", r.URL.Path)

	c := &Context{}
	c.T, c.Locale = utils.GetTranslationsAndLocale(w, r)
	c.RequestId = model.NewId()
	c.IpAddress = GetIpAddress(r)
	c.TeamId = mux.Vars(r)["team_id"]

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
					c.Err = model.NewLocAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to bea CSRF attempt")
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

	protocol := GetProtocol(r)
	c.SetSiteURL(protocol + "://" + r.Host)

	w.Header().Set(model.HEADER_REQUEST_ID, c.RequestId)
	w.Header().Set(model.HEADER_VERSION_ID, fmt.Sprintf("%v.%v", model.CurrentVersion, utils.CfgLastModified))

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
		session := GetSession(token)

		if session == nil || session.IsExpired() {
			c.RemoveSessionCookie(w, r)
			if h.requireUser || h.requireSystemAdmin {
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

	if h.isApi || h.isTeamIndependent {
		c.setTeamURL(c.GetSiteURL(), false)
		c.Path = r.URL.Path
	} else {
		splitURL := strings.Split(r.URL.Path, "/")
		c.setTeamURL(protocol+"://"+r.Host+"/"+splitURL[1], true)
		c.Path = "/" + strings.Join(splitURL[2:], "/")
	}

	if c.Err == nil && h.requireUser {
		c.UserRequired()
	}

	if c.Err == nil && h.requireSystemAdmin {
		c.SystemAdminRequired()
	}

	if c.Err == nil && len(c.TeamId) > 0 && !h.isTeamIndependent {
		c.HasPermissionsToTeam(c.TeamId, "TeamRoute")
	}

	if c.Err == nil && h.isUserActivity && token != "" && len(c.Session.UserId) > 0 {
		SetStatusOnline(c.Session.UserId, c.Session.Id)
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

		// Block out detailed error whenn not in developer mode
		if !*utils.Cfg.ServiceSettings.EnableDeveloper {
			c.Err.DetailedError = ""
		}

		if h.isApi {
			w.WriteHeader(c.Err.StatusCode)
			w.Write([]byte(c.Err.ToJson()))
		} else {
			if c.Err.StatusCode == http.StatusUnauthorized {
				http.Redirect(w, r, c.GetTeamURL()+"/?redirect="+url.QueryEscape(r.URL.Path), http.StatusTemporaryRedirect)
			} else {
				RenderWebError(c.Err, w, r)
			}
		}
	}
}

func (cw *CorsWrapper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if len(*utils.Cfg.ServiceSettings.AllowCorsFrom) > 0 {
		origin := r.Header.Get("Origin")
		if *utils.Cfg.ServiceSettings.AllowCorsFrom == "*" || strings.Contains(*utils.Cfg.ServiceSettings.AllowCorsFrom, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)

			if r.Method == "OPTIONS" {
				w.Header().Set(
					"Access-Control-Allow-Methods",
					strings.Join(allowedMethods, ", "))

				w.Header().Set(
					"Access-Control-Allow-Headers",
					r.Header.Get("Access-Control-Request-Headers"))
			}
		}
	}

	if r.Method == "OPTIONS" {
		return
	}

	cw.router.ServeHTTP(w, r)
}

func GetProtocol(r *http.Request) string {
	if r.Header.Get(model.HEADER_FORWARDED_PROTO) == "https" {
		return "https"
	} else {
		return "http"
	}
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.Session.UserId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {

	if len(c.Session.UserId) > 0 {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.Session.UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogError(err *model.AppError) {

	// filter out endless reconnects
	if c.Path == "/api/v3/users/websocket" && err.StatusCode == 401 {
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

func (c *Context) UserRequired() {
	if len(c.Session.UserId) == 0 {
		c.Err = model.NewLocAppError("", "api.context.session_expired.app_error", nil, "UserRequired")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	}
}

func (c *Context) SystemAdminRequired() {
	if len(c.Session.UserId) == 0 {
		c.Err = model.NewLocAppError("", "api.context.session_expired.app_error", nil, "SystemAdminRequired")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	} else if !c.IsSystemAdmin() {
		c.Err = model.NewLocAppError("", "api.context.permissions.app_error", nil, "AdminRequired")
		c.Err.StatusCode = http.StatusForbidden
		return
	}
}

func (c *Context) HasPermissionsToUser(userId string, where string) bool {

	// You are the user
	if c.Session.UserId == userId {
		return true
	}

	// You're a mattermost system admin and you're on the VPN
	if c.IsSystemAdmin() {
		return true
	}

	c.Err = model.NewLocAppError(where, "api.context.permissions.app_error", nil, "userId="+userId)
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func (c *Context) HasPermissionsToTeam(teamId string, where string) bool {
	if c.IsSystemAdmin() {
		return true
	}

	for _, teamMember := range c.Session.TeamMembers {
		if teamId == teamMember.TeamId {
			return true
		}
	}

	c.Err = model.NewLocAppError(where, "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", teamId="+teamId)
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func (c *Context) HasPermissionsToChannel(sc store.StoreChannel, where string) bool {
	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return false
	} else if cresult.Data.(int64) != 1 {
		c.Err = model.NewLocAppError(where, "api.context.permissions.app_error", nil, "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return false
	}

	return true
}

func (c *Context) HasSystemAdminPermissions(where string) bool {
	if c.IsSystemAdmin() {
		return true
	}

	c.Err = model.NewLocAppError(where, "api.context.system_permissions.app_error", nil, "userId="+c.Session.UserId)
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func (c *Context) IsSystemAdmin() bool {
	if model.IsInRole(c.Session.Roles, model.ROLE_SYSTEM_ADMIN) {
		return true
	}
	return false
}

func (c *Context) IsTeamAdmin() bool {

	if c.IsSystemAdmin() {
		return true
	}

	teamMember := c.Session.GetTeamByTeamId(c.TeamId)
	if teamMember == nil {
		return false
	}

	return teamMember.IsTeamAdmin()
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

func (c *Context) SetInvalidParam(where string, name string) {
	c.Err = NewInvalidParamError(where, name)
}

func NewInvalidParamError(where string, name string) *model.AppError {
	err := model.NewLocAppError(where, "api.context.invalid_param.app_error", map[string]interface{}{"Name": name}, "")
	err.StatusCode = http.StatusBadRequest
	return err
}

func (c *Context) SetUnknownError(where string, details string) {
	c.Err = model.NewLocAppError(where, "api.context.unknown.app_error", nil, details)
}

func (c *Context) setTeamURL(url string, valid bool) {
	c.teamURL = url
	c.teamURLValid = valid
}

func (c *Context) SetTeamURLFromSession() {
	if result := <-Srv.Store.Team().Get(c.TeamId); result.Err == nil {
		c.setTeamURL(c.GetSiteURL()+"/"+result.Data.(*model.Team).Name, true)
	}
}

func (c *Context) SetSiteURL(url string) {
	c.siteURL = url
}

func (c *Context) GetTeamURLFromTeam(team *model.Team) string {
	return c.GetSiteURL() + "/" + team.Name
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

func (c *Context) GetSiteURL() string {
	return c.siteURL
}

func IsApiCall(r *http.Request) bool {
	return strings.Index(r.URL.Path, "/api/") == 0
}

func GetIpAddress(r *http.Request) string {
	address := r.Header.Get(model.HEADER_FORWARDED)

	if len(address) == 0 {
		address = r.Header.Get(model.HEADER_REAL_IP)
	}

	if len(address) == 0 {
		address, _, _ = net.SplitHostPort(r.RemoteAddr)
	}

	return address
}

func RenderWebError(err *model.AppError, w http.ResponseWriter, r *http.Request) {
	T, _ := utils.GetTranslationsAndLocale(w, r)

	title := T("api.templates.error.title", map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})
	message := err.Message
	details := err.DetailedError
	link := "/"
	linkMessage := T("api.templates.error.link")

	status := http.StatusTemporaryRedirect
	if err.StatusCode != http.StatusInternalServerError {
		status = err.StatusCode
	}

	http.Redirect(
		w,
		r,
		"/error?title="+url.QueryEscape(title)+
			"&message="+url.QueryEscape(message)+
			"&details="+url.QueryEscape(details)+
			"&link="+url.QueryEscape(link)+
			"&linkmessage="+url.QueryEscape(linkMessage),
		status)
}

func Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewLocAppError("Handle404", "api.context.404.app_error", nil, "")
	err.Translate(utils.T)
	err.StatusCode = http.StatusNotFound

	// filter out old paths that are poluting the log file
	if strings.Contains(r.URL.Path, "/api/v1/") {
		l4g.Debug("%v: code=404 ip=%v", r.URL.Path, GetIpAddress(r))
	} else {
		l4g.Error("%v: code=404 ip=%v", r.URL.Path, GetIpAddress(r))
	}

	if IsApiCall(r) {
		w.WriteHeader(err.StatusCode)
		err.DetailedError = "There doesn't appear to be an api call for the url='" + r.URL.Path + "'.  Typo? are you missing a team_id or user_id as part of the url?"
		w.Write([]byte(err.ToJson()))
	} else {
		RenderWebError(err, w, r)
	}
}

func GetSession(token string) *model.Session {
	var session *model.Session
	if ts, ok := sessionCache.Get(token); ok {
		session = ts.(*model.Session)
	}

	if session == nil {
		if sessionResult := <-Srv.Store.Session().Get(token); sessionResult.Err != nil {
			l4g.Error(utils.T("api.context.invalid_token.error"), token, sessionResult.Err.DetailedError)
		} else {
			session = sessionResult.Data.(*model.Session)

			if session.IsExpired() || session.Token != token {
				return nil
			} else {
				AddSessionToCache(session)
				return session
			}
		}
	}

	return session
}

func RemoveAllSessionsForUserId(userId string) {

	keys := sessionCache.Keys()

	for _, key := range keys {
		if ts, ok := sessionCache.Get(key); ok {
			session := ts.(*model.Session)
			if session.UserId == userId {
				sessionCache.Remove(key)
			}
		}
	}
}

func AddSessionToCache(session *model.Session) {
	sessionCache.AddWithExpiresInSecs(session.Token, session, int64(*utils.Cfg.ServiceSettings.SessionCacheInMinutes*60))
}
