// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
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

// SystemSystemSettingPolicyOrderKey is the Systems row holding the
// comma-separated system_setting policy IDs in priority order.
const SystemSystemSettingPolicyOrderKey = "SystemSettingPolicyOrder"

// MaxSystemSettingPolicyOrderLength bounds the stored order so its
// comma-separated IDs fit the 1024-character Systems.Value column.
const MaxSystemSettingPolicyOrderLength = 37

// SystemSettingPolicyOrder lists system_setting policy IDs from highest to
// lowest priority. For each ClientConfig key, the first policy in the list
// whose role and rule match the session supplies the value. Policies missing
// from the list rank after listed ones, oldest first.
type SystemSettingPolicyOrder struct {
	PolicyIDs []string `json:"policy_ids"`
}

func (o *SystemSettingPolicyOrder) IsValid() *AppError {
	if len(o.PolicyIDs) > MaxSystemSettingPolicyOrderLength {
		return NewAppError("SystemSettingPolicyOrder.IsValid", "model.system_setting_policy_order.is_valid.too_many.app_error", map[string]any{"Max": MaxSystemSettingPolicyOrderLength}, "", http.StatusBadRequest)
	}
	seen := make(map[string]struct{}, len(o.PolicyIDs))
	for _, id := range o.PolicyIDs {
		if !IsValidId(id) {
			return NewAppError("SystemSettingPolicyOrder.IsValid", "model.system_setting_policy_order.is_valid.id.app_error", nil, "id="+id, http.StatusBadRequest)
		}
		if _, dup := seen[id]; dup {
			return NewAppError("SystemSettingPolicyOrder.IsValid", "model.system_setting_policy_order.is_valid.duplicate.app_error", nil, "id="+id, http.StatusBadRequest)
		}
		seen[id] = struct{}{}
	}
	return nil
}

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
