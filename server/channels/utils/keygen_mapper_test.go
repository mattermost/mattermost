// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// =============================================================================
// extractMetadata Tests
// =============================================================================

func TestExtractMetadata_String(t *testing.T) {
	tests := []struct {
		name       string
		metadata   map[string]any
		key        string
		defaultVal string
		expected   string
	}{
		{
			name:       "extracts string value",
			metadata:   map[string]any{"name": "test"},
			key:        "name",
			defaultVal: "default",
			expected:   "test",
		},
		{
			name:       "returns default for missing key",
			metadata:   map[string]any{"other": "value"},
			key:        "name",
			defaultVal: "default",
			expected:   "default",
		},
		{
			name:       "returns default for nil metadata",
			metadata:   nil,
			key:        "name",
			defaultVal: "default",
			expected:   "default",
		},
		{
			name:       "returns default for wrong type",
			metadata:   map[string]any{"name": 123},
			key:        "name",
			defaultVal: "default",
			expected:   "default",
		},
		{
			name:       "returns empty string when value is empty",
			metadata:   map[string]any{"name": ""},
			key:        "name",
			defaultVal: "default",
			expected:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractMetadata(tt.metadata, tt.key, tt.defaultVal)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExtractMetadata_Bool(t *testing.T) {
	tests := []struct {
		name       string
		metadata   map[string]any
		key        string
		defaultVal bool
		expected   bool
	}{
		{
			name:       "extracts true value",
			metadata:   map[string]any{"enabled": true},
			key:        "enabled",
			defaultVal: false,
			expected:   true,
		},
		{
			name:       "extracts false value",
			metadata:   map[string]any{"enabled": false},
			key:        "enabled",
			defaultVal: true,
			expected:   false,
		},
		{
			name:       "returns default for missing key",
			metadata:   map[string]any{"other": true},
			key:        "enabled",
			defaultVal: true,
			expected:   true,
		},
		{
			name:       "returns default for nil metadata",
			metadata:   nil,
			key:        "enabled",
			defaultVal: true,
			expected:   true,
		},
		{
			name:       "returns default for wrong type (string true)",
			metadata:   map[string]any{"enabled": "true"},
			key:        "enabled",
			defaultVal: false,
			expected:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractMetadata(tt.metadata, tt.key, tt.defaultVal)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// extractMetadataRequired Tests
// =============================================================================

func TestExtractMetadataRequired_Success(t *testing.T) {
	metadata := map[string]any{
		"name":  "test-value",
		"count": float64(42),
	}

	t.Run("extracts string successfully", func(t *testing.T) {
		result, err := extractMetadataRequired[string](metadata, "name")
		require.NoError(t, err)
		assert.Equal(t, "test-value", result)
	})

	t.Run("extracts float64 successfully", func(t *testing.T) {
		result, err := extractMetadataRequired[float64](metadata, "count")
		require.NoError(t, err)
		assert.Equal(t, float64(42), result)
	})
}

func TestExtractMetadataRequired_Errors(t *testing.T) {
	t.Run("error for missing key", func(t *testing.T) {
		metadata := map[string]any{"other": "value"}
		_, err := extractMetadataRequired[string](metadata, "name")
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrKeygenMetadataMissing))
		assert.Contains(t, err.Error(), "name")
	})

	t.Run("error for nil metadata", func(t *testing.T) {
		_, err := extractMetadataRequired[string](nil, "name")
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrKeygenMetadataMissing))
		assert.Contains(t, err.Error(), "metadata is nil")
	})

	t.Run("error for wrong type", func(t *testing.T) {
		metadata := map[string]any{"name": 123}
		_, err := extractMetadataRequired[string](metadata, "name")
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrKeygenMetadataInvalidType))
		assert.Contains(t, err.Error(), "name")
	})
}

// =============================================================================
// extractMetadataInt Tests
// =============================================================================

