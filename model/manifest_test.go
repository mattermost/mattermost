// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gopkg.in/yaml.v2"

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
		Webapp: &ManifestWebapp{
			BundlePath: "thebundlepath",
		},
		SettingsSchema: &PluginSettingsSchema{
			Header: "theheadertext",
			Footer: "thefootertext",
			Settings: []*PluginSetting{
				&PluginSetting{
					Key:                "thesetting",
					DisplayName:        "thedisplayname",
					Type:               PLUGIN_CONFIG_TYPE_DROPDOWN,
					HelpText:           "thehelptext",
					RegenerateHelpText: "theregeneratehelptext",
					Placeholder:        "theplaceholder",
					Options: []*PluginOption{
						&PluginOption{
							DisplayName: "theoptiondisplayname",
							Value:       "thevalue",
						},
					},
					Default: "thedefault",
				},
			},
		},
	}

	var yamlResult Manifest
	require.NoError(t, yaml.Unmarshal([]byte(`
id: theid
backend:
    executable: theexecutable
webapp:
    bundle_path: thebundlepath
settings_schema:
    header: theheadertext
    footer: thefootertext
    settings:
        - key: thesetting
          display_name: thedisplayname
          type: dropdown
          help_text: thehelptext
          regenerate_help_text: theregeneratehelptext
          placeholder: theplaceholder
          options:
              - display_name: theoptiondisplayname
                value: thevalue
          default: thedefault
`), &yamlResult))
	assert.Equal(t, expected, yamlResult)

	var jsonResult Manifest
	require.NoError(t, json.Unmarshal([]byte(`{
	"id": "theid",
	"backend": {
		"executable": "theexecutable"
	},
	"webapp": {
		"bundle_path": "thebundlepath"
	},
    "settings_schema": {
        "header": "theheadertext",
        "footer": "thefootertext",
        "settings": [
			{
				"key": "thesetting",
				"display_name": "thedisplayname",
				"type": "dropdown",
				"help_text": "thehelptext",
				"regenerate_help_text": "theregeneratehelptext",
				"placeholder": "theplaceholder",
				"options": [
					{
						"display_name": "theoptiondisplayname",
						"value": "thevalue"
					}
				],
				"default": "thedefault"
			}
		]
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

func TestManifestJson(t *testing.T) {
	manifest := &Manifest{
		Id: "theid",
		Backend: &ManifestBackend{
			Executable: "theexecutable",
		},
		Webapp: &ManifestWebapp{
			BundlePath: "thebundlepath",
		},
		SettingsSchema: &PluginSettingsSchema{
			Header: "theheadertext",
			Footer: "thefootertext",
			Settings: []*PluginSetting{
				&PluginSetting{
					Key:                "thesetting",
					DisplayName:        "thedisplayname",
					Type:               PLUGIN_CONFIG_TYPE_DROPDOWN,
					HelpText:           "thehelptext",
					RegenerateHelpText: "theregeneratehelptext",
					Placeholder:        "theplaceholder",
					Options: []*PluginOption{
						&PluginOption{
							DisplayName: "theoptiondisplayname",
							Value:       "thevalue",
						},
					},
					Default: "thedefault",
				},
			},
		},
	}

	json := manifest.ToJson()
	newManifest := ManifestFromJson(strings.NewReader(json))
	assert.Equal(t, newManifest, manifest)
	assert.Equal(t, newManifest.ToJson(), json)
	assert.Equal(t, ManifestFromJson(strings.NewReader("junk")), (*Manifest)(nil))

	manifestList := []*Manifest{manifest}
	json = ManifestListToJson(manifestList)
	newManifestList := ManifestListFromJson(strings.NewReader(json))
	assert.Equal(t, newManifestList, manifestList)
	assert.Equal(t, ManifestListToJson(newManifestList), json)
}

func TestManifestHasClient(t *testing.T) {
	manifest := &Manifest{
		Id: "theid",
		Backend: &ManifestBackend{
			Executable: "theexecutable",
		},
		Webapp: &ManifestWebapp{
			BundlePath: "thebundlepath",
		},
	}

	assert.True(t, manifest.HasClient())

	manifest.Webapp = nil
	assert.False(t, manifest.HasClient())
}

func TestManifestClientManifest(t *testing.T) {
	manifest := &Manifest{
		Id:          "theid",
		Name:        "thename",
		Description: "thedescription",
		Version:     "0.0.1",
		Backend: &ManifestBackend{
			Executable: "theexecutable",
		},
		Webapp: &ManifestWebapp{
			BundlePath: "thebundlepath",
		},
		SettingsSchema: &PluginSettingsSchema{
			Header: "theheadertext",
			Footer: "thefootertext",
			Settings: []*PluginSetting{
				&PluginSetting{
					Key:                "thesetting",
					DisplayName:        "thedisplayname",
					Type:               PLUGIN_CONFIG_TYPE_DROPDOWN,
					HelpText:           "thehelptext",
					RegenerateHelpText: "theregeneratehelptext",
					Placeholder:        "theplaceholder",
					Options: []*PluginOption{
						&PluginOption{
							DisplayName: "theoptiondisplayname",
							Value:       "thevalue",
						},
					},
					Default: "thedefault",
				},
			},
		},
	}

	sanitized := manifest.ClientManifest()

	assert.NotEmpty(t, sanitized.Id)
	assert.NotEmpty(t, sanitized.Version)
	assert.NotEmpty(t, sanitized.Webapp)
	assert.NotEmpty(t, sanitized.SettingsSchema)
	assert.Empty(t, sanitized.Name)
	assert.Empty(t, sanitized.Description)
	assert.Empty(t, sanitized.Backend)

	assert.NotEmpty(t, manifest.Id)
	assert.NotEmpty(t, manifest.Version)
	assert.NotEmpty(t, manifest.Webapp)
	assert.NotEmpty(t, manifest.Name)
	assert.NotEmpty(t, manifest.Description)
	assert.NotEmpty(t, manifest.Backend)
	assert.NotEmpty(t, manifest.SettingsSchema)
}
