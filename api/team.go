// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitTeam() {
	l4g.Debug(utils.T("api.team.init.debug"))

	BaseRoutes.Teams.Handle("/create", ApiAppHandler(createTeam)).Methods("POST")
	BaseRoutes.Teams.Handle("/create_from_signup", ApiAppHandler(createTeamFromSignup)).Methods("POST")
	BaseRoutes.Teams.Handle("/signup", ApiAppHandler(signupTeam)).Methods("POST")
	BaseRoutes.Teams.Handle("/all", ApiAppHandler(getAll)).Methods("GET")
	BaseRoutes.Teams.Handle("/all_team_listings", ApiUserRequired(GetAllTeamListings)).Methods("GET")
	BaseRoutes.Teams.Handle("/get_invite_info", ApiAppHandler(getInviteInfo)).Methods("POST")
	BaseRoutes.Teams.Handle("/find_team_by_name", ApiAppHandler(findTeamByName)).Methods("POST")
	BaseRoutes.Teams.Handle("/members/{id:[A-Za-z0-9]+}", ApiUserRequired(getMembers)).Methods("GET")

	BaseRoutes.NeedTeam.Handle("/me", ApiUserRequired(getMyTeam)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/update", ApiUserRequired(updateTeam)).Methods("POST")

	BaseRoutes.NeedTeam.Handle("/invite_members", ApiUserRequired(inviteMembers)).Methods("POST")

	BaseRoutes.NeedTeam.Handle("/add_user_to_team", ApiUserRequired(addUserToTeam)).Methods("POST")
	BaseRoutes.NeedTeam.Handle("/remove_user_from_team", ApiUserRequired(removeUserFromTeam)).Methods("POST")

	// These should be moved to the global admin console
	BaseRoutes.NeedTeam.Handle("/import_team", ApiUserRequired(importTeam)).Methods("POST")
	BaseRoutes.Teams.Handle("/add_user_to_team_from_invite", ApiUserRequired(addUserToTeamFromInvite)).Methods("POST")
}

func signupTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewLocAppError("signupTeam", "api.team.signup_team.email_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	m := model.MapFromJson(r.Body)
	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if len(email) == 0 {
		c.SetInvalidParam("signupTeam", "email")
		return
	}

	if !isTeamCreationAllowed(c, email) {
		return
	}

	subjectPage := utils.NewHTMLTemplate("signup_team_subject", c.Locale)
	subjectPage.Props["Subject"] = c.T("api.templates.signup_team_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("signup_team_body", c.Locale)
	bodyPage.Props["SiteURL"] = c.GetSiteURL()
	bodyPage.Props["Title"] = c.T("api.templates.signup_team_body.title")
	bodyPage.Props["Button"] = c.T("api.templates.signup_team_body.button")
	bodyPage.Html["Info"] = template.HTML(c.T("api.templates.signup_team_body.info",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]}))

	props := make(map[string]string)
	props["email"] = email
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_team_complete/?d=%s&h=%s", c.GetSiteURL(), url.QueryEscape(data), url.QueryEscape(hash))

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		c.Err = err
		return
	}

	if !utils.Cfg.EmailSettings.RequireEmailVerification {
		m["follow_link"] = fmt.Sprintf("/signup_team_complete/?d=%s&h=%s", url.QueryEscape(data), url.QueryEscape(hash))
	}

	w.Header().Set("Access-Control-Allow-Origin", " *")
	w.Write([]byte(model.MapToJson(m)))
}

