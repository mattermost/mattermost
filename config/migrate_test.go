// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrateDatabaseToFile(t *testing.T) {
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSQLSettings()
	defer storetest.CleanupSqlSettings(sqlSettings)
	sqlDSN := fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource)
	fileDSN := "config.json"
	files := []string{"IdpCertificateFile", "PublicCertificateFile", "PrivateKeyFile"}
	data := make([]byte, 5)
	ds, err := NewDatabaseStore(sqlDSN)
	defer ds.Close()
	require.NoError(t, err)
	config := ds.Get()
	config.SamlSettings.IdpCertificateFile = &files[0]
	config.SamlSettings.PublicCertificateFile = &files[1]
	config.SamlSettings.PrivateKeyFile = &files[2]
	_, err = ds.Set(config)
	require.NoError(t, err)

	for _, file := range files {
		err = ds.SetFile(file, data)
		require.NoError(t, err)
	}
	err = Migrate(sqlDSN, fileDSN)
	require.NoError(t, err)

	fs, err := NewFileStore(fileDSN, false)
	require.NoError(t, err)
	defer fs.Close()

	for _, file := range files {
		hasFile, err := fs.HasFile(file)
		require.NoError(t, err)
		defer fs.RemoveFile(file)
		assert.True(t, hasFile)
	}

	assert.Equal(t, ds.Get(), fs.Get())
}

func TestMigrateFileToDatabaseWhenFilePathIsNotSpecified(t *testing.T) {
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSQLSettings()
	defer storetest.CleanupSqlSettings(sqlSettings)
	sqlDSN := fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource)
	fileDSN := "config.json"

	_, err := NewFileStore(fileDSN, true)
	require.NoError(t, err)

	err = Migrate(fileDSN, sqlDSN)
	require.NoError(t, err)
}
