// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"

	"github.com/jmoiron/sqlx"
)

// 'IF NOT EXISTS' syntax is not supported in Postgres 9.4, so we need
// this workaround to make the migration idempotent
var createPGIndex = func(indexName, tableName, columns string) string {
	return fmt.Sprintf(`
		DO
		$$
		BEGIN
			IF to_regclass('%s') IS NULL THEN
				CREATE INDEX %s ON %s (%s);
			END IF;
		END
		$$;
	`, indexName, indexName, tableName, columns)
}

// 'IF NOT EXISTS' syntax is not supported in Postgres 9.4, so we need
// this workaround to make the migration idempotent
var createUniquePGIndex = func(indexName, tableName, columns string) string {
	return fmt.Sprintf(`
		DO
		$$
		BEGIN
			IF to_regclass('%s') IS NULL THEN
				CREATE UNIQUE INDEX %s ON %s (%s);
			END IF;
		END
		$$;
	`, indexName, indexName, tableName, columns)
}

var addColumnToPGTable = func(e sqlx.Ext, tableName, columnName, columnType string) error {
	_, err := e.Exec(fmt.Sprintf(`
		DO
		$$
		BEGIN
			ALTER TABLE %s ADD %s %s;
		EXCEPTION
			WHEN duplicate_column THEN
				RAISE NOTICE 'Ignoring ALTER TABLE statement. Column "%s" already exists in table "%s".';
		END
		$$;
	`, tableName, columnName, columnType, columnName, tableName))

	return err
}

var changeColumnTypeToPGTable = func(e sqlx.Ext, tableName, columnName, columnType string) error {
	_, err := e.Exec(fmt.Sprintf(`
		DO
		$$
		BEGIN
			ALTER TABLE %s ALTER COLUMN %s TYPE %s;
		EXCEPTION
			WHEN others THEN
				RAISE NOTICE 'Ignoring ALTER TABLE statement. Column "%s" can not be changed to type %s in table "%s".';
		END
		$$;
	`, tableName, columnName, columnType, columnName, columnType, tableName))

	return err
}

var addColumnToMySQLTable = func(e sqlx.Ext, tableName, columnName, columnType string) error {
	var result int
	err := e.QueryRowx(
		"SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
		tableName,
		columnName,
	).Scan(&result)

	// Only alter the table if we don't find the column
	if err == sql.ErrNoRows {
		_, err = e.Exec(fmt.Sprintf("ALTER TABLE %s ADD %s %s", tableName, columnName, columnType))
	}

	return err
}

var renameColumnMySQL = func(e sqlx.Ext, tableName, oldColName, newColName, colDatatype string) error {
	var result int
	err := e.QueryRowx(
		"SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
		tableName,
		newColName,
	).Scan(&result)

	// Only alter the table if we don't find the column
	if err == sql.ErrNoRows {
		_, err = e.Exec(fmt.Sprintf("ALTER TABLE %s CHANGE %s %s %s", tableName, oldColName, newColName, colDatatype))
	}

	return err
}

var renameColumnPG = func(e sqlx.Ext, tableName, oldColName, newColName string) error {
	_, err := e.Exec(fmt.Sprintf(`
		DO
		$$
		BEGIN
			ALTER TABLE %s RENAME COLUMN %s TO %s;
		EXCEPTION
			WHEN others THEN
				RAISE NOTICE 'Ignoring ALTER TABLE statement. Column "%s" does not exist in table "%s".';
		END
		$$;
	`, tableName, oldColName, newColName, oldColName, tableName))

	return err
}

