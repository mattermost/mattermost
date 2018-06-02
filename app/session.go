// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) CreateSession(session *model.Session) (*model.Session, *model.AppError) {
	session.Token = ""

	if result := <-a.Srv.Store.Session().Save(session); result.Err != nil {
		return nil, result.Err
	} else {
		session := result.Data.(*model.Session)

		a.AddSessionToCache(session)

		return session, nil
	}
}

func (a *App) GetSession(token string) (*model.Session, *model.AppError) {
	metrics := a.Metrics

	var session *model.Session
	if ts, ok := a.sessionCache.Get(token); ok {
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
		if sessionResult := <-a.Srv.Store.Session().Get(token); sessionResult.Err == nil {
			session = sessionResult.Data.(*model.Session)

			if session != nil {
				if session.Token != token {
					return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token, "Error": ""}, "", http.StatusUnauthorized)
				}

				if !session.IsExpired() {
					a.AddSessionToCache(session)
				}
			}
		} else if sessionResult.Err.StatusCode == http.StatusInternalServerError {
			return nil, sessionResult.Err
		}
	}

	if session == nil {
		var err *model.AppError
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

	license := a.License()
	if *a.Config().ServiceSettings.SessionIdleTimeoutInMinutes > 0 &&
		license != nil && *license.Features.Compliance &&
		session != nil && !session.IsOAuth && !session.IsMobileApp() &&
		session.Props[model.SESSION_PROP_TYPE] != model.SESSION_TYPE_USER_ACCESS_TOKEN {

		timeout := int64(*a.Config().ServiceSettings.SessionIdleTimeoutInMinutes) * 1000 * 60
		if model.GetMillis()-session.LastActivityAt > timeout {
			a.RevokeSessionById(session.Id)
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token}, "idle timeout", http.StatusUnauthorized)
		}
	}

	return session, nil
}

func (a *App) GetSessions(userId string) ([]*model.Session, *model.AppError) {
	if result := <-a.Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Session), nil
	}
}

func (a *App) RevokeAllSessions(userId string) *model.AppError {
	if result := <-a.Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return result.Err
	} else {
		sessions := result.Data.([]*model.Session)

		for _, session := range sessions {
			if session.IsOAuth {
				a.RevokeAccessToken(session.Token)
			} else {
				if result := <-a.Srv.Store.Session().Remove(session.Id); result.Err != nil {
					return result.Err
				}
			}

			a.RevokeWebrtcToken(session.Id)
		}
	}

	a.ClearSessionCacheForUser(userId)

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

func (a *App) ClearSessionCacheForUserSkipClusterSend(userId string) {
	keys := a.sessionCache.Keys()

	for _, key := range keys {
		if ts, ok := a.sessionCache.Get(key); ok {
			session := ts.(*model.Session)
			if session.UserId == userId {
				a.sessionCache.Remove(key)
				if a.Metrics != nil {
					a.Metrics.IncrementMemCacheInvalidationCounterSession()
				}
			}
		}
	}

	a.InvalidateWebConnSessionCacheForUser(userId)
}

func (a *App) AddSessionToCache(session *model.Session) {
	a.sessionCache.AddWithExpiresInSecs(session.Token, session, int64(*a.Config().ServiceSettings.SessionCacheInMinutes*60))
}

func (a *App) SessionCacheLength() int {
	return a.sessionCache.Len()
}

func (a *App) RevokeSessionsForDeviceId(userId string, deviceId string, currentSessionId string) *model.AppError {
	if result := <-a.Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return result.Err
	} else {
		sessions := result.Data.([]*model.Session)
		for _, session := range sessions {
			if session.DeviceId == deviceId && session.Id != currentSessionId {
				mlog.Debug(fmt.Sprintf("Revoking sessionId=%v for userId=%v re-login with same device Id", session.Id, userId), mlog.String("user_id", userId))
				if err := a.RevokeSession(session); err != nil {
					// Soft error so we still remove the other sessions
					mlog.Error(err.Error())
				}
			}
		}
	}

	return nil
}

func (a *App) GetSessionById(sessionId string) (*model.Session, *model.AppError) {
	if result := <-a.Srv.Store.Session().Get(sessionId); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		return result.Data.(*model.Session), nil
	}
}

func (a *App) RevokeSessionById(sessionId string) *model.AppError {
	if result := <-a.Srv.Store.Session().Get(sessionId); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return result.Err
	} else {
		return a.RevokeSession(result.Data.(*model.Session))
	}
}

func (a *App) RevokeSession(session *model.Session) *model.AppError {
	if session.IsOAuth {
		if err := a.RevokeAccessToken(session.Token); err != nil {
			return err
		}
	} else {
		if result := <-a.Srv.Store.Session().Remove(session.Id); result.Err != nil {
			return result.Err
		}
	}

	a.RevokeWebrtcToken(session.Id)
	a.ClearSessionCacheForUser(session.UserId)

	return nil
}

