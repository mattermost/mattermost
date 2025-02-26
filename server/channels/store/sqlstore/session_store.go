// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"fmt"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	sessionsCleanupDelay = 100 * time.Millisecond
)

type SqlSessionStore struct {
	*SqlStore
}

func newSqlSessionStore(sqlStore *SqlStore) store.SessionStore {
	return &SqlSessionStore{sqlStore}
}

func (me SqlSessionStore) Save(c request.CTX, session *model.Session) (*model.Session, error) {
	if session.Id != "" {
		return nil, store.NewErrInvalidInput("Session", "id", session.Id)
	}

	session.PreSave()

	if err := session.IsValid(); err != nil {
		return nil, err
	}
	jsonProps, err := json.Marshal(session.Props)
	if err != nil {
		return nil, errors.Wrap(err, "failed marshalling session props")
	}

	if me.IsBinaryParamEnabled() {
		jsonProps = AppendBinaryFlag(jsonProps)
	}

	query, args, err := me.getQueryBuilder().
		Insert("Sessions").
		Columns("Id", "Token", "CreateAt", "ExpiresAt", "LastActivityAt", "UserId", "DeviceId", "Roles", "IsOAuth", "ExpiredNotify", "Props").
		Values(session.Id, session.Token, session.CreateAt, session.ExpiresAt, session.LastActivityAt, session.UserId, session.DeviceId, session.Roles, session.IsOAuth, session.ExpiredNotify, jsonProps).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "sessions_tosql")
	}
	if _, err = me.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to save Session with id=%s", session.Id)
	}

	teamMembers, err := me.Team().GetTeamsForUser(c, session.UserId, "", true)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers for Session with userId=%s", session.UserId)
	}

	session.TeamMembers = make([]*model.TeamMember, 0, len(teamMembers))
	for _, tm := range teamMembers {
		if tm.DeleteAt == 0 {
			session.TeamMembers = append(session.TeamMembers, tm)
		}
	}

	return session, nil
}

func (me SqlSessionStore) Get(c request.CTX, sessionIdOrToken string) (*model.Session, error) {
	sessions := []*model.Session{}

	if err := me.DBXFromContext(c.Context()).Select(&sessions, "SELECT * FROM Sessions WHERE Token = ? OR Id = ? LIMIT 1", sessionIdOrToken, sessionIdOrToken); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with sessionIdOrToken=%s", sessionIdOrToken)
	}
	if len(sessions) == 0 {
		return nil, store.NewErrNotFound("Session", fmt.Sprintf("sessionIdOrToken=%s", sessionIdOrToken))
	}
	session := sessions[0]

	tempMembers, err := me.Team().GetTeamsForUser(
		RequestContextWithMaster(c),
		session.UserId, "", true)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers for Session with userId=%s", session.UserId)
	}
	sessions[0].TeamMembers = make([]*model.TeamMember, 0, len(tempMembers))
	for _, tm := range tempMembers {
		if tm.DeleteAt == 0 {
			sessions[0].TeamMembers = append(sessions[0].TeamMembers, tm)
		}
	}
	return session, nil
}

func (me SqlSessionStore) GetSessions(c request.CTX, userId string) ([]*model.Session, error) {
	sessions := []*model.Session{}

	if err := me.GetReplica().Select(&sessions, "SELECT * FROM Sessions WHERE UserId = ? ORDER BY LastActivityAt DESC", userId); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with userId=%s", userId)
	}

	teamMembers, err := me.Team().GetTeamsForUser(c, userId, "", true)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find TeamMembers for Session with userId=%s", userId)
	}

	for _, session := range sessions {
		session.TeamMembers = make([]*model.TeamMember, 0, len(teamMembers))
		for _, tm := range teamMembers {
			if tm.DeleteAt == 0 {
				session.TeamMembers = append(session.TeamMembers, tm)
			}
		}
	}
	return sessions, nil
}

