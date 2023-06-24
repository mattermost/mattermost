// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"strings"

	"text/template"

	sq "github.com/Masterminds/squirrel"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"

	"github.com/mattermost/morph"
	drivers "github.com/mattermost/morph/drivers"
	mysql "github.com/mattermost/morph/drivers/mysql"
	postgres "github.com/mattermost/morph/drivers/postgres"
	embedded "github.com/mattermost/morph/sources/embedded"

	_ "github.com/lib/pq" // postgres driver

	"github.com/mattermost/mattermost/server/v8/boards/model"
)

//go:embed migrations/*.sql
var Assets embed.FS

const (
	uniqueIDsMigrationRequiredVersion        = 14
	teamLessBoardsMigrationRequiredVersion   = 18
	categoriesUUIDIDMigrationRequiredVersion = 20
	deDuplicateCategoryBoards                = 35

	tempSchemaMigrationTableName = "temp_schema_migration"
)

var errChannelCreatorNotInTeam = errors.New("channel creator not found in user teams")

// migrations in MySQL need to run with the multiStatements flag
// enabled, so this method creates a new connection ensuring that it's
// enabled.
func (s *SQLStore) getMigrationConnection() (*sql.DB, error) {
	connectionString := s.connectionString
	if s.dbType == model.MysqlDBType {
		var err error
		connectionString, err = sqlstore.ResetReadTimeout(connectionString)
		if err != nil {
			return nil, err
		}

		connectionString, err = sqlstore.AppendMultipleStatementsFlag(connectionString)
		if err != nil {
			return nil, err
		}
	}

	var settings mm_model.SqlSettings
	settings.SetDefaults(false)
	if s.configFn != nil {
		settings = s.configFn().SqlSettings
	}
	*settings.DriverName = s.dbType

	db, err := sqlstore.SetupConnection("master", connectionString, &settings, sqlstore.DBPingAttempts)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func (s *SQLStore) Migrate() error {
	if err := s.EnsureSchemaMigrationFormat(); err != nil {
		return err
	}
	defer func() {
		// the old schema migration table deletion happens after the
		// migrations have run, to be able to recover its information
		// in case there would be errors during the process.
		if err := s.deleteOldSchemaMigrationTable(); err != nil {
			s.logger.Error("cannot delete the old schema migration table", mlog.Err(err))
		}
	}()

	var driver drivers.Driver
	var err error
	var db *sql.DB
	s.logger.Debug("Getting migrations connection")
	db, err = s.getMigrationConnection()
	if err != nil {
		return err
	}

	defer func() {
		s.logger.Debug("Closing migrations connection")
		db.Close()
	}()

	if s.dbType == model.PostgresDBType {
		driver, err = postgres.WithInstance(db)
		if err != nil {
			return err
		}
	}

	if s.dbType == model.MysqlDBType {
		driver, err = mysql.WithInstance(db)
		if err != nil {
			return err
		}
	}

	assetsList, err := Assets.ReadDir("migrations")
	if err != nil {
		return err
	}
	assetNamesForDriver := make([]string, len(assetsList))
	for i, dirEntry := range assetsList {
		assetNamesForDriver[i] = dirEntry.Name()
	}

	params := map[string]interface{}{
		"prefix":     s.tablePrefix,
		"postgres":   s.dbType == model.PostgresDBType,
		"mysql":      s.dbType == model.MysqlDBType,
		"plugin":     s.isPlugin,
		"singleUser": s.isSingleUser,
	}

	migrationAssets := &embedded.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			asset, mErr := Assets.ReadFile("migrations/" + name)
			if mErr != nil {
				return nil, mErr
			}

			tmpl, pErr := template.New("sql").Funcs(s.GetTemplateHelperFuncs()).Parse(string(asset))
			if pErr != nil {
				return nil, pErr
			}

			buffer := bytes.NewBufferString("")

			err = tmpl.Execute(buffer, params)
			if err != nil {
				return nil, err
			}

			s.logger.Trace("migration template",
				mlog.String("name", name),
				mlog.String("sql", buffer.String()),
			)

			return buffer.Bytes(), nil
		},
	}

	src, err := embedded.WithInstance(migrationAssets)
	if err != nil {
		return err
	}

	opts := []morph.EngineOption{
		morph.WithLock("boards-lock-key"),
		morph.SetMigrationTableName(fmt.Sprintf("%sschema_migrations", s.tablePrefix)),
		morph.SetStatementTimeoutInSeconds(1000000),
	}

	s.logger.Debug("Creating migration engine")
	engine, err := morph.New(context.Background(), driver, src, opts...)
	if err != nil {
		return err
	}
	defer func() {
		s.logger.Debug("Closing migration engine")
		engine.Close()
	}()

	return s.runMigrationSequence(engine, driver)
}

