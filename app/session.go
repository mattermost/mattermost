// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	l4g "github.com/alecthomas/log4go"
)

var sessionCache *utils.Cache = utils.NewLru(model.SESSION_CACHE_SIZE)

func CreateSession(session *model.Session) (*model.Session, *model.AppError) {
	session.Token = ""

	if result := <-Srv.Store.Session().Save(session); result.Err != nil {
		return nil, result.Err
	} else {
		session := result.Data.(*model.Session)

		AddSessionToCache(session)

		return session, nil
	}
}

func GetSession(token string) (*model.Session, *model.AppError) {
	metrics := einterfaces.GetMetricsInterface()

	var session *model.Session
	if ts, ok := sessionCache.Get(token); ok {
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
		if sessionResult := <-Srv.Store.Session().Get(token); sessionResult.Err == nil {
			session = sessionResult.Data.(*model.Session)

			if session != nil {
				if session.Token != token {
					return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token, "Error": ""}, "", http.StatusUnauthorized)
				}

				if !session.IsExpired() {
					AddSessionToCache(session)
				}
			}
		}
	}

	if session == nil {
		var err *model.AppError
		session, err = createSessionForUserAccessToken(token)
		if err != nil {
			return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token}, err.Error(), http.StatusUnauthorized)
		}
	}

	if session == nil || session.IsExpired() {
		return nil, model.NewAppError("GetSession", "api.context.invalid_token.error", map[string]interface{}{"Token": token}, "", http.StatusUnauthorized)
	}

	return session, nil
}

func GetSessions(userId string) ([]*model.Session, *model.AppError) {
	if result := <-Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.([]*model.Session), nil
	}
}

func RevokeAllSessions(userId string) *model.AppError {
	if result := <-Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return result.Err
	} else {
		sessions := result.Data.([]*model.Session)

		for _, session := range sessions {
			if session.IsOAuth {
				RevokeAccessToken(session.Token)
			} else {
				if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
					return result.Err
				}
			}

			RevokeWebrtcToken(session.Id)
		}
	}

	ClearSessionCacheForUser(userId)

	return nil
}

func ClearSessionCacheForUser(userId string) {

	ClearSessionCacheForUserSkipClusterSend(userId)

	if einterfaces.GetClusterInterface() != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER,
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     userId,
		}
		einterfaces.GetClusterInterface().SendClusterMessage(msg)
	}
}

func ClearSessionCacheForUserSkipClusterSend(userId string) {
	keys := sessionCache.Keys()

	for _, key := range keys {
		if ts, ok := sessionCache.Get(key); ok {
			session := ts.(*model.Session)
			if session.UserId == userId {
				sessionCache.Remove(key)
			}
		}
	}

	InvalidateWebConnSessionCacheForUser(userId)

}

func AddSessionToCache(session *model.Session) {
	sessionCache.AddWithExpiresInSecs(session.Token, session, int64(*utils.Cfg.ServiceSettings.SessionCacheInMinutes*60))
}

func SessionCacheLength() int {
	return sessionCache.Len()
}

func RevokeSessionsForDeviceId(userId string, deviceId string, currentSessionId string) *model.AppError {
	if result := <-Srv.Store.Session().GetSessions(userId); result.Err != nil {
		return result.Err
	} else {
		sessions := result.Data.([]*model.Session)
		for _, session := range sessions {
			if session.DeviceId == deviceId && session.Id != currentSessionId {
				l4g.Debug(utils.T("api.user.login.revoking.app_error"), session.Id, userId)
				if err := RevokeSession(session); err != nil {
					// Soft error so we still remove the other sessions
					l4g.Error(err.Error())
				}
			}
		}
	}

	return nil
}

func RevokeSessionById(sessionId string) *model.AppError {
	if result := <-Srv.Store.Session().Get(sessionId); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return result.Err
	} else {
		return RevokeSession(result.Data.(*model.Session))
	}
}