// GetLRUSessions gets the Least Recently Used sessions from the store. Note: the use of limit and offset
// are intentional; they are hardcoded from the app layer (i.e., will not result in a non-performant query).
func (me SqlSessionStore) GetLRUSessions(c request.CTX, userId string, limit uint64, offset uint64) ([]*model.Session, error) {
	builder := me.getQueryBuilder().
		Select("*").
		From("Sessions").
		Where(sq.Eq{"UserId": userId}).
		OrderBy("LastActivityAt DESC").
		Limit(limit).
		Offset(offset)
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_lru_sessions_tosql")
	}

	var sessions []*model.Session
	if err := me.GetReplica().Select(&sessions, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with userId=%s", userId)
	}
	return sessions, nil
}

func (me SqlSessionStore) GetSessionsWithActiveDeviceIds(userId string) ([]*model.Session, error) {
	lastRemovedQuery := `DeviceId != COALESCE(Props->>'last_removed_device_id', '')`
	if me.DriverName() == model.DatabaseDriverMysql {
		lastRemovedQuery = `DeviceId != COALESCE(Props->>'$.last_removed_device_id', '')`
	}
	query :=
		`SELECT *
		FROM
			Sessions
		WHERE
			UserId = ? AND
			ExpiresAt != 0 AND
			? <= ExpiresAt AND
			DeviceId != '' AND
			` + lastRemovedQuery

	sessions := []*model.Session{}

	if err := me.GetReplica().Select(&sessions, query, userId, model.GetMillis()); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with userId=%s", userId)
	}
	return sessions, nil
}

func (me SqlSessionStore) GetMobileSessionMetadata() ([]*model.MobileSessionMetadata, error) {
	versionProp := model.SessionPropMobileVersion
	notificationDisabledProp := model.SessionPropDeviceNotificationDisabled
	platformQuery := "NULLIF(SPLIT_PART(deviceid, ':', 1), '')"
	if me.DriverName() == model.DatabaseDriverMysql {
		versionProp = "$." + versionProp
		notificationDisabledProp = "$." + notificationDisabledProp
		platformQuery = "NULLIF(SUBSTRING_INDEX(deviceid, ':', 1), deviceid)"
	}

	query, args, err := me.getQueryBuilder().
		Select(fmt.Sprintf(
			"COUNT(userid) AS Count, COALESCE(%s,'N/A') AS Platform, COALESCE(props->>'%s','N/A') AS Version, COALESCE(props->>'%s','false') as NotificationDisabled",
			platformQuery,
			versionProp,
			notificationDisabledProp,
		)).
		From("Sessions").
		GroupBy("Platform", "Version", "NotificationDisabled").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "sessions_tosql")
	}

	versions := []*model.MobileSessionMetadata{}
	err = me.GetReplica().Select(&versions, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed get mobile session metadata")
	}
	return versions, nil
}

func (me SqlSessionStore) GetSessionsExpired(thresholdMillis int64, mobileOnly bool, unnotifiedOnly bool) ([]*model.Session, error) {
	now := model.GetMillis()
	builder := me.getQueryBuilder().
		Select("*").
		From("Sessions").
		Where(sq.NotEq{"ExpiresAt": 0}).
		Where(sq.Lt{"ExpiresAt": now}).
		Where(sq.Gt{"ExpiresAt": now - thresholdMillis})
	if mobileOnly {
		builder = builder.Where(sq.NotEq{"DeviceId": ""})
	}
	if unnotifiedOnly {
		builder = builder.Where(sq.NotEq{"ExpiredNotify": true})
	}

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "sessions_tosql")
	}

	sessions := []*model.Session{}

	err = me.GetReplica().Select(&sessions, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Sessions")
	}
	return sessions, nil
}

func (me SqlSessionStore) UpdateExpiredNotify(sessionId string, notified bool) error {
	query, args, err := me.getQueryBuilder().
		Update("Sessions").
		Set("ExpiredNotify", notified).
		Where(sq.Eq{"Id": sessionId}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "sessions_tosql")
	}

	_, err = me.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update Session with id=%s", sessionId)
	}
	return nil
}

func (me SqlSessionStore) Remove(sessionIdOrToken string) error {
	_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE Id = ? Or Token = ?", sessionIdOrToken, sessionIdOrToken)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Session with sessionIdOrToken=%s", sessionIdOrToken)
	}
	return nil
}

func (me SqlSessionStore) RemoveAllSessions() error {
	_, err := me.GetMaster().Exec("DELETE FROM Sessions")
	if err != nil {
		return errors.Wrap(err, "failed to delete all Sessions")
	}
	return nil
}

