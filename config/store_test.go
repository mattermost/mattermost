// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
)

func TestNewStore(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	sqlSettings := mainHelper.GetSQLSettings()

	tempDir, err := ioutil.TempDir("", "TestNewStore")
	require.NoError(t, err)

	err = os.Chdir(tempDir)
	require.NoError(t, err)

	require.NoError(t, os.Mkdir(filepath.Join(tempDir, "config"), 0700))

	t.Run("database dsn", func(t *testing.T) {
		ds, err := config.NewStore(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource), false, false, nil)
		require.NoError(t, err)
		ds.Close()
	})

	t.Run("database dsn, watch ignored", func(t *testing.T) {
		ds, err := config.NewStore(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource), true, false, nil)
		require.NoError(t, err)
		ds.Close()
	})

	t.Run("file dsn", func(t *testing.T) {
		fs, err := config.NewStore("config.json", false, false, nil)
		require.NoError(t, err)
		fs.Close()
	})

	t.Run("file dsn, watch", func(t *testing.T) {
		fs, err := config.NewStore("config.json", true, false, nil)
		require.NoError(t, err)
		fs.Close()
	})
}

func TestNewStoreReadOnly(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	sqlSettings := mainHelper.GetSQLSettings()

	tempDir, err := ioutil.TempDir("", "TestNewStore")
	require.NoError(t, err)

	err = os.Chdir(tempDir)
	require.NoError(t, err)

	require.NoError(t, os.Mkdir(filepath.Join(tempDir, "config"), 0700))

	t.Run("database dsn", func(t *testing.T) {
		ds, err := config.NewStore(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource), false, true, nil)
		require.NoError(t, err)

		t.Run("Set", func(t *testing.T) {
			cfg, err := ds.Set(emptyConfig)
			require.Nil(t, cfg)
			require.Equal(t, config.ErrReadOnlyStore, err)
		})

		t.Run("SetFile", func(t *testing.T) {
			err := ds.SetFile("config.json", []byte{})
			require.Equal(t, config.ErrReadOnlyStore, err)
		})

		t.Run("RemoveFile", func(t *testing.T) {
			err := ds.RemoveFile("config.json")
			require.Equal(t, config.ErrReadOnlyStore, err)
		})

		ds.Close()
	})

	t.Run("file dsn", func(t *testing.T) {
		fs, err := config.NewStore("config.json", false, true, nil)
		require.NoError(t, err)

		t.Run("Set", func(t *testing.T) {
			cfg, err := fs.Set(emptyConfig)
			require.Nil(t, cfg)
			require.Equal(t, config.ErrReadOnlyStore, err)
		})

		t.Run("SetFile", func(t *testing.T) {
			err := fs.SetFile("config.json", []byte{})
			require.Equal(t, config.ErrReadOnlyStore, err)
		})

		t.Run("RemoveFile", func(t *testing.T) {
			err := fs.RemoveFile("config.json")
			require.Equal(t, config.ErrReadOnlyStore, err)
		})

		fs.Close()
	})
}
