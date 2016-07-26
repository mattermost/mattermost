// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"crypto/tls"
	b64 "encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitOAuth() {
	l4g.Debug(utils.T("api.oauth.init.debug"))

	BaseRoutes.OAuth.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	BaseRoutes.OAuth.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/login", AppHandlerIndependent(loginWithOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/{service:[A-Za-z0-9]+}/signup", AppHandlerIndependent(signupWithOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/authorize", ApiUserRequired(authorizeOAuth)).Methods("GET")
	BaseRoutes.OAuth.Handle("/access_token", ApiAppHandler(getAccessToken)).Methods("POST")

	BaseRoutes.Root.Handle("/authorize", ApiUserRequired(authorizeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/access_token", ApiAppHandler(getAccessToken)).Methods("POST")

	// Handle all the old routes, to be later removed
	BaseRoutes.Root.Handle("/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/signup/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	BaseRoutes.Root.Handle("/login/{service:[A-Za-z0-9]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
}

func registerOAuthApp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("registerOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	app := model.OAuthAppFromJson(r.Body)

	if app == nil {
		c.SetInvalidParam("registerOAuthApp", "app")
		return
	}

	secret := model.NewId()

	app.ClientSecret = secret
	app.CreatorId = c.Session.UserId

	if result := <-Srv.Store.OAuth().SaveApp(app); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.OAuthApp)
		app.ClientSecret = secret

		c.LogAudit("client_id=" + app.Id)

		w.Write([]byte(app.ToJson()))
		return
	}

}

func allowOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.turn_off.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
	responseData := map[string]string{}

	responseType := r.URL.Query().Get("response_type")
	if len(responseType) == 0 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_response.app_error", nil, "")
		return
	}

	clientId := r.URL.Query().Get("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_client.app_error", nil, "")
		return
	}

	redirectUri := r.URL.Query().Get("redirect_uri")
	if len(redirectUri) == 0 {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.bad_redirect.app_error", nil, "")
		return
	}

	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	var app *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.database.app_error", nil, "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !app.IsValidRedirectURL(redirectUri) {
		c.LogAudit("fail - redirect_uri did not match registered callback")
		c.Err = model.NewLocAppError("allowOAuth", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "")
		return
	}

	if responseType != model.AUTHCODE_RESPONSE_TYPE {
		responseData["redirect"] = redirectUri + "?error=unsupported_response_type&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	authData := &model.AuthData{UserId: c.Session.UserId, ClientId: clientId, CreateAt: model.GetMillis(), RedirectUri: redirectUri, State: state, Scope: scope}
	authData.Code = model.HashPassword(fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, c.Session.UserId))

	if result := <-Srv.Store.OAuth().SaveAuthData(authData); result.Err != nil {
		responseData["redirect"] = redirectUri + "?error=server_error&state=" + state
		w.Write([]byte(model.MapToJson(responseData)))
		return
	}

	c.LogAudit("success")

	responseData["redirect"] = redirectUri + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State)

	w.Write([]byte(model.MapToJson(responseData)))
}

func RevokeAccessToken(token string) *model.AppError {

	schan := Srv.Store.Session().Remove(token)
	sessionCache.Remove(token)

	var accessData *model.AccessData
	if result := <-Srv.Store.OAuth().GetAccessData(token); result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.get.app_error", nil, "")
	} else {
		accessData = result.Data.(*model.AccessData)
	}

	tchan := Srv.Store.OAuth().RemoveAccessData(token)
	cchan := Srv.Store.OAuth().RemoveAuthData(accessData.AuthCode)

	if result := <-tchan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_token.app_error", nil, "")
	}

	if result := <-cchan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_code.app_error", nil, "")
	}

	if result := <-schan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_session.app_error", nil, "")
	}

	return nil
}

func GetAuthData(code string) *model.AuthData {
	if result := <-Srv.Store.OAuth().GetAuthData(code); result.Err != nil {
		l4g.Error(utils.T("api.oauth.get_auth_data.find.error"), code)
		return nil
	} else {
		return result.Data.(*model.AuthData)
	}
}

func completeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	uri := c.GetSiteURL() + "/signup/" + service + "/complete"

	if body, teamId, props, err := AuthorizeOAuthUser(service, code, state, uri); err != nil {
		c.Err = err
		return
	} else {
		defer func() {
			ioutil.ReadAll(body)
			body.Close()
		}()

		action := props["action"]
		switch action {
		case model.OAUTH_ACTION_SIGNUP:
			CreateOAuthUser(c, w, r, service, body, teamId)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_LOGIN:
			user := LoginByOAuth(c, w, r, service, body)
			if len(teamId) > 0 {
				c.Err = JoinUserToTeamById(teamId, user)
			}
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_EMAIL_TO_SSO:
			CompleteSwitchWithOAuth(c, w, r, service, body, props["email"])
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/login?extra=signin_change", http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_SSO_TO_EMAIL:
			LoginByOAuth(c, w, r, service, body)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/claim?email="+url.QueryEscape(props["email"]), http.StatusTemporaryRedirect)
			}
			break
		default:
			LoginByOAuth(c, w, r, service, body)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host, http.StatusTemporaryRedirect)
			}
			break
		}
	}
}

func authorizeOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("authorizeOAuth", "web.authorize_oauth.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	responseType := r.URL.Query().Get("response_type")
	clientId := r.URL.Query().Get("client_id")
	redirect := r.URL.Query().Get("redirect_uri")
	scope := r.URL.Query().Get("scope")
	state := r.URL.Query().Get("state")

	if len(responseType) == 0 || len(clientId) == 0 || len(redirect) == 0 {
		c.Err = model.NewLocAppError("authorizeOAuth", "web.authorize_oauth.missing.app_error", nil, "")
		return
	}

	var app *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	var team *model.Team
	if result := <-Srv.Store.Team().Get(c.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	page := utils.NewHTMLTemplate("authorize", c.Locale)
	page.Props["Title"] = c.T("web.authorize_oauth.title")
	page.Props["TeamName"] = team.Name
	page.Props["AppName"] = app.Name
	page.Props["ResponseType"] = responseType
	page.Props["ClientId"] = clientId
	page.Props["RedirectUri"] = redirect
	page.Props["Scope"] = scope
	page.Props["State"] = state
	if err := page.RenderToWriter(w); err != nil {
		c.SetUnknownError(page.TemplateName, err.Error())
	}
}

func getAccessToken(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	c.LogAudit("attempt")

	r.ParseForm()

	grantType := r.FormValue("grant_type")
	if grantType != model.ACCESS_TOKEN_GRANT_TYPE {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.bad_grant.app_error", nil, "")
		return
	}

	clientId := r.FormValue("client_id")
	if len(clientId) != 26 {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.bad_client_id.app_error", nil, "")
		return
	}

	secret := r.FormValue("client_secret")
	if len(secret) == 0 {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.bad_client_secret.app_error", nil, "")
		return
	}

	code := r.FormValue("code")
	if len(code) == 0 {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.missing_code.app_error", nil, "")
		return
	}

	redirectUri := r.FormValue("redirect_uri")

	achan := Srv.Store.OAuth().GetApp(clientId)
	tchan := Srv.Store.OAuth().GetAccessDataByAuthCode(code)

	authData := GetAuthData(code)

	if authData == nil {
		c.LogAudit("fail - invalid auth code")
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.expired_code.app_error", nil, "")
		return
	}

	uchan := Srv.Store.User().Get(authData.UserId)

	if authData.IsExpired() {
		c.LogAudit("fail - auth code expired")
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.expired_code.app_error", nil, "")
		return
	}

	if authData.RedirectUri != redirectUri {
		c.LogAudit("fail - redirect uri provided did not match previous redirect uri")
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.redirect_uri.app_error", nil, "")
		return
	}

	if !model.ComparePassword(code, fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, authData.UserId)) {
		c.LogAudit("fail - auth code is invalid")
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.expired_code.app_error", nil, "")
		return
	}

	var app *model.OAuthApp
	if result := <-achan; result.Err != nil {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.credentials.app_error", nil, "")
		return
	} else {
		app = result.Data.(*model.OAuthApp)
	}

	if !model.ComparePassword(app.ClientSecret, secret) {
		c.LogAudit("fail - invalid client credentials")
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.credentials.app_error", nil, "")
		return
	}

	callback := redirectUri
	if len(callback) == 0 {
		callback = app.CallbackUrls[0]
	}

	if result := <-tchan; result.Err != nil {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.internal.app_error", nil, "")
		return
	} else if result.Data != nil {
		c.LogAudit("fail - auth code has been used previously")
		accessData := result.Data.(*model.AccessData)

		// Revoke access token, related auth code, and session from DB as well as from cache
		if err := RevokeAccessToken(accessData.Token); err != nil {
			l4g.Error(utils.T("web.get_access_token.revoking.error") + err.Message)
		}

		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.exchanged.app_error", nil, "")
		return
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.internal_user.app_error", nil, "")
		return
	} else {
		user = result.Data.(*model.User)
	}

	session := &model.Session{UserId: user.Id, Roles: user.Roles, IsOAuth: true}

	if result := <-Srv.Store.Session().Save(session); result.Err != nil {
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.internal_session.app_error", nil, "")
		return
	} else {
		session = result.Data.(*model.Session)
		AddSessionToCache(session)
	}

	accessData := &model.AccessData{AuthCode: authData.Code, Token: session.Token, RedirectUri: callback}

	if result := <-Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
		l4g.Error(result.Err)
		c.Err = model.NewLocAppError("getAccessToken", "web.get_access_token.internal_saving.app_error", nil, "")
		return
	}

	accessRsp := &model.AccessResponse{AccessToken: session.Token, TokenType: model.ACCESS_TOKEN_TYPE, ExpiresIn: int32(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24)}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")

	c.LogAuditWithUserId(user.Id, "success")

	w.Write([]byte(accessRsp.ToJson()))
}

func loginWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	loginHint := r.URL.Query().Get("login_hint")

	teamId, err := getTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_LOGIN
	if len(teamId) != 0 {
		stateProps["team_id"] = teamId
	}

	if authUrl, err := GetAuthorizationCode(c, service, stateProps, loginHint); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func getTeamIdFromQuery(query url.Values) (string, *model.AppError) {
	hash := query.Get("h")
	inviteId := query.Get("id")

	if len(hash) > 0 {
		data := query.Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			return "", model.NewLocAppError("getTeamIdFromQuery", "web.singup_with_oauth.invalid_link.app_error", nil, "")
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			return "", model.NewLocAppError("getTeamIdFromQuery", "web.singup_with_oauth.expired_link.app_error", nil, "")
		}

		return props["id"], nil
	} else if len(inviteId) > 0 {
		if result := <-Srv.Store.Team().GetByInviteId(inviteId); result.Err != nil {
			// soft fail, so we still create user but don't auto-join team
			l4g.Error("%v", result.Err)
		} else {
			return result.Data.(*model.Team).Id, nil
		}
	}

	return "", nil
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]

	if !utils.Cfg.TeamSettings.EnableUserCreation {
		c.Err = model.NewLocAppError("signupWithOAuth", "web.singup_with_oauth.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	teamId, err := getTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	if len(teamId) != 0 {
		stateProps["team_id"] = teamId
	}

	if authUrl, err := GetAuthorizationCode(c, service, stateProps, ""); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func GetAuthorizationCode(c *Context, service string, props map[string]string, loginHint string) (string, *model.AppError) {

	sso := utils.Cfg.GetSSOService(service)
	if sso != nil && !sso.Enable {
		return "", model.NewLocAppError("GetAuthorizationCode", "api.user.get_authorization_code.unsupported.app_error", nil, "service="+service)
	}

	clientId := sso.Id
	endpoint := sso.AuthEndpoint
	scope := sso.Scope

	props["hash"] = model.HashPassword(clientId)
	state := b64.StdEncoding.EncodeToString([]byte(model.MapToJson(props)))

	redirectUri := c.GetSiteURL() + "/signup/" + service + "/complete"

	authUrl := endpoint + "?response_type=code&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirectUri) + "&state=" + url.QueryEscape(state)

	if len(scope) > 0 {
		authUrl += "&scope=" + utils.UrlEncode(scope)
	}

	if len(loginHint) > 0 {
		authUrl += "&login_hint=" + utils.UrlEncode(loginHint)
	}

	return authUrl, nil
}

func AuthorizeOAuthUser(service, code, state, redirectUri string) (io.ReadCloser, string, map[string]string, *model.AppError) {
	sso := utils.Cfg.GetSSOService(service)
	if sso == nil || !sso.Enable {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.unsupported.app_error", nil, "service="+service)
	}

	stateStr := ""
	if b, err := b64.StdEncoding.DecodeString(state); err != nil {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, err.Error())
	} else {
		stateStr = string(b)
	}

	stateProps := model.MapFromJson(strings.NewReader(stateStr))

	if !model.ComparePassword(stateProps["hash"], sso.Id) {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "")
	}

	teamId := stateProps["team_id"]

	p := url.Values{}
	p.Set("client_id", sso.Id)
	p.Set("client_secret", sso.Secret)
	p.Set("code", code)
	p.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	p.Set("redirect_uri", redirectUri)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	client := &http.Client{Transport: tr}
	req, _ := http.NewRequest("POST", sso.TokenEndpoint, strings.NewReader(p.Encode()))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	var ar *model.AccessResponse
	if resp, err := client.Do(req); err != nil {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, err.Error())
	} else {
		ar = model.AccessResponseFromJson(resp.Body)
		defer func() {
			ioutil.ReadAll(resp.Body)
			resp.Body.Close()
		}()
		if ar == nil {
			return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_response.app_error", nil, "")
		}
	}

	if strings.ToLower(ar.TokenType) != model.ACCESS_TOKEN_TYPE {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_token.app_error", nil, "token_type="+ar.TokenType)
	}

	if len(ar.AccessToken) == 0 {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.missing.app_error", nil, "")
	}

	p = url.Values{}
	p.Set("access_token", ar.AccessToken)
	req, _ = http.NewRequest("GET", sso.UserApiEndpoint, strings.NewReader(""))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+ar.AccessToken)

	if resp, err := client.Do(req); err != nil {
		return nil, "", nil, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error",
			map[string]interface{}{"Service": service}, err.Error())
	} else {
		return resp.Body, teamId, stateProps, nil
	}

}

func CompleteSwitchWithOAuth(c *Context, w http.ResponseWriter, r *http.Request, service string, userData io.ReadCloser, email string) {
	authData := ""
	ssoEmail := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.unavailable.app_error",
			map[string]interface{}{"Service": strings.Title(service)}, "")
		return
	} else {
		ssoUser := provider.GetUserFromJson(userData)
		ssoEmail = ssoUser.Email

		if ssoUser.AuthData != nil {
			authData = *ssoUser.AuthData
		}
	}

	if len(authData) == 0 {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "")
		return
	}

	if len(email) == 0 {
		c.Err = model.NewLocAppError("CompleteClaimWithOAuth", "api.user.complete_switch_with_oauth.blank_email.app_error", nil, "")
		return
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	RevokeAllSession(c, user.Id)
	if c.Err != nil {
		return
	}

	if result := <-Srv.Store.User().UpdateAuthData(user.Id, service, &authData, ssoEmail); result.Err != nil {
		c.Err = result.Err
		return
	}

	go sendSignInChangeEmail(c, user.Email, c.GetSiteURL(), strings.Title(service)+" SSO")
}
