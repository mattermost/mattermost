package config

import (
	"fmt"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestMigrate(t *testing.T) {
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSqlSettings()
	sqlDSN := fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource)
	fileDSN := "config.json"

	ds, err := NewDatabaseStore(sqlDSN)
	defer ds.Close()
	require.NoError(t, err)
	config := model.Config{}
	config.SetDefaults()

	err = Migrate(sqlDSN, fileDSN)
	require.NoError(t, err)

	fs, err := NewFileStore(fileDSN, false)
	defer fs.Close()
	require.NoError(t, err)

	assert.Equal(t, ds.Get(), fs.Get())
}
