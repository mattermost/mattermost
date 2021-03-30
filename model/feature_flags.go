// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "reflect"

type FeatureFlags struct {
	// Exists only for unit and manual testing.
	// When set to a value, will be returned by the ping endpoint.
	TestFeature string
	// Exists only for testing bool functionality. Boolean feature flags interpret "on" or "true" as true and
	// all other values as false.
	TestBoolFeature bool

	// Toggle on and off scheduled jobs for cloud user limit emails see MM-29999
	CloudDelinquentEmailJobsEnabled bool

	// Toggle on and off support for Collapsed Threads
	CollapsedThreads bool

	// AppsEnabled toggle the Apps framework functionalities both in server and client side
	AppsEnabled bool

	// Feature flags to control plugin versions
	PluginIncidentManagement string `plugin_id:"com.mattermost.plugin-incident-management"`
	PluginApps               string `plugin_id:"com.mattermost.apps"`

	// Toggle on and off support for Files search
	FilesSearch bool
	// Feature flag to control setting the TCP_NO_DELAY setting for websockets.
	WebSocketDelay bool
}

func (f *FeatureFlags) SetDefaults() {
	f.TestFeature = "off"
	f.TestBoolFeature = false
	f.CloudDelinquentEmailJobsEnabled = false
	f.CollapsedThreads = false
	f.FilesSearch = false
	f.AppsEnabled = false

	f.PluginIncidentManagement = "1.7.0"
	f.PluginApps = ""
	f.WebSocketDelay = false
}

func (f *FeatureFlags) Plugins() map[string]string {
	rFFVal := reflect.ValueOf(f).Elem()
	rFFType := reflect.TypeOf(f).Elem()

	pluginVersions := make(map[string]string)
	for i := 0; i < rFFVal.NumField(); i++ {
		rFieldVal := rFFVal.Field(i)
		rFieldType := rFFType.Field(i)

		pluginId, hasPluginId := rFieldType.Tag.Lookup("plugin_id")
		if !hasPluginId {
			continue
		}

		pluginVersions[pluginId] = rFieldVal.String()
	}

	return pluginVersions
}
