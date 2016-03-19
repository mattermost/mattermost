// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func InitTeam(r *mux.Router) {
	l4g.Debug(utils.T("api.team.init.debug"))

	sr := r.PathPrefix("/teams").Subrouter()
	sr.Handle("/create", ApiAppHandler(createTeam)).Methods("POST")
	sr.Handle("/create_from_signup", ApiAppHandler(createTeamFromSignup)).Methods("POST")
	sr.Handle("/create_with_ldap", ApiAppHandler(createTeamWithLdap)).Methods("POST")
	sr.Handle("/create_with_sso/{service:[A-Za-z]+}", ApiAppHandler(createTeamFromSSO)).Methods("POST")
	sr.Handle("/signup", ApiAppHandler(signupTeam)).Methods("POST")
	sr.Handle("/all", ApiAppHandler(getAll)).Methods("GET")
	sr.Handle("/find_team_by_name", ApiAppHandler(findTeamByName)).Methods("POST")
	sr.Handle("/invite_members", ApiUserRequired(inviteMembers)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updateTeam)).Methods("POST")
	sr.Handle("/me", ApiUserRequired(getMyTeam)).Methods("GET")
	sr.Handle("/get_invite_info", ApiAppHandler(getInviteInfo)).Methods("POST")
	// These should be moved to the global admain console
	sr.Handle("/import_team", ApiUserRequired(importTeam)).Methods("POST")
	sr.Handle("/export_team", ApiUserRequired(exportTeam)).Methods("GET")
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

func createTeamFromSSO(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	sso := utils.Cfg.GetSSOService(service)
	if sso != nil && !sso.Enable {
		c.SetInvalidParam("createTeamFromSSO", "service")
		return
	}

	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("createTeamFromSSO", "team")
		return
	}

	if !isTeamCreationAllowed(c, team.Email) {
		return
	}

	team.PreSave()

	team.Name = model.CleanTeamName(team.Name)

	if err := team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames); err != nil {
		c.Err = err
		return
	}

	team.Id = ""

	found := true
	count := 0
	for found {
		if found = FindTeamByName(c, team.Name, "true"); c.Err != nil {
			return
		} else if found {
			team.Name = team.Name + strconv.Itoa(count)
			count += 1
		}
	}

	if result := <-Srv.Store.Team().Save(team); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(c, rteam.Id); err != nil {
			c.Err = nil
			return
		}

		data := map[string]string{"follow_link": c.GetSiteURL() + "/api/v1/oauth/" + service + "/signup?team=" + rteam.Name}
		w.Write([]byte(model.MapToJson(data)))

	}

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
	teamSignup.User.TeamId = model.NewId()
	if err := teamSignup.User.IsValid(); err != nil {
		c.Err = err
		return
	}
	teamSignup.User.Id = ""
	teamSignup.User.TeamId = ""
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

	found := FindTeamByName(c, teamSignup.Team.Name, "true")
	if c.Err != nil {
		return
	}

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

		teamSignup.User.TeamId = rteam.Id
		teamSignup.User.EmailVerified = true

		ruser, err := CreateUser(rteam, &teamSignup.User)
		if err != nil {
			c.Err = err
			return
		}

		InviteMembers(c, rteam, ruser, teamSignup.Invites)

		teamSignup.Team = *rteam
		teamSignup.User = *ruser

		w.Write([]byte(teamSignup.ToJson()))
	}
}

func createTeamWithLdap(c *Context, w http.ResponseWriter, r *http.Request) {
	ldap := einterfaces.GetLdapInterface()
	if ldap == nil {
		c.Err = model.NewLocAppError("createTeamWithLdap", "ent.ldap.do_login.licence_disable.app_error", nil, "")
		return
	}

	teamSignup := model.TeamSignupFromJson(r.Body)

	if teamSignup == nil {
		c.SetInvalidParam("createTeam", "teamSignup")
		return
	}

	teamSignup.Team.PreSave()

	if err := teamSignup.Team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames); err != nil {
		c.Err = err
		return
	}

	if !isTeamCreationAllowed(c, teamSignup.Team.Email) {
		return
	}

	teamSignup.Team.Id = ""

	found := FindTeamByName(c, teamSignup.Team.Name, "true")
	if c.Err != nil {
		return
	}

	if found {
		c.Err = model.NewLocAppError("createTeamFromSignup", "api.team.create_team_from_signup.unavailable.app_error", nil, "d="+teamSignup.Team.Name)
		return
	}

	user, err := ldap.GetUser(teamSignup.User.Username)
	if err != nil {
		c.Err = err
		return
	}

	err = ldap.CheckPassword(teamSignup.User.Username, teamSignup.User.Password)
	if err != nil {
		c.Err = err
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

		user.TeamId = rteam.Id
		ruser, err := CreateUser(rteam, user)
		if err != nil {
			c.Err = err
			return
		}

		teamSignup.Team = *rteam
		teamSignup.User = *ruser

		w.Write([]byte(teamSignup.ToJson()))
	}
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)
	rteam := CreateTeam(c, team)
	if c.Err != nil {
		return
	}

	w.Write([]byte(rteam.ToJson()))
}

