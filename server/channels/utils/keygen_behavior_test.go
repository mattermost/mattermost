// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Test Helpers
// =============================================================================

// createTestKeygenData creates KeygenLicenseData with configurable parameters
func createTestKeygenData(opts ...func(*KeygenLicenseData)) *KeygenLicenseData {
	expiry := time.Now().Add(365 * 24 * time.Hour) // 1 year default
	data := &KeygenLicenseData{
		ID:     "test-license-id",
		Issued: time.Now(),
		Expiry: &expiry,
		Metadata: map[string]any{
			"customerId":    "test-customer",
			"customerName":  "Test User",
			"customerEmail": "test@example.com",
			"companyName":   "Test Corp",
			"skuName":       "Mattermost Enterprise",
			"skuShortName":  "enterprise",
		},
	}
	for _, opt := range opts {
		opt(data)
	}
	return data
}

// withTrial returns an option that sets the trial flag
func withTrial(isTrial bool) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		data.Metadata["isTrial"] = isTrial
	}
}

// withExpiry returns an option that sets the expiry time
func withExpiry(expiry time.Time) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		data.Expiry = &expiry
	}
}

// withIssued returns an option that sets the issued time
func withIssued(issued time.Time) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		data.Issued = issued
	}
}

// withStartsAt returns an option that sets the startsAt override
func withStartsAt(startsAt time.Time) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		data.Metadata["startsAt"] = startsAt.Format(time.RFC3339)
	}
}

// withSeatCount returns an option that sets the user seat count
func withSeatCount(users int) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		if data.Metadata["features"] == nil {
			data.Metadata["features"] = map[string]any{}
		}
		data.Metadata["features"].(map[string]any)["users"] = float64(users)
	}
}

// withSeatEnforcement returns an option that sets seat enforcement
func withSeatEnforcement(enforced bool) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		data.Metadata["isSeatCountEnforced"] = enforced
	}
}

// withExtraUsers returns an option that sets extra users allowance
func withExtraUsers(extra int) func(*KeygenLicenseData) {
	return func(data *KeygenLicenseData) {
		data.Metadata["extraUsers"] = float64(extra)
	}
}

// =============================================================================
// SEAT LIMIT TESTS (SEAT-01 through SEAT-04)
// =============================================================================

// TestKeygenLicense_SeatCountMapping verifies SEAT-01: Read seat count from Keygen license
func TestKeygenLicense_SeatCountMapping(t *testing.T) {
	tests := []struct {
		name     string
		users    int
		expected int
	}{
		{
			name:     "maps 100 users correctly",
			users:    100,
			expected: 100,
		},
		{
			name:     "maps 500 users correctly",
			users:    500,
			expected: 500,
		},
		{
			name:     "maps 10000 users correctly",
			users:    10000,
			expected: 10000,
		},
		{
			name:     "maps 0 users (minimal)",
			users:    0,
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := createTestKeygenData(withSeatCount(tt.users))
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)
			require.NotNil(t, license.Features)
			require.NotNil(t, license.Features.Users)
			assert.Equal(t, tt.expected, *license.Features.Users,
				"Features.Users should be %d", tt.expected)
		})
	}

	t.Run("defaults when features.users is missing", func(t *testing.T) {
		data := createTestKeygenData() // No seat count specified
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		require.NotNil(t, license.Features)
		require.NotNil(t, license.Features.Users)
		// SetDefaults sets Users to 0 by default
		assert.Equal(t, 0, *license.Features.Users)
	})
}

