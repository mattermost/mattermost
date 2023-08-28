// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"math"
	"net/http"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) CreateSession(session *model.Session) (*model.Session, *model.AppError) {
	session, err := a.ch.srv.platform.CreateSession(session)
	if err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateSession", "app.session.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateSession", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return session, nil
}

func (a *App) GetCloudSession(token string) (*model.Session, *model.AppError) {
	apiKey := os.Getenv("MM_CLOUD_API_KEY")
	if apiKey != "" && apiKey == token {
		// Need a bare-bones session object for later checks
		session := &model.Session{
			Token:   token,
			IsOAuth: false,
		}

		session.AddProp(model.SessionPropType, model.SessionTypeCloudKey)
		return session, nil
	}
	return nil, model.NewAppError("GetCloudSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "The provided token is invalid", http.StatusUnauthorized)
}

func (a *App) GetRemoteClusterSession(token string, remoteId string) (*model.Session, *model.AppError) {
	rc, appErr := a.GetRemoteCluster(remoteId)
	if appErr == nil && rc.Token == token {
		// Need a bare-bones session object for later checks
		session := &model.Session{
			Token:   token,
			IsOAuth: false,
		}

		session.AddProp(model.SessionPropType, model.SessionTypeRemoteclusterToken)
		return session, nil
	}
	return nil, model.NewAppError("GetRemoteClusterSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "The provided token is invalid", http.StatusUnauthorized)
}

func (a *App) GetSession(token string) (*model.Session, *model.AppError) {
	var session *model.Session
	// We intentionally skip the error check here, we only want to check if the token is valid.
	// If we don't have the session we are going to create one with the token eventually.
	if session, _ = a.ch.srv.platform.GetSession(token); session != nil {
		if session.Token != token {
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "session token is different from the one in DB", http.StatusUnauthorized)
		}

		if !session.IsExpired() {
			a.ch.srv.platform.AddSessionToCache(session)
		}
	}

	var appErr *model.AppError
	if session == nil || session.Id == "" {
		session, appErr = a.createSessionForUserAccessToken(token)
		if appErr != nil {
			detailedError := ""
			statusCode := http.StatusUnauthorized
			if appErr.Id != "app.user_access_token.invalid_or_missing" {
				detailedError = appErr.Error()
				statusCode = appErr.StatusCode
			} else {
				mlog.Warn("Error while creating session for user access token", mlog.Err(appErr))
			}
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": detailedError}, "", statusCode)
		}
	}

	if session.Id == "" || session.IsExpired() {
		return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "session is either nil or expired", http.StatusUnauthorized)
	}

	if *a.Config().ServiceSettings.SessionIdleTimeoutInMinutes > 0 &&
		!session.IsOAuth && !session.IsMobileApp() &&
		session.Props[model.SessionPropType] != model.SessionTypeUserAccessToken &&
		!*a.Config().ServiceSettings.ExtendSessionLengthWithActivity {

		timeout := int64(*a.Config().ServiceSettings.SessionIdleTimeoutInMinutes) * 1000 * 60
		if (model.GetMillis() - session.LastActivityAt) > timeout {
			// Revoking the session is an asynchronous task anyways since we are not checking
			// for the return value of the call before returning the error.
			// So moving this to a goroutine has 2 advantages:
			// 1. We are treating this as a proper asynchronous task.
			// 2. This also fixes a race condition in the web hub, where GetSession
			// gets called from (*WebConn).isMemberOfTeam and revoking a session involves
			// clearing the webconn cache, which needs the hub again.
			a.Srv().Go(func() {
				err := a.RevokeSessionById(session.Id)
				if err != nil {
					mlog.Warn("Error while revoking session", mlog.Err(err))
				}
			})
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]any{"Token": token, "Error": ""}, "idle timeout", http.StatusUnauthorized)
		}
	}

	return session, nil
}

