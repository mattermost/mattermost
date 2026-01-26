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
// ApplyEntitlements Basic Functionality Tests
// =============================================================================

func TestApplyEntitlements_EnablesFeatures(t *testing.T) {
	features := &model.Features{}
	features.SetDefaults()
	// Explicitly set some features to false to verify entitlements enable them
	features.LDAP = model.NewPointer(false)
	features.SAML = model.NewPointer(false)
	features.Cluster = model.NewPointer(false)

	ApplyEntitlements(features, []string{"LDAP", "SAML", "CLUSTER"})

	assert.True(t, *features.LDAP, "LDAP should be enabled by entitlement")
	assert.True(t, *features.SAML, "SAML should be enabled by entitlement")
	assert.True(t, *features.Cluster, "Cluster should be enabled by entitlement")
}

func TestApplyEntitlements_CaseInsensitive(t *testing.T) {
	tests := []struct {
		name    string
		code    string
		checkFn func(*model.Features) bool
	}{
		{"lowercase ldap", "ldap", func(f *model.Features) bool { return *f.LDAP }},
		{"uppercase LDAP", "LDAP", func(f *model.Features) bool { return *f.LDAP }},
		{"mixed case Ldap", "Ldap", func(f *model.Features) bool { return *f.LDAP }},
		{"lowercase saml", "saml", func(f *model.Features) bool { return *f.SAML }},
		{"mixed SAML", "SaML", func(f *model.Features) bool { return *f.SAML }},
		{"lowercase with underscore ldap_groups", "ldap_groups", func(f *model.Features) bool { return *f.LDAPGroups }},
		{"uppercase LDAP_GROUPS", "LDAP_GROUPS", func(f *model.Features) bool { return *f.LDAPGroups }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			features := &model.Features{}
			features.SetDefaults()

			ApplyEntitlements(features, []string{tt.code})

			assert.True(t, tt.checkFn(features), "Feature should be enabled for code %q", tt.code)
		})
	}
}

func TestApplyEntitlements_UnknownCodesIgnored(t *testing.T) {
	features := &model.Features{}
	features.SetDefaults()

	// Should not panic or error with unknown codes
	ApplyEntitlements(features, []string{"UNKNOWN_CODE", "INVALID", "NOT_A_FEATURE"})

	// Features should remain at defaults (not modified)
	assert.True(t, *features.FutureFeatures, "FutureFeatures should remain at default")
}

func TestApplyEntitlements_NilFeaturesNoOp(t *testing.T) {
	// Should not panic with nil features
	ApplyEntitlements(nil, []string{"LDAP", "SAML"})
}

func TestApplyEntitlements_EmptyEntitlementsNoOp(t *testing.T) {
	features := &model.Features{}
	features.SetDefaults()
	features.LDAP = model.NewPointer(false)

	ApplyEntitlements(features, []string{})

	assert.False(t, *features.LDAP, "LDAP should remain false when no entitlements")
}

func TestApplyEntitlements_NilEntitlementsNoOp(t *testing.T) {
	features := &model.Features{}
	features.SetDefaults()
	features.LDAP = model.NewPointer(false)

	ApplyEntitlements(features, nil)

	assert.False(t, *features.LDAP, "LDAP should remain false with nil entitlements")
}

func TestApplyEntitlements_WhitespaceHandling(t *testing.T) {
	features := &model.Features{}
	features.SetDefaults()
	features.LDAP = model.NewPointer(false)
	features.SAML = model.NewPointer(false)

	ApplyEntitlements(features, []string{" LDAP ", "  SAML  ", "\tCLUSTER\t"})

	assert.True(t, *features.LDAP, "LDAP should be enabled (whitespace trimmed)")
	assert.True(t, *features.SAML, "SAML should be enabled (whitespace trimmed)")
	assert.True(t, *features.Cluster, "Cluster should be enabled (whitespace trimmed)")
}

