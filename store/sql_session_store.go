// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type SqlSessionStore struct {
	*SqlStore
}

func NewSqlSessionStore(sqlStore *SqlStore) SessionStore {
	us := &SqlSessionStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Session{}, "Sessions").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Token").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("TeamId").SetMaxSize(26)
		table.ColMap("DeviceId").SetMaxSize(128)
		table.ColMap("Roles").SetMaxSize(64)
		table.ColMap("Props").SetMaxSize(1000)
	}

	return us
}

func (me SqlSessionStore) UpgradeSchemaIfNeeded() {
}

func (me SqlSessionStore) CreateIndexesIfNotExists() {
	me.CreateIndexIfNotExists("idx_sessions_user_id", "Sessions", "UserId")
	me.CreateIndexIfNotExists("idx_sessions_token", "Sessions", "Token")
}

func (me SqlSessionStore) Save(T goi18n.TranslateFunc, session *model.Session) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(session.Id) > 0 {
			result.Err = model.NewAppError("SqlSessionStore.Save", "Cannot update existing session", "id="+session.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		session.PreSave()

		if cur := <-me.CleanUpExpiredSessions(T, session.UserId); cur.Err != nil {
			l4g.Error("Failed to cleanup sessions in Save err=%v", cur.Err)
		}

		if err := me.GetMaster().Insert(session); err != nil {
			result.Err = model.NewAppError("SqlSessionStore.Save", "We couldn't save the session", "id="+session.Id+", "+err.Error())
		} else {
			result.Data = session
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) Get(T goi18n.TranslateFunc, sessionIdOrToken string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var sessions []*model.Session

		if _, err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE Token = :Token OR Id = :Id LIMIT 1", map[string]interface{}{"Token": sessionIdOrToken, "Id": sessionIdOrToken}); err != nil {
			result.Err = model.NewAppError("SqlSessionStore.Get", "We encountered an error finding the session", "sessionIdOrToken="+sessionIdOrToken+", "+err.Error())
		} else if sessions == nil || len(sessions) == 0 {
			result.Err = model.NewAppError("SqlSessionStore.Get", "We encountered an error finding the session", "sessionIdOrToken="+sessionIdOrToken)
		} else {
			result.Data = sessions[0]
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (me SqlSessionStore) GetSessions(T goi18n.TranslateFunc, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {

		if cur := <-me.CleanUpExpiredSessions(T, userId); cur.Err != nil {
			l4g.Error("Failed to cleanup sessions in getSessions err=%v", cur.Err)
		}

		result := StoreResult{}

		var sessions []*model.Session

		if _, err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE UserId = :UserId ORDER BY LastActivityAt DESC", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlSessionStore.GetSessions", "We encountered an error while finding user sessions", err.Error())
		} else {

			result.Data = sessions
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) Remove(T goi18n.TranslateFunc, sessionIdOrToken string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE Id = :Id Or Token = :Token", map[string]interface{}{"Id": sessionIdOrToken, "Token": sessionIdOrToken})
		if err != nil {
			result.Err = model.NewAppError("SqlSessionStore.RemoveSession", "We couldn't remove the session", "id="+sessionIdOrToken+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) RemoveAllSessionsForTeam(T goi18n.TranslateFunc, teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewAppError("SqlSessionStore.RemoveAllSessionsForTeam", "We couldn't remove all the sessions for the team", "id="+teamId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) PermanentDeleteSessionsByUser(T goi18n.TranslateFunc, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlSessionStore.RemoveAllSessionsForUser", "We couldn't remove all the sessions for the user", "id="+userId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) CleanUpExpiredSessions(T goi18n.TranslateFunc, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE UserId = :UserId AND ExpiresAt != 0 AND :ExpiresAt > ExpiresAt", map[string]interface{}{"UserId": userId, "ExpiresAt": model.GetMillis()}); err != nil {
			result.Err = model.NewAppError("SqlSessionStore.CleanUpExpiredSessions", "We encountered an error while deleting expired user sessions", err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) UpdateLastActivityAt(T goi18n.TranslateFunc, sessionId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := me.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = :LastActivityAt WHERE Id = :Id", map[string]interface{}{"LastActivityAt": time, "Id": sessionId}); err != nil {
			result.Err = model.NewAppError("SqlSessionStore.UpdateLastActivityAt", "We couldn't update the last_activity_at", "sessionId="+sessionId)
		} else {
			result.Data = sessionId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) UpdateRoles(T goi18n.TranslateFunc, userId, roles string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}
		if _, err := me.GetMaster().Exec("UPDATE Sessions SET Roles = :Roles WHERE UserId = :UserId", map[string]interface{}{"Roles": roles, "UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlSessionStore.UpdateRoles", "We couldn't update the roles", "userId="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
