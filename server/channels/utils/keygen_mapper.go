// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// Sentinel errors for Keygen metadata mapping
var (
	// ErrKeygenMetadataMissing indicates a required metadata key is not found
	ErrKeygenMetadataMissing = errors.New("keygen license metadata key missing")
	// ErrKeygenMetadataInvalidType indicates a metadata value has the wrong type
	ErrKeygenMetadataInvalidType = errors.New("keygen license metadata value has invalid type")
	// ErrKeygenInvalidSKU indicates the SKU short name is not in the valid set
	ErrKeygenInvalidSKU = errors.New("keygen license has invalid SKU short name")
)

// mattermostIDLength is the required length for Mattermost IDs
const mattermostIDLength = 26

// validSKUs is the set of valid Mattermost SKU short names
var validSKUs = map[string]bool{
	model.LicenseShortSkuE10:                true,
	model.LicenseShortSkuE20:                true,
	model.LicenseShortSkuProfessional:       true,
	model.LicenseShortSkuEnterprise:         true,
	model.LicenseShortSkuEnterpriseAdvanced: true,
	model.LicenseShortSkuMattermostEntry:    true,
}

// convertKeygenIDToMattermostID converts a Keygen UUID to a valid Mattermost ID.
// Mattermost IDs must be exactly 26 alphanumeric characters.
// Keygen UUIDs are in format: f5a618af-7076-407c-93bc-495caafa65c2
// This function strips hyphens and takes the first 26 characters.
func convertKeygenIDToMattermostID(keygenID string) string {
	// Remove hyphens from UUID
	id := strings.ReplaceAll(keygenID, "-", "")

	// Ensure we have at least 26 characters
	if len(id) >= mattermostIDLength {
		return id[:mattermostIDLength]
	}

	// Pad with zeros if somehow shorter (shouldn't happen with valid UUIDs)
	for len(id) < mattermostIDLength {
		id += "0"
	}
	return id
}

// extractMetadata safely extracts a value from the metadata map with a default fallback.
// If the key is missing, the metadata is nil, or the type doesn't match, returns defaultVal.
func extractMetadata[T any](metadata map[string]any, key string, defaultVal T) T {
	if metadata == nil {
		return defaultVal
	}
	val, ok := metadata[key]
	if !ok {
		return defaultVal
	}
	typed, ok := val.(T)
	if !ok {
		return defaultVal
	}
	return typed
}

// extractMetadataRequired extracts a required value from metadata, returning an error if missing or wrong type.
func extractMetadataRequired[T any](metadata map[string]any, key string) (T, error) {
	var zero T
	if metadata == nil {
		return zero, fmt.Errorf("%w: %s (metadata is nil)", ErrKeygenMetadataMissing, key)
	}
	val, ok := metadata[key]
	if !ok {
		return zero, fmt.Errorf("%w: %s", ErrKeygenMetadataMissing, key)
	}
	typed, ok := val.(T)
	if !ok {
		return zero, fmt.Errorf("%w: key %s expected %T, got %T", ErrKeygenMetadataInvalidType, key, zero, val)
	}
	return typed, nil
}

// extractMetadataInt safely extracts an integer from metadata.
// JSON unmarshal into any uses float64 for all numbers, so this handles the conversion.
func extractMetadataInt(metadata map[string]any, key string, defaultVal int) int {
	if metadata == nil {
		return defaultVal
	}
	val, ok := metadata[key]
	if !ok {
		return defaultVal
	}
	// JSON numbers are float64 when unmarshaled to any
	if f, ok := val.(float64); ok {
		return int(f)
	}
	// Direct int (unlikely but handle it)
	if i, ok := val.(int); ok {
		return i
	}
	return defaultVal
}

// extractMetadataInt64 safely extracts an int64 from metadata.
// JSON unmarshal into any uses float64 for all numbers, so this handles the conversion.
func extractMetadataInt64(metadata map[string]any, key string, defaultVal int64) int64 {
	if metadata == nil {
		return defaultVal
	}
	val, ok := metadata[key]
	if !ok {
		return defaultVal
	}
	// JSON numbers are float64 when unmarshaled to any
	if f, ok := val.(float64); ok {
		return int64(f)
	}
	// Direct int64 (unlikely but handle it)
	if i, ok := val.(int64); ok {
		return i
	}
	// Direct int
	if i, ok := val.(int); ok {
		return int64(i)
	}
	return defaultVal
}

