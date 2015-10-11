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
	sr.Handle("/update_name", ApiUserRequired(updateTeamDisplayName)).Methods("POST")
	sr.Handle("/me", ApiUserRequired(getMyTeam)).Methods("GET")
	// These should be moved to the global admain console
	sr.Handle("/import_team", ApiUserRequired(importTeam)).Methods("POST")
	sr.Handle("/export_team", ApiUserRequired(exportTeam)).Methods("GET")
}

func signupTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewAppError("signupTeam", "Team sign-up with email is disabled.", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	m := model.MapFromJson(r.Body)
	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if len(email) == 0 {
		c.SetInvalidParam("signupTeam", "email")
		return
	}

	if !isTreamCreationAllowed(c, email) {
		return
	}

	subjectPage := NewServerTemplatePage("signup_team_subject")
	subjectPage.Props["SiteURL"] = c.GetSiteURL()
	bodyPage := NewServerTemplatePage("signup_team_body")
	bodyPage.Props["SiteURL"] = c.GetSiteURL()

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
		m["follow_link"] = bodyPage.Props["Link"]
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

	if !isTreamCreationAllowed(c, team.Email) {
		return
	}

	team.PreSave()

	team.Name = model.CleanTeamName(team.Name)

	if err := team.IsValid(); err != nil {
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

		data := map[string]string{"follow_link": c.GetSiteURL() + "/" + rteam.Name + "/signup/" + service}
		w.Write([]byte(model.MapToJson(data)))

	}

}

func createTeamFromSignup(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.EmailSettings.EnableSignUpWithEmail {
		c.Err = model.NewAppError("createTeamFromSignup", "Team sign-up with email is disabled.", "")
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

	if !isTreamCreationAllowed(c, teamSignup.Team.Email) {
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
		c.Err = model.NewAppError("createTeamFromSignup", "The signup link does not appear to be valid", "")
		return
	}

	t, err := strconv.ParseInt(props["time"], 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
		c.Err = model.NewAppError("createTeamFromSignup", "The signup link has expired", "")
		return
	}

	found := FindTeamByName(c, teamSignup.Team.Name, "true")
	if c.Err != nil {
		return
	}

	if found {
		c.Err = model.NewAppError("createTeamFromSignup", "This URL is unavailable. Please try another.", "d="+teamSignup.Team.Name)
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

		ruser := CreateUser(c, rteam, &teamSignup.User)
		if c.Err != nil {
			return
		}

		InviteMembers(c, rteam, ruser, teamSignup.Invites)

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
		c.Err = model.NewAppError("createTeam", "Team sign-up with email is disabled.", "")
		c.Err.StatusCode = http.StatusForbidden
		return nil
	}

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return nil
	}

	if !isTreamCreationAllowed(c, team.Email) {
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

func isTreamCreationAllowed(c *Context, email string) bool {

	email = strings.ToLower(email)

	if !utils.Cfg.TeamSettings.EnableTeamCreation {
		c.Err = model.NewAppError("isTreamCreationAllowed", "Team creation has been disabled. Please ask your systems administrator for details.", "")
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
		c.Err = model.NewAppError("isTreamCreationAllowed", "Email must be from a specific domain (e.g. @example.com). Please ask your systems administrator for details.", "")
		return false
	}

	return true
}

func getAll(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasSystemAdminPermissions("getLogs") {
		return
	}

	if result := <-Srv.Store.Team().GetAll(); result.Err != nil {
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

	if model.IsReservedTeamName(name) {
		c.Err = model.NewAppError("findTeamByName", "This URL is unavailable. Please try another.", "name="+name)
		return false
	}

	if result := <-Srv.Store.Team().GetByName(name); result.Err != nil {
		return false
	} else {
		return true
	}

	return false
}

func findTeams(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)

	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if email == "" {
		c.SetInvalidParam("findTeam", "email")
		return
	}

	if result := <-Srv.Store.Team().GetTeamsForEmail(email); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		teams := result.Data.([]*model.Team)

		s := make([]string, 0, len(teams))

		for _, v := range teams {
			s = append(s, v.Name)
		}

		w.Write([]byte(model.ArrayToJson(s)))
	}
}

func emailTeams(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)

	email := strings.ToLower(strings.TrimSpace(m["email"]))

	if email == "" {
		c.SetInvalidParam("findTeam", "email")
		return
	}

	subjectPage := NewServerTemplatePage("find_teams_subject")
	subjectPage.ClientProps["SiteURL"] = c.GetSiteURL()
	bodyPage := NewServerTemplatePage("find_teams_body")
	bodyPage.ClientProps["SiteURL"] = c.GetSiteURL()

	if result := <-Srv.Store.Team().GetTeamsForEmail(email); result.Err != nil {
		c.Err = result.Err
	} else {
		teams := result.Data.([]*model.Team)

		// the template expects Props to be a map with team names as the keys and the team url as the value
		props := make(map[string]string)
		for _, team := range teams {
			props[team.Name] = c.GetTeamURLFromTeam(team)
		}
		bodyPage.Props = props

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error("An error occured while sending an email in emailTeams err=%v", err)
		}

		w.Write([]byte(model.MapToJson(m)))
	}
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	invites := model.InvitesFromJson(r.Body)
	if len(invites.Invites) == 0 {
		c.Err = model.NewAppError("Team.InviteMembers", "No one to invite.", "")
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
		if result := <-Srv.Store.User().GetByEmail(c.Session.TeamId, invite["email"]); result.Err == nil || result.Err.Message != "We couldn't find the existing account" {
			invNum = int64(i)
			c.Err = model.NewAppError("invite_members", "This person is already on your team", strconv.FormatInt(invNum, 10))
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
				senderRole = "administrator"
			} else {
				senderRole = "member"
			}

			subjectPage := NewServerTemplatePage("invite_subject")
			subjectPage.Props["SiteURL"] = c.GetSiteURL()
			subjectPage.Props["SenderName"] = sender
			subjectPage.Props["TeamDisplayName"] = team.DisplayName

			bodyPage := NewServerTemplatePage("invite_body")
			bodyPage.Props["SiteURL"] = c.GetSiteURL()
			bodyPage.Props["TeamDisplayName"] = team.DisplayName
			bodyPage.Props["SenderName"] = sender
			bodyPage.Props["SenderStatus"] = senderRole
			bodyPage.Props["Email"] = invite
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
				l4g.Info("sending invitation to %v %v", invite, bodyPage.Props["Link"])
			}

			if err := utils.SendMail(invite, subjectPage.Render(), bodyPage.Render()); err != nil {
				l4g.Error("Failed to send invite email successfully err=%v", err)
			}
		}
	}
}