func (me SqlSessionStore) PermanentDeleteSessionsByUser(userId string) error {
	_, err := me.GetMaster().Exec("DELETE FROM Sessions WHERE UserId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Session with userId=%s", userId)
	}

	return nil
}

func (me SqlSessionStore) UpdateExpiresAt(sessionId string, time int64) error {
	_, err := me.GetMaster().Exec("UPDATE Sessions SET ExpiresAt = ?, ExpiredNotify = false WHERE Id = ?", time, sessionId)
	if err != nil {
		return errors.Wrapf(err, "failed to update Session with sessionId=%s", sessionId)
	}
	return nil
}

func (me SqlSessionStore) UpdateLastActivityAt(sessionId string, time int64) error {
	_, err := me.GetMaster().Exec("UPDATE Sessions SET LastActivityAt = ? WHERE Id = ?", time, sessionId)
	if err != nil {
		return errors.Wrapf(err, "failed to update Session with id=%s", sessionId)
	}
	return nil
}

func (me SqlSessionStore) UpdateRoles(userId, roles string) (string, error) {
	if len(roles) > model.UserRolesMaxLength {
		return "", fmt.Errorf("given session roles length (%d) exceeds max storage limit (%d)", len(roles), model.UserRolesMaxLength)
	}

	_, err := me.GetMaster().Exec("UPDATE Sessions SET Roles = ? WHERE UserId = ?", roles, userId)
	if err != nil {
		return "", errors.Wrapf(err, "failed to update Session with userId=%s and roles=%s", userId, roles)
	}
	return userId, nil
}

func (me SqlSessionStore) UpdateDeviceId(id string, deviceId string, expiresAt int64) (string, error) {
	query := "UPDATE Sessions SET DeviceId = ?, ExpiresAt = ?, ExpiredNotify = false WHERE Id = ?"

	_, err := me.GetMaster().Exec(query, deviceId, expiresAt, id)
	if err != nil {
		return "", errors.Wrapf(err, "failed to update Session with id=%s", id)
	}
	return deviceId, nil
}

func (me SqlSessionStore) UpdateProps(session *model.Session) error {
	jsonProps, err := json.Marshal(session.Props)
	if err != nil {
		return errors.Wrap(err, "failed marshalling session props")
	}
	if me.IsBinaryParamEnabled() {
		jsonProps = AppendBinaryFlag(jsonProps)
	}
	query, args, err := me.getQueryBuilder().
		Update("Sessions").
		Set("Props", jsonProps).
		Where(sq.Eq{"Id": session.Id}).
		ToSql()
	if err != nil {
		errors.Wrap(err, "sessions_tosql")
	}
	_, err = me.GetMaster().Exec(query, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update Session")
	}
	return nil
}

func (me SqlSessionStore) AnalyticsSessionCount() (int64, error) {
	var count int64
	query :=
		`SELECT
			COUNT(*)
		FROM
			Sessions
		WHERE ExpiresAt > ?`
	if err := me.GetReplica().Get(&count, query, model.GetMillis()); err != nil {
		return int64(0), errors.Wrap(err, "failed to count Sessions")
	}
	return count, nil
}

func (me SqlSessionStore) Cleanup(expiryTime int64, batchSize int64) error {
	var query string
	if me.DriverName() == model.DatabaseDriverPostgres {
		query = "DELETE FROM Sessions WHERE Id IN (SELECT Id FROM Sessions WHERE ExpiresAt != 0 AND ? > ExpiresAt LIMIT ?)"
	} else {
		query = "DELETE FROM Sessions WHERE ExpiresAt != 0 AND ? > ExpiresAt LIMIT ?"
	}

	var rowsAffected int64 = 1

	for rowsAffected > 0 {
		sqlResult, err := me.GetMaster().Exec(query, expiryTime, batchSize)
		if err != nil {
			return errors.Wrap(err, "unable to delete sessions")
		}
		var rowErr error
		rowsAffected, rowErr = sqlResult.RowsAffected()
		if rowErr != nil {
			return errors.Wrap(err, "unable to delete sessions")
		}

		time.Sleep(sessionsCleanupDelay)
	}

	return nil
}
