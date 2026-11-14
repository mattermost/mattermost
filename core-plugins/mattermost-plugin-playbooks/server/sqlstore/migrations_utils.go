// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
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

var createPGGINIndex = func(indexName, tableName, column string) string {
	return fmt.Sprintf(`
		DO
		$$
		BEGIN
			IF to_regclass('%s') IS NULL THEN
				CREATE INDEX %s ON %s USING GIN (%s);
			END IF;
		END
		$$;
	`, indexName, indexName, tableName, column)
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
	if err := sqlStore.db.Get(&hasPK, fmt.Sprintf(`
		SELECT 1 FROM information_schema.table_constraints tco
		WHERE tco.table_name = '%s'
		AND tco.table_catalog = (SELECT current_database())
		AND tco.constraint_type = 'PRIMARY KEY'
	`, tableName)); err != nil && err != sql.ErrNoRows {
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
	if _, err := e.Exec(fmt.Sprintf("DROP INDEX IF EXISTS %s", indexName)); err != nil {
		return errors.Wrapf(err, "failed to drop index %s on table %s", indexName, tableName)
	}

	return nil
}

func columnExists(sqlStore *SQLStore, tableName, columnName string) (bool, error) {
	results := []string{}
	err := sqlStore.db.Select(&results, `
		SELECT COLUMN_NAME
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = $1
		AND COLUMN_NAME = $2
	`, strings.ToLower(tableName), strings.ToLower(columnName))

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
	err := store.db.Select(&results, `
		SELECT
			TABLE_NAME as TableName, COLUMN_NAME as ColumnName, DATA_TYPE as DataType,
			IS_NULLABLE as IsNullable, COLUMN_DEFAULT as ColumnDefault, CHARACTER_MAXIMUM_LENGTH as CharacterMaximumLength

		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_schema = 'public'
		AND TABLE_NAME LIKE 'ir_%'
		AND TABLE_NAME != 'ir_db_migrations'
		ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC
	`)

	return results, err
}

type IndexInfo struct {
	TableName string
	IndexName string
	IndexDef  string
}

// getDBIndexesInfo returns index info for each table created by Playbook plugin
func getDBIndexesInfo(store *SQLStore) ([]IndexInfo, error) {
	var results []IndexInfo
	err := store.db.Select(&results, `
		SELECT TABLENAME as TableName, INDEXNAME as IndexName, INDEXDEF as IndexDef
		FROM pg_indexes
		WHERE SCHEMANAME = 'public'
		AND TABLENAME LIKE 'ir_%'
		AND TABLENAME != 'ir_db_migrations'
		ORDER BY TABLENAME ASC, INDEXNAME ASC;
	`)

	return results, err
}

type ConstraintsInfo struct {
	ConstraintName string
	TableName      string
	ConstraintType string
}

// getDBConstraintsInfo returns constraint info for each table created by Playbook plugin
func getDBConstraintsInfo(store *SQLStore) ([]ConstraintsInfo, error) {
	var results []ConstraintsInfo
	err := store.db.Select(&results, `
		SELECT conname as ConstraintName, contype as ConstraintType
		FROM pg_constraint
		WHERE conname LIKE 'ir_%'
		AND conname NOT LIKE 'ir_db_migrations%'
		ORDER BY conname ASC, contype ASC;
	`)

	return results, err
}