func (a *App) AttachDeviceId(sessionId string, deviceId string, expiresAt int64) *model.AppError {
	if result := <-a.Srv.Store.Session().UpdateDeviceId(sessionId, deviceId, expiresAt); result.Err != nil {
		return result.Err
	}

	return nil
}

func (a *App) UpdateLastActivityAtIfNeeded(session model.Session) {
	now := model.GetMillis()

	a.UpdateWebConnUserActivity(session, now)

	if now-session.LastActivityAt < model.SESSION_ACTIVITY_TIMEOUT {
		return
	}

	if result := <-a.Srv.Store.Session().UpdateLastActivityAt(session.Id, now); result.Err != nil {
		mlog.Error(fmt.Sprintf("Failed to update LastActivityAt for user_id=%v and session_id=%v, err=%v", session.UserId, session.Id, result.Err), mlog.String("user_id", session.UserId))
	}

	session.LastActivityAt = now
	a.AddSessionToCache(&session)
}

func (a *App) CreateUserAccessToken(token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserAccessTokens {
		return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.disabled", nil, "", http.StatusNotImplemented)
	}

	token.Token = model.NewId()

	uchan := a.Srv.Store.User().Get(token.UserId)

	if result := <-a.Srv.Store.UserAccessToken().Save(token); result.Err != nil {
		return nil, result.Err
	} else {
		token = result.Data.(*model.UserAccessToken)
	}

	if result := <-uchan; result.Err != nil {
		mlog.Error(result.Err.Error())
	} else {
		user := result.Data.(*model.User)
		if err := a.SendUserAccessTokenAddedEmail(user.Email, user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error(err.Error())
		}
	}

	return token, nil

}

func (a *App) createSessionForUserAccessToken(tokenString string) (*model.Session, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableUserAccessTokens {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "EnableUserAccessTokens=false", http.StatusUnauthorized)
	}

	var token *model.UserAccessToken
	if result := <-a.Srv.Store.UserAccessToken().GetByToken(tokenString); result.Err != nil {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, result.Err.Error(), http.StatusUnauthorized)
	} else {
		token = result.Data.(*model.UserAccessToken)

		if !token.IsActive {
			return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "inactive_token", http.StatusUnauthorized)
		}
	}

	var user *model.User
	if result := <-a.Srv.Store.User().Get(token.UserId); result.Err != nil {
		return nil, result.Err
	} else {
		user = result.Data.(*model.User)
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
	session.SetExpireInDays(model.SESSION_USER_ACCESS_TOKEN_EXPIRY)

	if result := <-a.Srv.Store.Session().Save(session); result.Err != nil {
		return nil, result.Err
	} else {
		session := result.Data.(*model.Session)

		a.AddSessionToCache(session)

		return session, nil
	}
}

func (a *App) RevokeUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	if result := <-a.Srv.Store.Session().Get(token.Token); result.Err == nil {
		session = result.Data.(*model.Session)
	}

	if result := <-a.Srv.Store.UserAccessToken().Delete(token.Id); result.Err != nil {
		return result.Err
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(session)
}

func (a *App) DisableUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	if result := <-a.Srv.Store.Session().Get(token.Token); result.Err == nil {
		session = result.Data.(*model.Session)
	}

	if result := <-a.Srv.Store.UserAccessToken().UpdateTokenDisable(token.Id); result.Err != nil {
		return result.Err
	}

	if session == nil {
		return nil
	}

	return a.RevokeSession(session)
}

func (a *App) EnableUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	if result := <-a.Srv.Store.Session().Get(token.Token); result.Err == nil {
		session = result.Data.(*model.Session)
	}

	if result := <-a.Srv.Store.UserAccessToken().UpdateTokenEnable(token.Id); result.Err != nil {
		return result.Err
	}

	if session == nil {
		return nil
	}

	return nil
}

func (a *App) GetUserAccessTokens(page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	if result := <-a.Srv.Store.UserAccessToken().GetAll(page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		tokens := result.Data.([]*model.UserAccessToken)
		for _, token := range tokens {
			token.Token = ""
		}

		return tokens, nil
	}
}

func (a *App) GetUserAccessTokensForUser(userId string, page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	if result := <-a.Srv.Store.UserAccessToken().GetByUser(userId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		tokens := result.Data.([]*model.UserAccessToken)
		for _, token := range tokens {
			token.Token = ""
		}

		return tokens, nil
	}
}

func (a *App) GetUserAccessToken(tokenId string, sanitize bool) (*model.UserAccessToken, *model.AppError) {
	if result := <-a.Srv.Store.UserAccessToken().Get(tokenId); result.Err != nil {
		return nil, result.Err
	} else {
		token := result.Data.(*model.UserAccessToken)
		if sanitize {
			token.Token = ""
		}
		return token, nil
	}
}

func (a *App) SearchUserAccessTokens(term string) ([]*model.UserAccessToken, *model.AppError) {
	if result := <-a.Srv.Store.UserAccessToken().Search(term); result.Err != nil {
		return nil, result.Err
	} else {
		tokens := result.Data.([]*model.UserAccessToken)
		for _, token := range tokens {
			token.Token = ""
		}
		return tokens, nil
	}
}
