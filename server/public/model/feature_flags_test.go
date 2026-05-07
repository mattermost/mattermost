// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFeatureFlagsSetDefaults(t *testing.T) {
	f := &FeatureFlags{}
	f.SetDefaults()

	t.Run("ClassificationMarkings should default to false", func(t *testing.T) {
		require.False(t, f.ClassificationMarkings)
	})

	t.Run("ClassificationMarkings should serialize correctly", func(t *testing.T) {
		m := f.ToMap()
		require.Equal(t, "false", m["ClassificationMarkings"])

		f.ClassificationMarkings = true
		m = f.ToMap()
		require.Equal(t, "true", m["ClassificationMarkings"])
	})
}

func TestFeatureFlagsToMap(t *testing.T) {
	for name, tc := range map[string]struct {
		Flags            FeatureFlags
		TestFeatureValue string
	}{
		"empty": {
			TestFeatureValue: "",
			Flags:            FeatureFlags{},
		},
		"simple value": {
			TestFeatureValue: "expectedvalue",
			Flags:            FeatureFlags{TestFeature: "expectedvalue"},
		},
		"empty value": {
			TestFeatureValue: "",
			Flags:            FeatureFlags{TestFeature: ""},
		},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.TestFeatureValue, tc.Flags.ToMap()["TestFeature"])
		})
	}
}

func TestFeatureFlagsSetDefaults_AttributeValueMasking(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.False(t, flags.AttributeValueMasking, "AttributeValueMasking should default to false")
	require.Equal(t, "false", flags.ToMap()["AttributeValueMasking"])
}

func TestFeatureFlagsToMapBool(t *testing.T) {
	for name, tc := range map[string]struct {
		Flags            FeatureFlags
		TestFeatureValue string
	}{
		"false": {
			TestFeatureValue: "false",
			Flags:            FeatureFlags{},
		},
		"true": {
			TestFeatureValue: "true",
			Flags:            FeatureFlags{TestBoolFeature: true},
		},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.TestFeatureValue, tc.Flags.ToMap()["TestBoolFeature"])
		})
	}
}
