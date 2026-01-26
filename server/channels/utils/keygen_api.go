// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/hashicorp/go-retryablehttp"
	keygen "github.com/keygen-sh/keygen-go/v3"
)

// ValidationCode represents Keygen API validation response codes.
// These codes indicate the current state of a license from the Keygen API.
type ValidationCode string

const (
	// ValidationCodeValid indicates the license is valid and active
	ValidationCodeValid ValidationCode = "VALID"
	// ValidationCodeNotFound indicates the license key does not exist
	ValidationCodeNotFound ValidationCode = "NOT_FOUND"
	// ValidationCodeSuspended indicates the license has been suspended by admin
	ValidationCodeSuspended ValidationCode = "SUSPENDED"
	// ValidationCodeExpired indicates the license has expired
	ValidationCodeExpired ValidationCode = "EXPIRED"
	// ValidationCodeOverdue indicates the license is overdue for renewal
	ValidationCodeOverdue ValidationCode = "OVERDUE"
	// ValidationCodeBanned indicates the license has been banned
	ValidationCodeBanned ValidationCode = "BANNED"
	// ValidationCodeNoMachine indicates no machine is activated for this license
	ValidationCodeNoMachine ValidationCode = "NO_MACHINE"
	// ValidationCodeNoMachines indicates the license has no machines (plural)
	ValidationCodeNoMachines ValidationCode = "NO_MACHINES"
	// ValidationCodeTooManyMachines indicates machine activation limit exceeded
	ValidationCodeTooManyMachines ValidationCode = "TOO_MANY_MACHINES"
	// ValidationCodeTooManyCores indicates core limit exceeded
	ValidationCodeTooManyCores ValidationCode = "TOO_MANY_CORES"
	// ValidationCodeTooManyProcesses indicates process limit exceeded
	ValidationCodeTooManyProcesses ValidationCode = "TOO_MANY_PROCESSES"
	// ValidationCodeHeartbeatNotStarted indicates heartbeat required but not started
	ValidationCodeHeartbeatNotStarted ValidationCode = "HEARTBEAT_NOT_STARTED"
	// ValidationCodeHeartbeatDead indicates heartbeat has stopped responding
	ValidationCodeHeartbeatDead ValidationCode = "HEARTBEAT_DEAD"
	// ValidationCodeFingerprintScopeMismatch indicates fingerprint validation failure
	ValidationCodeFingerprintScopeMismatch ValidationCode = "FINGERPRINT_SCOPE_MISMATCH"
	// ValidationCodeFingerprintScopeRequired indicates fingerprint is required
	ValidationCodeFingerprintScopeRequired ValidationCode = "FINGERPRINT_SCOPE_REQUIRED"
	// ValidationCodeFingerprintScopeEmpty indicates fingerprint scope is empty
	ValidationCodeFingerprintScopeEmpty ValidationCode = "FINGERPRINT_SCOPE_EMPTY"
	// ValidationCodeEntitlementsMissing indicates required entitlements not present
	ValidationCodeEntitlementsMissing ValidationCode = "ENTITLEMENTS_MISSING"
	// ValidationCodeProductScopeMismatch indicates product validation failure
	ValidationCodeProductScopeMismatch ValidationCode = "PRODUCT_SCOPE_MISMATCH"
	// ValidationCodePolicyScopeMismatch indicates policy validation failure
	ValidationCodePolicyScopeMismatch ValidationCode = "POLICY_SCOPE_MISMATCH"
	// ValidationCodeMachineScopeMismatch indicates machine validation failure
	ValidationCodeMachineScopeMismatch ValidationCode = "MACHINE_SCOPE_MISMATCH"
	// ValidationCodeUserScopeMismatch indicates user validation failure
	ValidationCodeUserScopeMismatch ValidationCode = "USER_SCOPE_MISMATCH"
)

