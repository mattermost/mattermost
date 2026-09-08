// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "strings"

const (
	PluginIdPlaybooks     = "playbooks"
	PluginIdFocalboard    = "focalboard"
	PluginIdApps          = "com.mattermost.apps"
	PluginIdCalls         = "com.mattermost.calls"
	PluginIdNPS           = "com.mattermost.nps"
	PluginIdChannelExport = "com.mattermost.plugin-channel-export"
	PluginIdAI            = "mattermost-ai"
	PluginIdCrossGuard    = "crossguard"
)

// Add-on names as they appear in License.AddOns.
const (
	AddOnCrossGuard = "crossguard"
)

// pluginAddOnRequirements maps a plugin id to the add-on its license must grant
// before the server will activate it. Keys must be lower case; look up through
// PluginRequiredAddOn, since IsValidPluginId permits mixed case.
//
// A policy control, not a tamper boundary: the key is the manifest id, which the
// bundle itself supplies, so repackaging under a different id evades the gate
// wherever this map lives. What it guarantees is that an unlicensed add-on cannot
// be enabled through config, the API or the System Console.
//
// webapp/channels/src/utils/addons.ts mirrors this map; nothing enforces that.
var pluginAddOnRequirements = map[string]string{
	PluginIdCrossGuard: AddOnCrossGuard,
}

// PluginRequiredAddOn reports which add-on a plugin requires, if any.
func PluginRequiredAddOn(pluginID string) (string, bool) {
	addOn, ok := pluginAddOnRequirements[strings.ToLower(pluginID)]
	return addOn, ok
}
