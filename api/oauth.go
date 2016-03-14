// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitOAuth(r *mux.Router) {
	l4g.Debug(utils.T("api.oauth.init.debug"))

	sr := r.PathPrefix("/oauth").Subrouter()

	sr.Handle("/register", ApiUserRequired(registerOAuthApp)).Methods("POST")
	sr.Handle("/allow", ApiUserRequired(allowOAuth)).Methods("GET")
	sr.Handle("/{service:[A-Za-z]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
	sr.Handle("/{service:[A-Za-z]+}/login", AppHandlerIndependent(loginWithOAuth)).Methods("GET")
	sr.Handle("/{service:[A-Za-z]+}/signup", AppHandlerIndependent(signupWithOAuth)).Methods("GET")
	sr.Handle("/authorize", ApiUserRequired(authorizeOAuth)).Methods("GET")
	sr.Handle("/access_token", ApiAppHandler(getAccessToken)).Methods("POST")

	// Also handle this a the old routes remove soon apiv2?
	mr := Srv.Router
	mr.Handle("/authorize", ApiUserRequired(authorizeOAuth)).Methods("GET")
	mr.Handle("/access_token", ApiAppHandler(getAccessToken)).Methods("POST")
	mr.Handle("/{service:[A-Za-z]+}/complete", AppHandlerIndependent(completeOAuth)).Methods("GET")
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

	uri := c.GetSiteURL() + "/api/v1/oauth/" + service + "/complete"

	if body, team, props, err := AuthorizeOAuthUser(service, code, state, uri); err != nil {
		c.Err = err
		return
	} else {
		action := props["action"]
		switch action {
		case model.OAUTH_ACTION_SIGNUP:
			CreateOAuthUser(c, w, r, service, body, team)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/"+team.Name, http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_LOGIN:
			LoginByOAuth(c, w, r, service, body, team)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/"+team.Name, http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_EMAIL_TO_SSO:
			CompleteSwitchWithOAuth(c, w, r, service, body, team, props["email"])
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/"+team.Name+"/login?extra=signin_change", http.StatusTemporaryRedirect)
			}
			break
		case model.OAUTH_ACTION_SSO_TO_EMAIL:
			LoginByOAuth(c, w, r, service, body, team)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/"+team.Name+"/"+"/claim?email="+url.QueryEscape(props["email"]), http.StatusTemporaryRedirect)
			}
			break
		default:
			LoginByOAuth(c, w, r, service, body, team)
			if c.Err == nil {
				http.Redirect(w, r, GetProtocol(r)+"://"+r.Host+"/"+team.Name, http.StatusTemporaryRedirect)
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
	if result := <-Srv.Store.Team().Get(c.Session.TeamId); result.Err != nil {
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

	session := &model.Session{UserId: user.Id, TeamId: user.TeamId, Roles: user.Roles, IsOAuth: true}

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
	teamName := r.URL.Query().Get("team")

	if len(teamName) == 0 {
		c.Err = model.NewLocAppError("loginWithOAuth", "web.login_with_oauth.invalid_team.app_error", nil, "team_name="+teamName)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	// Make sure team exists
	if result := <-Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.Err = result.Err
		return
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_LOGIN

	if authUrl, err := GetAuthorizationCode(c, service, teamName, stateProps, loginHint); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}

func signupWithOAuth(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	service := params["service"]
	teamName := r.URL.Query().Get("team")

	if !utils.Cfg.TeamSettings.EnableUserCreation {
		c.Err = model.NewLocAppError("signupTeam", "web.singup_with_oauth.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if len(teamName) == 0 {
		c.Err = model.NewLocAppError("signupWithOAuth", "web.singup_with_oauth.invalid_team.app_error", nil, "team_name="+teamName)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	hash := r.URL.Query().Get("h")

	var team *model.Team
	if result := <-Srv.Store.Team().GetByName(teamName); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	if IsVerifyHashRequired(nil, team, hash) {
		data := r.URL.Query().Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt)) {
			c.Err = model.NewLocAppError("signupWithOAuth", "web.singup_with_oauth.invalid_link.app_error", nil, "")
			return
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			c.Err = model.NewLocAppError("signupWithOAuth", "web.singup_with_oauth.expired_link.app_error", nil, "")
			return
		}

		if team.Id != props["id"] {
			c.Err = model.NewLocAppError("signupWithOAuth", "web.singup_with_oauth.invalid_team.app_error", nil, data)
			return
		}
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP

	if authUrl, err := GetAuthorizationCode(c, service, teamName, stateProps, ""); err != nil {
		c.Err = err
		return
	} else {
		http.Redirect(w, r, authUrl, http.StatusFound)
	}
}
