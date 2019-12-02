// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

// PluginKVSetOptions contains information on how to store a value in the plugin KV store.
type PluginKVSetOptions struct {
	EncodeJSON      bool        // If true, store the JSON encoding of newValue
	Atomic          bool        // Only store the value if the current value matches the oldValue
	OldValue        interface{} // The value to compare with the current value. Only used when Atomic is true
	ExpireInSeconds int64       // Set an expire counter
}

// IsValid returns nil if the chosen options are valid.
func (opt *PluginKVSetOptions) IsValid() *AppError {
	if !opt.Atomic && opt.OldValue != nil {
		return NewAppError(
			"PluginKVSetOptions.IsValid",
			"model.plugin_kvset_options.is_valid.old_value.app_error",
			nil,
			"",
			http.StatusBadRequest,
		)
	}

	return nil
}

// GetOldValueSerialized returns the serialized old value either as directly
// or encoded as JSON depending on the chosen options.
func (opt *PluginKVSetOptions) GetOldValueSerialized() ([]byte, *AppError) {
	return opt.serializeValue(opt.OldValue)
}

func (opt *PluginKVSetOptions) serializeValue(value interface{}) ([]byte, *AppError) {
	if opt.EncodeJSON {
		data, err := json.Marshal(value)
		if err != nil {
			return nil, NewAppError("PluginKVSetOptions.serializeValue", "model.plugin_kvset_options.serialize_value.app_error", map[string]interface{}{"EncodeJSON": opt.EncodeJSON}, "Could not serialize JSON value", http.StatusBadRequest)
		}
		return data, nil
	}

	castResult, ok := value.([]byte)
	if !ok {
		return nil, NewAppError("PluginKVSetOptions.SerializeValue", "model.plugin_kvset_options.serialize_value.app_error", map[string]interface{}{"EncodeJSON": opt.EncodeJSON}, "Could not cast value to []byte", http.StatusBadRequest)
	}

	return castResult, nil
}

// NewPluginKeyValueFromOptions return a PluginKeyValue given a pluginID, a KV pair and options.
func NewPluginKeyValueFromOptions(pluginId, key string, value interface{}, opt PluginKVSetOptions) (*PluginKeyValue, *AppError) {
	serializedValue, err := opt.serializeValue(value)
	if err != nil {
		return nil, err
	}

	expireAt := int64(0)
	if opt.ExpireInSeconds > 0 {
		expireAt = GetMillis() + (opt.ExpireInSeconds * 1000)
	}

	kv := &PluginKeyValue{
		PluginId: pluginId,
		Key:      key,
		Value:    serializedValue,
		ExpireAt: expireAt,
	}

	return kv, nil
}
