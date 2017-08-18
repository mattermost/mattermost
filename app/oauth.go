// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	b64 "encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

const (
	OAUTH_COOKIE_MAX_AGE_SECONDS = 30 * 60 // 30 minutes
	COOKIE_OAUTH                 = "MMOAUTH"
)

func CreateOAuthApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("CreateOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	secret := model.NewId()
	app.ClientSecret = secret

	if result := <-Srv.Store.OAuth().SaveApp(app); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OAuthApp), nil
	}
}

func GetOAuthApp(appId string) (*model.OAuthApp, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.OAuth().GetApp(appId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.OAuthApp), nil
	}
}

func DeleteOAuthApp(appId string) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return model.NewAppError("DeleteOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := (<-Srv.Store.OAuth().DeleteApp(appId)).Err; err != nil {
		return err
	}

	InvalidateAllCaches()

	return nil
}

func GetOAuthApps(page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthApps", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.OAuth().GetApps(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OAuthApp), nil
	}
}

func GetOAuthAppsByCreator(userId string, page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAppsByUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.OAuth().GetAppByUser(userId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.OAuthApp), nil
	}
}

func AllowOAuthAppAccessToUser(userId string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(authRequest.Scope) == 0 {
		authRequest.Scope = model.DEFAULT_SCOPE
	}

	var oauthApp *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(authRequest.ClientId); result.Err != nil {
		return "", result.Err
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	if !oauthApp.IsValidRedirectURL(authRequest.RedirectUri) {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "", http.StatusBadRequest)
	}

	if authRequest.ResponseType != model.AUTHCODE_RESPONSE_TYPE {
		return authRequest.RedirectUri + "?error=unsupported_response_type&state=" + authRequest.State, nil
	}

	authData := &model.AuthData{UserId: userId, ClientId: authRequest.ClientId, CreateAt: model.GetMillis(), RedirectUri: authRequest.RedirectUri, State: authRequest.State, Scope: authRequest.Scope}
	authData.Code = utils.HashSha256(fmt.Sprintf("%v:%v:%v:%v", authRequest.ClientId, authRequest.RedirectUri, authData.CreateAt, userId))

	// this saves the OAuth2 app as authorized
	authorizedApp := model.Preference{
		UserId:   userId,
		Category: model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP,
		Name:     authRequest.ClientId,
		Value:    authRequest.Scope,
	}

	if result := <-Srv.Store.Preference().Save(&model.Preferences{authorizedApp}); result.Err != nil {
		return authRequest.RedirectUri + "?error=server_error&state=" + authRequest.State, nil
	}

	if result := <-Srv.Store.OAuth().SaveAuthData(authData); result.Err != nil {
		return authRequest.RedirectUri + "?error=server_error&state=" + authRequest.State, nil
	}

	return authRequest.RedirectUri + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State), nil
}

