package config

import (
	"fmt"
	"github.com/mattermost/mattermost-server/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestMigrateDatabaseToFile(t *testing.T) {
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSqlSettings()
	sqlDSN := fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource)
	fileDSN := "config.json"
	idpCertificateFile := "IdpCertificateFile"
	data := make([]byte, 5)
	ds, err := NewDatabaseStore(sqlDSN)
	defer ds.Close()
	require.NoError(t, err)
	config := ds.Get()
	config.SamlSettings.IdpCertificateFile = &idpCertificateFile
	_, err = ds.Set(config)
	require.NoError(t, err)
	err = ds.SetFile(idpCertificateFile, data)
	require.NoError(t, err)

	err = Migrate(sqlDSN, fileDSN)
	require.NoError(t, err)

	fs, err := NewFileStore(fileDSN, false)
	defer fs.Close()
	require.NoError(t, err)
	bytes, err := fs.GetFile(idpCertificateFile)
	defer fs.RemoveFile(idpCertificateFile)
	assert.NotNil(t, bytes)
	assert.Equal(t, ds.Get(), fs.Get())
}

func TestMigrateFileToDatabaseWhenFilePathIsNotSpecified(t *testing.T) {
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSqlSettings()
	sqlDSN := fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource)
	fileDSN := "config.json"

	_, err := NewFileStore(fileDSN, true)
	require.NoError(t, err)

	err = Migrate(fileDSN, sqlDSN)
	require.NoError(t, err)
}