func TestExtractMetadataInt(t *testing.T) {
	tests := []struct {
		name       string
		metadata   map[string]any
		key        string
		defaultVal int
		expected   int
	}{
		{
			name:       "converts float64 to int correctly",
			metadata:   map[string]any{"users": float64(500)},
			key:        "users",
			defaultVal: 0,
			expected:   500,
		},
		{
			name:       "handles direct int value",
			metadata:   map[string]any{"users": 500},
			key:        "users",
			defaultVal: 0,
			expected:   500,
		},
		{
			name:       "returns default for non-numeric",
			metadata:   map[string]any{"users": "five hundred"},
			key:        "users",
			defaultVal: 100,
			expected:   100,
		},
		{
			name:       "returns default for missing key",
			metadata:   map[string]any{"other": float64(500)},
			key:        "users",
			defaultVal: 100,
			expected:   100,
		},
		{
			name:       "returns default for nil metadata",
			metadata:   nil,
			key:        "users",
			defaultVal: 100,
			expected:   100,
		},
		{
			name:       "handles zero correctly",
			metadata:   map[string]any{"users": float64(0)},
			key:        "users",
			defaultVal: 100,
			expected:   0,
		},
		{
			name:       "handles negative numbers",
			metadata:   map[string]any{"users": float64(-1)},
			key:        "users",
			defaultVal: 0,
			expected:   -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractMetadataInt(tt.metadata, tt.key, tt.defaultVal)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// parseISO8601ToMillis Tests
// =============================================================================

func TestParseISO8601ToMillis(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expected  int64
		expectErr bool
	}{
		{
			name:      "valid RFC3339 format",
			input:     "2026-01-24T16:00:00Z",
			expected:  time.Date(2026, 1, 24, 16, 0, 0, 0, time.UTC).UnixMilli(),
			expectErr: false,
		},
		{
			name:      "with timezone offset",
			input:     "2026-01-24T21:00:00+05:00",
			expected:  time.Date(2026, 1, 24, 16, 0, 0, 0, time.UTC).UnixMilli(),
			expectErr: false,
		},
		{
			name:      "with fractional seconds",
			input:     "2026-01-24T16:00:00.123Z",
			expected:  time.Date(2026, 1, 24, 16, 0, 0, 123000000, time.UTC).UnixMilli(),
			expectErr: false,
		},
		{
			name:      "empty string returns error",
			input:     "",
			expected:  0,
			expectErr: true,
		},
		{
			name:      "invalid format returns error",
			input:     "not-a-date",
			expected:  0,
			expectErr: true,
		},
		{
			name:      "wrong date format returns error",
			input:     "24/01/2026",
			expected:  0,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseISO8601ToMillis(tt.input)
			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

// =============================================================================
// mapKeygenCustomer Tests
// =============================================================================

func TestMapKeygenCustomer_Success(t *testing.T) {
	metadata := map[string]any{
		"customerId":    "cust_123",
		"customerName":  "John Smith",
		"customerEmail": "john@example.com",
		"companyName":   "ACME Corp",
	}

	customer, err := mapKeygenCustomer(metadata)
	require.NoError(t, err)
	assert.Equal(t, "cust_123", customer.Id)
	assert.Equal(t, "John Smith", customer.Name)
	assert.Equal(t, "john@example.com", customer.Email)
	assert.Equal(t, "ACME Corp", customer.Company)
}

func TestMapKeygenCustomer_EmptyValuesAllowed(t *testing.T) {
	// Empty strings are allowed (not nil, but empty)
	metadata := map[string]any{
		"customerId":    "",
		"customerName":  "",
		"customerEmail": "",
		"companyName":   "",
	}

	customer, err := mapKeygenCustomer(metadata)
	require.NoError(t, err)
	assert.Equal(t, "", customer.Id)
	assert.Equal(t, "", customer.Name)
	assert.Equal(t, "", customer.Email)
	assert.Equal(t, "", customer.Company)
}

func TestMapKeygenCustomer_MissingFields(t *testing.T) {
	tests := []struct {
		name        string
		metadata    map[string]any
		missingKey  string
	}{
		{
			name: "missing customerId",
			metadata: map[string]any{
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
			},
			missingKey: "customerId",
		},
		{
			name: "missing customerName",
			metadata: map[string]any{
				"customerId":    "cust_123",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
			},
			missingKey: "customerName",
		},
		{
			name: "missing customerEmail",
			metadata: map[string]any{
				"customerId":   "cust_123",
				"customerName": "John",
				"companyName":  "ACME",
			},
			missingKey: "customerEmail",
		},
		{
			name: "missing companyName",
			metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
			},
			missingKey: "companyName",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := mapKeygenCustomer(tt.metadata)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.missingKey)
		})
	}
}

// =============================================================================
// mapKeygenFeatures Tests
// =============================================================================

func TestMapKeygenFeatures_DefaultsWhenMissing(t *testing.T) {
	// No features key in metadata
	metadata := map[string]any{
		"customerId": "test",
	}

	features := mapKeygenFeatures(metadata)
	require.NotNil(t, features)
	// Verify defaults are set (non-nil pointers)
	assert.NotNil(t, features.Users)
	assert.NotNil(t, features.LDAP)
	assert.NotNil(t, features.SAML)
	assert.NotNil(t, features.FutureFeatures)
}

func TestMapKeygenFeatures_DefaultsWhenNil(t *testing.T) {
	// features key is explicitly nil
	metadata := map[string]any{
		"features": nil,
	}

	features := mapKeygenFeatures(metadata)
	require.NotNil(t, features)
	assert.NotNil(t, features.Users)
}

func TestMapKeygenFeatures_OverridesSpecificFlags(t *testing.T) {
	metadata := map[string]any{
		"features": map[string]any{
			"users":   float64(500),
			"ldap":    true,
			"saml":    false,
			"cluster": true,
		},
	}

	features := mapKeygenFeatures(metadata)
	require.NotNil(t, features)
	assert.Equal(t, 500, *features.Users)
	assert.True(t, *features.LDAP)
	assert.False(t, *features.SAML)
	assert.True(t, *features.Cluster)
	// Non-overridden fields should have defaults (FutureFeatures=true propagates)
	assert.NotNil(t, features.MFA)
}

func TestMapKeygenFeatures_UsersFieldMapsCorrectly(t *testing.T) {
	tests := []struct {
		name     string
		users    any
		expected int
	}{
		{
			name:     "float64 converts to int",
			users:    float64(1000),
			expected: 1000,
		},
		{
			name:     "zero users",
			users:    float64(0),
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metadata := map[string]any{
				"features": map[string]any{
					"users": tt.users,
				},
			}
			features := mapKeygenFeatures(metadata)
			assert.Equal(t, tt.expected, *features.Users)
		})
	}
}

func TestMapKeygenFeatures_FutureFeaturesPropagatesToDefaults(t *testing.T) {
	// When futureFeatures is explicitly false, SetDefaults will use that for new features
	metadata := map[string]any{
		"features": map[string]any{
			"futureFeatures": false,
		},
	}

	features := mapKeygenFeatures(metadata)
	assert.False(t, *features.FutureFeatures)
	// Note: SetDefaults is called before we override futureFeatures,
	// so the defaults have already propagated. This test verifies the override works.
}

func TestMapKeygenFeatures_AllDefaultsNonNil(t *testing.T) {
	metadata := map[string]any{}

	features := mapKeygenFeatures(metadata)
	require.NotNil(t, features)

	// Verify all pointer fields are non-nil (SetDefaults was called)
	assert.NotNil(t, features.Users, "Users should not be nil")
	assert.NotNil(t, features.LDAP, "LDAP should not be nil")
	assert.NotNil(t, features.LDAPGroups, "LDAPGroups should not be nil")
	assert.NotNil(t, features.MFA, "MFA should not be nil")
	assert.NotNil(t, features.GoogleOAuth, "GoogleOAuth should not be nil")
	assert.NotNil(t, features.Office365OAuth, "Office365OAuth should not be nil")
	assert.NotNil(t, features.OpenId, "OpenId should not be nil")
	assert.NotNil(t, features.Compliance, "Compliance should not be nil")
	assert.NotNil(t, features.Cluster, "Cluster should not be nil")
	assert.NotNil(t, features.Metrics, "Metrics should not be nil")
	assert.NotNil(t, features.MHPNS, "MHPNS should not be nil")
	assert.NotNil(t, features.SAML, "SAML should not be nil")
	assert.NotNil(t, features.Elasticsearch, "Elasticsearch should not be nil")
	assert.NotNil(t, features.Announcement, "Announcement should not be nil")
	assert.NotNil(t, features.ThemeManagement, "ThemeManagement should not be nil")
	assert.NotNil(t, features.EmailNotificationContents, "EmailNotificationContents should not be nil")
	assert.NotNil(t, features.DataRetention, "DataRetention should not be nil")
	assert.NotNil(t, features.MessageExport, "MessageExport should not be nil")
	assert.NotNil(t, features.CustomPermissionsSchemes, "CustomPermissionsSchemes should not be nil")
	assert.NotNil(t, features.CustomTermsOfService, "CustomTermsOfService should not be nil")
	assert.NotNil(t, features.GuestAccounts, "GuestAccounts should not be nil")
	assert.NotNil(t, features.GuestAccountsPermissions, "GuestAccountsPermissions should not be nil")
	assert.NotNil(t, features.IDLoadedPushNotifications, "IDLoadedPushNotifications should not be nil")
	assert.NotNil(t, features.LockTeammateNameDisplay, "LockTeammateNameDisplay should not be nil")
	assert.NotNil(t, features.EnterprisePlugins, "EnterprisePlugins should not be nil")
	assert.NotNil(t, features.AdvancedLogging, "AdvancedLogging should not be nil")
	assert.NotNil(t, features.Cloud, "Cloud should not be nil")
	assert.NotNil(t, features.SharedChannels, "SharedChannels should not be nil")
	assert.NotNil(t, features.RemoteClusterService, "RemoteClusterService should not be nil")
	assert.NotNil(t, features.OutgoingOAuthConnections, "OutgoingOAuthConnections should not be nil")
	assert.NotNil(t, features.FutureFeatures, "FutureFeatures should not be nil")
}

// =============================================================================
// mapKeygenLimits Tests
// =============================================================================

func TestMapKeygenLimits_NilWhenMissing(t *testing.T) {
	metadata := map[string]any{
		"customerId": "test",
	}

	limits := mapKeygenLimits(metadata)
	assert.Nil(t, limits)
}

func TestMapKeygenLimits_MapsAllFields(t *testing.T) {
	metadata := map[string]any{
		"limits": map[string]any{
			"postHistory":         float64(10000),
			"boardCards":          float64(500),
			"playbookRuns":        float64(100),
			"callDurationSeconds": float64(3600),
			"agentsPrompts":       float64(1000),
			"pushNotifications":   float64(50000),
		},
	}

	limits := mapKeygenLimits(metadata)
	require.NotNil(t, limits)
	assert.Equal(t, int64(10000), limits.PostHistory)
	assert.Equal(t, int64(500), limits.BoardCards)
	assert.Equal(t, int64(100), limits.PlaybookRuns)
	assert.Equal(t, int64(3600), limits.CallDurationSeconds)
	assert.Equal(t, int64(1000), limits.AgentsPrompts)
	assert.Equal(t, int64(50000), limits.PushNotifications)
}

func TestMapKeygenLimits_HandlesUnlimitedValues(t *testing.T) {
	// -1 convention for unlimited
	metadata := map[string]any{
		"limits": map[string]any{
			"postHistory":         float64(-1),
			"boardCards":          float64(-1),
			"playbookRuns":        float64(-1),
			"callDurationSeconds": float64(-1),
			"agentsPrompts":       float64(-1),
			"pushNotifications":   float64(-1),
		},
	}

	limits := mapKeygenLimits(metadata)
	require.NotNil(t, limits)
	assert.Equal(t, int64(-1), limits.PostHistory)
	assert.Equal(t, int64(-1), limits.BoardCards)
	assert.Equal(t, int64(-1), limits.PlaybookRuns)
	assert.Equal(t, int64(-1), limits.CallDurationSeconds)
	assert.Equal(t, int64(-1), limits.AgentsPrompts)
	assert.Equal(t, int64(-1), limits.PushNotifications)
}

func TestMapKeygenLimits_Float64ToInt64Conversion(t *testing.T) {
	// Large numbers that need int64 but within float64 precision
	// float64 can precisely represent integers up to 2^53
	metadata := map[string]any{
		"limits": map[string]any{
			"postHistory": float64(9007199254740992), // 2^53 - max precise int in float64
		},
	}

	limits := mapKeygenLimits(metadata)
	require.NotNil(t, limits)
	assert.Equal(t, int64(9007199254740992), limits.PostHistory)
}

// =============================================================================
// validateSKU Tests
// =============================================================================

func TestValidateSKU_ValidSKUs(t *testing.T) {
	validSKUs := []string{
		model.LicenseShortSkuE10,
		model.LicenseShortSkuE20,
		model.LicenseShortSkuProfessional,
		model.LicenseShortSkuEnterprise,
		model.LicenseShortSkuEnterpriseAdvanced,
		model.LicenseShortSkuMattermostEntry,
	}

	for _, sku := range validSKUs {
		t.Run(sku, func(t *testing.T) {
			err := validateSKU(sku)
			assert.NoError(t, err)
		})
	}
}

func TestValidateSKU_InvalidSKUs(t *testing.T) {
	tests := []struct {
		name string
		sku  string
	}{
		{"empty string", ""},
		{"unknown SKU", "unknown"},
		{"case sensitive - uppercase ENTERPRISE", "ENTERPRISE"},
		{"case sensitive - uppercase E10", "e10"},
		{"typo", "enterprize"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSKU(tt.sku)
			require.Error(t, err)
			assert.True(t, errors.Is(err, ErrKeygenInvalidSKU))
		})
	}
}