func CreateTeam(c *Context, team *model.Team) *model.Team {
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewLocAppError("createTeam", "api.team.create_team.email_disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return nil
	}

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

func isTeamCreationAllowed(c *Context, email string) bool {

	email = strings.ToLower(email)

	if !utils.Cfg.TeamSettings.EnableTeamCreation {
		c.Err = model.NewLocAppError("isTeamCreationAllowed", "api.team.is_team_creation_allowed.disabled.app_error", nil, "")
		return false
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

func findTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)

	name := strings.ToLower(strings.TrimSpace(m["name"]))
	all := strings.ToLower(strings.TrimSpace(m["all"]))

	found := FindTeamByName(c, name, all)

	if c.Err != nil {
		return
	}

	if found {
		w.Write([]byte("true"))
	} else {
		w.Write([]byte("false"))
	}
}

func FindTeamByName(c *Context, name string, all string) bool {

	if name == "" || len(name) > 64 {
		c.SetInvalidParam("findTeamByName", "domain")
		return false
	}

	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		return false
	} else {
		return true
	}

	return false
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	invites := model.InvitesFromJson(r.Body)
	if len(invites.Invites) == 0 {
		c.Err = model.NewLocAppError("Team.InviteMembers", "api.team.invite_members.no_one.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	tchan := Srv.Store.Team().Get(c.Session.TeamId)
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

	var invNum int64 = 0
	for i, invite := range invites.Invites {
		if result := <-Srv.Store.User().GetByEmail(c.Session.TeamId, invite["email"]); result.Err == nil || result.Err.Id != store.MISSING_ACCOUNT_ERROR {
			invNum = int64(i)
			c.Err = model.NewLocAppError("invite_members", "api.team.invite_members.already.app_error", nil, strconv.FormatInt(invNum, 10))
			return
		}
	}

	ia := make([]string, len(invites.Invites))
	for _, invite := range invites.Invites {
		ia = append(ia, invite["email"])
	}

	InviteMembers(c, team, user, ia)

	w.Write([]byte(invites.ToJson()))
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

	team.Id = c.Session.TeamId

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
	oldTeam.AllowTeamListing = team.AllowTeamListing
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

	if result := <-Srv.Store.User().GetForExport(team.Id); result.Err != nil {
		return result.Err
	} else {
		users := result.Data.([]*model.User)
		for _, user := range users {
			PermanentDeleteUser(c, user)
		}
	}

	if result := <-Srv.Store.Channel().PermanentDeleteByTeam(team.Id); result.Err != nil {
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

	if len(c.Session.TeamId) == 0 {
		return
	}

	if result := <-Srv.Store.Team().Get(c.Session.TeamId); result.Err != nil {
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
	if !c.HasPermissionsToTeam(c.Session.TeamId, "import") || !c.IsTeamAdmin() {
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
		if err, log = SlackImport(fileData, fileSize, c.Session.TeamId); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusBadRequest
		}
	}

	w.Header().Set("Content-Disposition", "attachment; filename=MattermostImportLog.txt")
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(w, r, "MattermostImportLog.txt", time.Now(), bytes.NewReader(log.Bytes()))
}

func exportTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasPermissionsToTeam(c.Session.TeamId, "export") || !c.IsTeamAdmin() {
		c.Err = model.NewLocAppError("exportTeam", "api.team.export_team.admin.app_error", nil, "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	options := ExportOptionsFromJson(r.Body)

	if link, err := ExportToFile(options); err != nil {
		c.Err = err
		return
	} else {
		result := map[string]string{}
		result["link"] = link
		w.Write([]byte(model.MapToJson(result)))
	}
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
