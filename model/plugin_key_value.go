// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type PluginKeyValue struct {
	PluginId string `json:"plugin_id"`
	Key      string `json:"key" db:"PKey"`
	Value    string `json:"value" db:"PValue"`
}

func (kv *PluginKeyValue) IsValid() *AppError {
	if len(kv.PluginId) == 0 {
		return NewAppError("PluginKeyValue.IsValid", "model.plugin_key_value.is_valid.plugin_id.app_error", nil, "key="+kv.Key, http.StatusBadRequest)
	}

	if len(kv.Key) == 0 {
		return NewAppError("PluginKeyValue.IsValid", "model.plugin_key_value.is_valid.key.app_error", nil, "key="+kv.Key, http.StatusBadRequest)
	}

	return nil
}

// PluginStoreValue is the struct returned by the plugin API GetKey method. Use it to convert
// the result of your get to a type.
type PluginStoreValue struct {
	Value string
}

// NewPluginStoreValue will return encode an interface into a new PluginStoreValue. Returns an
// empty PluginStoreValue on failure.
func NewPluginStoreValue(arg interface{}) *PluginStoreValue {
	val, _ := json.Marshal(arg)

	if val == nil {
		return &PluginStoreValue{}
	} else {
		return &PluginStoreValue{string(val)}
	}
}

// NewPluginStoreResult will return a PluginStoreValue initialized with arg.
func NewPluginStoreResult(arg string) *PluginStoreValue {
	return &PluginStoreValue{arg}
}

func (p *PluginStoreValue) String() (string, error) {
	var s string
	err := json.Unmarshal([]byte(p.Value), &s)
	return s, err
}

func (p *PluginStoreValue) Bytes() ([]byte, error) {
	return []byte(p.Value), nil
}

func (p *PluginStoreValue) Int64() (int64, error) {
	return strconv.ParseInt(p.Value, 10, 64)
}

func (p *PluginStoreValue) Uint64() (uint64, error) {
	return strconv.ParseUint(p.Value, 10, 64)
}

func (p *PluginStoreValue) Float64() (float64, error) {
	return strconv.ParseFloat(p.Value, 64)
}

func (p *PluginStoreValue) Bool() (bool, error) {
	return strconv.ParseBool(p.Value)
}

// Scan will attempt to read the value into the val interface.
func (p *PluginStoreValue) Scan(val interface{}) error {
	return json.Unmarshal([]byte(p.Value), &val)
}
