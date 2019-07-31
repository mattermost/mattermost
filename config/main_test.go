package config_test

import (
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/testlib"
	"github.com/stretchr/testify/require"
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
	sqlSetting := mainHelper.GetSqlSettings()
	sqlSupplier := mainHelper.GetSqlSupplier()

	switch *sqlSetting.DriverName {
	case model.DATABASE_DRIVER_MYSQL:
		_, err := sqlSupplier.GetMaster().Db.Exec(fmt.Sprintf("TRUNCATE TABLE %s", table))
		if err != nil {
			if driverErr, ok := err.(*mysql.MySQLError); ok {
				// Ignore if the Configurations table does not exist.
				if driverErr.Number == 1146 {
					return
				}
			}
		}
		require.NoError(t, err)

	case model.DATABASE_DRIVER_POSTGRES:
		_, err := sqlSupplier.GetMaster().Db.Exec(fmt.Sprintf("TRUNCATE TABLE %s", table))
		require.NoError(t, err)

	default:
		t.Fatalf("unsupported driver name: %s", *sqlSetting.DriverName)
	}
}

// truncateTables clears tables used by the config package for reuse in other tests
func truncateTables(t *testing.T) {
	t.Helper()

	truncateTable(t, "Configurations")
	truncateTable(t, "ConfigurationFiles")
}
