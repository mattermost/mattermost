// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlDesktopTokensStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface
}

func newSqlDesktopTokensStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.DesktopTokensStore {
	return &SqlDesktopTokensStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}
}

func (s *SqlDesktopTokensStore) GetUserId(desktopToken string, minCreatedAt int64) (string, error) {
	query := s.getQueryBuilder().
		Select("UserId").
		From("DesktopTokens").
		Where(sq.Eq{
			"DesktopToken": desktopToken,
		}).
		Where(sq.GtOrEq{
			"CreatedAt": minCreatedAt,
		})

	dt := struct{ UserId sql.NullString }{}
	err := s.GetReplicaX().GetBuilder(&dt, query)

	if err != nil {
		if err == sql.ErrNoRows {
			return "", store.NewErrNotFound("DesktopTokens", desktopToken)
		}
		return "", errors.Wrapf(err, "No token for %s", desktopToken)
	}

	// Check if the string is NULL, if so just return a blank string
	if dt.UserId.Valid {
		return dt.UserId.String, nil
	}

	return "", nil
}

func (s *SqlDesktopTokensStore) Insert(desktopToken string, createdAt int64, userId *string) error {
	builder := s.getQueryBuilder().
		Insert("DesktopTokens").
		Columns("DesktopToken", "CreatedAt", "UserId").
		Values(desktopToken, createdAt, userId)

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "insert_desktoptokens_tosql")
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to insert token row")
	}

	return nil
}

func (s *SqlDesktopTokensStore) SetUserId(desktopToken string, minCreatedAt int64, userId string) error {
	builder := s.getQueryBuilder().
		Update("DesktopTokens").
		Set("UserId", userId).
		Where(sq.Eq{
			"DesktopToken": desktopToken,
		}).
		Where(sq.GtOrEq{
			"CreatedAt": minCreatedAt,
		})

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "set_userid_desktoptokens_tosql")
	}

	result, err := s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrap(err, "failed to update token row")
	}

	num, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "nothing updated")
	}
	if num == 0 {
		return errors.New("no rows updated")
	}

	return nil
}

func (s *SqlDesktopTokensStore) Delete(desktopToken string) error {
	builder := s.getQueryBuilder().
		Delete("DesktopTokens").
		Where(sq.Eq{
			"DesktopToken": desktopToken,
		})

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "delete_desktoptokens_tosql")
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete token row")
	}
	return nil
}

func (s *SqlDesktopTokensStore) DeleteByUserId(userId string) error {
	builder := s.getQueryBuilder().
		Delete("DesktopTokens").
		Where(sq.Eq{
			"UserId": userId,
		})

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "delete_by_userid_desktoptokens_tosql")
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete token row")
	}
	return nil
}

func (s *SqlDesktopTokensStore) DeleteOlderThan(minCreatedAt int64) error {
	builder := s.getQueryBuilder().
		Delete("DesktopTokens").
		Where(sq.Lt{
			"CreatedAt": minCreatedAt,
		})

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "delete_old_desktoptokens_tosql")
	}

	if _, err = s.GetMasterX().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete token row")
	}
	return nil
}
