// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"bytes"
	"encoding/json"
	"io/ioutil"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/model"
)

// memoryStore implements the Store interface. It is meant primarily for testing.
type memoryStore struct {
	emitter

	Config               *model.Config
	EnvironmentOverrides map[string]interface{}

	allowEnvironmentOverrides bool
}

// NewMemoryStore creates a new memoryStore instance.
func NewMemoryStore(allowEnvironmentOverrides bool) (*memoryStore, error) {
	defaultCfg := &model.Config{}
	defaultCfg.SetDefaults()

	ms := &memoryStore{
		Config:                    defaultCfg,
		allowEnvironmentOverrides: allowEnvironmentOverrides,
	}

	if err := ms.Load(); err != nil {
		return nil, err
	}

	return ms, nil
}

// Get fetches the current, cached configuration.
func (ms *memoryStore) Get() *model.Config {
	return ms.Config
}

// GetEnvironmentOverrides fetches the configuration fields overridden by environment variables.
func (ms *memoryStore) GetEnvironmentOverrides() map[string]interface{} {
	return ms.EnvironmentOverrides
}

// Set replaces the current configuration in its entirety.
func (ms *memoryStore) Set(newCfg *model.Config) (*model.Config, error) {
	oldCfg := ms.Config

	newCfg.SetDefaults()
	ms.Config = newCfg

	return oldCfg, nil
}

// serialize converts the given configuration into JSON bytes for persistence.
func (ms *memoryStore) serialize(cfg *model.Config) ([]byte, error) {
	return json.MarshalIndent(cfg, "", "    ")
}

// Load applies environment overrides to the current config as if a re-load had occurred.
func (ms *memoryStore) Load() (err error) {
	var cfgBytes []byte
	cfgBytes, err = ms.serialize(ms.Config)
	if err != nil {
		return errors.Wrap(err, "failed to serialize config")
	}

	f := ioutil.NopCloser(bytes.NewReader(cfgBytes))

	allowEnvironmentOverrides := true
	loadedCfg, environmentOverrides, err := unmarshalConfig(f, allowEnvironmentOverrides)
	if err != nil {
		return errors.Wrap(err, "failed to load config")
	}

	ms.Config = loadedCfg
	ms.EnvironmentOverrides = environmentOverrides

	return nil
}

// Save does nothing, as there is no backing store.
func (ms *memoryStore) Save() error {
	return nil
}

// String returns a hard-coded description, as there is no backing store.
func (ms *memoryStore) String() string {
	return "mock://"
}

// Close does nothing for a mock store.
func (ms *memoryStore) Close() error {
	return nil
}
