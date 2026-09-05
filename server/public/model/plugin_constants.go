// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

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

// PluginAddOnRequirements maps a plugin id to the add-on entitlement its license
// must grant before the server will activate it. Plugins absent from this map are
// not add-ons and activate normally.
//
// This mapping is deliberately held server-side rather than declared by the plugin
// manifest: a gate declared by the artifact being gated could be removed by
// repackaging the bundle.
//
// To add a new add-on: add its plugin id constant, its add-on name constant, and
// one entry here. Nothing else in the server needs to change.
var PluginAddOnRequirements = map[string]string{
	PluginIdCrossGuard: AddOnCrossGuard,
}
