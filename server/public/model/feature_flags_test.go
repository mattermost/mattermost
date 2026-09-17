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
// ChannelAttributesRequiredDisabled kill-switch contract, including the
// upgrade-safety property that motivated its inverted naming: a server with a
// persisted, non-nil FeatureFlags block (e.g. from Split sync, or an admin who
// has ever set any flag) skips FeatureFlags.SetDefaults() entirely on load
// (see Config.SetDefaults, config.go), so an absent field decodes to its Go
// zero value rather than this package's declared default. A default-false
// "disabled" field degrades to its safe value (enforced) in that case; a
// default-true field would have silently degraded to unenforced instead.
func TestFeatureFlagsChannelAttributesRequiredEnabled(t *testing.T) {
	t.Run("sub-flag defaults to not-disabled, i.e. enforced, once ChannelAttributes is on", func(t *testing.T) {
		// ChannelAttributes itself defaults to false (opt-in umbrella), so
		// this pins down only the sub-flag's own default, not the combinator
		// on a bare SetDefaults() — see the umbrella-off case below for that.
		var f FeatureFlags
		f.SetDefaults()

		require.False(t, f.ChannelAttributesRequiredDisabled)

		f.ChannelAttributes = true
		require.True(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("umbrella off disables enforcement regardless of the sub-flag", func(t *testing.T) {
		f := FeatureFlags{ChannelAttributes: false, ChannelAttributesRequiredDisabled: false}
		require.False(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("sub-flag disables enforcement even with the umbrella on", func(t *testing.T) {
		f := FeatureFlags{ChannelAttributes: true, ChannelAttributesRequiredDisabled: true}
		require.False(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("both on enables enforcement", func(t *testing.T) {
		f := FeatureFlags{ChannelAttributes: true, ChannelAttributesRequiredDisabled: false}
		require.True(t, f.IsChannelAttributesRequiredEnabled())
	})

	t.Run("a field absent from a persisted FeatureFlags block decodes to enforced, not disabled", func(t *testing.T) {
		// Simulates upgrading a server that already persisted a FeatureFlags
		// block (config.json, or Cloud/Dedicated Split sync) predating this
		// flag's existence: Config.SetDefaults only backfills FeatureFlags
		// when the whole struct is nil, so this field is never touched by
		// SetDefaults here and must be safe at its raw zero value.
		raw := []byte(`{"ChannelAttributes": true}`)
		var f FeatureFlags
		require.NoError(t, json.Unmarshal(raw, &f))

		require.False(t, f.ChannelAttributesRequiredDisabled)
		require.True(t, f.IsChannelAttributesRequiredEnabled(),
			"a server upgrading with a persisted FeatureFlags block must keep required-attribute enforcement on")
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
