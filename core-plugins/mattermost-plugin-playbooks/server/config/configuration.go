// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

// Configuration captures the plugin's external configuration as exposed in the Mattermost server
// configuration, as well as values computed from the configuration. Any public fields will be
// deserialized from the Mattermost server configuration in OnConfigurationChange.
//
// As plugins are inherently concurrent (hooks being called asynchronously), and the plugin
// configuration can change at any time, access to the configuration must be synchronized. The
// strategy used in this plugin is to guard a pointer to the configuration, and clone the entire
// struct whenever it changes. You may replace this with whatever strategy you choose.
//
// If you add non-reference types to your configuration struct, be sure to rewrite Clone as a deep
// copy appropriate for your types.
type Configuration struct {
	// BotUserID used to post messages.
	BotUserID string

	EnableTeamsTabApp    bool   `json:"enableteamstabapp"`
	TeamsTabAppTenantIDs string `json:"teamstabapptenantids"`
	TeamsTabAppBotUserID string

	// EnableIncrementalUpdates controls whether the server sends incremental WebSocket updates
	// instead of full playbook run objects. When enabled, the server compares previous and current
	// states to determine what fields changed and only sends those changes.
	// This is set to false by default for backward compatibility.
	EnableIncrementalUpdates bool `json:"enableincrementalupdates"`

	// EnableExperimentalFeatures controls whether experimental features are enabled in the plugin.
	// These features may have in-progress UI, bugs, and other issues.
	EnableExperimentalFeatures bool `json:"enableexperimentalfeatures"`
}

// Clone shallow copies the configuration. Your implementation may require a deep copy if
// your configuration has reference types.
func (c *Configuration) Clone() *Configuration {
	var clone = *c
	return &clone
}

func (c *Configuration) serialize() map[string]interface{} {
	ret := make(map[string]interface{})
	ret["BotUserID"] = c.BotUserID
	ret["EnableTeamsTabApp"] = c.EnableTeamsTabApp
	ret["TeamsTabAppTenantIDs"] = c.TeamsTabAppTenantIDs
	ret["TeamsTabAppBotUserID"] = c.TeamsTabAppBotUserID
	ret["EnableIncrementalUpdates"] = c.EnableIncrementalUpdates
	ret["EnableExperimentalFeatures"] = c.EnableExperimentalFeatures
	return ret
}
