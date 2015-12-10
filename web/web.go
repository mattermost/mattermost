// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/i18n"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"github.com/mssola/user_agent"
	"gopkg.in/fsnotify.v1"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"io/ioutil"
)

var languages = [2]string{"es", "en"}
var jsonMessages map[string]string = map[string]string{}

var Templates *template.Template

type HtmlTemplatePage api.Page

func NewHtmlTemplatePage(templateName string, title string) *HtmlTemplatePage {

	if len(title) > 0 {
		title = utils.Cfg.TeamSettings.SiteName + " - " + title
	}

	props := make(map[string]string)
	props["Title"] = title
	return &HtmlTemplatePage{TemplateName: templateName, Props: props, ClientCfg: utils.ClientCfg}
}

func (me *HtmlTemplatePage) Render(c *api.Context, w http.ResponseWriter, T goi18n.TranslateFunc) {
	if me.Team != nil {
		me.Team.Sanitize()
	}

	if me.User != nil {
		me.User.Sanitize(map[string]bool{})
	}

	me.SessionTokenIndex = c.SessionTokenIndex

	if err := Templates.ExecuteTemplate(w, me.TemplateName, me); err != nil {
		c.SetUnknownError(me.TemplateName, err.Error(), T)
	}
}

func InitWeb() {
	l4g.Debug("Initializing web routes")

	mainrouter := api.Srv.Router

	staticDir := utils.FindDir("web/static")
	l4g.Debug("Using static directory at %v", staticDir)
	mainrouter.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	mainrouter.Handle("/", api.AppHandlerIndependent(ping)).Methods("HEAD")
	mainrouter.Handle("/", api.AppHandlerIndependent(root)).Methods("GET")
	mainrouter.Handle("/oauth/authorize", api.UserRequired(authorizeOAuth)).Methods("GET")
	mainrouter.Handle("/oauth/access_token", api.ApiAppHandler(getAccessToken)).Methods("POST")

	mainrouter.Handle("/signup_team_complete/", api.AppHandlerIndependent(signupTeamComplete)).Methods("GET")
	mainrouter.Handle("/signup_user_complete/", api.AppHandlerIndependent(signupUserComplete)).Methods("GET")
	mainrouter.Handle("/signup_team_confirm/", api.AppHandlerIndependent(signupTeamConfirm)).Methods("GET")
	mainrouter.Handle("/verify_email", api.AppHandlerIndependent(verifyEmail)).Methods("GET")
	mainrouter.Handle("/find_team", api.AppHandlerIndependent(findTeam)).Methods("GET")
	mainrouter.Handle("/signup_team", api.AppHandlerIndependent(signup)).Methods("GET")
	mainrouter.Handle("/login/{service:[A-Za-z]+}/complete", api.AppHandlerIndependent(loginCompleteOAuth)).Methods("GET")
	mainrouter.Handle("/signup/{service:[A-Za-z]+}/complete", api.AppHandlerIndependent(signupCompleteOAuth)).Methods("GET")

	mainrouter.Handle("/admin_console", api.UserRequired(adminConsole)).Methods("GET")
	mainrouter.Handle("/admin_console/", api.UserRequired(adminConsole)).Methods("GET")
	mainrouter.Handle("/admin_console/{tab:[A-Za-z0-9-_]+}", api.UserRequired(adminConsole)).Methods("GET")
	mainrouter.Handle("/admin_console/{tab:[A-Za-z0-9-_]+}/{team:[A-Za-z0-9-]*}", api.UserRequired(adminConsole)).Methods("GET")

	mainrouter.Handle("/hooks/{id:[A-Za-z0-9]+}", api.ApiAppHandler(incomingWebhook)).Methods("POST")

	mainrouter.Handle("/docs/{doc:[A-Za-z0-9]+}", api.AppHandlerIndependent(docs)).Methods("GET")

	// ----------------------------------------------------------------------------------------------
	// *ANYTHING* team specific should go below this line
	// ----------------------------------------------------------------------------------------------

	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}", api.AppHandler(login)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/", api.AppHandler(login)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/login", api.AppHandler(login)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/logout", api.AppHandler(logout)).Methods("GET")
	mainrouter.Handle("/{team:[A-Za-z0-9-]+(__)?[A-Za-z0-9-]+}/reset_password", api.AppHandler(resetPassword)).Methods("GET")
	mainrouter.Handle("/login/{service}", api.AppHandler(loginWithOAuth)).Methods("GET")             // Bug in gorilla.mux prevents us from using regex here.
	mainrouter.Handle("/{team}/pl/{postid}", api.AppHandler(postPermalink)).Methods("GET")         // Bug in gorilla.mux prevents us from using regex here.
	mainrouter.Handle("/{team}/channels/{channelname}", api.UserRequired(getChannel)).Methods("GET") // Bug in gorilla.mux prevents us from using regex here.
	mainrouter.Handle("/{team}/signup/{service}", api.AppHandler(signupWithOAuth)).Methods("GET")    // Bug in gorilla.mux prevents us from using regex here.
	mainrouter.Handle("/zimbra/{email}/{token}", api.AppHandler(zimbra)).Methods("GET")

	watchAndParseTemplates()
	loadLanguages()
}

