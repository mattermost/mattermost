// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"slices"
	"strconv"
)

type SystemSettingValueType string

const (
	SystemSettingValueTypeBool   SystemSettingValueType = "bool"
	SystemSettingValueTypeString SystemSettingValueType = "string"
	SystemSettingValueTypeNumber SystemSettingValueType = "number"
	SystemSettingValueTypeSelect SystemSettingValueType = "select"
)

const (
	ClientConfigKeyMobileEnableBiometrics = "MobileEnableBiometrics"
)

// SystemSettingDefinition is a ClientConfig key that system_setting policies can override.
type SystemSettingDefinition struct {
	Key            string                 `json:"key"`
	ValueType      SystemSettingValueType `json:"value_type"`
	AllowedOptions []string               `json:"allowed_options,omitempty"`
}

func (d SystemSettingDefinition) ValidateValue(val string) bool {
	switch d.ValueType {
	case SystemSettingValueTypeBool:
		return val == "true" || val == "false"
	case SystemSettingValueTypeNumber:
		_, err := strconv.ParseInt(val, 10, 64)
		return err == nil
	case SystemSettingValueTypeSelect:
		return slices.Contains(d.AllowedOptions, val)
	case SystemSettingValueTypeString:
		return true
	default:
		return false
	}
}

var systemSettingDefinitions = map[string]SystemSettingDefinition{
	ClientConfigKeyMobileEnableBiometrics: {
		Key:       ClientConfigKeyMobileEnableBiometrics,
		ValueType: SystemSettingValueTypeBool,
	},
}

func LookupSystemSettingDefinition(key string) (SystemSettingDefinition, bool) {
	def, ok := systemSettingDefinitions[key]
	return def, ok
}