// TestKeygenLicense_SeatEnforcement verifies SEAT-02: Enforce loose seat limits (quarterly true-up)
func TestKeygenLicense_SeatEnforcement(t *testing.T) {
	tests := []struct {
		name     string
		enforced bool
		expected bool
	}{
		{
			name:     "enforcement enabled",
			enforced: true,
			expected: true,
		},
		{
			name:     "enforcement disabled (loose limits)",
			enforced: false,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := createTestKeygenData(
				withSeatCount(100),
				withSeatEnforcement(tt.enforced),
			)
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, license.IsSeatCountEnforced,
				"IsSeatCountEnforced should be %v", tt.expected)
		})
	}

	t.Run("defaults to false when missing (loose limits by default)", func(t *testing.T) {
		data := createTestKeygenData(withSeatCount(100))
		// Not setting isSeatCountEnforced
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.False(t, license.IsSeatCountEnforced,
			"IsSeatCountEnforced should default to false for loose limits")
	})
}

// TestKeygenLicense_ExtraUsers verifies SEAT-03: ExtraUsers grace mechanism preserved
func TestKeygenLicense_ExtraUsers(t *testing.T) {
	tests := []struct {
		name       string
		extraUsers int
		expectNil  bool
		expected   int
	}{
		{
			name:       "10 extra users",
			extraUsers: 10,
			expectNil:  false,
			expected:   10,
		},
		{
			name:       "25 extra users",
			extraUsers: 25,
			expectNil:  false,
			expected:   25,
		},
		{
			name:       "0 extra users (explicitly set)",
			extraUsers: 0,
			expectNil:  false,
			expected:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := createTestKeygenData(withExtraUsers(tt.extraUsers))
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)

			if tt.expectNil {
				assert.Nil(t, license.ExtraUsers, "ExtraUsers should be nil")
			} else {
				require.NotNil(t, license.ExtraUsers, "ExtraUsers should not be nil")
				assert.Equal(t, tt.expected, *license.ExtraUsers,
					"ExtraUsers should be %d", tt.expected)
			}
		})
	}

	t.Run("nil when missing (not configured)", func(t *testing.T) {
		data := createTestKeygenData() // No extraUsers specified
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)
		assert.Nil(t, license.ExtraUsers,
			"ExtraUsers should be nil when not specified in metadata")
	})
}

// TestKeygenLicense_IsSeatCountEnforced verifies SEAT-04: IsSeatCountEnforced flag behavior preserved
func TestKeygenLicense_IsSeatCountEnforced(t *testing.T) {
	t.Run("enforcement flag propagates for limits logic", func(t *testing.T) {
		// Create license with enforcement enabled
		data := createTestKeygenData(
			withSeatCount(100),
			withSeatEnforcement(true),
			withExtraUsers(10),
		)
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify all seat-related fields are populated correctly
		assert.True(t, license.IsSeatCountEnforced, "IsSeatCountEnforced should be true")
		require.NotNil(t, license.Features)
		require.NotNil(t, license.Features.Users)
		assert.Equal(t, 100, *license.Features.Users, "Features.Users should be 100")
		require.NotNil(t, license.ExtraUsers)
		assert.Equal(t, 10, *license.ExtraUsers, "ExtraUsers should be 10")

		// The limits logic in app/limits.go would calculate:
		// MaxUsersLimit = 100 (Features.Users)
		// MaxUsersHardLimit = 110 (Features.Users + ExtraUsers)
	})

	t.Run("enforcement disabled means no limits apply", func(t *testing.T) {
		data := createTestKeygenData(
			withSeatCount(100),
			withSeatEnforcement(false),
		)
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Even with seat count set, enforcement is off
		assert.False(t, license.IsSeatCountEnforced,
			"IsSeatCountEnforced should be false")
		// When IsSeatCountEnforced=false, limits.go won't apply any limits
	})
}

