// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type ConfigTelemetryField struct {
	configField string
	telemetryKey string
	telemetryFunction func(interface{}) interface{}
}

type ConfigTelemetryMap map[string][]ConfigTelemetryField

func makeConfigMap() ConfigTelemetryMap {
	return ConfigTelemetryMap{
		TRACK_CONFIG_TEAM: teamConfig(),
	}
}

func teamConfig() []ConfigTelemetryField {
	cfg := model.Config{}
	cfg.SetDefaults()

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
			sendLength(),
		},
	}

	return configMap
}

func sendFieldValue() func(interface{}) interface{} {
	return func(innerValue interface{}) interface{} {
		return innerValue
	}
}

func sendIsDefaultBoolean(defaultValue interface{}) func(interface{}) interface{} {
	return func(value interface{}) interface{} {
		return value == defaultValue
	}
}

func sendLength() func(interface{}) interface{} {
	return func(innerValue interface{}) interface{} {
		return len(innerValue.([]interface{}))
	}
}

func sendNothing() func(interface{}) interface{} {
	return func(innerValue interface{}) interface{} {
		return nil
	}
}

func (ts *TelemetryService) trackConfig() {
	cfg := ts.srv.Config()
	telemetryMap := makeConfigMap()
	configMap :=

	for key, fields := range configMap {
		ts.sendTelemetry(key, mapConfig(cfg, fields))
	}
}

func mapConfig(configMap map[string]interface{}, fields []ConfigTelemetryField) map[string]interface{} {
	data := map[string]interface{}{}

	for _, field := range fields {

	}
}