func loadLanguages() {
	lenght := len(languages)
	for i:= 0; i < lenght; i++ {
		lang := languages[i]
		fileName := "./web/i18n/" + lang +".json"
		raw, err := ioutil.ReadFile(fileName)
		if err != nil {
			l4g.Error("Error opening file=" + fileName + ", err=" + err.Error())
		}
		jsonMessages[lang] = string(raw)
		l4g.Info("Loaded Language file from %v", fileName)
	}
}

func watchAndParseTemplates() {

	templatesDir := utils.FindDir("web/templates")
	l4g.Debug("Parsing templates at %v", templatesDir)
	var err error
	if Templates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
		l4g.Error("Failed to parse templates %v", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		l4g.Error("Failed to create directory watcher %v", err)
	}

	go func() {
		for {
			select {
			case event := <-watcher.Events:
				if event.Op&fsnotify.Write == fsnotify.Write {
					l4g.Info("Re-parsing templates because of modified file %v", event.Name)
					if Templates, err = template.ParseGlob(templatesDir + "*.html"); err != nil {
						l4g.Error("Failed to parse templates %v", err)
					}
				}
			case err := <-watcher.Errors:
				l4g.Error("Failed in directory watcher %v", err)
			}
		}
	}()

	err = watcher.Add(templatesDir)
	if err != nil {
		l4g.Error("Failed to add directory to watcher %v", err)
	}
}

var browsersNotSupported string = "MSIE/8;MSIE/9;MSIE/10;Internet Explorer/8;Internet Explorer/9;Internet Explorer/10;Safari/7;Safari/8"

func CheckBrowserCompatability(c *api.Context, w http.ResponseWriter,  r *http.Request) bool {
	T := i18n.Language(w, r)
	ua := user_agent.New(r.UserAgent())
	bname, bversion := ua.Browser()

	browsers := strings.Split(browsersNotSupported, ";")
	for _, browser := range browsers {
		version := strings.Split(browser, "/")

		if strings.HasPrefix(bname, version[0]) && strings.HasPrefix(bversion, version[1]) {
			c.Err = model.NewAppError("CheckBrowserCompatability", T("Your current browser is not supported, please upgrade to one of the following browsers: Google Chrome 21 or higher, Internet Explorer 10 or higher, FireFox 14 or higher"), "")
			return false
		}
	}

	return true

}

func ping(c *api.Context, w http.ResponseWriter, r *http.Request) {

}

func root(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T,lang  := i18n.GetLanguage(w, r)

	if !CheckBrowserCompatability(c, w, r) {
		return
	}

	if len(c.Session.UserId) == 0 {
//		page := NewHtmlTemplatePage("signup_team", "Signup")
//
//		if result := <-api.Srv.Store.Team().GetAllTeamListing(); result.Err != nil {
//			c.Err = result.Err
//			return
//		} else {
//			teams := result.Data.([]*model.Team)
//			for _, team := range teams {
//				page.Props[team.Name] = team.DisplayName
//			}
//
//			if len(teams) == 1 && *utils.Cfg.TeamSettings.EnableTeamListing && !utils.Cfg.TeamSettings.EnableTeamCreation {
//				http.Redirect(w, r, c.GetSiteURL()+"/"+teams[0].Name, http.StatusTemporaryRedirect)
//				return
//			}
//		}
//
//		page.Render(c, w)
		http.Redirect(w, r, "/login/zbox", http.StatusTemporaryRedirect)
	} else {
		teamChan := api.Srv.Store.Team().Get(c.Session.TeamId, T)
		userChan := api.Srv.Store.User().Get(c.Session.UserId, T)

		var team *model.Team
		if tr := <-teamChan; tr.Err != nil {
			c.Err = tr.Err
			return
		} else {
			team = tr.Data.(*model.Team)

		}

		var user *model.User
		if ur := <-userChan; ur.Err != nil {
			c.Err = ur.Err
			return
		} else {
			user = ur.Data.(*model.User)
		}

		page := NewHtmlTemplatePage("home", T("Home"))
		page.Team = team
		page.User = user
		page.Render(c, w, T)
		page.Props["TeamURL"] = c.GetTeamURL(T)
		page.Props["Locale"] = lang
		page.Props["Messages"] = jsonMessages[lang]
		setTeamCookie(w, c.GetTeamName())
		page.Render(c, w, T)
	}
}

func signup(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	if !CheckBrowserCompatability(c, w, r) {
		return
	}

	page := NewHtmlTemplatePage(T("signup_team"), T("Signup"))
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func login(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)

	if !CheckBrowserCompatability(c, w, r) {
		return
	}
	params := mux.Vars(r)
	teamName := params["team"]

	var team *model.Team
	if tResult := <-api.Srv.Store.Team().GetByName(teamName, T); tResult.Err != nil {
		l4g.Error("Couldn't find team name=%v, err=%v", teamName, tResult.Err.Message)
		http.Redirect(w, r, api.GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
		return
	} else {
		team = tResult.Data.(*model.Team)
	}

	// We still might be able to switch to this team because we've logged in before
	_, session := api.FindMultiSessionForTeamId(r, team.Id, T)
	if session != nil {
		w.Header().Set(model.HEADER_TOKEN, session.Token)
		http.Redirect(w, r, c.GetSiteURL()+"/"+team.Name+"/channels/general", http.StatusTemporaryRedirect)
		return
	}

	page := NewHtmlTemplatePage(T("login"), T("Login"))
	page.Props["TeamDisplayName"] = team.DisplayName
	page.Props["TeamName"] = team.Name
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]

	if team.AllowOpenInvite {
		page.Props["InviteId"] = team.InviteId
	}

	page.Render(c, w, T)
}