// runMigrationSequence executes all the migrations in order, both
// plain SQL and data migrations.
func (s *SQLStore) runMigrationSequence(engine *morph.Morph, driver drivers.Driver) error {
	if mErr := s.ensureMigrationsAppliedUpToVersion(engine, driver, uniqueIDsMigrationRequiredVersion); mErr != nil {
		return mErr
	}

	if mErr := s.RunUniqueIDsMigration(); mErr != nil {
		return fmt.Errorf("error running unique IDs migration: %w", mErr)
	}

	if mErr := s.ensureMigrationsAppliedUpToVersion(engine, driver, teamLessBoardsMigrationRequiredVersion); mErr != nil {
		return mErr
	}

	if mErr := s.RunTeamLessBoardsMigration(); mErr != nil {
		return fmt.Errorf("error running teamless boards migration: %w", mErr)
	}

	if mErr := s.RunDeletedMembershipBoardsMigration(); mErr != nil {
		return fmt.Errorf("error running deleted membership boards migration: %w", mErr)
	}

	if mErr := s.ensureMigrationsAppliedUpToVersion(engine, driver, categoriesUUIDIDMigrationRequiredVersion); mErr != nil {
		return mErr
	}

	if mErr := s.RunCategoryUUIDIDMigration(); mErr != nil {
		return fmt.Errorf("error running categoryID migration: %w", mErr)
	}

	appliedMigrations, err := driver.AppliedMigrations()
	if err != nil {
		return err
	}

	if mErr := s.ensureMigrationsAppliedUpToVersion(engine, driver, deDuplicateCategoryBoards); mErr != nil {
		return mErr
	}

	currentMigrationVersion := len(appliedMigrations)
	if mErr := s.RunDeDuplicateCategoryBoardsMigration(currentMigrationVersion); mErr != nil {
		return mErr
	}

	s.logger.Debug("== Applying all remaining migrations ====================",
		mlog.Int("current_version", len(appliedMigrations)),
	)

	if err := engine.ApplyAll(); err != nil {
		return err
	}

	// always run the collations & charset fix-ups
	if mErr := s.RunFixCollationsAndCharsetsMigration(); mErr != nil {
		return fmt.Errorf("error running fix collations and charsets migration: %w", mErr)
	}
	return nil
}

func (s *SQLStore) ensureMigrationsAppliedUpToVersion(engine *morph.Morph, driver drivers.Driver, version int) error {
	applied, err := driver.AppliedMigrations()
	if err != nil {
		return err
	}
	currentVersion := len(applied)

	s.logger.Debug("== Ensuring migrations applied up to version ====================",
		mlog.Int("version", version),
		mlog.Int("current_version", currentVersion))

	// if the target version is below or equal to the current one, do
	// not migrate either because is not needed (both are equal) or
	// because it would downgrade the database (is below)
	if version <= currentVersion {
		s.logger.Debug("-- There is no need of applying any migration --------------------")
		return nil
	}

	for _, migration := range applied {
		s.logger.Debug("-- Found applied migration --------------------", mlog.Uint32("version", migration.Version), mlog.String("name", migration.Name))
	}

	if _, err = engine.Apply(version - currentVersion); err != nil {
		return err
	}

	return nil
}

func (s *SQLStore) GetTemplateHelperFuncs() template.FuncMap {
	funcs := template.FuncMap{
		"addColumnIfNeeded":     s.genAddColumnIfNeeded,
		"dropColumnIfNeeded":    s.genDropColumnIfNeeded,
		"createIndexIfNeeded":   s.genCreateIndexIfNeeded,
		"renameTableIfNeeded":   s.genRenameTableIfNeeded,
		"renameColumnIfNeeded":  s.genRenameColumnIfNeeded,
		"doesTableExist":        s.doesTableExist,
		"doesColumnExist":       s.doesColumnExist,
		"addConstraintIfNeeded": s.genAddConstraintIfNeeded,
	}
	return funcs
}