func createTeamFromSignup(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewLocAppError("createTeamFromSignup", "api.team.create_team_from_signup.email_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	teamSignup := model.TeamSignupFromJson(r.Body)

	if teamSignup == nil {
		c.SetInvalidParam("createTeam", "teamSignup")
		return
	}

	props := model.MapFromJson(strings.NewReader(teamSignup.Data))
	teamSignup.Team.Email = props["email"]
	teamSignup.User.Email = props["email"]

	teamSignup.Team.PreSave()

	if err := teamSignup.Team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames); err != nil {
		c.Err = err
		return
	}

	if !isTeamCreationAllowed(c, teamSignup.Team.Email) {
		return
	}

	teamSignup.Team.Id = ""

	password := teamSignup.User.Password
	teamSignup.User.PreSave()
	if err := teamSignup.User.IsValid(); err != nil {
		c.Err = err
		return
	}
	teamSignup.User.Id = ""
	teamSignup.User.Password = password

	if !model.ComparePassword(teamSignup.Hash, fmt.Sprintf("%v:%v", teamSignup.Data, utils.Cfg.EmailSettings.InviteSalt)) {
		c.Err = model.NewLocAppError("createTeamFromSignup", "api.team.create_team_from_signup.invalid_link.app_error", nil, "")
		return
	}

	t, err := strconv.ParseInt(props["time"], 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
		c.Err = model.NewLocAppError("createTeamFromSignup", "api.team.create_team_from_signup.expired_link.app_error", nil, "")
		return
	}

	found := FindTeamByName(teamSignup.Team.Name)

	if found {
		c.Err = model.NewLocAppError("createTeamFromSignup", "api.team.create_team_from_signup.unavailable.app_error", nil, "d="+teamSignup.Team.Name)
		return
	}

	if result := <-Srv.Store.Team().Save(&teamSignup.Team); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(c, rteam.Id); err != nil {
			c.Err = nil
			return
		}

		teamSignup.User.EmailVerified = true

		ruser, err := CreateUser(&teamSignup.User)
		if err != nil {
			c.Err = err
			return
		}

		JoinUserToTeam(rteam, ruser)

		InviteMembers(c, rteam, ruser, teamSignup.Invites)

		teamSignup.Team = *rteam
		teamSignup.User = *ruser

		w.Write([]byte(teamSignup.ToJson()))
	}
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return
	}

	var user *model.User
	if len(c.Session.UserId) > 0 {
		uchan := Srv.Store.User().Get(c.Session.UserId)

		if result := <-uchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			user = result.Data.(*model.User)
			team.Email = user.Email
		}
	}

	rteam := CreateTeam(c, team)
	if c.Err != nil {
		return
	}

	if user != nil {
		err := JoinUserToTeam(team, user)
		if err != nil {
			c.Err = err
			return
		}
	}

	w.Write([]byte(rteam.ToJson()))
}

func CreateTeam(c *Context, team *model.Team) *model.Team {

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return nil
	}

	if !isTeamCreationAllowed(c, team.Email) {
		return nil
	}

	if result := <-Srv.Store.Team().Save(team); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(c, rteam.Id); err != nil {
			c.Err = err
			return nil
		}

		return rteam
	}
}

func JoinUserToTeamById(teamId string, user *model.User) *model.AppError {
	if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
		return result.Err
	} else {
		return JoinUserToTeam(result.Data.(*model.Team), user)
	}
}

func JoinUserToTeam(team *model.Team, user *model.User) *model.AppError {

	tm := &model.TeamMember{TeamId: team.Id, UserId: user.Id}

	channelRole := ""
	if team.Email == user.Email {
		tm.Roles = model.ROLE_TEAM_ADMIN
		channelRole = model.CHANNEL_ROLE_ADMIN
	}

	if etmr := <-Srv.Store.Team().GetMember(team.Id, user.Id); etmr.Err == nil {
		// Membership alredy exists.  Check if deleted and and update, otherwise do nothing
		rtm := etmr.Data.(model.TeamMember)

		// Do nothing if already added
		if rtm.DeleteAt == 0 {
			return nil
		}

		if tmr := <-Srv.Store.Team().UpdateMember(tm); tmr.Err != nil {
			return tmr.Err
		}
	} else {
		// Membership appears to be missing.  Lets try to add.
		if tmr := <-Srv.Store.Team().SaveMember(tm); tmr.Err != nil {
			return tmr.Err
		}
	}

	if uua := <-Srv.Store.User().UpdateUpdateAt(user.Id); uua.Err != nil {
		return uua.Err
	}

	// Soft error if there is an issue joining the default channels
	if err := JoinDefaultChannels(team.Id, user, channelRole); err != nil {
		l4g.Error(utils.T("api.user.create_user.joining.error"), user.Id, team.Id, err)
	}

	RemoveAllSessionsForUserId(user.Id)
	InvalidateCacheForUser(user.Id)

	// This message goes to every channel, so the channelId is irrelevant
	go Publish(model.NewWebSocketEvent("", "", user.Id, model.WEBSOCKET_EVENT_NEW_USER))

	return nil
}