func signupTeamConfirm(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	email := r.FormValue("email")

	page := NewHtmlTemplatePage(T("signup_team_confirm"), T("Signup Email Sent"))
	page.Props["Email"] = email
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func signupTeamComplete(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	data := r.FormValue("d")
	hash := r.FormValue("h")

	if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
		c.Err = model.NewAppError("signupTeamComplete", T("The signup link does not appear to be valid"), "")
		return
	}

	props := model.MapFromJson(strings.NewReader(data))

	t, err := strconv.ParseInt(props["time"], 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60*24*30 { // 30 days
		c.Err = model.NewAppError("signupTeamComplete", T("The signup link has expired"), "")
		return
	}

	page := NewHtmlTemplatePage(T("signup_team_complete"), T("Complete Team Sign Up"))
	page.Props["Email"] = props["email"]
	page.Props["Data"] = data
	page.Props["Hash"] = hash
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func signupUserComplete(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	id := r.FormValue("id")
	data := r.FormValue("d")
	hash := r.FormValue("h")
	var props map[string]string

	if len(id) > 0 {
		props = make(map[string]string)

		if result := <-api.Srv.Store.Team().GetByInviteId(id, T); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			team := result.Data.(*model.Team)
			if !(team.Type == model.TEAM_OPEN || (team.Type == model.TEAM_INVITE && len(team.AllowedDomains) > 0)) {
				c.Err = model.NewAppError("signupUserComplete", T("The team type doesn't allow open invites"), "id="+id)
				return
			}

			props["email"] = ""
			props["display_name"] = team.DisplayName
			props["name"] = team.Name
			props["id"] = team.Id
			data = model.MapToJson(props)
			hash = ""
		}
	} else {

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewAppError("signupTeamComplete", T("The signup link does not appear to be valid"), "")
			return
		}

		props = model.MapFromJson(strings.NewReader(data))

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hour
			c.Err = model.NewAppError("signupTeamComplete", T("The signup link has expired"), "")
			return
		}
	}

	page := NewHtmlTemplatePage(T("signup_user_complete"), T("Complete User Sign Up"))
	page.Props["Email"] = props["email"]
	page.Props["TeamDisplayName"] = props["display_name"]
	page.Props["TeamName"] = props["name"]
	page.Props["TeamId"] = props["id"]
	page.Props["Data"] = data
	page.Props["Hash"] = hash
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func logout(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	api.Logout(c, w, r)
	http.Redirect(w, r, c.GetTeamURL(T), http.StatusTemporaryRedirect)
}

func postPermalink(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	teamName := params["team"]
	postId := params["postid"]

	if len(postId) != 26 {
		c.Err = model.NewAppError("postPermalink", "Invalid Post ID", "id="+postId)
		return
	}

	team := checkSessionSwitch(c, w, r, teamName)
	if team == nil {
		// Error already set by getTeam
		return
	}

	var post *model.Post
	if result := <-api.Srv.Store.Post().Get(postId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		postlist := result.Data.(*model.PostList)
		post = postlist.Posts[postlist.Order[0]]
	}

	var channel *model.Channel
	if result := <-api.Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, post.ChannelId, c.Session.UserId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if result.Data.(int64) == 0 {
			if channel = autoJoinChannelId(c, w, r, post.ChannelId); channel == nil {
				http.Redirect(w, r, c.GetTeamURL(T)+"/channels/general", http.StatusFound)
				return
			}
		} else {
			if result := <-api.Srv.Store.Channel().Get(post.ChannelId, T); result.Err != nil {
				c.Err = result.Err
				return
			} else {
				channel = result.Data.(*model.Channel)
			}
		}
	}

	doLoadChannel(c, w, r, team, channel, post.Id)
}

func getChannel(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	name := params["channelname"]
	teamName := params["team"]

	team := checkSessionSwitch(c, w, r, teamName)
	if team == nil {
		// Error already set by getTeam
		return
	}

	var channel *model.Channel
	if result := <-api.Srv.Store.Channel().CheckPermissionsToByName(c.Session.TeamId, name, c.Session.UserId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		channelId := result.Data.(string)
		if len(channelId) == 0 {
			if channel = autoJoinChannelName(c, w, r, name); channel == nil {
				http.Redirect(w, r, c.GetTeamURL(T)+"/channels/general", http.StatusFound)
				return
			}
		} else {
			if result := <-api.Srv.Store.Channel().Get(channelId, T); result.Err != nil {
				c.Err = result.Err
				return
			} else {
				channel = result.Data.(*model.Channel)
			}
		}
	}

	doLoadChannel(c, w, r, team, channel, "")
}

