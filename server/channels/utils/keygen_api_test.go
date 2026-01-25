// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"
	"time"

	keygen "github.com/keygen-sh/keygen-go/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIsNetworkError verifies that network-related errors are correctly classified.
func TestIsNetworkError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error returns false",
			err:      nil,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineRateLimited returns true",
			err:      ErrKeygenOnlineRateLimited,
			expected: true,
		},
		{
			name:     "wrapped ErrKeygenOnlineRateLimited returns true",
			err:      fmt.Errorf("some context: %w", ErrKeygenOnlineRateLimited),
			expected: true,
		},
		{
			name:     "ErrKeygenOnlineNetworkError returns true",
			err:      ErrKeygenOnlineNetworkError,
			expected: true,
		},
		{
			name:     "wrapped ErrKeygenOnlineNetworkError returns true",
			err:      fmt.Errorf("connection failed: %w", ErrKeygenOnlineNetworkError),
			expected: true,
		},
		{
			name:     "context.DeadlineExceeded returns true",
			err:      context.DeadlineExceeded,
			expected: true,
		},
		{
			name:     "wrapped context.DeadlineExceeded returns true",
			err:      fmt.Errorf("request timed out: %w", context.DeadlineExceeded),
			expected: true,
		},
		{
			name:     "context.Canceled returns true",
			err:      context.Canceled,
			expected: true,
		},
		{
			name:     "net.Error (timeout) returns true",
			err:      &netTimeoutError{timeout: true},
			expected: true,
		},
		{
			name:     "keygen.RateLimitError returns true",
			err:      &keygen.RateLimitError{RetryAfter: 60},
			expected: true,
		},
		// Validation errors should NOT be classified as network errors
		{
			name:     "ErrKeygenOnlineExpired returns false",
			err:      ErrKeygenOnlineExpired,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineSuspended returns false",
			err:      ErrKeygenOnlineSuspended,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineBanned returns false",
			err:      ErrKeygenOnlineBanned,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineNotFound returns false",
			err:      ErrKeygenOnlineNotFound,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineNotActivated returns false",
			err:      ErrKeygenOnlineNotActivated,
			expected: false,
		},
		{
			name:     "generic error returns false",
			err:      errors.New("some random error"),
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := IsNetworkError(tc.err)
			assert.Equal(t, tc.expected, result, "IsNetworkError(%v) = %v, want %v", tc.err, result, tc.expected)
		})
	}
}

// TestIsDefinitiveFailure verifies that authoritative validation failures are correctly classified.
func TestIsDefinitiveFailure(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error returns false",
			err:      nil,
			expected: false,
		},
		// Definitive failures should return true
		{
			name:     "ErrKeygenOnlineExpired returns true",
			err:      ErrKeygenOnlineExpired,
			expected: true,
		},
		{
			name:     "wrapped ErrKeygenOnlineExpired returns true",
			err:      fmt.Errorf("license check failed: %w", ErrKeygenOnlineExpired),
			expected: true,
		},
		{
			name:     "ErrKeygenOnlineSuspended returns true",
			err:      ErrKeygenOnlineSuspended,
			expected: true,
		},
		{
			name:     "ErrKeygenOnlineBanned returns true",
			err:      ErrKeygenOnlineBanned,
			expected: true,
		},
		{
			name:     "ErrKeygenOnlineNotFound returns true",
			err:      ErrKeygenOnlineNotFound,
			expected: true,
		},
		// Non-definitive failures should return false
		{
			name:     "ErrKeygenOnlineRateLimited returns false",
			err:      ErrKeygenOnlineRateLimited,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineNetworkError returns false",
			err:      ErrKeygenOnlineNetworkError,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineNotActivated returns false",
			err:      ErrKeygenOnlineNotActivated,
			expected: false,
		},
		{
			name:     "context.DeadlineExceeded returns false",
			err:      context.DeadlineExceeded,
			expected: false,
		},
		{
			name:     "generic error returns false",
			err:      errors.New("some random error"),
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := IsDefinitiveFailure(tc.err)
			assert.Equal(t, tc.expected, result, "IsDefinitiveFailure(%v) = %v, want %v", tc.err, result, tc.expected)
		})
	}
}