// TestKeygenLicense_SeatLimitIntegration verifies the complete seat enforcement configuration
func TestKeygenLicense_SeatLimitIntegration(t *testing.T) {
	// Create license with 100 users, 10 extra, enforcement enabled
	data := createTestKeygenData(
		withSeatCount(100),
		withSeatEnforcement(true),
		withExtraUsers(10),
	)
	license, err := ConvertKeygenToModelLicense(data)
	require.NoError(t, err)

	// Verify the license is properly configured for limits.go consumption
	// limits.go logic:
	// if license != nil && license.IsSeatCountEnforced && license.Features != nil && license.Features.Users != nil {
	//     licenseUserLimit := int64(*license.Features.Users)  // 100
	//     limits.MaxUsersLimit = licenseUserLimit
	//     extraUsers := 0
	//     if license.ExtraUsers != nil {
	//         extraUsers = *license.ExtraUsers  // 10
	//     }
	//     limits.MaxUsersHardLimit = licenseUserLimit + int64(extraUsers)  // 110
	// }

	assert.True(t, license.IsSeatCountEnforced, "IsSeatCountEnforced must be true")
	require.NotNil(t, license.Features, "Features must not be nil")
	require.NotNil(t, license.Features.Users, "Features.Users must not be nil")
	require.NotNil(t, license.ExtraUsers, "ExtraUsers must not be nil")

	// Calculate what limits.go would compute
	maxUsersLimit := int64(*license.Features.Users)
	maxUsersHardLimit := maxUsersLimit + int64(*license.ExtraUsers)

	assert.Equal(t, int64(100), maxUsersLimit, "MaxUsersLimit should be 100")
	assert.Equal(t, int64(110), maxUsersHardLimit, "MaxUsersHardLimit should be 110")
}

// =============================================================================
// EXPIRATION TESTS (EXP-01 through EXP-05)
// =============================================================================

// TestKeygenLicense_ExpirationMapping verifies EXP-01: Read expiration from Keygen license
func TestKeygenLicense_ExpirationMapping(t *testing.T) {
	tests := []struct {
		name   string
		expiry time.Time
	}{
		{
			name:   "future expiry (1 year)",
			expiry: time.Now().Add(365 * 24 * time.Hour),
		},
		{
			name:   "near future expiry (1 day)",
			expiry: time.Now().Add(24 * time.Hour),
		},
		{
			name:   "past expiry (1 day ago)",
			expiry: time.Now().Add(-24 * time.Hour),
		},
		{
			name:   "specific date",
			expiry: time.Date(2027, 6, 15, 12, 30, 45, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data := createTestKeygenData(withExpiry(tt.expiry))
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)

			// Verify millisecond precision
			expectedMillis := tt.expiry.UnixMilli()
			assert.Equal(t, expectedMillis, license.ExpiresAt,
				"ExpiresAt should match expiry in milliseconds")
		})
	}
}

// TestKeygenLicense_IsExpired verifies EXP-02: IsExpired() returns correct values
func TestKeygenLicense_IsExpired(t *testing.T) {
	tests := []struct {
		name           string
		expiryOffset   time.Duration
		expectedResult bool
	}{
		{
			name:           "expired 1 second ago",
			expiryOffset:   -1 * time.Second,
			expectedResult: true,
		},
		{
			name:           "expires in 1 second",
			expiryOffset:   1 * time.Second,
			expectedResult: false,
		},
		{
			name:           "expired 1 day ago",
			expiryOffset:   -24 * time.Hour,
			expectedResult: true,
		},
		{
			name:           "expires in 1 year",
			expiryOffset:   365 * 24 * time.Hour,
			expectedResult: false,
		},
		{
			name:           "expired 30 days ago",
			expiryOffset:   -30 * 24 * time.Hour,
			expectedResult: true,
		},
		{
			name:           "expires in 30 days",
			expiryOffset:   30 * 24 * time.Hour,
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expiry := time.Now().Add(tt.expiryOffset)
			data := createTestKeygenData(withExpiry(expiry))
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)

			result := license.IsExpired()
			assert.Equal(t, tt.expectedResult, result,
				"IsExpired() should return %v for license %s", tt.expectedResult, tt.name)
		})
	}
}