func autoJoinChannelName(c *api.Context, w http.ResponseWriter, r *http.Request, channelName string) *model.Channel {
	T := i18n.Language(w, r)
	if strings.Index(channelName, "__") > 0 {
		// It's a direct message channel that doesn't exist yet so let's create it
		ids := strings.Split(channelName, "__")
		otherUserId := ""
		if ids[0] == c.Session.UserId {
			otherUserId = ids[1]
		} else {
			otherUserId = ids[0]
		}

		if sc, err := api.CreateDirectChannel(c, otherUserId, T); err != nil {
			api.Handle404(w, r)
			return nil
		} else {
			return sc
		}
	} else {
		// We will attempt to auto-join open channels
		return joinOpenChannel(c, w, r, api.Srv.Store.Channel().GetByName(c.Session.TeamId, channelName, T))
	}

	return nil
}

func autoJoinChannelId(c *api.Context, w http.ResponseWriter, r *http.Request, channelId string) *model.Channel {
	T := i18n.Language(w, r)
	return joinOpenChannel(c, w, r, api.Srv.Store.Channel().Get(channelId, T))
}

func joinOpenChannel(c *api.Context, w http.ResponseWriter, r *http.Request, channel store.StoreChannel) *model.Channel {
	T := i18n.Language(w, r)
	if cr := <-channel; cr.Err != nil {
		http.Redirect(w, r, c.GetTeamURL(T)+"/channels/general", http.StatusFound)
		return nil
	} else {
		channel := cr.Data.(*model.Channel)
		if channel.Type == model.CHANNEL_OPEN {
			api.JoinChannel(c, channel.Id, "", T)
			if c.Err != nil {
				return nil
			}
		} else {
			http.Redirect(w, r, c.GetTeamURL(T)+"/channels/general", http.StatusFound)
			return nil
		}
		return channel
	}
}

func checkSessionSwitch(c *api.Context, w http.ResponseWriter, r *http.Request, teamName string) *model.Team {
	T := i18n.Language(w, r)
	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(teamName, T); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		team = result.Data.(*model.Team)
	}

	// We are logged into a different team.  Lets see if we have another
	// session in the cookie that will give us access.
	if c.Session.TeamId != team.Id {
		index, session := api.FindMultiSessionForTeamId(r, team.Id, T)
		if session == nil {
			// redirect to login
			http.Redirect(w, r, c.GetSiteURL()+"/"+team.Name+"/?redirect="+url.QueryEscape(r.URL.Path), http.StatusTemporaryRedirect)
		} else {
			c.Session = *session
			c.SessionTokenIndex = index
		}
	}

	return team
}

