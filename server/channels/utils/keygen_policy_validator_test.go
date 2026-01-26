// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// =============================================================================
// ValidateSKUWithPolicy Tests
// =============================================================================

func TestValidateSKUWithPolicy_ValidCombinations(t *testing.T) {
	tests := []struct {
		name         string
		skuShortName string
		policyName   string
	}{
		// Exact SKU matches
		{"e10 exact", model.LicenseShortSkuE10, "e10"},
		{"e20 exact", model.LicenseShortSkuE20, "e20"},
		{"professional exact", model.LicenseShortSkuProfessional, "professional"},
		{"enterprise exact", model.LicenseShortSkuEnterprise, "enterprise"},
		{"advanced exact", model.LicenseShortSkuEnterpriseAdvanced, "advanced"},
		{"entry exact", model.LicenseShortSkuMattermostEntry, "entry"},

		// With mattermost- prefix
		{"mattermost-e10", model.LicenseShortSkuE10, "mattermost-e10"},
		{"mattermost-e20", model.LicenseShortSkuE20, "mattermost-e20"},
		{"mattermost-professional", model.LicenseShortSkuProfessional, "mattermost-professional"},
		{"mattermost-enterprise", model.LicenseShortSkuEnterprise, "mattermost-enterprise"},
		{"mattermost-enterprise-advanced", model.LicenseShortSkuEnterpriseAdvanced, "mattermost-enterprise-advanced"},
		{"mattermost-advanced", model.LicenseShortSkuEnterpriseAdvanced, "mattermost-advanced"},
		{"mattermost-entry", model.LicenseShortSkuMattermostEntry, "mattermost-entry"},

		// Case insensitive
		{"uppercase PROFESSIONAL", model.LicenseShortSkuProfessional, "PROFESSIONAL"},
		{"mixed case Enterprise", model.LicenseShortSkuEnterprise, "Enterprise"},
		{"uppercase E10", model.LicenseShortSkuE10, "E10"},
		{"mixed MATTERMOST-ENTERPRISE", model.LicenseShortSkuEnterprise, "MATTERMOST-ENTERPRISE"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSKUWithPolicy(tt.skuShortName, tt.policyName)
			assert.NoError(t, err)
		})
	}
}

func TestValidateSKUWithPolicy_Mismatches(t *testing.T) {
	tests := []struct {
		name         string
		skuShortName string
		policyName   string
	}{
		{"e10 vs e20", model.LicenseShortSkuE10, "e20"},
		{"e20 vs e10", model.LicenseShortSkuE20, "e10"},
		{"professional vs enterprise", model.LicenseShortSkuProfessional, "enterprise"},
		{"enterprise vs professional", model.LicenseShortSkuEnterprise, "professional"},
		{"entry vs advanced", model.LicenseShortSkuMattermostEntry, "advanced"},
		{"advanced vs entry", model.LicenseShortSkuEnterpriseAdvanced, "entry"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSKUWithPolicy(tt.skuShortName, tt.policyName)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "SKU mismatch")
		})
	}
}

func TestValidateSKUWithPolicy_EmptyPolicySkipsValidation(t *testing.T) {
	// Empty policy name means no policy name available - skip validation
	err := ValidateSKUWithPolicy(model.LicenseShortSkuEnterprise, "")
	assert.NoError(t, err)
}

func TestValidateSKUWithPolicy_UnknownPolicySkipsValidation(t *testing.T) {
	// Unknown policy names are not errors - we just can't validate
	tests := []string{
		"custom-policy-name",
		"random-policy",
		"my-special-license",
		"some-other-thing",
	}

	for _, policyName := range tests {
		t.Run(policyName, func(t *testing.T) {
			err := ValidateSKUWithPolicy(model.LicenseShortSkuEnterprise, policyName)
			assert.NoError(t, err)
		})
	}
}

func TestValidateSKUWithPolicy_WhitespaceHandling(t *testing.T) {
	// Policy name should be trimmed
	err := ValidateSKUWithPolicy(model.LicenseShortSkuEnterprise, "  enterprise  ")
	assert.NoError(t, err)

	err = ValidateSKUWithPolicy(model.LicenseShortSkuProfessional, "\tprofessional\n")
	assert.NoError(t, err)
}

// =============================================================================
// GetExpectedEntitlements Tests
// =============================================================================

