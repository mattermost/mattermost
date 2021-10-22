// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"reflect"
	"strconv"
)

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

	// Enable the remote cluster service for shared channels.
	EnableRemoteClusterService bool

	// AppsEnabled toggle the Apps framework functionalities both in server and client side
	AppsEnabled bool

	// Feature flags to control plugin versions
	PluginPlaybooks  string `plugin_id:"playbooks"`
	PluginApps       string `plugin_id:"com.mattermost.apps"`
	PluginFocalboard string `plugin_id:"focalboard"`

	PermalinkPreviews bool

	// Enable the Global Header
	GlobalHeader bool

	// Enable different team menu button treatments, possible values = ("none", "by_team_name", "inverted_sidebar_bg_color")
	AddChannelButton string

	// Enable different treatments for first time users, possible values = ("none", "tour_point", "around_input")
	PrewrittenMessages string

	// Enable different treatments for first time users, possible values = ("none", "tips_and_next_steps")
	DownloadAppsCTA string

	// Determine whether when a user gets created, they'll have noisy notifications e.g. Send desktop notifications for all activity
	NewAccountNoisy bool
	// Enable Boards Unfurl Preview
	BoardsUnfurl bool

	// Enable Calls plugin support in the mobile app
	CallsMobile bool

	// Start A/B tour tips automatically, possible values = ("none", "auto")
	AutoTour string
}

func (f *FeatureFlags) SetDefaults() {
	f.TestFeature = "off"
	f.TestBoolFeature = false
	f.CloudDelinquentEmailJobsEnabled = false
	f.CollapsedThreads = true
	f.EnableRemoteClusterService = false
	f.AppsEnabled = false
	f.PluginApps = ""
	f.PluginFocalboard = ""
	f.PermalinkPreviews = true
	f.GlobalHeader = true
	f.AddChannelButton = "by_team_name"
	f.PrewrittenMessages = "tour_point"
	f.DownloadAppsCTA = "tips_and_next_steps"
	f.NewAccountNoisy = false
	f.BoardsUnfurl = true
	f.CallsMobile = false
	f.AutoTour = "none"
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

// ToMap returns the feature flags as a map[string]string
// Supports boolean and string feature flags.
func (f *FeatureFlags) ToMap() map[string]string {
	refStructVal := reflect.ValueOf(*f)
	refStructType := reflect.TypeOf(*f)
	ret := make(map[string]string)
	for i := 0; i < refStructVal.NumField(); i++ {
		refFieldVal := refStructVal.Field(i)
		if !refFieldVal.IsValid() {
			continue
		}
		refFieldType := refStructType.Field(i)
		switch refFieldType.Type.Kind() {
		case reflect.Bool:
			ret[refFieldType.Name] = strconv.FormatBool(refFieldVal.Bool())
		default:
			ret[refFieldType.Name] = refFieldVal.String()
		}
	}

	return ret
}
