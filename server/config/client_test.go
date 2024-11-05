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
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: model.NewPointer(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        model.NewPointer("ws://mattermost.example.com:8065"),
					WebsocketPort:       model.NewPointer(80),
					WebsocketSecurePort: model.NewPointer(443),
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
		},
		{
			"licensed, but not for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: model.NewPointer(false),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					ThemeManagement: model.NewPointer(false),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag1",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "true",
			},
		},
		{
			"licensed for theme management",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: model.NewPointer(model.EmailNotificationContentsFull),
				},
				ThemeSettings: model.ThemeSettings{
					AllowCustomThemes: model.NewPointer(false),
				},
			},
			"tag2",
			&model.License{
				Features: &model.Features{
					ThemeManagement: model.NewPointer(true),
				},
			},
			map[string]string{
				"DiagnosticId":                  "tag2",
				"EmailNotificationContentsType": "full",
				"AllowCustomThemes":             "false",
			},
		},
		{
			"licensed for enforcement",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnforceMultifactorAuthentication: model.NewPointer(true),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					MFA: model.NewPointer(true),
				},
			},
			map[string]string{
				"EnforceMultifactorAuthentication": "true",
			},
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
		},
		{
			"non-default marketplace",
			&model.Config{
				PluginSettings: model.PluginSettings{
					MarketplaceURL: model.NewPointer("http://example.com"),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"IsDefaultMarketplace": "false",
			},
		},
		{
			"enable ShowFullName prop",
			&model.Config{
				PrivacySettings: model.PrivacySettings{
					ShowFullName: model.NewPointer(true),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"ShowFullName": "true",
			},
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
		},
		{
			"Shared channels other license",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: model.NewPointer(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: model.NewPointer(false),
				},
				SkuShortName: "other",
			},
			map[string]string{
				"ExperimentalSharedChannels": "false",
			},
		},
		{
			"licensed for shared channels",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: model.NewPointer(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: model.NewPointer(true),
				},
				SkuShortName: "other",
			},
			map[string]string{
				"ExperimentalSharedChannels": "true",
			},
		},
		{
			"Shared channels professional license",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: model.NewPointer(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: model.NewPointer(false),
				},
				SkuShortName: model.LicenseShortSkuProfessional,
			},
			map[string]string{
				"ExperimentalSharedChannels": "true",
			},
		},
		{
			"disable EnableUserStatuses",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					EnableUserStatuses: model.NewPointer(false),
				},
			},
			"",
			nil,
			map[string]string{
				"EnableUserStatuses": "false",
			},
		},
		{
			"Shared channels enterprise license",
			&model.Config{
				ConnectedWorkspacesSettings: model.ConnectedWorkspacesSettings{
					EnableSharedChannels: model.NewPointer(true),
				},
			},
			"",
			&model.License{
				Features: &model.Features{
					SharedChannels: model.NewPointer(false),
				},
				SkuShortName: model.LicenseShortSkuEnterprise,
			},
			map[string]string{
				"ExperimentalSharedChannels": "true",
			},
		},
		{
			"Disable App Bar",
			&model.Config{
				ExperimentalSettings: model.ExperimentalSettings{
					DisableAppBar: model.NewPointer(true),
				},
			},
			"",
			nil,
			map[string]string{
				"DisableAppBar": "true",
			},
		},
		{
			"default EnableJoinLeaveMessage",
			&model.Config{},
			"tag1",
			nil,
			map[string]string{
				"EnableJoinLeaveMessageByDefault": "true",
			},
		},
		{
			"disable EnableJoinLeaveMessage",
			&model.Config{
				TeamSettings: model.TeamSettings{
					EnableJoinLeaveMessageByDefault: model.NewPointer(false),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"EnableJoinLeaveMessageByDefault": "false",
			},
		},
		{
			"test key for GiphySdkKey",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					GiphySdkKey: model.NewPointer(""),
				},
			},
			"",
			nil,
			map[string]string{
				"GiphySdkKey": model.ServiceSettingsDefaultGiphySdkKeyTest,
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

			configMap := GenerateClientConfig(testCase.config, testCase.telemetryID, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				actualValue, ok := configMap[expectedField]
				if assert.True(t, ok, fmt.Sprintf("config does not contain %v", expectedField)) {
					assert.Equal(t, expectedValue, actualValue)
				}
			}
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
					AllowCustomThemes: model.NewPointer(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        model.NewPointer("ws://mattermost.example.com:8065"),
					WebsocketPort:       model.NewPointer(80),
					WebsocketSecurePort: model.NewPointer(443),
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
					MinimumLength: model.NewPointer(15),
					Lowercase:     model.NewPointer(true),
					Uppercase:     model.NewPointer(true),
					Number:        model.NewPointer(true),
					Symbol:        model.NewPointer(false),
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
