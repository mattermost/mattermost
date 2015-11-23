// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

var sessionCache *utils.Cache = utils.NewLru(model.SESSION_CACHE_SIZE)

type Context struct {
	Session           model.Session
	RequestId         string
	IpAddress         string
	Path              string
	Err               *model.AppError
	teamURLValid      bool
	teamURL           string
	siteURL           string
	SessionTokenIndex int64
}

type Page struct {
	TemplateName      string
	Props             map[string]string
	ClientCfg         map[string]string
	User              *model.User
	Team              *model.Team
	Channel           *model.Channel
	PostID            string
	SessionTokenIndex int64
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
		tokens := GetMultiSessionCookieTokens(r)
		if len(tokens) > 0 {
			// If there is only 1 token in the cookie then just use it like normal
			if len(tokens) == 1 {
				token = tokens[0]
			} else {
				// If it is a multi-session token then find the correct session
				sessionTokenIndexStr := r.URL.Query().Get(model.SESSION_TOKEN_INDEX)
				sessionTokenIndex := int64(-1)
				if len(sessionTokenIndexStr) > 0 {
					if index, err := strconv.ParseInt(sessionTokenIndexStr, 10, 64); err == nil {
						sessionTokenIndex = index
					}
				} else {
					sessionTokenIndexStr := r.Header.Get(model.HEADER_MM_SESSION_TOKEN_INDEX)
					if len(sessionTokenIndexStr) > 0 {
						if index, err := strconv.ParseInt(sessionTokenIndexStr, 10, 64); err == nil {
							sessionTokenIndex = index
						}
					}
				}

				if sessionTokenIndex >= 0 && sessionTokenIndex < int64(len(tokens)) {
					token = tokens[sessionTokenIndex]
					c.SessionTokenIndex = sessionTokenIndex
				} else {
					c.SessionTokenIndex = -1
				}
			}
		} else {
			c.SessionTokenIndex = -1
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
		w.Header().Set("Content-Security-Policy", "frame-ancestors none")
	} else {
		// All api response bodies will be JSON formatted by default
		w.Header().Set("Content-Type", "application/json")
	}

	if len(token) != 0 {
		session := GetSession(token)

		if session == nil || session.IsExpired() {
			c.RemoveSessionCookie(w, r)
			c.Err = model.NewAppError("ServeHTTP", "Invalid or expired session, please login again.", "token="+token)
			c.Err.StatusCode = http.StatusUnauthorized
		} else if !session.IsOAuth && isTokenFromQueryString {
			c.Err = model.NewAppError("ServeHTTP", "Session is not OAuth but token was provided in the query string", "token="+token)
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
				l4g.Error("Failed to update LastActivityAt for user_id=%v and session_id=%v, err=%v", c.Session.UserId, c.Session.Id, err)
			}
		}()
	}

	if c.Err == nil {
		h.handleFunc(c, w, r)
	}

	if c.Err != nil {
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
	l4g.Error("%v:%v code=%v rid=%v uid=%v ip=%v %v [details: %v]", c.Path, err.Where, err.StatusCode,
		c.RequestId, c.Session.UserId, c.IpAddress, err.Message, err.DetailedError)
}

func (c *Context) UserRequired() {
	if len(c.Session.UserId) == 0 {
		c.Err = model.NewAppError("", "Invalid or expired session, please login again.", "UserRequired")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	}
}

func (c *Context) SystemAdminRequired() {
	if len(c.Session.UserId) == 0 {
		c.Err = model.NewAppError("", "Invalid or expired session, please login again.", "SystemAdminRequired")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	} else if !c.IsSystemAdmin() {
		c.Err = model.NewAppError("", "You do not have the appropriate permissions", "AdminRequired")
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

	c.Err = model.NewAppError(where, "You do not have the appropriate permissions", "userId="+userId)
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

	c.Err = model.NewAppError(where, "You do not have the appropriate permissions", "userId="+c.Session.UserId+", teamId="+teamId)
	c.Err.StatusCode = http.StatusForbidden
	return false
}

func (c *Context) HasPermissionsToChannel(sc store.StoreChannel, where string) bool {
	if cresult := <-sc; cresult.Err != nil {
		c.Err = cresult.Err
		return false
	} else if cresult.Data.(int64) != 1 {
		c.Err = model.NewAppError(where, "You do not have the appropriate permissions", "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return false
	}

	return true
}

func (c *Context) HasSystemAdminPermissions(where string) bool {
	if c.IsSystemAdmin() {
		return true
	}

	c.Err = model.NewAppError(where, "You do not have the appropriate permissions (system)", "userId="+c.Session.UserId)
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

	// multiToken := ""
	// if oldMultiCookie, err := r.Cookie(model.SESSION_COOKIE_TOKEN); err == nil {
	// 	multiToken = oldMultiCookie.Value
	// }

	// multiCookie := &http.Cookie{
	// 	Name:     model.SESSION_COOKIE_TOKEN,
	// 	Value:    strings.TrimSpace(strings.Replace(multiToken, c.Session.Token, "", -1)),
	// 	Path:     "/",
	// 	MaxAge:   model.SESSION_TIME_WEB_IN_SECS,
	// 	HttpOnly: true,
	// }

	//http.SetCookie(w, multiCookie)

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
	c.Err = model.NewAppError(where, "Invalid "+name+" parameter", "")
	c.Err.StatusCode = http.StatusBadRequest
}

func (c *Context) SetUnknownError(where string, details string) {
	c.Err = model.NewAppError(where, "An unknown error has occured. Please contact support.", details)
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
			l4g.Debug("TeamURL accessed when not valid. Team URL should not be used in api functions or those that are team independent")
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
	props := make(map[string]string)
	props["Message"] = err.Message
	props["Details"] = err.DetailedError

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) > 1 {
		props["SiteURL"] = GetProtocol(r) + "://" + r.Host + "/" + pathParts[1]
	} else {
		props["SiteURL"] = GetProtocol(r) + "://" + r.Host
	}

	w.WriteHeader(err.StatusCode)
	ServerTemplates.ExecuteTemplate(w, "error.html", Page{Props: props, ClientCfg: utils.ClientCfg})
}

func Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewAppError("Handle404", "Sorry, we could not find the page.", "")
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
			l4g.Error("Invalid session token=" + token + ", err=" + sessionResult.Err.DetailedError)
		} else {
			session = sessionResult.Data.(*model.Session)
		}
	}

	return session
}

func GetMultiSessionCookieTokens(r *http.Request) []string {
	if multiCookie, err := r.Cookie(model.SESSION_COOKIE_TOKEN); err == nil {
		multiToken := multiCookie.Value

		if len(multiToken) > 0 {
			return strings.Split(multiToken, " ")
		}
	}

	return []string{}
}

func FindMultiSessionForTeamId(r *http.Request, teamId string) (int64, *model.Session) {
	for index, token := range GetMultiSessionCookieTokens(r) {
		s := GetSession(token)
		if s != nil && !s.IsExpired() && s.TeamId == teamId {
			return int64(index), s
		}
	}

	return -1, nil
}

func AddSessionToCache(session *model.Session) {
	sessionCache.Add(session.Token, session)
}
