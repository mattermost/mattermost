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
// Held server-side rather than declared by the plugin manifest so the mapping is
// not editable in the artifact it governs, and unexported so it is not
// reassignable by anything importing the public module.
//
// This is a policy control, not a tamper boundary. The key is the manifest id,
// which the bundle itself supplies, so rebuilding an add-on under a different id
// evades the gate no matter where the registry lives, and nothing stops that while
// PluginSettings.RequirePluginSignature defaults to false. What the gate does
// guarantee is that an unlicensed add-on cannot be enabled through config, the API
// or the System Console.
//
// To add a new add-on: add its plugin id constant, its add-on name constant, and
// one entry here. The System Console keeps a mirror of this registry in
// webapp/channels/src/utils/addons.ts which must be updated to match; nothing
// enforces that today.
var pluginAddOnRequirements = map[string]string{
	PluginIdCrossGuard: AddOnCrossGuard,
}

// PluginRequiredAddOn reports which add-on entitlement a plugin requires, and
// whether it requires one at all. Plugin id matching is case-insensitive.
func PluginRequiredAddOn(pluginID string) (string, bool) {
	addOn, ok := pluginAddOnRequirements[strings.ToLower(pluginID)]
	return addOn, ok
}