func GetOAuthAccessToken(clientId, grantType, redirectUri, code, secret, refreshToken string) (*model.AccessResponse, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	var oauthApp *model.OAuthApp
	if result := <-Srv.Store.OAuth().GetApp(clientId); result.Err != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusNotFound)
	} else {
		oauthApp = result.Data.(*model.OAuthApp)
	}

	if oauthApp.ClientSecret != secret {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusForbidden)
	}

	var user *model.User
	var accessData *model.AccessData
	var accessRsp *model.AccessResponse
	if grantType == model.ACCESS_TOKEN_GRANT_TYPE {

		var authData *model.AuthData
		if result := <-Srv.Store.OAuth().GetAuthData(code); result.Err != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusInternalServerError)
		} else {
			authData = result.Data.(*model.AuthData)
		}

		if authData.IsExpired() {
			<-Srv.Store.OAuth().RemoveAuthData(authData.Code)
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusForbidden)
		}

		if authData.RedirectUri != redirectUri {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.redirect_uri.app_error", nil, "", http.StatusBadRequest)
		}

		if code != utils.HashSha256(fmt.Sprintf("%v:%v:%v:%v", clientId, redirectUri, authData.CreateAt, authData.UserId)) {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusBadRequest)
		}

		if result := <-Srv.Store.User().Get(authData.UserId); result.Err != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "", http.StatusNotFound)
		} else {
			user = result.Data.(*model.User)
		}

		if result := <-Srv.Store.OAuth().GetPreviousAccessData(user.Id, clientId); result.Err != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal.app_error", nil, "", http.StatusInternalServerError)
		} else if result.Data != nil {
			accessData := result.Data.(*model.AccessData)
			if accessData.IsExpired() {
				if access, err := newSessionUpdateToken(oauthApp.Name, accessData, user); err != nil {
					return nil, err
				} else {
					accessRsp = access
				}
			} else {
				//return the same token and no need to create a new session
				accessRsp = &model.AccessResponse{
					AccessToken:  accessData.Token,
					TokenType:    model.ACCESS_TOKEN_TYPE,
					RefreshToken: accessData.RefreshToken,
					ExpiresIn:    int32((accessData.ExpiresAt - model.GetMillis()) / 1000),
				}
			}
		} else {
			// create a new session and return new access token
			var session *model.Session
			if result, err := newSession(oauthApp.Name, user); err != nil {
				return nil, err
			} else {
				session = result
			}

			accessData = &model.AccessData{ClientId: clientId, UserId: user.Id, Token: session.Token, RefreshToken: model.NewId(), RedirectUri: redirectUri, ExpiresAt: session.ExpiresAt, Scope: authData.Scope}

			if result := <-Srv.Store.OAuth().SaveAccessData(accessData); result.Err != nil {
				l4g.Error(result.Err)
				return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError)
			}

			accessRsp = &model.AccessResponse{
				AccessToken:  session.Token,
				TokenType:    model.ACCESS_TOKEN_TYPE,
				RefreshToken: accessData.RefreshToken,
				ExpiresIn:    int32(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24),
			}
		}

		<-Srv.Store.OAuth().RemoveAuthData(authData.Code)
	} else {
		// when grantType is refresh_token
		if result := <-Srv.Store.OAuth().GetAccessDataByRefreshToken(refreshToken); result.Err != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.refresh_token.app_error", nil, "", http.StatusNotFound)
		} else {
			accessData = result.Data.(*model.AccessData)
		}

		if result := <-Srv.Store.User().Get(accessData.UserId); result.Err != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "", http.StatusNotFound)
		} else {
			user = result.Data.(*model.User)
		}

		if access, err := newSessionUpdateToken(oauthApp.Name, accessData, user); err != nil {
			return nil, err
		} else {
			accessRsp = access
		}
	}

	return accessRsp, nil
}

func newSession(appName string, user *model.User) (*model.Session, *model.AppError) {
	// set new token an session
	session := &model.Session{UserId: user.Id, Roles: user.Roles, IsOAuth: true}
	session.SetExpireInDays(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays)
	session.AddProp(model.SESSION_PROP_PLATFORM, appName)
	session.AddProp(model.SESSION_PROP_OS, "OAuth2")
	session.AddProp(model.SESSION_PROP_BROWSER, "OAuth2")

	if result := <-Srv.Store.Session().Save(session); result.Err != nil {
		return nil, model.NewAppError("newSession", "api.oauth.get_access_token.internal_session.app_error", nil, "", http.StatusInternalServerError)
	} else {
		session = result.Data.(*model.Session)
		AddSessionToCache(session)
	}

	return session, nil
}