// =============================================================================
// ConvertKeygenToModelLicense Tests
// =============================================================================

func TestConvertKeygenToModelLicense_HappyPath(t *testing.T) {
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "f5a618af-7076-407c-93bc-495caafa65c2",
		Issued: time.Date(2026, 1, 24, 16, 0, 0, 0, time.UTC),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "John Smith",
			"customerEmail": "john@example.com",
			"companyName":   "ACME Corp",
			"skuName":       "Mattermost Enterprise",
			"skuShortName":  "enterprise",
			"isTrial":       false,
			"isGovSku":      false,
			"features": map[string]any{
				"users": float64(500),
				"ldap":  true,
				"saml":  true,
			},
		},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)
	require.NotNil(t, license)

	// Verify all fields
	assert.Equal(t, "f5a618af-7076-407c-93bc-495caafa65c2", license.Id)
	assert.Equal(t, data.Issued.UnixMilli(), license.IssuedAt)
	assert.Equal(t, data.Issued.UnixMilli(), license.StartsAt) // defaults to IssuedAt
	assert.Equal(t, expiry.UnixMilli(), license.ExpiresAt)

	// Customer
	require.NotNil(t, license.Customer)
	assert.Equal(t, "cust_123", license.Customer.Id)
	assert.Equal(t, "John Smith", license.Customer.Name)
	assert.Equal(t, "john@example.com", license.Customer.Email)
	assert.Equal(t, "ACME Corp", license.Customer.Company)

	// SKU
	assert.Equal(t, "Mattermost Enterprise", license.SkuName)
	assert.Equal(t, "enterprise", license.SkuShortName)

	// Flags
	assert.False(t, license.IsTrial)
	assert.False(t, license.IsGovSku)
	assert.False(t, license.IsSeatCountEnforced)

	// Features
	require.NotNil(t, license.Features)
	assert.Equal(t, 500, *license.Features.Users)
	assert.True(t, *license.Features.LDAP)
	assert.True(t, *license.Features.SAML)
}

