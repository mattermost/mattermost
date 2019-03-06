// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"bytes"
	"io"
	"reflect"
	"sync"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

// commonStore enables code sharing between different backing implementations
type commonStore struct {
	emitter

	configLock           sync.RWMutex
	config               *model.Config
	loadedConfigNoEnv    *model.Config
	environmentOverrides map[string]interface{}
}

// Get fetches the current, cached configuration.
func (cs *commonStore) Get() *model.Config {
	cs.configLock.RLock()
	defer cs.configLock.RUnlock()

	return cs.config
}

// GetEnvironmentOverrides fetches the configuration fields overridden by environment variables.
func (cs *commonStore) GetEnvironmentOverrides() map[string]interface{} {
	cs.configLock.RLock()
	defer cs.configLock.RUnlock()

	return cs.environmentOverrides
}

// GetWithoutEnvOverrides fetches the current, cached configuration without environment variables
// At the moment this is used only for testing.
func (cs *commonStore) GetWithoutEnvOverrides() *model.Config {
	cs.configLock.RLock()
	defer cs.configLock.RUnlock()

	return cs.loadedConfigNoEnv
}

// set replaces the current configuration in its entirety, and updates the backing store
// using the persist function argument.
//
// This function assumes no lock has been acquired, as it acquires a write lock itself.
func (cs *commonStore) set(newCfg *model.Config, validate func(*model.Config) error, persist func(*model.Config) error) (*model.Config, error) {
	cs.configLock.Lock()
	var unlockOnce sync.Once
	defer unlockOnce.Do(cs.configLock.Unlock)

	oldCfg := cs.config

	// TODO: disallow attempting to save a directly modified config (comparing pointers). This
	// wouldn't be an exhaustive check, given the use of pointers throughout the data
	// structure, but might prevent common mistakes. Requires upstream changes first.
	// if newCfg == oldCfg {
	// 	return nil, errors.New("old configuration modified instead of cloning")
	// }

	newCfg = newCfg.Clone()
	newCfg.SetDefaults()

	// Sometimes the config is received with "fake" data in sensitive fields. Apply the real
	// data from the existing config as necessary.
	desanitize(oldCfg, newCfg)

	if validate != nil {
		if err := validate(newCfg); err != nil {
			return nil, errors.Wrap(err, "new configuration is invalid")
		}
	}

	if err := persist(cs.removeEnvOverrides(newCfg)); err != nil {
		return nil, errors.Wrap(err, "failed to persist")
	}

	cs.config = newCfg

	unlockOnce.Do(cs.configLock.Unlock)

	// Notify listeners synchronously. Ideally, this would be asynchronous, but existing code
	// assumes this and there would be increased complexity to avoid racing updates.
	cs.invokeConfigListeners(oldCfg, newCfg)

	return oldCfg, nil
}

// load updates the current configuration from the given io.ReadCloser.
//
// This function assumes no lock has been acquired, as it acquires a write lock itself.
func (cs *commonStore) load(f io.ReadCloser, needsSave bool, validate func(*model.Config) error, persist func(*model.Config) error) error {
	// Split f into two so that we can have a configuration that does not have environment overrides
	f2 := new(bytes.Buffer)
	tee := io.TeeReader(f, f2)

	allowEnvironmentOverrides := true
	loadedCfg, environmentOverrides, err := unmarshalConfig(tee, allowEnvironmentOverrides)
	if err != nil {
		return errors.Wrapf(err, "failed to unmarshal config with env overrides")
	}

	// Keep track of the original values that the Environment settings overrode
	loadedCfgNoEnv, _, err2 := unmarshalConfig(f2, false)
	if err2 != nil {
		return errors.Wrapf(err, "failed to unmarshal config without env overrides")
	}

	// SetDefaults generates various keys and salts if not previously configured. Determine if
	// such a change will be made before invoking.
	needsSave = needsSave || loadedCfg.SqlSettings.AtRestEncryptKey == nil || len(*loadedCfg.SqlSettings.AtRestEncryptKey) == 0
	needsSave = needsSave || loadedCfg.FileSettings.PublicLinkSalt == nil || len(*loadedCfg.FileSettings.PublicLinkSalt) == 0
	needsSave = needsSave || loadedCfg.EmailSettings.InviteSalt == nil || len(*loadedCfg.EmailSettings.InviteSalt) == 0
	needsSave = needsSave || loadedCfgNoEnv.SqlSettings.AtRestEncryptKey == nil || len(*loadedCfgNoEnv.SqlSettings.AtRestEncryptKey) == 0
	needsSave = needsSave || loadedCfgNoEnv.FileSettings.PublicLinkSalt == nil || len(*loadedCfgNoEnv.FileSettings.PublicLinkSalt) == 0
	needsSave = needsSave || loadedCfgNoEnv.EmailSettings.InviteSalt == nil || len(*loadedCfgNoEnv.EmailSettings.InviteSalt) == 0

	loadedCfg.SetDefaults()
	loadedCfgNoEnv.SetDefaults()

	if validate != nil {
		if err = validate(loadedCfg); err != nil {
			return errors.Wrap(err, "invalid config with env overrides")
		}
		if err = validate(loadedCfgNoEnv); err != nil {
			return errors.Wrap(err, "invalid config without env overrides")
		}
	}

	if changed := fixConfig(loadedCfg); changed {
		needsSave = true
	}
	if changed := fixConfig(loadedCfgNoEnv); changed {
		needsSave = true
	}

	cs.configLock.Lock()
	var unlockOnce sync.Once
	defer unlockOnce.Do(cs.configLock.Unlock)

	oldCfg := cs.config
	cs.config = loadedCfg
	cs.loadedConfigNoEnv = loadedCfgNoEnv
	cs.environmentOverrides = environmentOverrides

	if needsSave && persist != nil {
		if err = persist(cs.removeEnvOverrides(loadedCfg)); err != nil {
			return errors.Wrap(err, "failed to persist required changes after load")
		}
	}

	unlockOnce.Do(cs.configLock.Unlock)

	// Notify listeners synchronously. Ideally, this would be asynchronous, but existing code
	// assumes this and there would be increased complexity to avoid racing updates.
	cs.invokeConfigListeners(oldCfg, loadedCfg)

	return nil
}