func TestGetExpectedEntitlements_AllSKUs(t *testing.T) {
	tests := []struct {
		skuShortName string
		minExpected  int // Minimum number of expected entitlements
		mustContain  []EntitlementCode
	}{
		{
			model.LicenseShortSkuE10,
			3, // Minimal set
			[]EntitlementCode{EntitlementLDAP, EntitlementMFA, EntitlementSAML},
		},
		{
			model.LicenseShortSkuE20,
			10,
			[]EntitlementCode{EntitlementLDAP, EntitlementCompliance, EntitlementCluster},
		},
		{
			model.LicenseShortSkuProfessional,
			6,
			[]EntitlementCode{EntitlementLDAP, EntitlementSAML, EntitlementSharedChannels},
		},
		{
			model.LicenseShortSkuEnterprise,
			15,
			[]EntitlementCode{EntitlementLDAP, EntitlementCompliance, EntitlementElasticsearch},
		},
		{
			model.LicenseShortSkuEnterpriseAdvanced,
			18,
			[]EntitlementCode{EntitlementAdvancedLogging, EntitlementRemoteClusterService},
		},
		{
			model.LicenseShortSkuMattermostEntry,
			18,
			[]EntitlementCode{EntitlementAdvancedLogging, EntitlementRemoteClusterService},
		},
	}

	for _, tt := range tests {
		t.Run(tt.skuShortName, func(t *testing.T) {
			expected := GetExpectedEntitlements(tt.skuShortName)
			require.NotNil(t, expected)
			assert.GreaterOrEqual(t, len(expected), tt.minExpected)

			for _, mustHave := range tt.mustContain {
				assert.Contains(t, expected, mustHave,
					"SKU %s should expect entitlement %s", tt.skuShortName, mustHave)
			}
		})
	}
}

func TestGetExpectedEntitlements_UnknownSKU(t *testing.T) {
	expected := GetExpectedEntitlements("unknown-sku")
	assert.Nil(t, expected)
}

func TestGetExpectedEntitlements_EmptySKU(t *testing.T) {
	expected := GetExpectedEntitlements("")
	assert.Nil(t, expected)
}

// =============================================================================
// DetectMissingEntitlements Tests (FEAT-03)
// =============================================================================

func TestDetectMissingEntitlements_NoMissing(t *testing.T) {
	// Provide all expected entitlements for Professional
	actual := []string{"LDAP", "MFA", "GOOGLE_OAUTH", "OFFICE365_OAUTH", "OPENID", "SAML", "GUEST_ACCOUNTS", "SHARED_CHANNELS"}

	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, actual)
	assert.Empty(t, missing)
}

func TestDetectMissingEntitlements_SomeMissing(t *testing.T) {
	// Missing SAML and SHARED_CHANNELS
	actual := []string{"LDAP", "MFA", "GOOGLE_OAUTH", "OFFICE365_OAUTH", "OPENID", "GUEST_ACCOUNTS"}

	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, actual)
	require.NotEmpty(t, missing)
	assert.Contains(t, missing, EntitlementSAML)
	assert.Contains(t, missing, EntitlementSharedChannels)
}

func TestDetectMissingEntitlements_CaseInsensitive(t *testing.T) {
	// Mixed case entitlement codes
	actual := []string{"ldap", "Mfa", "GOOGLE_OAUTH", "office365_oauth", "OpenID", "saml", "guest_accounts", "Shared_Channels"}

	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, actual)
	assert.Empty(t, missing, "Case-insensitive matching should find all entitlements")
}

func TestDetectMissingEntitlements_UnknownSKU(t *testing.T) {
	missing := DetectMissingEntitlements("unknown-sku", []string{"LDAP"})
	assert.Nil(t, missing, "Unknown SKU should return nil")
}

func TestDetectMissingEntitlements_EmptyActual(t *testing.T) {
	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, []string{})
	// All expected should be missing
	expected := GetExpectedEntitlements(model.LicenseShortSkuProfessional)
	assert.Equal(t, len(expected), len(missing))
}

func TestDetectMissingEntitlements_NilActual(t *testing.T) {
	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, nil)
	// All expected should be missing
	expected := GetExpectedEntitlements(model.LicenseShortSkuProfessional)
	assert.Equal(t, len(expected), len(missing))
}

func TestDetectMissingEntitlements_ExtraEntitlementsIgnored(t *testing.T) {
	// Include extra entitlements beyond expected
	actual := []string{
		"LDAP", "MFA", "GOOGLE_OAUTH", "OFFICE365_OAUTH", "OPENID", "SAML",
		"GUEST_ACCOUNTS", "SHARED_CHANNELS",
		"EXTRA_ENTITLEMENT", "ANOTHER_EXTRA", // These should be ignored
	}

	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, actual)
	assert.Empty(t, missing, "Extra entitlements should not cause false positives")
}

func TestDetectMissingEntitlements_WhitespaceHandling(t *testing.T) {
	// Entitlements with whitespace
	actual := []string{" LDAP ", "  MFA  ", "GOOGLE_OAUTH", "OFFICE365_OAUTH", "OPENID", "SAML", "GUEST_ACCOUNTS", "SHARED_CHANNELS"}

	missing := DetectMissingEntitlements(model.LicenseShortSkuProfessional, actual)
	assert.Empty(t, missing, "Whitespace should be trimmed")
}

// =============================================================================
// HasAllExpectedEntitlements Tests
// =============================================================================

