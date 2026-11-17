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
	ClientConfigKeyEnableBanner           = "EnableBanner"
	ClientConfigKeyBannerText             = "BannerText"
	ClientConfigKeyAllowBannerDismissal   = "AllowBannerDismissal"
)

// SystemSettingDefinition describes a ClientConfig key that may be overridden
// per session by a system_setting access control policy.
type SystemSettingDefinition struct {
	Key            string                 `json:"key"`
	ValueType      SystemSettingValueType `json:"value_type"`
	AllowedOptions []string               `json:"allowed_options,omitempty"`
}

// ValidateValue reports whether val matches the serialized ClientConfig string
// format expected for this setting's ValueType.
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
	ClientConfigKeyEnableBanner: {
		Key:       ClientConfigKeyEnableBanner,
		ValueType: SystemSettingValueTypeBool,
	},
	ClientConfigKeyBannerText: {
		Key:       ClientConfigKeyBannerText,
		ValueType: SystemSettingValueTypeString,
	},
	ClientConfigKeyAllowBannerDismissal: {
		Key:       ClientConfigKeyAllowBannerDismissal,
		ValueType: SystemSettingValueTypeBool,
	},
}

// LookupSystemSettingDefinition returns the registered definition for a
// policy-configurable ClientConfig key, or false when key is not exposed to
// system_setting policies.
func LookupSystemSettingDefinition(key string) (SystemSettingDefinition, bool) {
	def, ok := systemSettingDefinitions[key]
	return def, ok
}