func (s *SQLStore) genAddColumnIfNeeded(tableName, columnName, datatype, constraint string) (string, error) {
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)
	normTableName := normalizeTablename(s.schemaName, tableName)

	switch s.dbType {
	case model.MysqlDBType:
		vars := map[string]string{
			"schema":          s.schemaName,
			"table_name":      tableName,
			"norm_table_name": normTableName,
			"column_name":     columnName,
			"data_type":       datatype,
			"constraint":      constraint,
		}
		return replaceVars(`
			SET @stmt = (SELECT IF(
				(
				  SELECT COUNT(column_name) FROM INFORMATION_SCHEMA.COLUMNS
				  WHERE table_name = '[[table_name]]'
				  AND table_schema = '[[schema]]'
				  AND column_name = '[[column_name]]'
				) > 0,
				'SELECT 1;',
				'ALTER TABLE [[norm_table_name]] ADD COLUMN [[column_name]] [[data_type]] [[constraint]];'
			));
			PREPARE addColumnIfNeeded FROM @stmt;
			EXECUTE addColumnIfNeeded;
			DEALLOCATE PREPARE addColumnIfNeeded;
		`, vars), nil
	case model.PostgresDBType:
		return fmt.Sprintf("\nALTER TABLE %s ADD COLUMN IF NOT EXISTS %s %s %s;\n", normTableName, columnName, datatype, constraint), nil
	default:
		return "", ErrUnsupportedDatabaseType
	}
}

func (s *SQLStore) genDropColumnIfNeeded(tableName, columnName string) (string, error) {
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)
	normTableName := normalizeTablename(s.schemaName, tableName)

	switch s.dbType {
	case model.MysqlDBType:
		vars := map[string]string{
			"schema":          s.schemaName,
			"table_name":      tableName,
			"norm_table_name": normTableName,
			"column_name":     columnName,
		}
		return replaceVars(`
			SET @stmt = (SELECT IF(
				(
				  SELECT COUNT(column_name) FROM INFORMATION_SCHEMA.COLUMNS
				  WHERE table_name = '[[table_name]]'
				  AND table_schema = '[[schema]]'
				  AND column_name = '[[column_name]]'
				) > 0,
				'ALTER TABLE [[norm_table_name]] DROP COLUMN [[column_name]];',
				'SELECT 1;'
			));
			PREPARE dropColumnIfNeeded FROM @stmt;
			EXECUTE dropColumnIfNeeded;
			DEALLOCATE PREPARE dropColumnIfNeeded;
		`, vars), nil
	case model.PostgresDBType:
		return fmt.Sprintf("\nALTER TABLE %s DROP COLUMN IF EXISTS %s;\n", normTableName, columnName), nil
	default:
		return "", ErrUnsupportedDatabaseType
	}
}

func (s *SQLStore) genCreateIndexIfNeeded(tableName, columns string) (string, error) {
	indexName := getIndexName(tableName, columns)
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)
	normTableName := normalizeTablename(s.schemaName, tableName)

	switch s.dbType {
	case model.MysqlDBType:
		vars := map[string]string{
			"schema":          s.schemaName,
			"table_name":      tableName,
			"norm_table_name": normTableName,
			"index_name":      indexName,
			"columns":         columns,
		}
		return replaceVars(`
			SET @stmt = (SELECT IF(
				(
				  SELECT COUNT(index_name) FROM INFORMATION_SCHEMA.STATISTICS
				  WHERE table_name = '[[table_name]]'
				  AND table_schema = '[[schema]]'
				  AND index_name = '[[index_name]]'
				) > 0,
				'SELECT 1;',
				'CREATE INDEX [[index_name]] ON [[norm_table_name]] ([[columns]]);'
			));
			PREPARE createIndexIfNeeded FROM @stmt;
			EXECUTE createIndexIfNeeded;
			DEALLOCATE PREPARE createIndexIfNeeded;
		`, vars), nil
	case model.PostgresDBType:
		return fmt.Sprintf("\nCREATE INDEX IF NOT EXISTS %s ON %s (%s);\n", indexName, normTableName, columns), nil
	default:
		return "", ErrUnsupportedDatabaseType
	}
}

