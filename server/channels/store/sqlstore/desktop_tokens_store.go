// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	sq "github.com/mattermost/squirrel"
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
		return nil, fmt.Errorf("No token for %s: %w", token, err)
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
		return fmt.Errorf("insert_desktoptokens_tosql: %w", err)
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return fmt.Errorf("failed to insert token row: %w", err)
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
		return fmt.Errorf("delete_desktoptokens_tosql: %w", err)
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return fmt.Errorf("failed to delete token row: %w", err)
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
		return fmt.Errorf("delete_by_userid_desktoptokens_tosql: %w", err)
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return fmt.Errorf("failed to delete token row: %w", err)
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
		return fmt.Errorf("delete_old_desktoptokens_tosql: %w", err)
	}

	if _, err = s.GetMaster().Exec(query, args...); err != nil {
		return fmt.Errorf("failed to delete token row: %w", err)
	}
	return nil
}