func TestConvertKeygenToModelLicense_ErrorCases(t *testing.T) {
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	validMetadata := map[string]any{
		"customerId":    "cust_123",
		"customerName":  "John Smith",
		"customerEmail": "john@example.com",
		"companyName":   "ACME Corp",
		"skuName":       "Mattermost Enterprise",
		"skuShortName":  "enterprise",
	}

	tests := []struct {
		name        string
		data        *KeygenLicenseData
		errContains string
	}{
		{
			name:        "nil data",
			data:        nil,
			errContains: "nil",
		},
		{
			name: "nil metadata",
			data: &KeygenLicenseData{
				ID:       "test",
				Issued:   time.Now(),
				Expiry:   &expiry,
				Metadata: nil,
			},
			errContains: "metadata is nil",
		},
		{
			name: "nil expiry",
			data: &KeygenLicenseData{
				ID:       "test",
				Issued:   time.Now(),
				Expiry:   nil,
				Metadata: validMetadata,
			},
			errContains: "expiry is nil",
		},
		{
			name: "missing skuName",
			data: &KeygenLicenseData{
				ID:     "test",
				Issued: time.Now(),
				Expiry: &expiry,
				Metadata: map[string]any{
					"customerId":    "cust_123",
					"customerName":  "John",
					"customerEmail": "john@example.com",
					"companyName":   "ACME",
					"skuShortName":  "enterprise",
				},
			},
			errContains: "skuName",
		},
		{
			name: "missing skuShortName",
			data: &KeygenLicenseData{
				ID:     "test",
				Issued: time.Now(),
				Expiry: &expiry,
				Metadata: map[string]any{
					"customerId":    "cust_123",
					"customerName":  "John",
					"customerEmail": "john@example.com",
					"companyName":   "ACME",
					"skuName":       "Mattermost Enterprise",
				},
			},
			errContains: "skuShortName",
		},
		{
			name: "invalid SKU",
			data: &KeygenLicenseData{
				ID:     "test",
				Issued: time.Now(),
				Expiry: &expiry,
				Metadata: map[string]any{
					"customerId":    "cust_123",
					"customerName":  "John",
					"customerEmail": "john@example.com",
					"companyName":   "ACME",
					"skuName":       "Invalid SKU",
					"skuShortName":  "invalid",
				},
			},
			errContains: "invalid SKU",
		},
		{
			name: "missing customerId",
			data: &KeygenLicenseData{
				ID:     "test",
				Issued: time.Now(),
				Expiry: &expiry,
				Metadata: map[string]any{
					"customerName":  "John",
					"customerEmail": "john@example.com",
					"companyName":   "ACME",
					"skuName":       "Mattermost Enterprise",
					"skuShortName":  "enterprise",
				},
			},
			errContains: "customerId",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ConvertKeygenToModelLicense(tt.data)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.errContains)
		})
	}
}