// TestKeygenLicense_GracePeriod verifies EXP-03: Grace period is 10 days after expiration
func TestKeygenLicense_GracePeriod(t *testing.T) {
	// LicenseGracePeriod = 10 days in milliseconds
	// IsPastGracePeriod returns true when (current - ExpiresAt) > LicenseGracePeriod

	tests := []struct {
		name           string
		daysExpired    int
		expectedResult bool
	}{
		{
			name:           "expired 5 days ago - within grace period",
			daysExpired:    5,
			expectedResult: false,
		},
		{
			name:           "expired 9 days ago - still within grace period",
			daysExpired:    9,
			expectedResult: false,
		},
		{
			name:           "expired 11 days ago - past grace period",
			daysExpired:    11,
			expectedResult: true,
		},
		{
			name:           "expired 30 days ago - well past grace period",
			daysExpired:    30,
			expectedResult: true,
		},
		{
			name:           "not expired (future) - not past grace period",
			daysExpired:    -5, // Negative means future
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expiry := time.Now().Add(-time.Duration(tt.daysExpired) * 24 * time.Hour)
			data := createTestKeygenData(withExpiry(expiry))
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)

			result := license.IsPastGracePeriod()
			assert.Equal(t, tt.expectedResult, result,
				"IsPastGracePeriod() should return %v when expired %d days ago", tt.expectedResult, tt.daysExpired)
		})
	}
}

// TestKeygenLicense_IsPastGracePeriod verifies EXP-04: Boundary conditions for grace period
func TestKeygenLicense_IsPastGracePeriod(t *testing.T) {
	// Test boundary conditions at exactly 10 days
	// IsPastGracePeriod uses > not >=, so exactly 10 days should return false

	t.Run("exactly 10 days ago (boundary) - should be false", func(t *testing.T) {
		// Exactly at the boundary - should still be within grace
		expiry := time.Now().Add(-10 * 24 * time.Hour)
		data := createTestKeygenData(withExpiry(expiry))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// At exactly 10 days, timeDiff == LicenseGracePeriod, so > returns false
		result := license.IsPastGracePeriod()
		assert.False(t, result,
			"IsPastGracePeriod() should return false at exactly 10 days (boundary)")
	})

	t.Run("10 days + 1 second ago - should be true", func(t *testing.T) {
		// Just past the boundary
		expiry := time.Now().Add(-10*24*time.Hour - 1*time.Second)
		data := createTestKeygenData(withExpiry(expiry))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		result := license.IsPastGracePeriod()
		assert.True(t, result,
			"IsPastGracePeriod() should return true at 10 days + 1 second")
	})

	t.Run("10 days - 1 second ago - should be false", func(t *testing.T) {
		// Just before the boundary
		expiry := time.Now().Add(-10*24*time.Hour + 1*time.Second)
		data := createTestKeygenData(withExpiry(expiry))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		result := license.IsPastGracePeriod()
		assert.False(t, result,
			"IsPastGracePeriod() should return false at 10 days - 1 second")
	})

	t.Run("combined with IsExpired check", func(t *testing.T) {
		// License expired 5 days ago - expired but within grace
		expiry := time.Now().Add(-5 * 24 * time.Hour)
		data := createTestKeygenData(withExpiry(expiry))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.True(t, license.IsExpired(), "License should be expired")
		assert.False(t, license.IsPastGracePeriod(), "License should be within grace period")

		// License expired 15 days ago - expired and past grace
		expiry2 := time.Now().Add(-15 * 24 * time.Hour)
		data2 := createTestKeygenData(withExpiry(expiry2))
		license2, err := ConvertKeygenToModelLicense(data2)
		require.NoError(t, err)

		assert.True(t, license2.IsExpired(), "License should be expired")
		assert.True(t, license2.IsPastGracePeriod(), "License should be past grace period")
	})
}