// parseISO8601ToMillis converts an ISO8601/RFC3339 timestamp to Unix milliseconds.
func parseISO8601ToMillis(iso8601 string) (int64, error) {
	if iso8601 == "" {
		return 0, fmt.Errorf("empty timestamp")
	}

	t, err := time.Parse(time.RFC3339, iso8601)
	if err != nil {
		// Try alternate format without timezone (RFC3339Nano)
		t, err = time.Parse(time.RFC3339Nano, iso8601)
		if err != nil {
			return 0, fmt.Errorf("failed to parse timestamp %q: %w", iso8601, err)
		}
	}

	return t.UnixMilli(), nil
}

// mapKeygenCustomer extracts customer information from Keygen metadata.
// All four customer fields (customerId, customerName, customerEmail, companyName) are required.
func mapKeygenCustomer(metadata map[string]any) (*model.Customer, error) {
	customer := &model.Customer{}
	var err error

	customer.Id, err = extractMetadataRequired[string](metadata, "customerId")
	if err != nil {
		return nil, fmt.Errorf("customer mapping failed: %w", err)
	}

	customer.Name, err = extractMetadataRequired[string](metadata, "customerName")
	if err != nil {
		return nil, fmt.Errorf("customer mapping failed: %w", err)
	}

	customer.Email, err = extractMetadataRequired[string](metadata, "customerEmail")
	if err != nil {
		return nil, fmt.Errorf("customer mapping failed: %w", err)
	}

	customer.Company, err = extractMetadataRequired[string](metadata, "companyName")
	if err != nil {
		return nil, fmt.Errorf("customer mapping failed: %w", err)
	}

	return customer, nil
}