func TestConvertKeygenToModelLicense_OptionalFields(t *testing.T) {
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)

	t.Run("ExtraUsers maps when present", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
				"extraUsers":    float64(10),
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		require.NotNil(t, license.ExtraUsers)
		assert.Equal(t, 10, *license.ExtraUsers)
	})

	t.Run("ExtraUsers is nil when absent", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.Nil(t, license.ExtraUsers)
	})

	t.Run("SignupJWT maps when present", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
				"signupJwt":     "jwt-token-here",
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		require.NotNil(t, license.SignupJWT)
		assert.Equal(t, "jwt-token-here", *license.SignupJWT)
	})

	t.Run("SignupJWT is nil when absent", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.Nil(t, license.SignupJWT)
	})

	t.Run("limits maps when present", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
				"limits": map[string]any{
					"postHistory": float64(10000),
				},
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		require.NotNil(t, license.Limits)
		assert.Equal(t, int64(10000), license.Limits.PostHistory)
	})

	t.Run("limits is nil when absent", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.Nil(t, license.Limits)
	})

	t.Run("IsTrial defaults to false when absent", func(t *testing.T) {
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Now(),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.False(t, license.IsTrial)
	})

	t.Run("startsAt override when present in metadata", func(t *testing.T) {
		startsAt := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
		data := &KeygenLicenseData{
			ID:     "test",
			Issued: time.Date(2026, 1, 24, 16, 0, 0, 0, time.UTC),
			Expiry: &expiry,
			Metadata: map[string]any{
				"customerId":    "cust_123",
				"customerName":  "John",
				"customerEmail": "john@example.com",
				"companyName":   "ACME",
				"skuName":       "Enterprise",
				"skuShortName":  "enterprise",
				"startsAt":      "2026-02-01T00:00:00Z",
			},
		}
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.Equal(t, startsAt.UnixMilli(), license.StartsAt)
		// IssuedAt should still be the original
		assert.Equal(t, time.Date(2026, 1, 24, 16, 0, 0, 0, time.UTC).UnixMilli(), license.IssuedAt)
	})
}