// TestShouldFallbackToOffline verifies the combined logic for fallback decisions.
func TestShouldFallbackToOffline(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error returns false (success, no fallback needed)",
			err:      nil,
			expected: false,
		},
		// Network errors should trigger fallback
		{
			name:     "ErrKeygenOnlineRateLimited should fallback",
			err:      ErrKeygenOnlineRateLimited,
			expected: true,
		},
		{
			name:     "ErrKeygenOnlineNetworkError should fallback",
			err:      ErrKeygenOnlineNetworkError,
			expected: true,
		},
		{
			name:     "context.DeadlineExceeded should fallback",
			err:      context.DeadlineExceeded,
			expected: true,
		},
		// Definitive failures should NOT trigger fallback
		{
			name:     "ErrKeygenOnlineExpired should NOT fallback",
			err:      ErrKeygenOnlineExpired,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineSuspended should NOT fallback",
			err:      ErrKeygenOnlineSuspended,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineBanned should NOT fallback",
			err:      ErrKeygenOnlineBanned,
			expected: false,
		},
		{
			name:     "ErrKeygenOnlineNotFound should NOT fallback",
			err:      ErrKeygenOnlineNotFound,
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := ShouldFallbackToOffline(tc.err)
			assert.Equal(t, tc.expected, result, "ShouldFallbackToOffline(%v) = %v, want %v", tc.err, result, tc.expected)
		})
	}
}

// TestNewKeygenAPIClientFromEnv verifies environment-based configuration.
func TestNewKeygenAPIClientFromEnv(t *testing.T) {
	tests := []struct {
		name        string
		accountID   string
		productID   string
		expectError bool
		errorIs     error
	}{
		{
			name:        "valid env vars returns client",
			accountID:   "test-account-id",
			productID:   "test-product-id",
			expectError: false,
		},
		{
			name:        "missing KEYGEN_ACCOUNT_ID returns error",
			accountID:   "",
			productID:   "test-product-id",
			expectError: true,
			errorIs:     ErrKeygenConfigMissing,
		},
		{
			name:        "missing KEYGEN_PRODUCT_ID returns error",
			accountID:   "test-account-id",
			productID:   "",
			expectError: true,
			errorIs:     ErrKeygenConfigMissing,
		},
		{
			name:        "missing both returns error for account first",
			accountID:   "",
			productID:   "",
			expectError: true,
			errorIs:     ErrKeygenConfigMissing,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Set environment variables for this test
			if tc.accountID != "" {
				t.Setenv("KEYGEN_ACCOUNT_ID", tc.accountID)
			}
			if tc.productID != "" {
				t.Setenv("KEYGEN_PRODUCT_ID", tc.productID)
			}

			client, err := NewKeygenAPIClientFromEnv()

			if tc.expectError {
				require.Error(t, err)
				assert.Nil(t, client)
				if tc.errorIs != nil {
					assert.True(t, errors.Is(err, tc.errorIs), "expected error to wrap %v, got %v", tc.errorIs, err)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, client)
				assert.Equal(t, tc.accountID, client.config.AccountID)
				assert.Equal(t, tc.productID, client.config.ProductID)
			}
		})
	}
}