// TestKeygenLicense_ExpirationWarnings verifies EXP-05: Expiration warnings at 60-58 days
func TestKeygenLicense_ExpirationWarnings(t *testing.T) {
	// IsWithinExpirationPeriod returns true when days to expiration is between 58 and 60

	tests := []struct {
		name           string
		daysToExpiry   int
		expectedResult bool
	}{
		{
			name:           "60 days to expiry - in warning window",
			daysToExpiry:   60,
			expectedResult: true,
		},
		{
			name:           "59 days to expiry - in warning window",
			daysToExpiry:   59,
			expectedResult: true,
		},
		{
			name:           "58 days to expiry - in warning window",
			daysToExpiry:   58,
			expectedResult: true,
		},
		{
			name:           "57 days to expiry - outside warning window",
			daysToExpiry:   57,
			expectedResult: false,
		},
		{
			name:           "61 days to expiry - outside warning window",
			daysToExpiry:   61,
			expectedResult: false,
		},
		{
			name:           "90 days to expiry - well outside warning window",
			daysToExpiry:   90,
			expectedResult: false,
		},
		{
			name:           "30 days to expiry - outside warning window",
			daysToExpiry:   30,
			expectedResult: false,
		},
		{
			name:           "1 day to expiry - outside warning window",
			daysToExpiry:   1,
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expiry := time.Now().Add(time.Duration(tt.daysToExpiry) * 24 * time.Hour)
			data := createTestKeygenData(withExpiry(expiry))
			license, err := ConvertKeygenToModelLicense(data)
			require.NoError(t, err)

			result := license.IsWithinExpirationPeriod()
			assert.Equal(t, tt.expectedResult, result,
				"IsWithinExpirationPeriod() should return %v when %d days to expiry",
				tt.expectedResult, tt.daysToExpiry)
		})
	}
}

// =============================================================================
// TRIAL LICENSE TESTS (TRIAL-01 through TRIAL-04)
// =============================================================================

// Trial duration values matching model/license.go (computed as variables since Milliseconds() isn't constant)
var (
	// trialDuration = 30 days + 8 hours
	trialDurationMillis = (30*24*time.Hour + 8*time.Hour).Milliseconds()
	// adminTrialDuration = 30 days + 23:59:59
	adminTrialDurationMillis = (30*24*time.Hour + 23*time.Hour + 59*time.Minute + 59*time.Second).Milliseconds()
)

// TestKeygenLicense_TrialRecognition verifies TRIAL-01: Trial licenses recognized via isTrial flag
func TestKeygenLicense_TrialRecognition(t *testing.T) {
	t.Run("isTrial: true is recognized as trial", func(t *testing.T) {
		data := createTestKeygenData(withTrial(true))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.True(t, license.IsTrial, "IsTrial flag should be true")
	})

	t.Run("isTrial: false is NOT recognized as trial", func(t *testing.T) {
		data := createTestKeygenData(withTrial(false))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.False(t, license.IsTrial, "IsTrial flag should be false")
	})

	t.Run("missing isTrial defaults to false", func(t *testing.T) {
		data := createTestKeygenData() // No trial flag set
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.False(t, license.IsTrial, "IsTrial should default to false when missing")
	})
}

// TestKeygenLicense_IsTrialLicense verifies TRIAL-02: IsTrialLicense() method works correctly
func TestKeygenLicense_IsTrialLicense(t *testing.T) {
	t.Run("returns true when isTrial flag is true", func(t *testing.T) {
		data := createTestKeygenData(withTrial(true))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.True(t, license.IsTrialLicense(),
			"IsTrialLicense() should return true when IsTrial=true")
	})

	t.Run("returns false when isTrial flag is false and duration doesn't match", func(t *testing.T) {
		data := createTestKeygenData(withTrial(false))
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Default expiry is 1 year, which doesn't match trial duration
		assert.False(t, license.IsTrialLicense(),
			"IsTrialLicense() should return false for non-trial duration")
	})

	t.Run("returns true for exact 30-day + 8-hour duration (standard trial)", func(t *testing.T) {
		// Create a license with exact trial duration without the flag
		startsAt := time.Now()
		expiresAt := startsAt.Add(30*24*time.Hour + 8*time.Hour) // Exactly trial duration

		data := createTestKeygenData(
			withTrial(false),
			withIssued(startsAt),
			withExpiry(expiresAt),
		)
		// Don't set startsAt override - let it default to Issued
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify duration matches
		duration := license.ExpiresAt - license.StartsAt
		assert.Equal(t, trialDurationMillis, duration,
			"Duration should match trial duration")
		assert.True(t, license.IsTrialLicense(),
			"IsTrialLicense() should return true for exact trial duration")
	})

	t.Run("returns true for exact 30-day + 23:59:59 duration (admin trial)", func(t *testing.T) {
		// Create a license with exact admin trial duration
		startsAt := time.Now()
		expiresAt := startsAt.Add(30*24*time.Hour + 23*time.Hour + 59*time.Minute + 59*time.Second)

		data := createTestKeygenData(
			withTrial(false),
			withIssued(startsAt),
			withExpiry(expiresAt),
		)
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify duration matches
		duration := license.ExpiresAt - license.StartsAt
		assert.Equal(t, adminTrialDurationMillis, duration,
			"Duration should match admin trial duration")
		assert.True(t, license.IsTrialLicense(),
			"IsTrialLicense() should return true for admin trial duration")
	})
}