func TestConvertKeygenToModelLicense_MinimalValidMetadata(t *testing.T) {
	// Only required fields
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_123",
			"customerName":  "John",
			"customerEmail": "john@example.com",
			"companyName":   "ACME",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
		},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)
	require.NotNil(t, license)

	// Verify defaults applied
	assert.False(t, license.IsTrial)
	assert.False(t, license.IsGovSku)
	assert.False(t, license.IsSeatCountEnforced)
	assert.Nil(t, license.ExtraUsers)
	assert.Nil(t, license.SignupJWT)
	assert.Nil(t, license.Limits)
	assert.NotNil(t, license.Features)
}

func TestConvertKeygenToModelLicense_AllOptionalFieldsPopulated(t *testing.T) {
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "full-test",
		Issued: time.Date(2026, 1, 24, 16, 0, 0, 0, time.UTC),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":          "cust_full",
			"customerName":        "Full Test",
			"customerEmail":       "full@test.com",
			"companyName":         "Full Test Corp",
			"skuName":             "Mattermost Enterprise Advanced",
			"skuShortName":        "advanced",
			"isTrial":             true,
			"isGovSku":            true,
			"isSeatCountEnforced": true,
			"extraUsers":          float64(25),
			"signupJwt":           "full-jwt-token",
			"startsAt":            "2026-02-01T00:00:00Z",
			"features": map[string]any{
				"users":         float64(1000),
				"ldap":          true,
				"saml":          true,
				"cluster":       true,
				"futureFeatures": false,
			},
			"limits": map[string]any{
				"postHistory":         float64(-1),
				"boardCards":          float64(-1),
				"playbookRuns":        float64(100),
				"callDurationSeconds": float64(7200),
				"agentsPrompts":       float64(5000),
				"pushNotifications":   float64(-1),
			},
		},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)
	require.NotNil(t, license)

	// Verify all populated
	assert.Equal(t, "full-test", license.Id)
	assert.True(t, license.IsTrial)
	assert.True(t, license.IsGovSku)
	assert.True(t, license.IsSeatCountEnforced)
	require.NotNil(t, license.ExtraUsers)
	assert.Equal(t, 25, *license.ExtraUsers)
	require.NotNil(t, license.SignupJWT)
	assert.Equal(t, "full-jwt-token", *license.SignupJWT)

	// Features
	assert.Equal(t, 1000, *license.Features.Users)
	assert.True(t, *license.Features.LDAP)
	assert.True(t, *license.Features.SAML)
	assert.True(t, *license.Features.Cluster)
	assert.False(t, *license.Features.FutureFeatures)

	// Limits
	require.NotNil(t, license.Limits)
	assert.Equal(t, int64(-1), license.Limits.PostHistory)
	assert.Equal(t, int64(100), license.Limits.PlaybookRuns)
	assert.Equal(t, int64(5000), license.Limits.AgentsPrompts)
}

