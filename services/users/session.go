// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (us *UserService) ReturnSessionToPool(session *model.Session) {
	if session != nil {
		session.Id = ""
		us.sessionPool.Put(session)
	}
}

func (us *UserService) CreateSession(session *model.Session) (*model.Session, error) {
	session.Token = ""

	session, err := us.sessionStore.Save(session)
	if err != nil {
		return nil, err
	}

	us.AddSessionToCache(session)

	return session, nil
}

func (us *UserService) GetSession(token string) (*model.Session, error) {
	var session = us.sessionPool.Get().(*model.Session)
	if err := us.sessionCache.Get(token, session); err == nil {
		if us.metrics != nil {
			us.metrics.IncrementMemCacheHitCounterSession()
		}
	} else {
		if us.metrics != nil {
			us.metrics.IncrementMemCacheMissCounterSession()
		}
	}
	return session, nil
}

func (us *UserService) AddSessionToCache(session *model.Session) {
	us.sessionCache.SetWithExpiry(session.Token, session, time.Duration(int64(*us.config().ServiceSettings.SessionCacheInMinutes))*time.Minute)
}

func (us *UserService) SessionCacheLength() int {
	if l, err := us.sessionCache.Len(); err == nil {
		return l
	}
	return 0
}

func (us *UserService) ClearUserSessionCacheLocal(userID string) {
	if keys, err := us.sessionCache.Keys(); err == nil {
		var session *model.Session
		for _, key := range keys {
			if err := us.sessionCache.Get(key, &session); err == nil {
				if session.UserId == userID {
					us.sessionCache.Remove(key)
					if us.metrics != nil {
						us.metrics.IncrementMemCacheInvalidationCounterSession()
					}
				}
			}
		}
	}
}

func (us *UserService) ClearAllUsersSessionCacheLocal() {
	us.sessionCache.Purge()
}

func (us *UserService) ClearUserSessionCache(userID string) {
	us.ClearUserSessionCacheLocal(userID)

	if us.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_USER,
			SendType: model.CLUSTER_SEND_RELIABLE,
			Data:     userID,
		}
		us.cluster.SendClusterMessage(msg)
	}
}

func (us *UserService) ClearAllUsersSessionCache() {
	us.ClearAllUsersSessionCacheLocal()

	if us.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.CLUSTER_EVENT_CLEAR_SESSION_CACHE_FOR_ALL_USERS,
			SendType: model.CLUSTER_SEND_RELIABLE,
		}
		us.cluster.SendClusterMessage(msg)
	}
}
