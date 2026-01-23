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

func (s *SqlDesktopTokensStore) GetUserId(token string, minCreateAt int64) (*string, error) {
	query := s.getQueryBuilder().
		Select("UserId").
		From("DesktopTokens").
		Where(sq.And{
			sq.Eq{"Token": token},
			sq.GtOrEq{"CreateAt": minCreateAt},
		})

	dt := struct{ UserId string }{}
	err := s.GetReplica().GetBuilder(&dt, query)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("DesktopTokens", token)
		}
		return nil, errors.Wrapf(err, "No token for %s", token)
	}

	return &dt.UserId, nil
}

func (s *SqlDesktopTokensStore) Insert(token string, createAt int64, userId string) error {
	builder := s.getQueryBuilder().
		Insert("DesktopTokens").
		Columns("Token", "CreateAt", "UserId").
		Values(token, createAt, userId)

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "insert_desktoptokens_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to insert token row")
	}

	return nil
}

func (s *SqlDesktopTokensStore) Delete(token string) error {
	builder := s.getQueryBuilder().
		Delete("DesktopTokens").
		Where(sq.Eq{
			"Token": token,
		})

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "delete_desktoptokens_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
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

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete token row")
	}
	return nil
}

func (s *SqlDesktopTokensStore) DeleteOlderThan(minCreateAt int64) error {
	builder := s.getQueryBuilder().
		Delete("DesktopTokens").
		Where(sq.Lt{
			"CreateAt": minCreateAt,
		})

	query, args, err := builder.ToSql()

	if err != nil {
		return errors.Wrap(err, "delete_old_desktoptokens_tosql")
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to delete token row")
	}
	return nil
}
