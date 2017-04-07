// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"net/url"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitOAuth() {
	l4g.Debug(utils.T("api.oauth.init.debug"))

	BaseRoutes.OAuth.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/list", ApiUserRequired(getOAuthApps)).Methods("GET")
	BaseRoutes.OAuth.Handle("/app/{client_id}", ApiUserRequired(getOAuthAppInfo)).Methods("GET")
	BaseRoutes.OAuth.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/authorized", ApiUserRequired(getAuthorizedApps)).Methods("GET")
	BaseRoutes.OAuth.Handle("/delete", ApiUserRequired(deleteOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/{id:[A-Za-z0-9]+}/deauthorize", ApiUserRequired(deauthorizeOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/{id:[A-Za-z0-9]+}/regen_secret", ApiUserRequired(regenerateOAuthSecret)).Methods("POST")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/login", AppHandlerIndependent(loginWithOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/signup", AppHandlerIndependent(signupWithOAuth)).Methods("GET")

	BaseRoutes.Root.Handle("/oauth/authorize", AppHandlerTrustRequester(authorizeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/oauth/access_token", ApiAppHandlerTrustRequester(getAccessToken)).Methods("POST")

	// Handle all the old routes, to be later removed
	BaseRoutes.Root.Handle("/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/signup/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/login/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("registerOAuthApp", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	oauthApp := model.OAuthAppFromJson(r.Body)

	if oauthApp == nil {
		c.SetInvalidParam("registerOAuthApp", "app")
		return
	}

	oauthApp.CreatorId = c.Session.UserId

	rapp, err := app.CreateOAuthApp(oauthApp)

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("client_id=" + rapp.Id)
	w.Write([]byte(rapp.ToJson()))
}

func getOAuthApps(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("getOAuthApps", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	var apps []*model.OAuthApp
	var err *model.AppError
	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		apps, err = app.GetOAuthApps(0, 100000)
	} else {
		apps, err = app.GetOAuthAppsByCreator(c.Session.UserId, 0, 100000)
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

	oauthApp, err := app.GetOAuthApp(clientId)

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

	redirectUrl, err := app.AllowOAuthAppAccessToUser(c.Session.UserId, responseType, clientId, redirectUri, scope, state)

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	w.Write([]byte(model.MapToJson(map[string]string{"redirect": redirectUrl})))
}

func getAuthorizedApps(c *Context, w http.ResponseWriter, r *http.Request) {
	apps, err := app.GetAuthorizedAppsForUser(c.Session.UserId, 0, 10000)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.OAuthAppListToJson(apps)))
}

func completeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	code := r.URL.Query().Get("code")
	if len(code) == 0 {
		c.Err = model.NewLocAppError("completeOAuth", "api.oauth.complete_oauth.missing_code.app_error", map[string]interface{}{"service": strings.Title(service)}, "URL: "+r.URL.String())
		return
	}

	state := r.URL.Query().Get("state")

	uri := c.GetSiteURLHeader() + "/signup/" + service + "/complete"

	body, teamId, props, err := app.AuthorizeOAuthUser(service, code, state, uri)
	if err != nil {
		c.Err = err
		return
	}

	user, err := app.CompleteOAuth(service, body, teamId, props)
	if err != nil {
		c.Err = err
		return
	}

	action := props["action"]

	var redirectUrl string
	if action == model.OAUTH_ACTION_EMAIL_TO_SSO {
		redirectUrl = c.GetSiteURLHeader() + "/login?extra=signin_change"
	} else if action == model.OAUTH_ACTION_SSO_TO_EMAIL {

		redirectUrl = app.GetProtocol(r) + "://" + r.Host + "/claim?email=" + url.QueryEscape(props["email"])
	} else {
		doLogin(c, w, r, user, "")
		if c.Err != nil {
			return
		}

		redirectUrl = c.GetSiteURLHeader()
	}

	http.Redirect(w, r, redirectUrl, http.StatusTemporaryRedirect)
}

func authorizeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("authorizeOAuth", "api.oauth.authorize_oauth.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	responseType := r.URL.Query().Get("response_type")
	clientId := r.URL.Query().Get("client_id")
	redirect := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	if len(scope) == 0 {
		scope = model.DEFAULT_SCOPE
	}

	if len(responseType) == 0 || len(clientId) == 0 || len(redirect) == 0 {
		c.Err = model.NewLocAppError("authorizeOAuth", "api.oauth.authorize_oauth.missing.app_error", nil, "")
		return
	}

	var oauthApp *model.OAuthApp
	if result := <-app.Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	// here we should check if the user is logged in
	if len(c.Session.UserId) == 0 {
		http.Redirect(w, r, c.GetSiteURLHeader()+"/login?redirect_to="+url.QueryEscape(r.RequestURI), http.StatusFound)
		return
	}

	isAuthorized := false
	if result := <-app.Srv.Store.Preference().Get(c.Session.UserId, model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, clientId); result.Err == nil {
		// when we support scopes we should check if the scopes match
		isAuthorized = true
	}

	// Automatically allow if the app is trusted
	if oauthApp.IsTrusted || isAuthorized {
		redirectUrl, err := app.AllowOAuthAppAccessToUser(c.Session.UserId, model.AUTHCODE_RESPONSE_TYPE, clientId, redirect, scope, state)

		if err != nil {
			c.Err = err
			return
		}

		http.Redirect(w, r, redirectUrl, http.StatusFound)
		return
	}

	w.Header().Set("Content-Type", "text/html")

	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")
	http.ServeFile(w, r, utils.FindDir(model.CLIENT_DIR)+"root.html")
}

func getAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	r.ParseForm()

	code := r.FormValue("code")
	refreshToken := r.FormValue("refresh_token")

	grantType := r.FormValue("grant_type")
	switch grantType {
	case model.ACCESS_TOKEN_GRANT_TYPE:
		if len(code) == 0 {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.missing_code.app_error", nil, "")
			return
		}
	case model.REFRESH_TOKEN_GRANT_TYPE:
		if len(refreshToken) == 0 {
			c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.missing_refresh_token.app_error", nil, "")
			return
		}
	default:
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.bad_grant.app_error", nil, "")
		return
	}

	clientId := r.FormValue("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.bad_client_id.app_error", nil, "")
		return
	}

	secret := r.FormValue("client_secret")
	if len(secret) == 0 {
		c.Err = model.NewLocAppError("getAccessToken", "api.oauth.get_access_token.bad_client_secret.app_error", nil, "")
		return
	}

	redirectUri := r.FormValue("redirect_uri")

	c.LogAudit("attempt")

	accessRsp, err := app.GetOAuthAccessToken(clientId, grantType, redirectUri, code, secret, refreshToken)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	c.LogAudit("success")

	w.Write([]byte(accessRsp.ToJson()))
}

func loginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	loginHint := r.URL.Query().Get("login_hint")
	redirectTo := r.URL.Query().Get("redirect_to")

	teamId, err := app.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	if authUrl, err := app.GetOAuthLoginEndpoint(service, teamId, redirectTo, loginHint); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	if !utils.Cfg.TeamSettings.EnableUserCreation {
		c.Err = model.NewAppError("signupWithOAuth", "api.oauth.singup_with_oauth.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	teamId, err := app.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	if authUrl, err := app.GetOAuthSignupEndpoint(service, teamId); err != nil {
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OAUTH) {
		c.Err = model.NewAppError("deleteOAuthApp", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	oauthApp, err := app.GetOAuthApp(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != oauthApp.CreatorId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.LogAudit("fail - inappropriate permissions")
		c.Err = model.NewAppError("deleteOAuthApp", "api.oauth.delete.permissions.app_error", nil, "user_id="+c.Session.UserId, http.StatusForbidden)
		return
	}

	err = app.DeleteOAuthApp(id)
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

	err := app.DeauthorizeOAuthAppForUser(c.Session.UserId, id)
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

	oauthApp, err := app.GetOAuthApp(id)
	if err != nil {
		c.Err = err
		return
	}

	if oauthApp.CreatorId != c.Session.UserId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM_WIDE_OAUTH) {
		c.Err = model.NewAppError("regenerateOAuthSecret", "api.command.admin_only.app_error", nil, "", http.StatusForbidden)
		return
	}

	oauthApp, err = app.RegenerateOAuthAppSecret(oauthApp)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(oauthApp.ToJson()))
}
