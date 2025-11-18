// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

const (
	callbackHost = "callback"
)

func (w *Web) InitOAuth() {
	// OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414)
	w.MainRouter.Handle(model.OAuthMetadataEndpoint, w.APIHandlerTrustRequester(getAuthorizationServerMetadata)).Methods(http.MethodGet)

	// API version independent OAuth 2.0 as a service provider endpoints
	w.MainRouter.Handle(model.OAuthAuthorizeEndpoint, w.APIHandlerTrustRequester(authorizeOAuthPage)).Methods(http.MethodGet)
	w.MainRouter.Handle(model.OAuthAuthorizeEndpoint, w.APISessionRequired(authorizeOAuthApp)).Methods(http.MethodPost)
	w.MainRouter.Handle(model.OAuthDeauthorizeEndpoint, w.APISessionRequired(deauthorizeOAuthApp)).Methods(http.MethodPost)
	w.MainRouter.Handle(model.OAuthAccessTokenEndpoint, w.APIHandlerTrustRequester(getAccessToken)).Methods(http.MethodPost)

	// API version independent OAuth as a client endpoints
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/complete", w.APIHandler(completeOAuth)).Methods(http.MethodGet)
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/login", w.APIHandler(loginWithOAuth)).Methods(http.MethodGet)
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/mobile_login", w.APIHandler(mobileLoginWithOAuth)).Methods(http.MethodGet)
	w.MainRouter.Handle("/oauth/{service:[A-Za-z0-9]+}/signup", w.APIHandler(signupWithOAuth)).Methods(http.MethodGet)

	// Old endpoints for backwards compatibility, needed to not break SSO for any old setups
	w.MainRouter.Handle("/api/v3/oauth/{service:[A-Za-z0-9]+}/complete", w.APIHandler(completeOAuth)).Methods(http.MethodGet)
	w.MainRouter.Handle("/signup/{service:[A-Za-z0-9]+}/complete", w.APIHandler(completeOAuth)).Methods(http.MethodGet)
	w.MainRouter.Handle("/login/{service:[A-Za-z0-9]+}/complete", w.APIHandler(completeOAuth)).Methods(http.MethodGet)
	w.MainRouter.Handle("/api/v4/oauth_test", w.APISessionRequired(testHandler)).Methods(http.MethodGet)
}

func testHandler(c *Context, w http.ResponseWriter, r *http.Request) {
	ReturnStatusOK(w)
}

func authorizeOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	var authRequest *model.AuthorizeRequest
	err := json.NewDecoder(r.Body).Decode(&authRequest)
	if err != nil || authRequest == nil {
		c.SetInvalidParamWithErr("authorize_request", err)
		return
	}

	if err := authRequest.IsValid(); err != nil {
		c.Err = err
		return
	}

	if c.AppContext.Session().IsOAuth {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		c.Err.DetailedError += ", attempted access by oauth app"
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAuthorizeOAuthApp, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	redirectURL, appErr := c.App.AllowOAuthAppAccessToUser(c.AppContext, c.AppContext.Session().UserId, authRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	_, err = w.Write([]byte(model.MapToJSON(map[string]string{"redirect": redirectURL})))
	if err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func deauthorizeOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	requestData := model.MapFromJSON(r.Body)
	clientId := requestData["client_id"]

	if !model.IsValidId(clientId) {
		c.SetInvalidParam("client_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeauthorizeOAuthApp, model.AuditStatusFail)
	auditRec.AddMeta("client_id", clientId)
	defer c.LogAuditRec(auditRec)

	err := c.App.DeauthorizeOAuthAppForUser(c.AppContext, c.AppContext.Session().UserId, clientId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
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
		ResponseType:        r.URL.Query().Get("response_type"),
		ClientId:            r.URL.Query().Get("client_id"),
		RedirectURI:         r.URL.Query().Get("redirect_uri"),
		Scope:               r.URL.Query().Get("scope"),
		State:               r.URL.Query().Get("state"),
		CodeChallenge:       r.URL.Query().Get("code_challenge"),
		CodeChallengeMethod: r.URL.Query().Get("code_challenge_method"),
		Resource:            r.URL.Query().Get("resource"),
	}

	loginHint := r.URL.Query().Get("login_hint")

	if err := authRequest.IsValid(); err != nil {
		utils.RenderWebError(c.App.Config(), w, r, err.StatusCode,
			url.Values{
				"type":    []string{"oauth_invalid_param"},
				"message": []string{err.Message},
			}, c.App.AsymmetricSigningKey())
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAuthorizeOAuthPage, model.AuditStatusFail)
	auditRec.AddMeta("client_id", authRequest.ClientId)
	auditRec.AddMeta("scope", authRequest.Scope)
	defer c.LogAuditRec(auditRec)

	oauthApp, err := c.App.GetOAuthApp(authRequest.ClientId)
	if err != nil {
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	// here we should check if the user is logged in
	if c.AppContext.Session().UserId == "" {
		auditRec.Success()
		c.LogAudit("success")

		if loginHint == model.UserAuthServiceSaml {
			http.Redirect(w, r, c.GetSiteURLHeader()+"/login/sso/saml?redirect_to="+url.QueryEscape(r.RequestURI), http.StatusFound)
		} else {
			http.Redirect(w, r, c.GetSiteURLHeader()+"/login?redirect_to="+url.QueryEscape(r.RequestURI), http.StatusFound)
		}
		return
	}

	if !oauthApp.IsValidRedirectURL(authRequest.RedirectURI) {
		err := model.NewAppError("authorizeOAuthPage", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "", http.StatusBadRequest)
		utils.RenderWebError(c.App.Config(), w, r, err.StatusCode,
			url.Values{
				"type":    []string{"oauth_invalid_redirect_url"},
				"message": []string{i18n.T("api.oauth.allow_oauth.redirect_callback.app_error")},
			}, c.App.AsymmetricSigningKey())
		return
	}

	// Validate PKCE requirements for public clients using authorization code flow
	// Implicit flow doesn't require PKCE as it doesn't use code exchange
	if oauthApp.IsPublicClient() && authRequest.ResponseType == model.AuthCodeResponseType && authRequest.CodeChallenge == "" {
		err := model.NewAppError("authorizeOAuthPage", "api.oauth.allow_oauth.pkce_required_public.app_error", nil, "", http.StatusBadRequest)
		utils.RenderWebError(c.App.Config(), w, r, err.StatusCode,
			url.Values{
				"type":    []string{"oauth_pkce_required"},
				"message": []string{"PKCE is required for public clients using authorization code flow"},
			}, c.App.AsymmetricSigningKey())
		return
	}

	isAuthorized := false

	if _, err := c.App.GetPreferenceByCategoryAndNameForUser(c.AppContext, c.AppContext.Session().UserId, model.PreferenceCategoryAuthorizedOAuthApp, authRequest.ClientId); err == nil {
		// when we support scopes we should check if the scopes match
		isAuthorized = true
	}

	// Automatically allow if the app is trusted
	if oauthApp.IsTrusted || isAuthorized {
		redirectURL, err := c.App.AllowOAuthAppAccessToUser(c.AppContext, c.AppContext.Session().UserId, authRequest)
		if err != nil {
			utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
			return
		}

		auditRec.Success()
		c.LogAudit("success")

		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	w.Header().Set("Content-Security-Policy", fmt.Sprintf("frame-ancestors 'self' %s", *c.App.Config().ServiceSettings.FrameAncestors))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, max-age=31556926")

	staticDir, _ := fileutils.FindDir(model.ClientDir)
	http.ServeFile(w, r, filepath.Join(staticDir, "root.html"))
}

func getAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.bad_request.app_error", nil, "", http.StatusBadRequest)
		return
	}

	code := r.FormValue("code")
	refreshToken := r.FormValue("refresh_token")

	grantType := r.FormValue("grant_type")
	switch grantType {
	case model.AccessTokenGrantType:
		if code == "" {
			c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.missing_code.app_error", nil, "", http.StatusBadRequest)
			return
		}
	case model.RefreshTokenGrantType:
		if refreshToken == "" {
			c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.missing_refresh_token.app_error", nil, "", http.StatusBadRequest)
			return
		}
	default:
		c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.bad_grant.app_error", nil, "", http.StatusBadRequest)
		return
	}

	clientId := r.FormValue("client_id")
	if !model.IsValidId(clientId) {
		c.Err = model.NewAppError("getAccessToken", "api.oauth.get_access_token.bad_client_id.app_error", nil, "", http.StatusBadRequest)
		return
	}

	secret := r.FormValue("client_secret")
	codeVerifier := r.FormValue("code_verifier")

	// Authentication validation will be done at app layer based on client type
	// For public clients: client_secret should be empty, code_verifier required
	// For confidential clients: client_secret required, code_verifier optional but enforced if used

	redirectURI := r.FormValue("redirect_uri")
	resource := r.FormValue("resource")

	auditRec := c.MakeAuditRecord(model.AuditEventGetAccessToken, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("grant_type", grantType)
	auditRec.AddMeta("client_id", clientId)
	c.LogAudit("attempt")

	accessRsp, err := c.App.GetOAuthAccessTokenForCodeFlow(c.AppContext, clientId, grantType, redirectURI, code, secret, refreshToken, codeVerifier, resource)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	auditRec.Success()
	c.LogAudit("success")

	if err := json.NewEncoder(w).Encode(accessRsp); err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}

func completeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	service := c.Params.Service

	auditRec := c.MakeAuditRecord(model.AuditEventCompleteOAuth, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "service", service)

	oauthError := r.URL.Query().Get("error")
	if oauthError == "access_denied" {
		utils.RenderWebError(c.App.Config(), w, r, http.StatusTemporaryRedirect, url.Values{
			"type":    []string{"oauth_access_denied"},
			"service": []string{strings.Title(service)},
		}, c.App.AsymmetricSigningKey())
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		utils.RenderWebError(c.App.Config(), w, r, http.StatusTemporaryRedirect, url.Values{
			"type":    []string{"oauth_missing_code"},
			"service": []string{strings.Title(service)},
		}, c.App.AsymmetricSigningKey())
		return
	}

	state := r.URL.Query().Get("state")

	uri := c.GetSiteURLHeader() + "/signup/" + service + "/complete"

	body, props, tokenUser, err := c.App.AuthorizeOAuthUser(c.AppContext, w, r, service, code, state, uri)

	action := ""
	hasRedirectURL := false
	isMobile := false
	redirectURL := ""
	if props != nil {
		action = props["action"]
		isMobile = action == model.OAuthActionMobile
		if val, ok := props["redirect_to"]; ok {
			redirectURL = val
			hasRedirectURL = redirectURL != ""
		}
	}
	redirectURL = fullyQualifiedRedirectURL(c.GetSiteURLHeader(), redirectURL, c.App.Config().NativeAppSettings.AppCustomURLSchemes)

	renderError := func(err *model.AppError) {
		if isMobile && hasRedirectURL {
			utils.RenderMobileError(c.App.Config(), w, err, redirectURL)
		} else {
			utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		}
	}

	if err != nil {
		err.Translate(c.AppContext.T)
		c.LogErrorByCode(err)
		renderError(err)
		return
	}

	user, err := c.App.CompleteOAuth(c.AppContext, service, body, props, tokenUser)
	if err != nil {
		err.Translate(c.AppContext.T)
		c.LogErrorByCode(err)
		renderError(err)
		return
	}

	if action == model.OAuthActionEmailToSSO {
		redirectURL = c.GetSiteURLHeader() + "/login?extra=signin_change"
	} else if action == model.OAuthActionSSOToEmail {
		redirectURL = app.GetProtocol(r) + "://" + r.Host + "/claim?email=" + url.QueryEscape(props["email"])
	} else {
		desktopToken := ""
		if val, ok := props["desktop_token"]; ok {
			desktopToken = val
		}

		// If it's a desktop login we generate a token and redirect to another endpoint to handle session creation
		if desktopToken != "" {
			serverToken, serverTokenErr := c.App.GenerateAndSaveDesktopToken(time.Now().Unix(), user)
			if serverTokenErr != nil {
				serverTokenErr.Translate(c.AppContext.T)
				c.LogErrorByCode(serverTokenErr)
				renderError(serverTokenErr)
				return
			}

			queryString := map[string]string{
				"client_token": desktopToken,
				"server_token": *serverToken,
			}
			if val, ok := props["redirect_to"]; ok {
				queryString["redirect_to"] = val
			}
			if strings.HasPrefix(desktopToken, "dev-") {
				queryString["isDesktopDev"] = "true"
			}

			redirectURL = utils.AppendQueryParamsToURL(c.GetSiteURLHeader()+"/login/desktop", queryString)

			auditRec.Success()
			c.LogAudit("success")

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
			return
		}

		isOAuthUser := user.IsOAuthUser()

		session, err := c.App.DoLogin(c.AppContext, w, r, user, "", isMobile, isOAuthUser, false)
		if err != nil {
			err.Translate(c.AppContext.T)
			c.Logger.Error(err.Error())
			renderError(err)
			return
		}
		c.AppContext = c.AppContext.WithSession(session)

		// Old mobile version
		if isMobile && !hasRedirectURL {
			c.App.AttachSessionCookies(c.AppContext, w, r)

			auditRec.Success()
			c.LogAudit("success")

			return
		} else
		// New mobile version
		if isMobile && hasRedirectURL {
			redirectURL = utils.AppendQueryParamsToURL(redirectURL, map[string]string{
				model.SessionCookieToken: c.AppContext.Session().Token,
				model.SessionCookieCsrf:  c.AppContext.Session().GetCSRF(),
			})
			utils.RenderMobileAuthComplete(w, redirectURL)

			auditRec.Success()
			c.LogAudit("success")

			return
		}
		// For web
		c.App.AttachSessionCookies(c.AppContext, w, r)
	}

	auditRec.Success()
	c.LogAudit("success")

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func loginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	loginHint := r.URL.Query().Get("login_hint")
	redirectURL := r.URL.Query().Get("redirect_to")
	desktopToken := r.URL.Query().Get("desktop_token")

	if redirectURL != "" && !utils.IsValidWebAuthRedirectURL(c.App.Config(), redirectURL) {
		c.Err = model.NewAppError("loginWithOAuth", "api.invalid_redirect_url", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLoginWithOAuth, model.AuditStatusFail)
	auditRec.AddMeta("service", c.Params.Service)
	defer c.LogAuditRec(auditRec)

	// Get invite token or ID instead of team_id
	tokenID := r.URL.Query().Get("t")
	inviteId := r.URL.Query().Get("id")

	authURL, err := c.App.GetOAuthLoginEndpoint(c.AppContext, w, r, c.Params.Service, model.OAuthActionLogin, redirectURL, loginHint, false, desktopToken, tokenID, inviteId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	http.Redirect(w, r, authURL, http.StatusFound)
}

func mobileLoginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	redirectURL := html.EscapeString(r.URL.Query().Get("redirect_to"))

	if redirectURL != "" && !utils.IsValidMobileAuthRedirectURL(c.App.Config(), redirectURL) {
		err := model.NewAppError("mobileLoginWithOAuth", "api.invalid_custom_url_scheme", nil, "", http.StatusBadRequest)
		utils.RenderMobileError(c.App.Config(), w, err, redirectURL)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventMobileLoginWithOAuth, model.AuditStatusFail)
	auditRec.AddMeta("service", c.Params.Service)
	defer c.LogAuditRec(auditRec)

	// Get invite token or ID instead of team_id
	tokenID := r.URL.Query().Get("t")
	inviteId := r.URL.Query().Get("id")

	authURL, err := c.App.GetOAuthLoginEndpoint(c.AppContext, w, r, c.Params.Service, model.OAuthActionMobile, redirectURL, "", true, "", tokenID, inviteId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	http.Redirect(w, r, authURL, http.StatusFound)
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireService()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().TeamSettings.EnableUserCreation {
		utils.RenderWebError(c.App.Config(), w, r, http.StatusBadRequest, url.Values{
			"message": []string{i18n.T("api.oauth.singup_with_oauth.disabled.app_error")},
		}, c.App.AsymmetricSigningKey())
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSignupWithOAuth, model.AuditStatusFail)
	auditRec.AddMeta("service", c.Params.Service)
	defer c.LogAuditRec(auditRec)

	// Get invite token or ID instead of team_id
	tokenID := r.URL.Query().Get("t")
	inviteId := r.URL.Query().Get("id")

	desktopToken := r.URL.Query().Get("desktop_token")

	authURL, err := c.App.GetOAuthSignupEndpoint(c.AppContext, w, r, c.Params.Service, desktopToken, tokenID, inviteId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("success")

	http.Redirect(w, r, authURL, http.StatusFound)
}

func fullyQualifiedRedirectURL(siteURLPrefix, targetURL string, otherValidSchemes []string) string {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return siteURLPrefix
	}
	prefixParsed, err := url.Parse(siteURLPrefix)
	if err != nil {
		return siteURLPrefix
	}
	// mobile access
	if slices.Contains(otherValidSchemes, fmt.Sprintf("%v://", parsed.Scheme)) &&
		parsed.Host == callbackHost &&
		parsed.Path == "" &&
		parsed.RawQuery == "" &&
		parsed.Fragment == "" {
		return targetURL
	}
	// Check if the targetURL is valid and within the siteURLPrefix, excluding native app schemes like mmauth://
	sameScheme := parsed.Scheme == prefixParsed.Scheme
	sameHost := parsed.Host == prefixParsed.Host
	safePath := strings.HasPrefix(path.Clean(parsed.Path), path.Clean(prefixParsed.Path))

	if sameScheme && sameHost && safePath {
		return targetURL
	} else if parsed.Scheme != "" || parsed.Host != "" {
		return siteURLPrefix
	}

	// For relative URLs, normalize and join with siteURLPrefix
	if targetURL != "" && targetURL[0] != '/' {
		targetURL = "/" + targetURL
	}

	// Check for path traversal
	joinedURL, err := url.JoinPath(siteURLPrefix, targetURL)
	if err != nil {
		return siteURLPrefix
	}
	unescapedURL, err := url.PathUnescape(joinedURL)
	if err != nil {
		return siteURLPrefix
	}
	parsed, err = url.Parse(unescapedURL)
	if err != nil {
		return siteURLPrefix
	}

	if !strings.HasPrefix(path.Clean(parsed.Path), path.Clean(prefixParsed.Path)) {
		return siteURLPrefix
	}

	return parsed.String()
}

func getAuthorizationServerMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewAppError("getAuthorizationServerMetadata", "api.oauth.authorization_server_metadata.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	metadata, err := c.App.GetAuthorizationServerMetadata(c.AppContext)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(metadata); err != nil {
		c.Logger.Warn("Error writing authorization server metadata response", mlog.Err(err))
	}
}