func LeaveTeam(team *model.Team, user *model.User) *model.AppError {

	var teamMember model.TeamMember

	if result := <-Srv.Store.Team().GetMember(team.Id, user.Id); result.Err != nil {
		return model.NewLocAppError("RemoveUserFromTeam", "api.team.remove_user_from_team.missing.app_error", nil, result.Err.Error())
	} else {
		teamMember = result.Data.(model.TeamMember)
	}

	var channelMembers *model.ChannelList

	if result := <-Srv.Store.Channel().GetChannels(team.Id, user.Id); result.Err != nil {
		if result.Err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			channelMembers = &model.ChannelList{make([]*model.Channel, 0), make(map[string]*model.ChannelMember)}
		} else {
			return result.Err
		}

	} else {
		channelMembers = result.Data.(*model.ChannelList)
	}

	for _, channel := range channelMembers.Channels {
		if channel.Type != model.CHANNEL_DIRECT {
			if result := <-Srv.Store.Channel().RemoveMember(channel.Id, user.Id); result.Err != nil {
				return result.Err
			}
		}
	}

	teamMember.Roles = ""
	teamMember.DeleteAt = model.GetMillis()

	if result := <-Srv.Store.Team().UpdateMember(&teamMember); result.Err != nil {
		return result.Err
	}

	if uua := <-Srv.Store.User().UpdateUpdateAt(user.Id); uua.Err != nil {
		return uua.Err
	}

	RemoveAllSessionsForUserId(user.Id)
	InvalidateCacheForUser(user.Id)

	go Publish(model.NewWebSocketEvent(team.Id, "", user.Id, model.WEBSOCKET_EVENT_LEAVE_TEAM))

	return nil
}

func isTeamCreationAllowed(c *Context, email string) bool {

	email = strings.ToLower(email)

	if !c.IsSystemAdmin() && !utils.Cfg.TeamSettings.EnableTeamCreation {
		c.Err = model.NewLocAppError("isTeamCreationAllowed", "api.team.is_team_creation_allowed.disabled.app_error", nil, "")
		return false
	}

	if result := <-Srv.Store.User().GetByEmail(email); result.Err == nil {
		user := result.Data.(*model.User)
		if len(user.AuthService) > 0 && len(*user.AuthData) > 0 {
			return true
		}
	}

	// commas and @ signs are optional
	// can be in the form of "@corp.mattermost.com, mattermost.com mattermost.org" -> corp.mattermost.com mattermost.com mattermost.org
	domains := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(utils.Cfg.TeamSettings.RestrictCreationToDomains, "@", " ", -1), ",", " ", -1))))

	matched := false
	for _, d := range domains {
		if strings.HasSuffix(email, "@"+d) {
			matched = true
			break
		}
	}

	if len(utils.Cfg.TeamSettings.RestrictCreationToDomains) > 0 && !matched {
		c.Err = model.NewLocAppError("isTeamCreationAllowed", "api.team.is_team_creation_allowed.domain.app_error", nil, "")
		return false
	}

	return true
}

