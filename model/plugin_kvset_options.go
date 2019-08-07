// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
)

type PluginKVSetOptions struct {
	EncodeJSON      bool
	Atomic          bool
	OldValue        interface{}
	ExpireInSeconds int64
}

func (opt *PluginKVSetOptions) IsValid() *AppError {
	if !opt.Atomic && opt.OldValue != nil {
		return NewAppError("PluginKVSetOptions.IsValid", "model.plugin_kvset_options.is_valid.old_value.app_error", map[string]interface{}{}, "OldValue should not be defined on non atomic sets", http.StatusBadRequest)
	}

	return nil
}

func (opt *PluginKVSetOptions) GetPluginKeyValue(pluginId string, key string, value interface{}) (*PluginKeyValue, *AppError) {
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

func (opt *PluginKVSetOptions) GetOldValueSerialized() ([]byte, *AppError) {
	return opt.serializeValue(opt.OldValue)
}

func (opt *PluginKVSetOptions) serializeValue(value interface{}) ([]byte, *AppError) {
	if opt.EncodeJSON {
		data, err := json.Marshal(value)
		if err != nil {
			return nil, NewAppError("PluginKVSetOptions.SerializeValue", "model.plugin_kvset_options.serialize_value.app_error", map[string]interface{}{"EncodeJSON": opt.EncodeJSON}, "Could not serialize JSON value", http.StatusBadRequest)
		}
		return data, nil
	}

	castResult, ok := value.([]byte)
	if ok {
		return castResult, nil
	}

	return nil, NewAppError("PluginKVSetOptions.SerializeValue", "model.plugin_kvset_options.serialize_value.app_error", map[string]interface{}{"EncodeJSON": opt.EncodeJSON}, "Could not cast value to []byte", http.StatusBadRequest)
}
