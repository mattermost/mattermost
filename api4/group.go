// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitGroup() {
	// GET /api/v4/groups
	api.BaseRoutes.Groups.Handle("", api.ApiSessionRequired(getGroups)).Methods("GET")

	// GET /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}",
		api.ApiSessionRequired(getGroup)).Methods("GET")

	// PUT /api/v4/groups/:group_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/patch",
		api.ApiSessionRequired(patchGroup)).Methods("PUT")

	// POST /api/v4/groups/:group_id/teams/:team_id/link
	// POST /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/link",
		api.ApiSessionRequired(linkGroupSyncable)).Methods("POST")

	// DELETE /api/v4/groups/:group_id/teams/:team_id/link
	// DELETE /api/v4/groups/:group_id/channels/:channel_id/link
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/link",
		api.ApiSessionRequired(unlinkGroupSyncable)).Methods("DELETE")

	// GET /api/v4/groups/:group_id/teams/:team_id
	// GET /api/v4/groups/:group_id/channels/:channel_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}",
		api.ApiSessionRequired(getGroupSyncable)).Methods("GET")

	// GET /api/v4/groups/:group_id/teams
	// GET /api/v4/groups/:group_id/channels
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}",
		api.ApiSessionRequired(getGroupSyncables)).Methods("GET")

	// PUT /api/v4/groups/:group_id/teams/:team_id/patch
	// PUT /api/v4/groups/:group_id/channels/:channel_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/{syncable_type:teams|channels}/{syncable_id:[A-Za-z0-9]+}/patch",
		api.ApiSessionRequired(patchGroupSyncable)).Methods("PUT")

	// GET /api/v4/groups/:group_id/stats
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/stats",
		api.ApiSessionRequired(getGroupStats)).Methods("GET")

	// GET /api/v4/groups/:group_id/members?page=0&per_page=100
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/members",
		api.ApiSessionRequired(getGroupMembers)).Methods("GET")

	// GET /api/v4/users/:user_id/groups?page=0&per_page=100
	api.BaseRoutes.Users.Handle("/{user_id:[A-Za-z0-9]+}/groups",
		api.ApiSessionRequired(getGroupsByUserId)).Methods("GET")

	// GET /api/v4/channels/:channel_id/groups?page=0&per_page=100
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/groups",
		api.ApiSessionRequired(getGroupsByChannel)).Methods("GET")

	// GET /api/v4/teams/:team_id/groups?page=0&per_page=100
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups",
		api.ApiSessionRequired(getGroupsByTeam)).Methods("GET")

	// GET /api/v4/teams/:team_id/groups_by_channels?page=0&per_page=100
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups_by_channels",
		api.ApiSessionRequired(getGroupsAssociatedToChannelsByTeam)).Methods("GET")
}

func getGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroup", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS)
		return
	}

	group, err := c.App.GetGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(group)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroup", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func patchGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	groupPatch := model.GroupPatchFromJson(r.Body)
	if groupPatch == nil {
		c.SetInvalidParam("group")
		return
	}

	auditRec := c.MakeAuditRecord("patchGroup", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS)
		return
	}

	group, err := c.App.GetGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("group", group)

	if groupPatch.AllowReference != nil && *groupPatch.AllowReference {
		if groupPatch.Name == nil {
			tmp := strings.ReplaceAll(strings.ToLower(group.DisplayName), " ", "-")
			groupPatch.Name = &tmp
		} else {
			if *groupPatch.Name == model.USER_NOTIFY_ALL || *groupPatch.Name == model.CHANNEL_MENTIONS_NOTIFY_PROP || *groupPatch.Name == model.USER_NOTIFY_HERE {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_reserved_name_error", nil, "", http.StatusNotImplemented)
				return
			}
			//check if a user already has this group name
			user, _ := c.App.GetUserByUsername(*groupPatch.Name)
			if user != nil {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_user_name_error", nil, "", http.StatusNotImplemented)
				return
			}
			//check if a mentionable group already has this name
			searchOpts := model.GroupSearchOpts{
				FilterAllowReference: true,
			}
			existingGroup, _ := c.App.GetGroupByName(*groupPatch.Name, searchOpts)
			if existingGroup != nil {
				c.Err = model.NewAppError("Api4.patchGroup", "api.ldap_groups.existing_group_name_error", nil, "", http.StatusNotImplemented)
				return
			}
		}
	}

	group.Patch(groupPatch)

	group, err = c.App.UpdateGroup(group)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("patch", group)

	b, marshalErr := json.Marshal(group)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.patchGroup", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	w.Write(b)
}

func linkGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
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

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.io_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("linkGroupSyncable", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("group_id", c.Params.GroupId)
	auditRec.AddMeta("syncable_id", syncableID)
	auditRec.AddMeta("syncable_type", syncableType)

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParam(fmt.Sprintf("Group%s", syncableType.String()))
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	appErr := verifyLinkUnlinkPermission(c, syncableType, syncableID)
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

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(syncableID, syncableType)
	})

	w.WriteHeader(http.StatusCreated)

	b, marshalErr := json.Marshal(groupSyncable)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.createGroupSyncable", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.Success()
	w.Write(b)
}

func getGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
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

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	groupSyncable, err := c.App.GetGroupSyncable(c.Params.GroupId, syncableID, syncableType)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(groupSyncable)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupSyncable", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroupSyncables(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	c.RequireSyncableType()
	if c.Err != nil {
		return
	}
	syncableType := c.Params.SyncableType

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupSyncables", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS)
		return
	}

	groupSyncables, err := c.App.GetGroupSyncables(c.Params.GroupId, syncableType)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(groupSyncables)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupSyncables", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func patchGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
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

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.io_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("patchGroupSyncable", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("group_id", c.Params.GroupId)
	auditRec.AddMeta("old_syncable_id", syncableID)
	auditRec.AddMeta("old_syncable_type", syncableType)

	var patch *model.GroupSyncablePatch
	err = json.Unmarshal(body, &patch)
	if err != nil || patch == nil {
		c.SetInvalidParam(fmt.Sprintf("Group[%s]Patch", syncableType.String()))
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.ldap_groups.license_error", nil, "",
			http.StatusNotImplemented)
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

	auditRec.AddMeta("new_syncable_id", groupSyncable.SyncableId)
	auditRec.AddMeta("new_syncable_type", groupSyncable.Type)

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(syncableID, syncableType)
	})

	b, marshalErr := json.Marshal(groupSyncable)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.Success()
	w.Write(b)
}

func unlinkGroupSyncable(c *Context, w http.ResponseWriter, r *http.Request) {
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
	auditRec.AddMeta("group_id", c.Params.GroupId)
	auditRec.AddMeta("syncable_id", syncableID)
	auditRec.AddMeta("syncable_type", syncableType)

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.unlinkGroupSyncable", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	err := verifyLinkUnlinkPermission(c, syncableType, syncableID)
	if err != nil {
		c.Err = err
		return
	}

	_, err = c.App.DeleteGroupSyncable(c.Params.GroupId, syncableID, syncableType)
	if err != nil {
		c.Err = err
		return
	}

	c.App.Srv().Go(func() {
		c.App.SyncRolesAndMembership(syncableID, syncableType)
	})

	auditRec.Success()

	ReturnStatusOK(w)
}

func verifyLinkUnlinkPermission(c *Context, syncableType model.GroupSyncableType, syncableID string) *model.AppError {
	switch syncableType {
	case model.GroupSyncableTypeTeam:
		if !c.App.SessionHasPermissionToTeam(*c.App.Session(), syncableID, model.PERMISSION_MANAGE_TEAM) {
			return c.App.MakePermissionError([]*model.Permission{model.PERMISSION_MANAGE_TEAM})
		}
	case model.GroupSyncableTypeChannel:
		channel, err := c.App.GetChannel(syncableID)
		if err != nil {
			return err
		}

		var permission *model.Permission
		if channel.Type == model.CHANNEL_PRIVATE {
			permission = model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS
		} else {
			permission = model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS
		}

		if !c.App.SessionHasPermissionToChannel(*c.App.Session(), syncableID, permission) {
			return c.App.MakePermissionError([]*model.Permission{permission})
		}
	}

	return nil
}

