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
		{"plugin.json", `{"id": "FOO"}`, false, false},
		{"plugin.yaml", `id: foo`, false, false},
		{"plugin.yaml", "bar", true, false},
		{"plugin.yml", `id: foo`, false, false},
		{"plugin.yml", `id: FOO`, false, false},
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
			assert.Equal(t, strings.ToLower(m.Id), m.Id)
		}
	}
}

func TestManifestUnmarshal(t *testing.T) {
	expected := Manifest{
		Id: "theid",
		Server: &ManifestServer{
			Executable: "theexecutable",
			Executables: &ManifestExecutables{
				LinuxAmd64:   "theexecutable-linux-amd64",
				DarwinAmd64:  "theexecutable-darwin-amd64",
				WindowsAmd64: "theexecutable-windows-amd64",
			},
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
					Type:               "dropdown",
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
server:
    executable: theexecutable
    executables:
          linux-amd64: theexecutable-linux-amd64
          darwin-amd64: theexecutable-darwin-amd64
          windows-amd64: theexecutable-windows-amd64
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
	"server": {
		"executable": "theexecutable",
		"executables": {
			"linux-amd64": "theexecutable-linux-amd64",
			"darwin-amd64": "theexecutable-darwin-amd64",
			"windows-amd64": "theexecutable-windows-amd64"
		}
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
		Server: &ManifestServer{
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
					Type:               "dropdown",
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
		Server: &ManifestServer{
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
		Server: &ManifestServer{
			Executable: "theexecutable",
		},
		Webapp: &ManifestWebapp{
			BundlePath: "thebundlepath",
			BundleHash: []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
		},
		SettingsSchema: &PluginSettingsSchema{
			Header: "theheadertext",
			Footer: "thefootertext",
			Settings: []*PluginSetting{
				&PluginSetting{
					Key:                "thesetting",
					DisplayName:        "thedisplayname",
					Type:               "dropdown",
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

	assert.Equal(t, manifest.Id, sanitized.Id)
	assert.Equal(t, manifest.Version, sanitized.Version)
	assert.Equal(t, "/static/theid/theid_000102030405060708090a0b0c0d0e0f_bundle.js", sanitized.Webapp.BundlePath)
	assert.Equal(t, manifest.Webapp.BundleHash, sanitized.Webapp.BundleHash)
	assert.Equal(t, manifest.SettingsSchema, sanitized.SettingsSchema)
	assert.Empty(t, sanitized.Name)
	assert.Empty(t, sanitized.Description)
	assert.Empty(t, sanitized.Server)

	assert.NotEmpty(t, manifest.Id)
	assert.NotEmpty(t, manifest.Version)
	assert.NotEmpty(t, manifest.Webapp)
	assert.NotEmpty(t, manifest.Name)
	assert.NotEmpty(t, manifest.Description)
	assert.NotEmpty(t, manifest.Server)
	assert.NotEmpty(t, manifest.SettingsSchema)
}

func TestManifestGetExecutableForRuntime(t *testing.T) {
	testCases := []struct {
		Description        string
		Manifest           *Manifest
		GoOs               string
		GoArch             string
		ExpectedExecutable string
	}{
		{
			"no server",
			&Manifest{},
			"linux",
			"amd64",
			"",
		},
		{
			"no executable",
			&Manifest{
				Server: &ManifestServer{},
			},
			"linux",
			"amd64",
			"",
		},
		{
			"single executable",
			&Manifest{
				Server: &ManifestServer{
					Executable: "path/to/executable",
				},
			},
			"linux",
			"amd64",
			"path/to/executable",
		},
		{
			"single executable, different runtime",
			&Manifest{
				Server: &ManifestServer{
					Executable: "path/to/executable",
				},
			},
			"darwin",
			"amd64",
			"path/to/executable",
		},
		{
			"multiple executables, no match",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
			},
			"other",
			"amd64",
			"",
		},
		{
			"multiple executables, linux-amd64 match",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
			},
			"linux",
			"amd64",
			"linux-amd64/path/to/executable",
		},
		{
			"multiple executables, linux-amd64 match, single executable ignored",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
					Executable: "path/to/executable",
				},
			},
			"linux",
			"amd64",
			"linux-amd64/path/to/executable",
		},
		{
			"multiple executables, darwin-amd64 match",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
			},
			"darwin",
			"amd64",
			"darwin-amd64/path/to/executable",
		},
		{
			"multiple executables, windows-amd64 match",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
			},
			"windows",
			"amd64",
			"windows-amd64/path/to/executable",
		},
		{
			"multiple executables, no match, single executable fallback",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
					Executable: "path/to/executable",
				},
			},
			"other",
			"amd64",
			"path/to/executable",
		},
		{
			"deprecated backend field, ignored since server present",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
				Backend: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable/backend",
						DarwinAmd64:  "darwin-amd64/path/to/executable/backend",
						WindowsAmd64: "windows-amd64/path/to/executable/backend",
					},
				},
			},
			"linux",
			"amd64",
			"linux-amd64/path/to/executable",
		},
		{
			"deprecated backend field used, since no server present",
			&Manifest{
				Backend: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable/backend",
						DarwinAmd64:  "darwin-amd64/path/to/executable/backend",
						WindowsAmd64: "windows-amd64/path/to/executable/backend",
					},
				},
			},
			"linux",
			"amd64",
			"linux-amd64/path/to/executable/backend",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			assert.Equal(
				t,
				testCase.ExpectedExecutable,
				testCase.Manifest.GetExecutableForRuntime(testCase.GoOs, testCase.GoArch),
			)
		})
	}
}

func TestManifestHasServer(t *testing.T) {
	testCases := []struct {
		Description string
		Manifest    *Manifest
		Expected    bool
	}{
		{
			"no server",
			&Manifest{},
			false,
		},
		{
			"no executable, but server still considered present",
			&Manifest{
				Server: &ManifestServer{},
			},
			true,
		},
		{
			"single executable",
			&Manifest{
				Server: &ManifestServer{
					Executable: "path/to/executable",
				},
			},
			true,
		},
		{
			"multiple executables",
			&Manifest{
				Server: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
			},
			true,
		},
		{
			"single executable defined via deprecated backend",
			&Manifest{
				Backend: &ManifestServer{
					Executable: "path/to/executable",
				},
			},
			true,
		},
		{
			"multiple executables defined via deprecated backend",
			&Manifest{
				Backend: &ManifestServer{
					Executables: &ManifestExecutables{
						LinuxAmd64:   "linux-amd64/path/to/executable",
						DarwinAmd64:  "darwin-amd64/path/to/executable",
						WindowsAmd64: "windows-amd64/path/to/executable",
					},
				},
			},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			assert.Equal(t, testCase.Expected, testCase.Manifest.HasServer())
		})
	}
}

func TestManifestHasWebapp(t *testing.T) {
	testCases := []struct {
		Description string
		Manifest    *Manifest
		Expected    bool
	}{
		{
			"no webapp",
			&Manifest{},
			false,
		},
		{
			"no bundle path, but webapp still considered present",
			&Manifest{
				Webapp: &ManifestWebapp{},
			},
			true,
		},
		{
			"bundle path defined",
			&Manifest{
				Webapp: &ManifestWebapp{
					BundlePath: "path/to/bundle",
				},
			},
			true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			assert.Equal(t, testCase.Expected, testCase.Manifest.HasWebapp())
		})
	}
}
