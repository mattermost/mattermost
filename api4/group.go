// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitGroup() {
	// GET /api/v4/groups
	api.BaseRoutes.Groups.Handle("", api.APISessionRequired(getGroups)).Methods("GET")

	// POST /api/v4/groups
	api.BaseRoutes.Groups.Handle("", api.APISessionRequired(createGroup)).Methods("POST")

	// GET /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}",
		api.APISessionRequired(getGroup)).Methods("GET")

	// PUT /api/v4/groups/:group_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/patch",
		api.APISessionRequired(patchGroup)).Methods("PUT")

	// POST /api/v4/groups/:group_id/teams/:team_id/link
	// POST /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/link",
		api.APISessionRequired(linkGroupSyncable)).Methods("POST")

	// DELETE /api/v4/groups/:group_id/teams/:team_id/link
	// DELETE /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/link",
		api.APISessionRequired(unlinkGroupSyncable)).Methods("DELETE")

	// GET /api/v4/groups/:group_id/teams/:team_id
	// GET /api/v4/groups/:group_id/channels/:channel_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}",
		api.APISessionRequired(getGroupSyncable)).Methods("GET")

	// GET /api/v4/groups/:group_id/teams
	// GET /api/v4/groups/:group_id/channels
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}",
		api.APISessionRequired(getGroupSyncables)).Methods("GET")

	// PUT /api/v4/groups/:group_id/teams/:team_id/patch
	// PUT /api/v4/groups/:group_id/channels/:channel_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/patch",
		api.APISessionRequired(patchGroupSyncable)).Methods("PUT")

	// GET /api/v4/groups/:group_id/stats
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/stats",
		api.APISessionRequired(getGroupStats)).Methods("GET")

	// GET /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.APISessionRequired(getGroupMembers)).Methods("GET")

	// GET /api/v4/users/:user_id/groups
	api.BaseRoutes.Users.Handle("/{user_id:[A-Za-z0-9]+}/groups",
		api.APISessionRequired(getGroupsByUserId)).Methods("GET")

	// GET /api/v4/channels/:channel_id/groups
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/groups",
		api.APISessionRequired(getGroupsByChannel)).Methods("GET")

	// GET /api/v4/teams/:team_id/groups
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups",
		api.APISessionRequired(getGroupsByTeam)).Methods("GET")

	// GET /api/v4/teams/:team_id/groups_by_channels
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups_by_channels",
		api.APISessionRequired(getGroupsAssociatedToChannelsByTeam)).Methods("GET")

	// DELETE /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}",
		api.APISessionRequired(deleteGroup)).Methods("DELETE")

	// POST /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.APISessionRequired(addGroupMembers)).Methods("POST")

	// DELETE /api/v4/groups/:group_id/members
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.APISessionRequired(deleteGroupMembers)).Methods("DELETE")
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

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	group, appErr := c.App.GetGroup(c.Params.GroupId, &model.GetGroupOpts{
		IncludeMemberCount: c.Params.IncludeMemberCount,
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

	w.Write(b)
}

func createGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	var group *model.GroupWithUserIds
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
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
	auditRec.AddEventParameter("group", group)

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
	w.Write(js)
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
	auditRec.AddEventParameter("group", group)

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

	b, err := json.Marshal(group)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	w.Write(b)
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

	group, appErr := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if group.Source != model.GroupSourceLdap {
		c.Err = model.NewAppError("Api4.linkGroupSyncable", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("linkGroupSyncable", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("group_id", c.Params.GroupId)
	auditRec.AddEventParameter("syncable_id", syncableID)
	auditRec.AddEventParameter("syncable_type", syncableType)

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr(fmt.Sprintf("Group%s", syncableType), err)
		return
	}

	auditRec.AddEventParameter("patch", patch)

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	appErr = verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if appErr != nil {
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
	w.Write(b)
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

	w.Write(b)
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

	w.Write(b)
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
	auditRec.AddEventParameter("group_id", c.Params.GroupId)
	auditRec.AddEventParameter("old_syncable_id", syncableID)
	auditRec.AddEventParameter("old_syncable_type", syncableType)

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParamWithErr(fmt.Sprintf("Group[%s]Patch", syncableType), err)
		return
	}

	auditRec.AddEventParameter("patch", patch)

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.ldap_groups.license_error", nil, "",
			http.StatusForbidden)
		return
	}

	appErr := verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if appErr != nil {
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
	w.Write(b)
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
	auditRec.AddEventParameter("group_id", c.Params.GroupId)
	auditRec.AddEventParameter("syncable_id", syncableID)
	auditRec.AddEventParameter("syncable_type", syncableType)

	if !*c.App.Channels().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.unlinkGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
		return
	}

	appErr := verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if appErr != nil {
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
	switch syncableType {
	case model.GroupSyncableTypeTeam:
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), syncableID, model.PermissionManageTeam) {
			return c.App.MakePermissionError(c.AppContext.Session(), []*model.Permission{model.PermissionManageTeam})
		}
	case model.GroupSyncableTypeChannel:
		channel, err := c.App.GetChannel(c.AppContext, syncableID)
		if err != nil {
			return err
		}

		var permission *model.Permission
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelMembers
		} else {
			permission = model.PermissionManagePublicChannelMembers
		}

		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), syncableID, permission) {
			return c.App.MakePermissionError(c.AppContext.Session(), []*model.Permission{permission})
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

	group, appErr := c.App.GetGroup(c.Params.GroupId, nil, nil)
	if appErr != nil {
		c.Err = appErr
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, group.Source)
	if appErr != nil {
		appErr.Where = "Api4.getGroupMembers"
		c.Err = appErr
		return
	}

	if group.Source == model.GroupSourceLdap && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadUserManagementGroups) {
		c.SetPermissionError(model.PermissionSysconsoleReadUserManagementGroups)
		return
	}

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	members, count, appErr := c.App.GetGroupMemberUsersPage(c.Params.GroupId, c.Params.Page, c.Params.PerPage, restrictions)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(struct {
		Members []*model.User `json:"members"`
		Count   int           `json:"total_member_count"`
	}{
		Members: members,
		Count:   count,
	})
	if err != nil {
		c.Err = model.NewAppError("Api4.getGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(b)
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

	w.Write(b)
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

	w.Write(b)
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
	w.Write(b)
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
	w.Write(b)
}

func getGroupsByTeamCommon(c *Context, r *http.Request) ([]byte, *model.AppError) {
	if c.App.Channels().License() == nil || !*c.App.Channels().License().Features.LDAPGroups {
		return nil, model.NewAppError("Api4.getGroupsByTeam", "api.ldap_groups.license_error", nil, "", http.StatusForbidden)
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
		return nil, c.App.MakePermissionError(c.AppContext.Session(), []*model.Permission{permission})
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

	w.Write(b)
}

func getGroups(c *Context, w http.ResponseWriter, r *http.Request) {
	permissionErr := requireLicense(c)
	if permissionErr != nil {
		c.Err = permissionErr
		return
	}
	var teamID, channelID string

	source := c.Params.GroupSource

	if id := c.Params.NotAssociatedToTeam; model.IsValidId(id) {
		teamID = id
	}

	if id := c.Params.NotAssociatedToChannel; model.IsValidId(id) {
		channelID = id
	}

	// If they specify the group_source as custom when the feature is disabled, throw an error
	if appErr := licensedAndConfiguredForGroupBySource(c.App, source); appErr != nil {
		appErr.Where = "Api4.getGroups"
		c.Err = appErr
		return
	}

	// If they don't specify a source and custom groups are disabled, ensure they only get ldap groups in the response
	if !c.App.Config().FeatureFlags.CustomGroups || !*c.App.Config().ServiceSettings.EnableCustomGroups {
		source = model.GroupSourceLdap
	}

	opts := model.GroupSearchOpts{
		Q:                         c.Params.Q,
		IncludeMemberCount:        c.Params.IncludeMemberCount,
		FilterAllowReference:      c.Params.FilterAllowReference,
		FilterParentTeamPermitted: c.Params.FilterParentTeamPermitted,
		Source:                    source,
		FilterHasMember:           c.Params.FilterHasMember,
	}

	if teamID != "" {
		_, appErr := c.App.GetTeam(teamID)
		if appErr != nil {
			c.Err = appErr
			return
		}

		opts.NotAssociatedToTeam = teamID
	}

	if channelID != "" {
		channel, appErr := c.App.GetChannel(c.AppContext, channelID)
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
		if !c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, permission) {
			c.SetPermissionError(permission)
			return
		}
		opts.NotAssociatedToChannel = channelID
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

	restrictions, appErr := c.App.GetViewUsersRestrictions(c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	var (
		groups      = []*model.Group{}
		canSee bool = true
	)

	if opts.FilterHasMember != "" {
		canSee, appErr = c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, opts.FilterHasMember)
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

	w.Write(b)
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
	auditRec.AddEventParameter("group_id", c.Params.GroupId)

	_, err = c.App.DeleteGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
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
		c.Err = model.NewAppError("Api4.deleteGroup", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom)
	if appErr != nil {
		appErr.Where = "Api4.deleteGroup"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionManageCustomGroupMembers) {
		c.SetPermissionError(model.PermissionManageCustomGroupMembers)
		return
	}

	var newMembers *model.GroupModifyMembers
	if err := json.NewDecoder(r.Body).Decode(&newMembers); err != nil {
		c.SetInvalidParamWithErr("addGroupMembers", err)
		return
	}

	auditRec := c.MakeAuditRecord("addGroupMembers", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("addGroupMembers", newMembers)

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
	w.Write(b)
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
		c.Err = model.NewAppError("Api4.deleteGroup", "app.group.crud_permission", nil, "", http.StatusBadRequest)
		return
	}

	appErr = licensedAndConfiguredForGroupBySource(c.App, model.GroupSourceCustom)
	if appErr != nil {
		appErr.Where = "Api4.deleteGroup"
		c.Err = appErr
		return
	}

	if !c.App.SessionHasPermissionToGroup(*c.AppContext.Session(), c.Params.GroupId, model.PermissionManageCustomGroupMembers) {
		c.SetPermissionError(model.PermissionManageCustomGroupMembers)
		return
	}

	var deleteBody *model.GroupModifyMembers
	if err := json.NewDecoder(r.Body).Decode(&deleteBody); err != nil {
		c.SetInvalidParamWithErr("deleteGroupMembers", err)
		return
	}

	auditRec := c.MakeAuditRecord("deleteGroupMembers", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("deleteGroupMembers", deleteBody)

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
	w.Write(b)
}

// licensedAndConfiguredForGroupBySource returns an app error if not properly license or configured for the given group type. The returned app error
// will have a blank 'Where' field, which should be subsequently set by the caller, for example:
//
//	err := licensedAndConfiguredForGroupBySource(c.App, group.Source)
//	err.Where = "Api4.getGroup"
//
// Temporarily, this function also checks for the CustomGroups feature flag.
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

	if source == model.GroupSourceCustom && (!app.Config().FeatureFlags.CustomGroups || !*app.Config().ServiceSettings.EnableCustomGroups) {
		return model.NewAppError("", "api.custom_groups.feature_disabled", nil, "", http.StatusBadRequest)
	}

	return nil
}