// validate checks if the given configuration is valid
func (cs *commonStore) validate(cfg *model.Config) error {
	if err := cfg.IsValid(); err != nil {
		return err
	}

	return nil
}

// removeEnvOverrides returns a new config without the current environment overrides.
// If a config variable has an environment override, that variable is set to the value that was
// read from the store.
func (cs *commonStore) removeEnvOverrides(cfg *model.Config) *model.Config {
	// When saving, iterate through the environmentOverrides map and check:
	// foreach envOverrides, if config == loadedConfigNoEnv, then the environment override matched the original setting. No change
	// foreach envOverrides, if config != loadedConfigNoEnv, then:
	//    a) if config == loadedConfig, persist loadedConfigNoEnv (we don't want to persist the envSetSetting).
	//    b) if config != loadedConfig, persist config (the user has subsequently changed the setting after the envOverride was applied)
	//       NOTE: b cannot happen at the moment (from docs: "if a setting is configured through an environment variable,
	//       modifying it in the System Console is disabled").
	// Therefore, if config != loadedConfigNoEnv, always persist the loadedConfigNoEnv value

	paths := getPaths(cs.environmentOverrides)
	newCfg := cfg.Clone()
	for _, path := range paths {
		currentVal := getVal(newCfg, path)
		loadedVal := getVal(cs.loadedConfigNoEnv, path)
		if currentVal.Interface() != loadedVal.Interface() {
			setVal(newCfg, path, loadedVal.Interface())
		}
	}
	return newCfg
}

// getPaths is helper function for removeEnvOverrides
func getPaths(m map[string]interface{}) [][]string {
	return getPathsRec(m, nil, nil)
}

// getPathsRec is helper function for removeENvOverrides
func getPathsRec(src interface{}, curPath []string, allPaths [][]string) [][]string {
	if reflect.ValueOf(src).Kind() == reflect.Map {
		for k, v := range src.(map[string]interface{}) {
			allPaths = getPathsRec(v, append(curPath, k), allPaths)
		}
	} else {
		allPaths = append(allPaths, curPath)
	}
	return allPaths
}

// getVal is helper function for removeEnvOverrides
func getVal(src interface{}, path []string) reflect.Value {
	var val reflect.Value
	if reflect.ValueOf(src).Kind() == reflect.Ptr {
		val = reflect.ValueOf(src).Elem().FieldByName(path[0])
	} else {
		val = reflect.ValueOf(src).FieldByName(path[0])
	}
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	if val.Kind() == reflect.Struct {
		return getVal(val.Interface(), path[1:])
	}
	return val
}

// setVal is helper function for removeENvOverrides
func setVal(tgt interface{}, path []string, newVal interface{}) {
	val := getVal(tgt, path)
	switch val.Kind() {
	case reflect.Bool:
		val.SetBool(newVal.(bool))
	case reflect.String:
		val.SetString(newVal.(string))
	case reflect.Int:
		val.SetInt(int64(newVal.(int)))
	case reflect.Int8:
		val.SetInt(int64(newVal.(int8)))
	case reflect.Int16:
		val.SetInt(int64(newVal.(int16)))
	case reflect.Int32:
		val.SetInt(int64(newVal.(int32)))
	case reflect.Int64:
		val.SetInt(newVal.(int64))
	case reflect.Float32:
		val.SetFloat(float64(newVal.(float32)))
	case reflect.Float64:
		val.SetFloat(newVal.(float64))
	case reflect.Uint8:
		val.SetUint(uint64(newVal.(uint8)))
	case reflect.Uint16:
		val.SetUint(uint64(newVal.(uint16)))
	case reflect.Uint32:
		val.SetUint(uint64(newVal.(uint32)))
	case reflect.Uint64:
		val.SetUint(newVal.(uint64))
	}
}
