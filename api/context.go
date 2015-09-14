// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

var sessionCache *utils.Cache = utils.NewLru(model.SESSION_CACHE_SIZE)

type Context struct {
	Session      model.Session
	RequestId    string
	IpAddress    string
	Path         string
	Err          *model.AppError
	teamURLValid bool
	teamURL      string
	siteURL      string
}

type Page struct {
	TemplateName  string
	Title         string
	SiteName      string
	FeedbackEmail string
	SiteURL       string
	Props         map[string]string
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

	protocol := "http"

	// if the request came from the ELB then assume this is produciton
	// and redirect all http requests to https
	if utils.Cfg.ServiceSettings.UseSSL {
		forwardProto := r.Header.Get(model.HEADER_FORWARDED_PROTO)
		if forwardProto == "http" {
			l4g.Info("redirecting http request to https for %v", r.URL.Path)
			http.Redirect(w, r, "https://"+r.Host, http.StatusTemporaryRedirect)
			return
		} else {
			protocol = "https"
		}
	}

	c.setSiteURL(protocol + "://" + r.Host)

	w.Header().Set(model.HEADER_REQUEST_ID, c.RequestId)
	w.Header().Set(model.HEADER_VERSION_ID, utils.Cfg.ServiceSettings.Version)

	// Instruct the browser not to display us in an iframe for anti-clickjacking
	if !h.isApi {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "frame-ancestors none")
	} else {
		// All api response bodies will be JSON formatted
		w.Header().Set("Content-Type", "application/json")
	}

	sessionId := ""

	// attempt to parse the session token from the header
	if ah := r.Header.Get(model.HEADER_AUTH); ah != "" {
		if len(ah) > 6 && strings.ToUpper(ah[0:6]) == "BEARER" {
			sessionId = ah[7:]
		}
	}

	// attempt to parse the session token from the cookie
	if sessionId == "" {
		if cookie, err := r.Cookie(model.SESSION_TOKEN); err == nil {
			sessionId = cookie.Value
		}
	}

	if sessionId != "" {

		var session *model.Session
		if ts, ok := sessionCache.Get(sessionId); ok {
			session = ts.(*model.Session)
		}

		if session == nil {
			if sessionResult := <-Srv.Store.Session().Get(sessionId); sessionResult.Err != nil {
				c.LogError(model.NewAppError("ServeHTTP", "Invalid session", "id="+sessionId+", err="+sessionResult.Err.DetailedError))
			} else {
				session = sessionResult.Data.(*model.Session)
			}
		}

		if session == nil || session.IsExpired() {
			c.RemoveSessionCookie(w)
			c.Err = model.NewAppError("ServeHTTP", "Invalid or expired session, please login again.", "id="+sessionId)
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

	if c.Err == nil && h.isUserActivity && sessionId != "" && len(c.Session.UserId) > 0 {
		go func() {
			if err := (<-Srv.Store.User().UpdateUserAndSessionActivity(c.Session.UserId, sessionId, model.GetMillis())).Err; err != nil {
				l4g.Error("Failed to update LastActivityAt for user_id=%v and session_id=%v, err=%v", c.Session.UserId, sessionId, err)
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

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.Session.UserId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.AltId}
	if r := <-Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {

	if len(c.Session.UserId) > 0 {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.Session.UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.AltId}
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

func (c *Context) IsSystemAdmin() bool {
	// TODO XXX FIXME && IsPrivateIpAddress(c.IpAddress)
	if model.IsInRole(c.Session.Roles, model.ROLE_SYSTEM_ADMIN) {
		return true
	}
	return false
}

func (c *Context) IsTeamAdmin(userId string) bool {
	if uresult := <-Srv.Store.User().Get(userId); uresult.Err != nil {
		c.Err = uresult.Err
		return false
	} else {
		user := uresult.Data.(*model.User)
		return model.IsInRole(c.Session.Roles, model.ROLE_TEAM_ADMIN) && user.TeamId == c.Session.TeamId
	}
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter) {

	sessionCache.Remove(c.Session.Id)

	cookie := &http.Cookie{
		Name:     model.SESSION_TOKEN,
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

func (c *Context) setTeamURLFromSession() {
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
		c.setTeamURLFromSession()
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
	&net.IPNet{IP: net.IPv4(10, 0, 0, 1), Mask: net.IPv4Mask(255, 0, 0, 0)},
	&net.IPNet{IP: net.IPv4(176, 16, 0, 1), Mask: net.IPv4Mask(255, 255, 0, 0)},
	&net.IPNet{IP: net.IPv4(192, 168, 0, 1), Mask: net.IPv4Mask(255, 255, 255, 0)},
	&net.IPNet{IP: net.IPv4(127, 0, 0, 1), Mask: net.IPv4Mask(255, 255, 255, 252)},
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

	protocol := "http"
	if utils.Cfg.ServiceSettings.UseSSL {
		forwardProto := r.Header.Get(model.HEADER_FORWARDED_PROTO)
		if forwardProto != "http" {
			protocol = "https"
		}
	}

	SiteURL := protocol + "://" + r.Host

	m := make(map[string]string)
	m["Message"] = err.Message
	m["Details"] = err.DetailedError
	m["SiteName"] = utils.Cfg.ServiceSettings.SiteName
	m["SiteURL"] = SiteURL

	w.WriteHeader(err.StatusCode)
	ServerTemplates.ExecuteTemplate(w, "error.html", m)
}

func Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewAppError("Handle404", "Sorry, we could not find the page.", "")
	err.StatusCode = http.StatusNotFound
	l4g.Error("%v: code=404 ip=%v", r.URL.Path, GetIpAddress(r))
	RenderWebError(err, w, r)
}
