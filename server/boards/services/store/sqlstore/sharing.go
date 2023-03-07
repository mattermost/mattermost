// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/server/v7/boards/model"
	"github.com/mattermost/mattermost-server/server/v7/boards/utils"

	sq "github.com/Masterminds/squirrel"
)

func (s *SQLStore) upsertSharing(db sq.BaseRunner, sharing model.Sharing) error {
	now := utils.GetMillis()

	query := s.getQueryBuilder(db).
		Insert(s.tablePrefix+"sharing").
		Columns(
			"id",
			"enabled",
			"token",
			"modified_by",
			"update_at",
		).
		Values(
			sharing.ID,
			sharing.Enabled,
			sharing.Token,
			sharing.ModifiedBy,
			now,
		)
	if s.dbType == model.MysqlDBType {
		query = query.Suffix("ON DUPLICATE KEY UPDATE enabled = ?, token = ?, modified_by = ?, update_at = ?",
			sharing.Enabled, sharing.Token, sharing.ModifiedBy, now)
	} else {
		query = query.Suffix(
			`ON CONFLICT (id)
			 DO UPDATE SET enabled = EXCLUDED.enabled, token = EXCLUDED.token, modified_by = EXCLUDED.modified_by, update_at = EXCLUDED.update_at`,
		)
	}

	_, err := query.Exec()
	return err
}

func (s *SQLStore) getSharing(db sq.BaseRunner, boardID string) (*model.Sharing, error) {
	query := s.getQueryBuilder(db).
		Select(
			"id",
			"enabled",
			"token",
			"modified_by",
			"update_at",
		).
		From(s.tablePrefix + "sharing").
		Where(sq.Eq{"id": boardID})
	row := query.QueryRow()
	sharing := model.Sharing{}

	err := row.Scan(
		&sharing.ID,
		&sharing.Enabled,
		&sharing.Token,
		&sharing.ModifiedBy,
		&sharing.UpdateAt,
	)
	if err != nil {
		return nil, err
	}

	return &sharing, nil
}
