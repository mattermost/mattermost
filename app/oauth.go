// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	b64 "encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	OauthCookieMaxAgeSeconds = 30 * 60 // 30 minutes
	CookieOauth              = "MMOAUTH"
	OpenIDScope              = "openid"
)

func (a *App) CreateOAuthApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("CreateOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	app.ClientSecret = model.NewId()

	oauthApp, err := a.Srv().Store.OAuth().SaveApp(app)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateOAuthApp", "app.oauth.save_app.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("CreateOAuthApp", "app.oauth.save_app.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return oauthApp, nil
}

func (a *App) GetOAuthApp(appId string) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApp, err := a.Srv().Store.OAuth().GetApp(appId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetOAuthApp", "app.oauth.get_app.find.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetOAuthApp", "app.oauth.get_app.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return oauthApp, nil
}

func (a *App) UpdateOauthApp(oldApp, updatedApp *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("UpdateOauthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	updatedApp.Id = oldApp.Id
	updatedApp.CreatorId = oldApp.CreatorId
	updatedApp.CreateAt = oldApp.CreateAt
	updatedApp.ClientSecret = oldApp.ClientSecret

	oauthApp, err := a.Srv().Store.OAuth().UpdateApp(updatedApp)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateOauthApp", "app.oauth.update_app.find.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("UpdateOauthApp", "app.oauth.update_app.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return oauthApp, nil
}

func (a *App) DeleteOAuthApp(appId string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return model.NewAppError("DeleteOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := a.Srv().Store.OAuth().DeleteApp(appId); err != nil {
		return model.NewAppError("DeleteOAuthApp", "app.oauth.delete_app.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().InvalidateAllCaches(); err != nil {
		mlog.Warn("error in invalidating cache", mlog.Err(err))
	}

	return nil
}

func (a *App) GetOAuthApps(page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthApps", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApps, err := a.Srv().Store.OAuth().GetApps(page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOAuthApps", "app.oauth.get_apps.find.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return oauthApps, nil
}

func (a *App) GetOAuthAppsByCreator(userId string, page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAppsByUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApps, err := a.Srv().Store.OAuth().GetAppByUser(userId, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOAuthAppsByCreator", "app.oauth.get_app_by_user.find.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return oauthApps, nil
}

func (a *App) GetOAuthImplicitRedirect(userId string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	session, err := a.GetOAuthAccessTokenForImplicitFlow(userId, authRequest)
	if err != nil {
		return "", err
	}

	values := &url.Values{}
	values.Add("access_token", session.Token)
	values.Add("token_type", "bearer")
	values.Add("expires_in", strconv.FormatInt((session.ExpiresAt-model.GetMillis())/1000, 10))
	values.Add("scope", authRequest.Scope)
	values.Add("state", authRequest.State)

	return fmt.Sprintf("%s#%s", authRequest.RedirectUri, values.Encode()), nil
}

func (a *App) GetOAuthCodeRedirect(userId string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	authData := &model.AuthData{UserId: userId, ClientId: authRequest.ClientId, CreateAt: model.GetMillis(), RedirectUri: authRequest.RedirectUri, State: authRequest.State, Scope: authRequest.Scope}
	authData.Code = model.NewId() + model.NewId()

	if _, err := a.Srv().Store.OAuth().SaveAuthData(authData); err != nil {
		return authRequest.RedirectUri + "?error=server_error&state=" + authRequest.State, nil
	}

	return authRequest.RedirectUri + "?code=" + url.QueryEscape(authData.Code) + "&state=" + url.QueryEscape(authData.State), nil
}

func (a *App) AllowOAuthAppAccessToUser(userId string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if authRequest.Scope == "" {
		authRequest.Scope = model.DEFAULT_SCOPE
	}

	oauthApp, nErr := a.Srv().Store.OAuth().GetApp(authRequest.ClientId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return "", model.NewAppError("AllowOAuthAppAccessToUser", "app.oauth.get_app.find.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return "", model.NewAppError("AllowOAuthAppAccessToUser", "app.oauth.get_app.finding.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if !oauthApp.IsValidRedirectURL(authRequest.RedirectUri) {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "", http.StatusBadRequest)
	}

	var redirectURI string
	var err *model.AppError
	switch authRequest.ResponseType {
	case model.AUTHCODE_RESPONSE_TYPE:
		redirectURI, err = a.GetOAuthCodeRedirect(userId, authRequest)
	case model.IMPLICIT_RESPONSE_TYPE:
		redirectURI, err = a.GetOAuthImplicitRedirect(userId, authRequest)
	default:
		return authRequest.RedirectUri + "?error=unsupported_response_type&state=" + authRequest.State, nil
	}

	if err != nil {
		mlog.Warn("error getting oauth redirect uri", mlog.Err(err))
		return authRequest.RedirectUri + "?error=server_error&state=" + authRequest.State, nil
	}

	// This saves the OAuth2 app as authorized
	authorizedApp := model.Preference{
		UserId:   userId,
		Category: model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP,
		Name:     authRequest.ClientId,
		Value:    authRequest.Scope,
	}

	if nErr := a.Srv().Store.Preference().Save(&model.Preferences{authorizedApp}); nErr != nil {
		mlog.Warn("error saving store preference", mlog.Err(nErr))
		return authRequest.RedirectUri + "?error=server_error&state=" + authRequest.State, nil
	}

	return redirectURI, nil
}

func (a *App) GetOAuthAccessTokenForImplicitFlow(userId string, authRequest *model.AuthorizeRequest) (*model.Session, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApp, err := a.GetOAuthApp(authRequest.ClientId)
	if err != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusNotFound)
	}

	user, err := a.GetUser(userId)
	if err != nil {
		return nil, err
	}

	session, err := a.newSession(oauthApp.Name, user)
	if err != nil {
		return nil, err
	}

	accessData := &model.AccessData{ClientId: authRequest.ClientId, UserId: user.Id, Token: session.Token, RefreshToken: "", RedirectUri: authRequest.RedirectUri, ExpiresAt: session.ExpiresAt, Scope: authRequest.Scope}

	if _, err := a.Srv().Store.OAuth().SaveAccessData(accessData); err != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError)
	}

	return session, nil
}

func (a *App) GetOAuthAccessTokenForCodeFlow(clientId, grantType, redirectUri, code, secret, refreshToken string) (*model.AccessResponse, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApp, nErr := a.Srv().Store.OAuth().GetApp(clientId)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusNotFound)
	}

	if oauthApp.ClientSecret != secret {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusForbidden)
	}

	var accessData *model.AccessData
	var accessRsp *model.AccessResponse
	var user *model.User
	if grantType == model.ACCESS_TOKEN_GRANT_TYPE {
		var authData *model.AuthData
		authData, nErr = a.Srv().Store.OAuth().GetAuthData(code)
		if nErr != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusBadRequest)
		}

		if authData.IsExpired() {
			if nErr = a.Srv().Store.OAuth().RemoveAuthData(authData.Code); nErr != nil {
				mlog.Warn("unable to remove auth data", mlog.Err(nErr))
			}
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusForbidden)
		}

		if authData.RedirectUri != redirectUri {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.redirect_uri.app_error", nil, "", http.StatusBadRequest)
		}

		user, nErr = a.Srv().Store.User().Get(authData.UserId)
		if nErr != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "", http.StatusNotFound)
		}

		accessData, nErr = a.Srv().Store.OAuth().GetPreviousAccessData(user.Id, clientId)
		if nErr != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal.app_error", nil, "", http.StatusBadRequest)
		}

		if accessData != nil {
			if accessData.IsExpired() {
				var access *model.AccessResponse
				access, err := a.newSessionUpdateToken(oauthApp.Name, accessData, user)
				if err != nil {
					return nil, err
				}
				accessRsp = access
			} else {
				// Return the same token and no need to create a new session
				accessRsp = &model.AccessResponse{
					AccessToken:  accessData.Token,
					TokenType:    model.ACCESS_TOKEN_TYPE,
					RefreshToken: accessData.RefreshToken,
					ExpiresIn:    int32((accessData.ExpiresAt - model.GetMillis()) / 1000),
				}
			}
		} else {
			var session *model.Session
			// Create a new session and return new access token
			session, err := a.newSession(oauthApp.Name, user)
			if err != nil {
				return nil, err
			}

			accessData = &model.AccessData{ClientId: clientId, UserId: user.Id, Token: session.Token, RefreshToken: model.NewId(), RedirectUri: redirectUri, ExpiresAt: session.ExpiresAt, Scope: authData.Scope}

			if _, nErr = a.Srv().Store.OAuth().SaveAccessData(accessData); nErr != nil {
				return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError)
			}

			accessRsp = &model.AccessResponse{
				AccessToken:  session.Token,
				TokenType:    model.ACCESS_TOKEN_TYPE,
				RefreshToken: accessData.RefreshToken,
				ExpiresIn:    int32(*a.Config().ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24),
			}
		}

		if nErr = a.Srv().Store.OAuth().RemoveAuthData(authData.Code); nErr != nil {
			mlog.Warn("unable to remove auth data", mlog.Err(nErr))
		}
	} else {
		// When grantType is refresh_token
		accessData, nErr = a.Srv().Store.OAuth().GetAccessDataByRefreshToken(refreshToken)
		if nErr != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.refresh_token.app_error", nil, "", http.StatusNotFound)
		}

		user, nErr := a.Srv().Store.User().Get(accessData.UserId)
		if nErr != nil {
			return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "", http.StatusNotFound)
		}

		access, err := a.newSessionUpdateToken(oauthApp.Name, accessData, user)
		if err != nil {
			return nil, err
		}
		accessRsp = access
	}

	return accessRsp, nil
}

