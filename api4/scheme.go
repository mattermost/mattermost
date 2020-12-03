// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitScheme() {
	api.BaseRoutes.Schemes.Handle("", api.ApiSessionRequired(getSchemes)).Methods("GET")
	api.BaseRoutes.Schemes.Handle("", api.ApiSessionRequired(createScheme)).Methods("POST")
	api.BaseRoutes.Schemes.Handle("/{scheme_id:[A-Za-z0-9]+}", api.ApiSessionRequired(deleteScheme)).Methods("DELETE")
	api.BaseRoutes.Schemes.Handle("/{scheme_id:[A-Za-z0-9]+}", api.ApiSessionRequiredTrustRequester(getScheme)).Methods("GET")
	api.BaseRoutes.Schemes.Handle("/{scheme_id:[A-Za-z0-9]+}/patch", api.ApiSessionRequired(patchScheme)).Methods("PUT")
	api.BaseRoutes.Schemes.Handle("/{scheme_id:[A-Za-z0-9]+}/teams", api.ApiSessionRequiredTrustRequester(getTeamsForScheme)).Methods("GET")
	api.BaseRoutes.Schemes.Handle("/{scheme_id:[A-Za-z0-9]+}/channels", api.ApiSessionRequiredTrustRequester(getChannelsForScheme)).Methods("GET")
}

func createScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	scheme := model.SchemeFromJson(r.Body)
	if scheme == nil {
		c.SetInvalidParam("scheme")
		return
	}

	auditRec := c.MakeAuditRecord("createScheme", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("scheme", scheme)

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.CustomPermissionsSchemes {
		c.Err = model.NewAppError("Api4.CreateScheme", "api.scheme.create_scheme.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS)
		return
	}

	scheme, err := c.App.CreateScheme(scheme)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("scheme", scheme) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(scheme.ToJson()))
}

func getScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireSchemeId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS)
		return
	}

	scheme, err := c.App.GetScheme(c.Params.SchemeId)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(scheme.ToJson()))
}

func getSchemes(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_PERMISSIONS)
		return
	}

	scope := c.Params.Scope
	if scope != "" && scope != model.SCHEME_SCOPE_TEAM && scope != model.SCHEME_SCOPE_CHANNEL {
		c.SetInvalidParam("scope")
		return
	}

	schemes, err := c.App.GetSchemesPage(c.Params.Scope, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.SchemesToJson(schemes)))
}

func getTeamsForScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireSchemeId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_TEAMS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_TEAMS)
		return
	}

	scheme, err := c.App.GetScheme(c.Params.SchemeId)
	if err != nil {
		c.Err = err
		return
	}

	if scheme.Scope != model.SCHEME_SCOPE_TEAM {
		c.Err = model.NewAppError("Api4.GetTeamsForScheme", "api.scheme.get_teams_for_scheme.scope.error", nil, "", http.StatusBadRequest)
		return
	}

	teams, err := c.App.GetTeamsForSchemePage(scheme, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.TeamListToJson(teams)))
}

func getChannelsForScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireSchemeId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_USERMANAGEMENT_CHANNELS)
		return
	}

	scheme, err := c.App.GetScheme(c.Params.SchemeId)
	if err != nil {
		c.Err = err
		return
	}

	if scheme.Scope != model.SCHEME_SCOPE_CHANNEL {
		c.Err = model.NewAppError("Api4.GetChannelsForScheme", "api.scheme.get_channels_for_scheme.scope.error", nil, "", http.StatusBadRequest)
		return
	}

	channels, err := c.App.GetChannelsForSchemePage(scheme, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(channels.ToJson()))
}

func patchScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireSchemeId()
	if c.Err != nil {
		return
	}

	patch := model.SchemePatchFromJson(r.Body)
	if patch == nil {
		c.SetInvalidParam("scheme")
		return
	}

	auditRec := c.MakeAuditRecord("patchScheme", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.CustomPermissionsSchemes {
		c.Err = model.NewAppError("Api4.PatchScheme", "api.scheme.patch_scheme.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	scheme, err := c.App.GetScheme(c.Params.SchemeId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("scheme", scheme)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS)
		return
	}

	scheme, err = c.App.PatchScheme(scheme, patch)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("patch", scheme)

	auditRec.Success()
	c.LogAudit("")

	w.Write([]byte(scheme.ToJson()))
}

func deleteScheme(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireSchemeId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deleteScheme", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.CustomPermissionsSchemes {
		c.Err = model.NewAppError("Api4.DeleteScheme", "api.scheme.delete_scheme.license.error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_USERMANAGEMENT_PERMISSIONS)
		return
	}

	scheme, err := c.App.DeleteScheme(c.Params.SchemeId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddMeta("scheme", scheme)

	ReturnStatusOK(w)
}
