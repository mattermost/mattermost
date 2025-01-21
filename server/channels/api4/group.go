// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/web"
	"github.com/mattermost/mattermost/server/v8/platform/services/telemetry"
)

func (api *API) InitGroup() {
	// GET /api/v4/groups
	api.BaseRoutes.Groups.Handle("", api.APISessionRequired(getGroups)).Methods(http.MethodGet)

	// POST /api/v4/groups
	api.BaseRoutes.Groups.Handle("", api.APISessionRequired(createGroup)).Methods(http.MethodPost)

	// GET /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}",
		api.APISessionRequired(getGroup)).Methods(http.MethodGet)

	// PUT /api/v4/groups/:group_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/patch",
		api.APISessionRequired(patchGroup)).Methods(http.MethodPut)

	// POST /api/v4/groups/:group_id/teams/:team_id/link
	// POST /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/link",
		api.APISessionRequired(linkGroupSyncable)).Methods(http.MethodPost)

	// DELETE /api/v4/groups/:group_id/teams/:team_id/link
	// DELETE /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/link",
		api.APISessionRequired(unlinkGroupSyncable)).Methods(http.MethodDelete)

	// GET /api/v4/groups/:group_id/teams/:team_id
	// GET /api/v4/groups/:group_id/channels/:channel_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}",
		api.APISessionRequired(getGroupSyncable)).Methods(http.MethodGet)

	// GET /api/v4/groups/:group_id/teams
	// GET /api/v4/groups/:group_id/channels
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}",
		api.APISessionRequired(getGroupSyncables)).Methods(http.MethodGet)

	// PUT /api/v4/groups/:group_id/teams/:team_id/patch
	// PUT /api/v4/groups/:group_id/channels/:channel_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/patch",
		api.APISessionRequired(patchGroupSyncable)).Methods(http.MethodPut)

	// GET /api/v4/groups/:group_id/stats
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/stats",
		api.APISessionRequired(getGroupStats)).Methods(http.MethodGet)

	// GET /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.APISessionRequired(getGroupMembers)).Methods(http.MethodGet)

	// GET /api/v4/users/:user_id/groups
	api.BaseRoutes.Users.Handle("/{user_id:[A-Za-z0-9]+}/groups",
		api.APISessionRequired(getGroupsByUserId)).Methods(http.MethodGet)

	// GET /api/v4/channels/:channel_id/groups
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/groups",
		api.APISessionRequired(getGroupsByChannel)).Methods(http.MethodGet)

	// GET /api/v4/teams/:team_id/groups
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups",
		api.APISessionRequired(getGroupsByTeam)).Methods(http.MethodGet)

	// GET /api/v4/teams/:team_id/groups_by_channels
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups_by_channels",
		api.APISessionRequired(getGroupsAssociatedToChannelsByTeam)).Methods(http.MethodGet)

	// DELETE /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}",
		api.APISessionRequired(deleteGroup)).Methods(http.MethodDelete)

	// POST /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/restore",
		api.APISessionRequired(restoreGroup)).Methods(http.MethodPost)

	// POST /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.APISessionRequired(addGroupMembers)).Methods(http.MethodPost)

	// DELETE /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.APISessionRequired(deleteGroupMembers)).Methods(http.MethodDelete)
}

func getGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}

	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	group, appErr := c.App.GetGroup(c.Params.GroupId, &model.GetGroupOpts{
		IncludeMemberCount: c.Params.IncludeMemberCount,
		IncludeMemberIDs:   c.Params.IncludeMemberIDs,
	}, restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if group.Source == model.GroupSourceLdap {
		if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionSysconsoleReadUserManagementGroups) {
			c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
			return
		}
	}

	if appErr := licensedAndConfiguredForGroupBySource(c.App, group.Source); appErr != nil {
		appErr.Where = "Api4.getGroup"
		c.Err = appErr
		return
	}

	b, err := json.Marshal(group)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	var group *model.GroupWithUserIds
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil || group == nil {
		c.SetInvalidParamWithErr("group", err)
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("createGroup", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	if appErr := licensedAndConfiguredForGroupBySource(c.App, group.Source); appErr != nil {
		appErr.Where = "Api4.createGroup"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionCreateCustomGroup) {
		c.SetPermissionError(model.PermissionCreateCustomGroup)
		return
	}

	if !group.AllowReference {
		c.Err = model.NewAppError("createGroup", "api.custom_groups.must_be_referenceable", nil, "", http.StatusBadRequest)
		return
	}

	if group.GetRemoteId() != "" {
		c.Err = model.NewAppError("createGroup", "api.custom_groups.no_remote_id", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("createGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "group", group)

	newGroup, appErr := c.App.CreateGroupWithUserIds(group)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(newGroup)
	auditRec.AddEventObjectType("group")
	js, err := json.Marshal(newGroup)
	if err != nil {
		c.Err = model.NewAppError("createGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	group, appErr := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, group.Source)
	if appErr != nil {
		appErr.Where = "Api4.patchGroup"
		c.Err = appErr
		return
	}

	var requiredPermission *model.Permission
	if group.Source == model.GroupSourceCustom {
		requiredPermission = model.PermissionEditCustomGroup
	} else {
		requiredPermission = model.PermissionSysconsoleWriteUserManagementGroups
	}
	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, requiredPermission) {
		c.SetPermissionError(requiredPermission)
		return
	}

	var groupPatch model.GroupPatch
	if err := json.NewDecoder(r.Body).Decode(&groupPatch); err != nil {
		c.SetInvalidParamWithErr("group", err)
		return
	}

	if group.Source == model.GroupSourceCustom && groupPatch.AllowReference != nil && !*groupPatch.AllowReference {
		c.Err = model.NewAppError("Api4.patchGroup", "api.custom_groups.must_be_referenceable", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("patchGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameterAuditable(auditRec, "group", group)

	if groupPatch.AllowReference != nil && *groupPatch.AllowReference {
		if groupPatch.Name == nil {
			tmp := strings.ReplaceAll(strings.ToLower(group.DisplayName), " ", "-")
			groupPatch.Name = &tmp
		} else {
			if *groupPatch.Name == model.UserNotifyAll || *groupPatch.Name == model.ChannelMentionsNotifyProp || *groupPatch.Name == model.UserNotifyHere {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_reserved_name_error", nil, "", http.StatusBadRequest)
				return
			}
			//check if a user already has this group name
			user, _ := c.App.GetUserByUsername(*groupPatch.Name)
			if user != nil {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_user_name_error", nil, "", http.StatusBadRequest)
				return
			}
			//check if a mentionable group already has this name
			searchOpts := model.GroupSearchOpts{
				FilterAllowReference: true,
			}
			existingGroup, _ := c.App.GetGroupByName(*groupPatch.Name, searchOpts)
			if existingGroup != nil {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_group_name_error", nil, "", http.StatusBadRequest)
				return
			}
		}
	}

	group.Patch(&groupPatch)

	group, appErr = c.App.UpdateGroup(group)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.AddEventResultState(group)
	auditRec.AddEventObjectType("group")

	c.App.Srv().GetTelemetryService().SendTelemetryForFeature(
		telemetry.TrackGroupsFeature,
		"modify_group__edit_details",
		map[string]any{
			telemetry.TrackPropertyUser:  c.AppContext.Session().UserId,
			telemetry.TrackPropertyGroup: group.Id,
		})

	b, err := json.Marshal(group)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func linkGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	c.RequireSyncableId()
	if c.Err != nil {
		return
	}
	syncableID := c.Params.SyncableId

	c.RequireSyncableType()
	if c.Err != nil {
		return
	}
	syncableType := c.Params.SyncableType

	body, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.io_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec := c.MakeAuditRecord("linkGroupSyncable", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "group_id", c.Params.GroupId)
	audit.AddEventParameter(auditRec, "syncable_id", syncableID)
	audit.AddEventParameter(auditRec, "syncable_type", string(syncableType))

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr(fmt.Sprintf("Group%s", syncableType), err)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "patch", patch)

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	appErr := verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if appErr != nil {
		appErr.Where = "Api4.linkGroupSyncable"
		c.Err = appErr
		return
	}

	groupSyncable := &model.GroupSyncable{
		GroupId:    c.Params.GroupId,
		SyncableId: syncableID,
		Type:       syncableType,
	}
	groupSyncable.Patch(patch)
	groupSyncable, appErr = c.App.UpsertGroupSyncable(groupSyncable)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(groupSyncable)
	auditRec.AddEventObjectType("group_syncable")

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(c.AppContext, syncableID, syncableType, false)
	})

	w.WriteHeader(http.StatusCreated)

	b, err := json.Marshal(groupSyncable)
	if err != nil {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	c.RequireSyncableId()
	if c.Err != nil {
		return
	}
	syncableID := c.Params.SyncableId

	c.RequireSyncableType()
	if c.Err != nil {
		return
	}
	syncableType := c.Params.SyncableType

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	groupSyncable, appErr := c.App.GetGroupSyncable(c.Params.GroupId, syncableID, syncableType)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(groupSyncable)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupSyncables(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	c.RequireSyncableType()
	if c.Err != nil {
		return
	}
	syncableType := c.Params.SyncableType

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupSyncables", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	groupSyncables, appErr := c.App.GetGroupSyncables(c.Params.GroupId, syncableType)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(groupSyncables)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupSyncables", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func patchGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	c.RequireSyncableId()
	if c.Err != nil {
		return
	}
	syncableID := c.Params.SyncableId

	c.RequireSyncableType()
	if c.Err != nil {
		return
	}
	syncableType := c.Params.SyncableType

	body, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.io_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	auditRec := c.MakeAuditRecord("patchGroupSyncable", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "group_id", c.Params.GroupId)
	audit.AddEventParameter(auditRec, "old_syncable_id", syncableID)
	audit.AddEventParameter(auditRec, "old_syncable_type", string(syncableType))

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr(fmt.Sprintf("Group[%s]Patch", syncableType), err)
		return
	}

	audit.AddEventParameterAuditable(auditRec, "patch", patch)

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.ldap_groups.license_error", nil, "",
			http.StatusForbidden)
		return
	}

	appErr := verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if appErr != nil {
		appErr.Where = "Api4.patchGroupSyncable"
		c.Err = appErr
		return
	}

	groupSyncable, appErr := c.App.GetGroupSyncable(c.Params.GroupId, syncableID, syncableType)
	if appErr != nil {
		c.Err = appErr
		return
	}

	groupSyncable.Patch(patch)

	groupSyncable, appErr = c.App.UpdateGroupSyncable(groupSyncable)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.AddEventResultState(groupSyncable)
	auditRec.AddEventObjectType("group_syncable")

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(c.AppContext, syncableID, syncableType, false)
	})

	b, err := json.Marshal(groupSyncable)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func unlinkGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	c.RequireSyncableId()
	if c.Err != nil {
		return
	}
	syncableID := c.Params.SyncableId

	c.RequireSyncableType()
	if c.Err != nil {
		return
	}
	syncableType := c.Params.SyncableType

	auditRec := c.MakeAuditRecord("unlinkGroupSyncable", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "group_id", c.Params.GroupId)
	audit.AddEventParameter(auditRec, "syncable_id", syncableID)
	audit.AddEventParameter(auditRec, "syncable_type", string(syncableType))

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.unlinkGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	appErr := verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if appErr != nil {
		appErr.Where = "Api4.unlinkGroupSyncable"
		c.Err = appErr
		return
	}

	_, appErr = c.App.DeleteGroupSyncable(c.Params.GroupId, syncableID, syncableType)
	if appErr != nil {
		c.Err = appErr
		return
	}

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(c.AppContext, syncableID, syncableType, false)
	})

	auditRec.Success()

	ReturnStatusOK(w)
}