func (a *App) newSession(appName string, user *model.User) (*model.Session, *model.AppError) {
	// Set new token an session
	session := &model.Session{UserId: user.Id, Roles: user.Roles, IsOAuth: true}
	session.GenerateCSRF()
	a.SetSessionExpireInDays(session, *a.Config().ServiceSettings.SessionLengthSSOInDays)
	session.AddProp(model.SESSION_PROP_PLATFORM, appName)
	session.AddProp(model.SESSION_PROP_OS, "OAuth2")
	session.AddProp(model.SESSION_PROP_BROWSER, "OAuth2")

	session, err := a.Srv().Store.Session().Save(session)
	if err != nil {
		return nil, model.NewAppError("newSession", "api.oauth.get_access_token.internal_session.app_error", nil, "", http.StatusInternalServerError)
	}

	a.AddSessionToCache(session)

	return session, nil
}

func (a *App) newSessionUpdateToken(appName string, accessData *model.AccessData, user *model.User) (*model.AccessResponse, *model.AppError) {
	// Remove the previous session
	if err := a.Srv().Store.Session().Remove(accessData.Token); err != nil {
		mlog.Warn("error removing access data token from session", mlog.Err(err))
	}

	session, err := a.newSession(appName, user)
	if err != nil {
		return nil, err
	}

	accessData.Token = session.Token
	accessData.RefreshToken = model.NewId()
	accessData.ExpiresAt = session.ExpiresAt

	if _, err := a.Srv().Store.OAuth().UpdateAccessData(accessData); err != nil {
		return nil, model.NewAppError("newSessionUpdateToken", "web.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError)
	}
	accessRsp := &model.AccessResponse{
		AccessToken:  session.Token,
		RefreshToken: accessData.RefreshToken,
		TokenType:    model.ACCESS_TOKEN_TYPE,
		ExpiresIn:    int32(*a.Config().ServiceSettings.SessionLengthSSOInDays * 60 * 60 * 24),
	}

	return accessRsp, nil
}

func (a *App) GetOAuthLoginEndpoint(w http.ResponseWriter, r *http.Request, service, teamId, action, redirectTo, loginHint string, isMobile bool) (string, *model.AppError) {
	stateProps := map[string]string{}
	stateProps["action"] = action
	if teamId != "" {
		stateProps["team_id"] = teamId
	}

	if redirectTo != "" {
		stateProps["redirect_to"] = redirectTo
	}

	stateProps[model.USER_AUTH_SERVICE_IS_MOBILE] = strconv.FormatBool(isMobile)

	authUrl, err := a.GetAuthorizationCode(w, r, service, stateProps, loginHint)
	if err != nil {
		return "", err
	}

	return authUrl, nil
}

func (a *App) GetOAuthSignupEndpoint(w http.ResponseWriter, r *http.Request, service, teamId string) (string, *model.AppError) {
	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_SIGNUP
	if teamId != "" {
		stateProps["team_id"] = teamId
	}

	authUrl, err := a.GetAuthorizationCode(w, r, service, stateProps, "")
	if err != nil {
		return "", err
	}

	return authUrl, nil
}

func (a *App) GetAuthorizedAppsForUser(userId string, page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetAuthorizedAppsForUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	apps, err := a.Srv().Store.OAuth().GetAuthorizedApps(userId, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetAuthorizedAppsForUser", "app.oauth.get_apps.find.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for k, a := range apps {
		a.Sanitize()
		apps[k] = a
	}

	return apps, nil
}

func (a *App) DeauthorizeOAuthAppForUser(userId, appId string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	// Revoke app sessions
	accessData, err := a.Srv().Store.OAuth().GetAccessDataByUserForApp(userId, appId)
	if err != nil {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "app.oauth.get_access_data_by_user_for_app.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, ad := range accessData {
		if err := a.RevokeAccessToken(ad.Token); err != nil {
			return err
		}

		if err := a.Srv().Store.OAuth().RemoveAccessData(ad.Token); err != nil {
			return model.NewAppError("DeauthorizeOAuthAppForUser", "app.oauth.remove_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	// Deauthorize the app
	if err := a.Srv().Store.Preference().Delete(userId, model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, appId); err != nil {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "app.preference.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) RegenerateOAuthAppSecret(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("RegenerateOAuthAppSecret", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	app.ClientSecret = model.NewId()
	if _, err := a.Srv().Store.OAuth().UpdateApp(app); err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("RegenerateOAuthAppSecret", "app.oauth.update_app.find.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("RegenerateOAuthAppSecret", "app.oauth.update_app.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return app, nil
}

func (a *App) RevokeAccessToken(token string) *model.AppError {
	session, _ := a.GetSession(token)

	defer ReturnSessionToPool(session)

	schan := make(chan error, 1)
	go func() {
		schan <- a.Srv().Store.Session().Remove(token)
		close(schan)
	}()

	if _, err := a.Srv().Store.OAuth().GetAccessData(token); err != nil {
		return model.NewAppError("RevokeAccessToken", "api.oauth.revoke_access_token.get.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.Srv().Store.OAuth().RemoveAccessData(token); err != nil {
		return model.NewAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_token.app_error", nil, "", http.StatusInternalServerError)
	}

	if err := <-schan; err != nil {
		return model.NewAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_session.app_error", nil, "", http.StatusInternalServerError)
	}

	if session != nil {
		a.ClearSessionCacheForUser(session.UserId)
	}

	return nil
}

func (a *App) CompleteOAuth(service string, body io.ReadCloser, teamId string, props map[string]string, tokenUser *model.User) (*model.User, *model.AppError) {
	defer body.Close()

	action := props["action"]

	switch action {
	case model.OAUTH_ACTION_SIGNUP:
		return a.CreateOAuthUser(service, body, teamId, tokenUser)
	case model.OAUTH_ACTION_LOGIN:
		return a.LoginByOAuth(service, body, teamId, tokenUser)
	case model.OAUTH_ACTION_EMAIL_TO_SSO:
		return a.CompleteSwitchWithOAuth(service, body, props["email"], tokenUser)
	case model.OAUTH_ACTION_SSO_TO_EMAIL:
		return a.LoginByOAuth(service, body, teamId, tokenUser)
	default:
		return a.LoginByOAuth(service, body, teamId, tokenUser)
	}
}

func (a *App) getSSOProvider(service string) (einterfaces.OauthProvider, *model.AppError) {
	sso := a.Config().GetSSOService(service)
	if sso == nil || !*sso.Enable {
		return nil, model.NewAppError("getSSOProvider", "api.user.authorize_oauth_user.unsupported.app_error", nil, "service="+service, http.StatusNotImplemented)
	}
	providerType := service
	if strings.Contains(*sso.Scope, OpenIDScope) {
		providerType = model.SERVICE_OPENID
	}
	provider := einterfaces.GetOauthProvider(providerType)
	if provider == nil {
		return nil, model.NewAppError("getSSOProvider", "api.user.login_by_oauth.not_available.app_error",
			map[string]interface{}{"Service": strings.Title(service)}, "", http.StatusNotImplemented)
	}
	return provider, nil
}

func (a *App) LoginByOAuth(service string, userData io.Reader, teamId string, tokenUser *model.User) (*model.User, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, e
	}

	buf := bytes.Buffer{}
	if _, err := buf.ReadFrom(userData); err != nil {
		return nil, model.NewAppError("LoginByOAuth2", "api.user.login_by_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "", http.StatusBadRequest)
	}

	authUser, err1 := provider.GetUserFromJson(bytes.NewReader(buf.Bytes()), tokenUser)
	if err1 != nil {
		return nil, model.NewAppError("LoginByOAuth", "api.user.login_by_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, err1.Error(), http.StatusBadRequest)
	}

	if *authUser.AuthData == "" {
		return nil, model.NewAppError("LoginByOAuth3", "api.user.login_by_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "", http.StatusBadRequest)
	}

	user, err := a.GetUserByAuth(model.NewString(*authUser.AuthData), service)
	if err != nil {
		if err.Id == MissingAuthAccountError {
			user, err = a.CreateOAuthUser(service, bytes.NewReader(buf.Bytes()), teamId, tokenUser)
		} else {
			return nil, err
		}
	} else {
		// OAuth doesn't run through CheckUserPreflightAuthenticationCriteria, so prevent bot login
		// here manually. Technically, the auth data above will fail to match a bot in the first
		// place, but explicit is always better.
		if user.IsBot {
			return nil, model.NewAppError("loginByOAuth", "api.user.login_by_oauth.bot_login_forbidden.app_error", nil, "", http.StatusForbidden)
		}

		if err = a.UpdateOAuthUserAttrs(bytes.NewReader(buf.Bytes()), user, provider, service, tokenUser); err != nil {
			return nil, err
		}
		if teamId != "" {
			err = a.AddUserToTeamByTeamId(teamId, user)
		}
	}

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (a *App) CompleteSwitchWithOAuth(service string, userData io.Reader, email string, tokenUser *model.User) (*model.User, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, e
	}

	if email == "" {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.blank_email.app_error", nil, "", http.StatusBadRequest)
	}

	ssoUser, err1 := provider.GetUserFromJson(userData, tokenUser)
	if err1 != nil {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, err1.Error(), http.StatusBadRequest)
	}

	if *ssoUser.AuthData == "" {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]interface{}{"Service": service}, "", http.StatusBadRequest)
	}

	user, nErr := a.Srv().Store.User().GetByEmail(email)
	if nErr != nil {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", MissingAccountError, nil, nErr.Error(), http.StatusInternalServerError)
	}

	if err := a.RevokeAllSessions(user.Id); err != nil {
		return nil, err
	}

	if _, nErr := a.Srv().Store.User().UpdateAuthData(user.Id, service, ssoUser.AuthData, ssoUser.Email, true); nErr != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("importUser", "app.user.update_auth_data.email_exists.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("importUser", "app.user.update_auth_data.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendSignInChangeEmail(user.Email, strings.Title(service)+" SSO", user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error("error sending signin change email", mlog.Err(err))
		}
	})

	return user, nil
}

func (a *App) CreateOAuthStateToken(extra string) (*model.Token, *model.AppError) {
	token := model.NewToken(model.TOKEN_TYPE_OAUTH, extra)

	if err := a.Srv().Store.Token().Save(token); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateOAuthStateToken", "app.recover.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return token, nil
}

func (a *App) GetOAuthStateToken(token string) (*model.Token, *model.AppError) {
	mToken, err := a.Srv().Store.Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetOAuthStateToken", "api.oauth.invalid_state_token.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if mToken.Type != model.TOKEN_TYPE_OAUTH {
		return nil, model.NewAppError("GetOAuthStateToken", "api.oauth.invalid_state_token.app_error", nil, "", http.StatusBadRequest)
	}

	return mToken, nil
}

func (a *App) GetAuthorizationCode(w http.ResponseWriter, r *http.Request, service string, props map[string]string, loginHint string) (string, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return "", e
	}

	sso, e2 := provider.GetSSOSettings(a.Config(), service)
	if e2 != nil {
		return "", model.NewAppError("GetAuthorizationCode.GetSSOSettings", "api.user.get_authorization_code.endpoint.app_error", nil, e2.Error(), http.StatusNotImplemented)
	}

	secure := false
	if GetProtocol(r) == "https" {
		secure = true
	}

	cookieValue := model.NewId()
	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	expiresAt := time.Unix(model.GetMillis()/1000+int64(OauthCookieMaxAgeSeconds), 0)
	oauthCookie := &http.Cookie{
		Name:     CookieOauth,
		Value:    cookieValue,
		Path:     subpath,
		MaxAge:   OauthCookieMaxAgeSeconds,
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   secure,
	}

	http.SetCookie(w, oauthCookie)

	clientId := *sso.Id
	endpoint := *sso.AuthEndpoint
	scope := *sso.Scope

	tokenExtra := generateOAuthStateTokenExtra(props["email"], props["action"], cookieValue)
	stateToken, err := a.CreateOAuthStateToken(tokenExtra)
	if err != nil {
		return "", err
	}

	props["token"] = stateToken.Token
	state := b64.StdEncoding.EncodeToString([]byte(model.MapToJson(props)))

	siteUrl := a.GetSiteURL()
	if strings.TrimSpace(siteUrl) == "" {
		siteUrl = GetProtocol(r) + "://" + r.Host
	}

	redirectUri := siteUrl + "/signup/" + service + "/complete"

	authUrl := endpoint + "?response_type=code&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirectUri) + "&state=" + url.QueryEscape(state)

	if scope != "" {
		authUrl += "&scope=" + utils.UrlEncode(scope)
	}

	if loginHint != "" {
		authUrl += "&login_hint=" + utils.UrlEncode(loginHint)
	}

	return authUrl, nil
}

func (a *App) AuthorizeOAuthUser(w http.ResponseWriter, r *http.Request, service, code, state, redirectUri string) (io.ReadCloser, string, map[string]string, *model.User, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, "", nil, nil, e
	}

	sso, e2 := provider.GetSSOSettings(a.Config(), service)
	if e2 != nil {
		return nil, "", nil, nil, model.NewAppError("AuthorizeOAuthUser.GetSSOSettings", "api.user.get_authorization_code.endpoint.app_error", nil, e.Error(), http.StatusNotImplemented)
	}

	b, strErr := b64.StdEncoding.DecodeString(state)
	if strErr != nil {
		return nil, "", nil, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, strErr.Error(), http.StatusBadRequest)
	}

	stateStr := string(b)
	stateProps := model.MapFromJson(strings.NewReader(stateStr))

	expectedToken, appErr := a.GetOAuthStateToken(stateProps["token"])
	if appErr != nil {
		return nil, "", stateProps, nil, appErr
	}

	stateEmail := stateProps["email"]
	stateAction := stateProps["action"]
	if stateAction == model.OAUTH_ACTION_EMAIL_TO_SSO && stateEmail == "" {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest)
	}

	cookie, cookieErr := r.Cookie(CookieOauth)
	if cookieErr != nil {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest)
	}

	expectedTokenExtra := generateOAuthStateTokenExtra(stateEmail, stateAction, cookie.Value)
	if expectedTokenExtra != expectedToken.Extra {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest)
	}

	appErr = a.DeleteToken(expectedToken)
	if appErr != nil {
		mlog.Warn("error deleting token", mlog.Err(appErr))
	}

	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	httpCookie := &http.Cookie{
		Name:     CookieOauth,
		Value:    "",
		Path:     subpath,
		MaxAge:   -1,
		HttpOnly: true,
	}

	http.SetCookie(w, httpCookie)

	teamId := stateProps["team_id"]

	p := url.Values{}
	p.Set("client_id", *sso.Id)
	p.Set("client_secret", *sso.Secret)
	p.Set("code", code)
	p.Set("grant_type", model.ACCESS_TOKEN_GRANT_TYPE)
	p.Set("redirect_uri", redirectUri)

	req, requestErr := http.NewRequest("POST", *sso.TokenEndpoint, strings.NewReader(p.Encode()))
	if requestErr != nil {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, requestErr.Error(), http.StatusInternalServerError)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := a.HTTPService().MakeClient(true).Do(req)
	if err != nil {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer resp.Body.Close()

	var buf bytes.Buffer
	tee := io.TeeReader(resp.Body, &buf)
	ar := model.AccessResponseFromJson(tee)
	if ar == nil || resp.StatusCode != http.StatusOK {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_response.app_error", nil, fmt.Sprintf("response_body=%s, status_code=%d", buf.String(), resp.StatusCode), http.StatusInternalServerError)
	}

	if strings.ToLower(ar.TokenType) != model.ACCESS_TOKEN_TYPE {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_token.app_error", nil, "token_type="+ar.TokenType+", response_body="+buf.String(), http.StatusInternalServerError)
	}

	if ar.AccessToken == "" {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.missing.app_error", nil, "response_body="+buf.String(), http.StatusInternalServerError)
	}

	p = url.Values{}
	p.Set("access_token", ar.AccessToken)

	var userFromToken *model.User
	if ar.IdToken != "" {
		userFromToken, err = provider.GetUserFromIdToken(ar.IdToken)
		if err != nil {
			return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	req, requestErr = http.NewRequest("GET", *sso.UserApiEndpoint, strings.NewReader(""))
	if requestErr != nil {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error", map[string]interface{}{"Service": service}, requestErr.Error(), http.StatusInternalServerError)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+ar.AccessToken)

	resp, err = a.HTTPService().MakeClient(true).Do(req)
	if err != nil {
		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error", map[string]interface{}{"Service": service}, err.Error(), http.StatusInternalServerError)
	} else if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()

		// Ignore the error below because the resulting string will just be the empty string if bodyBytes is nil
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		bodyString := string(bodyBytes)

		mlog.Error("Error getting OAuth user", mlog.Int("response", resp.StatusCode), mlog.String("body_string", bodyString))

		if service == model.SERVICE_GITLAB && resp.StatusCode == http.StatusForbidden && strings.Contains(bodyString, "Terms of Service") {
			// Return a nicer error when the user hasn't accepted GitLab's terms of service
			return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "oauth.gitlab.tos.error", nil, "", http.StatusBadRequest)
		}

		return nil, "", stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.response.app_error", nil, "response_body="+bodyString, http.StatusInternalServerError)
	}

	// Note that resp.Body is not closed here, so it must be closed by the caller
	return resp.Body, teamId, stateProps, userFromToken, nil
}

func (a *App) SwitchEmailToOAuth(w http.ResponseWriter, r *http.Request, email, password, code, service string) (string, *model.AppError) {
	if a.Srv().License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("emailToOAuth", "api.user.email_to_oauth.not_available.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if err = a.CheckPasswordAndAllCriteria(user, password, code); err != nil {
		return "", err
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAUTH_ACTION_EMAIL_TO_SSO
	stateProps["email"] = email

	if service == model.USER_AUTH_SERVICE_SAML {
		return a.GetSiteURL() + "/login/sso/saml?action=" + model.OAUTH_ACTION_EMAIL_TO_SSO + "&email=" + utils.UrlEncode(email), nil
	}

	authUrl, err := a.GetAuthorizationCode(w, r, service, stateProps, "")
	if err != nil {
		return "", err
	}

	return authUrl, nil
}

func (a *App) SwitchOAuthToEmail(email, password, requesterId string) (string, *model.AppError) {
	if a.Srv().License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("oauthToEmail", "api.user.oauth_to_email.not_available.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if user.Id != requesterId {
		return "", model.NewAppError("SwitchOAuthToEmail", "api.user.oauth_to_email.context.app_error", nil, "", http.StatusForbidden)
	}

	if err := a.UpdatePassword(user, password); err != nil {
		return "", err
	}

	T := utils.GetUserTranslations(user.Locale)

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error("error sending signin change email", mlog.Err(err))
		}
	})

	if err := a.RevokeAllSessions(requesterId); err != nil {
		return "", err
	}

	return "/login?extra=signin_change", nil
}

func generateOAuthStateTokenExtra(email, action, cookie string) string {
	return email + ":" + action + ":" + cookie
}
