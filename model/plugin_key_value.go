// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"unicode/utf8"
)

const (
	KeyValuePluginIdMaxRunes = 190
	KeyValueKeyMaxRunes      = 150
)

type PluginKeyValue struct {
	PluginId string `json:"plugin_id"`
	Key      string `json:"key" db:"PKey"`
	Value    []byte `json:"value" db:"PValue"`
	ExpireAt int64  `json:"expire_at"`
}

func (kv *PluginKeyValue) IsValid() *AppError {
	if kv.PluginId == "" || utf8.RuneCountInString(kv.PluginId) > KeyValuePluginIdMaxRunes {
		return NewAppError("PluginKeyValue.IsValid", "model.plugin_key_value.is_valid.plugin_id.app_error", map[string]any{"Max": KeyValueKeyMaxRunes, "Min": 0}, "key="+kv.Key, http.StatusBadRequest)
	}

	if kv.Key == "" || utf8.RuneCountInString(kv.Key) > KeyValueKeyMaxRunes {
		return NewAppError("PluginKeyValue.IsValid", "model.plugin_key_value.is_valid.key.app_error", map[string]any{"Max": KeyValueKeyMaxRunes, "Min": 0}, "key="+kv.Key, http.StatusBadRequest)
	}

	return nil
}
