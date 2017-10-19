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
	GatewayType  string `json:"gateway_type"`
	StunUri      string `json:"stun_uri,omitempty"`
	TurnUri      string `json:"turn_uri,omitempty"`
	TurnPassword string `json:"turn_password,omitempty"`
	TurnUsername string `json:"turn_username,omitempty"`
}

type JanusGatewayResponse struct {
	Status string `json:"janus"`
}

type KopanoWebmeetingsResponse struct {
	Value string `json:"value"`
}

func JanusGatewayResponseFromJson(data io.Reader) *JanusGatewayResponse {
	decoder := json.NewDecoder(data)
	var o JanusGatewayResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *WebrtcInfoResponse) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func WebrtcInfoResponseFromJson(data io.Reader) *WebrtcInfoResponse {
	decoder := json.NewDecoder(data)
	var o WebrtcInfoResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func KopanoWebmeetingsResponseFromJson(data io.Reader) *KopanoWebmeetingsResponse {
	decoder := json.NewDecoder(data)
	var o KopanoWebmeetingsResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	}
	return nil
}
