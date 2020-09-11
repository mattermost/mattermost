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
	PluginID string `json:"id"`
	// Location defines where the client should present this integration
	Location string `json:"location"`
	// RequestURL defines the URL the client will reach to perform the integration action
	RequestURL string `json:"request_url"`
	// Scope defines which clients should show this integration
	Scope []string    `json:"scope"`
	Extra interface{} `json:"extra"`
}

type PluginIntegrationActionRequest struct {
	Type string `json:"type"`
	*PluginIntegration
	TriggerId string `json:"trigger_id"`
	UserId string `json:"user_id"`
	TeamId string `json:"team_id"`
	ChannelId string `json:"channel_id"`

	Values map[string]interface{} `json:"values"`
}

type PluginIntegrationActionResponse struct {
	TriggerId string `json:"trigger_id"`
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
