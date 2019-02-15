package config_test

import (
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/testlib"
	"github.com/stretchr/testify/require"
)

var mainHelper *testlib.MainHelper

func TestMain(m *testing.M) {
	mainHelper = testlib.NewMainHelper()
	defer mainHelper.Close()

	mainHelper.Main(m)
}

// truncateTables clears tables used by the config package for reuse in other tests
func truncateTables(t *testing.T) {
	t.Helper()

	switch *mainHelper.Settings.DriverName {
	case model.DATABASE_DRIVER_MYSQL:
		_, err := mainHelper.SqlSupplier.GetMaster().Db.Exec("TRUNCATE TABLE Configurations")
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
		_, err := mainHelper.SqlSupplier.GetMaster().Db.Exec("TRUNCATE TABLE Configurations")
		require.NoError(t, err)

	default:
		t.Fatalf("unsupported driver name: %s", *mainHelper.Settings.DriverName)
	}
}