func RevokeSession(session *model.Session) *model.AppError {
	if session.IsOAuth {
		if err := RevokeAccessToken(session.Token); err != nil {
			return err
		}
	} else {
		if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
			return result.Err
		}
	}

	RevokeWebrtcToken(session.Id)
	ClearSessionCacheForUser(session.UserId)

	return nil
}

func AttachDeviceId(sessionId string, deviceId string, expiresAt int64) *model.AppError {
	if result := <-Srv.Store.Session().UpdateDeviceId(sessionId, deviceId, expiresAt); result.Err != nil {
		return result.Err
	}

	return nil
}

func UpdateLastActivityAtIfNeeded(session model.Session) {
	now := model.GetMillis()
	if now-session.LastActivityAt < model.SESSION_ACTIVITY_TIMEOUT {
		return
	}

	if result := <-Srv.Store.Session().UpdateLastActivityAt(session.Id, now); result.Err != nil {
		l4g.Error(utils.T("api.status.last_activity.error", session.UserId, session.Id))
	}

	session.LastActivityAt = now
	AddSessionToCache(&session)
}

func CreateUserAccessToken(token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableUserAccessTokens {
		return nil, model.NewAppError("CreateUserAccessToken", "app.user_access_token.disabled", nil, "", http.StatusNotImplemented)
	}

	token.Token = model.NewId()

	uchan := Srv.Store.User().Get(token.UserId)

	if result := <-Srv.Store.UserAccessToken().Save(token); result.Err != nil {
		return nil, result.Err
	} else {
		token = result.Data.(*model.UserAccessToken)
	}

	if result := <-uchan; result.Err != nil {
		l4g.Error(result.Err.Error())
	} else {
		user := result.Data.(*model.User)
		if err := SendUserAccessTokenAddedEmail(user.Email, user.Locale); err != nil {
			l4g.Error(err.Error())
		}
	}

	return token, nil

}

func createSessionForUserAccessToken(tokenString string) (*model.Session, *model.AppError) {
	if !*utils.Cfg.ServiceSettings.EnableUserAccessTokens {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, "EnableUserAccessTokens=false", http.StatusUnauthorized)
	}

	var token *model.UserAccessToken
	if result := <-Srv.Store.UserAccessToken().GetByToken(tokenString); result.Err != nil {
		return nil, model.NewAppError("createSessionForUserAccessToken", "app.user_access_token.invalid_or_missing", nil, result.Err.Error(), http.StatusUnauthorized)
	} else {
		token = result.Data.(*model.UserAccessToken)
	}

	var user *model.User
	if result := <-Srv.Store.User().Get(token.UserId); result.Err != nil {
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

	if result := <-Srv.Store.Session().Save(session); result.Err != nil {
		return nil, result.Err
	} else {
		session := result.Data.(*model.Session)

		AddSessionToCache(session)

		return session, nil
	}
}

func RevokeUserAccessToken(token *model.UserAccessToken) *model.AppError {
	var session *model.Session
	if result := <-Srv.Store.Session().Get(token.Token); result.Err == nil {
		session = result.Data.(*model.Session)
	}

	if result := <-Srv.Store.UserAccessToken().Delete(token.Id); result.Err != nil {
		return result.Err
	}

	if session == nil {
		return nil
	}

	return RevokeSession(session)
}

func GetUserAccessTokensForUser(userId string, page, perPage int) ([]*model.UserAccessToken, *model.AppError) {
	if result := <-Srv.Store.UserAccessToken().GetByUser(userId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		tokens := result.Data.([]*model.UserAccessToken)
		for _, token := range tokens {
			token.Token = ""
		}

		return tokens, nil
	}
}

func GetUserAccessToken(tokenId string, sanitize bool) (*model.UserAccessToken, *model.AppError) {
	if result := <-Srv.Store.UserAccessToken().Get(tokenId); result.Err != nil {
		return nil, result.Err
	} else {
		token := result.Data.(*model.UserAccessToken)
		if sanitize {
			token.Token = ""
		}
		return token, nil
	}
}
