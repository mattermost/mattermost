// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostsUsage struct {
	Count int64 `json:"count"`
}

type StorageUsage struct {
	Bytes int64 `json:"bytes"`
}

type TeamsUsage struct {
	Active        int64 `json:"active"`
	CloudArchived int64 `json:"cloud_archived"`
}

var InstalledIntegrationsIgnoredPlugins = map[string]struct{}{
	PluginIdCalls: {},
	PluginIdNPS:   {},
}

type InstalledIntegration struct {
	Type    string `json:"type"` // "plugin" or "app"
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Enabled bool   `json:"enabled"`
}
