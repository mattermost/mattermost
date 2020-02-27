// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// CreateIndex is an asynchronous migration that adds an index to table
type CreateIndex struct {
	sqlStore  SqlStore
	name      string
	table     string
	columns   []string
	indexType string
	unique    bool
}

// NewCreateIndex creates a migration that adds an index
func NewCreateIndex(s SqlStore, indexName, tableName string, columnNames []string, indexType string, unique bool) *CreateIndex {
	return &CreateIndex{
		sqlStore:  s,
		name:      indexName,
		table:     tableName,
		columns:   columnNames,
		indexType: indexType,
		unique:    unique,
	}
}

// Name returns name of the migration, should be unique
func (m *CreateIndex) Name() string {
	return "add_index_" + m.name
}

type pgIndexData struct {
	Name    string `db:"relname"`
	IsValid bool   `db:"indisvalid"`
}

func checkPostgreSQLIndex(ss SqlStore, name string) (*pgIndexData, error) {
	idxData := pgIndexData{}
	err := ss.GetMaster().SelectOne(&idxData, "SELECT relname, indisvalid FROM pg_class, pg_index WHERE pg_index.indexrelid = pg_class.oid AND pg_class.relname = $1", name)
	// ErrNoRows means there is no index
	if err == sql.ErrNoRows {
		return nil, nil
	}
	// other error means something went wrong
	if err != nil {
		return nil, err
	}
	return &idxData, nil
}

// GetStatus returns if the migration should be executed or not
func (m *CreateIndex) GetStatus() (model.AsyncMigrationStatus, error) {
	if m.sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		if m.indexType == INDEX_TYPE_FULL_TEXT && len(m.columns) != 1 {
			return model.MigrationStatusFailed, errors.New("Unable to create multi column full text index")
		}
		idxData, err := checkPostgreSQLIndex(m.sqlStore, m.name)
		// other error means something went wrong
		if err != nil {
			return model.MigrationStatusUnknown, err
		}
		// check if the index is invalid, this can happen if create index concurrently was aborted
		// in that case we have to drop this index and create it again
		// this may block if there is a long running query on the table
		if idxData != nil && !idxData.IsValid {
			_, err = m.sqlStore.GetMaster().ExecNoTimeout("DROP INDEX " + m.name)
			if err != nil {
				return model.MigrationStatusUnknown, err
			}
		}
		return model.MigrationStatusRun, nil
	} else if m.sqlStore.DriverName() == model.DATABASE_DRIVER_MYSQL {
		if m.indexType == INDEX_TYPE_FULL_TEXT {
			return model.MigrationStatusFailed, errors.New("Unable to create full text index concurrently")
		}
		count, err := m.sqlStore.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", m.table, m.name)
		if err != nil {
			return model.MigrationStatusUnknown, err
		}
		if count > 0 {
			return model.MigrationStatusSkip, nil
		}
	}
	return model.MigrationStatusRun, nil
}

// Execute runs the migration
// Explicit connection is passed so that all queries run in a single session
func (m *CreateIndex) Execute(ctx context.Context, conn *sql.Conn) (model.AsyncMigrationStatus, error) {
	uniqueStr := ""
	if m.unique {
		uniqueStr = "UNIQUE "
	}

	if m.sqlStore.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		// because of retries we check for invalid index here too
		// but I'm not sure if it's really necessary
		idxData, err := checkPostgreSQLIndex(m.sqlStore, m.name)
		if err != nil {
			return model.MigrationStatusUnknown, err
		}
		// check if the index is invalid
		// in that case we have to drop this index and create it again
		if idxData != nil && !idxData.IsValid {
			_, err = conn.ExecContext(ctx, "DROP INDEX "+m.name)
			if err != nil {
				return model.MigrationStatusUnknown, err
			}
		}
		query := ""
		if m.indexType == INDEX_TYPE_FULL_TEXT {
			columnName := m.columns[0]
			postgresColumnNames := convertMySQLFullTextColumnsToPostgres(columnName)
			query = "CREATE INDEX CONCURRENTLY " + m.name + " ON " + m.table + " USING gin(to_tsvector('english', " + postgresColumnNames + "))"
		} else {
			query = "CREATE " + uniqueStr + "INDEX CONCURRENTLY " + m.name + " ON " + m.table + " (" + strings.Join(m.columns, ", ") + ")"
		}

		_, err = conn.ExecContext(ctx, query)
		if err != nil {
			return model.MigrationStatusFailed, err
		}
	} else if m.sqlStore.DriverName() == model.DATABASE_DRIVER_MYSQL {
		_, err := conn.ExecContext(ctx, "CREATE  "+uniqueStr+" INDEX "+m.name+" ON "+m.table+" ("+strings.Join(m.columns, ", ")+")")
		if err != nil {
			return model.MigrationStatusFailed, err
		}
	}
	return model.MigrationStatusComplete, nil
}
