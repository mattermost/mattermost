// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (ps *PlatformService) ReturnSessionToPool(session *model.Session) {
	if session != nil {
		session.Id = ""
		ps.sessionPool.Put(session)
	}
}

func (ps *PlatformService) CreateSession(c request.CTX, session *model.Session) (*model.Session, error) {
	session.Token = ""

	session, err := ps.Store.Session().Save(c, session)
	if err != nil {
		return nil, err
	}

	ps.AddSessionToCache(session)

	return session, nil
}

func (ps *PlatformService) GetSessionContext(c request.CTX, token string) (*model.Session, error) {
	return ps.Store.Session().Get(c, token)
}

func (ps *PlatformService) GetSessions(c request.CTX, userID string) ([]*model.Session, error) {
	return ps.Store.Session().GetSessions(c, userID)
}

func (ps *PlatformService) GetLRUSessions(c request.CTX, userID string, limit uint64, offset uint64) ([]*model.Session, error) {
	return ps.Store.Session().GetLRUSessions(c, userID, limit, offset)
}

func (ps *PlatformService) AddSessionToCache(session *model.Session) {
	ps.sessionCache.SetWithExpiry(session.Token, session, time.Duration(int64(*ps.Config().ServiceSettings.SessionCacheInMinutes))*time.Minute)
}

func (ps *PlatformService) ClearUserSessionCacheLocal(userID string) {
	if keys, err := ps.sessionCache.Keys(); err == nil {
		var session *model.Session
		for _, key := range keys {
			if err := ps.sessionCache.Get(key, &session); err == nil {
				if session.UserId == userID {
					ps.sessionCache.Remove(key)
					if m := ps.metricsIFace; m != nil {
						m.IncrementMemCacheInvalidationCounterSession()
					}
				}
			}
		}
	}
}

func (ps *PlatformService) ClearAllUsersSessionCacheLocal() {
	ps.sessionCache.Purge()
}

func (ps *PlatformService) ClearUserSessionCache(userID string) {
	ps.ClearUserSessionCacheLocal(userID)

	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventClearSessionCacheForUser,
			SendType: model.ClusterSendReliable,
			Data:     []byte(userID),
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}

func (ps *PlatformService) ClearAllUsersSessionCache() {
	ps.ClearAllUsersSessionCacheLocal()

	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventClearSessionCacheForAllUsers,
			SendType: model.ClusterSendReliable,
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}

func (ps *PlatformService) GetSession(c request.CTX, token string) (*model.Session, error) {
	var session = ps.sessionPool.Get().(*model.Session)
	if err := ps.sessionCache.Get(token, session); err == nil {
		if m := ps.metricsIFace; m != nil {
			m.IncrementMemCacheHitCounterSession()
		}
	} else {
		if m := ps.metricsIFace; m != nil {
			m.IncrementMemCacheMissCounterSession()
		}
	}

	if session.Id != "" {
		return session, nil
	}

	return ps.GetSessionContext(c, token)
}

func (ps *PlatformService) GetSessionByID(c request.CTX, sessionID string) (*model.Session, error) {
	return ps.Store.Session().Get(c, sessionID)
}

func (ps *PlatformService) RevokeSessionsFromAllUsers() error {
	// revoke tokens before sessions so they can't be used to relogin
	nErr := ps.Store.OAuth().RemoveAllAccessData()
	if nErr != nil {
		return fmt.Errorf("%s: %w", nErr.Error(), DeleteAllAccessDataError)
	}
	err := ps.Store.Session().RemoveAllSessions()
	if err != nil {
		return err
	}

	ps.ClearAllUsersSessionCache()
	return nil
}

func (ps *PlatformService) RevokeSessionsForDeviceId(c request.CTX, userID string, deviceID string, currentSessionId string) error {
	sessions, err := ps.Store.Session().GetSessions(c, userID)
	if err != nil {
		return err
	}
	for _, session := range sessions {
		if session.DeviceId == deviceID && session.Id != currentSessionId {
			c.Logger().Debug("Revoking sessionId for userId. Re-login with the same device Id", mlog.String("session_id", session.Id), mlog.String("user_id", userID))
			if err := ps.RevokeSession(c, session); err != nil {
				c.Logger().Warn("Could not revoke session for device", mlog.String("device_id", deviceID), mlog.Err(err))
			}
		}
	}

	return nil
}

