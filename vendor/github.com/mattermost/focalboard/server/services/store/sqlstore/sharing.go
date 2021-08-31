package sqlstore

import (
	"time"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/store"

	sq "github.com/Masterminds/squirrel"
)

func (s *SQLStore) UpsertSharing(c store.Container, sharing model.Sharing) error {
	now := time.Now().Unix()

	query := s.getQueryBuilder().
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
	if s.dbType == mysqlDBType {
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

func (s *SQLStore) GetSharing(c store.Container, rootID string) (*model.Sharing, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"enabled",
			"token",
			"modified_by",
			"update_at",
		).
		From(s.tablePrefix + "sharing").
		Where(sq.Eq{"id": rootID})
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
