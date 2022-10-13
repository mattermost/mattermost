// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	MaxAddMembersBatch    = 256
	MaximumBulkImportSize = 10 * 1024 * 1024
	groupIDsParamPattern  = "[^a-zA-Z0-9,]*"
)

var groupIDsQueryParamRegex *regexp.Regexp

func init() {
	groupIDsQueryParamRegex = regexp.MustCompile(groupIDsParamPattern)
}

func (api *API) InitTeam() {
	api.BaseRoutes.Teams.Handle("", api.APISessionRequired(createTeam)).Methods("POST")
	api.BaseRoutes.Teams.Handle("", api.APISessionRequired(getAllTeams)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/scheme", api.APISessionRequired(updateTeamScheme)).Methods("PUT")
	api.BaseRoutes.Teams.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchTeams)).Methods("POST")
	api.BaseRoutes.TeamsForUser.Handle("", api.APISessionRequired(getTeamsForUser)).Methods("GET")
	api.BaseRoutes.TeamsForUser.Handle("/unread", api.APISessionRequired(getTeamsUnreadForUser)).Methods("GET")

	api.BaseRoutes.Team.Handle("", api.APISessionRequired(getTeam)).Methods("GET")
	api.BaseRoutes.Team.Handle("", api.APISessionRequired(updateTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("", api.APISessionRequired(deleteTeam)).Methods("DELETE")
	api.BaseRoutes.Team.Handle("/except", api.APISessionRequired(softDeleteTeamsExcept)).Methods("DELETE")
	api.BaseRoutes.Team.Handle("/patch", api.APISessionRequired(patchTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/restore", api.APISessionRequired(restoreTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/privacy", api.APISessionRequired(updateTeamPrivacy)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/stats", api.APISessionRequired(getTeamStats)).Methods("GET")
	api.BaseRoutes.Team.Handle("/regenerate_invite_id", api.APISessionRequired(regenerateTeamInviteId)).Methods("POST")

	api.BaseRoutes.Team.Handle("/image", api.APISessionRequiredTrustRequester(getTeamIcon)).Methods("GET")
	api.BaseRoutes.Team.Handle("/image", api.APISessionRequired(setTeamIcon)).Methods("POST")
	api.BaseRoutes.Team.Handle("/image", api.APISessionRequired(removeTeamIcon)).Methods("DELETE")

	api.BaseRoutes.TeamMembers.Handle("", api.APISessionRequired(getTeamMembers)).Methods("GET")
	api.BaseRoutes.TeamMembers.Handle("/ids", api.APISessionRequired(getTeamMembersByIds)).Methods("POST")
	api.BaseRoutes.TeamMembersForUser.Handle("", api.APISessionRequired(getTeamMembersForUser)).Methods("GET")
	api.BaseRoutes.TeamMembers.Handle("", api.APISessionRequired(addTeamMember)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/members/invite", api.APISessionRequired(addUserToTeamFromInvite)).Methods("POST")
	api.BaseRoutes.TeamMembers.Handle("/batch", api.APISessionRequired(addTeamMembers)).Methods("POST")
	api.BaseRoutes.TeamMember.Handle("", api.APISessionRequired(removeTeamMember)).Methods("DELETE")

	api.BaseRoutes.TeamForUser.Handle("/unread", api.APISessionRequired(getTeamUnread)).Methods("GET")

	api.BaseRoutes.TeamByName.Handle("", api.APISessionRequired(getTeamByName)).Methods("GET")
	api.BaseRoutes.TeamMember.Handle("", api.APISessionRequired(getTeamMember)).Methods("GET")
	api.BaseRoutes.TeamByName.Handle("/exists", api.APISessionRequired(teamExists)).Methods("GET")
	api.BaseRoutes.TeamMember.Handle("/roles", api.APISessionRequired(updateTeamMemberRoles)).Methods("PUT")
	api.BaseRoutes.TeamMember.Handle("/schemeRoles", api.APISessionRequired(updateTeamMemberSchemeRoles)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/import", api.APISessionRequired(importTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/invite/email", api.APISessionRequired(inviteUsersToTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/invite-guests/email", api.APISessionRequired(inviteGuestsToChannels)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/invites/email", api.APISessionRequired(invalidateAllEmailInvites)).Methods("DELETE")
	api.BaseRoutes.Teams.Handle("/invite/{invite_id:[A-Za-z0-9]+}", api.APIHandler(getInviteInfo)).Methods("GET")

	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/members_minus_group_members", api.APISessionRequired(teamMembersMinusGroupMembers)).Methods("GET")
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	var team model.Team
	if jsonErr := json.NewDecoder(r.Body).Decode(&team); jsonErr != nil {
		c.SetInvalidParamWithErr("team", jsonErr)
		return
	}
	team.Email = strings.ToLower(team.Email)

	auditRec := c.MakeAuditRecord("createTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team", team)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateTeam) {
		c.Err = model.NewAppError("createTeam", "api.team.is_team_creation_allowed.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	// On a cloud license, we must check limits before allowing to create
	if c.App.Channels().License() != nil && c.App.Channels().License().Features != nil && *c.App.Channels().License().Features.Cloud {
		limits, err := c.App.Cloud().GetCloudLimits(c.AppContext.Session().UserId)
		if err != nil {
			c.Err = model.NewAppError("Api4.createTeam", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		// If there are no limits for teams, for active teams, or the limit for active teams is less than 0, do nothing
		if !(limits == nil || limits.Teams == nil || limits.Teams.Active == nil || *limits.Teams.Active <= 0) {
			teamsUsage, appErr := c.App.GetTeamsUsage()
			if appErr != nil {
				c.Err = appErr
				return
			}
			// if the number of active teams is greater than or equal to the limit, return 400
			if teamsUsage.Active >= int64(*limits.Teams.Active) {
				c.Err = model.NewAppError("Api4.createTeam", "api.cloud.teams_limit_reached.create", nil, "", http.StatusBadRequest)
				return
			}
		}
	}

	rteam, err := c.App.CreateTeamWithUser(c.AppContext, &team, c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	// Don't sanitize the team here since the user will be a team admin and their session won't reflect that yet

	auditRec.Success()
	auditRec.AddEventResultState(&team)
	auditRec.AddEventObjectType("team")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rteam); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	if (!team.AllowOpenInvite || team.Type != model.TeamOpen) && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), team.Id, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	c.App.SanitizeTeam(*c.AppContext.Session(), team)
	if err := json.NewEncoder(w).Encode(team); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeamByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName()
	if c.Err != nil {
		return
	}

	team, err := c.App.GetTeamByName(c.Params.TeamName)
	if err != nil {
		c.Err = err
		return
	}

	if (!team.AllowOpenInvite || team.Type != model.TeamOpen) && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), team.Id, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	c.App.SanitizeTeam(*c.AppContext.Session(), team)
	if err := json.NewEncoder(w).Encode(team); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var team model.Team
	if jsonErr := json.NewDecoder(r.Body).Decode(&team); jsonErr != nil {
		c.SetInvalidParamWithErr("team", jsonErr)
		return
	}

	team.Email = strings.ToLower(team.Email)

	// The team being updated in the payload must be the same one as indicated in the URL.
	if team.Id != c.Params.TeamId {
		c.SetInvalidParam("id")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team", team)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	updatedTeam, err := c.App.UpdateTeam(&team)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(updatedTeam)
	auditRec.AddEventObjectType("team")

	c.App.SanitizeTeam(*c.AppContext.Session(), updatedTeam)
	if err := json.NewEncoder(w).Encode(updatedTeam); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var team model.TeamPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&team); jsonErr != nil {
		c.SetInvalidParamWithErr("team", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("patchTeam", audit.Fail)
	auditRec.AddEventParameter("team_patch", team)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	if oldTeam, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddEventPriorState(oldTeam)
		auditRec.AddEventObjectType("team")
	}

	patchedTeam, err := c.App.PatchTeam(c.Params.TeamId, &team)

	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(*c.AppContext.Session(), patchedTeam)

	auditRec.Success()
	auditRec.AddEventResultState(patchedTeam)
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(patchedTeam); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func restoreTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("restoreTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}
	// On a cloud license, we must check limits before allowing to restore
	if c.App.Channels().License() != nil && c.App.Channels().License().Features != nil && *c.App.Channels().License().Features.Cloud {
		limits, err := c.App.Cloud().GetCloudLimits(c.AppContext.Session().UserId)
		if err != nil {
			c.Err = model.NewAppError("Api4.restoreTeam", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		}

		// If there are no limits for teams, for active teams, or the limit for active teams is less than 0, do nothing
		if !(limits == nil || limits.Teams == nil || limits.Teams.Active == nil || *limits.Teams.Active <= 0) {
			teamsUsage, appErr := c.App.GetTeamsUsage()
			if appErr != nil {
				c.Err = appErr
				return
			}
			// if the number of active teams is greater than or equal to the limit, return 400
			if teamsUsage.Active >= int64(*limits.Teams.Active) {
				c.Err = model.NewAppError("Api4.restoreTeam", "api.cloud.teams_limit_reached.restore", nil, "", http.StatusBadRequest)
				return
			}
		}
	}

	err := c.App.RestoreTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	// Return the restored team to be consistent with RestoreChannel.
	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(team)
	auditRec.AddEventObjectType("team")
	auditRec.Success()

	if err := json.NewEncoder(w).Encode(team); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateTeamPrivacy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJSON(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok {
		c.SetInvalidParam("privacy")
		return
	}

	var openInvite bool
	switch privacy {
	case model.TeamOpen:
		openInvite = true
	case model.TeamInvite:
		openInvite = false
	default:
		c.SetInvalidParam("privacy")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamPrivacy", audit.Fail)
	auditRec.AddEventParameter("props", props)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		auditRec.AddEventParameter("team_id", c.Params.TeamId)
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	if err := c.App.UpdateTeamPrivacy(c.Params.TeamId, privacy, openInvite); err != nil {
		c.Err = err
		return
	}

	// Return the updated team to be consistent with UpdateChannelPrivacy
	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(team)
	auditRec.AddEventObjectType("team")
	auditRec.Success()

	if err := json.NewEncoder(w).Encode(team); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func regenerateTeamInviteId(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	auditRec := c.MakeAuditRecord("regenerateTeamInviteId", audit.Fail)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)
	defer c.LogAuditRec(auditRec)

	patchedTeam, err := c.App.RegenerateTeamInviteId(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(*c.AppContext.Session(), patchedTeam)

	auditRec.Success()
	auditRec.AddEventResultState(patchedTeam)
	auditRec.AddEventObjectType("team")
	c.LogAudit("")

	if err := json.NewEncoder(w).Encode(patchedTeam); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	auditRec := c.MakeAuditRecord("deleteTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if team, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddEventParameter("team", team)
	}

	var err *model.AppError
	if c.Params.Permanent {
		if *c.App.Config().ServiceSettings.EnableAPITeamDeletion {
			err = c.App.PermanentDeleteTeamId(c.AppContext, c.Params.TeamId)
		} else {
			err = model.NewAppError("deleteTeam", "api.user.delete_team.not_enabled.app_error", nil, "teamId="+c.Params.TeamId, http.StatusUnauthorized)
		}
	} else {
		err = c.App.SoftDeleteTeam(c.Params.TeamId)
	}

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func softDeleteTeamsExcept(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	err := c.App.SoftDeleteAllTeamsExcept(c.Params.TeamId)
	if err != nil {
		c.Err = err
	}

	ReturnStatusOK(w)
}

func getTeamsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.AppContext.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementUsers) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementUsers)
		return
	}

	teams, appErr := c.App.GetTeamsForUser(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	c.App.SanitizeTeams(*c.AppContext.Session(), teams)

	js, err := json.Marshal(teams)
	if err != nil {
		c.Err = model.NewAppError("getTeamsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func getTeamsUnreadForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.AppContext.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// optional team id to be excluded from the result
	teamId := r.URL.Query().Get("exclude_team")
	includeCollapsedThreads := r.URL.Query().Get("include_collapsed_threads") == "true"

	unreadTeamsList, appErr := c.App.GetTeamsUnreadForUser(teamId, c.Params.UserId, includeCollapsedThreads)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(unreadTeamsList)
	if err != nil {
		c.Err = model.NewAppError("getTeamsUnreadForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	w.Write(js)
}

func getTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	team, appErr := c.App.GetTeamMember(c.Params.TeamId, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(team); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	sort := r.URL.Query().Get("sort")
	excludeDeletedUsers := r.URL.Query().Get("exclude_deleted_users")
	excludeDeletedUsersBool, _ := strconv.ParseBool(excludeDeletedUsers)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	teamMembersGetOptions := &model.TeamMembersGetOptions{
		Sort:                sort,
		ExcludeDeletedUsers: excludeDeletedUsersBool,
		ViewRestrictions:    restrictions,
	}

	members, appErr := c.App.GetTeamMembers(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage, teamMembersGetOptions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("getTeamMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func getTeamMembersForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadOtherUsersTeams) {
		c.SetPermissionError(model.PermissionReadOtherUsersTeams)
		return
	}

	canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return
	}

	members, appErr := c.App.GetTeamMembersForUser(c.Params.UserId, "", true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("getTeamMembersForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func getTeamMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var userIDs []string
	err := json.NewDecoder(r.Body).Decode(&userIDs)
	if err != nil || len(userIDs) == 0 {
		c.SetInvalidParamWithErr("user_ids", err)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	members, appErr := c.App.GetTeamMembersByIds(c.Params.TeamId, userIDs, restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("getTeamMembersByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func addTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var err *model.AppError
	var member model.TeamMember
	if jsonErr := json.NewDecoder(r.Body).Decode(&member); jsonErr != nil {
		c.Err = model.NewAppError("addTeamMember", "api.team.add_team_member.invalid_body.app_error", nil, "Error in model.TeamMemberFromJSON()", http.StatusBadRequest).Wrap(jsonErr)
		return
	}
	if member.TeamId != c.Params.TeamId {
		c.SetInvalidParam("team_id")
		return
	}

	if !model.IsValidId(member.UserId) {
		c.SetInvalidParam("user_id")
		return
	}

	auditRec := c.MakeAuditRecord("addTeamMember", audit.Fail)
	auditRec.AddEventParameter("member", member)
	defer c.LogAuditRec(auditRec)

	if member.UserId == c.AppContext.Session().UserId {
		var team *model.Team
		team, err = c.App.GetTeam(member.TeamId)
		if err != nil {
			c.Err = err
			return
		}

		if team.AllowOpenInvite && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionJoinPublicTeams) {
			c.SetPermissionError(model.PermissionJoinPublicTeams)
			return
		}
		if !team.AllowOpenInvite && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionJoinPrivateTeams) {
			c.SetPermissionError(model.PermissionJoinPrivateTeams)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), member.TeamId, model.PermissionAddUserToTeam) {
			c.SetPermissionError(model.PermissionAddUserToTeam)
			return
		}
	}

	team, err := c.App.GetTeam(member.TeamId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("team", team)

	if team.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupTeamMembers([]string{member.UserId}, team)
		if err != nil {
			if v, ok := err.(*model.AppError); ok {
				c.Err = v
			} else {
				c.Err = model.NewAppError("addTeamMember", "api.team.add_members.error", nil, err.Error(), http.StatusBadRequest)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("addTeamMember", "api.team.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	var tm *model.TeamMember
	tm, err = c.App.AddTeamMember(c.AppContext, member.TeamId, member.UserId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(tm)
	auditRec.AddEventObjectType("team_member") // TODO verify this is the final state. should it be the team instead?
	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(tm); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addUserToTeamFromInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	tokenId := r.URL.Query().Get("token")
	inviteId := r.URL.Query().Get("invite_id")

	var member *model.TeamMember
	var err *model.AppError

	auditRec := c.MakeAuditRecord("addUserToTeamFromInvite", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("invite_id", inviteId)

	if tokenId != "" {
		member, err = c.App.AddTeamMemberByToken(c.AppContext, c.AppContext.Session().UserId, tokenId)
	} else if inviteId != "" {
		if c.AppContext.Session().Props[model.SessionPropIsGuest] == "true" {
			c.Err = model.NewAppError("addUserToTeamFromInvite", "api.team.add_user_to_team_from_invite.guest.app_error", nil, "", http.StatusForbidden)
			return
		}

		member, err = c.App.AddTeamMemberByInviteId(c.AppContext, inviteId, c.AppContext.Session().UserId)
	} else {
		err = model.NewAppError("addTeamMember", "api.team.add_user_to_team.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	if member != nil {
		auditRec.AddMeta("member", member)
	}

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(member); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	graceful := r.URL.Query().Get("graceful") != ""

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var appErr *model.AppError
	var members []*model.TeamMember
	if jsonErr := json.NewDecoder(r.Body).Decode(&members); jsonErr != nil {
		c.SetInvalidParamWithErr("members", jsonErr)
		return
	}

	if len(members) > MaxAddMembersBatch {
		c.SetInvalidParam("too many members in batch")
		return
	}

	if len(members) == 0 {
		c.SetInvalidParam("no members in batch")
		return
	}

	auditRec := c.MakeAuditRecord("addTeamMembers", audit.Fail)
	auditRec.AddEventParameter("members", members)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("count", len(members))

	var memberIDs []string
	for _, member := range members {
		memberIDs = append(memberIDs, member.UserId)
	}
	auditRec.AddMeta("user_ids", memberIDs)

	team, appErr := c.App.GetTeam(c.Params.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddMeta("team", team)

	if team.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupTeamMembers(memberIDs, team)
		if err != nil {
			if v, ok := err.(*model.AppError); ok {
				c.Err = v
			} else {
				c.Err = model.NewAppError("addTeamMembers", "api.team.add_members.error", nil, "", http.StatusBadRequest).Wrap(err)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("addTeamMembers", "api.team.add_members.user_denied", map[string]any{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	var userIDs []string
	for _, member := range members {
		if member.TeamId != c.Params.TeamId {
			c.SetInvalidParam("team_id for member with user_id=" + member.UserId)
			return
		}

		if !model.IsValidId(member.UserId) {
			c.SetInvalidParam("user_id")
			return
		}

		userIDs = append(userIDs, member.UserId)
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionAddUserToTeam) {
		c.SetPermissionError(model.PermissionAddUserToTeam)
		return
	}

	membersWithErrors, appErr := c.App.AddTeamMembers(c.AppContext, c.Params.TeamId, userIDs, c.AppContext.Session().UserId, graceful)

	if len(membersWithErrors) != 0 {
		errList := make([]string, 0, len(membersWithErrors))
		for _, m := range membersWithErrors {
			if m.Error != nil {
				errList = append(errList, model.TeamMemberWithErrorToString(m))
			}
		}
		auditRec.AddMeta("errors", errList)
	}
	if appErr != nil {
		c.Err = appErr
		return
	}

	var (
		js  []byte
		err error
	)
	if graceful {
		// in 'graceful' mode we allow a different return value, notifying the client which users were not added
		js, err = json.Marshal(membersWithErrors)
	} else {
		js, err = json.Marshal(model.TeamMembersWithErrorToTeamMembers(membersWithErrors))
	}
	if err != nil {
		c.Err = model.NewAppError("addTeamMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	w.Write(js)
}

func removeTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("removeTeamMember", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.AppContext.Session().UserId != c.Params.UserId {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionRemoveUserFromTeam) {
			c.SetPermissionError(model.PermissionRemoveUserFromTeam)
			return
		}
	}

	auditRec.AddEventParameter("team_id", c.Params.TeamId)
	auditRec.AddEventParameter("user_id", c.Params.UserId)

	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("team", team)

	user, err := c.App.GetUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("user", user)

	if team.IsGroupConstrained() && (c.Params.UserId != c.AppContext.Session().UserId) && !user.IsBot {
		c.Err = model.NewAppError("removeTeamMember", "api.team.remove_member.group_constrained.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if err := c.App.RemoveUserFromTeam(c.AppContext, c.Params.TeamId, c.Params.UserId, c.AppContext.Session().UserId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getTeamUnread(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	unreadTeam, err := c.App.GetTeamUnread(c.Params.TeamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(unreadTeam); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	stats, err := c.App.GetTeamStats(c.Params.TeamId, restrictions)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(stats); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateTeamMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJSON(r.Body)

	newRoles := props["roles"]
	if !model.IsValidUserRoles(newRoles) {
		c.SetInvalidParam("team_member_roles")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamMemberRoles", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("props", props)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeamRoles) {
		c.SetPermissionError(model.PermissionManageTeamRoles)
		return
	}

	teamMember, err := c.App.UpdateTeamMemberRoles(c.Params.TeamId, c.Params.UserId, newRoles)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(teamMember)
	auditRec.AddEventObjectType("team_member")

	ReturnStatusOK(w)
}

func updateTeamMemberSchemeRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	var schemeRoles model.SchemeRoles
	if jsonErr := json.NewDecoder(r.Body).Decode(&schemeRoles); jsonErr != nil {
		c.SetInvalidParamWithErr("scheme_roles", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamMemberSchemeRoles", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("scheme_roles", schemeRoles)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeamRoles) {
		c.SetPermissionError(model.PermissionManageTeamRoles)
		return
	}

	teamMember, err := c.App.UpdateTeamMemberSchemeRoles(c.Params.TeamId, c.Params.UserId, schemeRoles.SchemeGuest, schemeRoles.SchemeUser, schemeRoles.SchemeAdmin)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(teamMember)
	auditRec.AddEventObjectType("team_member")

	ReturnStatusOK(w)
}

func getAllTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	teams := []*model.Team{}
	var appErr *model.AppError
	var teamsWithCount *model.TeamsWithCount

	opts := &model.TeamSearch{}
	if c.Params.ExcludePolicyConstrained {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
			c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
			return
		}
		opts.ExcludePolicyConstrained = model.NewBool(true)
	}
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		opts.IncludePolicyID = model.NewBool(true)
	}

	listPrivate := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPrivateTeams)
	listPublic := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPublicTeams)
	limit := c.Params.PerPage
	offset := limit * c.Params.Page
	if listPrivate && listPublic {
	} else if listPrivate {
		opts.AllowOpenInvite = model.NewBool(false)
	} else if listPublic {
		opts.AllowOpenInvite = model.NewBool(true)
	} else {
		// The user doesn't have permissions to list private as well as public teams.
		c.Err = model.NewAppError("getAllTeams", "api.team.get_all_teams.insufficient_permissions", nil, "", http.StatusForbidden)
		return
	}

	if c.Params.IncludeTotalCount {
		teamsWithCount, appErr = c.App.GetAllTeamsPageWithCount(offset, limit, opts)
	} else {
		teams, appErr = c.App.GetAllTeamsPage(offset, limit, opts)
	}
	if appErr != nil {
		c.Err = appErr
		return
	}

	var (
		js  []byte
		err error
	)
	if c.Params.IncludeTotalCount {
		c.App.SanitizeTeams(*c.AppContext.Session(), teamsWithCount.Teams)
		js, err = json.Marshal(teamsWithCount)
	} else {
		c.App.SanitizeTeams(*c.AppContext.Session(), teams)
		js, err = json.Marshal(teams)
	}
	if err != nil {
		c.Err = model.NewAppError("getAllTeams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func searchTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	var props model.TeamSearch
	if err := json.NewDecoder(r.Body).Decode(&props); err != nil {
		c.SetInvalidParamWithErr("team_search", err)
		return
	}
	// Only system managers may use the ExcludePolicyConstrained field
	if props.ExcludePolicyConstrained != nil && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}
	// policy ID may only be used through the /data_retention/policies endpoint
	props.PolicyID = nil
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		props.IncludePolicyID = model.NewBool(true)
	}

	var (
		teams      []*model.Team
		totalCount int64
		appErr     *model.AppError
	)

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPrivateTeams) && c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPublicTeams) {
		teams, totalCount, appErr = c.App.SearchAllTeams(&props)
	} else if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPrivateTeams) {
		if props.Page != nil || props.PerPage != nil {
			c.Err = model.NewAppError("searchTeams", "api.team.search_teams.pagination_not_implemented.private_team_search", nil, "", http.StatusNotImplemented)
			return
		}
		teams, appErr = c.App.SearchPrivateTeams(&props)
	} else if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPublicTeams) {
		if props.Page != nil || props.PerPage != nil {
			c.Err = model.NewAppError("searchTeams", "api.team.search_teams.pagination_not_implemented.public_team_search", nil, "", http.StatusNotImplemented)
			return
		}
		teams, appErr = c.App.SearchPublicTeams(&props)
	} else {
		teams = []*model.Team{}
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	c.App.SanitizeTeams(*c.AppContext.Session(), teams)

	var payload []byte
	if props.Page != nil && props.PerPage != nil {
		twc := map[string]any{"teams": teams, "total_count": totalCount}
		payload = model.ToJSON(twc)
	} else {
		js, err := json.Marshal(teams)
		if err != nil {
			c.Err = model.NewAppError("searchTeams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
		payload = js
	}

	w.Write(payload)
}

func teamExists(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamName()
	if c.Err != nil {
		return
	}

	team, err := c.App.GetTeamByName(c.Params.TeamName)
	if err != nil && err.StatusCode != http.StatusNotFound {
		c.Err = err
		return
	}

	exists := false

	if team != nil {
		var teamMember *model.TeamMember
		teamMember, err = c.App.GetTeamMember(team.Id, c.AppContext.Session().UserId)
		if err != nil && err.StatusCode != http.StatusNotFound {
			c.Err = err
			return
		}

		// Verify that the user can see the team (be a member or have the permission to list the team)
		if (teamMember != nil && teamMember.DeleteAt == 0) ||
			(team.AllowOpenInvite && c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPublicTeams)) ||
			(!team.AllowOpenInvite && c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionListPrivateTeams)) {
			exists = true
		}
	}

	resp := map[string]bool{"exists": exists}
	w.Write([]byte(model.MapBoolToJSON(resp)))
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Channels().License() != nil && *c.App.Channels().License().Features.Cloud {
		c.Err = model.NewAppError("importTeam", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionImportTeam) {
		c.SetPermissionError(model.PermissionImportTeam)
		return
	}

	if err := r.ParseMultipartForm(MaximumBulkImportSize); err != nil {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.parse.app_error", nil, err.Error(), http.StatusInternalServerError)
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

	auditRec := c.MakeAuditRecord("importTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	if err != nil {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.open.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer fileData.Close()
	auditRec.AddEventParameter("filename", fileInfo.Filename)
	auditRec.AddEventParameter("filesize", fileSize)
	auditRec.AddEventParameter("from", importFrom)

	var log *bytes.Buffer
	data := map[string]string{}
	switch importFrom {
	case "slack":
		var err *model.AppError
		if err, log = c.App.SlackImport(c.AppContext, fileData, fileSize, c.Params.TeamId); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusBadRequest
		}
		data["results"] = base64.StdEncoding.EncodeToString(log.Bytes())
	default:
		c.Err = model.NewAppError("importTeam", "api.team.import_team.unknown_import_from.app_error", nil, "", http.StatusBadRequest)
	}

	if c.Err != nil {
		w.WriteHeader(c.Err.StatusCode)
		return
	}
	auditRec.Success()
	w.Write([]byte(model.MapToJSON(data)))
}

func inviteUsersToTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	graceful := r.URL.Query().Get("graceful") != ""

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionInviteUser) {
		c.SetPermissionError(model.PermissionInviteUser)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionAddUserToTeam) {
		c.SetPermissionError(model.PermissionInviteUser)
		return
	}

	bf, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.inviteUsersToTeams", "api.team.invite_members_to_team_and_channels.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	memberInvite := &model.MemberInvite{}
	if err := json.Unmarshal(bf, memberInvite); err != nil {
		c.Err = model.NewAppError("Api4.inviteUsersToTeams", "api.team.invite_members_to_team_and_channels.invalid_body_parsing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	emailList := memberInvite.Emails

	if len(emailList) == 0 {
		c.SetInvalidParam("user_email")
		return
	}

	for i := range emailList {
		emailList[i] = strings.ToLower(emailList[i])
	}

	auditRec := c.MakeAuditRecord("inviteUsersToTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("member_invite", memberInvite)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)
	auditRec.AddMeta("count", len(emailList))
	auditRec.AddMeta("emails", emailList)

	if len(memberInvite.ChannelIds) > 0 {
		auditRec.AddMeta("channel_count", len(memberInvite.ChannelIds))
		auditRec.AddMeta("channels", memberInvite.ChannelIds)
	}

	if graceful {
		var invitesWithError []*model.EmailInviteWithError
		var appErr *model.AppError
		if emailList != nil {
			invitesWithError, appErr = c.App.InviteNewUsersToTeamGracefully(memberInvite, c.Params.TeamId, c.AppContext.Session().UserId, "")
		}

		if invitesWithError != nil {
			errList := make([]string, 0, len(invitesWithError))
			for _, inv := range invitesWithError {
				if inv.Error != nil {
					errList = append(errList, model.EmailInviteWithErrorToString(inv))
				}
			}
			auditRec.AddMeta("errors", errList)
		}
		if appErr != nil {
			c.Err = appErr
			return
		}

		// we get the emailList after it has finished checks like the emails over the list
		scheduledAt := model.GetMillis()
		jobData := map[string]string{
			"emailList":   model.ArrayToJSON(emailList),
			"teamID":      c.Params.TeamId,
			"senderID":    c.AppContext.Session().UserId,
			"scheduledAt": strconv.FormatInt(scheduledAt, 10),
		}

		if len(memberInvite.ChannelIds) > 0 {
			jobData["channelList"] = model.ArrayToJSON(memberInvite.ChannelIds)
		}

		// we then manually schedule the job to send another invite after 48 hours
		_, appErr = c.App.Srv().Jobs.CreateJob(model.JobTypeResendInvitationEmail, jobData)
		if appErr != nil {
			c.Err = model.NewAppError("Api4.inviteUsersToTeam", appErr.Id, nil, appErr.Error(), appErr.StatusCode)
			return
		}

		// in graceful mode we return both the successful ones and the failed ones
		js, err := json.Marshal(invitesWithError)
		if err != nil {
			c.Err = model.NewAppError("inviteUsersToTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		w.Write(js)
	} else {
		appErr := c.App.InviteNewUsersToTeam(emailList, c.Params.TeamId, c.AppContext.Session().UserId)
		if appErr != nil {
			c.Err = appErr
			return
		}
		ReturnStatusOK(w)
	}
	auditRec.Success()
}

func inviteGuestsToChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	graceful := r.URL.Query().Get("graceful") != ""
	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.InviteGuestsToChannels", "api.team.invite_guests_to_channels.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("Api4.InviteGuestsToChannels", "api.team.invite_guests_to_channels.disabled.error", nil, "", http.StatusNotImplemented)
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("inviteGuestsToChannels", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionInviteGuest) {
		c.SetPermissionError(model.PermissionInviteGuest)
		return
	}

	guestEnabled := c.App.Channels().License() != nil && *c.App.Channels().License().Features.GuestAccounts

	if !guestEnabled {
		c.Err = model.NewAppError("Api4.InviteGuestsToChannels", "api.team.invite_guests_to_channels.disabled.error", nil, "", http.StatusForbidden)
		return
	}

	var guestsInvite model.GuestsInvite
	if err := json.NewDecoder(r.Body).Decode(&guestsInvite); err != nil {
		c.Err = model.NewAppError("Api4.inviteGuestsToChannels", "api.team.invite_guests_to_channels.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	auditRec.AddEventParameter("guests_invite", guestsInvite)

	for i, email := range guestsInvite.Emails {
		guestsInvite.Emails[i] = strings.ToLower(email)
	}
	if appErr := guestsInvite.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddMeta("email_count", len(guestsInvite.Emails))
	auditRec.AddMeta("emails", guestsInvite.Emails)
	auditRec.AddMeta("channel_count", len(guestsInvite.Channels))
	auditRec.AddMeta("channels", guestsInvite.Channels)

	if graceful {
		var invitesWithError []*model.EmailInviteWithError
		var appErr *model.AppError

		if guestsInvite.Emails != nil {
			invitesWithError, appErr = c.App.InviteGuestsToChannelsGracefully(c.Params.TeamId, &guestsInvite, c.AppContext.Session().UserId)
		}

		if appErr != nil {
			errList := make([]string, 0, len(invitesWithError))
			for _, inv := range invitesWithError {
				errList = append(errList, model.EmailInviteWithErrorToString(inv))
			}
			auditRec.AddMeta("errors", errList)
			c.Err = appErr
			return
		}
		// in graceful mode we return both the successful ones and the failed ones
		js, err := json.Marshal(invitesWithError)
		if err != nil {
			c.Err = model.NewAppError("inviteGuestsToChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		w.Write(js)
	} else {
		appErr := c.App.InviteGuestsToChannels(c.Params.TeamId, &guestsInvite, c.AppContext.Session().UserId)
		if appErr != nil {
			c.Err = appErr
			return
		}
		ReturnStatusOK(w)
	}
	auditRec.Success()
}

func getInviteInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireInviteId()
	if c.Err != nil {
		return
	}

	team, appErr := c.App.GetTeamByInviteId(c.Params.InviteId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if team.Type != model.TeamOpen {
		c.Err = model.NewAppError("getInviteInfo", "api.team.get_invite_info.not_open_team", nil, "id="+c.Params.InviteId, http.StatusForbidden)
		return
	}

	result := struct {
		DisplayName string `json:"display_name"`
		Description string `json:"description"`
		Name        string `json:"name"`
		ID          string `json:"id"`
	}{
		DisplayName: team.DisplayName,
		Description: team.Description,
		Name:        team.Name,
		ID:          team.Id,
	}

	err := json.NewEncoder(w).Encode(result)
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func invalidateAllEmailInvites(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionInvalidateEmailInvite) {
		c.SetPermissionError(model.PermissionInvalidateEmailInvite)
		return
	}

	auditRec := c.MakeAuditRecord("invalidateAllEmailInvites", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.InvalidateAllEmailInvites(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getTeamIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team, err := c.App.GetTeam(c.Params.TeamId)

	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) &&
		(team.Type != model.TeamOpen || !team.AllowOpenInvite) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	etag := strconv.FormatInt(team.LastTeamIconUpdate, 10)

	if c.HandleEtag(etag, "Get Team Icon", w, r) {
		return
	}

	img, err := c.App.GetTeamIcon(team)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, private", model.DayInSeconds)) // 24 hrs
	w.Header().Set(model.HeaderEtagServer, etag)
	w.Write(img)
}

func setTeamIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(io.Discard, r.Body)

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("setTeamIcon", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("setTeamIcon", "api.team.set_team_icon.too_large.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("setTeamIcon", "api.team.set_team_icon.parse.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("setTeamIcon", "api.team.set_team_icon.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewAppError("setTeamIcon", "api.team.set_team_icon.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	imageData := imageArray[0]

	if err := c.App.SetTeamIcon(c.Params.TeamId, imageData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func removeTeamIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("removeTeamIcon", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	if err := c.App.RemoveTeamIcon(c.Params.TeamId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	ReturnStatusOK(w)
}

func updateTeamScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var p model.SchemeIDPatch
	if jsonErr := json.NewDecoder(r.Body).Decode(&p); jsonErr != nil {
		c.SetInvalidParamWithErr("scheme_id", jsonErr)
		return
	}

	schemeID := p.SchemeID
	if p.SchemeID == nil || (!model.IsValidId(*p.SchemeID) && *p.SchemeID != "") {
		c.SetInvalidParam("scheme_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamScheme", audit.Fail)
	auditRec.AddEventParameter("scheme_id_patch", p)
	defer c.LogAuditRec(auditRec)

	if c.App.Channels().License() == nil {
		c.Err = model.NewAppError("Api4.UpdateTeamScheme", "api.team.update_team_scheme.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementPermissions) {
		c.SetPermissionError(model.PermissionSysconsoleWriteUserManagementPermissions)
		return
	}

	if *schemeID != "" {
		scheme, err := c.App.GetScheme(*schemeID)
		if err != nil {
			c.Err = err
			return
		}
		auditRec.AddMeta("scheme", scheme)

		if scheme.Scope != model.SchemeScopeTeam {
			c.Err = model.NewAppError("Api4.UpdateTeamScheme", "api.team.update_team_scheme.scheme_scope.error", nil, "", http.StatusBadRequest)
			return
		}
	}

	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("team", team)

	team.SchemeId = schemeID

	team, err = c.App.UpdateTeamScheme(team)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(team)
	auditRec.AddEventObjectType("team")
	auditRec.Success()
	ReturnStatusOK(w)
}

func teamMembersMinusGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	groupIDsParam := groupIDsQueryParamRegex.ReplaceAllString(c.Params.GroupIDs, "")

	if len(groupIDsParam) < 26 {
		c.SetInvalidParam("group_ids")
		return
	}

	groupIDs := []string{}
	for _, gid := range strings.Split(c.Params.GroupIDs, ",") {
		if !model.IsValidId(gid) {
			c.SetInvalidParam("group_ids")
			return
		}
		groupIDs = append(groupIDs, gid)
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	users, totalCount, appErr := c.App.TeamMembersMinusGroupMembers(
		c.Params.TeamId,
		groupIDs,
		c.Params.Page,
		c.Params.PerPage,
	)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(&model.UsersWithGroupsAndCount{
		Users: users,
		Count: totalCount,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.teamMembersMinusGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
}
