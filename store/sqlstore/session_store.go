// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	SESSIONS_CLEANUP_DELAY_MILLISECONDS = 100
)

type SqlSessionStore struct {
	SqlStore
}

func NewSqlSessionStore(sqlStore SqlStore) store.SessionStore {
	us := &SqlSessionStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Session{}, "Sessions").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Token").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("DeviceId").SetMaxSize(512)
		table.ColMap("Roles").SetMaxSize(64)
		table.ColMap("Props").SetMaxSize(1000)
	}

	return us
}

func (me SqlSessionStore) CreateIndexesIfNotExists() {
	me.CreateIndexIfNotExists("idx_sessions_user_id", "Sessions", "UserId")
	me.CreateIndexIfNotExists("idx_sessions_token", "Sessions", "Token")
	me.CreateIndexIfNotExists("idx_sessions_expires_at", "Sessions", "ExpiresAt")
	me.CreateIndexIfNotExists("idx_sessions_create_at", "Sessions", "CreateAt")
	me.CreateIndexIfNotExists("idx_sessions_last_activity_at", "Sessions", "LastActivityAt")
}

func (me SqlSessionStore) Save(session *model.Session) (*model.Session, *model.AppError) {
	if len(session.Id) > 0 {
		return nil, model.NewAppError("SqlSessionStore.Save", "store.sql_session.save.existing.app_error", nil, "id="+session.Id, http.StatusBadRequest)
	}

	session.PreSave()

	tcs := make(chan store.StoreResult, 1)
	go func() {
		teams, err := me.Team().GetTeamsForUser(session.UserId)
		tcs <- store.StoreResult{Data: teams, Err: err}
		close(tcs)
	}()

	if err := me.GetMaster().Insert(session); err != nil {
		return nil, model.NewAppError("SqlSessionStore.Save", "store.sql_session.save.app_error", nil, "id="+session.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	rtcs := <-tcs

	if rtcs.Err != nil {
		return nil, model.NewAppError("SqlSessionStore.Save", "store.sql_session.save.app_error", nil, "id="+session.Id+", "+rtcs.Err.Error(), http.StatusInternalServerError)
	}

	tempMembers := rtcs.Data.([]*model.TeamMember)
	session.TeamMembers = make([]*model.TeamMember, 0, len(tempMembers))
	for _, tm := range tempMembers {
		if tm.DeleteAt == 0 {
			session.TeamMembers = append(session.TeamMembers, tm)
		}
	}

	return session, nil
}

func (me SqlSessionStore) Get(sessionIdOrToken string) (*model.Session, *model.AppError) {
	var sessions []*model.Session

	if _, err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE Token = :Token OR Id = :Id LIMIT 1", map[string]interface{}{"Token": sessionIdOrToken, "Id": sessionIdOrToken}); err != nil {
		return nil, model.NewAppError("SqlSessionStore.Get", "store.sql_session.get.app_error", nil, "sessionIdOrToken="+sessionIdOrToken+", "+err.Error(), http.StatusInternalServerError)
	} else if len(sessions) == 0 {
		return nil, model.NewAppError("SqlSessionStore.Get", "store.sql_session.get.app_error", nil, "sessionIdOrToken="+sessionIdOrToken, http.StatusNotFound)
	}
	session := sessions[0]

	tempMembers, err := me.Team().GetTeamsForUser(sessions[0].UserId)
	if err != nil {
		return nil, model.NewAppError("SqlSessionStore.Get", "store.sql_session.get.app_error", nil, "sessionIdOrToken="+sessionIdOrToken+", "+err.Error(), http.StatusInternalServerError)
	}
	sessions[0].TeamMembers = make([]*model.TeamMember, 0, len(tempMembers))
	for _, tm := range tempMembers {
		if tm.DeleteAt == 0 {
			sessions[0].TeamMembers = append(sessions[0].TeamMembers, tm)
		}
	}
	return session, nil
}

func (me SqlSessionStore) GetSessions(userId string) ([]*model.Session, *model.AppError) {
	var sessions []*model.Session

	tcs := make(chan store.StoreResult, 1)
	go func() {
		teams, err := me.Team().GetTeamsForUser(userId)
		tcs <- store.StoreResult{Data: teams, Err: err}
		close(tcs)
	}()
	if _, err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE UserId = :UserId ORDER BY LastActivityAt DESC", map[string]interface{}{"UserId": userId}); err != nil {
		return nil, model.NewAppError("SqlSessionStore.GetSessions", "store.sql_session.get_sessions.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	rtcs := <-tcs
	if rtcs.Err != nil {
		return nil, model.NewAppError("SqlSessionStore.GetSessions", "store.sql_session.get_sessions.app_error", nil, rtcs.Err.Error(), http.StatusInternalServerError)
	}

	for _, session := range sessions {
		tempMembers := rtcs.Data.([]*model.TeamMember)
		session.TeamMembers = make([]*model.TeamMember, 0, len(tempMembers))
		for _, tm := range tempMembers {
			if tm.DeleteAt == 0 {
				session.TeamMembers = append(session.TeamMembers, tm)
			}
		}
	}
	return sessions, nil
}

func (me SqlSessionStore) GetSessionsWithActiveDeviceIds(userId string) ([]*model.Session, *model.AppError) {
	query :=
		`SELECT *
		FROM
			Sessions
		WHERE
			UserId = :UserId AND
			ExpiresAt != 0 AND
			:ExpiresAt <= ExpiresAt AND
			DeviceId != ''`

	var sessions []*model.Session

	_, err := me.GetReplica().Select(&sessions, query, map[string]interface{}{"UserId": userId, "ExpiresAt": model.GetMillis()})
	if err != nil {
		return nil, model.NewAppError("SqlSessionStore.GetActiveSessionsWithDeviceIds", "store.sql_session.get_sessions.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return sessions, nil
}

func (me SqlSessionStore) Remove(sessionIdOrToken string) *model.AppError {
	_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE Id = :Id Or Token = :Token", map[string]interface{}{"Id": sessionIdOrToken, "Token": sessionIdOrToken})
	if err != nil {
		return model.NewAppError("SqlSessionStore.RemoveSession", "store.sql_session.remove.app_error", nil, "id="+sessionIdOrToken+", err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (me SqlSessionStore) RemoveAllSessions() *model.AppError {
	_, err := me.GetMaster().Exec("DELETE FROM Sessions")
	if err != nil {
		return model.NewAppError("SqlSessionStore.RemoveAllSessions", "store.sql_session.remove_all_sessions_for_team.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (me SqlSessionStore) PermanentDeleteSessionsByUser(userId string) *model.AppError {
	_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return model.NewAppError("SqlSessionStore.RemoveAllSessionsForUser", "store.sql_session.permanent_delete_sessions_by_user.app_error", nil, "id="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (me SqlSessionStore) UpdateLastActivityAt(sessionId string, time int64) *model.AppError {
	_, err := me.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = :LastActivityAt WHERE Id = :Id", map[string]interface{}{"LastActivityAt": time, "Id": sessionId})
	if err != nil {
		return model.NewAppError("SqlSessionStore.UpdateLastActivityAt", "store.sql_session.update_last_activity.app_error", nil, "sessionId="+sessionId, http.StatusInternalServerError)
	}
	return nil
}

func (me SqlSessionStore) UpdateRoles(userId, roles string) (string, *model.AppError) {
	query := "UPDATE Sessions SET Roles = :Roles WHERE UserId = :UserId"

	_, err := me.GetMaster().Exec(query, map[string]interface{}{"Roles": roles, "UserId": userId})
	if err != nil {
		return "", model.NewAppError("SqlSessionStore.UpdateRoles", "store.sql_session.update_roles.app_error", nil, "userId="+userId, http.StatusInternalServerError)
	}
	return userId, nil
}

func (me SqlSessionStore) UpdateDeviceId(id string, deviceId string, expiresAt int64) (string, *model.AppError) {
	query := "UPDATE Sessions SET DeviceId = :DeviceId, ExpiresAt = :ExpiresAt WHERE Id = :Id"

	_, err := me.GetMaster().Exec(query, map[string]interface{}{"DeviceId": deviceId, "Id": id, "ExpiresAt": expiresAt})
	if err != nil {
		return "", model.NewAppError("SqlSessionStore.UpdateDeviceId", "store.sql_session.update_device_id.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return deviceId, nil
}

func (me SqlSessionStore) UpdateProps(session *model.Session) *model.AppError {
	oldSession, appErr := me.Get(session.Id)
	if appErr != nil {
		return appErr
	}
	oldSession.Props = session.Props

	count, err := me.GetMaster().Update(oldSession)
	if err != nil {
		return model.NewAppError("SqlSessionStore.UpdateProps", "store.sql_session.update_props.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count != 1 {
		return model.NewAppError("SqlSessionStore.UpdateProps", "store.sql_session.update_props.app_error", nil, "", http.StatusInternalServerError)
	}
	return nil
}

func (me SqlSessionStore) AnalyticsSessionCount() (int64, *model.AppError) {
	query :=
		`SELECT
			COUNT(*)
		FROM
			Sessions
		WHERE ExpiresAt > :Time`
	count, err := me.GetReplica().SelectInt(query, map[string]interface{}{"Time": model.GetMillis()})
	if err != nil {
		return int64(0), model.NewAppError("SqlSessionStore.AnalyticsSessionCount", "store.sql_session.analytics_session_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return count, nil
}

func (me SqlSessionStore) Cleanup(expiryTime int64, batchSize int64) {
	mlog.Debug("Cleaning up session store.")

	var query string
	if me.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions WHERE Id = any (array (SELECT Id FROM Sessions WHERE ExpiresAt != 0 AND :ExpiresAt > ExpiresAt LIMIT :Limit))"
	} else {
		query = "DELETE FROM Sessions WHERE ExpiresAt != 0 AND :ExpiresAt > ExpiresAt LIMIT :Limit"
	}

	var rowsAffected int64 = 1

	for rowsAffected > 0 {
		if sqlResult, err := me.GetMaster().Exec(query, map[string]interface{}{"ExpiresAt": expiryTime, "Limit": batchSize}); err != nil {
			mlog.Error("Unable to cleanup session store.", mlog.Err(err))
			return
		} else {
			var rowErr error
			rowsAffected, rowErr = sqlResult.RowsAffected()
			if rowErr != nil {
				mlog.Error("Unable to cleanup session store.", mlog.Err(err))
				return
			}
		}

		time.Sleep(SESSIONS_CLEANUP_DELAY_MILLISECONDS * time.Millisecond)
	}
}
