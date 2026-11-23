// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewStoreFromDSN(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	sqlSettings := mainHelper.GetSQLSettings()

	tempDir := t.TempDir()
	t.Chdir(tempDir)

	require.NoError(t, os.Mkdir(filepath.Join(tempDir, "config"), 0700))

	t.Run("database dsn", func(t *testing.T) {
		ds, err2 := NewStoreFromDSN(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource), false, nil, false)
		require.NoError(t, err2)
		ds.Close()
	})

	t.Run("file dsn", func(t *testing.T) {
		defer os.Remove("config_test.json")
		fs, err := NewStoreFromDSN("config_test.json", false, nil, true)
		require.NoError(t, err)
		fs.Close()
	})
}

func TestNewTestMemoryStoreSMTPDefaults(t *testing.T) {
	// An environment override would win over both the defaults and Set.
	t.Setenv("MM_EMAILSETTINGS_SMTPSERVER", "")
	require.NoError(t, os.Unsetenv("MM_EMAILSETTINGS_SMTPSERVER"))

	store := NewTestMemoryStore()
	require.Equal(t, "localhost", *store.Get().EmailSettings.SMTPServer)
	require.Equal(t, "10025", *store.Get().EmailSettings.SMTPPort)

	cfg := store.Get().Clone()
	*cfg.EmailSettings.SMTPPort = "5432"
	_, _, err := store.Set(cfg)
	require.NoError(t, err)
	require.Equal(t, "5432", *store.Get().EmailSettings.SMTPPort, "tests must be able to change the SMTP port")
}

func TestNewStoreReadOnly(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	sqlSettings := mainHelper.GetSQLSettings()

	tempDir := t.TempDir()
	t.Chdir(tempDir)

	require.NoError(t, os.Mkdir(filepath.Join(tempDir, "config"), 0700))

	t.Run("database dsn", func(t *testing.T) {
		ds, err := NewStoreFromDSN(getDsn(*sqlSettings.DriverName, *sqlSettings.DataSource), true, nil, false)
		require.NoError(t, err)

		t.Run("Set", func(t *testing.T) {
			oldCfg, newCfg, err2 := ds.Set(emptyConfig)
			require.Nil(t, oldCfg)
			require.Nil(t, newCfg)
			require.Equal(t, ErrReadOnlyStore, err2)
		})

		t.Run("SetFile", func(t *testing.T) {
			err := ds.SetFile("config.json", []byte{})
			require.Equal(t, ErrReadOnlyStore, err)
		})

		t.Run("RemoveFile", func(t *testing.T) {
			err := ds.RemoveFile("config.json")
			require.Equal(t, ErrReadOnlyStore, err)
		})

		ds.Close()
	})

	t.Run("file dsn", func(t *testing.T) {
		fs, err := NewStoreFromDSN("config_test.json", true, nil, true)
		require.NoError(t, err)

		t.Run("Set", func(t *testing.T) {
			oldCfg, newCfg, err := fs.Set(emptyConfig)
			require.Nil(t, oldCfg)
			require.Nil(t, newCfg)
			require.Equal(t, ErrReadOnlyStore, err)
		})

		t.Run("SetFile", func(t *testing.T) {
			err := fs.SetFile("config_test.json", []byte{})
			require.Equal(t, ErrReadOnlyStore, err)
		})

		t.Run("RemoveFile", func(t *testing.T) {
			err := fs.RemoveFile("config_test.json")
			require.Equal(t, ErrReadOnlyStore, err)
		})

		fs.Close()
	})
}
