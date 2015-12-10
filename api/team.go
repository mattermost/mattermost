// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"github.com/mattermost/platform/i18n"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func InitTeam(r *mux.Router) {
	l4g.Debug("Initializing team api routes")

	sr := r.PathPrefix("/teams").Subrouter()
	sr.Handle("/create", ApiAppHandler(createTeam)).Methods("POST")
	sr.Handle("/create_from_signup", ApiAppHandler(createTeamFromSignup)).Methods("POST")
	sr.Handle("/create_with_sso/{service:[A-Za-z]+}", ApiAppHandler(createTeamFromSSO)).Methods("POST")
	sr.Handle("/signup", ApiAppHandler(signupTeam)).Methods("POST")
	sr.Handle("/all", ApiUserRequired(getAll)).Methods("GET")
	sr.Handle("/find_team_by_name", ApiAppHandler(findTeamByName)).Methods("POST")
	sr.Handle("/find_teams", ApiAppHandler(findTeams)).Methods("POST")
	sr.Handle("/email_teams", ApiAppHandler(emailTeams)).Methods("POST")
	sr.Handle("/invite_members", ApiUserRequired(inviteMembers)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updateTeam)).Methods("POST")
	sr.Handle("/me", ApiUserRequired(getMyTeam)).Methods("GET")
	// These should be moved to the global admain console
	sr.Handle("/import_team", ApiUserRequired(importTeam)).Methods("POST")
	sr.Handle("/export_team", ApiUserRequired(exportTeam)).Methods("GET")
}

func signupTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewAppError("signupTeam", T("Team sign-up with email is disabled."), "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	m := model.MapFromJson(r.Body)
	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if len(email) == 0 {
		c.SetInvalidParam("signupTeam", "email")
		return
	}

	if !isTreamCreationAllowed(c, email, T) {
		return
	}

	subjectPage := NewServerTemplatePage(T("signup_team_subject"))
	subjectPage.Props["SiteURL"] = c.GetSiteURL()
	bodyPage := NewServerTemplatePage(T("signup_team_body"))
	bodyPage.Props["SiteURL"] = c.GetSiteURL()

	props := make(map[string]string)
	props["email"] = email
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_team_complete/?d=%s&h=%s", c.GetSiteURL(), url.QueryEscape(data), url.QueryEscape(hash))

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render(), T); err != nil {
		c.Err = err
		return
	}

	if !utils.Cfg.EmailSettings.RequireEmailVerification {
		m["follow_link"] = bodyPage.Props["Link"]
	}

	w.Write([]byte(model.MapToJson(m)))
}

func createTeamFromSSO(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
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

	if !isTreamCreationAllowed(c, team.Email, T) {
		return
	}

	team.PreSave()

	team.Name = model.CleanTeamName(team.Name)

	if err := team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames, T); err != nil {
		c.Err = err
		return
	}

	team.Id = ""

	found := true
	count := 0
	for found {
		if found = FindTeamByName(c, team.Name, "true", T); c.Err != nil {
			return
		} else if found {
			team.Name = team.Name + strconv.Itoa(count)
			count += 1
		}
	}

	if result := <-Srv.Store.Team().Save(team, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rteam := result.Data.(*model.Team)

		if _, err := CreateDefaultChannels(c, rteam.Id); err != nil {
			c.Err = nil
			return
		}

		data := map[string]string{"follow_link": c.GetSiteURL() + "/" + rteam.Name + "/signup/" + service}
		w.Write([]byte(model.MapToJson(data)))

	}

}

