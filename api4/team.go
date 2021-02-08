// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
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
	api.BaseRoutes.Teams.Handle("", api.ApiSessionRequired(createTeam)).Methods("POST")
	api.BaseRoutes.Teams.Handle("", api.ApiSessionRequired(getAllTeams)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/scheme", api.ApiSessionRequired(updateTeamScheme)).Methods("PUT")
	api.BaseRoutes.Teams.Handle("/search", api.ApiSessionRequiredDisableWhenBusy(searchTeams)).Methods("POST")
	api.BaseRoutes.TeamsForUser.Handle("", api.ApiSessionRequired(getTeamsForUser)).Methods("GET")
	api.BaseRoutes.TeamsForUser.Handle("/unread", api.ApiSessionRequired(getTeamsUnreadForUser)).Methods("GET")

	api.BaseRoutes.Team.Handle("", api.ApiSessionRequired(getTeam)).Methods("GET")
	api.BaseRoutes.Team.Handle("", api.ApiSessionRequired(updateTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("", api.ApiSessionRequired(deleteTeam)).Methods("DELETE")
	api.BaseRoutes.Team.Handle("/patch", api.ApiSessionRequired(patchTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/restore", api.ApiSessionRequired(restoreTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/privacy", api.ApiSessionRequired(updateTeamPrivacy)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/stats", api.ApiSessionRequired(getTeamStats)).Methods("GET")
	api.BaseRoutes.Team.Handle("/regenerate_invite_id", api.ApiSessionRequired(regenerateTeamInviteId)).Methods("POST")

	api.BaseRoutes.Team.Handle("/image", api.ApiSessionRequiredTrustRequester(getTeamIcon)).Methods("GET")
	api.BaseRoutes.Team.Handle("/image", api.ApiSessionRequired(setTeamIcon)).Methods("POST")
	api.BaseRoutes.Team.Handle("/image", api.ApiSessionRequired(removeTeamIcon)).Methods("DELETE")

	api.BaseRoutes.TeamMembers.Handle("", api.ApiSessionRequired(getTeamMembers)).Methods("GET")
	api.BaseRoutes.TeamMembers.Handle("/ids", api.ApiSessionRequired(getTeamMembersByIds)).Methods("POST")
	api.BaseRoutes.TeamMembersForUser.Handle("", api.ApiSessionRequired(getTeamMembersForUser)).Methods("GET")
	api.BaseRoutes.TeamMembers.Handle("", api.ApiSessionRequired(addTeamMember)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/members/invite", api.ApiSessionRequired(addUserToTeamFromInvite)).Methods("POST")
	api.BaseRoutes.TeamMembers.Handle("/batch", api.ApiSessionRequired(addTeamMembers)).Methods("POST")
	api.BaseRoutes.TeamMember.Handle("", api.ApiSessionRequired(removeTeamMember)).Methods("DELETE")

	api.BaseRoutes.TeamForUser.Handle("/unread", api.ApiSessionRequired(getTeamUnread)).Methods("GET")

	api.BaseRoutes.TeamByName.Handle("", api.ApiSessionRequired(getTeamByName)).Methods("GET")
	api.BaseRoutes.TeamMember.Handle("", api.ApiSessionRequired(getTeamMember)).Methods("GET")
	api.BaseRoutes.TeamByName.Handle("/exists", api.ApiSessionRequired(teamExists)).Methods("GET")
	api.BaseRoutes.TeamMember.Handle("/roles", api.ApiSessionRequired(updateTeamMemberRoles)).Methods("PUT")
	api.BaseRoutes.TeamMember.Handle("/schemeRoles", api.ApiSessionRequired(updateTeamMemberSchemeRoles)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/import", api.ApiSessionRequired(importTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/invite/email", api.ApiSessionRequired(inviteUsersToTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/invite-guests/email", api.ApiSessionRequired(inviteGuestsToChannels)).Methods("POST")
	api.BaseRoutes.Teams.Handle("/invites/email", api.ApiSessionRequired(invalidateAllEmailInvites)).Methods("DELETE")
	api.BaseRoutes.Teams.Handle("/invite/{invite_id:[A-Za-z0-9]+}", api.ApiHandler(getInviteInfo)).Methods("GET")

	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/members_minus_group_members", api.ApiSessionRequired(teamMembersMinusGroupMembers)).Methods("GET")
}

func createTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	team := model.TeamFromJson(r.Body)
	if team == nil {
		c.SetInvalidParam("team")
		return
	}
	team.Email = strings.ToLower(team.Email)

	auditRec := c.MakeAuditRecord("createTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team", team)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_CREATE_TEAM) {
		c.Err = model.NewAppError("createTeam", "api.team.is_team_creation_allowed.disabled.app_error", nil, "", http.StatusForbidden)
		return
	}

	rteam, err := c.App.CreateTeamWithUser(team, c.App.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	// Don't sanitize the team here since the user will be a team admin and their session won't reflect that yet

	auditRec.Success()
	auditRec.AddMeta("team", team) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rteam.ToJson()))
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

	if (!team.AllowOpenInvite || team.Type != model.TEAM_OPEN) && !c.App.SessionHasPermissionToTeam(*c.App.Session(), team.Id, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	c.App.SanitizeTeam(*c.App.Session(), team)
	w.Write([]byte(team.ToJson()))
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

	if (!team.AllowOpenInvite || team.Type != model.TEAM_OPEN) && !c.App.SessionHasPermissionToTeam(*c.App.Session(), team.Id, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	c.App.SanitizeTeam(*c.App.Session(), team)
	w.Write([]byte(team.ToJson()))
}

func updateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team := model.TeamFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("team")
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
	auditRec.AddMeta("team", team)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	updatedTeam, err := c.App.UpdateTeam(team)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("update", updatedTeam)

	c.App.SanitizeTeam(*c.App.Session(), updatedTeam)
	w.Write([]byte(updatedTeam.ToJson()))
}

func patchTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	team := model.TeamPatchFromJson(r.Body)

	if team == nil {
		c.SetInvalidParam("team")
		return
	}

	auditRec := c.MakeAuditRecord("patchTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	if oldTeam, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddMeta("team", oldTeam)
	}

	patchedTeam, err := c.App.PatchTeam(c.Params.TeamId, team)

	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(*c.App.Session(), patchedTeam)

	auditRec.Success()
	auditRec.AddMeta("patched", patchedTeam)
	c.LogAudit("")

	w.Write([]byte(patchedTeam.ToJson()))
}

func restoreTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("restoreTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
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

	auditRec.AddMeta("team", team)
	auditRec.Success()

	w.Write([]byte(team.ToJson()))
}

func updateTeamPrivacy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	props := model.StringInterfaceFromJson(r.Body)
	privacy, ok := props["privacy"].(string)
	if !ok {
		c.SetInvalidParam("privacy")
		return
	}

	var openInvite bool
	switch privacy {
	case model.TEAM_OPEN:
		openInvite = true
	case model.TEAM_INVITE:
		openInvite = false
	default:
		c.SetInvalidParam("privacy")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamPrivacy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("privacy", privacy)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		auditRec.AddMeta("team_id", c.Params.TeamId)
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
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

	auditRec.AddMeta("team", team)
	auditRec.Success()

	w.Write([]byte(team.ToJson()))
}

func regenerateTeamInviteId(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	auditRec := c.MakeAuditRecord("regenerateTeamInviteId", audit.Fail)
	defer c.LogAuditRec(auditRec)

	patchedTeam, err := c.App.RegenerateTeamInviteId(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeam(*c.App.Session(), patchedTeam)

	auditRec.Success()
	auditRec.AddMeta("team", patchedTeam)
	c.LogAudit("")

	w.Write([]byte(patchedTeam.ToJson()))
}

func deleteTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
		return
	}

	auditRec := c.MakeAuditRecord("deleteTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if team, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddMeta("team", team)
	}

	var err *model.AppError
	if c.Params.Permanent {
		if *c.App.Config().ServiceSettings.EnableAPITeamDeletion {
			err = c.App.PermanentDeleteTeamId(c.Params.TeamId)
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

func getTeamsForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_USERS)
		return
	}

	teams, err := c.App.GetTeamsForUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeams(*c.App.Session(), teams)
	w.Write([]byte(model.TeamListToJson(teams)))
}

func getTeamsUnreadForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	// optional team id to be excluded from the result
	teamId := r.URL.Query().Get("exclude_team")

	unreadTeamsList, err := c.App.GetTeamsUnreadForUser(teamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamsUnreadToJson(unreadTeamsList)))
}

func getTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session().UserId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	team, err := c.App.GetTeamMember(c.Params.TeamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(team.ToJson()))
}

func getTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	sort := r.URL.Query().Get("sort")
	excludeDeletedUsers := r.URL.Query().Get("exclude_deleted_users")
	excludeDeletedUsersBool, _ := strconv.ParseBool(excludeDeletedUsers)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	teamMembersGetOptions := &model.TeamMembersGetOptions{
		Sort:                sort,
		ExcludeDeletedUsers: excludeDeletedUsersBool,
		ViewRestrictions:    restrictions,
	}

	members, err := c.App.GetTeamMembers(c.Params.TeamId, c.Params.Page*c.Params.PerPage, c.Params.PerPage, teamMembersGetOptions)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamMembersToJson(members)))
}

func getTeamMembersForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_READ_OTHER_USERS_TEAMS) {
		c.SetPermissionError(model.PERMISSION_READ_OTHER_USERS_TEAMS)
		return
	}

	canSee, err := c.App.UserCanSeeOtherUser(c.App.Session().UserId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	if !canSee {
		c.SetPermissionError(model.PERMISSION_VIEW_MEMBERS)
		return
	}

	members, err := c.App.GetTeamMembersForUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamMembersToJson(members)))
}

func getTeamMembersByIds(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	userIds := model.ArrayFromJson(r.Body)

	if len(userIds) == 0 {
		c.SetInvalidParam("user_ids")
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	members, err := c.App.GetTeamMembersByIds(c.Params.TeamId, userIds, restrictions)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamMembersToJson(members)))
}

func addTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var err *model.AppError
	member := model.TeamMemberFromJson(r.Body)
	if member == nil {
		c.Err = model.NewAppError("addTeamMember", "api.team.add_team_member.invalid_body.app_error", nil, "Error in model.TeamMemberFromJson()", http.StatusBadRequest)
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
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("member", member)

	if member.UserId == c.App.Session().UserId {
		var team *model.Team
		team, err = c.App.GetTeam(member.TeamId)
		if err != nil {
			c.Err = err
			return
		}

		if team.AllowOpenInvite && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_JOIN_PUBLIC_TEAMS) {
			c.SetPermissionError(model.PERMISSION_JOIN_PUBLIC_TEAMS)
			return
		}
		if !team.AllowOpenInvite && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_JOIN_PRIVATE_TEAMS) {
			c.SetPermissionError(model.PERMISSION_JOIN_PRIVATE_TEAMS)
			return
		}
	} else {
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), member.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
			c.SetPermissionError(model.PERMISSION_ADD_USER_TO_TEAM)
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
			c.Err = model.NewAppError("addTeamMember", "api.team.add_members.user_denied", map[string]interface{}{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	member, err = c.App.AddTeamMember(member.TeamId, member.UserId)

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(member.ToJson()))
}

func addUserToTeamFromInvite(c *Context, w http.ResponseWriter, r *http.Request) {
	tokenId := r.URL.Query().Get("token")
	inviteId := r.URL.Query().Get("invite_id")

	var member *model.TeamMember
	var err *model.AppError

	auditRec := c.MakeAuditRecord("addUserToTeamFromInvite", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("invite_id", inviteId)

	if tokenId != "" {
		member, err = c.App.AddTeamMemberByToken(c.App.Session().UserId, tokenId)
	} else if inviteId != "" {
		if c.App.Session().Props[model.SESSION_PROP_IS_GUEST] == "true" {
			c.Err = model.NewAppError("addUserToTeamFromInvite", "api.team.add_user_to_team_from_invite.guest.app_error", nil, "", http.StatusForbidden)
			return
		}

		member, err = c.App.AddTeamMemberByInviteId(inviteId, c.App.Session().UserId)
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
	w.Write([]byte(member.ToJson()))
}

func addTeamMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	graceful := r.URL.Query().Get("graceful") != ""

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	var err *model.AppError
	members := model.TeamMembersFromJson(r.Body)

	if len(members) > MaxAddMembersBatch {
		c.SetInvalidParam("too many members in batch")
		return
	}

	if len(members) == 0 {
		c.SetInvalidParam("no members in batch")
		return
	}

	auditRec := c.MakeAuditRecord("addTeamMembers", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("count", len(members))

	var memberIDs []string
	for _, member := range members {
		memberIDs = append(memberIDs, member.UserId)
	}
	auditRec.AddMeta("user_ids", memberIDs)

	team, err := c.App.GetTeam(c.Params.TeamId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("team", team)

	if team.IsGroupConstrained() {
		nonMembers, err := c.App.FilterNonGroupTeamMembers(memberIDs, team)
		if err != nil {
			if v, ok := err.(*model.AppError); ok {
				c.Err = v
			} else {
				c.Err = model.NewAppError("addTeamMembers", "api.team.add_members.error", nil, err.Error(), http.StatusBadRequest)
			}
			return
		}
		if len(nonMembers) > 0 {
			c.Err = model.NewAppError("addTeamMembers", "api.team.add_members.user_denied", map[string]interface{}{"UserIDs": nonMembers}, "", http.StatusBadRequest)
			return
		}
	}

	var userIds []string
	for _, member := range members {
		if member.TeamId != c.Params.TeamId {
			c.SetInvalidParam("team_id for member with user_id=" + member.UserId)
			return
		}

		if !model.IsValidId(member.UserId) {
			c.SetInvalidParam("user_id")
			return
		}

		userIds = append(userIds, member.UserId)
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
		c.SetPermissionError(model.PERMISSION_ADD_USER_TO_TEAM)
		return
	}

	membersWithErrors, err := c.App.AddTeamMembers(c.Params.TeamId, userIds, c.App.Session().UserId, graceful)

	if membersWithErrors != nil {
		errList := make([]string, 0, len(membersWithErrors))
		for _, m := range membersWithErrors {
			if m.Error != nil {
				errList = append(errList, model.TeamMemberWithErrorToString(m))
			}
		}
		auditRec.AddMeta("errors", errList)
	}
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	w.WriteHeader(http.StatusCreated)

	if graceful {
		// in 'graceful' mode we allow a different return value, notifying the client which users were not added
		w.Write([]byte(model.TeamMembersWithErrorToJson(membersWithErrors)))
	} else {
		w.Write([]byte(model.TeamMembersToJson(model.TeamMembersWithErrorToTeamMembers(membersWithErrors))))
	}

}

func removeTeamMember(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("removeTeamMember", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.App.Session().UserId != c.Params.UserId {
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_REMOVE_USER_FROM_TEAM) {
			c.SetPermissionError(model.PERMISSION_REMOVE_USER_FROM_TEAM)
			return
		}
	}

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

	if team.IsGroupConstrained() && (c.Params.UserId != c.App.Session().UserId) && !user.IsBot {
		c.Err = model.NewAppError("removeTeamMember", "api.team.remove_member.group_constrained.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if err := c.App.RemoveUserFromTeam(c.Params.TeamId, c.Params.UserId, c.App.Session().UserId); err != nil {
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

	if !c.App.SessionHasPermissionToUser(*c.App.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	unreadTeam, err := c.App.GetTeamUnread(c.Params.TeamId, c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(unreadTeam.ToJson()))
}

func getTeamStats(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_VIEW_TEAM) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
		return
	}

	restrictions, err := c.App.GetViewUsersRestrictions(c.App.Session().UserId)
	if err != nil {
		c.Err = err
		return
	}

	stats, err := c.App.GetTeamStats(c.Params.TeamId, restrictions)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(stats.ToJson()))
}

func updateTeamMemberRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	props := model.MapFromJson(r.Body)

	newRoles := props["roles"]
	if !model.IsValidUserRoles(newRoles) {
		c.SetInvalidParam("team_member_roles")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamMemberRoles", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("roles", newRoles)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM_ROLES)
		return
	}

	teamMember, err := c.App.UpdateTeamMemberRoles(c.Params.TeamId, c.Params.UserId, newRoles)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("member", teamMember)

	ReturnStatusOK(w)
}

func updateTeamMemberSchemeRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId().RequireUserId()
	if c.Err != nil {
		return
	}

	schemeRoles := model.SchemeRolesFromJson(r.Body)
	if schemeRoles == nil {
		c.SetInvalidParam("scheme_roles")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamMemberSchemeRoles", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("roles", schemeRoles)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM_ROLES) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM_ROLES)
		return
	}

	teamMember, err := c.App.UpdateTeamMemberSchemeRoles(c.Params.TeamId, c.Params.UserId, schemeRoles.SchemeGuest, schemeRoles.SchemeUser, schemeRoles.SchemeAdmin)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("member", teamMember)

	ReturnStatusOK(w)
}

func getAllTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	teams := []*model.Team{}
	var err *model.AppError
	var teamsWithCount *model.TeamsWithCount

	listPrivate := c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PRIVATE_TEAMS)
	listPublic := c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PUBLIC_TEAMS)
	if listPrivate && listPublic {
		if c.Params.IncludeTotalCount {
			teamsWithCount, err = c.App.GetAllTeamsPageWithCount(c.Params.Page*c.Params.PerPage, c.Params.PerPage)
		} else {
			teams, err = c.App.GetAllTeamsPage(c.Params.Page*c.Params.PerPage, c.Params.PerPage)
		}
	} else if listPrivate {
		if c.Params.IncludeTotalCount {
			teamsWithCount, err = c.App.GetAllPrivateTeamsPageWithCount(c.Params.Page*c.Params.PerPage, c.Params.PerPage)
		} else {
			teams, err = c.App.GetAllPrivateTeamsPage(c.Params.Page*c.Params.PerPage, c.Params.PerPage)
		}
	} else if listPublic {
		if c.Params.IncludeTotalCount {
			teamsWithCount, err = c.App.GetAllPublicTeamsPageWithCount(c.Params.Page*c.Params.PerPage, c.Params.PerPage)
		} else {
			teams, err = c.App.GetAllPublicTeamsPage(c.Params.Page*c.Params.PerPage, c.Params.PerPage)
		}
	} else {
		// The user doesn't have permissions to list private as well as public teams.
		err = model.NewAppError("getAllTeams", "api.team.get_all_teams.insufficient_permissions", nil, "", http.StatusForbidden)
	}
	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeams(*c.App.Session(), teams)

	var resBody []byte

	if c.Params.IncludeTotalCount {
		resBody = model.TeamsWithCountToJson(teamsWithCount)
	} else {
		resBody = []byte(model.TeamListToJson(teams))
	}

	w.Write(resBody)
}

