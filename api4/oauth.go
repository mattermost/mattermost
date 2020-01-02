// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitOAuth() {
	api.BaseRoutes.OAuthApps.Handle("", api.ApiSessionRequired(createOAuthApp)).Methods("POST")
	api.BaseRoutes.OAuthApp.Handle("", api.ApiSessionRequired(updateOAuthApp)).Methods("PUT")
	api.BaseRoutes.OAuthApps.Handle("", api.ApiSessionRequired(getOAuthApps)).Methods("GET")
	api.BaseRoutes.OAuthApp.Handle("", api.ApiSessionRequired(getOAuthApp)).Methods("GET")
	api.BaseRoutes.OAuthApp.Handle("/info", api.ApiSessionRequired(getOAuthAppInfo)).Methods("GET")
	api.BaseRoutes.OAuthApp.Handle("", api.ApiSessionRequired(deleteOAuthApp)).Methods("DELETE")
	api.BaseRoutes.OAuthApp.Handle("/regen_secret", api.ApiSessionRequired(regenerateOAuthAppSecret)).Methods("POST")

	api.BaseRoutes.User.Handle("/oauth/apps/authorized", api.ApiSessionRequired(getAuthorizedOAuthApps)).Methods("GET")
}

func createOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	oauthApp := model.OAuthAppFromJson(r.Body)

	if oauthApp == nil {
		c.SetInvalidParam("oauth_app")
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		oauthApp.IsTrusted = false
	}

	oauthApp.CreatorId = c.App.Session.UserId

	rapp, err := c.App.CreateOAuthApp(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("client_id=" + rapp.Id)
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(rapp.ToJson()))
}

func updateOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	oauthApp := model.OAuthAppFromJson(r.Body)
	if oauthApp == nil {
		c.SetInvalidParam("oauth_app")
		return
	}

	// The app being updated in the payload must be the same one as indicated in the URL.
	if oauthApp.Id != c.Params.AppId {
		c.SetInvalidParam("app_id")
		return
	}

	c.LogAudit("attempt")

	oldOauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}

	if c.App.Session.UserId != oldOauthApp.CreatorId && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH)
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		oauthApp.IsTrusted = oldOauthApp.IsTrusted
	}

	updatedOauthApp, err := c.App.UpdateOauthApp(oldOauthApp, oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")

	w.Write([]byte(updatedOauthApp.ToJson()))
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var err *model.AppError
	if c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		apps, err = c.App.GetOAuthApps(c.Params.Page, c.Params.PerPage)
	} else if c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		apps, err = c.App.GetOAuthAppsByCreator(c.App.Session.UserId, c.Params.Page, c.Params.PerPage)
	} else {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OAuthAppListToJson(apps)))
}

func getOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}

	if oauthApp.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH)
		return
	}

	w.Write([]byte(oauthApp.ToJson()))
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
	w.Write([]byte(oauthApp.ToJson()))
}

func deleteOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}

	if c.App.Session.UserId != oauthApp.CreatorId && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH)
		return
	}

	err = c.App.DeleteOAuthApp(oauthApp.Id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func regenerateOAuthAppSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireAppId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_OAUTH)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(c.Params.AppId)
	if err != nil {
		c.Err = err
		return
	}

	if oauthApp.CreatorId != c.App.Session.UserId && !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH)
		return
	}

	oauthApp, err = c.App.RegenerateOAuthAppSecret(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	w.Write([]byte(oauthApp.ToJson()))
}

func getAuthorizedOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToUser(c.App.Session, c.Params.UserId) {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		return
	}

	apps, err := c.App.GetAuthorizedAppsForUser(c.Params.UserId, c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OAuthAppListToJson(apps)))
}
