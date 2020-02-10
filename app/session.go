// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) CreateSession(session *model.Session) (*model.Session, *model.AppError) {
	session.Token = ""

	session, err := a.Srv.Store.Session().Save(session)
	if err != nil {
		return nil, err
	}

	a.AddSessionToCache(session)

	return session, nil
}

func (a *App) GetSession(token string) (*model.Session, *model.AppError) {
	metrics := a.Metrics

	var session *model.Session
	var err *model.AppError
	if ts, ok := a.Srv.sessionCache.Get(token); ok {
		session = ts.(*model.Session)
		if metrics != nil {
			metrics.IncrementMemCacheHitCounterSession()
		}
	} else {
		if metrics != nil {
			metrics.IncrementMemCacheMissCounterSession()
		}
	}

	if session == nil {
		if session, err = a.Srv.Store.Session().Get(token); err == nil {
			if session != nil {
				if session.Token != token {
					return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token, "Error": ""}, "", http.StatusUnauthorized)
				}

				if !session.IsExpired() {
					a.AddSessionToCache(session)
				}
			}
		} else if err.StatusCode == http.StatusInternalServerError {
			return nil, err
		}
	}

	if session == nil {
		session, err = a.createSessionForUserAccessToken(token)
		if err != nil {
			detailedError := ""
			statusCode := http.StatusUnauthorized
			if err.Id != "app.user_access_token.invalid_or_missing" {
				detailedError = err.Error()
				statusCode = err.StatusCode
			}
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token}, detailedError, statusCode)
		}
	}

	if session == nil || session.IsExpired() {
		return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token}, "", http.StatusUnauthorized)
	}

	if *a.Config().ServiceSettings.SessionIdleTimeoutInMinutes > 0 &&
		!session.IsOAuth &&
		session.Props[model.SESSION_PROP_TYPE] != model.SESSION_TYPE_USER_ACCESS_TOKEN {

		timeout := int64(*a.Config().ServiceSettings.SessionIdleTimeoutInMinutes) * 1000 * 60
		if (model.GetMillis() - session.LastActivityAt) > timeout {
			a.RevokeSessionById(session.Id)
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token}, "idle timeout", http.StatusUnauthorized)
		}
	}

	return session, nil
}

func (a *App) GetSessions(userId string) ([]*model.Session, *model.AppError) {

	return a.Srv.Store.Session().GetSessions(userId)
}

func (a *App) UpdateSessionsIsGuest(userId string, isGuest bool) {
	sessions, err := a.Srv.Store.Session().GetSessions(userId)
	if err != nil {
		mlog.Error("Unable to get user sessions", mlog.String("user_id", userId), mlog.Err(err))
	}

	for _, session := range sessions {
		if isGuest {
			session.AddProp(model.SESSION_PROP_IS_GUEST, "true")
		} else {
			session.AddProp(model.SESSION_PROP_IS_GUEST, "false")
		}
		err := a.Srv.Store.Session().UpdateProps(session)
		if err != nil {
			mlog.Error("Unable to update isGuest session", mlog.Err(err))
			continue
		}
		a.AddSessionToCache(session)
	}
}

func (a *App) RevokeAllSessions(userId string) *model.AppError {
	sessions, err := a.Srv.Store.Session().GetSessions(userId)
	if err != nil {
		return err
	}
	for _, session := range sessions {
		if session.IsOAuth {
			a.RevokeAccessToken(session.Token)
		} else {
			if err := a.Srv.Store.Session().Remove(session.Id); err != nil {
				return err
			}
		}
	}

	a.ClearSessionCacheForUser(userId)

	return nil
}

// RevokeSessionsFromAllUsers will go through all the sessions active
// in the server and revoke them
func (a *App) RevokeSessionsFromAllUsers() *model.AppError {
	// revoke tokens before sessions so they can't be used to relogin
	tErr := a.Srv.Store.OAuth().RemoveAllAccessData()
	if tErr != nil {
		return tErr
	}
	err := a.Srv.Store.Session().RemoveAllSessions()
	if err != nil {
		return err
	}
	a.ClearSessionCacheForAllUsers()

	return nil
}

