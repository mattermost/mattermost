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

	// Enable the remote cluster service for shared channels.
	EnableRemoteClusterService bool

	// Enable DMs and GMs for shared channels.
	EnableSharedChannelsDMs bool

	// AppsEnabled toggles the Apps framework functionalities both in server and client side
	AppsEnabled bool

	PermalinkPreviews bool

	NormalizeLdapDNs bool

	// Enable WYSIWYG text editor
	WysiwygEditor bool

	OnboardingTourTips bool

	DeprecateCloudFree bool

	EnableExportDirectDownload bool

	MoveThreadsEnabled bool

	StreamlinedMarketplace bool

	CloudIPFiltering bool
	ConsumePostHook  bool

	CloudAnnualRenewals    bool
	CloudDedicatedExportUI bool

	ChannelBookmarks bool

	WebSocketEventScope bool

	NotificationMonitoring bool

	ExperimentalAuditSettingsSystemConsoleUI bool
}

func (f *FeatureFlags) SetDefaults() {
	f.TestFeature = "off"
	f.TestBoolFeature = false
	f.EnableRemoteClusterService = false
	f.EnableSharedChannelsDMs = false
	f.AppsEnabled = false
	f.NormalizeLdapDNs = false
	f.DeprecateCloudFree = false
	f.WysiwygEditor = false
	f.OnboardingTourTips = true
	f.EnableExportDirectDownload = false
	f.MoveThreadsEnabled = false
	f.StreamlinedMarketplace = true
	f.CloudIPFiltering = false
	f.ConsumePostHook = false
	f.CloudAnnualRenewals = false
	f.CloudDedicatedExportUI = false
	f.ChannelBookmarks = true
	f.WebSocketEventScope = true
	f.NotificationMonitoring = true
	f.ExperimentalAuditSettingsSystemConsoleUI = false
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