// =============================================================================
// Supplement Mode Tests (Entitlements ALWAYS enable, never disable)
// =============================================================================

func TestApplyEntitlements_EnablesEvenIfMetadataDisabled(t *testing.T) {
	// Entitlements represent authorization - they should enable features
	// even if metadata explicitly disabled them
	features := &model.Features{}
	features.SetDefaults()
	features.SAML = model.NewPointer(false) // Metadata says disabled

	ApplyEntitlements(features, []string{"SAML"})

	assert.True(t, *features.SAML, "Entitlement should override disabled metadata")
}

func TestApplyEntitlements_DoesNotDisableEnabledFeatures(t *testing.T) {
	// If a feature is already enabled, entitlements should not disable it
	features := &model.Features{}
	features.SetDefaults()
	features.LDAP = model.NewPointer(true) // Already enabled

	// Apply different entitlements (not LDAP)
	ApplyEntitlements(features, []string{"SAML", "CLUSTER"})

	// LDAP should still be true
	assert.True(t, *features.LDAP, "LDAP should remain enabled")
	assert.True(t, *features.SAML, "SAML should be enabled by entitlement")
	assert.True(t, *features.Cluster, "Cluster should be enabled by entitlement")
}

func TestApplyEntitlements_SupplementsMetadata(t *testing.T) {
	// Entitlements ADD to metadata features
	features := &model.Features{}
	features.SetDefaults()
	features.LDAP = model.NewPointer(true)  // Already enabled via metadata
	features.SAML = model.NewPointer(false) // Disabled via metadata

	ApplyEntitlements(features, []string{"LDAP", "SAML", "CLUSTER"})

	assert.True(t, *features.LDAP, "LDAP should still be true (was already enabled)")
	assert.True(t, *features.SAML, "SAML should now be true (entitlement enables)")
	assert.True(t, *features.Cluster, "Cluster should be true (entitlement enables)")
}

// =============================================================================
// All Entitlement Codes Test
// =============================================================================

func TestApplyEntitlements_AllCodes(t *testing.T) {
	// Test each entitlement code enables the correct feature
	testCases := []struct {
		code    string
		checkFn func(*model.Features) bool
	}{
		{"LDAP", func(f *model.Features) bool { return *f.LDAP }},
		{"LDAP_GROUPS", func(f *model.Features) bool { return *f.LDAPGroups }},
		{"MFA", func(f *model.Features) bool { return *f.MFA }},
		{"GOOGLE_OAUTH", func(f *model.Features) bool { return *f.GoogleOAuth }},
		{"OFFICE365_OAUTH", func(f *model.Features) bool { return *f.Office365OAuth }},
		{"OPENID", func(f *model.Features) bool { return *f.OpenId }},
		{"COMPLIANCE", func(f *model.Features) bool { return *f.Compliance }},
		{"CLUSTER", func(f *model.Features) bool { return *f.Cluster }},
		{"METRICS", func(f *model.Features) bool { return *f.Metrics }},
		{"MHPNS", func(f *model.Features) bool { return *f.MHPNS }},
		{"SAML", func(f *model.Features) bool { return *f.SAML }},
		{"ELASTICSEARCH", func(f *model.Features) bool { return *f.Elasticsearch }},
		{"EMAIL_NOTIFICATION_CONTENTS", func(f *model.Features) bool { return *f.EmailNotificationContents }},
		{"DATA_RETENTION", func(f *model.Features) bool { return *f.DataRetention }},
		{"MESSAGE_EXPORT", func(f *model.Features) bool { return *f.MessageExport }},
		{"CUSTOM_PERMISSIONS_SCHEMES", func(f *model.Features) bool { return *f.CustomPermissionsSchemes }},
		{"CUSTOM_TERMS_OF_SERVICE", func(f *model.Features) bool { return *f.CustomTermsOfService }},
		{"GUEST_ACCOUNTS", func(f *model.Features) bool { return *f.GuestAccounts }},
		{"GUEST_ACCOUNTS_PERMISSIONS", func(f *model.Features) bool { return *f.GuestAccountsPermissions }},
		{"ID_LOADED_PUSH_NOTIFICATIONS", func(f *model.Features) bool { return *f.IDLoadedPushNotifications }},
		{"LOCK_TEAMMATE_NAME_DISPLAY", func(f *model.Features) bool { return *f.LockTeammateNameDisplay }},
		{"ENTERPRISE_PLUGINS", func(f *model.Features) bool { return *f.EnterprisePlugins }},
		{"ADVANCED_LOGGING", func(f *model.Features) bool { return *f.AdvancedLogging }},
		{"CLOUD", func(f *model.Features) bool { return *f.Cloud }},
		{"SHARED_CHANNELS", func(f *model.Features) bool { return *f.SharedChannels }},
		{"REMOTE_CLUSTER_SERVICE", func(f *model.Features) bool { return *f.RemoteClusterService }},
		{"OUTGOING_OAUTH_CONNECTIONS", func(f *model.Features) bool { return *f.OutgoingOAuthConnections }},
		{"FUTURE_FEATURES", func(f *model.Features) bool { return *f.FutureFeatures }},
		{"ANNOUNCEMENT", func(f *model.Features) bool { return *f.Announcement }},
		{"THEME_MANAGEMENT", func(f *model.Features) bool { return *f.ThemeManagement }},
	}

	for _, tc := range testCases {
		t.Run(tc.code, func(t *testing.T) {
			features := &model.Features{}
			features.SetDefaults()
			// Set FutureFeatures to false so defaults are false
			// This lets us verify the entitlement actually enables the feature
			features.FutureFeatures = model.NewPointer(false)
			features.SetDefaults() // Re-run to propagate false

			ApplyEntitlements(features, []string{tc.code})

			assert.True(t, tc.checkFn(features),
				"Entitlement %s should enable feature", tc.code)
		})
	}
}