// =============================================================================
// CORE-05 Equivalence Tests
// =============================================================================

func TestKeygenProducesEquivalentLicense(t *testing.T) {
	// Create a "golden" license that represents what legacy would produce
	goldenLicense := &model.License{
		Id:           "test-id",
		IssuedAt:     time.Date(2024, 1, 24, 16, 0, 0, 0, time.UTC).UnixMilli(),
		StartsAt:     time.Date(2024, 1, 24, 16, 0, 0, 0, time.UTC).UnixMilli(),
		ExpiresAt:    time.Date(2025, 1, 24, 0, 0, 0, 0, time.UTC).UnixMilli(),
		Customer: &model.Customer{
			Id:      "cust_enterprise_001",
			Name:    "Enterprise Admin",
			Email:   "admin@enterprise.com",
			Company: "Enterprise Corp",
		},
		Features:     &model.Features{},
		SkuName:      "Mattermost Enterprise",
		SkuShortName: model.LicenseShortSkuEnterprise,
		IsTrial:      false,
	}
	goldenLicense.Features.SetDefaults()
	goldenLicense.Features.Users = model.NewPointer(1000)
	goldenLicense.Features.LDAP = model.NewPointer(true)
	goldenLicense.Features.SAML = model.NewPointer(true)
	goldenLicense.Features.Cluster = model.NewPointer(true)

	// Create equivalent Keygen license data
	expiry := time.Date(2025, 1, 24, 0, 0, 0, 0, time.UTC)
	keygenData := &KeygenLicenseData{
		ID:     "test-id",
		Issued: time.Date(2024, 1, 24, 16, 0, 0, 0, time.UTC),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust_enterprise_001",
			"customerName":  "Enterprise Admin",
			"customerEmail": "admin@enterprise.com",
			"companyName":   "Enterprise Corp",
			"skuName":       "Mattermost Enterprise",
			"skuShortName":  "enterprise",
			"isTrial":       false,
			"features": map[string]any{
				"users":   float64(1000),
				"ldap":    true,
				"saml":    true,
				"cluster": true,
			},
		},
	}

	// Convert Keygen data
	keygenLicense, err := ConvertKeygenToModelLicense(keygenData)
	require.NoError(t, err)

	// Compare critical fields for equivalence
	assert.Equal(t, goldenLicense.Id, keygenLicense.Id, "Id should match")
	assert.Equal(t, goldenLicense.IssuedAt, keygenLicense.IssuedAt, "IssuedAt should match")
	assert.Equal(t, goldenLicense.StartsAt, keygenLicense.StartsAt, "StartsAt should match")
	assert.Equal(t, goldenLicense.ExpiresAt, keygenLicense.ExpiresAt, "ExpiresAt should match")

	// Customer equivalence
	require.NotNil(t, keygenLicense.Customer)
	assert.Equal(t, goldenLicense.Customer.Id, keygenLicense.Customer.Id, "Customer.Id should match")
	assert.Equal(t, goldenLicense.Customer.Name, keygenLicense.Customer.Name, "Customer.Name should match")
	assert.Equal(t, goldenLicense.Customer.Email, keygenLicense.Customer.Email, "Customer.Email should match")
	assert.Equal(t, goldenLicense.Customer.Company, keygenLicense.Customer.Company, "Customer.Company should match")

	// SKU equivalence
	assert.Equal(t, goldenLicense.SkuName, keygenLicense.SkuName, "SkuName should match")
	assert.Equal(t, goldenLicense.SkuShortName, keygenLicense.SkuShortName, "SkuShortName should match")

	// Feature equivalence (key features)
	require.NotNil(t, keygenLicense.Features)
	assert.Equal(t, *goldenLicense.Features.Users, *keygenLicense.Features.Users, "Features.Users should match")
	assert.Equal(t, *goldenLicense.Features.LDAP, *keygenLicense.Features.LDAP, "Features.LDAP should match")
	assert.Equal(t, *goldenLicense.Features.SAML, *keygenLicense.Features.SAML, "Features.SAML should match")
	assert.Equal(t, *goldenLicense.Features.Cluster, *keygenLicense.Features.Cluster, "Features.Cluster should match")

	// Behavior equivalence
	assert.Equal(t, goldenLicense.IsTrial, keygenLicense.IsTrial, "IsTrial should match")
	assert.Equal(t, goldenLicense.IsTrialLicense(), keygenLicense.IsTrialLicense(), "IsTrialLicense() should match")
	// Note: IsExpired() depends on current time, so we compare ExpiresAt instead
	assert.Equal(t, goldenLicense.ExpiresAt, keygenLicense.ExpiresAt, "ExpiresAt should match (for expiration behavior)")
}

