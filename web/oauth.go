// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

func (w *Web) InitOAuth() {
	// API version independent OAuth 2.0 as a service provider endpoints
	w.MainRouter.Handle("/oauth/authorize", w.ApiHandlerTrustRequester(authorizeOAuthPage)).Methods("GET")
	w.MainRouter.Handle("/oauth/authorize", w.ApiSessionRequired(authorizeOAuthApp)).Methods("POST")
	w.MainRouter.Handle("/oauth/deauthorize", w.ApiSessionRequired(deauthorizeOAuthApp)).Methods("POST")
	w.MainRouter.Handle("/oauth/access_token", w.ApiHandlerTrustRequester(getAccessToken)).Methods("POST")

	// API version independent OAuth as a client endpoints
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/complete", w.ApiHandler(completeOAuth)).Methods("GET")
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/login", w.ApiHandler(loginWithOAuth)).Methods("GET")
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/mobile_login", w.ApiHandler(mobileLoginWithOAuth)).Methods("GET")
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/signup", w.ApiHandler(signupWithOAuth)).Methods("GET")

	// Old endpoints for backwards compatibility, needed to not break SSO for any old setups
	w.MainRouter.Handle("/api/v3/oauth/{service:[A-Za-z0-9]+}/complete", w.ApiHandler(completeOAuth)).Methods("GET")
	w.MainRouter.Handle("/signup/{service:[A-Za-z0-9]+}/complete", w.ApiHandler(completeOAuth)).Methods("GET")
	w.MainRouter.Handle("/login/{service:[A-Za-z0-9]+}/complete", w.ApiHandler(completeOAuth)).Methods("GET")
	w.MainRouter.Handle("/api/v4/oauth_test", w.ApiSessionRequired(testHandler)).Methods("GET")
}

func testHandler(c *Context, w http.ResponseWriter, r *http.Request) {
	ReturnStatusOK(w)
}

func authorizeOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	authRequest := model.AuthorizeRequestFromJson(r.Body)
	if authRequest == nil {
		c.SetInvalidParam("authorize_request")
	}

	if err := authRequest.IsValid(); err != nil {
		c.Err = err
		return
	}

	if c.App.Session.IsOAuth {
		c.SetPermissionError(model.PERMISSION_EDIT_OTHER_USERS)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	c.LogAudit("attempt")

	redirectUrl, err := c.App.AllowOAuthAppAccessToUser(c.App.Session.UserId, authRequest)

	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	w.Write([]byte(model.MapToJson(map[string]string{"redirect": redirectUrl})))
}

func deauthorizeOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	requestData := model.MapFromJson(r.Body)
	clientId := requestData["client_id"]

	if len(clientId) != 26 {
		c.SetInvalidParam("client_id")
		return
	}

	err := c.App.DeauthorizeOAuthAppForUser(c.App.Session.UserId, clientId)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func authorizeOAuthPage(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		err := model.NewAppError("authorizeOAuth", "api.oauth.authorize_oauth.disabled.app_error", nil, "", http.StatusNotImplemented)
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	authRequest := &model.AuthorizeRequest{
		ResponseType: r.URL.Query().Get("response_type"),
		ClientId:     r.URL.Query().Get("client_id"),
		RedirectUri:  r.URL.Query().Get("redirect_uri"),
		Scope:        r.URL.Query().Get("scope"),
		State:        r.URL.Query().Get("state"),
	}

	loginHint := r.URL.Query().Get("login_hint")

	if err := authRequest.IsValid(); err != nil {
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	oauthApp, err := c.App.GetOAuthApp(authRequest.ClientId)
	if err != nil {
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	// here we should check if the user is logged in
	if len(c.App.Session.UserId) == 0 {
		if loginHint == model.USER_AUTH_SERVICE_SAML {
			http.Redirect(w, r, c.GetSiteURLHeader()+"/login/sso/saml?redirect_to="+url.QueryEscape(r.RequestURI), http.StatusFound)
		} else {
			http.Redirect(w, r, c.GetSiteURLHeader()+"/login?redirect_to="+url.QueryEscape(r.RequestURI), http.StatusFound)
		}
		return
	}

	if !oauthApp.IsValidRedirectURL(authRequest.RedirectUri) {
		err := model.NewAppError("authorizeOAuthPage", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "", http.StatusBadRequest)
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	isAuthorized := false

	if _, err := c.App.GetPreferenceByCategoryAndNameForUser(c.App.Session.UserId, model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, authRequest.ClientId); err == nil {
		// when we support scopes we should check if the scopes match
		isAuthorized = true
	}

	// Automatically allow if the app is trusted
	if oauthApp.IsTrusted || isAuthorized {
		redirectUrl, err := c.App.AllowOAuthAppAccessToUser(c.App.Session.UserId, authRequest)

		if err != nil {
			utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
			return
		}

		http.Redirect(w, r, redirectUrl, http.StatusFound)
		return
	}

	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	w.Header().Set("Content-Security-Policy", "frame-ancestors 'self'")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, max-age=31556926, public")

	staticDir, _ := fileutils.FindDir(model.CLIENT_DIR)
	http.ServeFile(w, r, filepath.Join(staticDir, "root.html"))
}

func getAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	r.ParseForm()

	code := r.FormValue("code")
	refreshToken := r.FormValue("refresh_token")

	grantType := r.FormValue("grant_type")
	switch grantType {
	case model.ACCESS_TOKEN_GRANT_TYPE:
		if len(code) == 0 {
			c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.missing_code.app_error", nil, "", http.StatusBadRequest)
			return
		}
	case model.REFRESH_TOKEN_GRANT_TYPE:
		if len(refreshToken) == 0 {
			c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.missing_refresh_token.app_error", nil, "", http.StatusBadRequest)
			return
		}
	default:
		c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.bad_grant.app_error", nil, "", http.StatusBadRequest)
		return
	}

	clientId := r.FormValue("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.bad_client_id.app_error", nil, "", http.StatusBadRequest)
		return
	}

	secret := r.FormValue("client_secret")
	if len(secret) == 0 {
		c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.bad_client_secret.app_error", nil, "", http.StatusBadRequest)
		return
	}

	redirectUri := r.FormValue("redirect_uri")

	c.LogAudit("attempt")

	accessRsp, err := c.App.GetOAuthAccessTokenForCodeFlow(clientId, grantType, redirectUri, code, secret, refreshToken)
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

func completeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	service := c.Params.Service

	oauthError := r.URL.Query().Get("error")
	if oauthError == "access_denied" {
		utils.RenderWebError(c.App.Config(), w, r, http.StatusTemporaryRedirect, url.Values{
			"type":    []string{"oauth_access_denied"},
			"service": []string{strings.Title(service)},
		}, c.App.AsymmetricSigningKey())
		return
	}

	code := r.URL.Query().Get("code")
	if len(code) == 0 {
		utils.RenderWebError(c.App.Config(), w, r, http.StatusTemporaryRedirect, url.Values{
			"type":    []string{"oauth_missing_code"},
			"service": []string{strings.Title(service)},
		}, c.App.AsymmetricSigningKey())
		return
	}

	state := r.URL.Query().Get("state")

	uri := c.GetSiteURLHeader() + "/signup/" + service + "/complete"

	body, teamId, props, err := c.App.AuthorizeOAuthUser(w, r, service, code, state, uri)

	action := ""
	if props != nil {
		action = props["action"]
	}

	if err != nil {
		err.Translate(c.App.T)
		mlog.Error(err.Error())
		if action == model.OAUTH_ACTION_MOBILE {
			w.Write([]byte(err.ToJson()))
		} else {
			utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		}
		return
	}

	user, err := c.App.CompleteOAuth(service, body, teamId, props)
	if err != nil {
		err.Translate(c.App.T)
		mlog.Error(err.Error())
		if action == model.OAUTH_ACTION_MOBILE {
			w.Write([]byte(err.ToJson()))
		} else {
			utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		}
		return
	}

	var redirectUrl string
	if action == model.OAUTH_ACTION_EMAIL_TO_SSO {
		redirectUrl = c.GetSiteURLHeader() + "/login?extra=signin_change"
	} else if action == model.OAUTH_ACTION_SSO_TO_EMAIL {
		redirectUrl = app.GetProtocol(r) + "://" + r.Host + "/claim?email=" + url.QueryEscape(props["email"])
	} else {
		err = c.App.DoLogin(w, r, user, "")
		if err != nil {
			err.Translate(c.App.T)
			c.Err = err
			if action == model.OAUTH_ACTION_MOBILE {
				w.Write([]byte(err.ToJson()))
			}
			return
		}

		c.App.AttachSessionCookies(w, r)

		if _, ok := props["redirect_to"]; ok {
			redirectUrl = props["redirect_to"]
		} else {
			redirectUrl = c.GetSiteURLHeader()
		}
	}

	if action == model.OAUTH_ACTION_MOBILE {
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	http.Redirect(w, r, redirectUrl, http.StatusTemporaryRedirect)
}

func loginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	loginHint := r.URL.Query().Get("login_hint")
	redirectTo := r.URL.Query().Get("redirect_to")

	teamId, err := c.App.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	authUrl, err := c.App.GetOAuthLoginEndpoint(w, r, c.Params.Service, teamId, model.OAUTH_ACTION_LOGIN, redirectTo, loginHint)
	if err != nil {
		c.Err = err
		return
	}

	http.Redirect(w, r, authUrl, http.StatusFound)
}

func mobileLoginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	teamId, err := c.App.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	authUrl, err := c.App.GetOAuthLoginEndpoint(w, r, c.Params.Service, teamId, model.OAUTH_ACTION_MOBILE, "", "")
	if err != nil {
		c.Err = err
		return
	}

	http.Redirect(w, r, authUrl, http.StatusFound)
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().TeamSettings.EnableUserCreation {
		utils.RenderWebError(c.App.Config(), w, r, http.StatusBadRequest, url.Values{
			"message": []string{utils.T("api.oauth.singup_with_oauth.disabled.app_error")},
		}, c.App.AsymmetricSigningKey())
		return
	}

	teamId, err := c.App.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	authUrl, err := c.App.GetOAuthSignupEndpoint(w, r, c.Params.Service, teamId)
	if err != nil {
		c.Err = err
		return
	}

	http.Redirect(w, r, authUrl, http.StatusFound)
}
