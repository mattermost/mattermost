// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// PolicyNameToSKU maps Keygen policy names to Mattermost SKU short names.
// Policy names should follow the convention: "mattermost-{sku}" or just "{sku}".
// This is used for optional validation, not as the source of truth (metadata is primary).
var PolicyNameToSKU = map[string]string{
	// Exact SKU matches (lowercase)
	"e10":          model.LicenseShortSkuE10,
	"e20":          model.LicenseShortSkuE20,
	"professional": model.LicenseShortSkuProfessional,
	"enterprise":   model.LicenseShortSkuEnterprise,
	"advanced":     model.LicenseShortSkuEnterpriseAdvanced,
	"entry":        model.LicenseShortSkuMattermostEntry,
	// With mattermost- prefix
	"mattermost-e10":                 model.LicenseShortSkuE10,
	"mattermost-e20":                 model.LicenseShortSkuE20,
	"mattermost-professional":        model.LicenseShortSkuProfessional,
	"mattermost-enterprise":          model.LicenseShortSkuEnterprise,
	"mattermost-enterprise-advanced": model.LicenseShortSkuEnterpriseAdvanced,
	"mattermost-advanced":            model.LicenseShortSkuEnterpriseAdvanced,
	"mattermost-entry":               model.LicenseShortSkuMattermostEntry,
	"mattermost-mattermost-entry":    model.LicenseShortSkuMattermostEntry,
	"mattermost-enterprise-entry":    model.LicenseShortSkuMattermostEntry,
}

// SKUToExpectedEntitlements defines the baseline entitlements expected for each SKU.
// This is used for FEAT-03: detecting missing entitlements.
// Note: These are EXPECTED, not REQUIRED. Missing entitlements log warnings but don't fail.
var SKUToExpectedEntitlements = map[string][]EntitlementCode{
	// E10 legacy - minimal set
	model.LicenseShortSkuE10: {
		EntitlementLDAP,
		EntitlementMFA,
		EntitlementSAML,
	},
	// E20 legacy - enterprise features
	model.LicenseShortSkuE20: {
		EntitlementLDAP,
		EntitlementLDAPGroups,
		EntitlementMFA,
		EntitlementSAML,
		EntitlementCompliance,
		EntitlementCluster,
		EntitlementMetrics,
		EntitlementDataRetention,
		EntitlementMessageExport,
		EntitlementElasticsearch,
		EntitlementEnterprisePlugins,
	},
	// Professional tier
	model.LicenseShortSkuProfessional: {
		EntitlementLDAP,
		EntitlementMFA,
		EntitlementGoogleOAuth,
		EntitlementOffice365OAuth,
		EntitlementOpenID,
		EntitlementSAML,
		EntitlementGuestAccounts,
		EntitlementSharedChannels,
	},
	// Enterprise tier (includes Professional features)
	model.LicenseShortSkuEnterprise: {
		EntitlementLDAP,
		EntitlementLDAPGroups,
		EntitlementMFA,
		EntitlementGoogleOAuth,
		EntitlementOffice365OAuth,
		EntitlementOpenID,
		EntitlementSAML,
		EntitlementCompliance,
		EntitlementCluster,
		EntitlementMetrics,
		EntitlementDataRetention,
		EntitlementMessageExport,
		EntitlementElasticsearch,
		EntitlementGuestAccounts,
		EntitlementCustomPermissionsSchemes,
		EntitlementEnterprisePlugins,
		EntitlementSharedChannels,
	},
	// Enterprise Advanced tier (includes Enterprise features)
	model.LicenseShortSkuEnterpriseAdvanced: {
		EntitlementLDAP,
		EntitlementLDAPGroups,
		EntitlementMFA,
		EntitlementGoogleOAuth,
		EntitlementOffice365OAuth,
		EntitlementOpenID,
		EntitlementSAML,
		EntitlementCompliance,
		EntitlementCluster,
		EntitlementMetrics,
		EntitlementDataRetention,
		EntitlementMessageExport,
		EntitlementElasticsearch,
		EntitlementGuestAccounts,
		EntitlementCustomPermissionsSchemes,
		EntitlementCustomTermsOfService,
		EntitlementEnterprisePlugins,
		EntitlementAdvancedLogging,
		EntitlementSharedChannels,
		EntitlementRemoteClusterService,
	},
	// Entry tier (same features as Advanced)
	model.LicenseShortSkuMattermostEntry: {
		EntitlementLDAP,
		EntitlementLDAPGroups,
		EntitlementMFA,
		EntitlementGoogleOAuth,
		EntitlementOffice365OAuth,
		EntitlementOpenID,
		EntitlementSAML,
		EntitlementCompliance,
		EntitlementCluster,
		EntitlementMetrics,
		EntitlementDataRetention,
		EntitlementMessageExport,
		EntitlementElasticsearch,
		EntitlementGuestAccounts,
		EntitlementCustomPermissionsSchemes,
		EntitlementCustomTermsOfService,
		EntitlementEnterprisePlugins,
		EntitlementAdvancedLogging,
		EntitlementSharedChannels,
		EntitlementRemoteClusterService,
	},
}

// ValidateSKUWithPolicy checks if the metadata SKU matches the Keygen policy name convention.
// This is an optional validation - metadata SKU is the source of truth.
// Returns nil if valid, or an error describing the mismatch.
//
// If policyName is empty, validation is skipped (no policy name available).
// If policyName is not in the mapping, validation is skipped (unknown policy name).
func ValidateSKUWithPolicy(skuShortName, policyName string) error {
	if policyName == "" {
		return nil // No policy name to validate against
	}

	normalizedPolicy := strings.ToLower(strings.TrimSpace(policyName))
	expectedSKU, ok := PolicyNameToSKU[normalizedPolicy]
	if !ok {
		// Unknown policy name - not an error, just can't validate
		return nil
	}

	if expectedSKU != skuShortName {
		return fmt.Errorf("SKU mismatch: metadata has %q but policy %q expects %q",
			skuShortName, policyName, expectedSKU)
	}

	return nil
}

// GetExpectedEntitlements returns the expected entitlement codes for a given SKU.
// Returns nil if the SKU is unknown.
func GetExpectedEntitlements(skuShortName string) []EntitlementCode {
	return SKUToExpectedEntitlements[skuShortName]
}

// DetectMissingEntitlements compares actual entitlements against expected for the SKU.
// Returns a list of missing entitlement codes.
// This implements FEAT-03: detecting missing entitlements.
//
// Returns nil if:
// - The SKU is unknown
// - All expected entitlements are present
func DetectMissingEntitlements(skuShortName string, actualEntitlements []string) []EntitlementCode {
	expected := GetExpectedEntitlements(skuShortName)
	if expected == nil {
		return nil // Unknown SKU, can't detect missing
	}

	// Build set of actual entitlements (normalized to uppercase)
	actualSet := make(map[EntitlementCode]struct{})
	for _, e := range actualEntitlements {
		actualSet[EntitlementCode(strings.ToUpper(strings.TrimSpace(e)))] = struct{}{}
	}

	// Find missing
	var missing []EntitlementCode
	for _, exp := range expected {
		if _, ok := actualSet[exp]; !ok {
			missing = append(missing, exp)
		}
	}

	return missing
}

// HasAllExpectedEntitlements checks if a license has all expected entitlements for its SKU.
// Returns true if all expected entitlements are present, or if the SKU is unknown.
func HasAllExpectedEntitlements(skuShortName string, actualEntitlements []string) bool {
	missing := DetectMissingEntitlements(skuShortName, actualEntitlements)
	return len(missing) == 0
}