func TestHasAllExpectedEntitlements_True(t *testing.T) {
	actual := []string{"LDAP", "MFA", "GOOGLE_OAUTH", "OFFICE365_OAUTH", "OPENID", "SAML", "GUEST_ACCOUNTS", "SHARED_CHANNELS"}

	result := HasAllExpectedEntitlements(model.LicenseShortSkuProfessional, actual)
	assert.True(t, result)
}

func TestHasAllExpectedEntitlements_False(t *testing.T) {
	actual := []string{"LDAP", "MFA"} // Missing most entitlements

	result := HasAllExpectedEntitlements(model.LicenseShortSkuProfessional, actual)
	assert.False(t, result)
}

func TestHasAllExpectedEntitlements_UnknownSKU(t *testing.T) {
	// Unknown SKU returns true (can't detect missing)
	result := HasAllExpectedEntitlements("unknown-sku", []string{"LDAP"})
	assert.True(t, result)
}

// =============================================================================
// Integration: Missing Entitlements with Keygen License
// =============================================================================

func TestKeygenLicense_DetectMissingEntitlements_Integration(t *testing.T) {
	expiry := time.Now().Add(365 * 24 * time.Hour)
	data := &KeygenLicenseData{
		ID:     "test-missing",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_test",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Mattermost Enterprise",
			"skuShortName":  model.LicenseShortSkuEnterprise,
		},
		// Only provide a subset of expected entitlements
		Entitlements: []string{"LDAP", "SAML", "MFA"},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Detect missing entitlements
	missing := DetectMissingEntitlements(license.SkuShortName, data.Entitlements)

	require.NotEmpty(t, missing, "Should detect missing entitlements")
	// Enterprise expects many more entitlements than provided
	assert.Greater(t, len(missing), 10)
}

func TestKeygenLicense_AllEntitlements_Integration(t *testing.T) {
	// Test a license with all expected entitlements for its SKU
	expiry := time.Now().Add(365 * 24 * time.Hour)

	// Get all expected entitlements for Professional
	expected := GetExpectedEntitlements(model.LicenseShortSkuProfessional)
	entitlementStrings := make([]string, len(expected))
	for i, e := range expected {
		entitlementStrings[i] = string(e)
	}

	data := &KeygenLicenseData{
		ID:     "test-all-entitlements",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_test",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Mattermost Professional",
			"skuShortName":  model.LicenseShortSkuProfessional,
		},
		Entitlements: entitlementStrings,
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Should have no missing entitlements
	missing := DetectMissingEntitlements(license.SkuShortName, data.Entitlements)
	assert.Empty(t, missing)

	// Verify features are enabled
	assert.True(t, *license.Features.LDAP)
	assert.True(t, *license.Features.SAML)
	assert.True(t, *license.Features.SharedChannels)
}

// =============================================================================
// SKU Tier Hierarchy with Entitlements Tests
// =============================================================================

func TestKeygenLicense_EntitlementsWithTierHierarchy(t *testing.T) {
	// Test that tier-based features work correctly even with limited entitlements

	t.Run("Professional with limited entitlements still gets tier features", func(t *testing.T) {
		expiry := time.Now().Add(365 * 24 * time.Hour)
		data := &KeygenLicenseData{
			ID:     "test-pro-limited",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_test",
				"customerName":  "Test",
				"customerEmail": "test@example.com",
				"companyName":   "Test Corp",
				"skuName":       "Mattermost Professional",
				"skuShortName":  model.LicenseShortSkuProfessional,
			},
			// Only a few entitlements
			Entitlements: []string{"LDAP"},
		}

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Even with limited entitlements, tier-based features should work
		assert.True(t, model.MinimumProfessionalLicense(license))
		assert.True(t, license.HasSharedChannels())               // Via tier
		assert.True(t, license.HasEnterpriseMarketplacePlugins()) // Via tier
	})

	t.Run("E10 with entitlements still cannot access tier features", func(t *testing.T) {
		expiry := time.Now().Add(365 * 24 * time.Hour)
		data := &KeygenLicenseData{
			ID:     "test-e10-with-entitlements",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_test",
				"customerName":  "Test",
				"customerEmail": "test@example.com",
				"companyName":   "Test Corp",
				"skuName":       "Mattermost E10",
				"skuShortName":  model.LicenseShortSkuE10,
			},
			// Even with these entitlements, E10 doesn't get tier access
			Entitlements: []string{"LDAP", "SAML", "CLUSTER"},
		}

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// E10 is not in the tier map
		assert.False(t, model.MinimumProfessionalLicense(license))
		// Features from entitlements work
		assert.True(t, *license.Features.LDAP)
		assert.True(t, *license.Features.SAML)
		assert.True(t, *license.Features.Cluster)
		// But tier-based feature checks fail
		// (HasSharedChannels returns false because SharedChannels isn't in entitlements and not min professional)
		license.Features.SharedChannels = model.NewPointer(false) // Override default
		assert.False(t, license.HasSharedChannels())
	})
}