func createTeamFromSignup(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewAppError("createTeamFromSignup", T("Team sign-up with email is disabled."), "")
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

	if err := teamSignup.Team.IsValid(*utils.Cfg.TeamSettings.RestrictTeamNames, T); err != nil {
		c.Err = err
		return
	}

	if !isTreamCreationAllowed(c, teamSignup.Team.Email, T) {
		return
	}

	teamSignup.Team.Id = ""

	password := teamSignup.User.Password
	teamSignup.User.PreSave()
	teamSignup.User.TeamId = model.NewId()
	if err := teamSignup.User.IsValid(T); err != nil {
		c.Err = err
		return
	}
	teamSignup.User.Id = ""
	teamSignup.User.TeamId = ""
	teamSignup.User.Password = password

	if !model.ComparePassword(teamSignup.Hash, fmt.Sprintf("%v:%v", teamSignup.Data, utils.Cfg.EmailSettings.InviteSalt)) {
		c.Err = model.NewAppError("createTeamFromSignup", T("The signup link does not appear to be valid"), "")
		return
	}

	t, err := strconv.ParseInt(props["time"], 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
		c.Err = model.NewAppError("createTeamFromSignup", T("The signup link has expired"), "")
		return
	}

	found := FindTeamByName(c, teamSignup.Team.Name, "true", T)
	if c.Err != nil {
		return
	}

	if found {
		c.Err = model.NewAppError("createTeamFromSignup", T("This URL is unavailable. Please try another."), "d="+teamSignup.Team.Name)
		return
	}

	if result := <-Srv.Store.Team().Save(&teamSignup.Team, T); result.Err != nil {
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

		ruser := CreateUser(c, rteam, &teamSignup.User, T)
		if c.Err != nil {
			return
		}

		InviteMembers(c, rteam, ruser, teamSignup.Invites, T)

		teamSignup.Team = *rteam
		teamSignup.User = *ruser

		w.Write([]byte(teamSignup.ToJson()))
	}
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	team := model.TeamFromJson(r.Body)
	rteam := CreateTeam(c, team, T)
	if c.Err != nil {
		return
	}

	w.Write([]byte(rteam.ToJson()))
}