func doLoadChannel(c *api.Context, w http.ResponseWriter, r *http.Request, team *model.Team, channel *model.Channel, postid string) {
	T, lang := i18n.GetLanguage(w, r)
	userChan := api.Srv.Store.User().Get(c.Session.UserId, T)

	var user *model.User
	if ur := <-userChan; ur.Err != nil {
		c.Err = ur.Err
		c.RemoveSessionCookie(w, r)
		l4g.Error("Error in getting users profile for id=%v forcing logout", c.Session.UserId)
		return
	} else {
		user = ur.Data.(*model.User)
	}

	setTeamCookie(w, team.Name)

	page := NewHtmlTemplatePage("channel", "")
	page.Props["Title"] = channel.DisplayName + " - " + team.DisplayName + " " + page.ClientCfg["SiteName"]
	page.Props["TeamDisplayName"] = team.DisplayName
	page.Props["ChannelName"] = channel.Name
	page.Props["ChannelId"] = channel.Id
	page.Props["PostId"] = postid
	page.Team = team
	page.User = user
	page.Channel = channel
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func verifyEmail(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	resend := r.URL.Query().Get("resend")
	resendSuccess := r.URL.Query().Get("resend_success")
	name := r.URL.Query().Get("teamname")
	email := r.URL.Query().Get("email")
	hashedId := r.URL.Query().Get("hid")
	userId := r.URL.Query().Get("uid")

	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(name, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	if resend == "true" {
		if result := <-api.Srv.Store.User().GetByEmail(team.Id, email, T); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			user := result.Data.(*model.User)

			if user.LastActivityAt > 0 {
				api.SendEmailChangeVerifyEmailAndForget(user.Id, user.Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team), T)
			} else {
				api.SendVerifyEmailAndForget(user.Id, user.Email, team.Name, team.DisplayName, c.GetSiteURL(), c.GetTeamURLFromTeam(team), T)
			}

			newAddress := strings.Replace(r.URL.String(), "&resend=true", "&resend_success=true", -1)
			http.Redirect(w, r, newAddress, http.StatusFound)
			return
		}
	}

	if len(userId) == 26 && len(hashedId) != 0 && model.ComparePassword(hashedId, userId) {
		if c.Err = (<-api.Srv.Store.User().VerifyEmail(userId, T)).Err; c.Err != nil {
			return
		} else {
			c.LogAudit("Email Verified", T)
			http.Redirect(w, r, api.GetProtocol(r)+"://"+r.Host+"/"+name+"/login?verified=true&email="+email, http.StatusTemporaryRedirect)
			return
		}
	}

	page := NewHtmlTemplatePage("verify", T("Email Verified"))
	page.Props["TeamURL"] = c.GetTeamURLFromTeam(team)
	page.Props["UserEmail"] = email
	page.Props["ResendSuccess"] = resendSuccess
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func findTeam(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)

	page := NewHtmlTemplatePage(T("find_team"), T("Find Team"))
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func docs(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	params := mux.Vars(r)
	doc := params["doc"]

	page := NewHtmlTemplatePage("docs", "Documentation")
	page.Props["Site"] = doc
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func resetPassword(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	isResetLink := true
	hash := r.URL.Query().Get("h")
	data := r.URL.Query().Get("d")
	params := mux.Vars(r)
	teamName := params["team"]

	if len(hash) == 0 || len(data) == 0 {
		isResetLink = false
	} else {
		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.PasswordResetSalt)) {
			c.Err = model.NewAppError("resetPassword", T("The reset link does not appear to be valid"), "")
			return
		}

		props := model.MapFromJson(strings.NewReader(data))

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
			c.Err = model.NewAppError("resetPassword", T("The signup link has expired"), "")
			return
		}
	}

	teamDisplayName := "Developer/Beta"
	var team *model.Team
	if tResult := <-api.Srv.Store.Team().GetByName(teamName, T); tResult.Err != nil {
		c.Err = tResult.Err
		return
	} else {
		team = tResult.Data.(*model.Team)
	}

	if team != nil {
		teamDisplayName = team.DisplayName
	}

	page := NewHtmlTemplatePage("password_reset", "")
	page.Props["Title"] = T("Reset Password ") + page.ClientCfg["SiteName"]
	page.Props["TeamDisplayName"] = teamDisplayName
	page.Props["TeamName"] = teamName
	page.Props["Hash"] = hash
	page.Props["Data"] = data
	page.Props["TeamName"] = teamName
	page.Props["IsReset"] = strconv.FormatBool(isResetLink)
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func zimbra(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	email := params["email"]
	token := params["token"]

	if body, err := api.ZimbraAuth("zbox", email, token, T); err != nil {
		c.Err = err
		return
	} else {
		authData := ""
		teamName := ""
		var user *model.User
		zbu := model.ZboxUserFromJson(body)
		teamName = zbu.Team
		authData = zbu.Email
		user = model.UserFromZBoxUser(zbu)

		if len(authData) == 0 {
			c.Err = model.NewAppError("zimbraAuth", T("Could not parse auth data out of zbox user object"), "")
			return
		}

		if len(teamName) == 0 {
			c.Err = model.NewAppError("zimbraAuth", T("Invalid team name"), "team_name="+teamName)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if !zbu.Enabled || !zbu.ChatEnabled {
			c.Err = model.NewAppError("zimbraAuth", T("Your user is not authorized to use the Chat app"), "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		// Make sure team exists
		tchan := <-api.Srv.Store.Team().GetByName(teamName, T)
		if tchan.Err != nil {
			c.Err = tchan.Err
			return
		}

		team := tchan.Data.(*model.Team)

		if result := <-api.Srv.Store.User().GetByAuth(team.Id, authData, "zbox", T); result.Err != nil {
			if user != nil {
				signUpAndLogin(c, w, r, team, user, "zbox")
				return
			} else {
				c.Err = result.Err
				return
			}
		} else {
			user = result.Data.(*model.User)
			api.Login(c, w, r, user, "")

			if c.Err != nil {
				return
			}

			root(c, w, r)
		}
	}
}

func signupWithOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	service := params["service"]
	teamName := params["team"]

	if len(teamName) == 0 {
		c.Err = model.NewAppError("signupWithOAuth", T("Invalid team name"), "team_name="+teamName)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	hash := r.URL.Query().Get("h")

	var team *model.Team
	if result := <-api.Srv.Store.Team().GetByName(teamName, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	if api.IsVerifyHashRequired(nil, team, hash) {
		data := r.URL.Query().Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewAppError("signupWithOAuth", T("The signup link does not appear to be valid"), "")
			return
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			c.Err = model.NewAppError("signupWithOAuth", T("The signup link has expired"), "")
			return
		}

		if team.Id != props["id"] {
			c.Err = model.NewAppError("signupWithOAuth", T("Invalid team name"), data)
			return
		}
	}

	redirectUri := c.GetSiteURL() + "/signup/" + service + "/complete"

	api.GetAuthorizationCode(c, w, r, teamName, service, redirectUri, "")
}

func signupCompleteOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	service := params["service"]
	teamName := ""

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	uri := c.GetSiteURL() + "/signup/" + service + "/complete"

	if body, err := api.AuthorizeOAuthUser(service, code, state, uri, T); err != nil {
		c.Err = err
		return
	} else {
		var user *model.User
		if service == model.USER_AUTH_SERVICE_GITLAB {
			glu := model.GitLabUserFromJson(body)
			user = model.UserFromGitLabUser(glu)
		} else if service == model.USER_AUTH_SERVICE_ZBOX {
			zbu := model.ZboxUserFromJson(body)
			user = model.UserFromZBoxUser(zbu)
			teamName = zbu.Team
		}

		if user == nil {
			c.Err = model.NewAppError("signupCompleteOAuth", T("Could not create user out of ")+service+T(" user object"), "")
			return
		}

		if len(teamName) == 0 {
			c.Err = model.NewAppError("loginWithOAuth", T("Invalid team name"), "team_name="+teamName)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		// Make sure team exists
		tchan := <-api.Srv.Store.Team().GetByName(teamName, T)
		if tchan.Err != nil {
			c.Err = tchan.Err
			return
		}

		team := tchan.Data.(*model.Team)

		suchan := api.Srv.Store.User().GetByAuth(team.Id, user.AuthData, service, T)
		if result := <-suchan; result.Err == nil {
			c.Err = model.NewAppError("signupCompleteOAuth", T("This ")+service+T(" account has already been used to sign up for team ")+team.DisplayName, "email="+user.Email)
			return
		}
		signUpAndLogin(c, w, r, team, user, service)
		return
	}
}

func loginWithOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	teamName := ""
	loginHint := r.URL.Query().Get("login_hint")

	redirectUri := c.GetSiteURL() + "/login/" + service + "/complete"

	api.GetAuthorizationCode(c, w, r, teamName, service, redirectUri, loginHint)
}

func loginCompleteOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	params := mux.Vars(r)
	service := params["service"]
	teamName := ""

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	uri := c.GetSiteURL() + "/login/" + service + "/complete"

	if body, err := api.AuthorizeOAuthUser(service, code, state, uri, T); err != nil {
		c.Err = err
		return
	} else {
		authData := ""
		var user *model.User
		var zbu *model.ZBoxUser
		if service == model.USER_AUTH_SERVICE_GITLAB {
			glu := model.GitLabUserFromJson(body)
			authData = glu.GetAuthData()
		} else if service == model.USER_AUTH_SERVICE_ZBOX {
			zbu = model.ZboxUserFromJson(body)
			teamName = zbu.Team
			authData = zbu.Email
			user = model.UserFromZBoxUser(zbu)
		}

		if len(authData) == 0 {
			c.Err = model.NewAppError("loginCompleteOAuth", T("Could not parse auth data out of ")+service+T(" user object"), "")
			return
		}

		if len(teamName) == 0 {
			c.Err = model.NewAppError("loginWithOAuth", T("Invalid team name"), "team_name="+teamName)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if !zbu.Enabled || !zbu.ChatEnabled {
			c.Err = model.NewAppError("zimbraAuth", T("Your user is not authorized to use the Chat app"), "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		// Make sure team exists
		tchan := <-api.Srv.Store.Team().GetByName(teamName, T)
		if tchan.Err != nil {
			c.Err = tchan.Err
			return
		}

		team := tchan.Data.(*model.Team)

		if result := <-api.Srv.Store.User().GetByAuth(team.Id, authData, service, T); result.Err != nil {
			if user != nil {
				signUpAndLogin(c, w, r, team, user, service)
				return
			} else {
				c.Err = result.Err
				return
			}
		} else {
			user = result.Data.(*model.User)
			api.Login(c, w, r, user, "")

			if c.Err != nil {
				return
			}

//			page := NewHtmlTemplatePage("home", "Home")
//			page.Team = team
//			page.User = user
//			page.Render(c, w)

			root(c, w, r)
		}
	}
}

func signUpAndLogin(c *api.Context, w http.ResponseWriter, r *http.Request, team *model.Team, user *model.User, service string) {
	T := i18n.Language(w, r)
	euchan := api.Srv.Store.User().GetByEmail(team.Id, user.Email, T)

	if result := <-euchan; result.Err == nil {
		c.Err = model.NewAppError("signupCompleteOAuth", T("Team ")+team.DisplayName+T(" already has a user with the email address attached to your ")+service+" account", "email="+user.Email)
		return
	}

	if team.Email == "" {
		team.Email = user.Email
		if result := <-api.Srv.Store.Team().Update(team, T); result.Err != nil {
			c.Err = result.Err
			return
		}
	} else {
		found := true
		count := 0
		for found {
			if found = api.IsUsernameTaken(user.Username, team.Id, T); c.Err != nil {
				return
			} else if found {
				user.Username = user.Username + strconv.Itoa(count)
				count += 1
			}
		}
	}
	user.TeamId = team.Id
	user.EmailVerified = true
	if cookie, err := r.Cookie(model.SESSION_LANGUAGE); err != nil {
		user.Language = cookie.Value
	} else {
		user.Language = model.DEFAULT_LANGUAGE
	}

	ruser := api.CreateUser(c, team, user, T)
	if c.Err != nil {
		return
	}

	setTeamCookie(w, team.Name)
	api.Login(c, w, r, ruser, "")

	if c.Err != nil {
		return
	}

	root(c, w, r)
}

func adminConsole(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	if !c.HasSystemAdminPermissions("adminConsole", T) {
		return
	}

	teamChan := api.Srv.Store.Team().Get(c.Session.TeamId, T)
	userChan := api.Srv.Store.User().Get(c.Session.UserId, T)

	var team *model.Team
	if tr := <-teamChan; tr.Err != nil {
		c.Err = tr.Err
		return
	} else {
		team = tr.Data.(*model.Team)

	}

	var user *model.User
	if ur := <-userChan; ur.Err != nil {
		c.Err = ur.Err
		return
	} else {
		user = ur.Data.(*model.User)
	}

	params := mux.Vars(r)
	activeTab := params["tab"]
	teamId := params["team"]

	page := NewHtmlTemplatePage("admin_console", T("Admin Console"))
	page.User = user
	page.Team = team
	page.Props["ActiveTab"] = activeTab
	page.Props["TeamId"] = teamId
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}


func authorizeOAuth(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T, lang := i18n.GetLanguage(w, r)
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("authorizeOAuth", T("The system admin has turned off OAuth service providing."), "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if !CheckBrowserCompatability(c, w, r) {
		return
	}

	responseType := r.URL.Query().Get("response_type")
	clientId := r.URL.Query().Get("client_id")
	redirect := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	if len(responseType) == 0 || len(clientId) == 0 || len(redirect) == 0 {
		c.Err = model.NewAppError("authorizeOAuth", T("Missing one or more of response_type, client_id, or redirect_uri"), "")
		return
	}

	var app *model.OAuthApp
	if result := <-api.Srv.Store.OAuth().GetApp(clientId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	var team *model.Team
	if result := <-api.Srv.Store.Team().Get(c.Session.TeamId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	page := NewHtmlTemplatePage(T("authorize"), T("Authorize Application"))
	page.Props["TeamName"] = team.Name
	page.Props["AppName"] = app.Name
	page.Props["ResponseType"] = responseType
	page.Props["ClientId"] = clientId
	page.Props["RedirectUri"] = redirect
	page.Props["Scope"] = scope
	page.Props["State"] = state
	page.Props["Locale"] = lang
	page.Props["Messages"] = jsonMessages[lang]
	page.Render(c, w, T)
}

func getAccessToken(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("getAccessToken", T("The system admin has turned off OAuth service providing."), "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt", T)

	r.ParseForm()

	grantType := r.FormValue("grant_type")
	if grantType != model.ACCESS_TOKEN_GRANT_TYPE {
		c.Err = model.NewAppError("getAccessToken", T("invalid_request: Bad grant_type"), "")
		return
	}

	clientId := r.FormValue("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewAppError("getAccessToken", T("invalid_request: Bad client_id"), "")
		return
	}

	secret := r.FormValue("client_secret")
	if len(secret) == 0 {
		c.Err = model.NewAppError("getAccessToken", T("invalid_request: Missing client_secret"), "")
		return
	}

	code := r.FormValue("code")
	if len(code) == 0 {
		c.Err = model.NewAppError("getAccessToken", T("invalid_request: Missing code"), "")
		return
	}

	redirectUri := r.FormValue("redirect_uri")

	achan := api.Srv.Store.OAuth().GetApp(clientId, T)
	tchan := api.Srv.Store.OAuth().GetAccessDataByAuthCode(code, T)

	authData := api.GetAuthData(code, T)

	if authData == nil {
		c.LogAudit(T("fail - invalid auth code"), T)
		c.Err = model.NewAppError("getAccessToken", T("invalid_grant: Invalid or expired authorization code"), "")
		return
	}

	uchan := api.Srv.Store.User().Get(authData.UserId, T)

	if authData.IsExpired() {
		c.LogAudit(T("fail - auth code expired"), T)
		c.Err = model.NewAppError("getAccessToken", T("invalid_grant: Invalid or expired authorization code"), "")
		return
	}

	if authData.RedirectUri != redirectUri {
		c.LogAudit(T("fail - redirect uri provided did not match previous redirect uri"), T)
		c.Err = model.NewAppError("getAccessToken", T("invalid_request: Supplied redirect_uri does not match authorization code redirect_uri"), "")
		return
	}

	if !model.ComparePassword(code, fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, authData.UserId)) {
		c.LogAudit(T("fail - auth code is invalid"), T)
		c.Err = model.NewAppError("getAccessToken", T("invalid_grant: Invalid or expired authorization code"), "")
		return
	}

	var app *model.OAuthApp
	if result := <-achan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", T("invalid_client: Invalid client credentials"), "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !model.ComparePassword(app.ClientSecret, secret) {
		c.LogAudit(T("fail - invalid client credentials"), T)
		c.Err = model.NewAppError("getAccessToken", T("invalid_client: Invalid client credentials"), "")
		return
	}

	callback := redirectUri
	if len(callback) == 0 {
		callback = app.CallbackUrls[0]
	}

	if result := <-tchan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", T("server_error: Encountered internal server error while accessing database"), "")
		return
	} else if result.Data != nil {
		c.LogAudit(T("fail - auth code has been used previously"), T)
		accessData := result.Data.(*model.AccessData)

		// Revoke access token, related auth code, and session from DB as well as from cache
		if err := api.RevokeAccessToken(accessData.Token, T); err != nil {
			l4g.Error(T("Encountered an error revoking an access token, err=") + err.Message)
		}

		c.Err = model.NewAppError("getAccessToken", T("invalid_grant: Authorization code already exchanged for an access token"), "")
		return
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", T("server_error: Encountered internal server error while pulling user from database"), "")
		return
	} else {
		user = result.Data.(*model.User)
	}

	session := &model.Session{UserId: user.Id, TeamId: user.TeamId, Roles: user.Roles, IsOAuth: true}

	if result := <-api.Srv.Store.Session().Save(session, T); result.Err != nil {
		c.Err = model.NewAppError("getAccessToken", T("server_error: Encountered internal server error while saving session to database"), "")
		return
	} else {
		session = result.Data.(*model.Session)
		api.AddSessionToCache(session)
	}

	accessData := &model.AccessData{AuthCode: authData.Code, Token: session.Token, RedirectUri: callback}

	if result := <-api.Srv.Store.OAuth().SaveAccessData(accessData, T); result.Err != nil {
		l4g.Error(result.Err)
		c.Err = model.NewAppError("getAccessToken", T("server_error: Encountered internal server error while saving access token to database"), "")
		return
	}

	accessRsp := &model.AccessResponse{AccessToken: session.Token, TokenType: model.ACCESS_TOKEN_TYPE, ExpiresIn: model.SESSION_TIME_OAUTH_IN_SECS}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	c.LogAuditWithUserId(user.Id, "success", T)

	w.Write([]byte(accessRsp.ToJson()))
}

func incomingWebhook(c *api.Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !utils.Cfg.ServiceSettings.EnableIncomingWebhooks {
		c.Err = model.NewAppError("incomingWebhook", T("Incoming webhooks have been disabled by the system admin."), "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)
	id := params["id"]

	hchan := api.Srv.Store.Webhook().GetIncoming(id, T)

	r.ParseForm()

	var parsedRequest *model.IncomingWebhookRequest
	if r.Header.Get("Content-Type") == "application/json" {
		parsedRequest = model.IncomingWebhookRequestFromJson(r.Body)
	} else {
		parsedRequest = model.IncomingWebhookRequestFromJson(strings.NewReader(r.FormValue("payload")))
	}

	if parsedRequest == nil {
		c.Err = model.NewAppError("incomingWebhook", "Unable to parse incoming data", "")
		return
	}

	text := parsedRequest.Text
	if len(text) == 0 && parsedRequest.Attachments == nil {
		c.Err = model.NewAppError("incomingWebhook", "No text specified", "")
		return
	}

	channelName := parsedRequest.ChannelName
	webhookType := parsedRequest.Type

	//attachments is in here for slack compatibility
	if parsedRequest.Attachments != nil {
		if len(parsedRequest.Props) == 0 {
			parsedRequest.Props = make(model.StringInterface)
		}
		parsedRequest.Props["attachments"] = parsedRequest.Attachments
		webhookType = model.POST_SLACK_ATTACHMENT
	}

	var hook *model.IncomingWebhook
	if result := <-hchan; result.Err != nil {
		c.Err = model.NewAppError("incomingWebhook", T("Invalid webhook"), "err="+result.Err.Message)
		return
	} else {
		hook = result.Data.(*model.IncomingWebhook)
	}

	var channel *model.Channel
	var cchan store.StoreChannel

	if len(channelName) != 0 {
		if channelName[0] == '@' {
			if result := <-api.Srv.Store.User().GetByUsername(hook.TeamId, channelName[1:], T); result.Err != nil {
				c.Err = model.NewAppError("incomingWebhook", T("Couldn't find the user"), "err="+result.Err.Message)
				return
			} else {
				channelName = model.GetDMNameFromIds(result.Data.(*model.User).Id, hook.UserId)
			}
		} else if channelName[0] == '#' {
			channelName = channelName[1:]
		}

		cchan = api.Srv.Store.Channel().GetByName(hook.TeamId, channelName, T)
	} else {
		cchan = api.Srv.Store.Channel().Get(hook.ChannelId, T)
	}

	overrideUsername := parsedRequest.Username
	overrideIconUrl := parsedRequest.IconURL

	if result := <-cchan; result.Err != nil {
		c.Err = model.NewAppError("incomingWebhook", T("Couldn't find the channel"), "err="+result.Err.Message)
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	pchan := api.Srv.Store.Channel().CheckPermissionsTo(hook.TeamId, channel.Id, hook.UserId, T)

	// create a mock session
	c.Session = model.Session{UserId: hook.UserId, TeamId: hook.TeamId, IsOAuth: false}

	if !c.HasPermissionsToChannel(pchan, "createIncomingHook", T) && channel.Type != model.CHANNEL_OPEN {
		c.Err = model.NewAppError("incomingWebhook", "Inappropriate channel permissions", "")
		return
	}

	if _, err := api.CreateWebhookPost(c, channel.Id, text, overrideUsername, overrideIconUrl, parsedRequest.Props, webhookType); err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte("ok"))
}

func setTeamCookie(w http.ResponseWriter, teamName string) {
	maxAge := model.SESSION_TIME_WEB_IN_SECS
	cookie := &http.Cookie{
		Name:	model.SESSION_TEAM,
		Value:	teamName,
		Path:	"/",
		MaxAge: maxAge,
	}

	http.SetCookie(w, cookie)
}
