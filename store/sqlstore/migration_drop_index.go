// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"

	"github.com/mattermost/mattermost-server/v5/model"
)

// DropIndex is an asynchronous migration that removes an index
type DropIndex struct {
	name  string
	table string
}

func NewDropIndex(indexName string, tableName string) *DropIndex {
	return &DropIndex{
		name:  indexName,
		table: tableName,
	}
}

// Name returns name of the migration, should be unique
func (m *DropIndex) Name() string {
	return "drop_index_" + m.name
}

// GetStatus returns if the migration should be executed or not
func (m *DropIndex) GetStatus(ss SqlStore) (asyncMigrationStatus, error) {
	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, errExists := ss.GetMaster().SelectStr("SELECT $1::regclass", m.name)
		// It should fail if the index does not exist
		if errExists != nil {
			return skip, nil
		}
	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		count, err := ss.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", m.table, m.name)
		if err != nil {
			return unknown, err
		}
		if count == 0 {
			return skip, nil
		}
	}
	return run, nil
}

// Execute runs the migration
// Explicit connection is passed so that all queries run in a single session
func (m *DropIndex) Execute(ctx context.Context, ss SqlStore, conn *sql.Conn) (asyncMigrationStatus, error) {
	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := conn.ExecContext(ctx, "DROP INDEX CONCURRENTLY "+m.name)
		if err != nil {
			return failed, err
		}
	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		_, err := conn.ExecContext(ctx, "DROP INDEX "+m.name+" ON "+m.table)
		if err != nil {
			return failed, err
		}
	}
	return complete, nil
}
