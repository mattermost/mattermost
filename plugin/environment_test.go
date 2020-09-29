// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestAvaliablePlugins(t *testing.T) {
	dir, err1 := ioutil.TempDir("", "mm-plugin-test")
	require.NoError(t, err1)
	t.Cleanup(func() {
		os.RemoveAll(dir)
	})

	env := Environment{
		pluginDir: dir,
	}

 	t.Run("Should be able to load available plugins", func(t *testing.T) { 
		bundle1 := model.BundleInfo{
			ManifestPath: "",
			Manifest: &model.Manifest{
				Id:      "someid",
				Version: "1",
			},
		}
		err := os.Mkdir(filepath.Join(dir, "plugin1"), 0700)
		require.NoError(t, err)
		defer os.RemoveAll(filepath.Join(dir, "plugin1"))

		path := filepath.Join(dir, "plugin1", "plugin.json")
		f, err := os.Create(path)
		require.NoError(t, err)

		_, err = f.WriteString(bundle1.Manifest.ToJson())
		require.NoError(t, err)
		f.Close()

		bundles, err := env.Available()
		require.NoError(t, err)
		require.Len(t, bundles, 1)
	})

	t.Run("Should not be able to load plugins without a valid manifest", func(t *testing.T) {
		err := os.Mkdir(filepath.Join(dir, "plugin2"), 0700)
		require.NoError(t, err)
		defer os.RemoveAll(filepath.Join(dir, "plugin2"))

		path := filepath.Join(dir, "plugin2", "manifest.json")
		f, err := os.Create(path)
		require.NoError(t, err)

		_, err = f.WriteString("{}")
		require.NoError(t, err)
		f.Close()

		bundles, err := env.Available()
		require.NoError(t, err)
		require.Len(t, bundles, 0)
	})
}
