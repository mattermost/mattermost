// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

type WebrtcInfoResponse struct {
	Token        string `json:"token"`
	GatewayUrl   string `json:"gateway_url"`
	StunUri      string `json:"stun_uri,omitempty"`
	TurnUri      string `json:"turn_uri,omitempty"`
	TurnPassword string `json:"turn_password,omitempty"`
	TurnUsername string `json:"turn_username,omitempty"`
}

type GatewayResponse struct {
	Status string `json:"janus"`
}

func GatewayResponseFromJson(data io.Reader) *GatewayResponse {
	var o *GatewayResponse
	json.NewDecoder(data).Decode(&o)
	return o
}

func (o *WebrtcInfoResponse) ToJson() string {
	b, _ := json.Marshal(o)
	return string(b)
}

func WebrtcInfoResponseFromJson(data io.Reader) *WebrtcInfoResponse {
	var o *WebrtcInfoResponse
	json.NewDecoder(data).Decode(&o)
	return o
}
