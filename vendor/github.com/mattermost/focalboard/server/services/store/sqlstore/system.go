package sqlstore

func (s *SQLStore) GetSystemSettings() (map[string]string, error) {
	query := s.getQueryBuilder().Select("*").From(s.tablePrefix + "system_settings")

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

func (s *SQLStore) SetSystemSetting(id, value string) error {
	query := s.getQueryBuilder().Insert(s.tablePrefix+"system_settings").Columns("id", "value").Values(id, value)

	if s.dbType == mysqlDBType {
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
