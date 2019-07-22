// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

// PluginEventData used to notify peers about plugin changes.
type PluginEventData struct {
	Id string `json:"id"`
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
