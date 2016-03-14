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
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

var sessionCache *utils.Cache = utils.NewLru(model.SESSION_CACHE_SIZE)

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
}

func ApiAppHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, true, false, false}
}

func AppHandler(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, false, false, false}
}

func AppHandlerIndependent(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, false, false, false, false, true}
}

func ApiUserRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, false, true, true, false}
}

func ApiUserRequiredActivity(h func(*Context, http.ResponseWriter, *http.Request), isUserActivity bool) http.Handler {
	return &handler{h, true, false, true, isUserActivity, false}
}

func UserRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, false, false, false, false}
}

func ApiAdminSystemRequired(h func(*Context, http.ResponseWriter, *http.Request)) http.Handler {
	return &handler{h, true, true, true, false, false}
}

type handler struct {
	handleFunc         func(*Context, http.ResponseWriter, *http.Request)
	requireUser        bool
	requireSystemAdmin bool
	isApi              bool
	isUserActivity     bool
	isTeamIndependent  bool
}

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	l4g.Debug("%v", r.URL.Path)

	c := &Context{}
	c.T, c.Locale = utils.GetTranslationsAndLocale(w, r)
	c.RequestId = model.NewId()
	c.IpAddress = GetIpAddress(r)

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
		}
	}

	// Attempt to parse token out of the query string
	if len(token) == 0 {
		token = r.URL.Query().Get("access_token")
		isTokenFromQueryString = true
	}

	protocol := GetProtocol(r)
	c.setSiteURL(protocol + "://" + r.Host)

	w.Header().Set(model.HEADER_REQUEST_ID, c.RequestId)
	w.Header().Set(model.HEADER_VERSION_ID, fmt.Sprintf("%v.%v", model.CurrentVersion, utils.CfgLastModified))

	// Instruct the browser not to display us in an iframe for anti-clickjacking
	if !h.isApi {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
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

	if c.Err == nil && h.isUserActivity && token != "" && len(c.Session.UserId) > 0 {
		go func() {
			if err := (<-Srv.Store.User().UpdateUserAndSessionActivity(c.Session.UserId, c.Session.Id, model.GetMillis())).Err; err != nil {
				l4g.Error(utils.T("api.context.last_activity_at.error"), c.Session.UserId, c.Session.Id, err)
			}
		}()
	}

	if c.Err == nil {
		h.handleFunc(c, w, r)
	}

	if c.Err != nil {
		c.Err.Translate(c.T)
		c.Err.RequestId = c.RequestId
		c.LogError(c.Err)
		c.Err.Where = r.URL.Path

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
	l4g.Error(utils.T("api.context.log.error"), c.Path, err.Where, err.StatusCode,
		c.RequestId, c.Session.UserId, c.IpAddress, err.Message, err.DetailedError)
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
	if c.Session.TeamId == teamId {
		return true
	}

	// You're a mattermost system admin and you're on the VPN
	if c.IsSystemAdmin() {
		return true
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
	if model.IsInRole(c.Session.Roles, model.ROLE_TEAM_ADMIN) || c.IsSystemAdmin() {
		return true
	}
	return false
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
	c.Err = model.NewLocAppError(where, "api.context.invalid_param.app_error", map[string]interface{}{"Name": name}, "")
	c.Err.StatusCode = http.StatusBadRequest
}

func (c *Context) SetUnknownError(where string, details string) {
	c.Err = model.NewLocAppError(where, "api.context.unknown.app_error", nil, details)
}

func (c *Context) setTeamURL(url string, valid bool) {
	c.teamURL = url
	c.teamURLValid = valid
}

func (c *Context) SetTeamURLFromSession() {
	if result := <-Srv.Store.Team().Get(c.Session.TeamId); result.Err == nil {
		c.setTeamURL(c.GetSiteURL()+"/"+result.Data.(*model.Team).Name, true)
	}
}

func (c *Context) setSiteURL(url string) {
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

func IsTestDomain(r *http.Request) bool {

	if strings.Index(r.Host, "localhost") == 0 {
		return true
	}

	if strings.Index(r.Host, "dockerhost") == 0 {
		return true
	}

	if strings.Index(r.Host, "test") == 0 {
		return true
	}

	if strings.Index(r.Host, "127.0.") == 0 {
		return true
	}

	if strings.Index(r.Host, "192.168.") == 0 {
		return true
	}

	if strings.Index(r.Host, "10.") == 0 {
		return true
	}

	if strings.Index(r.Host, "176.") == 0 {
		return true
	}

	return false
}

func IsBetaDomain(r *http.Request) bool {

	if strings.Index(r.Host, "beta") == 0 {
		return true
	}

	if strings.Index(r.Host, "ci") == 0 {
		return true
	}

	return false
}

var privateIpAddress = []*net.IPNet{
	{IP: net.IPv4(10, 0, 0, 1), Mask: net.IPv4Mask(255, 0, 0, 0)},
	{IP: net.IPv4(176, 16, 0, 1), Mask: net.IPv4Mask(255, 255, 0, 0)},
	{IP: net.IPv4(192, 168, 0, 1), Mask: net.IPv4Mask(255, 255, 255, 0)},
	{IP: net.IPv4(127, 0, 0, 1), Mask: net.IPv4Mask(255, 255, 255, 252)},
}

func IsPrivateIpAddress(ipAddress string) bool {

	for _, pips := range privateIpAddress {
		if pips.Contains(net.ParseIP(ipAddress)) {
			return true
		}
	}

	return false
}

func RenderWebError(err *model.AppError, w http.ResponseWriter, r *http.Request) {
	T, locale := utils.GetTranslationsAndLocale(w, r)
	page := utils.NewHTMLTemplate("error", locale)
	page.Props["Message"] = err.Message
	page.Props["Details"] = err.DetailedError

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) > 1 {
		page.Props["SiteURL"] = GetProtocol(r) + "://" + r.Host + "/" + pathParts[1]
	} else {
		page.Props["SiteURL"] = GetProtocol(r) + "://" + r.Host
	}

	page.Props["Title"] = T("api.templates.error.title", map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})
	page.Props["Link"] = T("api.templates.error.link")

	w.WriteHeader(err.StatusCode)
	if rErr := page.RenderToWriter(w); rErr != nil {
		l4g.Error("Failed to create error page: " + rErr.Error() + ", Original error: " + err.Error())
	}
}

func Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewLocAppError("Handle404", "api.context.404.app_error", nil, "")
	err.StatusCode = http.StatusNotFound
	l4g.Error("%v: code=404 ip=%v", r.URL.Path, GetIpAddress(r))
	RenderWebError(err, w, r)
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

			if session.IsExpired() {
				return nil
			} else {
				AddSessionToCache(session)
				return session
			}
		}
	}

	return session
}

func AddSessionToCache(session *model.Session) {
	sessionCache.AddWithExpiresInSecs(session.Token, session, int64(*utils.Cfg.ServiceSettings.SessionCacheInMinutes*60))
}
