// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
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

func (me SqlSessionStore) Save(session *model.Session) (*model.Session, error) {
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
	if _, err = me.GetMasterX().Exec(query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to save Session with id=%s", session.Id)
	}

	teamMembers, err := me.Team().GetTeamsForUser(context.Background(), session.UserId, "", true)
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

func (me SqlSessionStore) Get(ctx context.Context, sessionIdOrToken string) (*model.Session, error) {
	sessions := []*model.Session{}

	if err := me.DBXFromContext(ctx).Select(&sessions, "SELECT * FROM Sessions WHERE Token = ? OR Id = ? LIMIT 1", sessionIdOrToken, sessionIdOrToken); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with sessionIdOrToken=%s", sessionIdOrToken)
	}
	if len(sessions) == 0 {
		return nil, store.NewErrNotFound("Session", fmt.Sprintf("sessionIdOrToken=%s", sessionIdOrToken))
	}
	session := sessions[0]

	tempMembers, err := me.Team().GetTeamsForUser(
		WithMaster(context.Background()),
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

func (me SqlSessionStore) GetSessions(userId string) ([]*model.Session, error) {
	sessions := []*model.Session{}

	if err := me.GetReplicaX().Select(&sessions, "SELECT * FROM Sessions WHERE UserId = ? ORDER BY LastActivityAt DESC", userId); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with userId=%s", userId)
	}

	teamMembers, err := me.Team().GetTeamsForUser(context.Background(), userId, "", true)
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

func (me SqlSessionStore) GetSessionsWithActiveDeviceIds(userId string) ([]*model.Session, error) {
	query :=
		`SELECT *
		FROM
			Sessions
		WHERE
			UserId = ? AND
			ExpiresAt != 0 AND
			? <= ExpiresAt AND
			DeviceId != ''`

	sessions := []*model.Session{}

	if err := me.GetReplicaX().Select(&sessions, query, userId, model.GetMillis()); err != nil {
		return nil, errors.Wrapf(err, "failed to find Sessions with userId=%s", userId)
	}
	return sessions, nil
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

	err = me.GetReplicaX().Select(&sessions, query, args...)
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

	_, err = me.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update Session with id=%s", sessionId)
	}
	return nil
}

func (me SqlSessionStore) Remove(sessionIdOrToken string) error {
	_, err := me.GetMasterX().Exec("DELETE FROM Sessions WHERE Id = ? Or Token = ?", sessionIdOrToken, sessionIdOrToken)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Session with sessionIdOrToken=%s", sessionIdOrToken)
	}
	return nil
}

func (me SqlSessionStore) RemoveAllSessions() error {
	_, err := me.GetMasterX().Exec("DELETE FROM Sessions")
	if err != nil {
		return errors.Wrap(err, "failed to delete all Sessions")
	}
	return nil
}

func (me SqlSessionStore) PermanentDeleteSessionsByUser(userId string) error {
	_, err := me.GetMasterX().Exec("DELETE FROM Sessions WHERE UserId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Session with userId=%s", userId)
	}

	return nil
}

func (me SqlSessionStore) UpdateExpiresAt(sessionId string, time int64) error {
	_, err := me.GetMasterX().Exec("UPDATE Sessions SET ExpiresAt = ?, ExpiredNotify = false WHERE Id = ?", time, sessionId)
	if err != nil {
		return errors.Wrapf(err, "failed to update Session with sessionId=%s", sessionId)
	}
	return nil
}

func (me *SqlSessionStore) GetLastSessionRowCreateAt() (int64, error) {
	query := `SELECT CREATEAT FROM Sessions ORDER BY CREATEAT DESC LIMIT 1`
	var createAt int64
	err := me.GetReplicaX().Get(&createAt, query)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to get last session createat")
	}

	return createAt, nil
}

func (me SqlSessionStore) UpdateLastActivityAt(sessionId string, time int64) error {
	_, err := me.GetMasterX().Exec("UPDATE Sessions SET LastActivityAt = ? WHERE Id = ?", time, sessionId)
	if err != nil {
		return errors.Wrapf(err, "failed to update Session with id=%s", sessionId)
	}
	return nil
}

func (me SqlSessionStore) UpdateRoles(userId, roles string) (string, error) {
	if len(roles) > model.UserRolesMaxLength {
		return "", fmt.Errorf("given session roles length (%d) exceeds max storage limit (%d)", len(roles), model.UserRolesMaxLength)
	}

	_, err := me.GetMasterX().Exec("UPDATE Sessions SET Roles = ? WHERE UserId = ?", roles, userId)
	if err != nil {
		return "", errors.Wrapf(err, "failed to update Session with userId=%s and roles=%s", userId, roles)
	}
	return userId, nil
}

func (me SqlSessionStore) UpdateDeviceId(id string, deviceId string, expiresAt int64) (string, error) {
	query := "UPDATE Sessions SET DeviceId = ?, ExpiresAt = ?, ExpiredNotify = false WHERE Id = ?"

	_, err := me.GetMasterX().Exec(query, deviceId, expiresAt, id)
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
	_, err = me.GetMasterX().Exec(query, args...)
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
	if err := me.GetReplicaX().Get(&count, query, model.GetMillis()); err != nil {
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
		sqlResult, err := me.GetMasterX().Exec(query, expiryTime, batchSize)
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
