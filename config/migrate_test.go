// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getDsn(driver string, source string) string {
	if driver == model.DATABASE_DRIVER_MYSQL {
		return driver + "://" + source
	}
	return source
}

func TestMigrateDatabaseToFile(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSQLSettings()
	fileDSN := "config.json"
	files := []string{"IdpCertificateFile", "PublicCertificateFile", "PrivateKeyFile"}
	data := []byte("aaaaa")
	ds, err := NewDatabaseStore(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource))
	defer ds.Close()
	defer func() {
		defaultCfg := &model.Config{}
		defaultCfg.SetDefaults()
		ds.Set(defaultCfg)
	}()
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
	err = Migrate(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource), fileDSN)
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
	if testing.Short() {
		t.SkipNow()
	}
	helper := testlib.NewMainHelper()
	sqlSettings := helper.GetSQLSettings()
	fileDSN := "config.json"

	_, err := NewFileStore(fileDSN, true)
	require.NoError(t, err)

	err = Migrate(fileDSN, getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource))
	require.NoError(t, err)
}
