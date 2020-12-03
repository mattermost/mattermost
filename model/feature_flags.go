// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type FeatureFlags struct {
	// Exists only for unit and manual testing.
	// When set to a value, will be returned by the ping endpoint.
	TestFeature string
	// Exists only for testing bool functionality. Boolean feature flags interpret "on" or "true" as true and
	// all other values as false.
	TestBoolFeature bool

	// Toggle on and off scheduled jobs for cloud user limit emails see MM-29999
	CloudDelinquentEmailJobsEnabled bool
}

func (f *FeatureFlags) SetDefaults() {
	f.TestFeature = "off"
	f.TestBoolFeature = false
	f.CloudDelinquentEmailJobsEnabled = false
}