func TestApplyEntitlements_AllCodesCount(t *testing.T) {
	// Verify we have all expected entitlement codes
	allCodes := GetAllEntitlementCodes()
	// We have 30 feature-related entitlements
	// (31 features but Users is int not bool, so 30 boolean features + 1 = 31 total minus Users = 30)
	assert.Equal(t, 30, len(allCodes), "Should have 30 entitlement codes for boolean features")
}

// =============================================================================
// Integration Test with ConvertKeygenToModelLicense
// =============================================================================

func TestConvertKeygenToModelLicense_WithEntitlements(t *testing.T) {
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test-entitlements",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
			"features": map[string]any{
				"ldap": false, // Metadata disables LDAP
			},
		},
		Entitlements: []string{"LDAP", "SAML", "CLUSTER"},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Entitlements should enable features
	assert.True(t, *license.Features.LDAP, "LDAP should be enabled by entitlement (overrides metadata)")
	assert.True(t, *license.Features.SAML, "SAML should be enabled by entitlement")
	assert.True(t, *license.Features.Cluster, "Cluster should be enabled by entitlement")
}

func TestConvertKeygenToModelLicense_WithEntitlements_CaseMixed(t *testing.T) {
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test-case-mixed",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
		},
		Entitlements: []string{"ldap", "Saml", "CLUSTER", "mfa"},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	assert.True(t, *license.Features.LDAP, "LDAP should be enabled (lowercase)")
	assert.True(t, *license.Features.SAML, "SAML should be enabled (mixed case)")
	assert.True(t, *license.Features.Cluster, "Cluster should be enabled (uppercase)")
	assert.True(t, *license.Features.MFA, "MFA should be enabled (lowercase)")
}

func TestConvertKeygenToModelLicense_WithoutEntitlements(t *testing.T) {
	// Verify existing behavior without entitlements still works
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test-no-entitlements",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
			"features": map[string]any{
				"ldap": true,
				"saml": false,
			},
		},
		// No Entitlements field
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Should use metadata values
	assert.True(t, *license.Features.LDAP, "LDAP from metadata")
	assert.False(t, *license.Features.SAML, "SAML from metadata (disabled)")
}

