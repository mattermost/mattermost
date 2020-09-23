// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"fmt"
	"reflect"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

type ConfigTelemetryField struct {
	configField string
	telemetryKey string
	telemetryFunction func(interface{}) interface{}
}

type ConfigTelemetryMap map[string][]ConfigTelemetryField

// makeConfigTelemetryMap creates the telemetry map for mapping the Mattermost config to telemetry data
func makeConfigTelemetryMap() ConfigTelemetryMap {
	return ConfigTelemetryMap{
		TRACK_CONFIG_TEAM: teamConfig(),
	}
}

// teamConfig creates the "team config" telemetry map
func teamConfig() []ConfigTelemetryField {
	cfg := model.Config{}
	cfg.SetDefaults()
	cfg.TeamSettings.ExperimentalDefaultChannels = []string{"Foo", "Bar"}

	// FIXME: This is just a few examples - would need to be implemented for *all* config settings in the full PR.
	configMap := []ConfigTelemetryField{
		{
			"cfg.ServiceSettings.WebserverMode",
			"web_server_mode",
			sendFieldValue(),
		},
		{
			"ServiceSettings.GfycatApiKey",
			"gfycat_api_key",
			sendIsDefaultBoolean(model.SERVICE_SETTINGS_DEFAULT_GFYCAT_API_KEY),
		},
		{
			"ServiceSettings.SiteURL",
			"",
			sendNothing(),
		},
		{
			"TeamSettings.ExperimentalDefaultChannels",
			"experimental_default_channels",
			sendStringListLength(),
		},
	}

	return configMap
}

// sendFieldValue returns a mapping function that sends the config field value in full in the telemetry data
func sendFieldValue() func(interface{}) interface{} {
	return func(innerValue interface{}) interface{} {
		return innerValue
	}
}

// sendIsDefaultBoolean returns a mapping function that sends a boolean value in the telemetry data indicating whether
// the config field is set to the specified default value or not
func sendIsDefaultBoolean(defaultValue interface{}) func(interface{}) interface{} {
	return func(value interface{}) interface{} {
		return value == defaultValue
	}
}

// sendStringListLength returns a mapping function that sends the length of a string list in the telemetry data
func sendStringListLength() func(interface{}) interface{} {
	return func(innerValue interface{}) interface{} {
		return len(innerValue.([]string))
	}
}

// sendNothing returns a mapping function returning nil, indicating that intentionally no telemetry data is collected
// for the given Mattermost config field.
func sendNothing() func(interface{}) interface{} {
	return func(innerValue interface{}) interface{} {
		return nil
	}
}

// trackConfig prepares and sends the telemetry derived from the Mattermost config.
func (ts *TelemetryService) trackConfig() {
	cfg := ts.srv.Config()
	telemetryMap := makeConfigTelemetryMap()
	configMap := configToMap(*cfg, "")

	for key, fields := range telemetryMap {
		ts.sendTelemetry(key, mapConfig(configMap, fields))
	}
}

// mapConfig takes the config in map form, and a list of ConfigTelemetryField items and returns the telemetry data
func mapConfig(configMap map[string]interface{}, fields []ConfigTelemetryField) map[string]interface{} {
	data := map[string]interface{}{}

	for _, field := range fields {
		data[field.telemetryKey] = field.telemetryFunction(configMap[field.configField])
	}

	return data
}

// configToMap converts the config into a map keyed off the setting name in dot-notated form
func configToMap(t interface{}, prefix string) map[string]interface{} {
	defer func() {
		if r := recover(); r != nil {
			mlog.Error("Panicked in configToMap. This should never happen.", mlog.Any("recover", r))
		}
	}()

	val := reflect.ValueOf(t)

	if val.Kind() != reflect.Struct {
		return nil
	}

	out := map[string]interface{}{}

	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)

		var value interface{}

		switch field.Kind() {
		case reflect.Struct:
			name := val.Type().Field(i).Name
			data := configToMap(field.Interface(), prefix+name+".")
			for key, val := range data {
				out[key] = val
			}
		case reflect.Ptr:
			indirectType := field.Elem()

			if indirectType.Kind() == reflect.Struct {
				value = configToMap(indirectType.Interface(), prefix)
			} else if indirectType.Kind() != reflect.Invalid {
				value = indirectType.Interface()
				fmt.Println(prefix+val.Type().Field(i).Name)
				out[prefix+val.Type().Field(i).Name] = value
			}
		default:
			value = field.Interface()
			out[prefix+val.Type().Field(i).Name] = value
		}
	}

	return out
}