// Sentinel errors for online Keygen API validation.
// These errors are returned when online validation fails for specific reasons.
var (
	// ErrKeygenOnlineNotActivated indicates the license exists but is not activated
	ErrKeygenOnlineNotActivated = errors.New("keygen license not activated")
	// ErrKeygenOnlineExpired indicates the license has expired (authoritative - no fallback)
	ErrKeygenOnlineExpired = errors.New("keygen license expired (online)")
	// ErrKeygenOnlineSuspended indicates the license has been suspended (authoritative - no fallback)
	ErrKeygenOnlineSuspended = errors.New("keygen license suspended")
	// ErrKeygenOnlineBanned indicates the license has been banned (authoritative - no fallback)
	ErrKeygenOnlineBanned = errors.New("keygen license banned")
	// ErrKeygenOnlineNotFound indicates the license key does not exist (authoritative - no fallback)
	ErrKeygenOnlineNotFound = errors.New("keygen license not found")
	// ErrKeygenOnlineOverdue indicates the license is overdue for renewal
	ErrKeygenOnlineOverdue = errors.New("keygen license overdue")
	// ErrKeygenOnlineRateLimited indicates API rate limit hit (network error - allow fallback)
	ErrKeygenOnlineRateLimited = errors.New("keygen API rate limited")
	// ErrKeygenOnlineNetworkError indicates a network-level failure (allow fallback)
	ErrKeygenOnlineNetworkError = errors.New("keygen API network error")
	// ErrKeygenOnlineTooManyMachines indicates machine activation limit exceeded
	ErrKeygenOnlineTooManyMachines = errors.New("keygen license machine limit exceeded")
	// ErrKeygenOnlineHeartbeatDead indicates heartbeat has stopped responding
	ErrKeygenOnlineHeartbeatDead = errors.New("keygen license heartbeat dead")
	// ErrKeygenOnlineEntitlementsMissing indicates required entitlements not present
	ErrKeygenOnlineEntitlementsMissing = errors.New("keygen license missing required entitlements")
	// ErrKeygenConfigMissing indicates required configuration (account/product ID) is missing
	ErrKeygenConfigMissing = errors.New("keygen configuration missing")
)

// KeygenAPIConfig holds configuration for the Keygen API client.
type KeygenAPIConfig struct {
	// AccountID is the Keygen account ID (from env: KEYGEN_ACCOUNT_ID)
	AccountID string
	// ProductID is the Keygen product ID (from env: KEYGEN_PRODUCT_ID)
	ProductID string
	// Timeout is the request timeout (default: 10s)
	Timeout time.Duration
	// RetryMax is the maximum number of retries (default: 2)
	RetryMax int
	// RetryWaitMin is the minimum wait time between retries (default: 500ms)
	RetryWaitMin time.Duration
	// RetryWaitMax is the maximum wait time between retries (default: 2s)
	RetryWaitMax time.Duration
}

// DefaultKeygenAPIConfig returns a KeygenAPIConfig with sensible defaults.
// Total maximum wait time with retries: ~30 seconds (10s timeout × 2 retries + wait times)
func DefaultKeygenAPIConfig() KeygenAPIConfig {
	return KeygenAPIConfig{
		Timeout:      10 * time.Second,
		RetryMax:     2,
		RetryWaitMin: 500 * time.Millisecond,
		RetryWaitMax: 2 * time.Second,
	}
}

// KeygenOnlineValidationResult holds the result of an online API validation.
type KeygenOnlineValidationResult struct {
	// License is the license data from Keygen API
	License *keygen.License
	// ValidationCode is the validation response code
	ValidationCode ValidationCode
	// Entitlements is the list of entitlements for this license
	Entitlements []keygen.Entitlement
}

// KeygenAPIClient handles online validation with the Keygen API.
type KeygenAPIClient struct {
	config     KeygenAPIConfig
	httpClient *retryablehttp.Client
}

// NewKeygenAPIClient creates a new Keygen API client with the given configuration.
// It configures the HTTP client with retry logic using linear jitter backoff.
func NewKeygenAPIClient(config KeygenAPIConfig) *KeygenAPIClient {
	// Apply defaults for zero values
	if config.Timeout == 0 {
		config.Timeout = 10 * time.Second
	}
	if config.RetryMax == 0 {
		config.RetryMax = 2
	}
	if config.RetryWaitMin == 0 {
		config.RetryWaitMin = 500 * time.Millisecond
	}
	if config.RetryWaitMax == 0 {
		config.RetryWaitMax = 2 * time.Second
	}

	// Create retryable HTTP client with linear jitter backoff
	client := retryablehttp.NewClient()
	client.RetryMax = config.RetryMax
	client.RetryWaitMin = config.RetryWaitMin
	client.RetryWaitMax = config.RetryWaitMax
	client.Backoff = retryablehttp.LinearJitterBackoff
	client.Logger = nil // Disable default logging

	// Set timeout on the underlying HTTP client
	client.HTTPClient.Timeout = config.Timeout

	return &KeygenAPIClient{
		config:     config,
		httpClient: client,
	}
}

