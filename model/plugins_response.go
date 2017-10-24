package model

import (
	"encoding/json"
	"io"
)

type PluginsResponse struct {
	Active   []*Manifest `json:"active"`
	Inactive []*Manifest `json:"inactive"`
}

func (m *PluginsResponse) ToJson() string {
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func PluginsResponseFromJson(data io.Reader) *PluginsResponse {
	decoder := json.NewDecoder(data)
	var m PluginsResponse
	err := decoder.Decode(&m)
	if err == nil {
		return &m
	} else {
		return nil
	}
}