func newSessionUpdateToken(appName string, accessData *model.AccessData, user *model.User) (*model.AccessResponse, *model.AppError) {
	var session *model.Session
	<-Srv.Store.Session().Remove(accessData.Token) //remove the previous session

	if result, err := newSession(appName, user); err != nil {
		return nil, err
	} else {
		session = result
	}

	accessData.Token = session.Token
	accessData.RefreshToken = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt
	if result := <-Srv.Store.OAuth().UpdateAccessData(accessData); result.Err != nil {
		l4g.Error(result.Err)
		return nil, model.NewAppError("newSessionUpdateToken", "web.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError)
	}
	accessRsp := &model.AccessResponse{
		AccessToken:  session.Token,
		RefreshToken: accessData.RefreshToken,
		TokenType:    model.ACCESS_TOKEN_TYPE,
		ExpiresIn:    int32(*utils.Cfg.ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24),
	}

	return accessRsp, nil
}

func GetOAuthLoginEndpoint(w http.ResponseWriter, r *http.Request, service, teamId, action, redirectTo, loginHint string) (string, *model.AppError) {
	stateProps := map[string]string{}
	stateProps["action"] = action
	if len(teamId) != 0 {
		stateProps["team_id"] = teamId
	}

	if len(redirectTo) != 0 {
		stateProps["redirect_to"] = redirectTo
	}

	if authUrl, err := GetAuthorizationCode(w, r, service, stateProps, loginHint); err != nil {
		return "", err
	} else {
		return authUrl, nil
	}
}

func GetOAuthSignupEndpoint(w http.ResponseWriter, r *http.Request, service, teamId string) (string, *model.AppError) {
	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	if len(teamId) != 0 {
		stateProps["team_id"] = teamId
	}

	if authUrl, err := GetAuthorizationCode(w, r, service, stateProps, ""); err != nil {
		return "", err
	} else {
		return authUrl, nil
	}
}

func GetAuthorizedAppsForUser(userId string, page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetAuthorizedAppsForUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if result := <-Srv.Store.OAuth().GetAuthorizedApps(userId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		apps := result.Data.([]*model.OAuthApp)
		for k, a := range apps {
			a.Sanitize()
			apps[k] = a
		}

		return apps, nil
	}
}

func DeauthorizeOAuthAppForUser(userId, appId string) *model.AppError {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	// revoke app sessions
	if result := <-Srv.Store.OAuth().GetAccessDataByUserForApp(userId, appId); result.Err != nil {
		return result.Err
	} else {
		accessData := result.Data.([]*model.AccessData)

		for _, a := range accessData {
			if err := RevokeAccessToken(a.Token); err != nil {
				return err
			}

			if rad := <-Srv.Store.OAuth().RemoveAccessData(a.Token); rad.Err != nil {
				return rad.Err
			}
		}
	}

	// Deauthorize the app
	if err := (<-Srv.Store.Preference().Delete(userId, model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, appId)).Err; err != nil {
		return err
	}

	return nil
}

func RegenerateOAuthAppSecret(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !utils.Cfg.ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("RegenerateOAuthAppSecret", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	app.ClientSecret = model.NewId()
	if update := <-Srv.Store.OAuth().UpdateApp(app); update.Err != nil {
		return nil, update.Err
	}

	return app, nil
}

func RevokeAccessToken(token string) *model.AppError {
	session, _ := GetSession(token)
	schan := Srv.Store.Session().Remove(token)

	if result := <-Srv.Store.OAuth().GetAccessData(token); result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.get.app_error", nil, "")
	}

	tchan := Srv.Store.OAuth().RemoveAccessData(token)

	if result := <-tchan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_token.app_error", nil, "")
	}

	if result := <-schan; result.Err != nil {
		return model.NewLocAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_session.app_error", nil, "")
	}

	if session != nil {
		ClearSessionCacheForUser(session.UserId)
	}

	return nil
}

func CompleteOAuth(service string, body io.ReadCloser, teamId string, props map[string]string) (*model.User, *model.AppError) {
	defer func() {
		ioutil.ReadAll(body)
		body.Close()
	}()

	action := props["action"]

	switch action {
	case model.OAUTH_ACTION_SIGNUP:
		return CreateOAuthUser(service, body, teamId)
	case model.OAUTH_ACTION_LOGIN:
		return LoginByOAuth(service, body, teamId)
	case model.OAUTH_ACTION_EMAIL_TO_SSO:
		return CompleteSwitchWithOAuth(service, body, props["email"])
	case model.OAUTH_ACTION_SSO_TO_EMAIL:
		return LoginByOAuth(service, body, teamId)
	default:
		return LoginByOAuth(service, body, teamId)
	}
}

func LoginByOAuth(service string, userData io.Reader, teamId string) (*model.User, *model.AppError) {
	buf := bytes.Buffer{}
	buf.ReadFrom(userData)

	authData := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		return nil, model.NewAppError("LoginByOAuth", "api.user.login_by_oauth.not_available.app_error",
			map[string]interface{}{"Service": strings.Title(service)}, "", http.StatusNotImplemented)
	} else {
		authData = provider.GetAuthDataFromJson(bytes.NewReader(buf.Bytes()))
	}

	if len(authData) == 0 {
		return nil, model.NewAppError("LoginByOAuth", "api.user.login_by_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "", http.StatusBadRequest)
	}

	user, err := GetUserByAuth(&authData, service)
	if err != nil {
		if err.Id == store.MISSING_AUTH_ACCOUNT_ERROR {
			return CreateOAuthUser(service, bytes.NewReader(buf.Bytes()), teamId)
		}
		return nil, err
	}

	if err = UpdateOAuthUserAttrs(bytes.NewReader(buf.Bytes()), user, provider, service); err != nil {
		return nil, err
	}

	if len(teamId) > 0 {
		err = AddUserToTeamByTeamId(teamId, user)
	}

	if err != nil {
		return nil, err
	}

	return user, nil
}

