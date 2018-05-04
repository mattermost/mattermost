// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	PluginStateNotRunning          = 0
	PluginStateRunning             = 1
	PluginStateFailedToStart       = 2
	PluginStateFailedToStayRunning = 3
)

// PluginStatus provides a cluster-aware view of installed plugins.
type PluginStatus struct {
	PluginId           string `json:"plugin_id"`
	ClusterDiscoveryId string `json:"cluster_discovery_id"`
	PluginPath         string `json:"plugin_path"`
	State              int    `json:"state"`
	IsSandboxed        bool   `json:"is_sandboxed"`
	IsPrepackaged      bool   `json:"is_prepackaged"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Version            string `json:"version"`
}

type PluginStatuses []PluginStatus

func (m *PluginStatuses) ToJson() string {
	b, _ := json.Marshal(m)
	return string(b)
}

func PluginStatusesFromJson(data io.Reader) *PluginStatuses {
	var m *PluginStatuses
	json.NewDecoder(data).Decode(&m)
	return m
}
