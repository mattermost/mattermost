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

	t.Run("ClassificationMarkings should default to true", func(t *testing.T) {
		require.True(t, f.ClassificationMarkings)
	})

	t.Run("ClassificationMarkings should serialize correctly", func(t *testing.T) {
		m := f.ToMap()
		require.Equal(t, "true", m["ClassificationMarkings"])

		f.ClassificationMarkings = false
		m = f.ToMap()
		require.Equal(t, "false", m["ClassificationMarkings"])
	})

	t.Run("MmBlocksEnabled defaults to true", func(t *testing.T) {
		require.True(t, f.MmBlocksEnabled)
		require.Equal(t, "true", f.ToMap()["MmBlocksEnabled"])
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

// TestFeatureFlagsPermissionPoliciesDependencies pins down the
// "sub-flag is gated by the umbrella PermissionPolicies flag"
// contract for both ChannelPermissionPolicies and PolicySimulation.
// Centralizing this in helper methods means future changes to the
// dependency (additional gates, new sub-flags) only have to update
// one place and existing call sites stay correct.
func TestFeatureFlagsPermissionPoliciesDependencies(t *testing.T) {
	t.Run("both helpers are off when defaults are applied", func(t *testing.T) {
		var f FeatureFlags
		f.SetDefaults()

		require.False(t, f.IsChannelPermissionPoliciesEnabled())
		require.False(t, f.IsPolicySimulationEnabled())
	})

	t.Run("sub-flag alone is not enough — the umbrella must be on too", func(t *testing.T) {
		f := FeatureFlags{
			PermissionPolicies:        false,
			ChannelPermissionPolicies: true,
			PolicySimulation:          true,
		}
		require.False(t, f.IsChannelPermissionPoliciesEnabled(),
			"ChannelPermissionPolicies sub-flag must be ignored when the PermissionPolicies umbrella is off")
		require.False(t, f.IsPolicySimulationEnabled(),
			"PolicySimulation sub-flag must be ignored when the PermissionPolicies umbrella is off")
	})

	t.Run("umbrella alone is not enough — the sub-flag must be on too", func(t *testing.T) {
		f := FeatureFlags{
			PermissionPolicies:        true,
			ChannelPermissionPolicies: false,
			PolicySimulation:          false,
		}
		require.False(t, f.IsChannelPermissionPoliciesEnabled())
		require.False(t, f.IsPolicySimulationEnabled())
	})

	t.Run("both flags on enables each sub-feature independently", func(t *testing.T) {
		f := FeatureFlags{
			PermissionPolicies:        true,
			ChannelPermissionPolicies: true,
			PolicySimulation:          false,
		}
		require.True(t, f.IsChannelPermissionPoliciesEnabled())
		require.False(t, f.IsPolicySimulationEnabled(), "sub-flags are independent — enabling one must not enable the other")

		f.ChannelPermissionPolicies = false
		f.PolicySimulation = true
		require.False(t, f.IsChannelPermissionPoliciesEnabled())
		require.True(t, f.IsPolicySimulationEnabled())
	})
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
