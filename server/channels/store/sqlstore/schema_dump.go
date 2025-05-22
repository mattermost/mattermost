// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"strings"

	"github.com/hashicorp/go-multierror"
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

	// Maps to track table metadata
	tableOptions := make(map[string]map[string]string)
	tableCollations := make(map[string]string)

	// Get the database collation
	var dbCollation sql.NullString
	err := ss.GetMaster().DB.QueryRow(`
		SELECT datcollate
		FROM pg_database
		WHERE datname = current_database()
	`).Scan(&dbCollation)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to get database collation"))
	} else {
		if dbCollation.Valid && dbCollation.String != "" {
			schemaInfo.DatabaseCollation = dbCollation.String
		}
	}

	// Get table options
	optionsRows, err := ss.GetMaster().DB.Query(`
		SELECT 
			c.relname as table_name,
			unnest(c.reloptions) as option_value
		FROM 
			pg_class c
		JOIN 
			pg_namespace n ON n.oid = c.relnamespace
		WHERE 
			n.nspname = 'public'
			AND c.relkind = 'r'
			AND c.reloptions IS NOT NULL
	`)

	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to query table options"))
	} else {
		defer optionsRows.Close()

		// Process table options
		for optionsRows.Next() {
			var tableName string
			var optionValue string

			err := optionsRows.Scan(&tableName, &optionValue)
			if err != nil {
				rErr = multierror.Append(errors.Wrap(err, "failed to scan table options row"))
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
	}

	// Query for the table schema information
	query := `
SELECT 
    t.table_name, 
    c.column_name, 
    c.data_type, 
    c.character_maximum_length, 
    c.is_nullable,
    c.collation_name
FROM 
    information_schema.tables t
LEFT JOIN 
    information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE 
    t.table_schema = 'public'
ORDER BY 
    t.table_name, c.ordinal_position;
`

	rows, err := ss.GetMaster().DB.Query(query)
	if err != nil {
		rErr = multierror.Append(errors.Wrap(err, "failed to query table options"))
	} else {
		defer rows.Close()

		var currentTable string
		var currentColumns []model.DatabaseColumn

		for rows.Next() {
			var tableName, columnName, dataType, isNullable string
			var characterMaxLength sql.NullInt64
			var collationName sql.NullString

			err = rows.Scan(&tableName, &columnName, &dataType, &characterMaxLength, &isNullable, &collationName)
			if err != nil {
				rErr = multierror.Append(errors.Wrap(err, "failed to scan database schema row"))
				continue
			}

			// Track collation names for tables - we only need the first non-null one
			if collationName.Valid && collationName.String != "" {
				if _, ok := tableCollations[tableName]; !ok {
					tableCollations[tableName] = collationName.String
				}
			}

			// Handle table grouping
			if currentTable != tableName {
				// Save previous table
				if currentTable != "" {
					tableInfo := model.DatabaseTable{
						Name:    currentTable,
						Columns: currentColumns,
					}

					// Add table collation if it ok
					if collation, ok := tableCollations[currentTable]; ok {
						tableInfo.Collation = collation
					}

					// Add table options if they exist
					if options, ok := tableOptions[currentTable]; ok && len(options) > 0 {
						tableInfo.Options = options
					}

					schemaInfo.Tables = append(schemaInfo.Tables, tableInfo)
				}

				// Start new table
				currentTable = tableName
				currentColumns = []model.DatabaseColumn{}
			}

			// Add column (but only once per column)
			if columnName != "" {
				maxLength := int64(0)
				if characterMaxLength.Valid {
					maxLength = characterMaxLength.Int64
				}

				currentColumns = append(currentColumns, model.DatabaseColumn{
					Name:       columnName,
					DataType:   dataType,
					MaxLength:  maxLength,
					IsNullable: isNullable == "YES",
				})
			}
		}

		// Add the last table
		if currentTable != "" {
			tableInfo := model.DatabaseTable{
				Name:    currentTable,
				Columns: currentColumns,
			}

			// Add table collation if it ok
			if collation, ok := tableCollations[currentTable]; ok {
				tableInfo.Collation = collation
			}

			// Add table options if they exist
			if options, ok := tableOptions[currentTable]; ok && len(options) > 0 {
				tableInfo.Options = options
			}

			schemaInfo.Tables = append(schemaInfo.Tables, tableInfo)
		}
	}

	return &schemaInfo, rErr.ErrorOrNil()
}