func GetAllTeamListings(c *Context, w http.ResponseWriter, r *http.Request) {
	if result := <-Srv.Store.Team().GetAllTeamListing(); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teams := result.Data.([]*model.Team)
		m := make(map[string]*model.Team)
		for _, v := range teams {
			m[v.Id] = v
			if !c.IsSystemAdmin() {
				m[v.Id].Sanitize()
			}
		}

		w.Write([]byte(model.TeamMapToJson(m)))
	}
}

func getAll(c *Context, w http.ResponseWriter, r *http.Request) {
	if result := <-Srv.Store.Team().GetAll(); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teams := result.Data.([]*model.Team)
		m := make(map[string]*model.Team)
		for _, v := range teams {
			m[v.Id] = v
			if !c.IsSystemAdmin() {
				m[v.Id].SanitizeForNotLoggedIn()
			}
		}

		w.Write([]byte(model.TeamMapToJson(m)))
	}
}

func revokeAllSessions(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)
	id := props["id"]

	if result := <-Srv.Store.Session().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		session := result.Data.(*model.Session)

		c.LogAudit("revoked_all=" + id)

		if session.IsOAuth {
			RevokeAccessToken(session.Token)
		} else {
			sessionCache.Remove(session.Token)

			if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
				c.Err = result.Err
				return
			} else {
				w.Write([]byte(model.MapToJson(props)))
				return
			}
		}
	}
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	invites := model.InvitesFromJson(r.Body)
	if len(invites.Invites) == 0 {
		c.Err = model.NewLocAppError("inviteMembers", "api.team.invite_members.no_one.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if utils.IsLicensed {
		if *utils.Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_SYSTEM_ADMIN && !c.IsSystemAdmin() {
			c.Err = model.NewLocAppError("inviteMembers", "api.team.invite_members.restricted_system_admin.app_error", nil, "")
			return
		}

		if *utils.Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_TEAM_ADMIN && !c.IsTeamAdmin() {
			c.Err = model.NewLocAppError("inviteMembers", "api.team.invite_members.restricted_team_admin.app_error", nil, "")
			return
		}
	}

	tchan := Srv.Store.Team().Get(c.TeamId)
	uchan := Srv.Store.User().Get(c.Session.UserId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	emailList := make([]string, len(invites.Invites))
	for _, invite := range invites.Invites {
		emailList = append(emailList, invite["email"])
	}

	InviteMembers(c, team, user, emailList)

	w.Write([]byte(invites.ToJson()))
}

func addUserToTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	params := model.MapFromJson(r.Body)
	userId := params["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addUserToTeam", "user_id")
		return
	}

	tchan := Srv.Store.Team().Get(c.TeamId)
	uchan := Srv.Store.User().Get(userId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if !c.IsTeamAdmin() {
		c.Err = model.NewLocAppError("addUserToTeam", "api.team.update_team.permissions.app_error", nil, "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	err := JoinUserToTeam(team, user)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.MapToJson(params)))
}

func removeUserFromTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	params := model.MapFromJson(r.Body)
	userId := params["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("removeUserFromTeam", "user_id")
		return
	}

	tchan := Srv.Store.Team().Get(c.TeamId)
	uchan := Srv.Store.User().Get(userId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if c.Session.UserId != user.Id {
		if !c.IsTeamAdmin() {
			c.Err = model.NewLocAppError("removeUserFromTeam", "api.team.update_team.permissions.app_error", nil, "userId="+c.Session.UserId)
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	err := LeaveTeam(team, user)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.MapToJson(params)))
}

func addUserToTeamFromInvite(c *Context, w http.ResponseWriter, r *http.Request) {

	params := model.MapFromJson(r.Body)
	hash := params["hash"]
	data := params["data"]
	inviteId := params["invite_id"]

	teamId := ""
	var team *model.Team

	if len(hash) > 0 {
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewLocAppError("addUserToTeamFromInvite", "api.user.create_user.signup_link_invalid.app_error", nil, "")
			return
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			c.Err = model.NewLocAppError("addUserToTeamFromInvite", "api.user.create_user.signup_link_expired.app_error", nil, "")
			return
		}

		teamId = props["id"]

		// try to load the team to make sure it exists
		if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			team = result.Data.(*model.Team)
		}
	}

	if len(inviteId) > 0 {
		if result := <-Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			team = result.Data.(*model.Team)
			teamId = team.Id
		}
	}

	if len(teamId) == 0 {
		c.Err = model.NewLocAppError("addUserToTeamFromInvite", "api.user.create_user.signup_link_invalid.app_error", nil, "")
		return
	}

	uchan := Srv.Store.User().Get(c.Session.UserId)

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	tm := c.Session.GetTeamByTeamId(teamId)

	if tm == nil {
		err := JoinUserToTeam(team, user)
		if err != nil {
			c.Err = err
			return
		}
	}

	team.Sanitize()

	w.Write([]byte(team.ToJson()))
}

