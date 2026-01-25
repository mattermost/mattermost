// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

// EntitlementCode represents a Keygen entitlement code.
// Entitlement codes are case-insensitive (normalized to uppercase).
type EntitlementCode string

// Entitlement code constants for all Mattermost feature flags.
// These map to Keygen entitlement codes that can be assigned to licenses.
const (
	EntitlementLDAP                      EntitlementCode = "LDAP"
	EntitlementLDAPGroups                EntitlementCode = "LDAP_GROUPS"
	EntitlementMFA                       EntitlementCode = "MFA"
	EntitlementGoogleOAuth               EntitlementCode = "GOOGLE_OAUTH"
	EntitlementOffice365OAuth            EntitlementCode = "OFFICE365_OAUTH"
	EntitlementOpenID                    EntitlementCode = "OPENID"
	EntitlementCompliance                EntitlementCode = "COMPLIANCE"
	EntitlementCluster                   EntitlementCode = "CLUSTER"
	EntitlementMetrics                   EntitlementCode = "METRICS"
	EntitlementMHPNS                     EntitlementCode = "MHPNS"
	EntitlementSAML                      EntitlementCode = "SAML"
	EntitlementElasticsearch             EntitlementCode = "ELASTICSEARCH"
	EntitlementEmailNotificationContents EntitlementCode = "EMAIL_NOTIFICATION_CONTENTS"
	EntitlementDataRetention             EntitlementCode = "DATA_RETENTION"
	EntitlementMessageExport             EntitlementCode = "MESSAGE_EXPORT"
	EntitlementCustomPermissionsSchemes  EntitlementCode = "CUSTOM_PERMISSIONS_SCHEMES"
	EntitlementCustomTermsOfService      EntitlementCode = "CUSTOM_TERMS_OF_SERVICE"
	EntitlementGuestAccounts             EntitlementCode = "GUEST_ACCOUNTS"
	EntitlementGuestAccountsPermissions  EntitlementCode = "GUEST_ACCOUNTS_PERMISSIONS"
	EntitlementIDLoadedPushNotifications EntitlementCode = "ID_LOADED_PUSH_NOTIFICATIONS"
	EntitlementLockTeammateNameDisplay   EntitlementCode = "LOCK_TEAMMATE_NAME_DISPLAY"
	EntitlementEnterprisePlugins         EntitlementCode = "ENTERPRISE_PLUGINS"
	EntitlementAdvancedLogging           EntitlementCode = "ADVANCED_LOGGING"
	EntitlementCloud                     EntitlementCode = "CLOUD"
	EntitlementSharedChannels            EntitlementCode = "SHARED_CHANNELS"
	EntitlementRemoteClusterService      EntitlementCode = "REMOTE_CLUSTER_SERVICE"
	EntitlementOutgoingOAuthConnections  EntitlementCode = "OUTGOING_OAUTH_CONNECTIONS"
	EntitlementFutureFeatures            EntitlementCode = "FUTURE_FEATURES"
	EntitlementAnnouncement              EntitlementCode = "ANNOUNCEMENT"
	EntitlementThemeManagement           EntitlementCode = "THEME_MANAGEMENT"
)

