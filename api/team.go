// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
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

	BaseRoutes.NeedTeam.Handle("/me", ApiUserRequired(getMyTeam)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/stats", ApiUserRequired(getTeamStats)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/members/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getTeamMembers)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/members/ids", ApiUserRequired(getTeamMembersByIds)).Methods("POST")
	BaseRoutes.NeedTeam.Handle("/members/{user_id:[A-Za-z0-9]+}", ApiUserRequired(getTeamMember)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/update", ApiUserRequired(updateTeam)).Methods("POST")
	BaseRoutes.NeedTeam.Handle("/update_member_roles", ApiUserRequired(updateMemberRoles)).Methods("POST")

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

	subject := c.T("api.templates.signup_team_subject",
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

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
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

	if err := teamSignup.Team.IsValid(); err != nil {
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

	tm := &model.TeamMember{
		TeamId: team.Id,
		UserId: user.Id,
		Roles:  model.ROLE_TEAM_USER.Id,
	}

	channelRole := model.ROLE_CHANNEL_USER.Id

	if team.Email == user.Email {
		tm.Roles = model.ROLE_TEAM_USER.Id + " " + model.ROLE_TEAM_ADMIN.Id
		channelRole = model.ROLE_CHANNEL_USER.Id + " " + model.ROLE_CHANNEL_ADMIN.Id
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

	// This message goes to everyone, so the teamId, channelId and userId are irrelevant
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_NEW_USER, "", "", "", nil)
	message.Add("user_id", user.Id)
	go Publish(message)

	return nil
}

func LeaveTeam(team *model.Team, user *model.User) *model.AppError {

	var teamMember model.TeamMember

	if result := <-Srv.Store.Team().GetMember(team.Id, user.Id); result.Err != nil {
		return model.NewLocAppError("RemoveUserFromTeam", "api.team.remove_user_from_team.missing.app_error", nil, result.Err.Error())
	} else {
		teamMember = result.Data.(model.TeamMember)
	}

	var channelList *model.ChannelList

	if result := <-Srv.Store.Channel().GetChannels(team.Id, user.Id); result.Err != nil {
		if result.Err.Id == "store.sql_channel.get_channels.not_found.app_error" {
			channelList = &model.ChannelList{}
		} else {
			return result.Err
		}

	} else {
		channelList = result.Data.(*model.ChannelList)
	}

	for _, channel := range *channelList {
		if channel.Type != model.CHANNEL_DIRECT {
			Srv.Store.User().InvalidateProfilesInChannelCache(channel.Id)
			if result := <-Srv.Store.Channel().RemoveMember(channel.Id, user.Id); result.Err != nil {
				return result.Err
			}
		}
	}

	// Send the websocket message before we actually do the remove so the user being removed gets it.
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LEAVE_TEAM, team.Id, "", "", nil)
	message.Add("user_id", user.Id)
	message.Add("team_id", team.Id)
	Publish(message)

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

	return nil
}

func isTeamCreationAllowed(c *Context, email string) bool {

	email = strings.ToLower(email)

	if !utils.Cfg.TeamSettings.EnableTeamCreation && !HasPermissionToContext(c, model.PERMISSION_MANAGE_SYSTEM) {
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
			if !HasPermissionToContext(c, model.PERMISSION_MANAGE_SYSTEM) {
				m[v.Id].Sanitize()
			}
			c.Err = nil
		}

		w.Write([]byte(model.TeamMapToJson(m)))
	}
}

