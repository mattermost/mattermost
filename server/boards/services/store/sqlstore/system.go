// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

func (s *SQLStore) getSystemSetting(db sq.BaseRunner, key string) (string, error) {
	scanner := s.getQueryBuilder(db).
		Select("value").
		From(s.tablePrefix + "system_settings").
		Where(sq.Eq{"id": key}).
		QueryRow()

	var result string
	err := scanner.Scan(&result)
	if err != nil && !model.IsErrNotFound(err) {
		return "", err
	}

	return result, nil
}

func (s *SQLStore) getSystemSettings(db sq.BaseRunner) (map[string]string, error) {
	query := s.getQueryBuilder(db).Select("*").From(s.tablePrefix + "system_settings")

	rows, err := query.Query()
	if err != nil {
		return nil, err
	}
	defer s.CloseRows(rows)

	results := map[string]string{}

	for rows.Next() {
		var id string
		var value string

		err := rows.Scan(&id, &value)
		if err != nil {
			return nil, err
		}

		results[id] = value
	}

	return results, nil
}

func (s *SQLStore) setSystemSetting(db sq.BaseRunner, id, value string) error {
	query := s.getQueryBuilder(db).Insert(s.tablePrefix+"system_settings").Columns("id", "value").Values(id, value)

	if s.dbType == model.MysqlDBType {
		query = query.Suffix("ON DUPLICATE KEY UPDATE value = ?", value)
	} else {
		query = query.Suffix("ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value")
	}

	_, err := query.Exec()
	if err != nil {
		return err
	}

	return nil
}
