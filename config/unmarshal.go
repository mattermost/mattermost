// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"reflect"
	"strings"

	"github.com/mattermost/viper"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/jsonutils"
)

// newViper creates an instance of viper.Viper configured for parsing a configuration.
func newViper(allowEnvironmentOverrides bool) *viper.Viper {
	v := viper.New()

	v.SetConfigType("json")

	v.AllowEmptyEnv(true)

	if allowEnvironmentOverrides {
		v.SetEnvPrefix("mm")
		v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
		v.AutomaticEnv()
	}

	return v
}

// marshalConfig converts the given configuration into JSON bytes for persistence.
func marshalConfig(cfg *model.Config) ([]byte, error) {
	return json.MarshalIndent(cfg, "", "    ")
}

// unmarshalConfig unmarshals a raw configuration into a Config model and environment variable overrides.
func unmarshalConfig(r io.Reader, allowEnvironmentOverrides bool) (*model.Config, map[string]interface{}, error) {
	// Pre-flight check the syntax of the configuration file to improve error messaging.
	configData, err := ioutil.ReadAll(r)
	if err != nil {
		return nil, nil, errors.Wrapf(err, "failed to read")
	}

	var rawConfig model.Config
	if err = json.Unmarshal(configData, &rawConfig); err != nil {
		return nil, nil, jsonutils.HumanizeJsonError(err, configData)
	}
	rawConfig.SetDefaults()
	dataWithDefaults, err := json.Marshal(rawConfig)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to re-marshal config")
	}

	v := newViper(allowEnvironmentOverrides)
	if err := v.ReadConfig(bytes.NewReader(dataWithDefaults)); err != nil {
		return nil, nil, err
	}

	var config model.Config
	unmarshalErr := v.Unmarshal(&config)
	// https://github.com/spf13/viper/issues/324
	// https://github.com/spf13/viper/issues/348
	if unmarshalErr == nil {
		config.PluginSettings.Plugins = make(map[string]map[string]interface{})
		unmarshalErr = v.UnmarshalKey("pluginsettings.plugins", &config.PluginSettings.Plugins)
	}
	if unmarshalErr == nil {
		config.PluginSettings.PluginStates = make(map[string]*model.PluginState)
		unmarshalErr = v.UnmarshalKey("pluginsettings.pluginstates", &config.PluginSettings.PluginStates)
	}

	envConfig := v.EnvSettings()

	var envErr error
	if envConfig, envErr = fixEnvSettingsCase(envConfig); envErr != nil {
		return nil, nil, envErr
	}

	return &config, envConfig, unmarshalErr
}

// Fixes the case of the environment variables sent back from Viper since Viper stores everything
// as lower case.
func fixEnvSettingsCase(in map[string]interface{}) (out map[string]interface{}, err error) {
	defer func() {
		if r := recover(); r != nil {
			mlog.Error("Panicked in fixEnvSettingsCase. This should never happen.", mlog.Any("err", r))
			out = in
		}
	}()

	var fixCase func(map[string]interface{}, reflect.Type) map[string]interface{}
	fixCase = func(in map[string]interface{}, t reflect.Type) map[string]interface{} {
		if t.Kind() == reflect.Ptr {
			t = t.Elem()
		}

		if t.Kind() != reflect.Struct {
			// Should never hit this, but this will prevent a panic if that does happen somehow
			return nil
		}

		fixCaseOut := make(map[string]interface{}, len(in))

		for i := 0; i < t.NumField(); i++ {
			field := t.Field(i)

			key := field.Name
			if value, ok := in[strings.ToLower(key)]; ok {
				if valueAsMap, ok := value.(map[string]interface{}); ok {
					fixCaseOut[key] = fixCase(valueAsMap, field.Type)
				} else {
					fixCaseOut[key] = value
				}
			}
		}

		return fixCaseOut
	}

	out = fixCase(in, reflect.TypeOf(model.Config{}))

	return
}
