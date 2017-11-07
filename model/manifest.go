// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

const (
	PLUGIN_CONFIG_TYPE_TEXT      = "text"
	PLUGIN_CONFIG_TYPE_BOOL      = "bool"
	PLUGIN_CONFIG_TYPE_RADIO     = "radio"
	PLUGIN_CONFIG_TYPE_DROPDOWN  = "dropdown"
	PLUGIN_CONFIG_TYPE_GENERATED = "generated"
)

type PluginOption struct {
	DisplayName string `json:"display_name" yaml:"display_name"`
	Value       string `json:"value" yaml:"value"`
}

type PluginSetting struct {
	DisplayName        string          `json:"display_name" yaml:"display_name"`
	Type               string          `json:"type" yaml:"type"`
	HelpText           string          `json:"help_text" yaml:"help_text"`
	RegenerateHelpText string          `json:"regenerate_help_text,omitempty" yaml:"regenerate_help_text,omitempty"`
	Default            interface{}     `json:"default" yaml:"default"`
	Options            []*PluginOption `json:"options,omitempty" yaml:"options,omitempty"`
}

type PluginSettingsSchema struct {
	Header   string                    `json:"header" yaml:"header"`
	Footer   string                    `json:"footer" yaml:"footer"`
	Settings map[string]*PluginSetting `json:"settings" yaml:"settings"`
}

type Manifest struct {
	Id             string                `json:"id" yaml:"id"`
	Name           string                `json:"name,omitempty" yaml:"name,omitempty"`
	Description    string                `json:"description,omitempty" yaml:"description,omitempty"`
	Version        string                `json:"version" yaml:"version"`
	Backend        *ManifestBackend      `json:"backend,omitempty" yaml:"backend,omitempty"`
	Webapp         *ManifestWebapp       `json:"webapp,omitempty" yaml:"webapp,omitempty"`
	SettingsSchema *PluginSettingsSchema `json:"settings_schema,omitempty" yaml:"settings_schema,omitempty"`
}

type ManifestBackend struct {
	Executable string `json:"executable" yaml:"executable"`
}

type ManifestWebapp struct {
	BundlePath string `json:"bundle_path" yaml:"bundle_path"`
}

func (m *Manifest) ToJson() string {
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ManifestListToJson(m []*Manifest) string {
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ManifestFromJson(data io.Reader) *Manifest {
	decoder := json.NewDecoder(data)
	var m Manifest
	err := decoder.Decode(&m)
	if err == nil {
		return &m
	} else {
		return nil
	}
}

func ManifestListFromJson(data io.Reader) []*Manifest {
	decoder := json.NewDecoder(data)
	var manifests []*Manifest
	err := decoder.Decode(&manifests)
	if err == nil {
		return manifests
	} else {
		return nil
	}
}

func (m *Manifest) HasClient() bool {
	return m.Webapp != nil
}

func (m *Manifest) ClientManifest() *Manifest {
	cm := new(Manifest)
	*cm = *m
	cm.Name = ""
	cm.Description = ""
	cm.Backend = nil
	return cm
}

// FindManifest will find and parse the manifest in a given directory.
//
// In all cases other than a does-not-exist error, path is set to the path of the manifest file that was
// found.
//
// Manifests are JSON or YAML files named plugin.json, plugin.yaml, or plugin.yml.
func FindManifest(dir string) (manifest *Manifest, path string, err error) {
	for _, name := range []string{"plugin.yml", "plugin.yaml"} {
		path = filepath.Join(dir, name)
		f, ferr := os.Open(path)
		if ferr != nil {
			if !os.IsNotExist(ferr) {
				err = ferr
				return
			}
			continue
		}
		b, ioerr := ioutil.ReadAll(f)
		f.Close()
		if ioerr != nil {
			err = ioerr
			return
		}
		var parsed Manifest
		err = yaml.Unmarshal(b, &parsed)
		if err != nil {
			return
		}
		manifest = &parsed
		return
	}

	path = filepath.Join(dir, "plugin.json")
	f, ferr := os.Open(path)
	if ferr != nil {
		if os.IsNotExist(ferr) {
			path = ""
		}
		err = ferr
		return
	}
	defer f.Close()
	var parsed Manifest
	err = json.NewDecoder(f).Decode(&parsed)
	if err != nil {
		return
	}
	manifest = &parsed
	return
}