func (s *SQLStore) genRenameTableIfNeeded(oldTableName, newTableName string) (string, error) {
	oldTableName = addPrefixIfNeeded(oldTableName, s.tablePrefix)
	newTableName = addPrefixIfNeeded(newTableName, s.tablePrefix)

	normOldTableName := normalizeTablename(s.schemaName, oldTableName)

	vars := map[string]string{
		"schema":              s.schemaName,
		"table_name":          newTableName,
		"norm_old_table_name": normOldTableName,
		"new_table_name":      newTableName,
	}

	switch s.dbType {
	case model.MysqlDBType:
		return replaceVars(`
			SET @stmt = (SELECT IF(
				(
				SELECT COUNT(table_name) FROM INFORMATION_SCHEMA.TABLES
				WHERE table_name = '[[table_name]]'
				AND table_schema = '[[schema]]'
				) > 0,
				'SELECT 1;',
				'RENAME TABLE [[norm_old_table_name]] TO [[new_table_name]];'
			));
			PREPARE renameTableIfNeeded FROM @stmt;
			EXECUTE renameTableIfNeeded;
			DEALLOCATE PREPARE renameTableIfNeeded;
		`, vars), nil
	case model.PostgresDBType:
		return replaceVars(`
			do $$
			begin
				if (SELECT COUNT(table_name) FROM INFORMATION_SCHEMA.TABLES
							WHERE table_name = '[[new_table_name]]'
							AND table_schema = '[[schema]]'
				) = 0 then
					ALTER TABLE [[norm_old_table_name]] RENAME TO [[new_table_name]];
				end if;
			end$$;
		`, vars), nil
	default:
		return "", ErrUnsupportedDatabaseType
	}
}

func (s *SQLStore) genRenameColumnIfNeeded(tableName, oldColumnName, newColumnName, dataType string) (string, error) {
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)
	normTableName := normalizeTablename(s.schemaName, tableName)

	vars := map[string]string{
		"schema":          s.schemaName,
		"table_name":      tableName,
		"norm_table_name": normTableName,
		"old_column_name": oldColumnName,
		"new_column_name": newColumnName,
		"data_type":       dataType,
	}

	switch s.dbType {
	case model.MysqlDBType:
		return replaceVars(`
			SET @stmt = (SELECT IF(
				(
				SELECT COUNT(column_name) FROM INFORMATION_SCHEMA.COLUMNS
				WHERE table_name = '[[table_name]]'
				AND table_schema = '[[schema]]'
				AND column_name = '[[new_column_name]]'
				) > 0,
				'SELECT 1;',
				'ALTER TABLE [[norm_table_name]] CHANGE [[old_column_name]] [[new_column_name]] [[data_type]];'
			));
			PREPARE renameColumnIfNeeded FROM @stmt;
			EXECUTE renameColumnIfNeeded;
			DEALLOCATE PREPARE renameColumnIfNeeded;
		`, vars), nil
	case model.PostgresDBType:
		return replaceVars(`
			do $$
			begin
				if (SELECT COUNT(table_name) FROM INFORMATION_SCHEMA.COLUMNS
							WHERE table_name = '[[table_name]]'
							AND table_schema = '[[schema]]'
							AND column_name = '[[new_column_name]]'
				) = 0 then
					ALTER TABLE [[norm_table_name]] RENAME COLUMN [[old_column_name]] TO [[new_column_name]];
				end if;
			end$$;
		`, vars), nil
	default:
		return "", ErrUnsupportedDatabaseType
	}
}

func (s *SQLStore) doesTableExist(tableName string) (bool, error) {
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)

	query := s.getQueryBuilder(s.db).
		Select("table_name").
		From("INFORMATION_SCHEMA.TABLES").
		Where(sq.Eq{
			"table_name":   tableName,
			"table_schema": s.schemaName,
		})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`doesTableExist ERROR`, mlog.Err(err))
		return false, err
	}
	defer s.CloseRows(rows)

	exists := rows.Next()
	sql, _, _ := query.ToSql()

	s.logger.Trace("doesTableExist",
		mlog.String("table", tableName),
		mlog.Bool("exists", exists),
		mlog.String("sql", sql),
	)
	return exists, nil
}

