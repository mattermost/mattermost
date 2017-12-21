// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) InitTeam() {
	api.BaseRoutes.Teams.Handle("/create", api.ApiUserRequired(createTeam)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/all", api.ApiUserRequired(getAll)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/all_team_listings", api.ApiUserRequired(GetAllTeamListings)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/get_invite_info", api.ApiAppHandler(getInviteInfo)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/find_team_by_name", api.ApiUserRequired(findTeamByName)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/name/{team_name:[A-Za-z0-9\\-]+}", api.ApiUserRequired(getTeamByName)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/members", api.ApiUserRequired(getMyTeamMembers)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/unread", api.ApiUserRequired(getMyTeamsUnread)).Methods("GET")

	api.BaseRoutes.NeedTeam.Handle("/me", api.ApiUserRequired(getMyTeam)).Methods("GET")
	api.BaseRoutes.NeedTeam.Handle("/stats", api.ApiUserRequired(getTeamStats)).Methods("GET")
	api.BaseRoutes.NeedTeam.Handle("/members/{offset:[0-9]+}/{limit:[0-9]+}", api.ApiUserRequired(getTeamMembers)).Methods("GET")
	api.BaseRoutes.NeedTeam.Handle("/members/ids", api.ApiUserRequired(getTeamMembersByIds)).Methods("POST")
	api.BaseRoutes.NeedTeam.Handle("/members/{user_id:[A-Za-z0-9]+}", api.ApiUserRequired(getTeamMember)).Methods("GET")
	api.BaseRoutes.NeedTeam.Handle("/update", api.ApiUserRequired(updateTeam)).Methods("POST")
	api.BaseRoutes.NeedTeam.Handle("/update_member_roles", api.ApiUserRequired(updateMemberRoles)).Methods("POST")

	api.BaseRoutes.NeedTeam.Handle("/invite_members", api.ApiUserRequired(inviteMembers)).Methods("POST")

	api.BaseRoutes.NeedTeam.Handle("/add_user_to_team", api.ApiUserRequired(addUserToTeam)).Methods("POST")
	api.BaseRoutes.NeedTeam.Handle("/remove_user_from_team", api.ApiUserRequired(removeUserFromTeam)).Methods("POST")

	// These should be moved to the global admin console
	api.BaseRoutes.NeedTeam.Handle("/import_team", api.ApiUserRequired(importTeam)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/add_user_to_team_from_invite", api.ApiUserRequiredMfa(addUserToTeamFromInvite)).Methods("POST")
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("createTeam", "team")
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_CREATE_TEAM) {
		c.Err = model.NewAppError("createTeam", "api.team.is_team_creation_allowed.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	rteam, err := c.App.CreateTeamWithUser(team, c.Session.UserId)
	if err != nil {
		c.Err = err
		return
	}

	// Don't sanitize the team here since the user will be a team admin and their session won't reflect that yet

	w.Write([]byte(rteam.ToJson()))
}

func GetAllTeamListings(c *Context, w http.ResponseWriter, r *http.Request) {
	var teams []*model.Team
	var err *model.AppError

	if teams, err = c.App.GetAllOpenTeams(); err != nil {
		c.Err = err
		return
	}

	m := make(map[string]*model.Team)
	for _, v := range teams {
		m[v.Id] = v
	}

	sanitizeTeamMap(c, m)

	w.Write([]byte(model.TeamMapToJson(m)))
}

// Gets all teams which the current user can has access to. If the user is a System Admin, this will be all teams
// on the server. Otherwise, it will only be the teams of which the user is a member.
func getAll(c *Context, w http.ResponseWriter, r *http.Request) {
	var teams []*model.Team
	var err *model.AppError

	if c.App.HasPermissionTo(c.Session.UserId, model.PERMISSION_MANAGE_SYSTEM) {
		teams, err = c.App.GetAllTeams()
	} else {
		teams, err = c.App.GetTeamsForUser(c.Session.UserId)
	}

	if err != nil {
		c.Err = err
		return
	}

	m := make(map[string]*model.Team)
	for _, v := range teams {
		m[v.Id] = v
	}

	sanitizeTeamMap(c, m)

	w.Write([]byte(model.TeamMapToJson(m)))
}

func inviteMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	invites := model.InvitesFromJson(r.Body)

	if utils.IsLicensed() && !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_INVITE_USER) {
		errorId := ""
		if *c.App.Config().TeamSettings.RestrictTeamInvite == model.PERMISSIONS_SYSTEM_ADMIN {
			errorId = "api.team.invite_members.restricted_system_admin.app_error"
		} else if *c.App.Config().TeamSettings.RestrictTeamInvite == model.PERMISSIONS_TEAM_ADMIN {
			errorId = "api.team.invite_members.restricted_team_admin.app_error"
		}

		c.Err = model.NewAppError("inviteMembers", errorId, nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.InviteNewUsersToTeam(invites.ToEmailList(), c.TeamId, c.Session.UserId); err != nil {
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

	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
		c.SetPermissionError(model.PERMISSION_ADD_USER_TO_TEAM)
		return
	}

	if _, err := c.App.AddUserToTeam(c.TeamId, userId, ""); err != nil {
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
		if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_REMOVE_USER_FROM_TEAM) {
			c.SetPermissionError(model.PERMISSION_REMOVE_USER_FROM_TEAM)
			return
		}
	}

	if err := c.App.RemoveUserFromTeam(c.TeamId, userId, c.Session.UserId); err != nil {
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
		team, err = c.App.AddUserToTeamByHash(c.Session.UserId, hash, data)
	} else if len(inviteId) > 0 {
		team, err = c.App.AddUserToTeamByInviteId(inviteId, c.Session.UserId)
	} else {
		c.Err = model.NewAppError("addUserToTeamFromInvite", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(c.Session, team)

	w.Write([]byte(team.ToJson()))
}

func findTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {

	m := model.MapFromJson(r.Body)
	name := strings.ToLower(strings.TrimSpace(m["name"]))

	found := c.App.FindTeamByName(name)

	if found {
		w.Write([]byte("true"))
	} else {
		w.Write([]byte("false"))
	}
}

func getTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	teamname := params["team_name"]

	if team, err := c.App.GetTeamByName(teamname); err != nil {
		c.Err = err
		return
	} else {
		if (!team.AllowOpenInvite || team.Type != model.TEAM_OPEN) && c.Session.GetTeamByTeamId(team.Id) == nil {
			if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
				c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
				return
			}
		}

		c.App.SanitizeTeam(c.Session, team)

		w.Write([]byte(team.ToJson()))
		return
	}
}

func getMyTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	if len(c.Session.TeamMembers) > 0 {
		w.Write([]byte(model.TeamMembersToJson(c.Session.TeamMembers)))
	} else {
		if members, err := c.App.GetTeamMembersForUser(c.Session.UserId); err != nil {
			c.Err = err
			return
		} else {
			w.Write([]byte(model.TeamMembersToJson(members)))
		}
	}
}

func getMyTeamsUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := r.URL.Query().Get("id")

	if unreads, err := c.App.GetTeamsUnreadForUser(teamId, c.Session.UserId); err != nil {
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

	if !c.App.SessionHasPermissionToTeam(c.Session, team.Id, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	var err *model.AppError
	var updatedTeam *model.Team

	updatedTeam, err = c.App.UpdateTeam(team)
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(c.Session, updatedTeam)

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

	if !c.App.SessionHasPermissionToTeam(c.Session, teamId, model.PERMISSION_MANAGE_TEAM_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM_ROLES)
		return
	}

	if _, err := c.App.UpdateTeamMemberRoles(teamId, userId, newRoles); err != nil {
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

	if team, err := c.App.GetTeam(c.TeamId); err != nil {
		c.Err = err
		return
	} else if c.HandleEtag(team.Etag(), "Get My Team", w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, team.Etag())

		c.App.SanitizeTeam(c.Session, team)

		w.Write([]byte(team.ToJson()))
		return
	}
}

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Session.GetTeamByTeamId(c.TeamId) == nil {
		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	stats, err := c.App.GetTeamStats(c.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(stats.ToJson()))
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_IMPORT_TEAM) {
		c.SetPermissionError(model.PERMISSION_IMPORT_TEAM)
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.parse.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	importFromArray, ok := r.MultipartForm.Value["importFrom"]
	if !ok || len(importFromArray) < 1 {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.no_import_from.app_error", nil, "", http.StatusBadRequest)
		return
	}
	importFrom := importFromArray[0]

	fileSizeStr, ok := r.MultipartForm.Value["filesize"]
	if !ok || len(fileSizeStr) < 1 {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.unavailable.app_error", nil, "", http.StatusBadRequest)
		return
	}

	fileSize, err := strconv.ParseInt(fileSizeStr[0], 10, 64)
	if err != nil {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.integer.app_error", nil, "", http.StatusBadRequest)
		return
	}

	fileInfoArray, ok := r.MultipartForm.File["file"]
	if !ok {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(fileInfoArray) <= 0 {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	if err != nil {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.open.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer fileData.Close()

	var log *bytes.Buffer
	switch importFrom {
	case "slack":
		var err *model.AppError
		if err, log = c.App.SlackImport(fileData, fileSize, c.TeamId); err != nil {
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

	if team, err := c.App.GetTeamByInviteId(inviteId); err != nil {
		c.Err = err
		return
	} else {
		if !(team.Type == model.TEAM_OPEN) {
			c.Err = model.NewAppError("getInviteInfo", "api.team.get_invite_info.not_open_team", nil, "id="+inviteId, http.StatusBadRequest)
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
		if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if members, err := c.App.GetTeamMembers(c.TeamId, offset, limit); err != nil {
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
		if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if member, err := c.App.GetTeamMember(c.TeamId, userId); err != nil {
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
		if !c.App.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}
	}

	if members, err := c.App.GetTeamMembersByIds(c.TeamId, userIds); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.TeamMembersToJson(members)))
		return
	}
}

func sanitizeTeamMap(c *Context, teams map[string]*model.Team) {
	for _, team := range teams {
		c.App.SanitizeTeam(c.Session, team)
	}
}
