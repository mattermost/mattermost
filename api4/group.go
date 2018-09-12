// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/model"
)

const (
	apiGroupMemberActionCreate = iota
	apiGroupMemberActionDelete
)

func (api *API) InitGroup() {
	// GET /api/v4/groups/:group_id
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}", api.ApiSessionRequiredTrustRequester(getGroup)).Methods("GET")

	// PUT /api/v4/groups/:group_id/patch
	api.BaseRoutes.Groups.Handle("/{group_id:[A-Za-z0-9]+}/patch", api.ApiSessionRequired(patchGroup)).Methods("PUT")

	for _, syncableType := range model.GroupSyncableTypes {
		name := strings.ToLower(syncableType.String())

		// POST /api/v4/teams/:team_id/link
		// POST /api/v4/channels/:channel_id/link
		api.BaseRoutes.Groups.Handle(fmt.Sprintf("/{group_id:[A-Za-z0-9]+}/%[1]ss/{%[1]s_id:[A-Za-z0-9]+}/link", name), api.ApiSessionRequired(linkGroupSyncable(syncableType))).Methods("POST")

		// DELETE /api/v4/teams/:team_id/link
		// DELETE /api/v4/channels/:channel_id/link
		api.BaseRoutes.Groups.Handle(fmt.Sprintf("/{group_id:[A-Za-z0-9]+}/%[1]ss/{%[1]s_id:[A-Za-z0-9]+}/link", name), api.ApiSessionRequired(unlinkGroupSyncable(syncableType))).Methods("DELETE")

		// GET /api/v4/teams/:team_id
		// GET /api/v4/channels/:channel_id
		api.BaseRoutes.Groups.Handle(fmt.Sprintf("/{group_id:[A-Za-z0-9]+}/%[1]ss/{%[1]s_id:[A-Za-z0-9]+}", name), api.ApiSessionRequired(getGroupSyncable(syncableType))).Methods("GET")

		// GET /api/v4/teams
		// GET /api/v4/channels
		api.BaseRoutes.Groups.Handle(fmt.Sprintf("/{group_id:[A-Za-z0-9]+}/%[1]ss", name), api.ApiSessionRequired(getGroupSyncables(syncableType))).Methods("GET")

		// PUT /api/v4/teams/:team_id/patch
		// PUT /api/v4/channels/:channel_id/patch
		api.BaseRoutes.Groups.Handle(fmt.Sprintf("/{group_id:[A-Za-z0-9]+}/%[1]ss/{%[1]s_id:[A-Za-z0-9]+}/patch", name), api.ApiSessionRequired(patchGroupSyncable(syncableType))).Methods("PUT")
	}
}

func getGroup(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireGroupId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	group, err := c.App.GetGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(group)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.getGroup", "api.group.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
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

	if c.App.License() == nil || !*c.App.License().Features.LDAP {
		c.Err = model.NewAppError("Api4.patchGroup", "api.group.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	group, err := c.App.GetGroup(c.Params.GroupId)
	if err != nil {
		c.Err = err
		return
	}

	group.Patch(groupPatch)

	group, err = c.App.UpdateGroup(group)
	if err != nil {
		c.Err = err
		return
	}

	b, marshalErr := json.Marshal(group)
	if marshalErr != nil {
		c.Err = model.NewAppError("Api4.patchGroup", "api.group.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
		return
	}

	w.Write(b)
}

func linkGroupSyncable(syncableType model.GroupSyncableType) func(*Context, http.ResponseWriter, *http.Request) {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		c.RequireGroupId()
		if c.Err != nil {
			return
		}

		var syncableID string
		switch syncableType {
		case model.GSTeam:
			c.RequireTeamId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.TeamId
		case model.GSChannel:
			c.RequireChannelId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.ChannelId
		default:
			c.SetInvalidParam(fmt.Sprintf("%s_id", strings.ToLower(syncableType.String())))
		}

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			c.Err = model.NewAppError("Api4.createGroupSyncable", "api.group.io_error", nil, err.Error(), http.StatusNotImplemented)
		}

		var patch *model.GroupSyncablePatch
		err = json.Unmarshal(body, &patch)
		if err != nil || patch == nil {
			c.SetInvalidParam(fmt.Sprintf("Group%s", syncableType.String()))
			return
		}

		if c.App.License() == nil || !*c.App.License().Features.LDAP {
			c.Err = model.NewAppError("Api4.createGroupSyncable", "api.group.license.error", nil, "", http.StatusNotImplemented)
			return
		}

		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}

		groupSyncable, appErr := c.App.GetGroupSyncable(c.Params.GroupId, syncableID, syncableType)
		if appErr != nil {
			if appErr.Id != "store.sql_group.no_rows" {
				c.Err = appErr
				return
			}
		}

		if groupSyncable == nil || groupSyncable.DeleteAt == 0 {
			groupSyncable = &model.GroupSyncable{
				GroupId:    c.Params.GroupId,
				SyncableId: syncableID,
				Type:       syncableType,
			}
			groupSyncable.Patch(patch)
			groupSyncable, appErr = c.App.CreateGroupSyncable(groupSyncable)
			if appErr != nil {
				c.Err = appErr
				return
			}
		} else {
			groupSyncable.DeleteAt = 0
			groupSyncable.Patch(patch)
			groupSyncable, appErr = c.App.UpdateGroupSyncable(groupSyncable)
			if appErr != nil {
				c.Err = appErr
				return
			}
		}

		w.WriteHeader(http.StatusCreated)

		var marshalErr error
		b, marshalErr := json.Marshal(groupSyncable)
		if marshalErr != nil {
			c.Err = model.NewAppError("Api4.createGroupSyncable", "api.group.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
			return
		}

		w.Write(b)
	}
}

func getGroupSyncable(syncableType model.GroupSyncableType) func(*Context, http.ResponseWriter, *http.Request) {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		c.RequireGroupId()
		if c.Err != nil {
			return
		}

		var syncableID string
		switch syncableType {
		case model.GSTeam:
			c.RequireTeamId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.TeamId
		case model.GSChannel:
			c.RequireChannelId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.ChannelId
		default:
			c.SetInvalidParam(fmt.Sprintf("%s_id", strings.ToLower(syncableType.String())))
		}

		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
			c.Err = model.NewAppError("Api4.getGroupSyncable", "api.group.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
			return
		}

		w.Write(b)
	}
}