// TestKeygenAPIClientConfig verifies client configuration handling.
func TestKeygenAPIClientConfig(t *testing.T) {
	t.Run("default values applied for zero config", func(t *testing.T) {
		config := KeygenAPIConfig{
			AccountID: "test-account",
			ProductID: "test-product",
			// All other fields are zero values
		}

		client := NewKeygenAPIClient(config)

		require.NotNil(t, client)
		assert.Equal(t, 30*time.Second, client.config.Timeout)
		assert.Equal(t, 3, client.config.RetryMax)
		assert.Equal(t, 1*time.Second, client.config.RetryWaitMin)
		assert.Equal(t, 5*time.Second, client.config.RetryWaitMax)
	})

	t.Run("custom values preserved", func(t *testing.T) {
		config := KeygenAPIConfig{
			AccountID:    "custom-account",
			ProductID:    "custom-product",
			Timeout:      60 * time.Second,
			RetryMax:     5,
			RetryWaitMin: 2 * time.Second,
			RetryWaitMax: 10 * time.Second,
		}

		client := NewKeygenAPIClient(config)

		require.NotNil(t, client)
		assert.Equal(t, "custom-account", client.config.AccountID)
		assert.Equal(t, "custom-product", client.config.ProductID)
		assert.Equal(t, 60*time.Second, client.config.Timeout)
		assert.Equal(t, 5, client.config.RetryMax)
		assert.Equal(t, 2*time.Second, client.config.RetryWaitMin)
		assert.Equal(t, 10*time.Second, client.config.RetryWaitMax)
	})

	t.Run("DefaultKeygenAPIConfig returns sensible defaults", func(t *testing.T) {
		config := DefaultKeygenAPIConfig()

		assert.Equal(t, 30*time.Second, config.Timeout)
		assert.Equal(t, 3, config.RetryMax)
		assert.Equal(t, 1*time.Second, config.RetryWaitMin)
		assert.Equal(t, 5*time.Second, config.RetryWaitMax)
	})
}

// TestValidationCodeConstants verifies all validation codes are properly defined.
func TestValidationCodeConstants(t *testing.T) {
	tests := []struct {
		code     ValidationCode
		expected string
	}{
		{ValidationCodeValid, "VALID"},
		{ValidationCodeNotFound, "NOT_FOUND"},
		{ValidationCodeSuspended, "SUSPENDED"},
		{ValidationCodeExpired, "EXPIRED"},
		{ValidationCodeOverdue, "OVERDUE"},
		{ValidationCodeBanned, "BANNED"},
		{ValidationCodeNoMachine, "NO_MACHINE"},
		{ValidationCodeNoMachines, "NO_MACHINES"},
		{ValidationCodeTooManyMachines, "TOO_MANY_MACHINES"},
		{ValidationCodeTooManyCores, "TOO_MANY_CORES"},
		{ValidationCodeTooManyProcesses, "TOO_MANY_PROCESSES"},
		{ValidationCodeHeartbeatNotStarted, "HEARTBEAT_NOT_STARTED"},
		{ValidationCodeHeartbeatDead, "HEARTBEAT_DEAD"},
		{ValidationCodeFingerprintScopeMismatch, "FINGERPRINT_SCOPE_MISMATCH"},
		{ValidationCodeFingerprintScopeRequired, "FINGERPRINT_SCOPE_REQUIRED"},
		{ValidationCodeFingerprintScopeEmpty, "FINGERPRINT_SCOPE_EMPTY"},
		{ValidationCodeEntitlementsMissing, "ENTITLEMENTS_MISSING"},
		{ValidationCodeProductScopeMismatch, "PRODUCT_SCOPE_MISMATCH"},
		{ValidationCodePolicyScopeMismatch, "POLICY_SCOPE_MISMATCH"},
		{ValidationCodeMachineScopeMismatch, "MACHINE_SCOPE_MISMATCH"},
		{ValidationCodeUserScopeMismatch, "USER_SCOPE_MISMATCH"},
	}

	for _, tc := range tests {
		t.Run(tc.expected, func(t *testing.T) {
			assert.Equal(t, tc.expected, string(tc.code), "ValidationCode constant %v should have value %q", tc.code, tc.expected)
		})
	}

	// Verify we have at least 20 validation codes as specified
	assert.GreaterOrEqual(t, len(tests), 20, "Should have at least 20 validation codes defined")
}

