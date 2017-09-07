package pluginenv

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestScanSearchPath(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		".foo/plugin.json": `{"id": "foo"}`,
		"foo/bar":          "asdf",
		"foo/plugin.json":  `{"id": "foo"}`,
		"bar/zxc":          "qwer",
		"baz/plugin.yaml":  "id: baz",
		"bad/plugin.json":  "asd",
		"qwe":              "asd",
	})
	defer os.RemoveAll(dir)

	plugins, err := ScanSearchPath(dir)
	require.NoError(t, err)
	assert.Len(t, plugins, 3)
	assert.Contains(t, plugins, &model.BundleInfo{
		Path:         filepath.Join(dir, "foo"),
		ManifestPath: filepath.Join(dir, "foo", "plugin.json"),
		Manifest: &model.Manifest{
			Id: "foo",
		},
	})
	assert.Contains(t, plugins, &model.BundleInfo{
		Path:         filepath.Join(dir, "baz"),
		ManifestPath: filepath.Join(dir, "baz", "plugin.yaml"),
		Manifest: &model.Manifest{
			Id: "baz",
		},
	})
	foundError := false
	for _, x := range plugins {
		if x.ManifestError != nil {
			assert.Equal(t, x.Path, filepath.Join(dir, "bad"))
			assert.Equal(t, x.ManifestPath, filepath.Join(dir, "bad", "plugin.json"))
			syntexError, ok := x.ManifestError.(*json.SyntaxError)
			assert.True(t, ok)
			assert.EqualValues(t, 1, syntexError.Offset)
			foundError = true
		}
	}
	assert.True(t, foundError)
}

func TestScanSearchPath_Error(t *testing.T) {
	plugins, err := ScanSearchPath("not a valid path!")
	assert.Nil(t, plugins)
	assert.Error(t, err)
}
