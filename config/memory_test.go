// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
)

func setupConfigMemory(t *testing.T) {
	t.Helper()
	os.Clearenv()
}

func TestMemoryGetFile(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
		InitialConfig: minimalConfig,
		InitialFiles: map[string][]byte{
			"empty-file": {},
			"test-file":  []byte("test"),
		},
	})
	require.NoError(t, err)
	defer ms.Close()

	t.Run("get empty filename", func(t *testing.T) {
		_, err := ms.GetFile("")
		require.Error(t, err)
	})

	t.Run("get non-existent file", func(t *testing.T) {
		_, err := ms.GetFile("unknown")
		require.Error(t, err)
	})

	t.Run("get empty file", func(t *testing.T) {
		data, err := ms.GetFile("empty-file")
		require.NoError(t, err)
		require.Empty(t, data)
	})

	t.Run("get non-empty file", func(t *testing.T) {
		data, err := ms.GetFile("test-file")
		require.NoError(t, err)
		require.Equal(t, []byte("test"), data)
	})
}

func TestMemorySetFile(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
		InitialConfig: minimalConfig,
	})
	require.NoError(t, err)
	defer ms.Close()

	t.Run("set new file", func(t *testing.T) {
		err := ms.SetFile("new", []byte("new file"))
		require.NoError(t, err)

		data, err := ms.GetFile("new")
		require.NoError(t, err)
		require.Equal(t, []byte("new file"), data)
	})

	t.Run("overwrite existing file", func(t *testing.T) {
		err := ms.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = ms.SetFile("existing", []byte("overwritten file"))
		require.NoError(t, err)

		data, err := ms.GetFile("existing")
		require.NoError(t, err)
		require.Equal(t, []byte("overwritten file"), data)
	})
}

func TestMemoryHasFile(t *testing.T) {
	t.Run("has non-existent", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		has, err := ms.HasFile("non-existent")
		require.NoError(t, err)
		require.False(t, has)
	})

	t.Run("has existing", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		has, err := ms.HasFile("existing")
		require.NoError(t, err)
		require.True(t, has)
	})

	t.Run("has manually created file", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
			InitialFiles: map[string][]byte{
				"manual": []byte("manual file"),
			},
		})
		require.NoError(t, err)
		defer ms.Close()

		has, err := ms.HasFile("manual")
		require.NoError(t, err)
		require.True(t, has)
	})
}

func TestMemoryRemoveFile(t *testing.T) {
	t.Run("remove non-existent", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.RemoveFile("non-existent")
		require.NoError(t, err)
	})

	t.Run("remove existing", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.SetFile("existing", []byte("existing file"))
		require.NoError(t, err)

		err = ms.RemoveFile("existing")
		require.NoError(t, err)

		has, err := ms.HasFile("existing")
		require.NoError(t, err)
		require.False(t, has)

		_, err = ms.GetFile("existing")
		require.Error(t, err)
	})

	t.Run("remove manually created file", func(t *testing.T) {
		setupConfigMemory(t)

		ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
			InitialConfig: minimalConfig,
			InitialFiles: map[string][]byte{
				"manual": []byte("manual file"),
			},
		})
		require.NoError(t, err)
		defer ms.Close()

		err = ms.RemoveFile("manual")
		require.NoError(t, err)

		has, err := ms.HasFile("manual")
		require.NoError(t, err)
		require.False(t, has)

		_, err = ms.GetFile("manual")
		require.Error(t, err)
	})
}

func TestMemoryStoreString(t *testing.T) {
	setupConfigMemory(t)

	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{InitialConfig: emptyConfig})
	require.NoError(t, err)
	defer ms.Close()

	assert.Equal(t, "memory://", ms.String())
}
