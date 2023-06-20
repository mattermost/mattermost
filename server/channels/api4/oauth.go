// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitOAuth() {
	api.BaseRoutes.OAuthApps.Handle("", api.APISessionRequired(createOAuthApp)).Methods("POST")
	api.BaseRoutes.OAuthApp.Handle("", api.APISessionRequired(updateOAuthApp)).Methods("PUT")
	api.BaseRoutes.OAuthApps.Handle("", api.APISessionRequired(getOAuthApps)).Methods("GET")
	api.BaseRoutes.OAuthApp.Handle("", api.APISessionRequired(getOAuthApp)).Methods("GET")
	api.BaseRoutes.OAuthApp.Handle("/info", api.APISessionRequired(getOAuthAppInfo)).Methods("GET")
	api.BaseRoutes.OAuthApp.Handle("", api.APISessionRequired(deleteOAuthApp)).Methods("DELETE")
	api.BaseRoutes.OAuthApp.Handle("/regen_secret", api.APISessionRequired(regenerateOAuthAppSecret)).Methods("POST")

	api.BaseRoutes.User.Handle("/oauth/apps/authorized", api.APISessionRequired(getAuthorizedOAuthApps)).Methods("GET")
}

func createOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	var oauthApp model.OAuthApp
	if jsonErr := json.NewDecoder(r.Body).Decode(&oauthApp); jsonErr != nil {
		c.SetInvalidParamWithErr("oauth_app", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createOAuthApp", audit.Fail)
	audit.AddEventParameterAuditable(auditRec, "oauth_app", &oauthApp)

	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		oauthApp.IsTrusted = false
	}

	oauthApp.CreatorId = c.AppContext.Session().UserId

	rapp, err := c.App.CreateOAuthApp(&oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rapp)
	auditRec.AddEventObjectType("oauth_app")
	c.LogAudit("client_id=" + rapp.Id)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rapp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateOAuthApp", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "oauth_app_id", c.Params.AppId)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	var oauthApp model.OAuthApp
	if jsonErr := json.NewDecoder(r.Body).Decode(&oauthApp); jsonErr != nil {
		c.SetInvalidParamWithErr("oauth_app", jsonErr)
		return
	}
	audit.AddEventParameterAuditable(auditRec, "oauth_app", &oauthApp)

	// The app being updated in the payload must be the same one as indicated in the URL.
	if oauthApp.Id != c.Params.AppId {
		c.SetInvalidParam("app_id")
		return
	}

	oldOAuthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oldOAuthApp)

	if c.AppContext.Session().UserId != oldOAuthApp.CreatorId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		oauthApp.IsTrusted = oldOAuthApp.IsTrusted
	}

	updatedOAuthApp, err := c.App.UpdateOAuthApp(oldOAuthApp, &oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(updatedOAuthApp)
	auditRec.AddEventObjectType("oauth_app")
	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(updatedOAuthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var appErr *model.AppError
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		apps, appErr = c.App.GetOAuthApps(c.Params.Page, c.Params.PerPage)
	} else if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		apps, appErr = c.App.GetOAuthAppsByCreator(c.AppContext.Session().UserId, c.Params.Page, c.Params.PerPage)
	} else {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(apps)
	if err != nil {
		c.Err = model.NewAppError("getOAuthApps", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}

func getOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}

	if oauthApp.CreatorId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOAuthAppInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}

	oauthApp.Sanitize()
	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deleteOAuthApp", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "oauth_app_id", c.Params.AppId)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oauthApp)
	auditRec.AddEventObjectType("oauth_app")

	if c.AppContext.Session().UserId != oauthApp.CreatorId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	err = c.App.DeleteOAuthApp(oauthApp.Id)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	ReturnStatusOK(w)
}

func regenerateOAuthAppSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("regenerateOAuthAppSecret", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "oauth_app_id", c.Params.AppId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oauthApp)
	auditRec.AddEventObjectType("oauth_app")

	if oauthApp.CreatorId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	oauthApp, err = c.App.RegenerateOAuthAppSecret(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(oauthApp)
	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAuthorizedOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), c.Params.UserId) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return
	}

	apps, appErr := c.App.GetAuthorizedAppsForUser(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(apps)
	if err != nil {
		c.Err = model.NewAppError("getAuthorizedOAuthApps", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(js)
}