func FindTeamByName(name string) bool {
	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		return false
	} else {
		return true
	}
}

func findTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)
	name := strings.ToLower(strings.TrimSpace(m["name"]))

	found := FindTeamByName(name)

	if found {
		w.Write([]byte("true"))
	} else {
		w.Write([]byte("false"))
	}
}

func InviteMembers(c *Context, team *model.Team, user *model.User, invites []string) {
	for _, invite := range invites {
		if len(invite) > 0 {

			sender := user.GetDisplayName()

			senderRole := ""
			if c.IsTeamAdmin() {
				senderRole = c.T("api.team.invite_members.admin")
			} else {
				senderRole = c.T("api.team.invite_members.member")
			}

			subjectPage := utils.NewHTMLTemplate("invite_subject", c.Locale)
			subjectPage.Props["Subject"] = c.T("api.templates.invite_subject",
				map[string]interface{}{"SenderName": sender, "TeamDisplayName": team.DisplayName, "SiteName": utils.ClientCfg["SiteName"]})

			bodyPage := utils.NewHTMLTemplate("invite_body", c.Locale)
			bodyPage.Props["SiteURL"] = c.GetSiteURL()
			bodyPage.Props["Title"] = c.T("api.templates.invite_body.title")
			bodyPage.Html["Info"] = template.HTML(c.T("api.templates.invite_body.info",
				map[string]interface{}{"SenderStatus": senderRole, "SenderName": sender, "TeamDisplayName": team.DisplayName}))
			bodyPage.Props["Button"] = c.T("api.templates.invite_body.button")
			bodyPage.Html["ExtraInfo"] = template.HTML(c.T("api.templates.invite_body.extra_info",
				map[string]interface{}{"TeamDisplayName": team.DisplayName, "TeamURL": c.GetTeamURL()}))

			props := make(map[string]string)
			props["email"] = invite
			props["id"] = team.Id
			props["display_name"] = team.DisplayName
			props["name"] = team.Name
			props["time"] = fmt.Sprintf("%v", model.GetMillis())
			data := model.MapToJson(props)
			hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))
			bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&h=%s", c.GetSiteURL(), url.QueryEscape(data), url.QueryEscape(hash))

			if !utils.Cfg.EmailSettings.SendEmailNotifications {
				l4g.Info(utils.T("api.team.invite_members.sending.info"), invite, bodyPage.Props["Link"])
			}

			if err := utils.SendMail(invite, subjectPage.Render(), bodyPage.Render()); err != nil {
				l4g.Error(utils.T("api.team.invite_members.send.error"), err)
			}
		}
	}
}

func updateTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("updateTeam", "team")
		return
	}

	team.Id = c.TeamId

	if !c.IsTeamAdmin() {
		c.Err = model.NewLocAppError("updateTeam", "api.team.update_team.permissions.app_error", nil, "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var oldTeam *model.Team
	if result := <-Srv.Store.Team().Get(team.Id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oldTeam = result.Data.(*model.Team)
	}

	oldTeam.DisplayName = team.DisplayName
	oldTeam.InviteId = team.InviteId
	oldTeam.AllowOpenInvite = team.AllowOpenInvite
	oldTeam.CompanyName = team.CompanyName
	oldTeam.AllowedDomains = team.AllowedDomains
	//oldTeam.Type = team.Type

	if result := <-Srv.Store.Team().Update(oldTeam); result.Err != nil {
		c.Err = result.Err
		return
	}

	oldTeam.Sanitize()

	w.Write([]byte(oldTeam.ToJson()))
}

func PermanentDeleteTeam(c *Context, team *model.Team) *model.AppError {
	l4g.Warn(utils.T("api.team.permanent_delete_team.attempting.warn"), team.Name, team.Id)
	c.Path = "/teams/permanent_delete"
	c.LogAuditWithUserId("", fmt.Sprintf("attempt teamId=%v", team.Id))

	team.DeleteAt = model.GetMillis()
	if result := <-Srv.Store.Team().Update(team); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Channel().PermanentDeleteByTeam(team.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Team().RemoveAllMembersByTeam(team.Id); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Team().PermanentDelete(team.Id); result.Err != nil {
		return result.Err
	}

	l4g.Warn(utils.T("api.team.permanent_delete_team.deleted.warn"), team.Name, team.Id)
	c.LogAuditWithUserId("", fmt.Sprintf("success teamId=%v", team.Id))

	return nil
}

func getMyTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	if len(c.TeamId) == 0 {
		return
	}

	if result := <-Srv.Store.Team().Get(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.Team).Etag(), w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.Team).Etag())
		w.Write([]byte(result.Data.(*model.Team).ToJson()))
		return
	}
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasPermissionsToTeam(c.TeamId, "import") || !c.IsTeamAdmin() {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.admin.app_error", nil, "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.parse.app_error", nil, err.Error())
		return
	}

	importFromArray, ok := r.MultipartForm.Value["importFrom"]
	importFrom := importFromArray[0]

	fileSizeStr, ok := r.MultipartForm.Value["filesize"]
	if !ok {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.unavailable.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileSize, err := strconv.ParseInt(fileSizeStr[0], 10, 64)
	if err != nil {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.integer.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfoArray, ok := r.MultipartForm.File["file"]
	if !ok {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.no_file.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileInfoArray) <= 0 {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.array.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	defer fileData.Close()
	if err != nil {
		c.Err = model.NewLocAppError("importTeam", "api.team.import_team.open.app_error", nil, err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	var log *bytes.Buffer
	switch importFrom {
	case "slack":
		var err *model.AppError
		if err, log = SlackImport(fileData, fileSize, c.TeamId); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusBadRequest
		}
	}

	w.Header().Set("Content-Disposition", "attachment; filename=MattermostImportLog.txt")
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(w, r, "MattermostImportLog.txt", time.Now(), bytes.NewReader(log.Bytes()))
}

func getInviteInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	m := model.MapFromJson(r.Body)
	inviteId := m["invite_id"]

	if result := <-Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team := result.Data.(*model.Team)
		if !(team.Type == model.TEAM_OPEN) {
			c.Err = model.NewLocAppError("getInviteInfo", "api.team.get_invite_info.not_open_team", nil, "id="+inviteId)
			return
		}

		result := map[string]string{}
		result["display_name"] = team.DisplayName
		result["name"] = team.Name
		result["id"] = team.Id
		w.Write([]byte(model.MapToJson(result)))
	}
}

func getMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if c.Session.GetTeamByTeamId(id) == nil {
		if !c.HasSystemAdminPermissions("getMembers") {
			return
		}
	}

	if result := <-Srv.Store.Team().GetMembers(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		members := result.Data.([]*model.TeamMember)
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}
