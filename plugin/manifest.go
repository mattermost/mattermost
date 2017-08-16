package plugin

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

type Manifest struct {
	Id      string           `json:"id" yaml:"id"`
	Backend *ManifestBackend `json:"backend,omitempty" yaml:"backend,omitempty"`
}

type ManifestBackend struct {
	Executable string `json:"executable" yaml:"executable"`
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
