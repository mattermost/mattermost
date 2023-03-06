package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// getSystemValue queries the IR_System table for the given key
func (sqlStore *SQLStore) getSystemValue(q queryer, key string) (string, error) {
	var value string

	err := sqlStore.getBuilder(q, &value,
		sq.Select("SValue").
			From("IR_System").
			Where(sq.Eq{"SKey": key}),
	)
	if err == sql.ErrNoRows {
		return "", nil
	} else if err != nil {
		return "", errors.Wrapf(err, "failed to query system key %s", key)
	}

	return value, nil
}

// setSystemValue updates the IR_System table for the given key.
func (sqlStore *SQLStore) setSystemValue(e queryExecer, key, value string) error {
	// MySQL reports 0 rows affected in the update below when the key and value
	// already exist. We can use its native support for upsert instead. Postgres
	// 9.4 does not have native support for upsert, but it reports 1 row
	// affected even when the key and value are already present.
	if sqlStore.db.DriverName() == model.DatabaseDriverMysql {
		_, err := sqlStore.execBuilder(e,
			sq.Insert("IR_System").
				Columns("SKey", "SValue").
				Values(key, value).
				Suffix("ON DUPLICATE KEY UPDATE SValue = ?", value),
		)

		return err
	}

	result, err := sqlStore.execBuilder(e,
		sq.Update("IR_System").
			Set("SValue", value).
			Where(sq.Eq{"SKey": key}),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to update system key %s", key)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		return nil
	}

	_, err = sqlStore.execBuilder(e,
		sq.Insert("IR_System").
			Columns("SKey", "SValue").
			Values(key, value),
	)
	if err != nil {
		return errors.Wrapf(err, "failed to insert system key %s", key)
	}

	return nil
}