// entitlementToFeatureField maps entitlement codes to feature field setters.
// Using explicit functions instead of reflection for type safety and performance.
var entitlementToFeatureField = map[EntitlementCode]func(*model.Features){
	EntitlementLDAP:                      func(f *model.Features) { f.LDAP = model.NewPointer(true) },
	EntitlementLDAPGroups:                func(f *model.Features) { f.LDAPGroups = model.NewPointer(true) },
	EntitlementMFA:                       func(f *model.Features) { f.MFA = model.NewPointer(true) },
	EntitlementGoogleOAuth:               func(f *model.Features) { f.GoogleOAuth = model.NewPointer(true) },
	EntitlementOffice365OAuth:            func(f *model.Features) { f.Office365OAuth = model.NewPointer(true) },
	EntitlementOpenID:                    func(f *model.Features) { f.OpenId = model.NewPointer(true) },
	EntitlementCompliance:                func(f *model.Features) { f.Compliance = model.NewPointer(true) },
	EntitlementCluster:                   func(f *model.Features) { f.Cluster = model.NewPointer(true) },
	EntitlementMetrics:                   func(f *model.Features) { f.Metrics = model.NewPointer(true) },
	EntitlementMHPNS:                     func(f *model.Features) { f.MHPNS = model.NewPointer(true) },
	EntitlementSAML:                      func(f *model.Features) { f.SAML = model.NewPointer(true) },
	EntitlementElasticsearch:             func(f *model.Features) { f.Elasticsearch = model.NewPointer(true) },
	EntitlementEmailNotificationContents: func(f *model.Features) { f.EmailNotificationContents = model.NewPointer(true) },
	EntitlementDataRetention:             func(f *model.Features) { f.DataRetention = model.NewPointer(true) },
	EntitlementMessageExport:             func(f *model.Features) { f.MessageExport = model.NewPointer(true) },
	EntitlementCustomPermissionsSchemes:  func(f *model.Features) { f.CustomPermissionsSchemes = model.NewPointer(true) },
	EntitlementCustomTermsOfService:      func(f *model.Features) { f.CustomTermsOfService = model.NewPointer(true) },
	EntitlementGuestAccounts:             func(f *model.Features) { f.GuestAccounts = model.NewPointer(true) },
	EntitlementGuestAccountsPermissions:  func(f *model.Features) { f.GuestAccountsPermissions = model.NewPointer(true) },
	EntitlementIDLoadedPushNotifications: func(f *model.Features) { f.IDLoadedPushNotifications = model.NewPointer(true) },
	EntitlementLockTeammateNameDisplay:   func(f *model.Features) { f.LockTeammateNameDisplay = model.NewPointer(true) },
	EntitlementEnterprisePlugins:         func(f *model.Features) { f.EnterprisePlugins = model.NewPointer(true) },
	EntitlementAdvancedLogging:           func(f *model.Features) { f.AdvancedLogging = model.NewPointer(true) },
	EntitlementCloud:                     func(f *model.Features) { f.Cloud = model.NewPointer(true) },
	EntitlementSharedChannels:            func(f *model.Features) { f.SharedChannels = model.NewPointer(true) },
	EntitlementRemoteClusterService:      func(f *model.Features) { f.RemoteClusterService = model.NewPointer(true) },
	EntitlementOutgoingOAuthConnections:  func(f *model.Features) { f.OutgoingOAuthConnections = model.NewPointer(true) },
	EntitlementFutureFeatures:            func(f *model.Features) { f.FutureFeatures = model.NewPointer(true) },
	EntitlementAnnouncement:              func(f *model.Features) { f.Announcement = model.NewPointer(true) },
	EntitlementThemeManagement:           func(f *model.Features) { f.ThemeManagement = model.NewPointer(true) },
}

// ApplyEntitlements enables features based on Keygen entitlement codes.
// This function only ENABLES features (additive) - it never disables them.
// Entitlements supplement metadata-based features; they represent what the license
// is authorized for.
//
// Entitlement codes are case-insensitive (normalized to uppercase).
// Unknown entitlement codes are silently ignored (lenient mode).
func ApplyEntitlements(features *model.Features, entitlements []string) {
	if features == nil || len(entitlements) == 0 {
		return
	}

	for _, code := range entitlements {
		normalized := EntitlementCode(strings.ToUpper(strings.TrimSpace(code)))
		if setter, ok := entitlementToFeatureField[normalized]; ok {
			setter(features)
		}
		// Unknown entitlements are silently ignored (lenient mode)
	}
}

// GetAllEntitlementCodes returns all supported entitlement codes.
// This is useful for documentation and validation purposes.
func GetAllEntitlementCodes() []EntitlementCode {
	return []EntitlementCode{
		EntitlementLDAP,
		EntitlementLDAPGroups,
		EntitlementMFA,
		EntitlementGoogleOAuth,
		EntitlementOffice365OAuth,
		EntitlementOpenID,
		EntitlementCompliance,
		EntitlementCluster,
		EntitlementMetrics,
		EntitlementMHPNS,
		EntitlementSAML,
		EntitlementElasticsearch,
		EntitlementEmailNotificationContents,
		EntitlementDataRetention,
		EntitlementMessageExport,
		EntitlementCustomPermissionsSchemes,
		EntitlementCustomTermsOfService,
		EntitlementGuestAccounts,
		EntitlementGuestAccountsPermissions,
		EntitlementIDLoadedPushNotifications,
		EntitlementLockTeammateNameDisplay,
		EntitlementEnterprisePlugins,
		EntitlementAdvancedLogging,
		EntitlementCloud,
		EntitlementSharedChannels,
		EntitlementRemoteClusterService,
		EntitlementOutgoingOAuthConnections,
		EntitlementFutureFeatures,
		EntitlementAnnouncement,
		EntitlementThemeManagement,
	}
}
