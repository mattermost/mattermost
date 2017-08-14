package plugin

import (
	"encoding/json"
	"gopkg.in/yaml.v2"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFindManifest(t *testing.T) {
	for _, tc := range []struct {
		Filename       string
		Contents       string
		ExpectError    bool
		ExpectNotExist bool
	}{
		{"foo", "bar", true, true},
		{"plugin.json", "bar", true, false},
		{"plugin.json", `{"id": "foo"}`, false, false},
		{"plugin.yaml", `id: foo`, false, false},
		{"plugin.yaml", "bar", true, false},
		{"plugin.yml", `id: foo`, false, false},
		{"plugin.yml", "bar", true, false},
	} {
		dir, err := ioutil.TempDir("", "mm-plugin-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		path := filepath.Join(dir, tc.Filename)
		f, err := os.Create(path)
		require.NoError(t, err)
		_, err = f.WriteString(tc.Contents)
		f.Close()
		require.NoError(t, err)

		m, mpath, err := FindManifest(dir)
		assert.True(t, (err != nil) == tc.ExpectError, tc.Filename)
		assert.True(t, (err != nil && os.IsNotExist(err)) == tc.ExpectNotExist, tc.Filename)
		if !tc.ExpectNotExist {
			assert.Equal(t, path, mpath, tc.Filename)
		} else {
			assert.Empty(t, mpath, tc.Filename)
		}
		if !tc.ExpectError {
			require.NotNil(t, m, tc.Filename)
			assert.NotEmpty(t, m.Id, tc.Filename)
		}
	}
}

func TestManifestUnmarshal(t *testing.T) {
	expected := Manifest{
		Id: "theid",
		Backend: &ManifestBackend{
			Executable: "theexecutable",
		},
	}

	var yamlResult Manifest
	require.NoError(t, yaml.Unmarshal([]byte(`
id: theid
backend:
    executable: theexecutable
`), &yamlResult))
	assert.Equal(t, expected, yamlResult)

	var jsonResult Manifest
	require.NoError(t, json.Unmarshal([]byte(`{
	"id": "theid",
	"backend": {
		"executable": "theexecutable"
	}
	}`), &jsonResult))
	assert.Equal(t, expected, jsonResult)
}

func TestFindManifest_FileErrors(t *testing.T) {
	for _, tc := range []string{"plugin.yaml", "plugin.json"} {
		dir, err := ioutil.TempDir("", "mm-plugin-test")
		require.NoError(t, err)
		defer os.RemoveAll(dir)

		path := filepath.Join(dir, tc)
		require.NoError(t, os.Mkdir(path, 0700))

		m, mpath, err := FindManifest(dir)
		assert.Nil(t, m)
		assert.Equal(t, path, mpath)
		assert.Error(t, err, tc)
		assert.False(t, os.IsNotExist(err), tc)
	}
}
