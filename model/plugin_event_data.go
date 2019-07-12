// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

// PluginEventData used to send plugin data to other clusters.
type PluginEventData struct {
	PluginId            string `json:"plugin_id"`
	PluginFileStorePath string `json:"plugin_path"`
}

func (p *PluginEventData) ToJson() string {
	b, _ := json.Marshal(p)
	return string(b)
}

func PluginEventDataFromJson(data io.Reader) PluginEventData {
	var m PluginEventData
	json.NewDecoder(data).Decode(&m)
	return m
}