func updateTeamDisplayName(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)

	new_name := props["new_name"]
	if len(new_name) == 0 {
		c.SetInvalidParam("updateTeamDisplayName", "new_name")
		return
	}

	teamId := props["team_id"]
	if len(teamId) > 0 && len(teamId) != 26 {
		c.SetInvalidParam("updateTeamDisplayName", "team_id")
		return
	} else if len(teamId) == 0 {
		teamId = c.Session.TeamId
	}

	if !c.HasPermissionsToTeam(teamId, "updateTeamDisplayName") {
		return
	}

	if !c.IsTeamAdmin() {
		c.Err = model.NewAppError("updateTeamDisplayName", "You do not have the appropriate permissions", "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if result := <-Srv.Store.Team().UpdateDisplayName(new_name, c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	}

	w.Write([]byte(model.MapToJson(props)))
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
		w.Header().Set("Expires", "-1")
		w.Write([]byte(result.Data.(*model.Team).ToJson()))
		return
	}
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.HasPermissionsToTeam(c.Session.TeamId, "import") || !c.IsTeamAdmin() {
		c.Err = model.NewAppError("importTeam", "Only a team admin can import data.", "userId="+c.Session.UserId)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
		c.Err = model.NewAppError("importTeam", "Could not parse multipart form", err.Error())
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
		c.Err = model.NewAppError("importTeam", "Filesize not an integer", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfoArray, ok := r.MultipartForm.File["file"]
	if !ok {
		c.Err = model.NewAppError("importTeam", "No file under 'file' in request", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileInfoArray) <= 0 {
		c.Err = model.NewAppError("importTeam", "Empty array under 'file' in request", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	defer fileData.Close()
	if err != nil {
		c.Err = model.NewAppError("importTeam", "Could not open file", err.Error())
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
		c.Err = model.NewAppError("exportTeam", "Only a team admin can export data.", "userId="+c.Session.UserId)
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