func (s *SQLStore) doesColumnExist(tableName, columnName string) (bool, error) {
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)

	query := s.getQueryBuilder(s.db).
		Select("table_name").
		From("INFORMATION_SCHEMA.COLUMNS").
		Where(sq.Eq{
			"table_name":   tableName,
			"table_schema": s.schemaName,
			"column_name":  columnName,
		})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`doesColumnExist ERROR`, mlog.Err(err))
		return false, err
	}
	defer s.CloseRows(rows)

	exists := rows.Next()
	sql, _, _ := query.ToSql()

	s.logger.Trace("doesColumnExist",
		mlog.String("table", tableName),
		mlog.String("column", columnName),
		mlog.Bool("exists", exists),
		mlog.String("sql", sql),
	)
	return exists, nil
}

func (s *SQLStore) genAddConstraintIfNeeded(tableName, constraintName, constraintType, constraintDefinition string) (string, error) {
	tableName = addPrefixIfNeeded(tableName, s.tablePrefix)
	normTableName := normalizeTablename(s.schemaName, tableName)

	var query string

	vars := map[string]string{
		"schema":                s.schemaName,
		"constraint_name":       constraintName,
		"constraint_type":       constraintType,
		"table_name":            tableName,
		"constraint_definition": constraintDefinition,
		"norm_table_name":       normTableName,
	}

	switch s.dbType {
	case model.MysqlDBType:
		query = replaceVars(`
			SET @stmt = (SELECT IF(
				(
				SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
				WHERE constraint_schema = '[[schema]]'
				AND constraint_name = '[[constraint_name]]'
				AND constraint_type = '[[constraint_type]]'
				AND table_name = '[[table_name]]'
				) > 0,
				'SELECT 1;',
				'ALTER TABLE [[norm_table_name]] ADD CONSTRAINT [[constraint_name]] [[constraint_definition]];'
			));
			PREPARE addConstraintIfNeeded FROM @stmt;
			EXECUTE addConstraintIfNeeded;
			DEALLOCATE PREPARE addConstraintIfNeeded;
		`, vars)
	case model.PostgresDBType:
		query = replaceVars(`
		DO
		$$
		BEGIN
		IF NOT EXISTS (
			SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
				WHERE constraint_schema = '[[schema]]'
				AND constraint_name = '[[constraint_name]]'
				AND constraint_type = '[[constraint_type]]'
				AND table_name = '[[table_name]]'
		) THEN
			ALTER TABLE [[norm_table_name]] ADD CONSTRAINT [[constraint_name]] [[constraint_definition]];
		END IF;
		END;
		$$
		LANGUAGE plpgsql;
		`, vars)
	}

	return query, nil
}

func addPrefixIfNeeded(s, prefix string) string {
	if !strings.HasPrefix(s, prefix) {
		return prefix + s
	}
	return s
}

func normalizeTablename(schemaName, tableName string) string {
	if schemaName != "" && !strings.HasPrefix(tableName, schemaName+".") {
		tableName = schemaName + "." + tableName
	}
	return tableName
}

func getIndexName(tableName string, columns string) string {
	var sb strings.Builder

	_, _ = sb.WriteString("idx_")
	_, _ = sb.WriteString(tableName)

	// allow developers to separate column names with spaces and/or commas
	columns = strings.ReplaceAll(columns, ",", " ")
	cols := strings.Split(columns, " ")

	for _, s := range cols {
		sub := strings.TrimSpace(s)
		if sub == "" {
			continue
		}

		_, _ = sb.WriteString("_")
		_, _ = sb.WriteString(s)
	}
	return sb.String()
}

// replaceVars replaces instances of variable placeholders with the
// values provided via a map.  Variable placeholders are of the form
// `[[var_name]]`.
func replaceVars(s string, vars map[string]string) string {
	for key, val := range vars {
		placeholder := "[[" + key + "]]"
		val = strings.ReplaceAll(val, "'", "\\'")
		s = strings.ReplaceAll(s, placeholder, val)
	}
	return s
}