var dropColumnMySQL = func(e sqlx.Ext, tableName, colName string) error {
	var result int
	err := e.QueryRowx(
		"SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
		tableName,
		colName,
	).Scan(&result)

	if err == sql.ErrNoRows {
		return nil
	}

	// Only alter the table if we find the column
	if err == nil && result == 1 {
		_, err = e.Exec(fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", tableName, colName))
	}

	return err
}

var dropColumnPG = func(e sqlx.Ext, tableName, colName string) error {
	_, err := e.Exec(fmt.Sprintf(`
		DO
		$$
		BEGIN
			ALTER TABLE %s DROP COLUMN %s;
		EXCEPTION
			WHEN others THEN
				RAISE NOTICE 'Ignoring ALTER TABLE statement. Column "%s" does not exist in table "%s".';
		END
		$$;
	`, tableName, colName, colName, tableName))

	return err
}

func addPrimaryKey(e sqlx.Ext, sqlStore *SQLStore, tableName, primaryKey string) error {
	hasPK := 0

	dbSelectionLine := "AND tco.table_schema = (SELECT DATABASE())"
	if e.DriverName() == model.DatabaseDriverPostgres {
		dbSelectionLine = "AND tco.table_catalog = (SELECT current_database())"
	}

	if err := sqlStore.db.Get(&hasPK, fmt.Sprintf(`
		SELECT 1 FROM information_schema.table_constraints tco
		WHERE tco.table_name = '%s'
		%s
		AND tco.constraint_type = 'PRIMARY KEY'
	`, tableName, dbSelectionLine)); err != nil && err != sql.ErrNoRows {
		return errors.Wrap(err, "unable to determine if a primary key exists")
	}

	if hasPK == 0 {
		if _, err := e.Exec(fmt.Sprintf(`
			ALTER TABLE %s ADD PRIMARY KEY %s
		`, tableName, primaryKey)); err != nil {
			return errors.Wrap(err, "unable to add a primary key")
		}
	}

	return nil
}

func dropIndexIfExists(e sqlx.Ext, sqlStore *SQLStore, tableName, indexName string) error {
	hasIndex := 0

	if e.DriverName() == model.DatabaseDriverMysql {
		if err := sqlStore.db.Get(&hasIndex, fmt.Sprintf(`
			SELECT 1 FROM information_schema.statistics s
			WHERE s.table_name = '%s'
			AND s.index_schema = (SELECT DATABASE())
			AND index_name = '%s'
		`, tableName, indexName)); err != nil && err != sql.ErrNoRows {
			return errors.Wrapf(err, "unable to determine if index %s on table %s exists", indexName, tableName)
		}

		if hasIndex == 1 {
			if _, err := e.Exec(fmt.Sprintf("DROP INDEX %s ON %s", indexName, tableName)); err != nil {
				return errors.Wrapf(err, "failed to drop index %s on table %s", indexName, tableName)
			}
		}
	} else if e.DriverName() == model.DatabaseDriverPostgres {
		if _, err := e.Exec(fmt.Sprintf("DROP INDEX IF EXISTS %s", indexName)); err != nil {
			return errors.Wrapf(err, "failed to drop index %s on table %s", indexName, tableName)
		}
	}

	return nil
}

func columnExists(sqlStore *SQLStore, tableName, columnName string) (bool, error) {
	results := []string{}
	var err error
	if sqlStore.db.DriverName() == model.DatabaseDriverMysql {
		err = sqlStore.db.Select(&results, `
			SELECT COLUMN_NAME
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME = ?
			AND COLUMN_NAME = ?
		`, tableName, columnName)
	} else if sqlStore.db.DriverName() == model.DatabaseDriverPostgres {
		err = sqlStore.db.Select(&results, `
			SELECT COLUMN_NAME
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_NAME = $1
			AND COLUMN_NAME = $2
		`, strings.ToLower(tableName), strings.ToLower(columnName))
	}

	return len(results) > 0, err
}

type TableInfo struct {
	TableName              string
	ColumnName             string
	DataType               string
	IsNullable             string
	ColumnKey              string
	ColumnDefault          *string
	Extra                  string
	CharacterMaximumLength *string
}

// getDBSchemaInfo returns info for each table created by Playbook plugin
func getDBSchemaInfo(store *SQLStore) ([]TableInfo, error) {
	var results []TableInfo
	var err error

	if store.db.DriverName() == model.DatabaseDriverMysql {
		err = store.db.Select(&results, `
			SELECT
				TABLE_NAME as TableName, COLUMN_NAME as ColumnName, DATA_TYPE as DataType,
				IS_NULLABLE as IsNullable, COLUMN_KEY as ColumnKey, COLUMN_DEFAULT as ColumnDefault,
				EXTRA as Extra, CHARACTER_MAXIMUM_LENGTH as CharacterMaximumLength

			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME LIKE 'IR_%'
			AND TABLE_NAME != 'IR_db_migrations'
			ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC
		`)
	} else if store.db.DriverName() == model.DatabaseDriverPostgres {
		err = store.db.Select(&results, `
			SELECT
				TABLE_NAME as TableName, COLUMN_NAME as ColumnName, DATA_TYPE as DataType,
				IS_NULLABLE as IsNullable, COLUMN_DEFAULT as ColumnDefault, CHARACTER_MAXIMUM_LENGTH as CharacterMaximumLength

			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE table_schema = 'public'
			AND TABLE_NAME LIKE 'ir_%'
			AND TABLE_NAME != 'ir_db_migrations'
			ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC
		`)
	}

	return results, err
}

type IndexInfo struct {
	TableName string
	IndexName string

	// Postgres specific field
	IndexDef string

	// MySQL specific fields
	ColumnName string
}

// getDBIndexesInfo returns index info for each table created by Playbook plugin
func getDBIndexesInfo(store *SQLStore) ([]IndexInfo, error) {
	var results []IndexInfo
	var err error

	if store.db.DriverName() == model.DatabaseDriverMysql {
		err = store.db.Select(&results, `
			SELECT TABLE_NAME as TableName, INDEX_NAME as IndexName, COLUMN_NAME as ColumnName
			FROM INFORMATION_SCHEMA.STATISTICS
			WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME LIKE 'ir_%'
			AND TABLE_NAME != 'ir_db_migrations'
			ORDER BY TABLE_NAME ASC, COLUMN_NAME ASC, INDEX_NAME ASC;
		`)
	} else if store.db.DriverName() == model.DatabaseDriverPostgres {
		err = store.db.Select(&results, `
			SELECT TABLENAME as TableName, INDEXNAME as IndexName, INDEXDEF as IndexDef
			FROM pg_indexes
			WHERE SCHEMANAME = 'public'
			AND TABLENAME LIKE 'ir_%'
			AND TABLENAME != 'ir_db_migrations'
			ORDER BY TABLENAME ASC, INDEXNAME ASC;
		`)
	}

	return results, err
}

type ConstraintsInfo struct {
	ConstraintName string
	TableName      string
	ConstraintType string
}

// getDBIndexesInfo returns index info for each table created by Playbook plugin
func getDBConstraintsInfo(store *SQLStore) ([]ConstraintsInfo, error) {
	var results []ConstraintsInfo
	var err error

	if store.db.DriverName() == model.DatabaseDriverMysql {
		err = store.db.Select(&results, `
			SELECT CONSTRAINT_NAME as ConstraintName, TABLE_NAME as TableName, CONSTRAINT_TYPE as ConstraintType
			FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
			WHERE TABLE_NAME LIKE 'ir_%'
			AND TABLE_NAME != 'ir_db_migrations'
			AND TABLE_SCHEMA = (SELECT DATABASE())
			ORDER BY CONSTRAINT_NAME ASC, TABLE_NAME ASC;
		`)
	} else if store.db.DriverName() == model.DatabaseDriverPostgres {
		err = store.db.Select(&results, `
			SELECT conname as ConstraintName, contype as ConstraintType
			FROM pg_constraint
			WHERE conname LIKE 'ir_%'
			AND conname NOT LIKE 'ir_db_migrations%'
			ORDER BY conname ASC, contype ASC;
		`)
	}

	return results, err
}