// TestKeygenLicense_TrialDuration verifies TRIAL-03: Trial duration is 30 days
func TestKeygenLicense_TrialDuration(t *testing.T) {
	t.Run("standard trial with 30-day duration", func(t *testing.T) {
		// Create trial license with proper duration
		startsAt := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		expiresAt := startsAt.Add(30*24*time.Hour + 8*time.Hour) // Standard trial duration

		data := createTestKeygenData(
			withTrial(true),
			withIssued(startsAt),
			withExpiry(expiresAt),
		)
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify StartsAt and ExpiresAt difference equals trial duration
		duration := license.ExpiresAt - license.StartsAt
		expectedDuration := int64((30*24*time.Hour + 8*time.Hour).Milliseconds())
		assert.Equal(t, expectedDuration, duration,
			"Trial duration should be 30 days + 8 hours")
	})

	t.Run("trial with startsAt override", func(t *testing.T) {
		issuedAt := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		startsAt := time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC) // 4 days later
		expiresAt := startsAt.Add(30*24*time.Hour + 8*time.Hour)

		data := createTestKeygenData(
			withTrial(true),
			withIssued(issuedAt),
			withStartsAt(startsAt),
			withExpiry(expiresAt),
		)
		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// StartsAt should be the override, not IssuedAt
		assert.Equal(t, startsAt.UnixMilli(), license.StartsAt,
			"StartsAt should be the override value")
		assert.NotEqual(t, license.IssuedAt, license.StartsAt,
			"StartsAt should differ from IssuedAt when overridden")

		// Duration should still match trial duration
		duration := license.ExpiresAt - license.StartsAt
		assert.Equal(t, trialDurationMillis, duration,
			"Trial duration should be 30 days + 8 hours")
	})
}

// TestKeygenLicense_TrialEntitlements verifies TRIAL-04: Trial licenses can have feature entitlements
func TestKeygenLicense_TrialEntitlements(t *testing.T) {
	t.Run("trial license with features specified", func(t *testing.T) {
		data := createTestKeygenData(withTrial(true))
		data.Metadata["features"] = map[string]any{
			"users":         float64(100),
			"ldap":          true,
			"saml":          true,
			"cluster":       true,
			"elasticsearch": true,
		}

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify trial flag
		assert.True(t, license.IsTrial, "Should be a trial license")
		assert.True(t, license.IsTrialLicense(), "IsTrialLicense() should return true")

		// Verify features are set
		require.NotNil(t, license.Features)
		assert.Equal(t, 100, *license.Features.Users, "Users should be 100")
		assert.True(t, *license.Features.LDAP, "LDAP should be enabled")
		assert.True(t, *license.Features.SAML, "SAML should be enabled")
		assert.True(t, *license.Features.Cluster, "Cluster should be enabled")
		assert.True(t, *license.Features.Elasticsearch, "Elasticsearch should be enabled")
	})

	t.Run("trial license with default features", func(t *testing.T) {
		data := createTestKeygenData(withTrial(true))
		// No features specified - should get defaults

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify trial flag
		assert.True(t, license.IsTrial)

		// Features should have defaults (SetDefaults was called)
		require.NotNil(t, license.Features)
		assert.NotNil(t, license.Features.Users)
		assert.NotNil(t, license.Features.LDAP)
		assert.NotNil(t, license.Features.SAML)
	})

	t.Run("trial license with entitlements from Keygen", func(t *testing.T) {
		data := createTestKeygenData(withTrial(true))
		data.Entitlements = []string{"ldap", "saml", "compliance"}

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify trial status
		assert.True(t, license.IsTrialLicense())

		// Verify entitlements were applied
		require.NotNil(t, license.Features)
		assert.True(t, *license.Features.LDAP, "LDAP should be enabled via entitlement")
		assert.True(t, *license.Features.SAML, "SAML should be enabled via entitlement")
		assert.True(t, *license.Features.Compliance, "Compliance should be enabled via entitlement")
	})
}