func searchTeams(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.TeamSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("team_search")
		return
	}

	var teams []*model.Team
	var totalCount int64
	var err *model.AppError

	if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PRIVATE_TEAMS) && c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PUBLIC_TEAMS) {
		teams, totalCount, err = c.App.SearchAllTeams(props)
	} else if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PRIVATE_TEAMS) {
		if props.Page != nil || props.PerPage != nil {
			c.Err = model.NewAppError("searchTeams", "api.team.search_teams.pagination_not_implemented.private_team_search", nil, "", http.StatusNotImplemented)
			return
		}
		teams, err = c.App.SearchPrivateTeams(props.Term)
	} else if c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PUBLIC_TEAMS) {
		if props.Page != nil || props.PerPage != nil {
			c.Err = model.NewAppError("searchTeams", "api.team.search_teams.pagination_not_implemented.public_team_search", nil, "", http.StatusNotImplemented)
			return
		}
		teams, err = c.App.SearchPublicTeams(props.Term)
	} else {
		teams = []*model.Team{}
	}

	if err != nil {
		c.Err = err
		return
	}

	c.App.SanitizeTeams(*c.App.Session(), teams)

	var payload []byte
	if props.Page != nil && props.PerPage != nil {
		twc := &model.TeamsWithCount{Teams: teams, TotalCount: totalCount}
		payload = model.TeamsWithCountToJson(twc)
	} else {
		payload = []byte(model.TeamListToJson(teams))
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
		teamMember, err = c.App.GetTeamMember(team.Id, c.App.Session().UserId)
		if err != nil && err.StatusCode != http.StatusNotFound {
			c.Err = err
			return
		}

		// Verify that the user can see the team (be a member or have the permission to list the team)
		if (teamMember != nil && teamMember.DeleteAt == 0) ||
			(team.AllowOpenInvite && c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PUBLIC_TEAMS)) ||
			(!team.AllowOpenInvite && c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_LIST_PRIVATE_TEAMS)) {
			exists = true
		}
	}

	resp := map[string]bool{"exists": exists}
	w.Write([]byte(model.MapBoolToJson(resp)))
}

func importTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() != nil && *c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("importTeam", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_IMPORT_TEAM) {
		c.SetPermissionError(model.PERMISSION_IMPORT_TEAM)
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
	auditRec.AddMeta("team_id", c.Params.TeamId)

	fileInfo := fileInfoArray[0]

	fileData, err := fileInfo.Open()
	if err != nil {
		c.Err = model.NewAppError("importTeam", "api.team.import_team.open.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer fileData.Close()
	auditRec.AddMeta("filename", fileInfo.Filename)
	auditRec.AddMeta("filesize", fileSize)
	auditRec.AddMeta("from", importFrom)

	var log *bytes.Buffer
	data := map[string]string{}
	switch importFrom {
	case "slack":
		var err *model.AppError
		if err, log = c.App.SlackImport(fileData, fileSize, c.Params.TeamId); err != nil {
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
	w.Write([]byte(model.MapToJson(data)))
}

func inviteUsersToTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	graceful := r.URL.Query().Get("graceful") != ""

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_INVITE_USER) {
		c.SetPermissionError(model.PERMISSION_INVITE_USER)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_ADD_USER_TO_TEAM) {
		c.SetPermissionError(model.PERMISSION_INVITE_USER)
		return
	}

	emailList := model.ArrayFromJson(r.Body)

	for i := range emailList {
		emailList[i] = strings.ToLower(emailList[i])
	}

	if len(emailList) == 0 {
		c.SetInvalidParam("user_email")
		return
	}

	auditRec := c.MakeAuditRecord("inviteUsersToTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team_id", c.Params.TeamId)
	auditRec.AddMeta("count", len(emailList))
	auditRec.AddMeta("emails", emailList)

	if graceful {
		cloudUserLimit := *c.App.Config().ExperimentalSettings.CloudUserLimit
		var invitesOverLimit []*model.EmailInviteWithError
		if c.App.Srv().License() != nil && *c.App.Srv().License().Features.Cloud && cloudUserLimit > 0 {
			subscription, subErr := c.App.Cloud().GetSubscription()
			if subErr != nil {
				c.Err = subErr
				return
			}
			if subscription == nil || subscription.IsPaidTier != "true" {
				emailList, invitesOverLimit, _ = c.App.GetErrorListForEmailsOverLimit(emailList, cloudUserLimit)
			}
		}
		var invitesWithError []*model.EmailInviteWithError
		var err *model.AppError
		if emailList != nil {
			invitesWithError, err = c.App.InviteNewUsersToTeamGracefully(emailList, c.Params.TeamId, c.App.Session().UserId)
		}

		if len(invitesOverLimit) > 0 {
			invitesWithError = append(invitesWithError, invitesOverLimit...)
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
		if err != nil {
			c.Err = err
			return
		}
		// in graceful mode we return both the successful ones and the failed ones
		w.Write([]byte(model.EmailInviteWithErrorToJson(invitesWithError)))
	} else {
		err := c.App.InviteNewUsersToTeam(emailList, c.Params.TeamId, c.App.Session().UserId)
		if err != nil {
			c.Err = err
			return
		}
		ReturnStatusOK(w)
	}
	auditRec.Success()
}

func inviteGuestsToChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	graceful := r.URL.Query().Get("graceful") != ""
	if c.App.Srv().License() == nil {
		c.Err = model.NewAppError("Api4.InviteGuestsToChannels", "api.team.invate_guests_to_channels.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().GuestAccountsSettings.Enable {
		c.Err = model.NewAppError("Api4.InviteGuestsToChannels", "api.team.invate_guests_to_channels.disabled.error", nil, "", http.StatusNotImplemented)
		return
	}

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("inviteGuestsToChannels", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_INVITE_GUEST) {
		c.SetPermissionError(model.PERMISSION_INVITE_GUEST)
		return
	}

	guestsInvite := model.GuestsInviteFromJson(r.Body)
	for i, email := range guestsInvite.Emails {
		guestsInvite.Emails[i] = strings.ToLower(email)
	}
	if err := guestsInvite.IsValid(); err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("email_count", len(guestsInvite.Emails))
	auditRec.AddMeta("emails", guestsInvite.Emails)
	auditRec.AddMeta("channel_count", len(guestsInvite.Channels))
	auditRec.AddMeta("channels", guestsInvite.Channels)

	if graceful {
		cloudUserLimit := *c.App.Config().ExperimentalSettings.CloudUserLimit
		var invitesOverLimit []*model.EmailInviteWithError
		if c.App.Srv().License() != nil && *c.App.Srv().License().Features.Cloud && cloudUserLimit > 0 && c.IsSystemAdmin() {
			subscription, subErr := c.App.Cloud().GetSubscription()
			if subErr != nil {
				c.Err = subErr
				return
			}
			if subscription == nil || subscription.IsPaidTier != "true" {
				guestsInvite.Emails, invitesOverLimit, _ = c.App.GetErrorListForEmailsOverLimit(guestsInvite.Emails, cloudUserLimit)
			}
		}

		var invitesWithError []*model.EmailInviteWithError
		var err *model.AppError

		if guestsInvite.Emails != nil {
			invitesWithError, err = c.App.InviteGuestsToChannelsGracefully(c.Params.TeamId, guestsInvite, c.App.Session().UserId)
		}

		if len(invitesOverLimit) > 0 {
			invitesWithError = append(invitesWithError, invitesOverLimit...)
		}

		if err != nil {
			errList := make([]string, 0, len(invitesWithError))
			for _, inv := range invitesWithError {
				errList = append(errList, model.EmailInviteWithErrorToString(inv))
			}
			auditRec.AddMeta("errors", errList)
			c.Err = err
			return
		}
		// in graceful mode we return both the successful ones and the failed ones
		w.Write([]byte(model.EmailInviteWithErrorToJson(invitesWithError)))
	} else {
		err := c.App.InviteGuestsToChannels(c.Params.TeamId, guestsInvite, c.App.Session().UserId)
		if err != nil {
			c.Err = err
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

	team, err := c.App.GetTeamByInviteId(c.Params.InviteId)
	if err != nil {
		c.Err = err
		return
	}

	if team.Type != model.TEAM_OPEN {
		c.Err = model.NewAppError("getInviteInfo", "api.team.get_invite_info.not_open_team", nil, "id="+c.Params.InviteId, http.StatusForbidden)
		return
	}

	result := map[string]string{}
	result["display_name"] = team.DisplayName
	result["description"] = team.Description
	result["name"] = team.Name
	result["id"] = team.Id
	w.Write([]byte(model.MapToJson(result)))
}

func invalidateAllEmailInvites(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_AUTHENTICATION)
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

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_VIEW_TEAM) &&
		(team.Type != model.TEAM_OPEN || !team.AllowOpenInvite) {
		c.SetPermissionError(model.PERMISSION_VIEW_TEAM)
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
	w.Header().Set("Cache-Control", fmt.Sprintf("max-age=%v, private", 24*60*60)) // 24 hrs
	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write(img)
}

func setTeamIcon(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(ioutil.Discard, r.Body)

	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("setTeamIcon", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
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
	auditRec.AddMeta("team_id", c.Params.TeamId)

	if !c.App.SessionHasPermissionToTeam(*c.App.Session(), c.Params.TeamId, model.PERMISSION_MANAGE_TEAM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_TEAM)
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

	schemeID := model.SchemeIDFromJson(r.Body)
	if schemeID == nil || (!model.IsValidId(*schemeID) && *schemeID != "") {
		c.SetInvalidParam("scheme_id")
		return
	}

	auditRec := c.MakeAuditRecord("updateTeamScheme", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.App.Srv().License() == nil {
		c.Err = model.NewAppError("Api4.UpdateTeamScheme", "api.team.update_team_scheme.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS)
		return
	}

	if *schemeID != "" {
		scheme, err := c.App.GetScheme(*schemeID)
		if err != nil {
			c.Err = err
			return
		}
		auditRec.AddMeta("scheme", scheme)

		if scheme.Scope != model.SCHEME_SCOPE_TEAM {
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

	_, err = c.App.UpdateTeamScheme(team)
	if err != nil {
		c.Err = err
		return
	}

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

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS)
		return
	}

	users, totalCount, err := c.App.TeamMembersMinusGroupMembers(
		c.Params.TeamId,
		groupIDs,
		c.Params.Page,
		c.Params.PerPage,
	)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(&model.UsersWithGroupsAndCount{
		Users: users,
		Count: totalCount,
	})
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.teamMembersMinusGroupMembers", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}
