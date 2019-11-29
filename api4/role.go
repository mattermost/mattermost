// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitRole() {
	api.BaseRoutes.Roles.Handle("/{role_id:[A-Za-z0-9]+}", api.ApiSessionRequiredTrustRequester(getRole)).Methods("GET")
	api.BaseRoutes.Roles.Handle("/name/{role_name:[a-z0-9_]+}", api.ApiSessionRequiredTrustRequester(getRoleByName)).Methods("GET")
	api.BaseRoutes.Roles.Handle("/names", api.ApiSessionRequiredTrustRequester(getRolesByNames)).Methods("POST")
	api.BaseRoutes.Roles.Handle("/{role_id:[A-Za-z0-9]+}/patch", api.ApiSessionRequired(patchRole)).Methods("PUT")
}

func getRole(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRoleId()
	if c.Err != nil {
		return
	}

	role, err := c.App.GetRole(c.Params.RoleId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(role.ToJson()))
}

func getRoleByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRoleName()
	if c.Err != nil {
		return
	}

	role, err := c.App.GetRoleByName(c.Params.RoleName)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(role.ToJson()))
}

func getRolesByNames(c *Context, w http.ResponseWriter, r *http.Request) {
	rolenames := model.ArrayFromJson(r.Body)

	if len(rolenames) == 0 {
		c.SetInvalidParam("rolenames")
		return
	}

	var cleanedRoleNames []string
	for _, rolename := range rolenames {
		if strings.TrimSpace(rolename) == "" {
			continue
		}

		if !model.IsValidRoleName(rolename) {
			c.SetInvalidParam("rolename")
			return
		}

		cleanedRoleNames = append(cleanedRoleNames, rolename)
	}

	roles, err := c.App.GetRolesByNames(cleanedRoleNames)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.RoleListToJson(roles)))
}

func patchRole(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireRoleId()
	if c.Err != nil {
		return
	}

	patch := model.RolePatchFromJson(r.Body)
	if patch == nil {
		c.SetInvalidParam("role")
		return
	}

	oldRole, err := c.App.GetRole(c.Params.RoleId)
	if err != nil {
		c.Err = err
		return
	}

	if c.App.License() == nil && patch.Permissions != nil {
		if oldRole.Name == "system_guest" || oldRole.Name == "team_guest" || oldRole.Name == "channel_guest" {
			c.Err = model.NewAppError("Api4.PatchRoles", "api.roles.patch_roles.license.error", nil, "", http.StatusNotImplemented)
			return
		}
		allowedPermissions := []string{
			model.PERMISSION_CREATE_TEAM.Id,
			model.PERMISSION_MANAGE_INCOMING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_OUTGOING_WEBHOOKS.Id,
			model.PERMISSION_MANAGE_SLASH_COMMANDS.Id,
			model.PERMISSION_MANAGE_OAUTH.Id,
			model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH.Id,
			model.PERMISSION_CREATE_EMOJIS.Id,
			model.PERMISSION_DELETE_EMOJIS.Id,
			model.PERMISSION_EDIT_OTHERS_POSTS.Id,
		}

		changedPermissions := model.PermissionsChangedByPatch(oldRole, patch)
		for _, permission := range changedPermissions {
			allowed := false
			for _, allowedPermission := range allowedPermissions {
				if permission == allowedPermission {
					allowed = true
				}
			}

			if !allowed {
				c.Err = model.NewAppError("Api4.PatchRoles", "api.roles.patch_roles.license.error", nil, "", http.StatusNotImplemented)
				return
			}
		}
	}

	if c.App.License() != nil && (oldRole.Name == "system_guest" || oldRole.Name == "team_guest" || oldRole.Name == "channel_guest") && !*c.App.License().Features.GuestAccountsPermissions {
		c.Err = model.NewAppError("Api4.PatchRoles", "api.roles.patch_roles.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	role, err := c.App.PatchRole(oldRole, patch)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")
	w.Write([]byte(role.ToJson()))
}
