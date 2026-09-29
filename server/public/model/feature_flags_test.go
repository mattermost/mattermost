// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
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

	t.Run("ChannelAttributes should default to false and serialize correctly", func(t *testing.T) {
		require.False(t, f.ChannelAttributes)
		require.Equal(t, "false", f.ToMap()["ChannelAttributes"])

		f.ChannelAttributes = true
		require.Equal(t, "true", f.ToMap()["ChannelAttributes"])
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

	require.True(t, flags.AttributeValueMasking, "AttributeValueMasking should default to true")
	require.Equal(t, "true", flags.ToMap()["AttributeValueMasking"])
}

func TestFeatureFlagsSetDefaults_RecurringScheduledPosts(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.False(t, flags.RecurringScheduledPosts, "RecurringScheduledPosts should default to false")
	require.Equal(t, "false", flags.ToMap()["RecurringScheduledPosts"])

	flags.RecurringScheduledPosts = true
	require.Equal(t, "true", flags.ToMap()["RecurringScheduledPosts"])
}

func TestFeatureFlagsSetDefaults_PostAttributes(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.False(t, flags.PostAttributes, "PostAttributes should default to false")
	require.Equal(t, "false", flags.ToMap()["PostAttributes"])
}

func TestFeatureFlagsSetDefaults_PropertyFieldRank(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.True(t, flags.PropertyFieldRank, "PropertyFieldRank should default to true")
	require.Equal(t, "true", flags.ToMap()["PropertyFieldRank"])
}

func TestFeatureFlagsSetDefaults_PropertyFieldGraph(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.False(t, flags.PropertyFieldGraph, "PropertyFieldGraph should default to false")
	require.Equal(t, "false", flags.ToMap()["PropertyFieldGraph"])
}

func TestFeatureFlagsSetDefaults_TeamMembershipAccessControl(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.True(t, flags.TeamMembershipAccessControl, "TeamMembershipAccessControl should default to true")
	require.Equal(t, "true", flags.ToMap()["TeamMembershipAccessControl"])
}

// TestFeatureFlagsPermissionPoliciesDependencies pins down the
// "sub-flag is gated by the umbrella PermissionPolicies flag"
// contract for both ChannelPermissionPolicies and PolicySimulation.
// Centralizing this in helper methods means future changes to the
// dependency (additional gates, new sub-flags) only have to update
// one place and existing call sites stay correct.
func TestFeatureFlagsPermissionPoliciesDependencies(t *testing.T) {
	t.Run("both helpers are on when defaults are applied", func(t *testing.T) {
		var f FeatureFlags
		f.SetDefaults()

		require.True(t, f.IsChannelPermissionPoliciesEnabled())
		require.True(t, f.IsPolicySimulationEnabled())
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

// TestFeatureFlagsChannelAttributesRequiredEnabled pins down the
// ChannelAttributesRequired flag contract.
func TestFeatureFlagsChannelAttributesRequiredEnabled(t *testing.T) {
	t.Run("sub-flag defaults to false (enforcement off) after SetDefaults", func(t *testing.T) {
		var f FeatureFlags
		f.SetDefaults()

		require.False(t, f.ChannelAttributesRequired)

		f.ChannelAttributes = true
		require.False(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("umbrella off disables enforcement regardless of the sub-flag", func(t *testing.T) {
		f := FeatureFlags{ChannelAttributes: false, ChannelAttributesRequired: true}
		require.False(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("sub-flag false disables enforcement even with the umbrella on", func(t *testing.T) {
		f := FeatureFlags{ChannelAttributes: true, ChannelAttributesRequired: false}
		require.False(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("both on enables enforcement", func(t *testing.T) {
		f := FeatureFlags{ChannelAttributes: true, ChannelAttributesRequired: true}
		require.True(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("a field absent from a persisted FeatureFlags block decodes to false (enforcement off)", func(t *testing.T) {
		// Simulates upgrading a server that already persisted a FeatureFlags
		// block predating this flag's existence: absent field decodes to Go
		// zero value (false = enforcement off), the safe default.
		raw := []byte(`{"ChannelAttributes": true}`)
		var f FeatureFlags
		require.NoError(t, json.Unmarshal(raw, &f))

		require.False(t, f.ChannelAttributesRequired)
		require.False(t, f.IsChannelAttributesRequiredEnabled(),
			"a server upgrading with a persisted FeatureFlags block leaves required-attribute enforcement off until explicitly enabled")
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

func TestFeatureFlagsSetDefaults_EnforceLogPathRoot(t *testing.T) {
	var flags FeatureFlags
	flags.SetDefaults()

	require.False(t, flags.EnforceLogPathRoot, "EnforceLogPathRoot should default to false")
	require.Equal(t, "false", flags.ToMap()["EnforceLogPathRoot"])

	flags.EnforceLogPathRoot = true
	require.Equal(t, "true", flags.ToMap()["EnforceLogPathRoot"])
}
