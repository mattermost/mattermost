// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"strings"

	"github.com/hashicorp/go-multierror"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// GetSchemaDefinition dumps the database schema.
// Only Postgres is supported.
func (ss *SqlStore) GetSchemaDefinition() (*model.SupportPacketDatabaseSchema, error) {
	if ss.DriverName() != model.DatabaseDriverPostgres {
		return nil, errors.New("schema dump is only supported for Postgres")
	}

	var schemaInfo model.SupportPacketDatabaseSchema
	var rErr *multierror.Error

	// Get the database collation
	dbCollation, err := ss.getDatabaseCollation()
	if err != nil {
		rErr = multierror.Append(rErr, err)
	} else {
		schemaInfo.DatabaseCollation = dbCollation
	}

	// Get the database encoding
	dbEncoding, err := ss.getDatabaseEncoding()
	if err != nil {
		rErr = multierror.Append(rErr, err)
	} else {
		schemaInfo.DatabaseEncoding = dbEncoding
	}

	// Get table options
	tableOptions, err := ss.getTableOptions()
	if err != nil {
		rErr = multierror.Append(rErr, err)
	}

	// Get table schema information
	tablesMap, tableCollations, err := ss.getTableSchemaInformation()
	if err != nil {
		rErr = multierror.Append(rErr, err)
	}

	// Get table indexes
	tableIndexes, err := ss.getTableIndexes()
	if err != nil {
		rErr = multierror.Append(rErr, err)
	}

	// Process and combine table metadata
	for _, table := range tablesMap {
		// Add table collation if it exists
		if collation, ok := tableCollations[table.Name]; ok {
			table.Collation = collation
		}

		// Add table options if they exist
		if options, ok := tableOptions[table.Name]; ok && len(options) > 0 {
			table.Options = options
		}

		// Add table indexes if they exist
		if indexes, ok := tableIndexes[table.Name]; ok {
			table.Indexes = indexes
		}

		schemaInfo.Tables = append(schemaInfo.Tables, *table)
	}

	return &schemaInfo, rErr.ErrorOrNil()
}

// getDatabaseCollation retrieves the database collation for PostgreSQL
func (ss *SqlStore) getDatabaseCollation() (string, error) {
	var dbCollation sql.NullString
	collationQuery := sq.Select("datcollate").
		From("pg_database").
		Where(sq.Expr("datname = current_database()"))

	sqlString, args, err := collationQuery.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return "", errors.Wrap(err, "failed to build database collation query")
	}

	err = ss.GetMaster().DB.QueryRow(sqlString, args...).Scan(&dbCollation)
	if err != nil {
		return "", errors.Wrap(err, "failed to get database collation")
	}

	if !dbCollation.Valid {
		return "", nil
	}

	return dbCollation.String, nil
}

// getDatabaseEncoding retrieves the database encoding for PostgreSQL
func (ss *SqlStore) getDatabaseEncoding() (string, error) {
	var dbEncoding sql.NullString
	encodingQuery := sq.Select("pg_encoding_to_char(encoding)").
		From("pg_database").
		Where(sq.Expr("datname = current_database()"))

	sqlString, args, err := encodingQuery.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return "", errors.Wrap(err, "failed to build database encoding query")
	}

	err = ss.GetMaster().DB.QueryRow(sqlString, args...).Scan(&dbEncoding)
	if err != nil {
		return "", errors.Wrap(err, "failed to get database encoding")
	}

	if !dbEncoding.Valid {
		return "", nil
	}

	return dbEncoding.String, nil
}

// getTableOptions retrieves table-specific options from PostgreSQL system catalogs
func (ss *SqlStore) getTableOptions() (map[string]map[string]string, error) {
	tableOptions := make(map[string]map[string]string)

	optionsQuery := sq.Select("c.relname as table_name", "unnest(c.reloptions) as option_value").
		From("pg_class c").
		Join("pg_namespace n ON n.oid = c.relnamespace").
		Where(sq.And{
			sq.Expr("n.nspname = current_schema()"),
			sq.Eq{"c.relkind": "r"},
			sq.NotEq{"c.reloptions": nil},
		})

	optionsSql, optionsArgs, err := optionsQuery.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build table options query")
	}

	optionsRows, err := ss.GetMaster().DB.Query(optionsSql, optionsArgs...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query table options")
	}
	defer optionsRows.Close()

	// Process table options
	var rErr *multierror.Error
	for optionsRows.Next() {
		var tableName string
		var optionValue string

		err = optionsRows.Scan(&tableName, &optionValue)
		if err != nil {
			rErr = multierror.Append(rErr, errors.Wrap(err, "failed to scan database schema row"))
			continue
		}

		// Parse option in format key=value
		parts := strings.SplitN(optionValue, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := parts[0]
		value := parts[1]

		// Initialize the options map for this table if needed
		if _, ok := tableOptions[tableName]; !ok {
			tableOptions[tableName] = make(map[string]string)
		}

		// Add option to the table
		tableOptions[tableName][key] = value
	}

	return tableOptions, rErr.ErrorOrNil()
}

