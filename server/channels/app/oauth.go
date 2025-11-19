// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	b64 "encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	OAuthCookieMaxAgeSeconds = 30 * 60 // 30 minutes
	CookieOAuth              = "MMOAUTH"
	OpenIDScope              = "openid"
)

func (a *App) CreateOAuthApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	// Public method for plugin API - always generates secrets for backward compatibility
	return a.CreateOAuthAppInternal(app, true)
}

// CreateOAuthAppInternal creates an OAuth app with optional secret generation.
// If generateSecret is true and ClientSecret is empty, a secret will be auto-generated.
// If generateSecret is false, the ClientSecret is left as-is (empty for public clients).
func (a *App) CreateOAuthAppInternal(app *model.OAuthApp, generateSecret bool) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("CreateOAuthApp", "api.oauth.register_oauth_app.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	// Generate a client secret if requested and not already set
	if generateSecret {
		app.ClientSecret = model.NewId()
	}

	oauthApp, err := a.Srv().Store().OAuth().SaveApp(app)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput

		a.Log().Error("Error saving OAuth app", mlog.Err(err), mlog.String("name", app.Name))

		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateOAuthApp", "app.oauth.save_app.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateOAuthApp", "app.oauth.save_app.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return oauthApp, nil
}

func (a *App) GetOAuthApp(appID string) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApp, err := a.Srv().Store().OAuth().GetApp(appID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetOAuthApp", "app.oauth.get_app.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetOAuthApp", "app.oauth.get_app.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return oauthApp, nil
}