// NewKeygenAPIClientFromEnv creates a Keygen API client from environment variables.
// Required environment variables:
//   - KEYGEN_ACCOUNT_ID: The Keygen account ID
//   - KEYGEN_PRODUCT_ID: The Keygen product ID
//
// Optional environment variables can be added in the future for timeout/retry config.
func NewKeygenAPIClientFromEnv() (*KeygenAPIClient, error) {
	accountID := os.Getenv("KEYGEN_ACCOUNT_ID")
	if accountID == "" {
		return nil, fmt.Errorf("%w: KEYGEN_ACCOUNT_ID environment variable not set", ErrKeygenConfigMissing)
	}

	productID := os.Getenv("KEYGEN_PRODUCT_ID")
	if productID == "" {
		return nil, fmt.Errorf("%w: KEYGEN_PRODUCT_ID environment variable not set", ErrKeygenConfigMissing)
	}

	config := DefaultKeygenAPIConfig()
	config.AccountID = accountID
	config.ProductID = productID

	return NewKeygenAPIClient(config), nil
}

// Validate performs online license validation against the Keygen API.
// It sets up the SDK configuration, makes the API call, and maps errors appropriately.
//
// Parameters:
//   - ctx: Context for cancellation and timeout
//   - licenseKey: The license key to validate
//
// Returns:
//   - *KeygenOnlineValidationResult: The validation result on success
//   - error: A sentinel error indicating the failure reason
//
// Network errors (IsNetworkError returns true) should trigger offline fallback.
// Definitive failures (IsDefinitiveFailure returns true) should NOT trigger fallback.
func (c *KeygenAPIClient) Validate(ctx context.Context, licenseKey string) (*KeygenOnlineValidationResult, error) {
	httpClient := c.httpClient.StandardClient()
	update := keygenSDKUpdate{
		account:       &c.config.AccountID,
		product:       &c.config.ProductID,
		licenseKey:    &licenseKey,
		httpClient:    httpClient,
		setHTTPClient: true,
	}

	var license *keygen.License
	var validationCode ValidationCode
	var entitlements []keygen.Entitlement

	err := withKeygenSDK(update, func() error {
		var err error
		license, err = keygen.Validate(ctx)
		if err != nil {
			return err
		}

		// Extract validation code from the license
		validationCode = ValidationCodeValid
		if license != nil && license.LastValidation != nil {
			validationCode = ValidationCode(license.LastValidation.Code)
		}

		// Fetch entitlements for the license
		entitlements, err = license.Entitlements(ctx)
		if err != nil {
			// Log but don't fail - entitlements are optional for validation
			entitlements = nil
		}

		return nil
	})
	if err != nil {
		return nil, c.mapSDKError(err)
	}

	return &KeygenOnlineValidationResult{
		License:        license,
		ValidationCode: validationCode,
		Entitlements:   entitlements,
	}, nil
}

