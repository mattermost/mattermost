// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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
		c.SetInvalidParam("oauth_app")
		return
	}

	auditRec := c.MakeAuditRecord("createOAuthApp", audit.Fail)
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
	auditRec.AddMeta("oauth_app", rapp)
	c.LogAudit("client_id=" + rapp.Id)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rapp); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("updateOAuthApp", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("oauth_app_id", c.Params.AppId)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	var oauthApp model.OAuthApp
	if jsonErr := json.NewDecoder(r.Body).Decode(&oauthApp); jsonErr != nil {
		c.SetInvalidParam("oauth_app")
		return
	}

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
	auditRec.AddMeta("oauth_app", oldOAuthApp)

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

	auditRec.Success()
	auditRec.AddMeta("update", updatedOAuthApp)
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(updatedOAuthApp); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var err *model.AppError
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		apps, err = c.App.GetOAuthApps(c.Params.Page, c.Params.PerPage)
	} else if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		apps, err = c.App.GetOAuthAppsByCreator(c.AppContext.Session().UserId, c.Params.Page, c.Params.PerPage)
	} else {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(apps)
	if jsonErr != nil {
		c.Err = model.NewAppError("getOAuthApps", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
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
		mlog.Warn("Error while writing response", mlog.Err(err))
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
		mlog.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("deleteOAuthApp", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("oauth_app_id", c.Params.AppId)
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
	auditRec.AddMeta("oauth_app", oauthApp)

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
	auditRec.AddMeta("oauth_app_id", c.Params.AppId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOAuth) {
		c.SetPermissionError(model.PermissionManageOAuth)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("oauth_app", oauthApp)

	if oauthApp.CreatorId != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystemWideOAuth) {
		c.SetPermissionError(model.PermissionManageSystemWideOAuth)
		return
	}

	oauthApp, err = c.App.RegenerateOAuthAppSecret(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(oauthApp); err != nil {
		mlog.Warn("Error while writing response", mlog.Err(err))
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

	apps, err := c.App.GetAuthorizedAppsForUser(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(apps)
	if jsonErr != nil {
		c.Err = model.NewAppError("getAuthorizedOAuthApps", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}