func getGroupMembers(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupMembers", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS)
		return
	}

	members, count, err := c.App.GetGroupMemberUsersPage(c.Params.GroupId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(struct {
		Members []*model.User `json:"members"`
		Count   int           `json:"total_member_count"`
	}{
		Members: members,
		Count:   count,
	})
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupMembers", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroupStats(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupStats", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_GROUPS)
		return
	}

	groupID := c.Params.GroupId
	count, err := c.App.GetGroupMemberCount(groupID)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(model.GroupStats{
		GroupID:          groupID,
		TotalMemberCount: count,
	})
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupStats", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroupsByUserId(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if c.App.Session().UserId != c.Params.UserId && !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsByUserId", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	groups, err := c.App.GetGroupsByUserId(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(groups)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupsByUserId", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroupsByChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsByChannel", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	channel, err := c.App.GetChannel(c.Params.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	var permission *model.Permission
	if channel.Type == model.CHANNEL_PRIVATE {
		permission = model.PERMISSION_READ_PRIVATE_CHANNEL_GROUPS
	} else {
		permission = model.PERMISSION_READ_PUBLIC_CHANNEL_GROUPS
	}
	if !c.App.SessionHasPermissionToChannel(*c.App.Session(), c.Params.ChannelId, permission) {
		c.SetPermissionError(permission)
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

	groups, totalCount, err := c.App.GetGroupsByChannel(c.Params.ChannelId, opts)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})

	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupsByChannel", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroupsByTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsByTeam", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
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

	groups, totalCount, err := c.App.GetGroupsByTeam(c.Params.TeamId, opts)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(struct {
		Groups []*model.GroupWithSchemeAdmin `json:"groups"`
		Count  int                           `json:"total_group_count"`
	}{
		Groups: groups,
		Count:  totalCount,
	})

	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupsByTeam", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroupsAssociatedToChannelsByTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroupsAssociatedToChannelsByTeam", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
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

	groupsAssociatedByChannelID, err := c.App.GetGroupsAssociatedToChannelsByTeam(c.Params.TeamId, opts)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(struct {
		GroupsAssociatedToChannels map[string][]*model.GroupWithSchemeAdmin `json:"groups"`
	}{
		GroupsAssociatedToChannels: groupsAssociatedByChannelID,
	})

	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroupsAssociatedToChannelsByTeam", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getGroups(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.LDAPGroups {
		c.Err = model.NewAppError("Api4.getGroups", "api.ldap_groups.license_error", nil, "", http.StatusNotImplemented)
		return
	}
	var teamID, channelID string

	if id := c.Params.NotAssociatedToTeam; model.IsValidId(id) {
		teamID = id
	}

	if id := c.Params.NotAssociatedToChannel; model.IsValidId(id) {
		channelID = id
	}

	opts := model.GroupSearchOpts{
		Q:                         c.Params.Q,
		IncludeMemberCount:        c.Params.IncludeMemberCount,
		FilterAllowReference:      c.Params.FilterAllowReference,
		FilterParentTeamPermitted: c.Params.FilterParentTeamPermitted,
	}

	if teamID != "" {
		_, err := c.App.GetTeam(teamID)
		if err != nil {
			c.Err = err
			return
		}

		opts.NotAssociatedToTeam = teamID
	}

	if channelID != "" {
		channel, err := c.App.GetChannel(channelID)
		if err != nil {
			c.Err = err
			return
		}
		var permission *model.Permission
		if channel.Type == model.CHANNEL_PRIVATE {
			permission = model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS
		} else {
			permission = model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS
		}
		if !c.App.SessionHasPermissionToChannel(*c.App.Session(), channelID, permission) {
			c.SetPermissionError(permission)
			return
		}
		opts.NotAssociatedToChannel = channelID
	}

	sinceString := r.URL.Query().Get("since")
	if sinceString != "" {
		since, parseError := strconv.ParseInt(sinceString, 10, 64)
		if parseError != nil {
			c.SetInvalidParam("since")
			return
		}
		opts.Since = since
	}

	groups, err := c.App.GetGroups(c.Params.Page, c.Params.PerPage, opts)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(groups)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroups", "api.marshal_error", nil, marshalErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}
