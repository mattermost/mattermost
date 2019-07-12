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
	publicCertificateFile := "PublicCertificateFile"
	privateKeyFile := "PrivateKeyFile"
	data := make([]byte, 5)
	ds, err := NewDatabaseStore(sqlDSN)
	defer ds.Close()
	require.NoError(t, err)
	config := ds.Get()
	config.SamlSettings.IdpCertificateFile = &idpCertificateFile
	config.SamlSettings.PublicCertificateFile = &publicCertificateFile
	config.SamlSettings.PrivateKeyFile = &privateKeyFile
	_, err = ds.Set(config)
	require.NoError(t, err)
	err = ds.SetFile(idpCertificateFile, data)
	require.NoError(t, err)
	err = ds.SetFile(publicCertificateFile, data)
	require.NoError(t, err)
	err = ds.SetFile(privateKeyFile, data)
	require.NoError(t, err)

	err = Migrate(sqlDSN, fileDSN)
	require.NoError(t, err)

	fs, err := NewFileStore(fileDSN, false)
	defer fs.Close()
	require.NoError(t, err)

	hasIdpCertificateFile, err := fs.HasFile(idpCertificateFile)
	require.NoError(t, err)
	defer fs.RemoveFile(idpCertificateFile)

	hasPublicCertificateFile, err := fs.HasFile(publicCertificateFile)
	require.NoError(t, err)
	defer fs.RemoveFile(publicCertificateFile)

	hasPrivateKeyFile, err := fs.HasFile(privateKeyFile)
	require.NoError(t, err)
	defer fs.RemoveFile(privateKeyFile)

	assert.True(t, hasIdpCertificateFile)
	assert.True(t, hasPublicCertificateFile)
	assert.True(t, hasPrivateKeyFile)
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
