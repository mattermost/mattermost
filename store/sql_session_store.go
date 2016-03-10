// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
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
		table.ColMap("DeviceId").SetMaxSize(512)
		table.ColMap("Roles").SetMaxSize(64)
		table.ColMap("Props").SetMaxSize(1000)
	}

	return us
}

func (me SqlSessionStore) UpgradeSchemaIfNeeded() {
	// ADDED for 2.1 REMOVE for 2.5
	deviceIdLength := me.GetMaxLengthOfColumnIfExists("Sessions", "DeviceId")
	if len(deviceIdLength) > 0 && deviceIdLength != "512" {
		me.AlterColumnTypeIfExists("Sessions", "DeviceId", "VARCHAR(512)", "VARCHAR(512)")
	}
}

func (me SqlSessionStore) CreateIndexesIfNotExists() {
	me.CreateIndexIfNotExists("idx_sessions_user_id", "Sessions", "UserId")
	me.CreateIndexIfNotExists("idx_sessions_token", "Sessions", "Token")
}

func (me SqlSessionStore) Save(session *model.Session) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(session.Id) > 0 {
			result.Err = model.NewLocAppError("SqlSessionStore.Save", "store.sql_session.save.existing.app_error", nil, "id="+session.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		session.PreSave()

		if cur := <-me.CleanUpExpiredSessions(session.UserId); cur.Err != nil {
			l4g.Error(utils.T("store.sql_session.save.cleanup.error"), cur.Err)
		}

		if err := me.GetMaster().Insert(session); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.Save", "store.sql_session.save.app_error", nil, "id="+session.Id+", "+err.Error())
		} else {
			result.Data = session
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) Get(sessionIdOrToken string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var sessions []*model.Session

		if _, err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE Token = :Token OR Id = :Id LIMIT 1", map[string]interface{}{"Token": sessionIdOrToken, "Id": sessionIdOrToken}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.Get", "store.sql_session.get.app_error", nil, "sessionIdOrToken="+sessionIdOrToken+", "+err.Error())
		} else if sessions == nil || len(sessions) == 0 {
			result.Err = model.NewLocAppError("SqlSessionStore.Get", "store.sql_session.get.app_error", nil, "sessionIdOrToken="+sessionIdOrToken)
		} else {
			result.Data = sessions[0]
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (me SqlSessionStore) GetSessions(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {

		if cur := <-me.CleanUpExpiredSessions(userId); cur.Err != nil {
			l4g.Error(utils.T("store.sql_session.get_sessions.error"), cur.Err)
		}

		result := StoreResult{}

		var sessions []*model.Session

		if _, err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE UserId = :UserId ORDER BY LastActivityAt DESC", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.GetSessions", "store.sql_session.get_sessions.app_error", nil, err.Error())
		} else {

			result.Data = sessions
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) Remove(sessionIdOrToken string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE Id = :Id Or Token = :Token", map[string]interface{}{"Id": sessionIdOrToken, "Token": sessionIdOrToken})
		if err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.RemoveSession", "store.sql_session.remove.app_error", nil, "id="+sessionIdOrToken+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) RemoveAllSessionsForTeam(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE TeamId = :TeamId", map[string]interface{}{"TeamId": teamId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.RemoveAllSessionsForTeam", "store.sql_session.remove_all_sessions_for_team.app_error", nil, "id="+teamId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) PermanentDeleteSessionsByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.RemoveAllSessionsForUser", "store.sql_session.permanent_delete_sessions_by_user.app_error", nil, "id="+userId+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) CleanUpExpiredSessions(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE UserId = :UserId AND ExpiresAt != 0 AND :ExpiresAt > ExpiresAt", map[string]interface{}{"UserId": userId, "ExpiresAt": model.GetMillis()}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.CleanUpExpiredSessions", "store.sql_session.cleanup_expired_sessions.app_error", nil, err.Error())
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) UpdateLastActivityAt(sessionId string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := me.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = :LastActivityAt WHERE Id = :Id", map[string]interface{}{"LastActivityAt": time, "Id": sessionId}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.UpdateLastActivityAt", "store.sql_session.update_last_activity.app_error", nil, "sessionId="+sessionId)
		} else {
			result.Data = sessionId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) UpdateRoles(userId, roles string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}
		if _, err := me.GetMaster().Exec("UPDATE Sessions SET Roles = :Roles WHERE UserId = :UserId", map[string]interface{}{"Roles": roles, "UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.UpdateRoles", "store.sql_session.update_roles.app_error", nil, "userId="+userId)
		} else {
			result.Data = userId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) UpdateDeviceId(id, deviceId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}
		if _, err := me.GetMaster().Exec("UPDATE Sessions SET DeviceId = :DeviceId WHERE Id = :Id", map[string]interface{}{"DeviceId": deviceId, "Id": id}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.UpdateDeviceId", "store.sql_session.update_device_id.app_error", nil, err.Error())
		} else {
			result.Data = deviceId
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (me SqlSessionStore) AnalyticsSessionCount(teamId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		query :=
			`SELECT
                COUNT(*)
            FROM
                Sessions
            WHERE ExpiresAt > :Time`

		if len(teamId) > 0 {
			query += " AND TeamId = :TeamId"
		}

		if c, err := me.GetReplica().SelectInt(query, map[string]interface{}{"Time": model.GetMillis(), "TeamId": teamId}); err != nil {
			result.Err = model.NewLocAppError("SqlSessionStore.AnalyticsSessionCount", "store.sql_session.analytics_session_count.app_error", nil, err.Error())
		} else {
			result.Data = c
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
