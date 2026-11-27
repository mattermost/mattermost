// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PluginNotice is a server-computed annotation on an installed plugin.
type PluginNotice struct {
	// Deprecated marks the plugin as deprecated.
	Deprecated bool `json:"deprecated"`
	// Status, when set, replaces the status label shown for the plugin.
	Status string `json:"status,omitempty"`
	// Message is shown as a notice alongside the plugin.
	Message string `json:"message"`
}

type PluginInfo struct {
	Manifest
	Notice *PluginNotice `json:"notice,omitempty"`
}

type PluginsResponse struct {
	Active   []*PluginInfo `json:"active"`
	Inactive []*PluginInfo `json:"inactive"`
}
