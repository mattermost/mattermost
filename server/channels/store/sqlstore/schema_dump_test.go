// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestGetSchemaDefinition(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		t.Run("MySQL", func(t *testing.T) {
			if ss.(*SqlStore).DriverName() != model.DatabaseDriverMysql {
				t.Skip("Skipping test as database is not MySQL")
			}

			// Schema dump is only supported for PostgreSQL
			schemaInfo, err := ss.GetSchemaDefinition()
			require.Error(t, err)
			require.Nil(t, schemaInfo)
			assert.Contains(t, err.Error(), "only supported for PostgreSQL")
		})

		t.Run("PostgreSQL", func(t *testing.T) {
			if ss.(*SqlStore).DriverName() != model.DatabaseDriverPostgres {
				t.Skip("Skipping test as database is not PostgreSQL")
			}

			schemaInfo, err := ss.GetSchemaDefinition()
			require.NoError(t, err)
			require.NotNil(t, schemaInfo)

			// Verify schema structure
			assert.NotEmpty(t, schemaInfo.Tables)

			// Verify that columns are not duplicated
			for _, table := range schemaInfo.Tables {
				columnNames := make(map[string]bool)
				for _, column := range table.Columns {
					// Assert that this column name hasn't been seen before
					assert.False(t, columnNames[column.Name], "Column %s in table %s is duplicated", column.Name, table.Name)
					columnNames[column.Name] = true
				}
			}

			// Verify that common tables are present
			tableNames := make([]string, 0, len(schemaInfo.Tables))
			for _, table := range schemaInfo.Tables {
				tableNames = append(tableNames, table.Name)
			}

			// Verify some core tables
			expectedTables := []string{"users", "channels", "teams", "posts"}
			for _, expected := range expectedTables {
				assert.Contains(t, tableNames, expected)
			}

			// Verify table structure
			for _, table := range schemaInfo.Tables {
				if table.Name == "users" {
					// Check user table has key columns
					columnNames := make([]string, 0, len(table.Columns))
					for _, column := range table.Columns {
						columnNames = append(columnNames, column.Name)
					}

					expectedColumns := []string{"id", "username", "email"}
					for _, expected := range expectedColumns {
						assert.Contains(t, columnNames, expected)
					}

					break
				}
			}
		})
	})
}
