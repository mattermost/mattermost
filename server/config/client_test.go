// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetClientConfig(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		description    string
		config         *model.Config
		telemetryID    string
		license        *model.License
		expectedFields map[string]string
		absentFields   []string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: new(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        new("ws://mattermost.example.com:8065"),
					WebsocketPort:       new(80),
					WebsocketSecurePort: new(443),
				},
			},
			"",
			nil,
			map[string]string{
				"DiagnosticId":                     "",
				"EmailNotificationContentsType":    "full",
				"AllowCustomThemes":                "true",
				"EnforceMultifactorAuthentication": "false",
				"WebsocketURL":                     "ws://mattermost.example.com:8065",
				"WebsocketPort":                    "80",
				"WebsocketSecurePort":              "443",
			},
			nil,
		},
		{
			"licensed, but not for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: new(false),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					ThemeManagement: new(false),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag1",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "true",
			},
			nil,
		},
		{
			"licensed for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					AllowCustomThemes: new(false),
				},
			},
			"tag2",
			&model.License{
				Features: &model.Features{
					ThemeManagement: new(true),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag2",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "false",
			},
			nil,
		},
		{
			"licensed for enforcement",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnforceMultifactorAuthentication: new(true),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					MFA: new(true),
				},
			},
			map[string]string{
				"EnforceMultifactorAuthentication": "true",
			},
			nil,
		},
		{
			"default marketplace",
			&model.Config{
				PluginSettings: model.PluginSettings{
					MarketplaceURL: model.NewPointer(model.PluginSettingsDefaultMarketplaceURL),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"IsDefaultMarketplace": "true",
			},
			nil,
		},
		{
			"non-default marketplace",
			&model.Config{
				PluginSettings: model.PluginSettings{
					MarketplaceURL: new("http://example.com"),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"IsDefaultMarketplace": "false",
			},
			nil,
		},
		{
			"enable ShowFullName prop",
			&model.Config{
				PrivacySettings: model.PrivacySettings{
					ShowFullName: new(true),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"ShowFullName": "true",
			},
			nil,
		},
		{
			"enable UseAnonymousURLs prop",
			&model.Config{
				PrivacySettings: model.PrivacySettings{
					UseAnonymousURLs: new(true),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"UseAnonymousURLs": "true",
			},
			nil,
		},
		{
			"Custom groups professional license",
			&model.Config{},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuProfessional,
			},
			map[string]string{
				"EnableCustomGroups": "true",
			},
			nil,
		},
		{
			"Custom groups enterprise license",
			&model.Config{},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterprise,
			},
			map[string]string{
				"EnableCustomGroups": "true",
			},
			nil,
		},
		{
			"Custom groups other license",
			&model.Config{},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: "other",
			},
			map[string]string{
				"EnableCustomGroups": "false",
			},
			nil,
		},
		{
			"Shared channels other license",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: new(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: new(false),
				},
				SkuShortName: "other",
			},
			map[string]string{
				"ExperimentalSharedChannels": "false",
			},
			nil,
		},
		{
			"licensed for shared channels",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: new(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: new(true),
				},
				SkuShortName: "other",
			},
			map[string]string{
				"ExperimentalSharedChannels": "true",
			},
			nil,
		},
		{
			"Shared channels professional license",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: new(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: new(false),
				},
				SkuShortName: model.LicenseShortSkuProfessional,
			},
			map[string]string{
				"ExperimentalSharedChannels": "true",
			},
			nil,
		},
		{
			"disable EnableUserStatuses",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableUserStatuses: new(false),
				},
			},
			"",
			nil,
			map[string]string{
				"EnableUserStatuses": "false",
			},
			nil,
		},
		{
			"Shared channels enterprise license",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: new(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: new(false),
				},
				SkuShortName: model.LicenseShortSkuEnterprise,
			},
			map[string]string{
				"ExperimentalSharedChannels": "true",
			},
			nil,
		},
		{
			"Disable App Bar",
			&model.Config{
				ExperimentalSettings: model.ExperimentalSettings{
					DisableAppBar: new(true),
				},
			},
			"",
			nil,
			map[string]string{
				"DisableAppBar": "true",
			},
			nil,
		},
		{
			"default EnableJoinLeaveMessage",
			&model.Config{},
			"tag1",
			nil,
			map[string]string{
				"EnableJoinLeaveMessageByDefault": "true",
			},
			nil,
		},
		{
			"disable EnableJoinLeaveMessage",
			&model.Config{
				TeamSettings: model.TeamSettings{
					EnableJoinLeaveMessageByDefault: new(false),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"EnableJoinLeaveMessageByDefault": "false",
			},
			nil,
		},
		{
			"test key for GiphySdkKey",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					GiphySdkKey: new(""),
				},
			},
			"",
			nil,
			map[string]string{
				"GiphySdkKey": model.ServiceSettingsDefaultGiphySdkKeyTest,
			},
			nil,
		},
		{
			"report a problem values",
			&model.Config{
				SupportSettings: model.SupportSettings{
					ReportAProblemType: new("type"),
					ReportAProblemLink: new("http://example.com"),
					ReportAProblemMail: new("mail"),
					AllowDownloadLogs:  new(true),
				},
			},
			"",
			nil,
			map[string]string{
				"ReportAProblemType": "type",
				"ReportAProblemLink": "http://example.com",
				"ReportAProblemMail": "mail",
				"AllowDownloadLogs":  "true",
			},
			nil,
		},
		{
			"access control settings enabled",
			&model.Config{
				AccessControlSettings: model.AccessControlSettings{
					EnableAttributeBasedAccessControl: new(true),
					EnableUserManagedAttributes:       new(true),
					EnableChannelPolicyIndicators:     new(true),
				},
			},
			"",
			nil,
			map[string]string{
				"EnableAttributeBasedAccessControl": "true",
				"EnableUserManagedAttributes":       "true",
				"EnableChannelPolicyIndicators":     "true",
			},
			nil,
		},
		{
			"access control settings disabled",
			&model.Config{
				AccessControlSettings: model.AccessControlSettings{
					EnableAttributeBasedAccessControl: new(false),
					EnableUserManagedAttributes:       new(false),
					EnableChannelPolicyIndicators:     new(false),
				},
			},
			"",
			nil,
			map[string]string{
				"EnableAttributeBasedAccessControl": "false",
				"EnableUserManagedAttributes":       "false",
				"EnableChannelPolicyIndicators":     "false",
			},
			nil,
		},
		{
			"access control settings default",
			&model.Config{},
			"",
			nil,
			map[string]string{
				"EnableAttributeBasedAccessControl": "false",
				"EnableUserManagedAttributes":       "false",
				"EnableChannelPolicyIndicators":     "true",
			},
			nil,
		},
		{
			"burn on read enabled",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableBurnOnRead:          new(true),
					BurnOnReadDurationSeconds: new(1800), // 30 minutes in seconds
				},
			},
			"",
			nil,
			map[string]string{
				"EnableBurnOnRead":          "true",
				"BurnOnReadDurationSeconds": "1800",
			},
			nil,
		},
		{
			"burn on read disabled",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableBurnOnRead:          new(false),
					BurnOnReadDurationSeconds: new(600), // 10 minutes in seconds
				},
			},
			"",
			nil,
			map[string]string{
				"EnableBurnOnRead":          "false",
				"BurnOnReadDurationSeconds": "600",
			},
			nil,
		},
		{
			"burn on read default",
			&model.Config{},
			"",
			nil,
			map[string]string{
				"EnableBurnOnRead":          "true",
				"BurnOnReadDurationSeconds": "600", // 10 minutes in seconds
			},
			nil,
		},
		{
			"mobile watermark uses experimental settings",
			&model.Config{
				ExperimentalSettings: model.ExperimentalSettings{
					EnableWatermark: new(true),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterprise,
			},
			map[string]string{
				"ExperimentalEnableWatermark": "true",
			},
			nil,
		},
		{
			"Intune MAM enabled with Enterprise Advanced license and Office365 AuthService",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: model.NewPointer(model.ServiceOffice365),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"IntuneMAMEnabled": "true",
				"IntuneScope":      "api://87654321-4321-4321-4321-210987654321/login.mattermost",
			},
			nil,
		},
		{
			"Intune MAM disabled when not enabled",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(false),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: model.NewPointer(model.ServiceOffice365),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"IntuneMAMEnabled": "false",
			},
			nil,
		},
		{
			"Intune MAM disabled when TenantId is missing",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new(""),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: model.NewPointer(model.ServiceOffice365),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"IntuneMAMEnabled": "false",
			},
			nil,
		},
		{
			"Intune MAM disabled when ClientId is missing",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new(""),
					AuthService: model.NewPointer(model.ServiceOffice365),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"IntuneMAMEnabled": "false",
			},
			nil,
		},
		{
			"Intune MAM not exposed with lower license tier",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: model.NewPointer(model.ServiceOffice365),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuProfessional,
			},
			map[string]string{},
			[]string{"IntuneMAMEnabled", "IntuneScope"},
		},
		{
			"Intune MAM not exposed without license",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: model.NewPointer(model.ServiceOffice365),
				},
			},
			"",
			nil,
			map[string]string{},
			[]string{"IntuneMAMEnabled", "IntuneScope"},
		},
		{
			"Intune MAM enabled with Enterprise Advanced license and SAML AuthService",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: model.NewPointer(model.UserAuthServiceSaml),
				},
				SamlSettings: model.SamlSettings{
					Enable: new(true),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"IntuneMAMEnabled":  "true",
				"IntuneScope":       "api://87654321-4321-4321-4321-210987654321/login.mattermost",
				"IntuneAuthService": "saml",
			},
			nil,
		},
		{
			"Intune MAM disabled when AuthService is missing",
			&model.Config{
				IntuneSettings: model.IntuneSettings{
					Enable:      new(true),
					TenantId:    new("12345678-1234-1234-1234-123456789012"),
					ClientId:    new("87654321-4321-4321-4321-210987654321"),
					AuthService: new(""),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"IntuneMAMEnabled": "false",
			},
			nil,
		},
		{
			"Mobile Ephemeral Mode enabled with custom values",
			&model.Config{
				FeatureFlags: &model.FeatureFlags{MobileEphemeralMode: true},
				MobileEphemeralModeSettings: model.MobileEphemeralModeSettings{
					Enable:                       model.NewPointer(true),
					DisconnectionTimeoutSeconds:  model.NewPointer(120),
					OfflinePersistenceTimerHours: model.NewPointer(48),
					AutoCacheCleanupDays:         model.NewPointer(14),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"MobileEphemeralModeEnabled":                      "true",
				"MobileEphemeralModeDisconnectionTimeoutSeconds":  "120",
				"MobileEphemeralModeOfflinePersistenceTimerHours": "48",
				"MobileEphemeralModeAutoCacheCleanupDays":         "14",
			},
			nil,
		},
		{
			"Mobile Ephemeral Mode disabled still exposes parameters",
			&model.Config{
				FeatureFlags: &model.FeatureFlags{MobileEphemeralMode: true},
				MobileEphemeralModeSettings: model.MobileEphemeralModeSettings{
					Enable:                       model.NewPointer(false),
					DisconnectionTimeoutSeconds:  model.NewPointer(60),
					OfflinePersistenceTimerHours: model.NewPointer(24),
					AutoCacheCleanupDays:         model.NewPointer(7),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{
				"MobileEphemeralModeEnabled":                      "false",
				"MobileEphemeralModeDisconnectionTimeoutSeconds":  "60",
				"MobileEphemeralModeOfflinePersistenceTimerHours": "24",
				"MobileEphemeralModeAutoCacheCleanupDays":         "7",
			},
			nil,
		},
		{
			"Mobile Ephemeral Mode not exposed when feature flag is off",
			&model.Config{
				FeatureFlags: &model.FeatureFlags{MobileEphemeralMode: false},
				MobileEphemeralModeSettings: model.MobileEphemeralModeSettings{
					Enable: model.NewPointer(true),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterpriseAdvanced,
			},
			map[string]string{},
			[]string{"MobileEphemeralModeEnabled", "MobileEphemeralModeDisconnectionTimeoutSeconds", "MobileEphemeralModeOfflinePersistenceTimerHours", "MobileEphemeralModeAutoCacheCleanupDays"},
		},
		{
			"Mobile Ephemeral Mode not exposed without license",
			&model.Config{
				FeatureFlags: &model.FeatureFlags{MobileEphemeralMode: true},
				MobileEphemeralModeSettings: model.MobileEphemeralModeSettings{
					Enable: model.NewPointer(true),
				},
			},
			"",
			nil,
			map[string]string{},
			[]string{"MobileEphemeralModeEnabled", "MobileEphemeralModeDisconnectionTimeoutSeconds", "MobileEphemeralModeOfflinePersistenceTimerHours", "MobileEphemeralModeAutoCacheCleanupDays"},
		},
		{
			"Mobile Ephemeral Mode not exposed with lower license tier",
			&model.Config{
				FeatureFlags: &model.FeatureFlags{MobileEphemeralMode: true},
				MobileEphemeralModeSettings: model.MobileEphemeralModeSettings{
					Enable: model.NewPointer(true),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuProfessional,
			},
			map[string]string{},
			[]string{"MobileEphemeralModeEnabled", "MobileEphemeralModeDisconnectionTimeoutSeconds", "MobileEphemeralModeOfflinePersistenceTimerHours", "MobileEphemeralModeAutoCacheCleanupDays"},
		},
		{
			"notification metrics enabled follows the metrics setting",
			&model.Config{
				MetricsSettings: model.MetricsSettings{
					Enable:                    new(true),
					EnableNotificationMetrics: new(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					Cluster: new(true),
				},
			},
			map[string]string{
				"EnableMetrics":             "true",
				"EnableNotificationMetrics": "true",
			},
			nil,
		},
		{
			"notification metrics disabled follows the metrics setting",
			&model.Config{
				MetricsSettings: model.MetricsSettings{
					Enable:                    new(true),
					EnableNotificationMetrics: new(false),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					Cluster: new(true),
				},
			},
			map[string]string{
				"EnableMetrics":             "true",
				"EnableNotificationMetrics": "false",
			},
			nil,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := GenerateClientConfig(testCase.config, testCase.telemetryID, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				actualValue, ok := configMap[expectedField]
				if assert.True(t, ok, fmt.Sprintf("config does not contain %v", expectedField)) {
					assert.Equal(t, expectedValue, actualValue)
				}
			}
			for _, absentField := range testCase.absentFields {
				_, ok := configMap[absentField]
				assert.False(t, ok, fmt.Sprintf("config should not contain %v", absentField))
			}
		})
	}
}

func TestGenerateClientConfigLockProfileFieldsForEmailUsers(t *testing.T) {
	for name, testCase := range map[string]struct {
		license  *model.License
		expected string
	}{
		"unlicensed":   {expected: model.TeamSettingsLockProfileFieldsNone},
		"professional": {license: model.NewTestLicenseSKU(model.LicenseShortSkuProfessional), expected: model.TeamSettingsLockProfileFieldsNone},
		"enterprise":   {license: model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise), expected: model.TeamSettingsLockProfileFieldsAll},
	} {
		t.Run(name, func(t *testing.T) {
			config := &model.Config{}
			config.SetDefaults()
			config.TeamSettings.LockProfileFieldsForEmailUsers = model.NewPointer(model.TeamSettingsLockProfileFieldsAll)

			clientConfig := GenerateClientConfig(config, "", testCase.license)
			assert.Equal(t, testCase.expected, clientConfig["LockProfileFieldsForEmailUsers"])
		})
	}
}

func TestGetLimitedClientConfig(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		description    string
		config         *model.Config
		telemetryID    string
		license        *model.License
		expectedFields map[string]string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: new(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        new("ws://mattermost.example.com:8065"),
					WebsocketPort:       new(80),
					WebsocketSecurePort: new(443),
				},
			},
			"",
			nil,
			map[string]string{
				"DiagnosticId":                     "",
				"EnforceMultifactorAuthentication": "false",
				"WebsocketURL":                     "ws://mattermost.example.com:8065",
				"WebsocketPort":                    "80",
				"WebsocketSecurePort":              "443",
			},
		},
		{
			"password settings",
			&model.Config{
				PasswordSettings: model.PasswordSettings{
					MinimumLength: new(15),
					Lowercase:     new(true),
					Uppercase:     new(true),
					Number:        new(true),
					Symbol:        new(false),
				},
			},
			"",
			nil,
			map[string]string{
				"PasswordMinimumLength":    "15",
				"PasswordRequireLowercase": "true",
				"PasswordRequireUppercase": "true",
				"PasswordRequireNumber":    "true",
				"PasswordRequireSymbol":    "false",
			},
		},
		{
			"Feature Flags",
			&model.Config{
				FeatureFlags: &model.FeatureFlags{
					TestFeature: "myvalue",
				},
			},
			"",
			nil,
			map[string]string{
				"FeatureFlagTestFeature": "myvalue",
			},
		},
		{
			"limited config mobile watermark uses experimental settings",
			&model.Config{
				ExperimentalSettings: model.ExperimentalSettings{
					EnableWatermark: new(true),
				},
			},
			"",
			&model.License{
				Features:     &model.Features{},
				SkuShortName: model.LicenseShortSkuEnterprise,
			},
			map[string]string{
				"ExperimentalEnableWatermark": "true",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := GenerateLimitedClientConfig(testCase.config, testCase.telemetryID, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				actualValue, ok := configMap[expectedField]
				if assert.True(t, ok, fmt.Sprintf("config does not contain %v", expectedField)) {
					assert.Equal(t, expectedValue, actualValue)
				}
			}
		})
	}
}
