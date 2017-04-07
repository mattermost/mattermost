package model

import (
	"encoding/json"
	"io"
)

type GatewayResponse struct {
	Status string `json:"janus"`
}

func GatewayResponseFromJson(data io.Reader) *GatewayResponse {
	decoder := json.NewDecoder(data)
	var o GatewayResponse
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}
