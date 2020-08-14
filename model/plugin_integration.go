// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	ScopeMobile = "mobile"
	ScopeWebApp = "webapp"
)

type PluginIntegration struct {
	PluginID   string   `json:"id"`
	Location   string   `json:"location"`
	RequestURL string   `json:"request_url"`
	Scope      []string `json:"scope"`
	//	Extra    interface{} `json:"extra"`
	Extra struct {
		Icon string `json:"icon"`
		Text string `json:"text"`
	} `json:"extra"` // Should use interface{} to be able to create different extras for different locations
}

type MobileIntegrationChannelHeader struct {
	Icon string `json:"icon"`
	Text string `json:"text"`
}

type MobileIntegrationPostAction struct {
	Icon string `json:"icon"`
	Text string `json:"text"`
}

type MobileIntegrationSettings struct {
	Icon string `json:"icon"`
	Text string `json:"text"`
}

func (o *PluginIntegration) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func PluginIntegrationFromJson(data io.Reader) *PluginIntegration {
	var o *PluginIntegration
	json.NewDecoder(data).Decode(&o)
	return o
}

func PluginIntegrationListToJson(l []*PluginIntegration) string {
	b, _ := json.Marshal(l)
	return string(b)
}

func PluginIntegrationListFromJson(data io.Reader) []*PluginIntegration {
	var o []*PluginIntegration
	json.NewDecoder(data).Decode(&o)
	return o
}