func (a *App) ClearSessionCacheForUser(userId string) {
	a.ClearSessionCacheForUserSkipClusterSend(userId)

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER,
			SendType: model.CLUSTER_SEND_RELIABLE,
			Data:     userId,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) ClearSessionCacheForAllUsers() {
	a.ClearSessionCacheForAllUsersSkipClusterSend()

	if a.Cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_ALL_USERS,
			SendType: model.CLUSTER_SEND_RELIABLE,
		}
		a.Cluster.SendClusterMessage(msg)
	}
}

func (a *App) ClearSessionCacheForUserSkipClusterSend(userId string) {
	keys := a.Srv.sessionCache.Keys()

	for _, key := range keys {
		if ts, ok := a.Srv.sessionCache.Get(key); ok {
			session := ts.(*model.Session)
			if session.UserId == userId {
				a.Srv.sessionCache.Remove(key)
				if a.Metrics != nil {
					a.Metrics.IncrementMemCacheInvalidationCounterSession()
				}
			}
		}
	}

	a.InvalidateWebConnSessionCacheForUser(userId)
}

func (a *App) ClearSessionCacheForAllUsersSkipClusterSend() {
	mlog.Info("Purging sessions cache")
	a.Srv.sessionCache.Purge()
}

func (a *App) AddSessionToCache(session *model.Session) {
	a.Srv.sessionCache.AddWithExpiresInSecs(session.Token, session, int64(*a.Config().ServiceSettings.SessionCacheInMinutes*60))
}

func (a *App) SessionCacheLength() int {
	return a.Srv.sessionCache.Len()
}

func (a *App) RevokeSessionsForDeviceId(userId string, deviceId string, currentSessionId string) *model.AppError {
	sessions, err := a.Srv.Store.Session().GetSessions(userId)
	if err != nil {
		return err
	}
	for _, session := range sessions {
		if session.DeviceId == deviceId && session.Id != currentSessionId {
			mlog.Debug("Revoking sessionId for userId. Re-login with the same device Id", mlog.String("session_id", session.Id), mlog.String("user_id", userId))
			if err := a.RevokeSession(session); err != nil {
				// Soft error so we still remove the other sessions
				mlog.Error(err.Error())
			}
		}
	}

	return nil
}

func (a *App) GetSessionById(sessionId string) (*model.Session, *model.AppError) {
	session, err := a.Srv.Store.Session().Get(sessionId)
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, err
	}
	return session, nil
}

func (a *App) RevokeSessionById(sessionId string) *model.AppError {
	session, err := a.Srv.Store.Session().Get(sessionId)
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return err
	}
	return a.RevokeSession(session)

}

func (a *App) RevokeSession(session *model.Session) *model.AppError {
	if session.IsOAuth {
		if err := a.RevokeAccessToken(session.Token); err != nil {
			return err
		}
	} else {
		if err := a.Srv.Store.Session().Remove(session.Id); err != nil {
			return err
		}
	}

	a.ClearSessionCacheForUser(session.UserId)

	return nil
}

func (a *App) AttachDeviceId(sessionId string, deviceId string, expiresAt int64) *model.AppError {
	_, err := a.Srv.Store.Session().UpdateDeviceId(sessionId, deviceId, expiresAt)
	if err != nil {
		return err
	}

	return nil
}

func (a *App) UpdateLastActivityAtIfNeeded(session model.Session) {
	now := model.GetMillis()

	a.UpdateWebConnUserActivity(session, now)

	if now-session.LastActivityAt < model.SESSION_ACTIVITY_TIMEOUT {
		return
	}

	if err := a.Srv.Store.Session().UpdateLastActivityAt(session.Id, now); err != nil {
		mlog.Error("Failed to update LastActivityAt", mlog.String("user_id", session.UserId), mlog.String("session_id", session.Id), mlog.Err(err))
	}

	session.LastActivityAt = now
	a.AddSessionToCache(&session)
}