func CreateTeam(c *Context, team *model.Team, T goi18n.TranslateFunc) *model.Team {
	if !utils.Cfg.TeamSettings.EnableTeamCreation {
		c.Err = model.NewAppError("createTeam", T("Team sign-up with email is disabled."), "")
		c.Err.StatusCode = http.StatusForbidden
		return nil
	}

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return nil
	}

	if !isTreamCreationAllowed(c, team.Email, T) {
		return nil
	}

	if result := <-Srv.Store.Team().Save(team, T); result.Err != nil {
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

func isTreamCreationAllowed(c *Context, email string, T goi18n.TranslateFunc) bool {

	email = strings.ToLower(email)

	if !utils.Cfg.TeamSettings.EnableTeamCreation {
		c.Err = model.NewAppError("isTreamCreationAllowed", T("Team creation has been disabled. Please ask your systems administrator for details."), "")
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
		c.Err = model.NewAppError("isTreamCreationAllowed", T("Email must be from a specific domain (e.g. @example.com). Please ask your systems administrator for details."), "")
		return false
	}

	return true
}

func getAll(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasSystemAdminPermissions("getLogs", T) {
		return
	}

	if result := <-Srv.Store.Team().GetAll(T); result.Err != nil {
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
	T := i18n.Language(w, r)
	props := model.MapFromJson(r.Body)
	id := props["id"]

	if result := <-Srv.Store.Session().Get(id, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		session := result.Data.(*model.Session)

		c.LogAudit("revoked_all=" + id, T)

		if session.IsOAuth {
			RevokeAccessToken(session.Token, T)
		} else {
			sessionCache.Remove(session.Token)

			if result := <-Srv.Store.Session().Remove(session.Id, T); result.Err != nil {
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
	T := i18n.Language(w, r)
	m := model.MapFromJson(r.Body)

	name := strings.ToLower(strings.TrimSpace(m["name"]))
	all := strings.ToLower(strings.TrimSpace(m["all"]))

	found := FindTeamByName(c, name, all, T)

	if c.Err != nil {
		return
	}

	if found {
		w.Write([]byte("true"))
	} else {
		w.Write([]byte("false"))
	}
}

func FindTeamByName(c *Context, name string, all string, T goi18n.TranslateFunc) bool {

	if name == "" || len(name) > 64 {
		c.SetInvalidParam("findTeamByName", "domain")
		return false
	}

	if result := <-Srv.Store.Team().GetByName(name, T); result.Err != nil {
		return false
	} else {
		return true
	}

	return false
}

func findTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	m := model.MapFromJson(r.Body)

	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if email == "" {
		c.SetInvalidParam("findTeam", "email")
		return
	}

	if result := <-Srv.Store.Team().GetTeamsForEmail(email, T); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teams := result.Data.([]*model.Team)
		m := make(map[string]*model.Team)
		for _, v := range teams {
			v.Sanitize()
			m[v.Id] = v
		}

		w.Write([]byte(model.TeamMapToJson(m)))
	}
}

func emailTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	m := model.MapFromJson(r.Body)

	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if email == "" {
		c.SetInvalidParam("findTeam", "email")
		return
	}

	subjectPage := NewServerTemplatePage(T("find_teams_subject"))
	subjectPage.ClientCfg["SiteURL"] = c.GetSiteURL()
	bodyPage := NewServerTemplatePage(T("find_teams_body"))
	bodyPage.ClientCfg["SiteURL"] = c.GetSiteURL()

	if result := <-Srv.Store.Team().GetTeamsForEmail(email, T); result.Err != nil {
		c.Err = result.Err
	} else {
		teams := result.Data.([]*model.Team)

		// the template expects Props to be a map with team names as the keys and the team url as the value
		props := make(map[string]string)
		for _, team := range teams {
			props[team.Name] = c.GetTeamURLFromTeam(team)
		}
		bodyPage.Props = props

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render(), T); err != nil {
			l4g.Error(T("An error occured while sending an email in emailTeams err=%v"), err)
		}

		w.Write([]byte(model.MapToJson(m)))
	}
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	invites := model.InvitesFromJson(r.Body)
	if len(invites.Invites) == 0 {
		c.Err = model.NewAppError("Team.InviteMembers", T("No one to invite."), "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	tchan := Srv.Store.Team().Get(c.Session.TeamId, T)
	uchan := Srv.Store.User().Get(c.Session.UserId, T)

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
		if result := <-Srv.Store.User().GetByEmail(c.Session.TeamId, invite["email"], T); result.Err == nil || result.Err.Message != T("We couldn't find the existing account") {
			invNum = int64(i)
			c.Err = model.NewAppError("invite_members", T("This person is already on your team"), strconv.FormatInt(invNum, 10))
			return
		}
	}

	ia := make([]string, len(invites.Invites))
	for _, invite := range invites.Invites {
		ia = append(ia, invite["email"])
	}

	InviteMembers(c, team, user, ia, T)

	w.Write([]byte(invites.ToJson()))
}

func InviteMembers(c *Context, team *model.Team, user *model.User, invites []string, T goi18n.TranslateFunc) {
	for _, invite := range invites {
		if len(invite) > 0 {

			sender := user.GetDisplayName()

			senderRole := ""
			if c.IsTeamAdmin() {
				senderRole = T("administrator")
			} else {
				senderRole = T("member")
			}

			subjectPage := NewServerTemplatePage(T("invite_subject"))
			subjectPage.Props["SenderName"] = sender
			subjectPage.Props["TeamDisplayName"] = team.DisplayName

			bodyPage := NewServerTemplatePage(T("invite_body"))
			bodyPage.Props["TeamURL"] = c.GetTeamURL(T)
			bodyPage.Props["TeamDisplayName"] = team.DisplayName
			bodyPage.Props["SenderName"] = sender
			bodyPage.Props["SenderStatus"] = senderRole
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
				l4g.Info(T("sending invitation to %v %v"), invite, bodyPage.Props["Link"])
			}

			if err := utils.SendMail(invite, subjectPage.Render(), bodyPage.Render(), T); err != nil {
				l4g.Error(T("Failed to send invite email successfully err=%v"), err)
			}
		}
	}
}

func updateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("updateTeam", "team")
		return
	}

	team.Id = c.Session.TeamId

	if !c.IsTeamAdmin() {
		c.Err = model.NewAppError("updateTeam", T("You do not have the appropriate permissions"), "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var oldTeam *model.Team
	if result := <-Srv.Store.Team().Get(team.Id, T); result.Err != nil {
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

	if result := <-Srv.Store.Team().Update(oldTeam, T); result.Err != nil {
		c.Err = result.Err
		return
	}

	oldTeam.Sanitize()

	w.Write([]byte(oldTeam.ToJson()))
}

func PermanentDeleteTeam(c *Context, team *model.Team, T goi18n.TranslateFunc) *model.AppError {
	l4g.Warn("Attempting to permanently delete team %v id=%v", team.Name, team.Id)
	c.Path = "/teams/permanent_delete"
	c.LogAuditWithUserId("", fmt.Sprintf("attempt teamId=%v", team.Id), T)

	team.DeleteAt = model.GetMillis()
	if result := <-Srv.Store.Team().Update(team, T); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.User().GetForExport(team.Id, T); result.Err != nil {
		return result.Err
	} else {
		users := result.Data.([]*model.User)
		for _, user := range users {
			PermanentDeleteUser(c, user, T)
		}
	}

	if result := <-Srv.Store.Channel().PermanentDeleteByTeam(team.Id, T); result.Err != nil {
		return result.Err
	}

	if result := <-Srv.Store.Team().PermanentDelete(team.Id, T); result.Err != nil {
		return result.Err
	}

	l4g.Warn("Permanently deleted team %v id=%v", team.Name, team.Id)
	c.LogAuditWithUserId("", fmt.Sprintf("success teamId=%v", team.Id), T)

	return nil
}

func getMyTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if len(c.Session.TeamId) == 0 {
		return
	}

	if result := <-Srv.Store.Team().Get(c.Session.TeamId, T); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.Team).Etag(), w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.Team).Etag())
		w.Header().Set("Expires", "-1")
		w.Write([]byte(result.Data.(*model.Team).ToJson()))
		return
	}
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	T := i18n.Language(w, r)
	if !c.HasPermissionsToTeam(c.Session.TeamId, "import", T) || !c.IsTeamAdmin() {
		c.Err = model.NewAppError("importTeam", T("Only a team admin can import data."), "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
		c.Err = model.NewAppError("importTeam", T("Could not parse multipart form"), err.Error())
		return
	}

	importFromArray, ok := r.MultipartForm.Value["importFrom"]
	importFrom := importFromArray[0]

	fileSizeStr, ok := r.MultipartForm.Value["filesize"]
	if !ok {
		c.Err = model.NewAppError("importTeam", "Filesize unavilable", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileSize, err := strconv.ParseInt(fileSizeStr[0], 10, 64)
	if err != nil {
		c.Err = model.NewAppError("importTeam", T("Filesize not an integer"), "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfoArray, ok := r.MultipartForm.File["file"]
	if !ok {
		c.Err = model.NewAppError("importTeam", T("No file under 'file' in request"), "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileInfoArray) <= 0 {
		c.Err = model.NewAppError("importTeam", T("Empty array under 'file' in request"), "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	defer fileData.Close()
	if err != nil {
		c.Err = model.NewAppError("importTeam", T("Could not open file"), err.Error())
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
	T := i18n.Language(w, r)
	if !c.HasPermissionsToTeam(c.Session.TeamId, "export", T) || !c.IsTeamAdmin() {
		c.Err = model.NewAppError("exportTeam", T("Only a team admin can export data."), "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	options := ExportOptionsFromJson(r.Body)

	if link, err := ExportToFile(options, T); err != nil {
		c.Err = err
		return
	} else {
		result := map[string]string{}
		result["link"] = link
		w.Write([]byte(model.MapToJson(result)))
	}
}
