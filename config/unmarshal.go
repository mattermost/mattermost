// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"reflect"
	"strconv"
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

	// Set zeroed defaults for all the config settings so that Viper knows what environment variables
	// it needs to be looking for. The correct defaults will later be applied using Config.SetDefaults.
	defaults := getDefaultsFromStruct(model.Config{})

	for key, value := range defaults {
		if key == "PluginSettings.Plugins" || key == "PluginSettings.PluginStates" {
			continue
		}

		v.SetDefault(key, value)
	}

	return v
}

func getDefaultsFromStruct(s interface{}) map[string]interface{} {
	return flattenStructToMap(structToMap(reflect.TypeOf(s)))
}

// Converts a struct type into a nested map with keys matching the struct's fields and values
// matching the zeroed value of the corresponding field.
func structToMap(t reflect.Type) (out map[string]interface{}) {
	defer func() {
		if r := recover(); r != nil {
			mlog.Error("Panicked in structToMap. This should never happen.", mlog.Any("err", r))
		}
	}()

	if t.Kind() != reflect.Struct {
		// Should never hit this, but this will prevent a panic if that does happen somehow
		return nil
	}

	out = map[string]interface{}{}

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		var value interface{}

		switch field.Type.Kind() {
		case reflect.Struct:
			value = structToMap(field.Type)
		case reflect.Ptr:
			indirectType := field.Type.Elem()

			if indirectType.Kind() == reflect.Struct {
				// Follow pointers to structs since we need to define defaults for their fields
				value = structToMap(indirectType)
			} else {
				value = nil
			}
		default:
			value = reflect.Zero(field.Type).Interface()
		}

		out[field.Name] = value
	}

	return
}

// Flattens a nested map so that the result is a single map with keys corresponding to the
// path through the original map. For example,
// {
//     "a": {
//         "b": 1
//     },
//     "c": "sea"
// }
// would flatten to
// {
//     "a.b": 1,
//     "c": "sea"
// }
func flattenStructToMap(in map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{})

	for key, value := range in {
		if valueAsMap, ok := value.(map[string]interface{}); ok {
			sub := flattenStructToMap(valueAsMap)

			for subKey, subValue := range sub {
				out[key+"."+subKey] = subValue
			}
		} else {
			out[key] = value
		}
	}

	return out
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

	var rawConfig interface{}
	if err = json.Unmarshal(configData, &rawConfig); err != nil {
		return nil, nil, jsonutils.HumanizeJsonError(err, configData)
	}

	v := newViper(allowEnvironmentOverrides)
	if err := v.ReadConfig(bytes.NewReader(configData)); err != nil {
		return nil, nil, err
	}

	var config model.Config
	unmarshalErr := v.Unmarshal(&config)
	// https://github.com/spf13/viper/issues/324
	// https://github.com/spf13/viper/issues/348
	// We preserve those values which don't have a period in them,
	// so that atleast we can override them through environment variables.
	if unmarshalErr == nil {
		plugins := v.Get("pluginsettings.plugins")
		preserveMap := make(map[string]map[string]interface{})
		if plugins != nil {
			pl := plugins.(map[string]interface{})
			// Note the values which have a period in them.
			for k, parentVal := range pl {
				var castedVal map[string]interface{}
				if _, ok := parentVal.(map[string]interface{}); ok {
					castedVal = parentVal.(map[string]interface{})
				}
				if !strings.Contains(k, ".") {
					flattened := flattenStructToMap(config.PluginSettings.Plugins[k])
					// This contains all flattened keys. We need to unflatten one-level.
					// We follow the same logic as the parent loop where we have a new map
					// and we insert keys which don't have period in them. And for keys
					// which do have periods, we unflatten them and keep in a separate map.
					//
					// Subtle gotcha: we could have nested maps of any depth here. But
					// the current code is just able to handle maps of depth 1.
					// Anything more than that, will be flattened. This is technically
					// a regression, but such a case was never needed. So it suffices to
					// make it work for the most common case.
					expanded := make(map[string]interface{})
					tmpMap := make(map[string]map[string]interface{})
					for k, val := range flattened {
						if _, ok := castedVal[k]; ok {
							// Handle the cases of number and boolean. By default, it is always a string.
							switch castedVal[k].(type) {
							case float64:
								_, ok := val.(float64)
								if ok {
									val = val.(float64)
								}
								_, ok = val.(string)
								if ok {
									f, err := strconv.ParseInt(val.(string), 10, 64)
									if err != nil {
										continue
									}
									val = f
								}
							case bool:
								_, ok := val.(bool)
								if ok {
									val = val.(bool)
								}
								_, ok = val.(string)
								if ok {
									b, err := strconv.ParseBool(val.(string))
									if err != nil {
										continue
									}
									val = b
								}
							}
						}
						if !strings.Contains(k, ".") {
							expanded[k] = val
						} else {
							parts := strings.Split(k, ".")
							lastPart := parts[len(parts)-1]
							rest := strings.Join(parts[:len(parts)-1], ".")
							if _, ok := tmpMap[rest]; !ok {
								tmpMap[rest] = map[string]interface{}{lastPart: val}
							} else {
								tmpMap[rest][lastPart] = val
							}
						}
					}

					// Now merge the 2 maps
					for k, val := range tmpMap {
						expanded[k] = val
					}
					preserveMap[k] = expanded
				}
			}
		}

		config.PluginSettings.Plugins = make(map[string]map[string]interface{})
		unmarshalErr = v.UnmarshalKey("pluginsettings.plugins", &config.PluginSettings.Plugins)
		// Now restore those values.
		for k, val := range preserveMap {
			config.PluginSettings.Plugins[k] = val
		}
	}
	if unmarshalErr == nil {
		states := v.Get("pluginsettings.pluginstates")
		preserveMap := make(map[string]*model.PluginState)
		if states != nil {
			st := states.(map[string]interface{})
			// Note the values which have a period in them.
			for k := range st {
				if !strings.Contains(k, ".") {
					preserveMap[k] = config.PluginSettings.PluginStates[k]
				}
			}
		}

		config.PluginSettings.PluginStates = make(map[string]*model.PluginState)
		unmarshalErr = v.UnmarshalKey("pluginsettings.pluginstates", &config.PluginSettings.PluginStates)
		// Now restore those values.
		for k, val := range preserveMap {
			config.PluginSettings.PluginStates[k] = val
		}
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