// mapKeygenFeatures extracts feature flags from Keygen metadata.
// It calls SetDefaults() first to ensure all pointers are initialized,
// then overrides with values from metadata.
//
// For the "users" field, it supports both:
//   - Flat metadata: metadata["users"] = 100
//   - Nested metadata: metadata["features"]["users"] = 100
//
// Flat metadata takes precedence (checked first) for simpler Keygen UI configuration.
func mapKeygenFeatures(metadata map[string]any) *model.Features {
	features := &model.Features{}

	// First set defaults (critical for nil pointer safety)
	features.SetDefaults()

	// Check for flat "users" key first (simpler Keygen UI configuration)
	if users := extractMetadataInt(metadata, "users", -1); users >= 0 {
		features.Users = model.NewPointer(users)
	}

	// Extract features sub-object from metadata
	featuresData := extractMetadata[map[string]any](metadata, "features", nil)
	if featuresData == nil {
		return features // Return defaults/flat values if no features sub-object
	}

	// Override with values from nested features object
	// Users (int) - only override if not already set from flat metadata
	if features.Users == nil || *features.Users == 0 {
		if users := extractMetadataInt(featuresData, "users", -1); users >= 0 {
			features.Users = model.NewPointer(users)
		}
	}

	// Boolean feature flags - only override if present
	if ldap, ok := featuresData["ldap"].(bool); ok {
		features.LDAP = model.NewPointer(ldap)
	}
	if ldapGroups, ok := featuresData["ldapGroups"].(bool); ok {
		features.LDAPGroups = model.NewPointer(ldapGroups)
	}
	if mfa, ok := featuresData["mfa"].(bool); ok {
		features.MFA = model.NewPointer(mfa)
	}
	if googleOauth, ok := featuresData["googleOauth"].(bool); ok {
		features.GoogleOAuth = model.NewPointer(googleOauth)
	}
	if office365Oauth, ok := featuresData["office365Oauth"].(bool); ok {
		features.Office365OAuth = model.NewPointer(office365Oauth)
	}
	if openid, ok := featuresData["openid"].(bool); ok {
		features.OpenId = model.NewPointer(openid)
	}
	if compliance, ok := featuresData["compliance"].(bool); ok {
		features.Compliance = model.NewPointer(compliance)
	}
	if cluster, ok := featuresData["cluster"].(bool); ok {
		features.Cluster = model.NewPointer(cluster)
	}
	if metrics, ok := featuresData["metrics"].(bool); ok {
		features.Metrics = model.NewPointer(metrics)
	}
	if mhpns, ok := featuresData["mhpns"].(bool); ok {
		features.MHPNS = model.NewPointer(mhpns)
	}
	if saml, ok := featuresData["saml"].(bool); ok {
		features.SAML = model.NewPointer(saml)
	}
	if elasticsearch, ok := featuresData["elasticsearch"].(bool); ok {
		features.Elasticsearch = model.NewPointer(elasticsearch)
	}
	if announcement, ok := featuresData["announcement"].(bool); ok {
		features.Announcement = model.NewPointer(announcement)
	}
	if themeManagement, ok := featuresData["themeManagement"].(bool); ok {
		features.ThemeManagement = model.NewPointer(themeManagement)
	}
	if emailNotificationContents, ok := featuresData["emailNotificationContents"].(bool); ok {
		features.EmailNotificationContents = model.NewPointer(emailNotificationContents)
	}
	if dataRetention, ok := featuresData["dataRetention"].(bool); ok {
		features.DataRetention = model.NewPointer(dataRetention)
	}
	if messageExport, ok := featuresData["messageExport"].(bool); ok {
		features.MessageExport = model.NewPointer(messageExport)
	}
	if customPermissionsSchemes, ok := featuresData["customPermissionsSchemes"].(bool); ok {
		features.CustomPermissionsSchemes = model.NewPointer(customPermissionsSchemes)
	}
	if customTermsOfService, ok := featuresData["customTermsOfService"].(bool); ok {
		features.CustomTermsOfService = model.NewPointer(customTermsOfService)
	}
	if guestAccounts, ok := featuresData["guestAccounts"].(bool); ok {
		features.GuestAccounts = model.NewPointer(guestAccounts)
	}
	if guestAccountsPermissions, ok := featuresData["guestAccountsPermissions"].(bool); ok {
		features.GuestAccountsPermissions = model.NewPointer(guestAccountsPermissions)
	}
	if idLoaded, ok := featuresData["idLoaded"].(bool); ok {
		features.IDLoadedPushNotifications = model.NewPointer(idLoaded)
	}
	if lockTeammateNameDisplay, ok := featuresData["lockTeammateNameDisplay"].(bool); ok {
		features.LockTeammateNameDisplay = model.NewPointer(lockTeammateNameDisplay)
	}
	if enterprisePlugins, ok := featuresData["enterprisePlugins"].(bool); ok {
		features.EnterprisePlugins = model.NewPointer(enterprisePlugins)
	}
	if advancedLogging, ok := featuresData["advancedLogging"].(bool); ok {
		features.AdvancedLogging = model.NewPointer(advancedLogging)
	}
	if cloud, ok := featuresData["cloud"].(bool); ok {
		features.Cloud = model.NewPointer(cloud)
	}
	if sharedChannels, ok := featuresData["sharedChannels"].(bool); ok {
		features.SharedChannels = model.NewPointer(sharedChannels)
	}
	if remoteClusterService, ok := featuresData["remoteClusterService"].(bool); ok {
		features.RemoteClusterService = model.NewPointer(remoteClusterService)
	}
	if outgoingOauthConnections, ok := featuresData["outgoingOauthConnections"].(bool); ok {
		features.OutgoingOAuthConnections = model.NewPointer(outgoingOauthConnections)
	}
	if futureFeatures, ok := featuresData["futureFeatures"].(bool); ok {
		features.FutureFeatures = model.NewPointer(futureFeatures)
	}

	return features
}

// mapKeygenLimits extracts usage limits from Keygen metadata.
// Returns nil if the limits key is missing (limits are optional).
// Uses -1 convention for unlimited values.
func mapKeygenLimits(metadata map[string]any) *model.LicenseLimits {
	limitsData := extractMetadata[map[string]any](metadata, "limits", nil)
	if limitsData == nil {
		return nil
	}

	limits := &model.LicenseLimits{}

	// Extract all limit fields (defaults to 0 if not present)
	limits.PostHistory = extractMetadataInt64(limitsData, "postHistory", 0)
	limits.BoardCards = extractMetadataInt64(limitsData, "boardCards", 0)
	limits.PlaybookRuns = extractMetadataInt64(limitsData, "playbookRuns", 0)
	limits.CallDurationSeconds = extractMetadataInt64(limitsData, "callDurationSeconds", 0)
	limits.AgentsPrompts = extractMetadataInt64(limitsData, "agentsPrompts", 0)
	limits.PushNotifications = extractMetadataInt64(limitsData, "pushNotifications", 0)

	return limits
}