func CompleteSwitchWithOAuth(service string, userData io.ReadCloser, email string) (*model.User, *model.AppError) {
	authData := ""
	ssoEmail := ""
	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.unavailable.app_error",
			map[string]interface{}{"Service": strings.Title(service)}, "", http.StatusNotImplemented)
	} else {
		ssoUser := provider.GetUserFromJson(userData)
		ssoEmail = ssoUser.Email

		if ssoUser.AuthData != nil {
			authData = *ssoUser.AuthData
		}
	}

	if len(authData) == 0 {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "", http.StatusBadRequest)
	}

	if len(email) == 0 {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.blank_email.app_error", nil, "", http.StatusBadRequest)
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(email); result.Err != nil {
		return nil, result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if err := RevokeAllSessions(user.Id); err != nil {
		return nil, err
	}

	if result := <-Srv.Store.User().UpdateAuthData(user.Id, service, &authData, ssoEmail, true); result.Err != nil {
		return nil, result.Err
	}

	go func() {
		if err := SendSignInChangeEmail(user.Email, strings.Title(service)+" SSO", user.Locale, utils.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	}()

	return user, nil
}

func CreateOAuthStateToken(extra string) (*model.Token, *model.AppError) {
	token := model.NewToken(model.TOKEN_TYPE_OAUTH, extra)

	if result := <-Srv.Store.Token().Save(token); result.Err != nil {
		return nil, result.Err
	}

	return token, nil
}

func GetOAuthStateToken(token string) (*model.Token, *model.AppError) {
	if result := <-Srv.Store.Token().GetByToken(token); result.Err != nil {
		return nil, model.NewAppError("GetOAuthStateToken", "api.oauth.invalid_state_token.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	} else {
		token := result.Data.(*model.Token)
		if token.Type != model.TOKEN_TYPE_OAUTH {
			return nil, model.NewAppError("GetOAuthStateToken", "api.oauth.invalid_state_token.app_error", nil, "", http.StatusBadRequest)
		}

		return token, nil
	}
}

func generateOAuthStateTokenExtra(email, action, cookie string) string {
	return email + ":" + action + ":" + cookie
}

func GetAuthorizationCode(w http.ResponseWriter, r *http.Request, service string, props map[string]string, loginHint string) (string, *model.AppError) {
	sso := utils.Cfg.GetSSOService(service)
	if sso != nil && !sso.Enable {
		return "", model.NewAppError("GetAuthorizationCode", "api.user.get_authorization_code.unsupported.app_error", nil, "service="+service, http.StatusNotImplemented)
	}

	secure := false
	if GetProtocol(r) == "https" {
		secure = true
	}

	cookieValue := model.NewId()
	expiresAt := time.Unix(model.GetMillis()/1000+int64(OAUTH_COOKIE_MAX_AGE_SECONDS), 0)
	oauthCookie := &http.Cookie{
		Name:     COOKIE_OAUTH,
		Value:    cookieValue,
		Path:     "/",
		MaxAge:   OAUTH_COOKIE_MAX_AGE_SECONDS,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   secure,
	}

	http.SetCookie(w, oauthCookie)

	clientId := sso.Id
	endpoint := sso.AuthEndpoint
	scope := sso.Scope

	tokenExtra := generateOAuthStateTokenExtra(props["email"], props["action"], cookieValue)
	stateToken, err := CreateOAuthStateToken(tokenExtra)
	if err != nil {
		return "", err
	}

	props["token"] = stateToken.Token
	state := b64.StdEncoding.EncodeToString([]byte(model.MapToJson(props)))

	redirectUri := utils.GetSiteURL() + "/signup/" + service + "/complete"

	authUrl := endpoint + "?response_type=code&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirectUri) + "&state=" + url.QueryEscape(state)

	if len(scope) > 0 {
		authUrl += "&scope=" + utils.UrlEncode(scope)
	}

	if len(loginHint) > 0 {
		authUrl += "&login_hint=" + utils.UrlEncode(loginHint)
	}

	return authUrl, nil
}

func AuthorizeOAuthUser(w http.ResponseWriter, r *http.Request, service, code, state, redirectUri string) (io.ReadCloser, string, map[string]string, *model.AppError) {
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

	expectedToken, err := GetOAuthStateToken(stateProps["token"])
	if err != nil {
		return nil, "", stateProps, err
	}

	stateEmail := stateProps["email"]
	stateAction := stateProps["action"]
	if stateAction == model.OAUTH_ACTION_EMAIL_TO_SSO && stateEmail == "" {
		return nil, "", stateProps, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest)
	}

	cookieValue := ""
	if cookie, err := r.Cookie(COOKIE_OAUTH); err != nil {
		return nil, "", stateProps, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest)
	} else {
		cookieValue = cookie.Value
	}

	expectedTokenExtra := generateOAuthStateTokenExtra(stateEmail, stateAction, cookieValue)
	if expectedTokenExtra != expectedToken.Extra {
		return nil, "", stateProps, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest)
	}

	DeleteToken(expectedToken)

	cookie := &http.Cookie{
		Name:     COOKIE_OAUTH,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	}

	http.SetCookie(w, cookie)

	teamId := stateProps["team_id"]

	p := url.Values{}
	p.Set("client_id", sso.Id)
	p.Set("client_secret", sso.Secret)
	p.Set("code", code)
	p.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	p.Set("redirect_uri", redirectUri)

	req, _ := http.NewRequest("POST", sso.TokenEndpoint, strings.NewReader(p.Encode()))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	var ar *model.AccessResponse
	var bodyBytes []byte
	if resp, err := utils.HttpClient(true).Do(req); err != nil {
		return nil, "", stateProps, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, err.Error())
	} else {
		bodyBytes, _ = ioutil.ReadAll(resp.Body)
		resp.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))

		ar = model.AccessResponseFromJson(resp.Body)
		defer CloseBody(resp)
		if ar == nil {
			return nil, "", stateProps, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_response.app_error", nil, "response_body="+string(bodyBytes))
		}
	}

	if strings.ToLower(ar.TokenType) != model.ACCESS_TOKEN_TYPE {
		return nil, "", stateProps, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_token.app_error", nil, "token_type="+ar.TokenType+", response_body="+string(bodyBytes))
	}

	if len(ar.AccessToken) == 0 {
		return nil, "", stateProps, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.missing.app_error", nil, "response_body="+string(bodyBytes))
	}

	p = url.Values{}
	p.Set("access_token", ar.AccessToken)
	req, _ = http.NewRequest("GET", sso.UserApiEndpoint, strings.NewReader(""))

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+ar.AccessToken)

	if resp, err := utils.HttpClient(true).Do(req); err != nil {
		return nil, "", stateProps, model.NewLocAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error",
			map[string]interface{}{"Service": service}, err.Error())
	} else {
		return resp.Body, teamId, stateProps, nil
	}

}