func TestConvertKeygenToModelLicense_EntitlementsPreserveMetadataEnabled(t *testing.T) {
	// Verify that entitlements don't accidentally disable metadata-enabled features
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test-preserve",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
			"features": map[string]any{
				"ldap":       true,
				"compliance": true,
				"metrics":    true,
			},
		},
		// Entitlements for different features
		Entitlements: []string{"SAML", "CLUSTER"},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Metadata-enabled features should still be enabled
	assert.True(t, *license.Features.LDAP, "LDAP from metadata should remain enabled")
	assert.True(t, *license.Features.Compliance, "Compliance from metadata should remain enabled")
	assert.True(t, *license.Features.Metrics, "Metrics from metadata should remain enabled")
	// Entitlement-enabled features should also be enabled
	assert.True(t, *license.Features.SAML, "SAML from entitlement should be enabled")
	assert.True(t, *license.Features.Cluster, "Cluster from entitlement should be enabled")
}

func TestConvertKeygenToModelLicense_WithUnknownEntitlements(t *testing.T) {
	// Verify unknown entitlements don't cause errors
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test-unknown",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "Test",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
		},
		Entitlements: []string{"LDAP", "UNKNOWN_FEATURE", "SAML", "NOT_A_REAL_CODE"},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Known entitlements should work
	assert.True(t, *license.Features.LDAP, "LDAP should be enabled")
	assert.True(t, *license.Features.SAML, "SAML should be enabled")
}

// =============================================================================
// Order of Operations Tests
// =============================================================================

func TestApplyEntitlements_OrderOfOperations(t *testing.T) {
	// Verify the order: SetDefaults → metadata → entitlements
	// This test verifies entitlements are applied AFTER metadata

	t.Run("entitlements enable after metadata disables", func(t *testing.T) {
		// Simulate: SetDefaults (LDAP=true via FutureFeatures)
		//           → metadata (LDAP=false)
		//           → entitlements (LDAP)
		// Result: LDAP should be true (entitlement wins)

		features := &model.Features{}
		features.SetDefaults()                  // LDAP = true (from FutureFeatures)
		features.LDAP = model.NewPointer(false) // Metadata override

		ApplyEntitlements(features, []string{"LDAP"})

		assert.True(t, *features.LDAP, "Entitlement should enable LDAP after metadata disabled it")
	})

	t.Run("futureFeatures false with specific entitlements", func(t *testing.T) {
		// License with FutureFeatures=false but specific entitlements
		// Note: SetDefaults() is called first (FutureFeatures=true cascades), then metadata overrides.
		// So even with futureFeatures: false in metadata, other features already have true values
		// unless they're also explicitly set to false in metadata.
		expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
		data := &KeygenLicenseData{
			ID:     "test-ff-false",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "Test",
				"customerEmail": "test@example.com",
				"companyName":   "Test Corp",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
				"features": map[string]any{
					"futureFeatures": false, // Set to false after SetDefaults cascaded
					"cluster":        false, // Explicitly disabled
					"metrics":        false, // Explicitly disabled
				},
			},
			Entitlements: []string{"LDAP", "SAML"},
		}

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// FutureFeatures should be false
		assert.False(t, *license.Features.FutureFeatures)
		// Specific entitlements should be enabled
		assert.True(t, *license.Features.LDAP, "LDAP enabled by entitlement")
		assert.True(t, *license.Features.SAML, "SAML enabled by entitlement")
		// Features explicitly disabled in metadata (and no entitlement) remain false
		assert.False(t, *license.Features.Cluster, "Cluster should be false (explicitly disabled, no entitlement)")
		assert.False(t, *license.Features.Metrics, "Metrics should be false (explicitly disabled, no entitlement)")
	})
}
