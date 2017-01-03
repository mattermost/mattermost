// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"

	l4g "github.com/alecthomas/log4go"
)

var sessionCache *utils.Cache = utils.NewLru(model.SESSION_CACHE_SIZE)

func GetSession(token string) *model.Session {
	metrics := einterfaces.GetMetricsInterface()

	var session *model.Session
	if ts, ok := sessionCache.Get(token); ok {
		session = ts.(*model.Session)
		if metrics != nil {
			metrics.IncrementMemCacheHitCounter("Session")
		}
	} else {
		if metrics != nil {
			metrics.IncrementMemCacheMissCounter("Session")
		}
	}

	if session == nil {
		if sessionResult := <-Srv.Store.Session().Get(token); sessionResult.Err != nil {
			l4g.Error(utils.T("api.context.invalid_token.error"), token, sessionResult.Err.DetailedError)
		} else {
			session = sessionResult.Data.(*model.Session)

			if session.IsExpired() || session.Token != token {
				return nil
			} else {
				AddSessionToCache(session)
				return session
			}
		}
	}

	return session
}

func RemoveAllSessionsForUserId(userId string) {

	RemoveAllSessionsForUserIdSkipClusterSend(userId)

	if einterfaces.GetClusterInterface() != nil {
		einterfaces.GetClusterInterface().RemoveAllSessionsForUserId(userId)
	}
}

func RemoveAllSessionsForUserIdSkipClusterSend(userId string) {
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

func InvalidateAllCaches() {
	l4g.Info(utils.T("api.context.invalidate_all_caches"))
	sessionCache.Purge()
	ClearStatusCache()
	store.ClearChannelCaches()
	store.ClearUserCaches()
	store.ClearPostCaches()
}

func SessionCacheLength() int {
	return sessionCache.Len()
}