func SwitchEmailToOAuth(w http.ResponseWriter, r *http.Request, email, password, code, service string) (string, *model.AppError) {
	var user *model.User
	var err *model.AppError
	if user, err = GetUserByEmail(email); err != nil {
		return "", err
	}

	if err := CheckPasswordAndAllCriteria(user, password, code); err != nil {
		return "", err
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_EMAIL_TO_SSO
	stateProps["email"] = email

	if service == model.USER_AUTH_SERVICE_SAML {
		return utils.GetSiteURL() + "/login/sso/saml?action=" + model.OAUTH_ACTION_EMAIL_TO_SSO + "&email=" + email, nil
	} else {
		if authUrl, err := GetAuthorizationCode(w, r, service, stateProps, ""); err != nil {
			return "", err
		} else {
			return authUrl, nil
		}
	}
}

func SwitchOAuthToEmail(email, password, requesterId string) (string, *model.AppError) {
	var user *model.User
	var err *model.AppError
	if user, err = GetUserByEmail(email); err != nil {
		return "", err
	}

	if user.Id != requesterId {
		return "", model.NewAppError("SwitchOAuthToEmail", "api.user.oauth_to_email.context.app_error", nil, "", http.StatusForbidden)
	}

	if err := UpdatePassword(user, password); err != nil {
		return "", err
	}

	T := utils.GetUserTranslations(user.Locale)

	go func() {
		if err := SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, utils.GetSiteURL()); err != nil {
			l4g.Error(err.Error())
		}
	}()

	if err := RevokeAllSessions(requesterId); err != nil {
		return "", err
	}

	return "/login?extra=signin_change", nil
}