// validateSKU checks if the SKU short name is in the valid set.
func validateSKU(skuShortName string) error {
	if skuShortName == "" {
		return fmt.Errorf("%w: empty SKU short name", ErrKeygenInvalidSKU)
	}
	if !validSKUs[skuShortName] {
		return fmt.Errorf("%w: %s", ErrKeygenInvalidSKU, skuShortName)
	}
	return nil
}

// ConvertKeygenToModelLicense converts Keygen license data to a Mattermost model.License.
// This is the main conversion function that maps all Keygen metadata to the Mattermost license struct.
func ConvertKeygenToModelLicense(data *KeygenLicenseData) (*model.License, error) {
	// Validate input
	if data == nil {
		return nil, fmt.Errorf("keygen license data is nil")
	}
	if data.Metadata == nil {
		return nil, fmt.Errorf("keygen license metadata is nil")
	}

	license := &model.License{}

	// 1. Map ID from Keygen data
	// Convert Keygen UUID to valid Mattermost ID format (26 alphanumeric chars)
	license.Id = convertKeygenIDToMattermostID(data.ID)

	// 2. Map timestamps
	license.IssuedAt = data.Issued.UnixMilli()
	license.StartsAt = license.IssuedAt // Default StartsAt to IssuedAt

	// Check for startsAt override in metadata
	if startsAtStr := extractMetadata[string](data.Metadata, "startsAt", ""); startsAtStr != "" {
		startsAt, err := parseISO8601ToMillis(startsAtStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse startsAt timestamp: %w", err)
		}
		license.StartsAt = startsAt
	}

	// Map expiry from data.Expiry (the actual license subscription expiry)
	if data.Expiry == nil {
		return nil, fmt.Errorf("keygen license expiry is nil (required field)")
	}
	license.ExpiresAt = data.Expiry.UnixMilli()

	// 3. Map customer (required)
	customer, err := mapKeygenCustomer(data.Metadata)
	if err != nil {
		return nil, err
	}
	license.Customer = customer

	// 4. Map features (uses defaults if not specified)
	license.Features = mapKeygenFeatures(data.Metadata)

	// 4b. Apply entitlements (supplements metadata features, never disables)
	// Order is critical: SetDefaults() → metadata override → entitlement supplement
	if len(data.Entitlements) > 0 {
		ApplyEntitlements(license.Features, data.Entitlements)
	}

	// 5. Map SKU info (required)
	skuName, err := extractMetadataRequired[string](data.Metadata, "skuName")
	if err != nil {
		return nil, fmt.Errorf("SKU mapping failed: %w", err)
	}
	license.SkuName = skuName

	skuShortName, err := extractMetadataRequired[string](data.Metadata, "skuShortName")
	if err != nil {
		return nil, fmt.Errorf("SKU mapping failed: %w", err)
	}
	if err := validateSKU(skuShortName); err != nil {
		return nil, err
	}
	license.SkuShortName = skuShortName

	// 6. Map flags (optional, default to false)
	license.IsTrial = extractMetadata(data.Metadata, "isTrial", false)
	license.IsGovSku = extractMetadata(data.Metadata, "isGovSku", false)
	license.IsSeatCountEnforced = extractMetadata(data.Metadata, "isSeatCountEnforced", false)

	// 7. Map optional fields
	// ExtraUsers - only set if present in metadata
	if extraUsers := extractMetadataInt(data.Metadata, "extraUsers", -1); extraUsers >= 0 {
		license.ExtraUsers = model.NewPointer(extraUsers)
	}

	// SignupJWT - only set if present in metadata
	if signupJWT := extractMetadata[string](data.Metadata, "signupJwt", ""); signupJWT != "" {
		license.SignupJWT = model.NewPointer(signupJWT)
	}

	// 8. Map limits (optional)
	license.Limits = mapKeygenLimits(data.Metadata)

	return license, nil
}