func verifyLinkUnlinkPermission(c *Context, syncableType model.GroupSyncableType, syncableID string) *model.AppError {
	group, appErr := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if appErr != nil {
		return appErr
	}

	if group.Source != model.GroupSourceLdap {
		return model.NewAppError("Api4.linkGroupSyncable", "app.group.crud_permission", nil, "", http.StatusBadRequest)
	}

	// If AllowReference is disabled, limit who can link the group.
	// This voids leaking the list of group members.
	// See https://mattermost.atlassian.net/browse/MM-55314 for more details.
	if !group.AllowReference {
		if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionSysconsoleReadUserManagementGroups) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionSysconsoleReadUserManagementGroups})
		}
	}

	switch syncableType {
	case model.GroupSyncableTypeTeam:
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), syncableID, model.PermissionInviteUser) &&
			!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionInviteUser})
		}
	case model.GroupSyncableTypeChannel:
		channel, appErr := c.App.GetChannel(c.AppContext, syncableID)
		if appErr != nil {
			return appErr
		}

		// If it's the first time that the syncable gets linked to the team (i.e. no current sync to the team or to a team's channel),
		// check that the user has the permission to manage the team.
		_, appErr = c.App.GetGroupSyncable(c.Params.GroupId, channel.TeamId, model.GroupSyncableTypeTeam)
		if appErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(appErr, &nfErr):
				if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), syncableID, model.PermissionInviteUser) &&
					!c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteUserManagementGroups) {
					return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionInviteUser})
				}
			default:
				return appErr
			}
		}

		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}

		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), syncableID, permission) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{permission})
		}
	}

	return nil
}

func getGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	appErr := hasPermissionToReadGroupMembers(c, c.Params.GroupId)
	if appErr != nil {
		appErr.Where = "Api4.getGroupMembers"
		c.Err = appErr
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	members, count, appErr := c.App.GetGroupMemberUsersPage(c.Params.GroupId, c.Params.Page, c.Params.PerPage, restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(model.GroupMemberList{
		Members: members,
		Count:   count,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupStats(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupStats", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	groupID := c.Params.GroupId
	count, appErr := c.App.GetGroupMemberCount(groupID, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(model.GroupStats{
		GroupID:          groupID,
		TotalMemberCount: count,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupStats", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByUserId(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.AppContext.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsByUserId", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	groups, appErr := c.App.GetGroupsByUserId(c.Params.UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(groups)
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupsByUserId", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireChannelId()
	if c.Err != nil {
		return
	}
	b, appErr := getGroupsByChannelCommon(c, r)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	b, appError := getGroupsByTeamCommon(c, r)
	if appError != nil {
		c.Err = appError
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroupsByTeamCommon(c *Context, r *http.Request) ([]byte, *model.AppError) {
	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		return nil, model.NewAppError("Api4.getGroupsByTeam", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		return nil, model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionListTeamChannels})
	}

	opts := model.GroupSearchOpts{
		Q:                    c.Params.Q,
		IncludeMemberCount:   c.Params.IncludeMemberCount,
		FilterAllowReference: c.Params.FilterAllowReference,
	}
	if c.Params.Paginate == nil || *c.Params.Paginate {
		opts.PageOpts = &model.PageOpts{Page: c.Params.Page, PerPage: c.Params.PerPage}
	}

	groups, totalCount, appErr := c.App.GetGroupsByTeam(c.Params.TeamId, opts)
	if appErr != nil {
		return nil, appErr
	}

	b, err := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})

	if err != nil {
		return nil, model.NewAppError("Api4.getGroupsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return b, nil
}

func getGroupsByChannelCommon(c *Context, r *http.Request) ([]byte, *model.AppError) {
	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		return nil, model.NewAppError("Api4.getGroupsByChannel", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
	}

	channel, appErr := c.App.GetChannel(c.AppContext, c.Params.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	var permission *model.Permission
	if channel.Type == model.ChannelTypePrivate {
		permission = model.PermissionReadPrivateChannelGroups
	} else {
		permission = model.PermissionReadPublicChannelGroups
	}
	if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), c.Params.ChannelId, permission) {
		return nil, model.MakePermissionError(c.AppContext.Session(), []*model.Permission{permission})
	}

	opts := model.GroupSearchOpts{
		Q:                    c.Params.Q,
		IncludeMemberCount:   c.Params.IncludeMemberCount,
		FilterAllowReference: c.Params.FilterAllowReference,
	}
	if c.Params.Paginate == nil || *c.Params.Paginate {
		opts.PageOpts = &model.PageOpts{Page: c.Params.Page, PerPage: c.Params.PerPage}
	}

	groups, totalCount, appErr := c.App.GetGroupsByChannel(c.Params.ChannelId, opts)
	if appErr != nil {
		return nil, appErr
	}

	b, err := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})
	if err != nil {
		return nil, model.NewAppError("Api4.getGroupsByChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return b, nil
}

func getGroupsAssociatedToChannelsByTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsAssociatedToChannelsByTeam", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionListTeamChannels) {
		c.Err = model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionListTeamChannels})
		return
	}

	opts := model.GroupSearchOpts{
		Q:                    c.Params.Q,
		IncludeMemberCount:   c.Params.IncludeMemberCount,
		FilterAllowReference: c.Params.FilterAllowReference,
	}
	if c.Params.Paginate == nil || *c.Params.Paginate {
		opts.PageOpts = &model.PageOpts{Page: c.Params.Page, PerPage: c.Params.PerPage}
	}

	groupsAssociatedByChannelID, appErr := c.App.GetGroupsAssociatedToChannelsByTeam(c.Params.TeamId, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(struct {
		GroupsAssociatedToChannels map[string][]*model.GroupWithSchemeAdmin `json:"groups"`
	}{
		GroupsAssociatedToChannels: groupsAssociatedByChannelID,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupsAssociatedToChannelsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getGroups(c *Context, w http.ResponseWriter, r *http.Request) {
	var teamID, NotAssociatedToChannelID, ChannelIDForMemberCount string

	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}

	source := c.Params.GroupSource

	if id := c.Params.NotAssociatedToTeam; model.IsValidId(id) {
		teamID = id
	}

	if id := c.Params.NotAssociatedToChannel; model.IsValidId(id) {
		NotAssociatedToChannelID = id
	}

	if id := c.Params.IncludeChannelMemberCount; model.IsValidId(id) {
		ChannelIDForMemberCount = id
	}

	// If they specify the group_source as custom when the feature is disabled, throw an error
	if appErr := licensedAndConfiguredForGroupBySource(c.App, source); appErr != nil {
		appErr.Where = "Api4.getGroups"
		c.Err = appErr
		return
	}

	// If they don't specify a source and custom groups are disabled, ensure they only get ldap groups in the response
	if !*c.App.Config().ServiceSettings.EnableCustomGroups {
		source = model.GroupSourceLdap
	}

	includeTimezones := r.URL.Query().Get("include_timezones") == "true"

	// Include archived groups
	includeArchived := r.URL.Query().Get("include_archived") == "true"

	opts := model.GroupSearchOpts{
		Q:                         c.Params.Q,
		IncludeMemberCount:        c.Params.IncludeMemberCount,
		FilterAllowReference:      c.Params.FilterAllowReference,
		FilterArchived:            c.Params.FilterArchived,
		FilterParentTeamPermitted: c.Params.FilterParentTeamPermitted,
		Source:                    source,
		FilterHasMember:           c.Params.FilterHasMember,
		IncludeTimezones:          includeTimezones,
		IncludeMemberIDs:          c.Params.IncludeMemberIDs,
		IncludeArchived:           includeArchived,
	}

	if teamID != "" {
		_, appErr := c.App.GetTeam(teamID)
		if appErr != nil {
			c.Err = appErr
			return
		}

		opts.NotAssociatedToTeam = teamID
	}

	if NotAssociatedToChannelID != "" {
		channel, appErr := c.App.GetChannel(c.AppContext, NotAssociatedToChannelID)
		if appErr != nil {
			c.Err = appErr
			return
		}
		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), NotAssociatedToChannelID, permission) {
			c.SetPermissionError(permission)
			return
		}
		opts.NotAssociatedToChannel = NotAssociatedToChannelID
	}

	if ChannelIDForMemberCount != "" {
		channel, appErr := c.App.GetChannel(c.AppContext, ChannelIDForMemberCount)
		if appErr != nil {
			c.Err = appErr
			return
		}
		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), ChannelIDForMemberCount, permission) {
			c.SetPermissionError(permission)
			return
		}
		opts.IncludeChannelMemberCount = ChannelIDForMemberCount
	}

	sinceString := r.URL.Query().Get("since")
	if sinceString != "" {
		since, err := strconv.ParseInt(sinceString, 10, 64)
		if err != nil {
			c.SetInvalidParamWithErr("since", err)
			return
		}
		opts.Since = since
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	var (
		groups = []*model.Group{}
		canSee = true
	)

	if opts.FilterHasMember != "" {
		canSee, appErr = c.App.UserCanSeeOtherUser(c.AppContext, c.AppContext.Session().UserId, opts.FilterHasMember)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	if canSee {
		groups, appErr = c.App.GetGroups(c.Params.Page, c.Params.PerPage, opts, restrictions)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	var (
		b   []byte
		err error
	)
	if c.Params.IncludeTotalCount {
		totalCount, cerr := c.App.Srv().Store().Group().GroupCount()
		if cerr != nil {
			c.Err = model.NewAppError("Api4.getGroups", "api.custom_groups.count_err", nil, "", http.StatusInternalServerError).Wrap(cerr)
			return
		}
		gwc := &model.GroupsWithCount{
			Groups:     groups,
			TotalCount: totalCount,
		}
		b, err = json.Marshal(gwc)
	} else {
		b, err = json.Marshal(groups)
	}

	if err != nil {
		c.Err = model.NewAppError("Api4.getGroups", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	group, err := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if err != nil {
		c.Err = err
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.deleteGroup", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	if lcErr := licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom); lcErr != nil {
		lcErr.Where = "Api4.deleteGroup"
		c.Err = lcErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionDeleteCustomGroup) {
		c.SetPermissionError(model.PermissionDeleteCustomGroup)
		return
	}

	auditRec := c.MakeAuditRecord("deleteGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "group_id", c.Params.GroupId)

	group, err = c.App.DeleteGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}

	b, jsonErr := json.Marshal(group)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.deleteGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func restoreGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}

	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	group, err := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if err != nil {
		c.Err = err
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.restoreGroup", "app.group.crud_permission", nil, "", http.StatusNotImplemented)
		return
	}

	if lcErr := licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom); lcErr != nil {
		lcErr.Where = "Api4.restoreGroup"
		c.Err = lcErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionRestoreCustomGroup) {
		c.SetPermissionError(model.PermissionRestoreCustomGroup)
		return
	}

	auditRec := c.MakeAuditRecord("restoreGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "group_id", c.Params.GroupId)

	restoredGroup, err := c.App.RestoreGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}

	b, jsonErr := json.Marshal(restoredGroup)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.restoreGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func addGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	group, appErr := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.addGroupMembers", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom)
	if appErr != nil {
		appErr.Where = "Api4.addGroupMembers"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionManageCustomGroupMembers) {
		c.SetPermissionError(model.PermissionManageCustomGroupMembers)
		return
	}

	var newMembers *model.GroupModifyMembers
	if err := json.NewDecoder(r.Body).Decode(&newMembers); err != nil || newMembers == nil {
		c.SetInvalidParamWithErr("addGroupMembers", err)
		return
	}

	auditRec := c.MakeAuditRecord("addGroupMembers", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "addGroupMembers_userids", newMembers.UserIds)

	members, appErr := c.App.UpsertGroupMembers(c.Params.GroupId, newMembers.UserIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("Api4.addGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
	c.App.Srv().GetTelemetryService().SendTelemetryForFeature(
		telemetry.TrackGroupsFeature,
		"modify_group__add_members",
		map[string]any{
			telemetry.TrackPropertyUser:  c.AppContext.Session().UserId,
			telemetry.TrackPropertyGroup: group.Id,
		})
}

func deleteGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	group, appErr := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if group.Source != model.GroupSourceCustom {
		c.Err = model.NewAppError("Api4.deleteGroupMembers", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom)
	if appErr != nil {
		appErr.Where = "Api4.deleteGroupMembers"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionManageCustomGroupMembers) {
		c.SetPermissionError(model.PermissionManageCustomGroupMembers)
		return
	}

	var deleteBody *model.GroupModifyMembers
	if err := json.NewDecoder(r.Body).Decode(&deleteBody); err != nil || deleteBody == nil {
		c.SetInvalidParamWithErr("deleteGroupMembers", err)
		return
	}

	auditRec := c.MakeAuditRecord("deleteGroupMembers", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "deleteGroupMembers_userids", deleteBody.UserIds)

	members, appErr := c.App.DeleteGroupMembers(c.Params.GroupId, deleteBody.UserIds)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(members)
	if err != nil {
		c.Err = model.NewAppError("Api4.addGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	auditRec.Success()
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
	c.App.Srv().GetTelemetryService().SendTelemetryForFeature(
		telemetry.TrackGroupsFeature,
		"modify_group__remove_members",
		map[string]any{
			telemetry.TrackPropertyUser:  c.AppContext.Session().UserId,
			telemetry.TrackPropertyGroup: group.Id,
		})
}

// hasPermissionToReadGroupMembers check if a user has the permission to read the list of members of a given team.
func hasPermissionToReadGroupMembers(c *web.Context, groupID string) *model.AppError {
	group, err := c.App.GetGroup(groupID, nil, nil)
	if err != nil {
		return err
	}

	if lcErr := licensedAndConfiguredForGroupBySource(c.App, group.Source); lcErr != nil {
		return lcErr
	}

	if group.Source == model.GroupSourceLdap && !group.AllowReference {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
			return model.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionSysconsoleReadUserManagementGroups})
		}
	}

	return nil
}

// licensedAndConfiguredForGroupBySource returns an app error if not properly license or configured for the given group type. The returned app error
// will have a blank 'Where' field, which should be subsequently set by the caller, for example:
//
//	err := licensedAndConfiguredForGroupBySource(c.App, group.Source)
//	err.Where = "Api4.getGroup"
func licensedAndConfiguredForGroupBySource(app app.AppIface, source model.GroupSource) *model.AppError {
	lic := app.Srv().License()

	if lic == nil {
		return model.NewAppError("", "api.license_error", nil, "", http.StatusForbidden)
	}

	if source == model.GroupSourceLdap && !*lic.Features.LDAPGroups {
		return model.NewAppError("", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
	}

	if source == model.GroupSourceCustom && lic.SkuShortName != model.LicenseShortSkuProfessional && lic.SkuShortName != model.LicenseShortSkuEnterprise {
		return model.NewAppError("", "api.custom_groups.license_error", nil, "", http.StatusBadRequest)
	}

	if source == model.GroupSourceCustom && !*app.Config().ServiceSettings.EnableCustomGroups {
		return model.NewAppError("", "api.custom_groups.feature_disabled", nil, "", http.StatusBadRequest)
	}

	return nil
}