func (a *App) CreateUserAccessToken(token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError) {

	user, err := a.Srv.Store.User().Get(token.UserId)
	if err != nil {
		return nil, err
	}

	if !*a.Config().ServiceSettings.EnableUserAccessTokens && !user.IsBot {
		return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.disabled", nil, "", http.StatusNotImplemented)
	}

	token.Token = model.NewId()

	token, err = a.Srv.Store.UserAccessToken().Save(token)
	if err != nil {
		return nil, err
	}

	// Don't send emails to bot users.
	if !user.IsBot {
		if err := a.SendUserAccessTokenAddedEmail(user.Email, user.Locale, a.GetSiteURL()); err != nil {
			a.Log.Error("Unable to send user access token added email", mlog.Err(err), mlog.String("user_id", user.Id))
		}
	}

	return token, nil

}

func (a *App) createSessionForUserAccessToken(tokenString string) (*model.Session, *model.AppError) {
	token, err := a.Srv.Store.UserAccessToken().GetByToken(tokenString)
	if err != nil {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, err.Error(), http.StatusUnauthorized)
	}

	if !token.IsActive {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "inactive_token", http.StatusUnauthorized)
	}

	user, err := a.Srv.Store.User().Get(token.UserId)
	if err != nil {
		return nil, err
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

	session.AddProp(model.SESSION_PROP_USER_ACCESS_TOKEN_ID, token.Id)
	session.AddProp(model.SESSION_PROP_TYPE, model.SESSION_TYPE_USER_ACCESS_TOKEN)
	if user.IsBot {
		session.AddProp(model.SESSION_PROP_IS_BOT, model.SESSION_PROP_IS_BOT_VALUE)
	}
	if user.IsGuest() {
		session.AddProp(model.SESSION_PROP_IS_GUEST, "true")
	} else {
		session.AddProp(model.SESSION_PROP_IS_GUEST, "false")
	}
	session.SetExpireInDays(model.SESSION_USER_ACCESS_TOKEN_EXPIRY)

	session, err = a.Srv.Store.Session().Save(session)
	if err != nil {
		return nil, err
	}

	a.AddSessionToCache(session)

	return session, nil

}

func (a *App) RevokeUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.Srv.Store.Session().Get(token.Token)

	if err := a.Srv.Store.UserAccessToken().Delete(token.Id); err != nil {
		return err
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(session)
}

func (a *App) DisableUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.Srv.Store.Session().Get(token.Token)

	if err := a.Srv.Store.UserAccessToken().UpdateTokenDisable(token.Id); err != nil {
		return err
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(session)
}

func (a *App) EnableUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	session, _ = a.Srv.Store.Session().Get(token.Token)

	err := a.Srv.Store.UserAccessToken().UpdateTokenEnable(token.Id)
	if err != nil {
		return err
	}

	if session == nil {
		return nil
	}

	return nil
}

func (a *App) GetUserAccessTokens(page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv.Store.UserAccessToken().GetAll(page*perPage, perPage)
	if err != nil {
		return nil, err
	}

	for _, token := range tokens {
		token.Token = ""
	}

	return tokens, nil
}

func (a *App) GetUserAccessTokensForUser(userId string, page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv.Store.UserAccessToken().GetByUser(userId, page*perPage, perPage)
	if err != nil {
		return nil, err
	}
	for _, token := range tokens {
		token.Token = ""
	}

	return tokens, nil

}

func (a *App) GetUserAccessToken(tokenId string, sanitize bool) (*model.UserAccessToken, *model.AppError) {
	token, err := a.Srv.Store.UserAccessToken().Get(tokenId)
	if err != nil {
		return nil, err
	}

	if sanitize {
		token.Token = ""
	}
	return token, nil
}

func (a *App) SearchUserAccessTokens(term string) ([]*model.UserAccessToken, *model.AppError) {
	tokens, err := a.Srv.Store.UserAccessToken().Search(term)
	if err != nil {
		return nil, err
	}
	for _, token := range tokens {
		token.Token = ""
	}
	return tokens, nil
}
