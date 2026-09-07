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

// pluginAddOnRequirements maps a plugin id to the add-on entitlement its license
// must grant before the server will activate it. Plugins absent from this map are
// not add-ons and activate normally.
//
// Keys must be lower case. Look up through PluginRequiredAddOn, which normalizes:
// IsValidPluginId permits mixed case, so an exact-match lookup would let a bundle
// re-declare its id as "CrossGuard" and miss the gate entirely.
//
// Held server-side rather than declared by the plugin manifest, because a gate
// declared by the artifact being gated could be removed by repackaging the bundle.
// Unexported for the same reason: it decides a paid entitlement, so it should not
// be reassignable by anything importing the public module.
//
// To add a new add-on: add its plugin id constant, its add-on name constant, and
// one entry here. Nothing else in the server needs to change.
var pluginAddOnRequirements = map[string]string{
	PluginIdCrossGuard: AddOnCrossGuard,
}

// PluginRequiredAddOn reports which add-on entitlement a plugin requires, and
// whether it requires one at all. Plugin id matching is case-insensitive.
func PluginRequiredAddOn(pluginID string) (string, bool) {
	addOn, ok := pluginAddOnRequirements[strings.ToLower(pluginID)]
	return addOn, ok
}