func (a *App) GetSessions(userID string) ([]*model.Session, *model.AppError) {
	sessions, err := a.ch.srv.platform.GetSessions(userID)
	if err != nil {
		return nil, model.NewAppError("GetSessions", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return sessions, nil
}

func (a *App) RevokeAllSessions(userID string) *model.AppError {
	if err := a.ch.srv.platform.RevokeAllSessions(userID); err != nil {
		switch {
		case errors.Is(err, platform.GetSessionError):
			return model.NewAppError("RevokeAllSessions", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		case errors.Is(err, platform.DeleteSessionError):
			return model.NewAppError("RevokeAllSessions", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return model.NewAppError("RevokeAllSessions", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) AddSessionToCache(session *model.Session) {
	a.ch.srv.platform.AddSessionToCache(session)
}

// RevokeSessionsFromAllUsers will go through all the sessions active
// in the server and revoke them
func (a *App) RevokeSessionsFromAllUsers() *model.AppError {
	if err := a.ch.srv.platform.RevokeSessionsFromAllUsers(); err != nil {
		switch {
		case errors.Is(err, users.DeleteAllAccessDataError):
			return model.NewAppError("RevokeSessionsFromAllUsers", "app.oauth.remove_access_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return model.NewAppError("RevokeSessionsFromAllUsers", "app.session.remove_all_sessions_for_team.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) ReturnSessionToPool(session *model.Session) {
	a.ch.srv.platform.ReturnSessionToPool(session)
}

func (a *App) ClearSessionCacheForUser(userID string) {
	a.ch.srv.platform.ClearUserSessionCache(userID)
}

func (a *App) ClearSessionCacheForAllUsers() {
	a.ch.srv.platform.ClearAllUsersSessionCache()
}

func (a *App) ClearSessionCacheForUserSkipClusterSend(userID string) {
	a.Srv().Platform().ClearSessionCacheForUserSkipClusterSend(userID)
}

func (a *App) ClearSessionCacheForAllUsersSkipClusterSend() {
	a.Srv().Platform().ClearSessionCacheForAllUsersSkipClusterSend()
}

func (a *App) RevokeSessionsForDeviceId(userID string, deviceID string, currentSessionId string) *model.AppError {
	if err := a.ch.srv.platform.RevokeSessionsForDeviceId(userID, deviceID, currentSessionId); err != nil {
		return model.NewAppError("RevokeSessionsForDeviceId", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetSessionById(sessionID string) (*model.Session, *model.AppError) {
	session, err := a.ch.srv.platform.GetSessionByID(sessionID)
	if err != nil {
		return nil, model.NewAppError("GetSessionById", "app.session.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return session, nil
}

func (a *App) RevokeSessionById(sessionID string) *model.AppError {
	session, err := a.GetSessionById(sessionID)
	if err != nil {
		return model.NewAppError("RevokeSessionById", "app.session.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return a.RevokeSession(session)

}

func (a *App) RevokeSession(session *model.Session) *model.AppError {
	if err := a.ch.srv.platform.RevokeSession(session); err != nil {
		switch {
		case errors.Is(err, platform.DeleteSessionError):
			return model.NewAppError("RevokeSession", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return model.NewAppError("RevokeSession", "app.session.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) AttachDeviceId(sessionID string, deviceID string, expiresAt int64) *model.AppError {
	_, err := a.Srv().Store().Session().UpdateDeviceId(sessionID, deviceID, expiresAt)
	if err != nil {
		return model.NewAppError("AttachDeviceId", "app.session.update_device_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// ExtendSessionExpiryIfNeeded extends Session.ExpiresAt based on session lengths in config.
// A new ExpiresAt is only written if enough time has elapsed since last update.
// Returns true only if the session was extended.
func (a *App) ExtendSessionExpiryIfNeeded(session *model.Session) bool {
	if !*a.Config().ServiceSettings.ExtendSessionLengthWithActivity {
		return false
	}

	if session == nil || session.IsExpired() {
		return false
	}

	sessionLength := a.GetSessionLengthInMillis(session)

	// Only extend the expiry if the lessor of 1% or 1 day has elapsed within the
	// current session duration.
	threshold := int64(math.Min(float64(sessionLength)*0.01, float64(model.DayInMilliseconds)))
	// Minimum session length is 1 day as of this writing, therefore a minimum ~14 minutes threshold.
	// However we'll add a sanity check here in case that changes. Minimum 5 minute threshold,
	// meaning we won't write a new expiry more than every 5 minutes.
	if threshold < 5*60*1000 {
		threshold = 5 * 60 * 1000
	}

	now := model.GetMillis()
	elapsed := now - (session.ExpiresAt - sessionLength)
	if elapsed < threshold {
		return false
	}

	auditRec := a.MakeAuditRecord("extendSessionExpiry", audit.Fail)
	defer a.LogAuditRec(auditRec, nil)
	auditRec.AddEventPriorState(session)

	newExpiry := now + sessionLength
	if err := a.ch.srv.platform.ExtendSessionExpiry(session, newExpiry); err != nil {
		mlog.Error("Failed to update ExpiresAt", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
		auditRec.AddMeta("err", err.Error())
		return false
	}

	mlog.Debug("Session extended", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id),
		mlog.Int64("newExpiry", newExpiry), mlog.Int64("session_length", sessionLength))

	auditRec.Success()
	auditRec.AddEventResultState(session)
	return true
}

// GetSessionLengthInMillis returns the session length, in milliseconds,
// based on the type of session (Mobile, SSO, Web/LDAP).
func (a *App) GetSessionLengthInMillis(session *model.Session) int64 {
	if session == nil {
		return 0
	}

	var hours int
	if session.IsMobileApp() {
		hours = *a.Config().ServiceSettings.SessionLengthMobileInHours
	} else if session.IsSSOLogin() {
		hours = *a.Config().ServiceSettings.SessionLengthSSOInHours
	} else {
		hours = *a.Config().ServiceSettings.SessionLengthWebInHours
	}
	return int64(hours * 60 * 60 * 1000)
}

// SetSessionExpireInHours sets the session's expiry the specified number of hours
// relative to either the session creation date or the current time, depending
// on the `ExtendSessionOnActivity` config setting.
func (a *App) SetSessionExpireInHours(session *model.Session, hours int) {
	a.ch.srv.platform.SetSessionExpireInHours(session, hours)
}

func (a *App) CreateUserAccessToken(token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError) {
	user, nErr := a.ch.srv.userService.GetUser(token.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateUserAccessToken", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreateUserAccessToken", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if !*a.Config().ServiceSettings.EnableUserAccessTokens && !user.IsBot {
		return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.disabled", nil, "", http.StatusNotImplemented)
	}

	token.Token = model.NewId()

	token, nErr = a.Srv().Store().UserAccessToken().Save(token)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// Don't send emails to bot users.
	if !user.IsBot {
		if err := a.Srv().EmailService.SendUserAccessTokenAddedEmail(user.Email, user.Locale, a.GetSiteURL()); err != nil {
			a.Log().Error("Unable to send user access token added email", mlog.Err(err), mlog.String("user_id", user.Id))
		}
	}

	return token, nil

}

func (a *App) createSessionForUserAccessToken(tokenString string) (*model.Session, *model.AppError) {
	token, nErr := a.Srv().Store().UserAccessToken().GetByToken(tokenString)
	if nErr != nil {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "", http.StatusUnauthorized).Wrap(nErr)
	}

	if !token.IsActive {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "inactive_token", http.StatusUnauthorized)
	}

	user, nErr := a.Srv().Store().User().Get(context.Background(), token.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("createSessionForUserAccessToken", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("createSessionForUserAccessToken", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if !*a.Config().ServiceSettings.EnableUserAccessTokens && !user.IsBot {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "EnableUserAccessTokens=false", http.StatusUnauthorized)
	}

	if user.DeleteAt != 0 {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "inactive_user_id="+user.Id, http.StatusUnauthorized)
	}

	session := &model.Session{
		Token:   token.Token,
		UserId:  user.Id,
		Roles:   user.GetRawRoles(),
		IsOAuth: false,
	}

	session.AddProp(model.SessionPropUserAccessTokenId, token.Id)
	session.AddProp(model.SessionPropType, model.SessionTypeUserAccessToken)
	if user.IsBot {
		session.AddProp(model.SessionPropIsBot, model.SessionPropIsBotValue)
	}
	if user.IsGuest() {
		session.AddProp(model.SessionPropIsGuest, "true")
	} else {
		session.AddProp(model.SessionPropIsGuest, "false")
	}
	a.ch.srv.platform.SetSessionExpireInHours(session, model.SessionUserAccessTokenExpiryHours)

	session, nErr = a.Srv().Store().Session().Save(session)
	if nErr != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("CreateSession", "app.session.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreateSession", "app.session.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	a.ch.srv.platform.AddSessionToCache(session)

	return session, nil

}

func (a *App) RevokeUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.ch.srv.platform.GetSessionContext(context.Background(), token.Token)

	if err := a.Srv().Store().UserAccessToken().Delete(token.Id); err != nil {
		return model.NewAppError("RevokeUserAccessToken", "app.user_access_token.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(session)
}

func (a *App) DisableUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.ch.srv.platform.GetSessionContext(context.Background(), token.Token)

	if err := a.Srv().Store().UserAccessToken().UpdateTokenDisable(token.Id); err != nil {
		return model.NewAppError("DisableUserAccessToken", "app.user_access_token.update_token_disable.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(session)
}

func (a *App) EnableUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.ch.srv.platform.GetSessionContext(context.Background(), token.Token)

	err := a.Srv().Store().UserAccessToken().UpdateTokenEnable(token.Id)
	if err != nil {
		return model.NewAppError("EnableUserAccessToken", "app.user_access_token.update_token_enable.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if session == nil {
		return nil
	}

	return nil
}

func (a *App) GetUserAccessTokens(page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv().Store().UserAccessToken().GetAll(page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetUserAccessTokens", "app.user_access_token.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, token := range tokens {
		token.Token = ""
	}

	return tokens, nil
}

func (a *App) GetUserAccessTokensForUser(userID string, page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv().Store().UserAccessToken().GetByUser(userID, page*perPage, perPage)
	if err != nil {
		return nil, model.NewAppError("GetUserAccessTokensForUser", "app.user_access_token.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, token := range tokens {
		token.Token = ""
	}

	return tokens, nil

}

func (a *App) GetUserAccessToken(tokenID string, sanitize bool) (*model.UserAccessToken, *model.AppError) {
	token, err := a.Srv().Store().UserAccessToken().Get(tokenID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserAccessToken", "app.user_access_token.get_by_user.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserAccessToken", "app.user_access_token.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if sanitize {
		token.Token = ""
	}
	return token, nil
}

func (a *App) SearchUserAccessTokens(term string) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv().Store().UserAccessToken().Search(term)
	if err != nil {
		return nil, model.NewAppError("SearchUserAccessTokens", "app.user_access_token.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, token := range tokens {
		token.Token = ""
	}
	return tokens, nil
}
