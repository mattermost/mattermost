// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitOAuth() {
	api.BaseRoutes.OAuth.Handle("/register", api.ApiUserRequired(registerOAuthApp)).Methods("POST")
	api.BaseRoutes.OAuth.Handle("/list", api.ApiUserRequired(getOAuthApps)).Methods("GET")
	api.BaseRoutes.OAuth.Handle("/app/{client_id}", api.ApiUserRequired(getOAuthAppInfo)).Methods("GET")
	api.BaseRoutes.OAuth.Handle("/allow", api.ApiUserRequired(allowOAuth)).Methods("GET")
	api.BaseRoutes.OAuth.Handle("/authorized", api.ApiUserRequired(getAuthorizedApps)).Methods("GET")
	api.BaseRoutes.OAuth.Handle("/delete", api.ApiUserRequired(deleteOAuthApp)).Methods("POST")
	api.BaseRoutes.OAuth.Handle("/{id:[A-Za-z0-9]+}/deauthorize", api.ApiUserRequired(deauthorizeOAuthApp)).Methods("POST")
	api.BaseRoutes.OAuth.Handle("/{id:[A-Za-z0-9]+}/regen_secret", api.ApiUserRequired(regenerateOAuthSecret)).Methods("POST")
	api.BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/login", api.AppHandlerIndependent(loginWithOAuth)).Methods("GET")
	api.BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/signup", api.AppHandlerIndependent(signupWithOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("registerOAuthApp", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	oauthApp := model.OAuthAppFromJson(r.Body)

	if oauthApp == nil {
		c.SetInvalidParam("registerOAuthApp", "app")
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		oauthApp.IsTrusted = false
	}

	oauthApp.CreatorId = c.Session.UserId

	rapp, err := c.App.CreateOAuthApp(oauthApp)

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("client_id=" + rapp.Id)
	w.Write([]byte(rapp.ToJson()))
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var err *model.AppError
	if c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		apps, err = c.App.GetOAuthApps(0, 100000)
	} else {
		apps, err = c.App.GetOAuthAppsByCreator(c.Session.UserId, 0, 100000)
	}

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OAuthAppListToJson(apps)))
}

func getOAuthAppInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	clientId := params["client_id"]

	oauthApp, err := c.App.GetOAuthApp(clientId)

	if err != nil {
		c.Err = err
		return
	}

	oauthApp.Sanitize()
	w.Write([]byte(oauthApp.ToJson()))
}

func allowOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.Err = model.NewAppError("allowOAuth", "api.oauth.allow_oauth.bad_response.app_error", nil, "", http.StatusBadRequest)
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewAppError("allowOAuth", "api.oauth.allow_oauth.bad_client.app_error", nil, "", http.StatusBadRequest)
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	if len(redirectUri) == 0 {
		c.Err = model.NewAppError("allowOAuth", "api.oauth.allow_oauth.bad_redirect.app_error", nil, "", http.StatusBadRequest)
		return
	}

	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	c.LogAudit("attempt")

	authRequest := &model.AuthorizeRequest{
		ResponseType: responseType,
		ClientId:     clientId,
		RedirectUri:  redirectUri,
		Scope:        scope,
		State:        state,
	}

	redirectUrl, err := c.App.AllowOAuthAppAccessToUser(c.Session.UserId, authRequest)

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	w.Write([]byte(model.MapToJson(map[string]string{"redirect": redirectUrl})))
}

func getAuthorizedApps(c *Context, w http.ResponseWriter, r *http.Request) {
	apps, err := c.App.GetAuthorizedAppsForUser(c.Session.UserId, 0, 10000)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OAuthAppListToJson(apps)))
}

func loginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	loginHint := r.URL.Query().Get("login_hint")
	redirectTo := r.URL.Query().Get("redirect_to")

	teamId, err := c.App.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	if authUrl, err := c.App.GetOAuthLoginEndpoint(w, r, service, teamId, model.OAUTH_ACTION_LOGIN, redirectTo, loginHint); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	if !c.App.Config().TeamSettings.EnableUserCreation {
		c.Err = model.NewAppError("signupWithOAuth", "api.oauth.singup_with_oauth.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	teamId, err := c.App.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	if authUrl, err := c.App.GetOAuthSignupEndpoint(w, r, service, teamId); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func deleteOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteOAuthApp", "id")
		return
	}

	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("deleteOAuthApp", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	oauthApp, err := c.App.GetOAuthApp(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != oauthApp.CreatorId && !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.LogAudit("fail - inappropriate permissions")
		c.Err = model.NewAppError("deleteOAuthApp", "api.oauth.delete.permissions.app_error", nil, "user_id="+c.Session.UserId, http.StatusForbidden)
		return
	}

	err = c.App.DeleteOAuthApp(id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func deauthorizeOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	err := c.App.DeauthorizeOAuthAppForUser(c.Session.UserId, id)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func regenerateOAuthSecret(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	oauthApp, err := c.App.GetOAuthApp(id)
	if err != nil {
		c.Err = err
		return
	}

	if oauthApp.CreatorId != c.Session.UserId && !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.Err = model.NewAppError("regenerateOAuthSecret", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	oauthApp, err = c.App.RegenerateOAuthAppSecret(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(oauthApp.ToJson()))
}
