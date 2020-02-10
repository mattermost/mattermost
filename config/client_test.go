// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
)

func TestGetClientConfig(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		description    string
		config         *model.Config
		diagnosticID   string
		license        *model.License
		expectedFields map[string]string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        sToP("ws://mattermost.example.com:8065"),
					WebsocketPort:       iToP(80),
					WebsocketSecurePort: iToP(443),
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
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					ThemeManagement: bToP(false),
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
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					AllowCustomThemes: bToP(false),
				},
			},
			"tag2",
			&model.License{
				Features: &model.Features{
					ThemeManagement: bToP(true),
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
					EnforceMultifactorAuthentication: bToP(true),
				},
			},
			"tag1",
			&model.License{
				Features: &model.Features{
					MFA: bToP(true),
				},
			},
			map[string]string{
				"EnforceMultifactorAuthentication": "true",
			},
		},
		{
			"experimental channel organization enabled",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					ExperimentalChannelOrganization: bToP(true),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"ExperimentalChannelOrganization": "true",
			},
		},
		{
			"experimental channel organization disabled, but experimental group unread channels on",
			&model.Config{
				ServiceSettings: model.ServiceSettings{
					ExperimentalChannelOrganization: bToP(false),
					ExperimentalGroupUnreadChannels: sToP(model.GROUP_UNREAD_CHANNELS_DEFAULT_ON),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"ExperimentalChannelOrganization": "true",
			},
		},
		{
			"default marketplace",
			&model.Config{
				PluginSettings: model.PluginSettings{
					MarketplaceUrl: sToP(model.PLUGIN_SETTINGS_DEFAULT_MARKETPLACE_URL),
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
					MarketplaceUrl: sToP("http://example.com"),
				},
			},
			"tag1",
			nil,
			map[string]string{
				"IsDefaultMarketplace": "false",
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := config.GenerateClientConfig(testCase.config, testCase.diagnosticID, testCase.license)
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
		diagnosticID   string
		license        *model.License
		expectedFields map[string]string
	}{
		{
			"unlicensed",
			&model.Config{
				EmailSettings: model.EmailSettings{
					EmailNotificationContentsType: sToP(model.EMAIL_NOTIFICATION_CONTENTS_FULL),
				},
				ThemeSettings: model.ThemeSettings{
					// Ignored, since not licensed.
					AllowCustomThemes: bToP(false),
				},
				ServiceSettings: model.ServiceSettings{
					WebsocketURL:        sToP("ws://mattermost.example.com:8065"),
					WebsocketPort:       iToP(80),
					WebsocketSecurePort: iToP(443),
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
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.description, func(t *testing.T) {
			t.Parallel()

			testCase.config.SetDefaults()
			if testCase.license != nil {
				testCase.license.Features.SetDefaults()
			}

			configMap := config.GenerateLimitedClientConfig(testCase.config, testCase.diagnosticID, testCase.license)
			for expectedField, expectedValue := range testCase.expectedFields {
				actualValue, ok := configMap[expectedField]
				if assert.True(t, ok, fmt.Sprintf("config does not contain %v", expectedField)) {
					assert.Equal(t, expectedValue, actualValue)
				}
			}
		})
	}
}

func sToP(s string) *string {
	return &s
}

func bToP(b bool) *bool {
	return &b
}

func iToP(i int) *int {
	return &i
}