// Gets all teams which the current user can has access to. If the user is a System Admin, this will be all teams
// on the server. Otherwise, it will only be the teams of which the user is a member.
func getAll(c *Context, w http.ResponseWriter, r *http.Request) {
	var tchan store.StoreChannel
	if HasPermissionToContext(c, model.PERMISSION_MANAGE_SYSTEM) {
		tchan = Srv.Store.Team().GetAll()
	} else {
		c.Err = nil
		tchan = Srv.Store.Team().GetTeamsByUserId(c.Session.UserId)
	}

	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teams := result.Data.([]*model.Team)
		m := make(map[string]*model.Team)
		for _, v := range teams {
			m[v.Id] = v
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
		if !HasPermissionToCurrentTeamContext(c, model.PERMISSION_INVITE_USER) {
			if *utils.Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_SYSTEM_ADMIN {
				c.Err = model.NewLocAppError("inviteMembers", "api.team.invite_members.restricted_system_admin.app_error", nil, "")
			}
			if *utils.Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_TEAM_ADMIN {
				c.Err = model.NewLocAppError("inviteMembers", "api.team.invite_members.restricted_team_admin.app_error", nil, "")
			}
			c.Err.StatusCode = http.StatusForbidden
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

	if !HasPermissionToTeamContext(c, team.Id, model.PERMISSION_ADD_USER_TO_TEAM) {
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
		if !HasPermissionToTeamContext(c, team.Id, model.PERMISSION_REMOVE_USER_FROM_TEAM) {
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

			senderRole := c.T("api.team.invite_members.member")

			subject := c.T("api.templates.invite_subject",
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

			if err := utils.SendMail(invite, subject, bodyPage.Render()); err != nil {
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

	if !HasPermissionToTeamContext(c, team.Id, model.PERMISSION_MANAGE_TEAM) {
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

func updateMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateMemberRoles", "user_id")
		return
	}

	mchan := Srv.Store.Team().GetTeamsForUser(userId)

	teamId := c.TeamId

	newRoles := props["new_roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("updateMemberRoles", "new_roles")
		return
	}

	if !HasPermissionToTeamContext(c, teamId, model.PERMISSION_MANAGE_ROLES) {
		return
	}

	var member *model.TeamMember
	if result := <-mchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		members := result.Data.([]*model.TeamMember)
		for _, m := range members {
			if m.TeamId == teamId {
				member = m
			}
		}
	}

	if member == nil {
		c.Err = model.NewLocAppError("updateMemberRoles", "api.team.update_member_roles.not_a_member", nil, "userId="+userId+" teamId="+teamId)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	member.Roles = newRoles

	if result := <-Srv.Store.Team().UpdateMember(member); result.Err != nil {
		c.Err = result.Err
		return
	}

	RemoveAllSessionsForUserId(userId)

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
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

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !HasPermissionToContext(c, model.PERMISSION_MANAGE_SYSTEM) {
			return
		}
	}

	tchan := Srv.Store.Team().GetTotalMemberCount(c.TeamId)
	achan := Srv.Store.Team().GetActiveMemberCount(c.TeamId)

	stats := &model.TeamStats{}
	stats.TeamId = c.TeamId

	if result := <-tchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		stats.TotalMemberCount = result.Data.(int64)
	}

	if result := <-achan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		stats.ActiveMemberCount = result.Data.(int64)
	}

	w.Write([]byte(stats.ToJson()))
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !HasPermissionToCurrentTeamContext(c, model.PERMISSION_IMPORT_TEAM) {
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
	if c.Err != nil {
		w.WriteHeader(c.Err.StatusCode)
	}
	io.Copy(w, bytes.NewReader(log.Bytes()))
	//http.ServeContent(w, r, "MattermostImportLog.txt", time.Now(), bytes.NewReader(log.Bytes()))
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

func getTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getTeamMembers", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getTeamMembers", "limit")
		return
	}

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !HasPermissionToTeamContext(c, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			return
		}
	}

	if result := <-Srv.Store.Team().GetMembers(c.TeamId, offset, limit); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		members := result.Data.([]*model.TeamMember)
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}

func getTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	userId := params["user_id"]
	if len(userId) < 26 {
		c.SetInvalidParam("getTeamMember", "user_id")
		return
	}

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !HasPermissionToTeamContext(c, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			return
		}
	}

	if result := <-Srv.Store.Team().GetMember(c.TeamId, userId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		member := result.Data.(model.TeamMember)
		w.Write([]byte(member.ToJson()))
		return
	}
}

func getTeamMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	userIds := model.ArrayFromJson(r.Body)
	if len(userIds) == 0 {
		c.SetInvalidParam("getTeamMembersByIds", "user_ids")
		return
	}

	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !HasPermissionToTeamContext(c, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			return
		}
	}

	if result := <-Srv.Store.Team().GetMembersByIds(c.TeamId, userIds); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		members := result.Data.([]*model.TeamMember)
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}
