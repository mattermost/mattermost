package sqlstore

import (
	"encoding/json"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/focalboard/server/model"
)

// GetActiveUserCount returns the number of users with active sessions within N seconds ago.
func (s *SQLStore) GetActiveUserCount(updatedSecondsAgo int64) (int, error) {
	query := s.getQueryBuilder().
		Select("count(distinct user_id)").
		From(s.tablePrefix + "sessions").
		Where(sq.Gt{"update_at": time.Now().Unix() - updatedSecondsAgo})

	row := query.QueryRow()

	var count int
	err := row.Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *SQLStore) GetSession(token string, expireTime int64) (*model.Session, error) {
	query := s.getQueryBuilder().
		Select("id", "token", "user_id", "auth_service", "props").
		From(s.tablePrefix + "sessions").
		Where(sq.Eq{"token": token}).
		Where(sq.Gt{"update_at": time.Now().Unix() - expireTime})

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

func (s *SQLStore) CreateSession(session *model.Session) error {
	now := time.Now().Unix()

	propsBytes, err := json.Marshal(session.Props)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder().Insert(s.tablePrefix+"sessions").
		Columns("id", "token", "user_id", "auth_service", "props", "create_at", "update_at").
		Values(session.ID, session.Token, session.UserID, session.AuthService, propsBytes, now, now)

	_, err = query.Exec()
	return err
}

func (s *SQLStore) RefreshSession(session *model.Session) error {
	now := time.Now().Unix()

	query := s.getQueryBuilder().Update(s.tablePrefix+"sessions").
		Where(sq.Eq{"token": session.Token}).
		Set("update_at", now)

	_, err := query.Exec()
	return err
}

func (s *SQLStore) UpdateSession(session *model.Session) error {
	now := time.Now().Unix()

	propsBytes, err := json.Marshal(session.Props)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder().Update(s.tablePrefix+"sessions").
		Where(sq.Eq{"token": session.Token}).
		Set("update_at", now).
		Set("props", propsBytes)

	_, err = query.Exec()
	return err
}

func (s *SQLStore) DeleteSession(sessionID string) error {
	query := s.getQueryBuilder().Delete(s.tablePrefix + "sessions").
		Where(sq.Eq{"id": sessionID})

	_, err := query.Exec()
	return err
}

func (s *SQLStore) CleanUpSessions(expireTime int64) error {
	query := s.getQueryBuilder().Delete(s.tablePrefix + "sessions").
		Where(sq.Lt{"update_at": time.Now().Unix() - expireTime})

	_, err := query.Exec()
	return err
}
