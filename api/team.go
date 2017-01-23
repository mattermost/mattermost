// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitTeam() {
	l4g.Debug(utils.T("api.team.init.debug"))

	BaseRoutes.Teams.Handle("/create", ApiUserRequired(createTeam)).Methods("POST")
	BaseRoutes.Teams.Handle("/all", ApiAppHandler(getAll)).Methods("GET")
	BaseRoutes.Teams.Handle("/all_team_listings", ApiUserRequired(GetAllTeamListings)).Methods("GET")
	BaseRoutes.Teams.Handle("/get_invite_info", ApiAppHandler(getInviteInfo)).Methods("POST")
	BaseRoutes.Teams.Handle("/find_team_by_name", ApiAppHandler(findTeamByName)).Methods("POST")
	BaseRoutes.Teams.Handle("/name/{team_name:[A-Za-z0-9\\-]+}", ApiAppHandler(getTeamByName)).Methods("GET")
	BaseRoutes.Teams.Handle("/members", ApiUserRequired(getMyTeamMembers)).Methods("GET")
	BaseRoutes.Teams.Handle("/unread", ApiUserRequired(getMyTeamsUnread)).Methods("GET")

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
	BaseRoutes.Teams.Handle("/add_user_to_team_from_invite", ApiUserRequiredMfa(addUserToTeamFromInvite)).Methods("POST")
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_TEAM) {
		c.Err = model.NewLocAppError("createTeam", "api.team.is_team_creation_allowed.disabled.app_error", nil, "")
		return
	}

	rteam, err := app.CreateTeamWithUser(team, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(rteam.ToJson()))
}

func GetAllTeamListings(c *Context, w http.ResponseWriter, r *http.Request) {
	var teams []*model.Team
	var err *model.AppError

	if teams, err = app.GetAllOpenTeams(); err != nil {
		c.Err = err
		return
	}

	m := make(map[string]*model.Team)
	for _, v := range teams {
		m[v.Id] = v
		if !app.HasPermissionTo(c.Session.UserId, model.PERMISSION_MANAGE_SYSTEM) {
			m[v.Id].Sanitize()
		}
	}

	w.Write([]byte(model.TeamMapToJson(m)))
}

// Gets all teams which the current user can has access to. If the user is a System Admin, this will be all teams
// on the server. Otherwise, it will only be the teams of which the user is a member.
func getAll(c *Context, w http.ResponseWriter, r *http.Request) {
	var teams []*model.Team
	var err *model.AppError

	if app.HasPermissionTo(c.Session.UserId, model.PERMISSION_MANAGE_SYSTEM) {
		teams, err = app.GetAllTeams()
	} else {
		teams, err = app.GetTeamsForUser(c.Session.UserId)
	}

	if err != nil {
		c.Err = err
		return
	}

	m := make(map[string]*model.Team)
	for _, v := range teams {
		m[v.Id] = v
	}

	w.Write([]byte(model.TeamMapToJson(m)))
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	invites := model.InvitesFromJson(r.Body)

	if utils.IsLicensed && !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_INVITE_USER) {
		errorId := ""
		if *utils.Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_SYSTEM_ADMIN {
			errorId = "api.team.invite_members.restricted_system_admin.app_error"
		} else if *utils.Cfg.TeamSettings.RestrictTeamInvite == model.PERMISSIONS_TEAM_ADMIN {
			errorId = "api.team.invite_members.restricted_team_admin.app_error"
		}

		c.Err = model.NewLocAppError("inviteMembers", errorId, nil, "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if err := app.InviteNewUsersToTeam(invites.ToEmailList(), c.TeamId, c.Session.UserId, c.GetSiteURL()); err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(invites.ToJson()))
}

func addUserToTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	params := model.MapFromJson(r.Body)
	userId := params["user_id"]

	if len(userId) != 26 {
		c.SetInvalidParam("addUserToTeam", "user_id")
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
		c.SetPermissionError(model.PERMISSION_ADD_USER_TO_TEAM)
		return
	}

	if _, err := app.AddUserToTeam(c.TeamId, c.Session.UserId); err != nil {
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

	if c.Session.UserId != userId {
		if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_REMOVE_USER_FROM_TEAM) {
			c.SetPermissionError(model.PERMISSION_REMOVE_USER_FROM_TEAM)
			return
		}
	}

	if err := app.RemoveUserFromTeam(c.TeamId, userId); err != nil {
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

	var team *model.Team
	var err *model.AppError

	if len(hash) > 0 {
		team, err = app.AddUserToTeamByHash(c.Session.UserId, hash, data)
	} else if len(inviteId) > 0 {
		team, err = app.AddUserToTeamByInviteId(inviteId, c.Session.UserId)
	} else {
		c.Err = model.NewLocAppError("addUserToTeamFromInvite", "api.user.create_user.signup_link_invalid.app_error", nil, "")
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	team.Sanitize()

	w.Write([]byte(team.ToJson()))
}

func findTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)
	name := strings.ToLower(strings.TrimSpace(m["name"]))

	found := app.FindTeamByName(name)

	if found {
		w.Write([]byte("true"))
	} else {
		w.Write([]byte("false"))
	}
}

func getTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	teamname := params["team_name"]

	if team, err := app.GetTeamByName(teamname); err != nil {
		c.Err = err
		return
	} else {
		if team.Type != model.TEAM_OPEN && c.Session.GetTeamByTeamId(team.Id) == nil {
			if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
				c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
				return
			}
		}

		w.Write([]byte(team.ToJson()))
		return
	}
}

func getMyTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(c.Session.TeamMembers) > 0 {
		w.Write([]byte(model.TeamMembersToJson(c.Session.TeamMembers)))
	} else {
		if members, err := app.GetTeamMembersForUser(c.Session.UserId); err != nil {
			c.Err = err
			return
		} else {
			w.Write([]byte(model.TeamMembersToJson(members)))
		}
	}
}

func getMyTeamsUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := r.URL.Query().Get("id")

	if unreads, err := app.GetTeamsUnreadForUser(teamId, c.Session.UserId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamsUnreadToJson(unreads)))
	}
}

func updateTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	team := model.TeamFromJson(r.Body)
	if team == nil {
		c.SetInvalidParam("updateTeam", "team")
		return
	}

	team.Id = c.TeamId

	if !app.SessionHasPermissionToTeam(c.Session, team.Id, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	var err *model.AppError
	var updatedTeam *model.Team

	updatedTeam, err = app.UpdateTeam(team)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(updatedTeam.ToJson()))
}

func updateMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updateMemberRoles", "user_id")
		return
	}

	teamId := c.TeamId

	newRoles := props["new_roles"]
	if !(model.IsValidUserRoles(newRoles)) {
		c.SetInvalidParam("updateMemberRoles", "new_roles")
		return
	}

	if !app.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_MANAGE_TEAM_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM_ROLES)
		return
	}

	if _, err := app.UpdateTeamMemberRoles(teamId, userId, newRoles); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func getMyTeam(c *Context, w http.ResponseWriter, r *http.Request) {

	if len(c.TeamId) == 0 {
		return
	}

	if team, err := app.GetTeam(c.TeamId); err != nil {
		c.Err = err
		return
	} else if HandleEtag(team.Etag(), "Get My Team", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, team.Etag())
		w.Write([]byte(team.ToJson()))
		return
	}
}

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	stats, err := app.GetTeamStats(c.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(stats.ToJson()))
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_IMPORT_TEAM) {
		c.SetPermissionError(model.PERMISSION_IMPORT_TEAM)
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
		if err, log = app.SlackImport(fileData, fileSize, c.TeamId); err != nil {
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

	if team, err := app.GetTeamByInviteId(inviteId); err != nil {
		c.Err = err
		return
	} else {
		if !(team.Type == model.TEAM_OPEN) {
			c.Err = model.NewLocAppError("getInviteInfo", "api.team.get_invite_info.not_open_team", nil, "id="+inviteId)
			return
		}

		result := map[string]string{}
		result["display_name"] = team.DisplayName
		result["description"] = team.Description
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
		if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if members, err := app.GetTeamMembers(c.TeamId, offset, limit); err != nil {
		c.Err = err
		return
	} else {
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
		if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if member, err := app.GetTeamMember(c.TeamId, userId); err != nil {
		c.Err = err
		return
	} else {
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
		if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if members, err := app.GetTeamMembersByIds(c.TeamId, userIds); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}