// TestSentinelErrors verifies all sentinel errors are properly defined and distinct.
func TestSentinelErrors(t *testing.T) {
	errors := []error{
		ErrKeygenOnlineNotActivated,
		ErrKeygenOnlineExpired,
		ErrKeygenOnlineSuspended,
		ErrKeygenOnlineBanned,
		ErrKeygenOnlineNotFound,
		ErrKeygenOnlineOverdue,
		ErrKeygenOnlineRateLimited,
		ErrKeygenOnlineNetworkError,
		ErrKeygenOnlineTooManyMachines,
		ErrKeygenOnlineHeartbeatDead,
		ErrKeygenOnlineEntitlementsMissing,
		ErrKeygenConfigMissing,
	}

	// Verify all errors are distinct
	seen := make(map[string]bool)
	for _, err := range errors {
		errStr := err.Error()
		assert.False(t, seen[errStr], "Duplicate error message: %s", errStr)
		seen[errStr] = true
	}

	// Verify we have expected number of errors
	assert.Equal(t, 12, len(errors), "Should have 12 sentinel errors defined")
}

// netTimeoutError is a mock net.Error for testing.
type netTimeoutError struct {
	timeout   bool
	temporary bool
}

func (e *netTimeoutError) Error() string   { return "network timeout" }
func (e *netTimeoutError) Timeout() bool   { return e.timeout }
func (e *netTimeoutError) Temporary() bool { return e.temporary }

// Verify netTimeoutError implements net.Error
var _ net.Error = (*netTimeoutError)(nil)

// TestMapSDKError verifies SDK error mapping through the client.
func TestMapSDKError(t *testing.T) {
	client := NewKeygenAPIClient(KeygenAPIConfig{
		AccountID: "test",
		ProductID: "test",
	})

	tests := []struct {
		name      string
		inputErr  error
		expectErr error
	}{
		{
			name:      "nil error returns nil",
			inputErr:  nil,
			expectErr: nil,
		},
		{
			name:      "rate limit error maps to ErrKeygenOnlineRateLimited",
			inputErr:  &keygen.RateLimitError{RetryAfter: 60},
			expectErr: ErrKeygenOnlineRateLimited,
		},
		{
			name:      "net.Error maps to ErrKeygenOnlineNetworkError",
			inputErr:  &netTimeoutError{timeout: true},
			expectErr: ErrKeygenOnlineNetworkError,
		},
		{
			name:      "context.DeadlineExceeded maps to ErrKeygenOnlineNetworkError",
			inputErr:  context.DeadlineExceeded,
			expectErr: ErrKeygenOnlineNetworkError,
		},
		{
			name:      "context.Canceled maps to ErrKeygenOnlineNetworkError",
			inputErr:  context.Canceled,
			expectErr: ErrKeygenOnlineNetworkError,
		},
		{
			name:      "ErrLicenseNotActivated maps to ErrKeygenOnlineNotActivated",
			inputErr:  keygen.ErrLicenseNotActivated,
			expectErr: ErrKeygenOnlineNotActivated,
		},
		{
			name:      "ErrLicenseExpired maps to ErrKeygenOnlineExpired",
			inputErr:  keygen.ErrLicenseExpired,
			expectErr: ErrKeygenOnlineExpired,
		},
		{
			name:      "ErrLicenseSuspended maps to ErrKeygenOnlineSuspended",
			inputErr:  keygen.ErrLicenseSuspended,
			expectErr: ErrKeygenOnlineSuspended,
		},
		{
			name:      "ErrLicenseInvalid maps to ErrKeygenOnlineNotFound",
			inputErr:  keygen.ErrLicenseInvalid,
			expectErr: ErrKeygenOnlineNotFound,
		},
		{
			name:      "ErrLicenseTooManyMachines maps to ErrKeygenOnlineTooManyMachines",
			inputErr:  keygen.ErrLicenseTooManyMachines,
			expectErr: ErrKeygenOnlineTooManyMachines,
		},
		{
			name:      "ErrHeartbeatDead maps to ErrKeygenOnlineHeartbeatDead",
			inputErr:  keygen.ErrHeartbeatDead,
			expectErr: ErrKeygenOnlineHeartbeatDead,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := client.mapSDKError(tc.inputErr)
			if tc.expectErr == nil {
				assert.NoError(t, result)
			} else {
				require.Error(t, result)
				assert.True(t, errors.Is(result, tc.expectErr), "expected error to wrap %v, got %v", tc.expectErr, result)
			}
		})
	}
}
