// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostsUsage struct {
	Count int64 `json:"count"`
}

type IntegrationsUsage struct {
	Count int64 `json:"count"`
}

var InstalledIntegrationsIgnoredPlugins = map[string]struct{}{
	PluginIdPlaybooks:     {},
	PluginIdFocalboard:    {},
	PluginIdApps:          {},
	PluginIdCalls:         {},
	PluginIdNPS:           {},
	PluginIdChannelExport: {},
}

type InstalledIntegration struct {
	Type    string `json:"type"` // "plugin" or "app"
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Enabled bool   `json:"enabled"`
}