func (ps *PlatformService) RevokeSession(c request.CTX, session *model.Session) error {
	if session.IsOAuth {
		if err := ps.RevokeAccessToken(c, session.Token); err != nil {
			return err
		}
	} else {
		if err := ps.Store.Session().Remove(session.Id); err != nil {
			return fmt.Errorf("%s: %w", err.Error(), DeleteSessionError)
		}
	}

	ps.ClearUserSessionCache(session.UserId)

	return nil
}

func (ps *PlatformService) RevokeAccessToken(c request.CTX, token string) error {
	session, _ := ps.GetSession(c, token)

	defer ps.ReturnSessionToPool(session)

	schan := make(chan error, 1)
	go func() {
		schan <- ps.Store.Session().Remove(token)
		close(schan)
	}()

	if _, err := ps.Store.OAuth().GetAccessData(token); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), GetTokenError)
	}

	if err := ps.Store.OAuth().RemoveAccessData(token); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), DeleteTokenError)
	}

	if err := <-schan; err != nil {
		return fmt.Errorf("%s: %w", err.Error(), DeleteSessionError)
	}

	if session != nil {
		ps.ClearUserSessionCache(session.UserId)
	}

	return nil
}

// SetSessionExpireInHours sets the session's expiry the specified number of hours
// relative to either the session creation date or the current time, depending
// on the `ExtendSessionOnActivity` config setting.
func (ps *PlatformService) SetSessionExpireInHours(session *model.Session, hours int) {
	if session.CreateAt == 0 || *ps.Config().ServiceSettings.ExtendSessionLengthWithActivity {
		session.ExpiresAt = model.GetMillis() + (1000 * 60 * 60 * int64(hours))
	} else {
		session.ExpiresAt = session.CreateAt + (1000 * 60 * 60 * int64(hours))
	}
}

func (ps *PlatformService) ExtendSessionExpiry(session *model.Session, newExpiry int64) error {
	if err := ps.Store.Session().UpdateExpiresAt(session.Id, newExpiry); err != nil {
		return err
	}

	// Update local cache. No need to invalidate cache for cluster as the session cache timeout
	// ensures each node will get an extended expiry within the next 10 minutes.
	// Worst case is another node may generate a redundant expiry update.
	session.ExpiresAt = newExpiry
	ps.AddSessionToCache(session)

	return nil
}

func (ps *PlatformService) UpdateSessionsIsGuest(c request.CTX, user *model.User, isGuest bool) error {
	sessions, err := ps.GetSessions(c, user.Id)
	if err != nil {
		return err
	}

	_, err = ps.Store.Session().UpdateRoles(user.Id, user.GetRawRoles())
	if err != nil {
		return err
	}

	for _, session := range sessions {
		session.AddProp(model.SessionPropIsGuest, strconv.FormatBool(isGuest))
		err := ps.Store.Session().UpdateProps(session)
		if err != nil {
			mlog.Warn("Unable to update isGuest session", mlog.Err(err))
			continue
		}
		ps.AddSessionToCache(session)
	}
	return nil
}

func (ps *PlatformService) RevokeAllSessions(c request.CTX, userID string) error {
	sessions, err := ps.Store.Session().GetSessions(c, userID)
	if err != nil {
		return fmt.Errorf("%s: %w", err.Error(), GetSessionError)
	}
	for _, session := range sessions {
		if session.IsOAuth {
			ps.RevokeAccessToken(c, session.Token)
		} else {
			if err := ps.Store.Session().Remove(session.Id); err != nil {
				return fmt.Errorf("%s: %w", err.Error(), DeleteSessionError)
			}
		}
	}

	ps.ClearUserSessionCache(userID)

	return nil
}