// getTableSchemaInformation retrieves table and column information from information_schema
func (ss *SqlStore) getTableSchemaInformation() (map[string]*model.DatabaseTable, map[string]string, error) {
	tablesMap := make(map[string]*model.DatabaseTable)
	tableCollations := make(map[string]string)

	schemaQuery := sq.Select(
		"t.table_name",
		"c.column_name",
		"c.data_type",
		"c.character_maximum_length",
		"c.is_nullable",
		"c.collation_name",
	).
		From("information_schema.tables t").
		LeftJoin("information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema").
		Where(sq.Expr("t.table_schema = current_schema()")).
		OrderBy("t.table_name", "c.ordinal_position")

	schemaSql, schemaArgs, err := schemaQuery.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to build schema information query")
	}

	rows, err := ss.GetMaster().DB.Query(schemaSql, schemaArgs...)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to query schema information")
	}
	defer rows.Close()

	var rErr *multierror.Error
	for rows.Next() {
		var tableName, columnName, dataType, isNullable string
		var characterMaxLength sql.NullInt64
		var collationName sql.NullString

		err = rows.Scan(&tableName, &columnName, &dataType, &characterMaxLength, &isNullable, &collationName)
		if err != nil {
			rErr = multierror.Append(rErr, errors.Wrap(err, "failed to scan database schema row"))
			continue
		}

		// Track collation names for tables.
		// Only the first non-null collation encountered per table is stored in tableCollations.
		if collationName.Valid && collationName.String != "" {
			if _, ok := tableCollations[tableName]; !ok {
				tableCollations[tableName] = collationName.String
			}
		}

		// Initialize table in map if it doesn't exist
		if _, ok := tablesMap[tableName]; !ok {
			tablesMap[tableName] = &model.DatabaseTable{
				Name:    tableName,
				Columns: []model.DatabaseColumn{},
			}
		}

		// Add column to table
		if columnName != "" {
			maxLength := int64(0)
			if characterMaxLength.Valid {
				maxLength = characterMaxLength.Int64
			}

			tablesMap[tableName].Columns = append(tablesMap[tableName].Columns, model.DatabaseColumn{
				Name:       columnName,
				DataType:   dataType,
				MaxLength:  maxLength,
				IsNullable: isNullable == "YES",
			})
		}
	}

	return tablesMap, tableCollations, rErr.ErrorOrNil()
}

// getTableIndexes retrieves index information for all tables
func (ss *SqlStore) getTableIndexes() (map[string][]model.DatabaseIndex, error) {
	tableIndexes := make(map[string][]model.DatabaseIndex)

	// Query pg_indexes for index information
	indexQuery := sq.Select(
		"tablename",
		"indexname",
		"indexdef",
	).
		From("pg_indexes").
		Where(sq.Expr("schemaname = current_schema()"))

	indexSql, indexArgs, err := indexQuery.PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build index query")
	}

	rows, err := ss.GetMaster().DB.Query(indexSql, indexArgs...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query index information")
	}
	defer rows.Close()

	var rErr *multierror.Error
	for rows.Next() {
		var tableName, indexName, indexDef string

		err = rows.Scan(&tableName, &indexName, &indexDef)
		if err != nil {
			rErr = multierror.Append(rErr, errors.Wrap(err, "failed to scan index row"))
			continue
		}

		index := model.DatabaseIndex{
			Name:       indexName,
			Definition: indexDef,
		}

		tableIndexes[tableName] = append(tableIndexes[tableName], index)
	}

	return tableIndexes, rErr.ErrorOrNil()
}
