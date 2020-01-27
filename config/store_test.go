// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/stretchr/testify/require"
)

func TestNewStore(t *testing.T) {
	sqlSettings := mainHelper.GetSQLSettings()

	tempDir, err := ioutil.TempDir("", "TestNewStore")
	require.NoError(t, err)

	err = os.Chdir(tempDir)
	require.NoError(t, err)

	require.NoError(t, os.Mkdir(filepath.Join(tempDir, "config"), 0700))

	t.Run("database dsn", func(t *testing.T) {
		ds, err := config.NewStore(fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource), false)
		require.NoError(t, err)
		ds.Close()
	})

	t.Run("database dsn, watch ignored", func(t *testing.T) {
		ds, err := config.NewStore(fmt.Sprintf("%s://%s", *sqlSettings.DriverName, *sqlSettings.DataSource), true)
		require.NoError(t, err)
		ds.Close()
	})

	t.Run("file dsn", func(t *testing.T) {
		fs, err := config.NewStore("config.json", false)
		require.NoError(t, err)
		fs.Close()
	})

	t.Run("file dsn, watch", func(t *testing.T) {
		fs, err := config.NewStore("config.json", true)
		require.NoError(t, err)
		fs.Close()
	})
}