func TestKeygenProducesEquivalentTrialLicense(t *testing.T) {
	// Test that trial licenses produce equivalent behavior
	expiry := time.Date(2025, 2, 23, 16, 0, 0, 0, time.UTC) // 30 days from start
	keygenData := &KeygenLicenseData{
		ID:     "trial-test",
		Issued: time.Date(2025, 1, 24, 16, 0, 0, 0, time.UTC),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "trial_cust",
			"customerName":  "Trial User",
			"customerEmail": "trial@test.com",
			"companyName":   "Trial Corp",
			"skuName":       "Mattermost Enterprise Trial",
			"skuShortName":  "enterprise",
			"isTrial":       true,
		},
	}

	license, err := ConvertKeygenToModelLicense(keygenData)
	require.NoError(t, err)

	// Verify trial behavior
	assert.True(t, license.IsTrial, "IsTrial flag should be true")
	assert.True(t, license.IsTrialLicense(), "IsTrialLicense() should return true for trial")
}

func TestKeygenFeaturesOverrideOrder(t *testing.T) {
	// Verify that SetDefaults is called first, then explicit values override
	expiry := time.Date(2027, 1, 24, 0, 0, 0, 0, time.UTC)
	data := &KeygenLicenseData{
		ID:     "test",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "cust",
			"customerName":  "Name",
			"customerEmail": "email@test.com",
			"companyName":   "Company",
			"skuName":       "Enterprise",
			"skuShortName":  "enterprise",
			"features": map[string]any{
				// Only override a few features - others should get defaults
				"ldap":  false,
				"users": float64(100),
			},
		},
	}

	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Overridden values
	assert.False(t, *license.Features.LDAP, "LDAP should be overridden to false")
	assert.Equal(t, 100, *license.Features.Users, "Users should be overridden to 100")

	// Default values (FutureFeatures defaults to true, which propagates)
	assert.True(t, *license.Features.SAML, "SAML should have default value (true from FutureFeatures)")
	assert.True(t, *license.Features.Cluster, "Cluster should have default value")
	assert.True(t, *license.Features.FutureFeatures, "FutureFeatures should default to true")
}
