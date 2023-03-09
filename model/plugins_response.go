// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PluginInfo struct {
	Manifest
}

type PluginsResponse struct {
	Active   []*PluginInfo `json:"active"`
	Inactive []*PluginInfo `json:"inactive"`
}