// =============================================================================
// INTEGRATION TESTS - Combined Behavioral Verification
// =============================================================================

// TestKeygenLicense_FullBehavioralEquivalence tests that a Keygen license
// behaves identically to a legacy license across all behavioral methods
func TestKeygenLicense_FullBehavioralEquivalence(t *testing.T) {
	t.Run("standard enterprise license behavior", func(t *testing.T) {
		// Create a standard enterprise license
		expiry := time.Now().Add(90 * 24 * time.Hour) // 90 days
		data := createTestKeygenData(
			withExpiry(expiry),
			withSeatCount(500),
			withSeatEnforcement(false), // Loose limits
		)

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify all behavioral methods work correctly
		assert.False(t, license.IsExpired(), "License should not be expired")
		assert.False(t, license.IsPastGracePeriod(), "License should not be past grace period")
		assert.False(t, license.IsTrialLicense(), "License should not be a trial")
		assert.False(t, license.IsWithinExpirationPeriod(), "License should not be in warning window")
		assert.False(t, license.IsSeatCountEnforced, "Seat count should not be enforced")
	})

	t.Run("expiring license triggers warning", func(t *testing.T) {
		// Create a license expiring in 59 days (within warning window)
		expiry := time.Now().Add(59 * 24 * time.Hour)
		data := createTestKeygenData(withExpiry(expiry))

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.False(t, license.IsExpired())
		assert.False(t, license.IsPastGracePeriod())
		assert.True(t, license.IsWithinExpirationPeriod(),
			"License expiring in 59 days should trigger warning")
	})

	t.Run("expired license in grace period", func(t *testing.T) {
		// Create a license that expired 5 days ago
		expiry := time.Now().Add(-5 * 24 * time.Hour)
		data := createTestKeygenData(withExpiry(expiry))

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		assert.True(t, license.IsExpired(), "License should be expired")
		assert.False(t, license.IsPastGracePeriod(), "License should still be in grace period")
	})

	t.Run("trial license with all behaviors", func(t *testing.T) {
		// Create a trial license
		startsAt := time.Now()
		expiresAt := startsAt.Add(30*24*time.Hour + 8*time.Hour)

		data := createTestKeygenData(
			withTrial(true),
			withIssued(startsAt),
			withExpiry(expiresAt),
			withSeatCount(50),
			withSeatEnforcement(true),
		)

		license, err := ConvertKeygenToModelLicense(data)
		require.NoError(t, err)

		// Verify all trial-related behavior
		assert.True(t, license.IsTrial, "IsTrial flag should be set")
		assert.True(t, license.IsTrialLicense(), "IsTrialLicense() should return true")
		assert.False(t, license.IsExpired(), "Trial should not be expired yet")
		assert.True(t, license.IsSeatCountEnforced, "Seat enforcement should be on")
		assert.Equal(t, 50, *license.Features.Users, "Should have 50 users")
	})
}
