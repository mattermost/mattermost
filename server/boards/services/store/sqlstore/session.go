// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

// GetActiveUserCount returns the number of users with active sessions within N seconds ago.
func (s *SQLStore) getActiveUserCount(db sq.BaseRunner, updatedSecondsAgo int64) (int, error) {
	query := s.getQueryBuilder(db).
		Select("count(distinct user_id)").
		From(s.tablePrefix + "sessions").
		Where(sq.Gt{"update_at": utils.GetMillis() - utils.SecondsToMillis(updatedSecondsAgo)})

	row := query.QueryRow()

	var count int
	err := row.Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *SQLStore) getSession(db sq.BaseRunner, token string, expireTimeSeconds int64) (*model.Session, error) {
	query := s.getQueryBuilder(db).
		Select("id", "token", "user_id", "auth_service", "props").
		From(s.tablePrefix + "sessions").
		Where(sq.Eq{"token": token}).
		Where(sq.Gt{"update_at": utils.GetMillis() - utils.SecondsToMillis(expireTimeSeconds)})

	row := query.QueryRow()
	session := model.Session{}

	var propsBytes []byte
	err := row.Scan(&session.ID, &session.Token, &session.UserID, &session.AuthService, &propsBytes)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(propsBytes, &session.Props)
	if err != nil {
		return nil, err
	}

	return &session, nil
}

func (s *SQLStore) createSession(db sq.BaseRunner, session *model.Session) error {
	now := utils.GetMillis()

	propsBytes, err := json.Marshal(session.Props)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder(db).Insert(s.tablePrefix+"sessions").
		Columns("id", "token", "user_id", "auth_service", "props", "create_at", "update_at").
		Values(session.ID, session.Token, session.UserID, session.AuthService, propsBytes, now, now)

	_, err = query.Exec()
	return err
}

func (s *SQLStore) refreshSession(db sq.BaseRunner, session *model.Session) error {
	now := utils.GetMillis()

	query := s.getQueryBuilder(db).Update(s.tablePrefix+"sessions").
		Where(sq.Eq{"token": session.Token}).
		Set("update_at", now)

	_, err := query.Exec()
	return err
}

func (s *SQLStore) updateSession(db sq.BaseRunner, session *model.Session) error {
	now := utils.GetMillis()

	propsBytes, err := json.Marshal(session.Props)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder(db).Update(s.tablePrefix+"sessions").
		Where(sq.Eq{"token": session.Token}).
		Set("update_at", now).
		Set("props", propsBytes)

	_, err = query.Exec()
	return err
}

func (s *SQLStore) deleteSession(db sq.BaseRunner, sessionID string) error {
	query := s.getQueryBuilder(db).Delete(s.tablePrefix + "sessions").
		Where(sq.Eq{"id": sessionID})

	_, err := query.Exec()
	return err
}

func (s *SQLStore) cleanUpSessions(db sq.BaseRunner, expireTimeSeconds int64) error {
	query := s.getQueryBuilder(db).Delete(s.tablePrefix + "sessions").
		Where(sq.Lt{"update_at": utils.GetMillis() - utils.SecondsToMillis(expireTimeSeconds)})

	_, err := query.Exec()
	return err
}