// mapSDKError converts Keygen SDK errors to our sentinel errors.
func (c *KeygenAPIClient) mapSDKError(err error) error {
	if err == nil {
		return nil
	}

	// Check for rate limit error first
	var rateLimitErr *keygen.RateLimitError
	if errors.As(err, &rateLimitErr) {
		return fmt.Errorf("%w: retry after %ds", ErrKeygenOnlineRateLimited, rateLimitErr.RetryAfter)
	}

	// Check for network-level errors
	var netErr net.Error
	if errors.As(err, &netErr) {
		return fmt.Errorf("%w: %v", ErrKeygenOnlineNetworkError, netErr)
	}

	// Check for context errors
	if errors.Is(err, context.DeadlineExceeded) {
		return fmt.Errorf("%w: request timeout", ErrKeygenOnlineNetworkError)
	}
	if errors.Is(err, context.Canceled) {
		return fmt.Errorf("%w: request canceled", ErrKeygenOnlineNetworkError)
	}

	// Map SDK license errors to our sentinel errors
	switch {
	case errors.Is(err, keygen.ErrLicenseNotActivated):
		return ErrKeygenOnlineNotActivated
	case errors.Is(err, keygen.ErrLicenseExpired):
		return ErrKeygenOnlineExpired
	case errors.Is(err, keygen.ErrLicenseSuspended):
		return ErrKeygenOnlineSuspended
	case errors.Is(err, keygen.ErrLicenseInvalid):
		return ErrKeygenOnlineNotFound
	case errors.Is(err, keygen.ErrLicenseTooManyMachines):
		return ErrKeygenOnlineTooManyMachines
	case errors.Is(err, keygen.ErrHeartbeatDead):
		return ErrKeygenOnlineHeartbeatDead
	}

	// Return wrapped error for unknown types
	return fmt.Errorf("%w: %v", ErrKeygenOnlineNetworkError, err)
}

// IsNetworkError returns true if the error is a network-related error that should
// trigger offline fallback. Network errors include:
//   - Rate limiting (temporary, should retry/fallback)
//   - Context timeout/cancellation
//   - TCP/IP level errors (connection refused, timeout, etc.)
//
// Returns false for validation failures (EXPIRED, SUSPENDED, etc.) as these are
// authoritative responses from the Keygen API that should NOT trigger fallback.
func IsNetworkError(err error) bool {
	if err == nil {
		return false
	}

	// Our sentinel network errors
	if errors.Is(err, ErrKeygenOnlineRateLimited) {
		return true
	}
	if errors.Is(err, ErrKeygenOnlineNetworkError) {
		return true
	}

	// Context errors
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	if errors.Is(err, context.Canceled) {
		return true
	}

	// Check for Keygen SDK rate limit error
	var rateLimitErr *keygen.RateLimitError
	if errors.As(err, &rateLimitErr) {
		return true
	}

	// Check for net.Error (includes timeout, connection refused, etc.)
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}

	// All other errors are NOT network errors
	return false
}

// IsDefinitiveFailure returns true if the error represents an authoritative validation
// failure from the Keygen API. These errors should NOT trigger offline fallback because
// the API has definitively determined the license state.
//
// Definitive failures include:
//   - EXPIRED: License has passed its expiration date
//   - SUSPENDED: License has been suspended by administrator
//   - BANNED: License has been permanently banned
//   - NOT_FOUND: License key does not exist
//
// When these errors occur, the license should be rejected even if a cached
// offline version exists, as the online state is authoritative.
func IsDefinitiveFailure(err error) bool {
	if err == nil {
		return false
	}

	// These are authoritative failures - do NOT fallback to offline
	if errors.Is(err, ErrKeygenOnlineExpired) {
		return true
	}
	if errors.Is(err, ErrKeygenOnlineSuspended) {
		return true
	}
	if errors.Is(err, ErrKeygenOnlineBanned) {
		return true
	}
	if errors.Is(err, ErrKeygenOnlineNotFound) {
		return true
	}

	return false
}

// ShouldFallbackToOffline determines whether offline validation should be attempted
// based on the error from online validation.
//
// Returns true only for network errors where the API could not be reached.
// Returns false for definitive validation failures or nil errors.
//
// SECURITY NOTE: This function is intended for use in contexts where offline fallback
// is explicitly allowed (e.g., airgapped instances). In production validation paths
// where KEYGEN_ACCOUNT_ID and KEYGEN_PRODUCT_ID are configured, network errors should
// cause validation to FAIL rather than fallback, to prevent bypassing online validation
// by disconnecting from the internet. See ValidateKeygenOnlineIfConfigured for the
// production behavior.
func ShouldFallbackToOffline(err error) bool {
	if err == nil {
		return false
	}

	// Definitive failures should NOT fallback
	if IsDefinitiveFailure(err) {
		return false
	}

	// Network errors should fallback
	return IsNetworkError(err)
}