func (a *App) UpdateOAuthApp(oldApp, updatedApp *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("UpdateOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	updatedApp.Id = oldApp.Id
	updatedApp.CreatorId = oldApp.CreatorId
	updatedApp.CreateAt = oldApp.CreateAt
	updatedApp.ClientSecret = oldApp.ClientSecret
	updatedApp.IsDynamicallyRegistered = oldApp.IsDynamicallyRegistered

	oauthApp, err := a.Srv().Store().OAuth().UpdateApp(updatedApp)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateOAuthApp", "app.oauth.update_app.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateOAuthApp", "app.oauth.update_app.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return oauthApp, nil
}

func (a *App) DeleteOAuthApp(rctx request.CTX, appID string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return model.NewAppError("DeleteOAuthApp", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := a.Srv().Store().OAuth().DeleteApp(appID); err != nil {
		return model.NewAppError("DeleteOAuthApp", "app.oauth.delete_app.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().InvalidateAllCaches(); err != nil {
		rctx.Logger().Warn("error in invalidating cache", mlog.Err(err))
	}

	return nil
}

func (a *App) GetOAuthApps(page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthApps", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApps, err := a.Srv().Store().OAuth().GetApps(page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOAuthApps", "app.oauth.get_apps.find.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return oauthApps, nil
}

func (a *App) GetOAuthAppsByCreator(userID string, page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAppsByUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApps, err := a.Srv().Store().OAuth().GetAppByUser(userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetOAuthAppsByCreator", "app.oauth.get_app_by_user.find.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return oauthApps, nil
}

func (a *App) GetOAuthImplicitRedirect(rctx request.CTX, userID string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	session, err := a.GetOAuthAccessTokenForImplicitFlow(rctx, userID, authRequest)
	if err != nil {
		return "", err
	}

	values := &url.Values{}
	values.Add("access_token", session.Token)
	values.Add("token_type", "bearer")
	values.Add("expires_in", strconv.FormatInt((session.ExpiresAt-model.GetMillis())/1000, 10))
	values.Add("scope", authRequest.Scope)
	values.Add("state", authRequest.State)

	return fmt.Sprintf("%s#%s", authRequest.RedirectURI, values.Encode()), nil
}

func (a *App) GetOAuthCodeRedirect(userID string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	authData := &model.AuthData{
		UserId:              userID,
		ClientId:            authRequest.ClientId,
		CreateAt:            model.GetMillis(),
		RedirectUri:         authRequest.RedirectURI,
		State:               authRequest.State,
		Scope:               authRequest.Scope,
		CodeChallenge:       authRequest.CodeChallenge,
		CodeChallengeMethod: authRequest.CodeChallengeMethod,
		Resource:            authRequest.Resource,
	}
	authData.Code = model.NewId() + model.NewId()

	// parse authRequest.RedirectURI to handle query parameters see: https://mattermost.atlassian.net/browse/MM-46216
	uri, err := url.Parse(authRequest.RedirectURI)
	if err != nil {
		return authRequest.RedirectURI + "?error=redirect_uri_parse_error&state=" + authRequest.State, nil
	}
	queryParams := uri.Query()
	if _, err := a.Srv().Store().OAuth().SaveAuthData(authData); err != nil {
		queryParams.Set("error", "server_error")
		queryParams.Set("state", authRequest.State)
		uri.RawQuery = queryParams.Encode()
		return uri.String(), nil
	}
	queryParams.Set("code", authData.Code)
	queryParams.Set("state", authData.State)
	uri.RawQuery = queryParams.Encode()
	return uri.String(), nil
}

func (a *App) AllowOAuthAppAccessToUser(rctx request.CTX, userID string, authRequest *model.AuthorizeRequest) (string, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	if authRequest.Scope == "" {
		authRequest.Scope = model.DefaultScope
	}

	oauthApp, nErr := a.Srv().Store().OAuth().GetApp(authRequest.ClientId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return "", model.NewAppError("AllowOAuthAppAccessToUser", "app.oauth.get_app.find.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return "", model.NewAppError("AllowOAuthAppAccessToUser", "app.oauth.get_app.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if !oauthApp.IsValidRedirectURL(authRequest.RedirectURI) {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.redirect_callback.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate PKCE requirements for public clients
	if oauthApp.IsPublicClient() && authRequest.ResponseType == model.AuthCodeResponseType && authRequest.CodeChallenge == "" {
		return "", model.NewAppError("AllowOAuthAppAccessToUser", "api.oauth.allow_oauth.pkce_required_public.app_error", nil, "", http.StatusBadRequest)
	}

	var redirectURI string
	var err *model.AppError
	switch authRequest.ResponseType {
	case model.AuthCodeResponseType:
		redirectURI, err = a.GetOAuthCodeRedirect(userID, authRequest)
	case model.ImplicitResponseType:
		redirectURI, err = a.GetOAuthImplicitRedirect(rctx, userID, authRequest)
	default:
		return authRequest.RedirectURI + "?error=unsupported_response_type&state=" + authRequest.State, nil
	}

	if err != nil {
		rctx.Logger().Warn("error getting oauth redirect uri", mlog.Err(err))
		return authRequest.RedirectURI + "?error=server_error&state=" + authRequest.State, nil
	}

	// This saves the OAuth2 app as authorized
	authorizedApp := model.Preference{
		UserId:   userID,
		Category: model.PreferenceCategoryAuthorizedOAuthApp,
		Name:     authRequest.ClientId,
		Value:    authRequest.Scope,
	}

	if nErr := a.Srv().Store().Preference().Save(model.Preferences{authorizedApp}); nErr != nil {
		rctx.Logger().Warn("error saving store preference", mlog.Err(nErr))
		return authRequest.RedirectURI + "?error=server_error&state=" + authRequest.State, nil
	}

	return redirectURI, nil
}

func (a *App) GetOAuthAccessTokenForImplicitFlow(rctx request.CTX, userID string, authRequest *model.AuthorizeRequest) (*model.Session, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApp, err := a.GetOAuthApp(authRequest.ClientId)
	if err != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	user, err := a.GetUser(userID)
	if err != nil {
		return nil, err
	}

	session, err := a.newSession(rctx, oauthApp, user)
	if err != nil {
		return nil, err
	}

	accessData := &model.AccessData{ClientId: authRequest.ClientId, UserId: user.Id, Token: session.Token, RefreshToken: "", RedirectUri: authRequest.RedirectURI, ExpiresAt: session.ExpiresAt, Scope: authRequest.Scope}

	if _, err := a.Srv().Store().OAuth().SaveAccessData(accessData); err != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return session, nil
}

func (a *App) GetOAuthAccessTokenForCodeFlow(rctx request.CTX, clientId, grantType, redirectURI, code, secret, refreshToken, codeVerifier, resource string) (*model.AccessResponse, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	oauthApp, nErr := a.Srv().Store().OAuth().GetApp(clientId)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.credentials.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
	}

	if err := a.validateOAuthClient(oauthApp, grantType, secret, codeVerifier); err != nil {
		return nil, err
	}

	if grantType == model.AccessTokenGrantType {
		return a.handleAuthorizationCodeGrant(rctx, oauthApp, redirectURI, code, codeVerifier, clientId, resource)
	}

	return a.handleRefreshTokenGrant(rctx, oauthApp, refreshToken, resource)
}

func (a *App) validateOAuthClient(oauthApp *model.OAuthApp, grantType, secret, codeVerifier string) *model.AppError {
	return oauthApp.ValidateForGrantType(grantType, secret, codeVerifier)
}

func (a *App) validatePKCE(oauthApp *model.OAuthApp, authData *model.AuthData, codeVerifier string) *model.AppError {
	return authData.ValidatePKCEForClientType(oauthApp.IsPublicClient(), codeVerifier)
}

func (a *App) handleAuthorizationCodeGrant(rctx request.CTX, oauthApp *model.OAuthApp, redirectURI, code, codeVerifier, clientId, resource string) (*model.AccessResponse, *model.AppError) {
	authData, nErr := a.Srv().Store().OAuth().GetAuthData(code)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
	}

	if authData.IsExpired() {
		if nErr = a.Srv().Store().OAuth().RemoveAuthData(authData.Code); nErr != nil {
			rctx.Logger().Warn("unable to remove auth data", mlog.Err(nErr))
		}
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusForbidden)
	}

	if authData.RedirectUri != redirectURI {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.redirect_uri.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.validatePKCE(oauthApp, authData, codeVerifier); err != nil {
		return nil, err
	}

	user, nErr := a.Srv().Store().User().Get(context.Background(), authData.UserId)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
	}

	if user.DeleteAt != 0 {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.expired_code.app_error", nil, "", http.StatusForbidden)
	}

	defer func() {
		if nErr = a.Srv().Store().OAuth().RemoveAuthData(authData.Code); nErr != nil {
			rctx.Logger().Warn("unable to remove auth data", mlog.Err(nErr))
		}
	}()

	var audience string
	if resource != "" {
		// Validate the resource parameter per RFC 8707
		if err := model.ValidateResourceParameter(resource, clientId, "handleAuthorizationCodeGrant"); err != nil {
			return nil, err
		}

		// Validate resource parameter consistency between authorization and token requests
		if authData.Resource != "" && resource != authData.Resource {
			return nil, model.NewAppError("handleAuthorizationCodeGrant", "api.oauth.get_access_token.resource_mismatch.app_error", nil, "client_id="+clientId, http.StatusBadRequest)
		}

		audience = resource
	} else if authData.Resource != "" {
		audience = authData.Resource // Use resource from authorization request
	}

	return a.generateAccessTokenResponse(rctx, oauthApp, user, clientId, redirectURI, authData.Scope, audience)
}

func (a *App) handleRefreshTokenGrant(rctx request.CTX, oauthApp *model.OAuthApp, refreshToken, resource string) (*model.AccessResponse, *model.AppError) {
	// Validate that this client can use refresh token grant type
	if err := oauthApp.ValidateForGrantType(model.RefreshTokenGrantType, oauthApp.ClientSecret, ""); err != nil {
		return nil, err
	}

	accessData, nErr := a.Srv().Store().OAuth().GetAccessDataByRefreshToken(refreshToken)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.refresh_token.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
	}

	user, nErr := a.Srv().Store().User().Get(context.Background(), accessData.UserId)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_user.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
	}

	audience := accessData.Audience // Default to existing audience
	if resource != "" {
		// Validate the resource parameter per RFC 8707
		if err := model.ValidateResourceParameter(resource, oauthApp.Id, "handleRefreshTokenGrant"); err != nil {
			return nil, err
		}

		// For refresh tokens, resource parameter must match the original audience
		if accessData.Audience != "" && resource != accessData.Audience {
			return nil, model.NewAppError("handleRefreshTokenGrant", "api.oauth.get_access_token.resource_mismatch.app_error", nil, "client_id="+oauthApp.Id, http.StatusBadRequest)
		}

		audience = resource
	}

	return a.newSessionUpdateToken(rctx, oauthApp, accessData, user, audience)
}

func (a *App) generateAccessTokenResponse(rctx request.CTX, oauthApp *model.OAuthApp, user *model.User, clientId, redirectURI, scope, audience string) (*model.AccessResponse, *model.AppError) {
	accessData, nErr := a.Srv().Store().OAuth().GetPreviousAccessData(user.Id, clientId)
	if nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
	}

	if accessData != nil {
		return a.handleExistingAccessData(rctx, oauthApp, accessData, user, audience)
	}

	return a.createNewAccessData(rctx, oauthApp, user, clientId, redirectURI, scope, audience)
}

func (a *App) handleExistingAccessData(rctx request.CTX, oauthApp *model.OAuthApp, accessData *model.AccessData, user *model.User, audience string) (*model.AccessResponse, *model.AppError) {
	if accessData.IsExpired() {
		return a.newSessionUpdateToken(rctx, oauthApp, accessData, user, audience)
	}

	refreshToken := accessData.RefreshToken
	if oauthApp.IsPublicClient() {
		refreshToken = ""
	}

	audienceStr := accessData.Audience

	return &model.AccessResponse{
		AccessToken:      accessData.Token,
		TokenType:        model.AccessTokenType,
		RefreshToken:     refreshToken,
		ExpiresInSeconds: int32((accessData.ExpiresAt - model.GetMillis()) / 1000),
		Audience:         audienceStr,
	}, nil
}

func (a *App) createNewAccessData(rctx request.CTX, oauthApp *model.OAuthApp, user *model.User, clientId, redirectURI, scope string, audience string) (*model.AccessResponse, *model.AppError) {
	session, err := a.newSession(rctx, oauthApp, user)
	if err != nil {
		return nil, err
	}

	refreshToken := ""
	if !oauthApp.IsPublicClient() {
		refreshToken = model.NewId()
	}

	accessData := &model.AccessData{
		ClientId:     clientId,
		UserId:       user.Id,
		Token:        session.Token,
		RefreshToken: refreshToken,
		RedirectUri:  redirectURI,
		ExpiresAt:    session.ExpiresAt,
		Scope:        scope,
		Audience:     audience,
	}

	if _, nErr := a.Srv().Store().OAuth().SaveAccessData(accessData); nErr != nil {
		return nil, model.NewAppError("GetOAuthAccessToken", "api.oauth.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	refreshTokenResponse := accessData.RefreshToken
	if oauthApp.IsPublicClient() {
		refreshTokenResponse = ""
	}

	audienceStr := audience

	return &model.AccessResponse{
		AccessToken:      session.Token,
		TokenType:        model.AccessTokenType,
		RefreshToken:     refreshTokenResponse,
		ExpiresInSeconds: int32(*a.Config().ServiceSettings.SessionLengthSSOInHours * 60 * 60),
		Audience:         audienceStr,
	}, nil
}

func (a *App) newSession(rctx request.CTX, app *model.OAuthApp, user *model.User) (*model.Session, *model.AppError) {
	if err := a.limitNumberOfSessions(rctx, user.Id); err != nil {
		return nil, model.NewAppError("newSession", "api.oauth.get_access_token.internal_session.app_error", nil,
			"", http.StatusInternalServerError).Wrap(err)
	}

	// Set new token an session
	session := &model.Session{UserId: user.Id, Roles: user.Roles, IsOAuth: true}
	session.GenerateCSRF()
	a.ch.srv.platform.SetSessionExpireInHours(session, *a.Config().ServiceSettings.SessionLengthSSOInHours)
	session.AddProp(model.SessionPropPlatform, app.Name)
	session.AddProp(model.SessionPropOAuthAppID, app.Id)
	session.AddProp(model.SessionPropMattermostAppID, app.MattermostAppID)
	session.AddProp(model.SessionPropOs, "OAuth2")
	session.AddProp(model.SessionPropBrowser, "OAuth2")

	session, err := a.Srv().Store().Session().Save(rctx, session)
	if err != nil {
		return nil, model.NewAppError("newSession", "api.oauth.get_access_token.internal_session.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.ch.srv.platform.AddSessionToCache(session); err != nil {
		rctx.Logger().Warn("Failed to add session to cache", mlog.Err(err))
	}

	return session, nil
}

func (a *App) newSessionUpdateToken(rctx request.CTX, app *model.OAuthApp, accessData *model.AccessData, user *model.User, audience string) (*model.AccessResponse, *model.AppError) {
	// Remove the previous session
	if err := a.Srv().Store().Session().Remove(accessData.Token); err != nil {
		rctx.Logger().Warn("error removing access data token from session", mlog.Err(err))
	}

	session, err := a.newSession(rctx, app, user)
	if err != nil {
		return nil, err
	}

	accessData.Token = session.Token
	// Generate refresh token only for confidential clients
	if !app.IsPublicClient() {
		accessData.RefreshToken = model.NewId()
	} else {
		accessData.RefreshToken = ""
	}
	accessData.ExpiresAt = session.ExpiresAt
	// Update audience if provided (for refresh token with resource parameter)
	if audience != "" {
		accessData.Audience = audience
	}

	if _, err := a.Srv().Store().OAuth().UpdateAccessData(accessData); err != nil {
		return nil, model.NewAppError("newSessionUpdateToken", "web.get_access_token.internal_saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	audienceStr := accessData.Audience

	accessRsp := &model.AccessResponse{
		AccessToken:      session.Token,
		RefreshToken:     accessData.RefreshToken,
		TokenType:        model.AccessTokenType,
		ExpiresInSeconds: int32(*a.Config().ServiceSettings.SessionLengthSSOInHours * 60 * 60),
		Audience:         audienceStr,
	}

	return accessRsp, nil
}

func (a *App) GetOAuthLoginEndpoint(rctx request.CTX, w http.ResponseWriter, r *http.Request, service, action, redirectTo, loginHint string, isMobile bool, desktopToken string, inviteToken string, inviteId string) (string, *model.AppError) {
	stateProps := map[string]string{}
	stateProps["action"] = action

	if inviteToken != "" {
		stateProps["invite_token"] = inviteToken
	} else if inviteId != "" {
		stateProps["invite_id"] = inviteId
	}

	if redirectTo != "" {
		stateProps["redirect_to"] = redirectTo
	}

	if desktopToken != "" {
		stateProps["desktop_token"] = desktopToken
	}

	stateProps[model.UserAuthServiceIsMobile] = strconv.FormatBool(isMobile)

	authURL, err := a.GetAuthorizationCode(rctx, w, r, service, stateProps, loginHint)
	if err != nil {
		return "", err
	}

	return authURL, nil
}

func (a *App) GetOAuthSignupEndpoint(rctx request.CTX, w http.ResponseWriter, r *http.Request, service, desktopToken string, inviteToken string, inviteId string) (string, *model.AppError) {
	stateProps := map[string]string{}
	stateProps["action"] = model.OAuthActionSignup

	if inviteToken != "" {
		stateProps["invite_token"] = inviteToken
	} else if inviteId != "" {
		stateProps["invite_id"] = inviteId
	}

	if desktopToken != "" {
		stateProps["desktop_token"] = desktopToken
	}

	authURL, err := a.GetAuthorizationCode(rctx, w, r, service, stateProps, "")
	if err != nil {
		return "", err
	}

	return authURL, nil
}

func (a *App) GetAuthorizedAppsForUser(userID string, page, perPage int) ([]*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetAuthorizedAppsForUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	apps, err := a.Srv().Store().OAuth().GetAuthorizedApps(userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetAuthorizedAppsForUser", "app.oauth.get_apps.find.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for k, a := range apps {
		a.Sanitize()
		apps[k] = a
	}

	return apps, nil
}

func (a *App) DeauthorizeOAuthAppForUser(rctx request.CTX, userID, appID string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	// Revoke app sessions
	accessData, err := a.Srv().Store().OAuth().GetAccessDataByUserForApp(userID, appID)
	if err != nil {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "app.oauth.get_access_data_by_user_for_app.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, ad := range accessData {
		if err := a.RevokeAccessToken(rctx, ad.Token); err != nil {
			return err
		}

		if err := a.Srv().Store().OAuth().RemoveAccessData(ad.Token); err != nil {
			return model.NewAppError("DeauthorizeOAuthAppForUser", "app.oauth.remove_access_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if err := a.Srv().Store().OAuth().RemoveAuthDataByClientId(appID, userID); err != nil {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "app.oauth.remove_auth_data_by_client_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Deauthorize the app
	if err := a.Srv().Store().Preference().Delete(userID, model.PreferenceCategoryAuthorizedOAuthApp, appID); err != nil {
		return model.NewAppError("DeauthorizeOAuthAppForUser", "app.preference.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) RegenerateOAuthAppSecret(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("RegenerateOAuthAppSecret", "api.oauth.allow_oauth.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	app.ClientSecret = model.NewId()
	if _, err := a.Srv().Store().OAuth().UpdateApp(app); err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("RegenerateOAuthAppSecret", "app.oauth.update_app.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("RegenerateOAuthAppSecret", "app.oauth.update_app.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return app, nil
}

func (a *App) RevokeAccessToken(rctx request.CTX, token string) *model.AppError {
	if err := a.ch.srv.platform.RevokeAccessToken(rctx, token); err != nil {
		switch {
		case errors.Is(err, platform.GetTokenError):
			return model.NewAppError("RevokeAccessToken", "api.oauth.revoke_access_token.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.Is(err, platform.DeleteTokenError):
			return model.NewAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_token.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		case errors.Is(err, platform.DeleteSessionError):
			return model.NewAppError("RevokeAccessToken", "api.oauth.revoke_access_token.del_session.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) CompleteOAuth(rctx request.CTX, service string, body io.ReadCloser, props map[string]string, tokenUser *model.User) (*model.User, *model.AppError) {
	defer body.Close()

	action := props["action"]

	// Extract invite token or ID from props so we can add the user to the team if needed
	inviteToken := props["invite_token"]
	inviteId := props["invite_id"]

	switch action {
	case model.OAuthActionSignup:
		return a.CreateOAuthUser(rctx, service, body, inviteToken, inviteId, tokenUser)
	case model.OAuthActionLogin:
		return a.LoginByOAuth(rctx, service, body, inviteToken, inviteId, tokenUser)
	case model.OAuthActionEmailToSSO:
		return a.CompleteSwitchWithOAuth(rctx, service, body, props["email"], tokenUser)
	case model.OAuthActionSSOToEmail:
		return a.LoginByOAuth(rctx, service, body, inviteToken, inviteId, tokenUser)
	default:
		return a.LoginByOAuth(rctx, service, body, inviteToken, inviteId, tokenUser)
	}
}

func (a *App) getSSOProvider(service string) (einterfaces.OAuthProvider, *model.AppError) {
	sso := a.Config().GetSSOService(service)
	if sso == nil || !*sso.Enable {
		return nil, model.NewAppError("getSSOProvider", "api.user.authorize_oauth_user.unsupported.app_error", nil, "service="+service, http.StatusNotImplemented)
	}
	providerType := service
	if strings.Contains(*sso.Scope, OpenIDScope) {
		providerType = model.ServiceOpenid
	}
	provider := einterfaces.GetOAuthProvider(providerType)
	if provider == nil {
		return nil, model.NewAppError("getSSOProvider", "api.user.login_by_oauth.not_available.app_error",
			map[string]any{"Service": strings.Title(service)}, "", http.StatusNotImplemented)
	}
	return provider, nil
}

func (a *App) LoginByOAuth(rctx request.CTX, service string, userData io.Reader, inviteToken string, inviteId string, tokenUser *model.User) (*model.User, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, e
	}

	buf := bytes.Buffer{}
	if _, err := buf.ReadFrom(userData); err != nil {
		return nil, model.NewAppError("LoginByOAuth2", "api.user.login_by_oauth.parse.app_error",
			map[string]any{"Service": service}, "", http.StatusBadRequest)
	}

	authUser, err1 := provider.GetUserFromJSON(rctx, bytes.NewReader(buf.Bytes()), tokenUser)
	if err1 != nil {
		return nil, model.NewAppError("LoginByOAuth", "api.user.login_by_oauth.parse.app_error",
			map[string]any{"Service": service}, "", http.StatusBadRequest).Wrap(err1)
	}

	if *authUser.AuthData == "" {
		return nil, model.NewAppError("LoginByOAuth3", "api.user.login_by_oauth.parse.app_error",
			map[string]any{"Service": service}, "", http.StatusBadRequest)
	}

	user, err := a.GetUserByAuth(model.NewPointer(*authUser.AuthData), service)
	if err != nil {
		if err.Id == MissingAuthAccountError {
			user, err = a.CreateOAuthUser(rctx, service, bytes.NewReader(buf.Bytes()), inviteToken, inviteId, tokenUser)
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

		if err = a.UpdateOAuthUserAttrs(rctx, bytes.NewReader(buf.Bytes()), user, provider, service, tokenUser); err != nil {
			return nil, err
		}

		if err = a.AddUserToTeamByInviteIfNeeded(rctx, user, inviteToken, inviteId); err != nil {
			rctx.Logger().Warn("Failed to add user to team", mlog.Err(err))
		}
	}

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (a *App) CompleteSwitchWithOAuth(rctx request.CTX, service string, userData io.Reader, email string, tokenUser *model.User) (*model.User, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, e
	}

	if email == "" {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.blank_email.app_error", nil, "", http.StatusBadRequest)
	}

	ssoUser, err1 := provider.GetUserFromJSON(rctx, userData, tokenUser)
	if err1 != nil {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]any{"Service": service}, "", http.StatusBadRequest).Wrap(err1)
	}

	if *ssoUser.AuthData == "" {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", "api.user.complete_switch_with_oauth.parse.app_error",
			map[string]any{"Service": service}, "", http.StatusBadRequest)
	}

	user, nErr := a.Srv().Store().User().GetByEmail(email)
	if nErr != nil {
		return nil, model.NewAppError("CompleteSwitchWithOAuth", MissingAccountError, nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	if err := a.RevokeAllSessions(rctx, user.Id); err != nil {
		return nil, err
	}

	if _, nErr := a.Srv().Store().User().UpdateAuthData(user.Id, service, ssoUser.AuthData, ssoUser.Email, true); nErr != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("importUser", "app.user.update_auth_data.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		default:
			return nil, model.NewAppError("importUser", "app.user.update_auth_data.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendSignInChangeEmail(user.Email, strings.Title(service)+" SSO", user.Locale, a.GetSiteURL()); err != nil {
			rctx.Logger().Error("error sending signin change email", mlog.Err(err))
		}
	})

	return user, nil
}

func (a *App) CreateOAuthStateToken(extra string) (*model.Token, *model.AppError) {
	token := model.NewToken(model.TokenTypeOAuth, extra)

	if err := a.Srv().Store().Token().Save(token); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateOAuthStateToken", "app.recover.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return token, nil
}

func (a *App) GetOAuthStateToken(token string) (*model.Token, *model.AppError) {
	mToken, err := a.Srv().Store().Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetOAuthStateToken", "api.oauth.invalid_state_token.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if mToken.Type != model.TokenTypeOAuth {
		return nil, model.NewAppError("GetOAuthStateToken", "api.oauth.invalid_state_token.app_error", nil, "", http.StatusBadRequest)
	}

	return mToken, nil
}

func (a *App) GetAuthorizationCode(rctx request.CTX, w http.ResponseWriter, r *http.Request, service string, props map[string]string, loginHint string) (string, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return "", e
	}

	sso, e2 := provider.GetSSOSettings(rctx, a.Config(), service)
	if e2 != nil {
		return "", model.NewAppError("GetAuthorizationCode.GetSSOSettings", "api.user.get_authorization_code.endpoint.app_error", nil, "", http.StatusNotImplemented).Wrap(e2)
	}

	secure := false
	if GetProtocol(r) == "https" {
		secure = true
	}

	cookieValue := model.NewId()
	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	expiresAt := time.Unix(model.GetMillis()/1000+int64(OAuthCookieMaxAgeSeconds), 0)
	oauthCookie := &http.Cookie{
		Name:     CookieOAuth,
		Value:    cookieValue,
		Path:     subpath,
		MaxAge:   OAuthCookieMaxAgeSeconds,
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
	state := b64.StdEncoding.EncodeToString([]byte(model.MapToJSON(props)))

	siteURL := a.GetSiteURL()
	if strings.TrimSpace(siteURL) == "" {
		siteURL = GetProtocol(r) + "://" + r.Host
	}

	redirectURI := siteURL + "/signup/" + service + "/complete"

	authURL := endpoint + "?response_type=code&client_id=" + clientId + "&redirect_uri=" + url.QueryEscape(redirectURI) + "&state=" + url.QueryEscape(state)

	if scope != "" {
		authURL += "&scope=" + utils.URLEncode(scope)
	}

	if loginHint != "" {
		authURL += "&login_hint=" + utils.URLEncode(loginHint)
	}

	return authURL, nil
}

func (a *App) AuthorizeOAuthUser(rctx request.CTX, w http.ResponseWriter, r *http.Request, service, code, state, redirectURI string) (io.ReadCloser, map[string]string, *model.User, *model.AppError) {
	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, nil, nil, e
	}

	sso, e2 := provider.GetSSOSettings(rctx, a.Config(), service)
	if e2 != nil {
		return nil, nil, nil, model.NewAppError("AuthorizeOAuthUser.GetSSOSettings", "api.user.get_authorization_code.endpoint.app_error", nil, "", http.StatusNotImplemented).Wrap(e2)
	}

	b, strErr := b64.StdEncoding.DecodeString(state)
	if strErr != nil {
		return nil, nil, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest).Wrap(strErr)
	}

	stateStr := string(b)
	stateProps := model.MapFromJSON(strings.NewReader(stateStr))

	expectedToken, appErr := a.GetOAuthStateToken(stateProps["token"])
	if appErr != nil {
		return nil, stateProps, nil, appErr
	}

	stateEmail := stateProps["email"]
	stateAction := stateProps["action"]
	if stateAction == model.OAuthActionEmailToSSO && stateEmail == "" {
		err := errors.New("No email provided in state when trying to switch from email to SSO")
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	cookie, cookieErr := r.Cookie(CookieOAuth)
	if cookieErr != nil {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest).Wrap(cookieErr)
	}

	tokenEmail, tokenAction, tokenCookie, parseErr := parseOAuthStateTokenExtra(expectedToken.Extra)
	if parseErr != nil {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest).Wrap(parseErr)
	}

	if tokenEmail != stateEmail || tokenAction != stateAction || tokenCookie != cookie.Value {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusBadRequest).Wrap(errors.New("invalid state token"))
	}

	appErr = a.DeleteToken(expectedToken)
	if appErr != nil {
		rctx.Logger().Warn("error deleting token", mlog.Err(appErr))
	}

	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	httpCookie := &http.Cookie{
		Name:     CookieOAuth,
		Value:    "",
		Path:     subpath,
		MaxAge:   -1,
		HttpOnly: true,
	}

	http.SetCookie(w, httpCookie)

	p := url.Values{}
	p.Set("client_id", *sso.Id)
	p.Set("client_secret", *sso.Secret)
	p.Set("code", code)
	p.Set("grant_type", model.AccessTokenGrantType)
	p.Set("redirect_uri", redirectURI)

	req, requestErr := http.NewRequest("POST", *sso.TokenEndpoint, strings.NewReader(p.Encode()))
	if requestErr != nil {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, "", http.StatusInternalServerError).Wrap(requestErr)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := a.HTTPService().MakeClient(true).Do(req)
	if err != nil {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer resp.Body.Close()

	var buf bytes.Buffer
	tee := io.TeeReader(resp.Body, &buf)
	var ar *model.AccessResponse
	err = json.NewDecoder(tee).Decode(&ar)
	if err != nil || resp.StatusCode != http.StatusOK {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_response.app_error", nil, fmt.Sprintf("response_body=%s, status_code=%d, error=%v", buf.String(), resp.StatusCode, err), http.StatusInternalServerError).Wrap(err)
	}

	if strings.ToLower(ar.TokenType) != model.AccessTokenType {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.bad_token.app_error", nil, "token_type="+ar.TokenType+", response_body="+buf.String(), http.StatusInternalServerError)
	}

	if ar.AccessToken == "" {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.missing.app_error", nil, "response_body="+buf.String(), http.StatusInternalServerError)
	}

	p = url.Values{}
	p.Set("access_token", ar.AccessToken)

	var userFromToken *model.User
	if ar.IdToken != "" {
		userFromToken, err = provider.GetUserFromIdToken(rctx, ar.IdToken)
		if err != nil {
			return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.token_failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	req, requestErr = http.NewRequest("GET", *sso.UserAPIEndpoint, strings.NewReader(""))
	if requestErr != nil {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error", map[string]any{"Service": service}, "", http.StatusInternalServerError).Wrap(requestErr)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+ar.AccessToken)

	resp, err = a.HTTPService().MakeClient(true).Do(req)
	if err != nil {
		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.service.app_error", map[string]any{"Service": service}, "", http.StatusInternalServerError).Wrap(err)
	} else if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()

		// Ignore the error below because the resulting string will just be the empty string if bodyBytes is nil
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyString := string(bodyBytes)

		rctx.Logger().Error("Error getting OAuth user", mlog.Int("response", resp.StatusCode), mlog.String("body_string", bodyString))

		if service == model.ServiceGitlab && resp.StatusCode == http.StatusForbidden && strings.Contains(bodyString, "Terms of Service") {
			url, err := url.Parse(*sso.UserAPIEndpoint)
			if err != nil {
				return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(errors.Wrapf(err, "error parsing %s", *sso.UserAPIEndpoint))
			}
			// Return a nicer error when the user hasn't accepted GitLab's terms of service
			return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "oauth.gitlab.tos.error", map[string]any{"URL": url.Hostname()}, "", http.StatusBadRequest)
		}

		return nil, stateProps, nil, model.NewAppError("AuthorizeOAuthUser", "api.user.authorize_oauth_user.response.app_error", nil, "response_body="+bodyString, http.StatusInternalServerError)
	}

	// Note that resp.Body is not closed here, so it must be closed by the caller
	return resp.Body, stateProps, userFromToken, nil
}

func (a *App) SwitchEmailToOAuth(rctx request.CTX, w http.ResponseWriter, r *http.Request, email, password, code, service string) (string, *model.AppError) {
	if a.Srv().License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("emailToOAuth", "api.user.email_to_oauth.not_available.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if err = a.CheckPasswordAndAllCriteria(rctx, user.Id, password, code); err != nil {
		return "", err
	}

	stateProps := map[string]string{}
	stateProps["action"] = model.OAuthActionEmailToSSO
	stateProps["email"] = email

	if service == model.UserAuthServiceSaml {
		samlToken, samlErr := a.CreateSamlRelayToken(model.TokenTypeSaml, email)
		if samlErr != nil {
			return "", samlErr
		}

		return a.GetSiteURL() + "/login/sso/saml?action=" + model.OAuthActionEmailToSSO + "&email_token=" + utils.URLEncode(samlToken.Token), nil
	}

	authURL, err := a.GetAuthorizationCode(rctx, w, r, service, stateProps, "")
	if err != nil {
		return "", err
	}

	return authURL, nil
}

func (a *App) SwitchOAuthToEmail(rctx request.CTX, email, password, requesterId string) (string, *model.AppError) {
	if a.Srv().License() != nil && !*a.Config().ServiceSettings.ExperimentalEnableAuthenticationTransfer {
		return "", model.NewAppError("oauthToEmail", "api.user.oauth_to_email.not_available.app_error", nil, "", http.StatusForbidden)
	}

	if !*a.Config().EmailSettings.EnableSignUpWithEmail {
		return "", model.NewAppError("SwitchOAuthToEmail", "api.user.auth_switch.not_available.email_signup_disabled.app_error", nil, "", http.StatusForbidden)
	}

	if !*a.Config().EmailSettings.EnableSignInWithEmail && !*a.Config().EmailSettings.EnableSignInWithUsername {
		return "", model.NewAppError("SwitchOAuthToEmail", "api.user.auth_switch.not_available.login_disabled.app_error", nil, "", http.StatusForbidden)
	}

	user, err := a.GetUserByEmail(email)
	if err != nil {
		return "", err
	}

	if user.Id != requesterId {
		return "", model.NewAppError("SwitchOAuthToEmail", "api.user.oauth_to_email.context.app_error", nil, "", http.StatusForbidden)
	}

	if err := a.UpdatePassword(rctx, user, password); err != nil {
		return "", err
	}

	T := i18n.GetUserTranslations(user.Locale)

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendSignInChangeEmail(user.Email, T("api.templates.signin_change_email.body.method_email"), user.Locale, a.GetSiteURL()); err != nil {
			rctx.Logger().Error("error sending signin change email", mlog.Err(err))
		}
	})

	if err := a.RevokeAllSessions(rctx, requesterId); err != nil {
		return "", err
	}

	return "/login?extra=signin_change", nil
}

func generateOAuthStateTokenExtra(email, action, cookie string) string {
	return email + ":" + action + ":" + cookie
}

func (a *App) GetAuthorizationServerMetadata(rctx request.CTX) (*model.AuthorizationServerMetadata, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("GetAuthorizationServerMetadata", "api.oauth.authorization_server_metadata.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	siteURL := *a.Config().ServiceSettings.SiteURL
	if siteURL == "" {
		return nil, model.NewAppError("GetAuthorizationServerMetadata", "api.oauth.authorization_server_metadata.site_url_required.app_error", nil, "", http.StatusInternalServerError)
	}

	metadata, err := model.GetDefaultMetadata(siteURL)
	if err != nil {
		return nil, model.NewAppError("GetAuthorizationServerMetadata", "api.oauth.authorization_server_metadata.invalid_url.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if a.Config().ServiceSettings.EnableDynamicClientRegistration != nil && *a.Config().ServiceSettings.EnableDynamicClientRegistration {
		metadata.RegistrationEndpoint, err = url.JoinPath(siteURL, model.OAuthAppsRegisterEndpoint)
		if err != nil {
			return nil, model.NewAppError("GetAuthorizationServerMetadata", "api.oauth.authorization_server_metadata.invalid_url.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return metadata, nil
}

func (a *App) RegisterOAuthClient(rctx request.CTX, req *model.ClientRegistrationRequest, userID string) (*model.OAuthApp, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableOAuthServiceProvider {
		return nil, model.NewAppError("RegisterOAuthClient", "api.oauth.register_oauth_app.turn_off.app_error", nil, "", http.StatusNotImplemented)
	}

	app := model.NewOAuthAppFromClientRegistration(req, userID)

	oauthApp, err := a.Srv().Store().OAuth().SaveApp(app)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput

		a.Log().Error("Error saving OAuth app via DCR", mlog.Err(err), mlog.String("name", app.Name))

		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("RegisterOAuthClient", "app.oauth.save_app.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("RegisterOAuthClient", "app.oauth.save_app.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return oauthApp, nil
}

// parseOAuthStateTokenExtra parses a token extra string in the format "email:action:cookie".
// Returns an error if the token does not contain exactly 3 colon-separated parts.
func parseOAuthStateTokenExtra(tokenExtra string) (email, action, cookie string, err error) {
	parts := strings.Split(tokenExtra, ":")
	if len(parts) != 3 {
		return "", "", "", fmt.Errorf("invalid token format: expected exactly 3 parts separated by ':', got %d", len(parts))
	}

	email = parts[0]
	action = parts[1]
	cookie = parts[2]

	return email, action, cookie, nil
}
