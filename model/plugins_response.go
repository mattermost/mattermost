// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"

	"github.com/json-iterator/go"
)

type PluginInfo struct {
	Manifest
	Prepackaged bool `json:"prepackaged"`
}

type PluginsResponse struct {
	Active   []*PluginInfo `json:"active"`
	Inactive []*PluginInfo `json:"inactive"`
}

func (m *PluginsResponse) ToJson() string {
	b, _ := jsoniter.Marshal(m)
	return string(b)
}

func PluginsResponseFromJson(data io.Reader) *PluginsResponse {
	var m *PluginsResponse
	json.NewDecoder(data).Decode(&m)
	return m
}