func getGroupSyncables(syncableType model.GroupSyncableType) func(*Context, http.ResponseWriter, *http.Request) {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		c.RequireGroupId()
		if c.Err != nil {
			return
		}

		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}

		groupSyncables, err := c.App.GetGroupSyncablesPage(c.Params.GroupId, syncableType, c.Params.Page, c.Params.PerPage)
		if err != nil {
			c.Err = err
			return
		}

		b, marshalErr := json.Marshal(groupSyncables)
		if marshalErr != nil {
			c.Err = model.NewAppError("Api4.getGroupSyncables", "api.group.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
			return
		}

		w.Write(b)
	}
}

func patchGroupSyncable(syncableType model.GroupSyncableType) func(*Context, http.ResponseWriter, *http.Request) {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		c.RequireGroupId()
		if c.Err != nil {
			return
		}

		var syncableID string
		switch syncableType {
		case model.GSTeam:
			c.RequireTeamId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.TeamId
		case model.GSChannel:
			c.RequireChannelId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.ChannelId
		default:
			c.SetInvalidParam(fmt.Sprintf("%s_id", strings.ToLower(syncableType.String())))
		}

		body, err := ioutil.ReadAll(r.Body)
		if err != nil {
			c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.group.io_error", nil, err.Error(), http.StatusNotImplemented)
		}

		var patch *model.GroupSyncablePatch
		err = json.Unmarshal(body, &patch)
		if err != nil || patch == nil {
			c.SetInvalidParam(fmt.Sprintf("Group[%s]Patch", syncableType.String()))
			return
		}

		if c.App.License() == nil || !*c.App.License().Features.LDAP {
			c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.group.license.error", nil, "", http.StatusNotImplemented)
			return
		}

		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}

		var appErr *model.AppError
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

		b, marshalErr := json.Marshal(groupSyncable)
		if marshalErr != nil {
			c.Err = model.NewAppError("Api4.patchGroupSyncable", "api.group.marshal_error", nil, marshalErr.Error(), http.StatusNotImplemented)
			return
		}

		w.Write(b)
	}
}

func unlinkGroupSyncable(syncableType model.GroupSyncableType) func(*Context, http.ResponseWriter, *http.Request) {
	return func(c *Context, w http.ResponseWriter, r *http.Request) {
		c.RequireGroupId()
		if c.Err != nil {
			return
		}

		var syncableID string
		switch syncableType {
		case model.GSTeam:
			c.RequireTeamId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.TeamId
		case model.GSChannel:
			c.RequireChannelId()
			if c.Err != nil {
				return
			}
			syncableID = c.Params.ChannelId
		default:
			c.SetInvalidParam(fmt.Sprintf("%s_id", strings.ToLower(syncableType.String())))
		}

		if c.App.License() == nil || !*c.App.License().Features.LDAP {
			c.Err = model.NewAppError("Api4.deleteGroupSyncable", "api.group.license.error", nil, "", http.StatusNotImplemented)
			return
		}

		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
			return
		}

		_, err := c.App.DeleteGroupSyncable(c.Params.GroupId, syncableID, syncableType)
		if err != nil {
			c.Err = err
			return
		}

		w.WriteHeader(http.StatusNoContent)
		w.Write(nil)
	}
}
