// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"net/http"
	"net/url"
	"path/filepath"
)

func (w *Web) InitOAuth() {
	// API version independent OAuth 2.0 as a service provider endpoints
	w.MainRouter.Handle("/oauth/authorize", w.trustRequesterHandler(authorizeOAuthPage)).Methods("GET")
	w.MainRouter.Handle("/oauth/authorize", w.apiSessionRequired(authorizeOAuthApp)).Methods("POST")
	//w.MainRouter.Handle("/oauth/deauthorize", api.ApiSessionRequired(deauthorizeOAuthApp)).Methods("POST")
	//w.MainRouter.Handle("/oauth/access_token", api.ApiHandlerTrustRequester(getAccessToken)).Methods("POST")

	// API version independent OAuth as a client endpoints
	//w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/complete", api.ApiHandler(completeOAuth)).Methods("GET")
	//w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/login", api.ApiHandler(loginWithOAuth)).Methods("GET")
	//w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/mobile_login", api.ApiHandler(mobileLoginWithOAuth)).Methods("GET")
	//w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/signup", api.ApiHandler(signupWithOAuth)).Methods("GET")

	// Old endpoints for backwards compatibility, needed to not break SSO for any old setups
	//w.MainRouter.Handle("/api/v3/oauth/{service:[A-Za-z0-9]+}/complete", api.ApiHandler(completeOAuth)).Methods("GET")
	//w.MainRouter.Handle("/signup/{service:[A-Za-z0-9]+}/complete", api.ApiHandler(completeOAuth)).Methods("GET")
	//w.MainRouter.Handle("/login/{service:[A-Za-z0-9]+}/complete", api.ApiHandler(completeOAuth)).Methods("GET")
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
