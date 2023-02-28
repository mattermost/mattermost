// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/channels/testlib"
	"github.com/mattermost/mattermost-server/v6/model"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	var options = testlib.HelperOptions{
		EnableStore: true,
	}

	mainHelper = testlib.NewMainHelperWithOptions(&options)
	defer mainHelper.Close()

	mainHelper.Main(m)
}

// truncateTable clears the given table
func truncateTable(t *testing.T, table string) {
	t.Helper()
	sqlSetting := mainHelper.GetSQLSettings()
	sqlStore := mainHelper.GetSQLStore()

	switch *sqlSetting.DriverName {
	case model.DatabaseDriverMysql:
		_, err := sqlStore.GetMasterX().Exec(fmt.Sprintf("TRUNCATE TABLE %s", table))
		if err != nil {
			if driverErr, ok := err.(*mysql.MySQLError); ok {
				// Ignore if the Configurations table does not exist.
				if driverErr.Number == 1146 {
					return
				}
			}
		}
		require.NoError(t, err)

	case model.DatabaseDriverPostgres:
		_, err := sqlStore.GetMasterX().Exec(fmt.Sprintf("TRUNCATE TABLE %s", table))
		if err != nil {
			if driverErr, ok := err.(*pq.Error); ok {
				// Ignore if the Configurations table does not exist.
				if driverErr.Code == "42P01" {
					return
				}
			}
		}
		require.NoError(t, err)

	default:
		require.Failf(t, "failed", "unsupported driver name: %s", *sqlSetting.DriverName)
	}
}

// truncateTables clears tables used by the config package for reuse in other tests
func truncateTables(t *testing.T) {
	t.Helper()

	truncateTable(t, "Configurations")
	truncateTable(t, "ConfigurationFiles")
	truncateTable(t, migrationsTableName)
}
