// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigDefaults(t *testing.T) {
	t.Parallel()

	t.Run("somewhere nil when uninitialized", func(t *testing.T) {
		c := Config{}
		require.False(t, checkNowhereNil(t, "config", c))
	})

	t.Run("nowhere nil when initialized", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()
		require.True(t, checkNowhereNil(t, "config", c))
	})

	t.Run("nowhere nil when partially initialized", func(t *testing.T) {
		var recursivelyUninitialize func(*Config, string, reflect.Value)
		recursivelyUninitialize = func(config *Config, name string, v reflect.Value) {
			if v.Type().Kind() == reflect.Ptr {
				// Ignoring these 2 settings.
				// TODO: remove them completely in v8.0.
				if name == "config.BleveSettings.BulkIndexingTimeWindowSeconds" ||
					name == "config.ElasticsearchSettings.BulkIndexingTimeWindowSeconds" {
					return
				}

				// Set every pointer we find in the tree to nil
				v.Set(reflect.Zero(v.Type()))
				require.True(t, v.IsNil())

				// SetDefaults on the root config should make it non-nil, otherwise
				// it means that SetDefaults isn't being called recursively in
				// all cases.
				config.SetDefaults()
				if assert.False(t, v.IsNil(), "%s should be non-nil after SetDefaults()", name) {
					recursivelyUninitialize(config, fmt.Sprintf("(*%s)", name), v.Elem())
				}
			} else if v.Type().Kind() == reflect.Struct {
				for i := 0; i < v.NumField(); i++ {
					recursivelyUninitialize(config, fmt.Sprintf("%s.%s", name, v.Type().Field(i).Name), v.Field(i))
				}
			}
		}

		c := Config{}
		c.SetDefaults()
		recursivelyUninitialize(&c, "config", reflect.ValueOf(&c).Elem())
	})
	t.Run("report a problem defaults", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()
		require.Equal(t, SupportSettingsDefaultReportAProblemType, *c.SupportSettings.ReportAProblemType)
		require.Equal(t, SupportSettingsDefaultReportAProblemLink, *c.SupportSettings.ReportAProblemLink)
		require.Equal(t, "", *c.SupportSettings.ReportAProblemMail)
		require.Equal(t, true, *c.SupportSettings.AllowDownloadLogs)
	})
}

func TestConfigIsValid(t *testing.T) {
	t.Run("report a problem values", func(t *testing.T) {
		t.Run("email", func(t *testing.T) {
			c := Config{}
			c.SetDefaults()
			c.SupportSettings.ReportAProblemType = NewPointer(string(SupportSettingsReportAProblemTypeMail))
			c.SupportSettings.ReportAProblemMail = nil
			require.NotNil(t, c.IsValid())

			c.SupportSettings.ReportAProblemMail = NewPointer("")
			require.NotNil(t, c.IsValid())

			c.SupportSettings.ReportAProblemMail = NewPointer("invalid")
			require.NotNil(t, c.IsValid())

			c.SupportSettings.ReportAProblemMail = NewPointer("valid@email.com")
			require.Nil(t, c.IsValid())
		})

		t.Run("link", func(t *testing.T) {
			c := Config{}
			c.SetDefaults()
			c.SupportSettings.ReportAProblemType = NewPointer(string(SupportSettingsReportAProblemTypeLink))
			c.SupportSettings.ReportAProblemLink = nil
			require.NotNil(t, c.IsValid())

			c.SupportSettings.ReportAProblemLink = NewPointer("")
			require.NotNil(t, c.IsValid())

			c.SupportSettings.ReportAProblemLink = NewPointer("invalid")
			require.NotNil(t, c.IsValid())

			c.SupportSettings.ReportAProblemLink = NewPointer("http://valid.com")
			require.Nil(t, c.IsValid())
		})
	})
}

func TestConfigEmptySiteName(t *testing.T) {
	c1 := Config{
		TeamSettings: TeamSettings{
			SiteName: NewPointer(""),
		},
	}
	c1.SetDefaults()

	require.Equal(t, *c1.TeamSettings.SiteName, TeamSettingsDefaultSiteName)
}

func TestServiceSettingsIsValid(t *testing.T) {
	for name, test := range map[string]struct {
		ServiceSettings ServiceSettings
		ExpectError     bool
	}{
		"empty": {
			ServiceSettings: ServiceSettings{},
			ExpectError:     false,
		},
		"OutgoingIntegrationRequestsTimeout is negative": {
			ServiceSettings: ServiceSettings{
				OutgoingIntegrationRequestsTimeout: NewPointer(int64(-1)),
			},
			ExpectError: true,
		},
		"OutgoingIntegrationRequestsTimeout is zero": {
			ServiceSettings: ServiceSettings{
				OutgoingIntegrationRequestsTimeout: NewPointer(int64(0)),
			},
			ExpectError: true,
		},
		"OutgoingIntegrationRequestsTimeout is positiv": {
			ServiceSettings: ServiceSettings{
				OutgoingIntegrationRequestsTimeout: NewPointer(int64(1)),
			},
			ExpectError: false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			test.ServiceSettings.SetDefaults(false)

			appErr := test.ServiceSettings.isValid()
			if test.ExpectError {
				assert.NotNil(t, appErr)
			} else {
				assert.Nil(t, appErr)
			}
		})
	}
}

func TestConfigEnableDeveloper(t *testing.T) {
	testCases := []struct {
		Description     string
		EnableDeveloper *bool
		ExpectedSiteURL string
	}{
		{"enable developer is true", NewPointer(true), ServiceSettingsDefaultSiteURL},
		{"enable developer is false", NewPointer(false), ""},
		{"enable developer is nil", nil, ""},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			c1 := Config{
				ServiceSettings: ServiceSettings{
					EnableDeveloper: testCase.EnableDeveloper,
				},
			}
			c1.SetDefaults()

			require.Equal(t, testCase.ExpectedSiteURL, *c1.ServiceSettings.SiteURL)
		})
	}
}

func TestConfigDefaultFileSettingsDirectory(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	require.Equal(t, *c1.FileSettings.Directory, "./data/")
}

func TestConfigDefaultEmailNotificationContentsType(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	require.Equal(t, *c1.EmailSettings.EmailNotificationContentsType, EmailNotificationContentsFull)
}

func TestConfigDefaultFileSettingsS3SSE(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	require.False(t, *c1.FileSettings.AmazonS3SSE)
}

func TestConfigDefaultSignatureAlgorithm(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	require.Equal(t, *c1.SamlSettings.SignatureAlgorithm, SamlSettingsDefaultSignatureAlgorithm)
	require.Equal(t, *c1.SamlSettings.CanonicalAlgorithm, SamlSettingsDefaultCanonicalAlgorithm)
}

func TestConfigOverwriteSignatureAlgorithm(t *testing.T) {
	const testAlgorithm = "FakeAlgorithm"
	c1 := Config{
		SamlSettings: SamlSettings{
			CanonicalAlgorithm: NewPointer(testAlgorithm),
			SignatureAlgorithm: NewPointer(testAlgorithm),
		},
	}

	c1.SetDefaults()

	require.Equal(t, *c1.SamlSettings.SignatureAlgorithm, testAlgorithm)
	require.Equal(t, *c1.SamlSettings.CanonicalAlgorithm, testAlgorithm)
}

func TestWranglerSettingsIsValid(t *testing.T) {
	// // Test valid domains
	w := &WranglerSettings{
		AllowedEmailDomain: []string{"example.com", "subdomain.example.com"},
	}
	if err := w.IsValid(); err != nil {
		t.Errorf("Expected no error for valid domains, but got %v", err)
	}

	// Test invalid domains
	w = &WranglerSettings{
		AllowedEmailDomain: []string{"example", "example..com", "example-.com", "-example.com", "example.com.", "example.com-"},
	}
	if err := w.IsValid(); err == nil {
		t.Errorf("Expected error for invalid domains, but got none")
	}
}

func TestConfigIsValidDefaultAlgorithms(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	*c1.SamlSettings.Enable = true
	*c1.SamlSettings.Verify = false
	*c1.SamlSettings.Encrypt = false

	*c1.SamlSettings.IdpURL = "http://test.url.com"
	*c1.SamlSettings.IdpDescriptorURL = "http://test.url.com"
	*c1.SamlSettings.IdpCertificateFile = "certificatefile"
	*c1.SamlSettings.ServiceProviderIdentifier = "http://test.url.com"
	*c1.SamlSettings.EmailAttribute = "Email"
	*c1.SamlSettings.UsernameAttribute = "Username"

	appErr := c1.SamlSettings.isValid()
	require.Nil(t, appErr)
}

func TestConfigServiceProviderDefault(t *testing.T) {
	c1 := &Config{
		SamlSettings: SamlSettings{
			Enable:             NewPointer(true),
			Verify:             NewPointer(false),
			Encrypt:            NewPointer(false),
			IdpURL:             NewPointer("http://test.url.com"),
			IdpDescriptorURL:   NewPointer("http://test2.url.com"),
			IdpCertificateFile: NewPointer("certificatefile"),
			EmailAttribute:     NewPointer("Email"),
			UsernameAttribute:  NewPointer("Username"),
		},
	}

	c1.SetDefaults()
	assert.Equal(t, *c1.SamlSettings.ServiceProviderIdentifier, *c1.SamlSettings.IdpDescriptorURL)

	appErr := c1.SamlSettings.isValid()
	require.Nil(t, appErr)
}

func TestConfigIsValidFakeAlgorithm(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	*c1.SamlSettings.Enable = true
	*c1.SamlSettings.Verify = false
	*c1.SamlSettings.Encrypt = false

	*c1.SamlSettings.IdpURL = "http://test.url.com"
	*c1.SamlSettings.IdpDescriptorURL = "http://test.url.com"
	*c1.SamlSettings.IdpMetadataURL = "http://test.url.com"
	*c1.SamlSettings.IdpCertificateFile = "certificatefile"
	*c1.SamlSettings.ServiceProviderIdentifier = "http://test.url.com"
	*c1.SamlSettings.EmailAttribute = "Email"
	*c1.SamlSettings.UsernameAttribute = "Username"

	temp := *c1.SamlSettings.CanonicalAlgorithm
	*c1.SamlSettings.CanonicalAlgorithm = "Fake Algorithm"
	appErr := c1.SamlSettings.isValid()
	require.NotNil(t, appErr)

	require.Equal(t, "model.config.is_valid.saml_canonical_algorithm.app_error", appErr.Message)
	*c1.SamlSettings.CanonicalAlgorithm = temp

	*c1.SamlSettings.SignatureAlgorithm = "Fake Algorithm"
	appErr = c1.SamlSettings.isValid()
	require.NotNil(t, appErr)

	require.Equal(t, "model.config.is_valid.saml_signature_algorithm.app_error", appErr.Message)
}

func TestConfigOverwriteGuestSettings(t *testing.T) {
	const attribute = "FakeAttributeName"
	c1 := Config{
		SamlSettings: SamlSettings{
			GuestAttribute: NewPointer(attribute),
		},
	}

	c1.SetDefaults()

	require.Equal(t, *c1.SamlSettings.GuestAttribute, attribute)
}

func TestConfigOverwriteAdminSettings(t *testing.T) {
	const attribute = "FakeAttributeName"
	c1 := Config{
		SamlSettings: SamlSettings{
			AdminAttribute: NewPointer(attribute),
		},
	}

	c1.SetDefaults()

	require.Equal(t, *c1.SamlSettings.AdminAttribute, attribute)
}

func TestConfigDefaultServiceSettingsExperimentalGroupUnreadChannels(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	require.Equal(t, *c1.ServiceSettings.ExperimentalGroupUnreadChannels, GroupUnreadChannelsDisabled)

	// This setting was briefly a boolean, so ensure that those values still work as expected
	c1 = Config{
		ServiceSettings: ServiceSettings{
			ExperimentalGroupUnreadChannels: NewPointer("1"),
		},
	}
	c1.SetDefaults()

	require.Equal(t, *c1.ServiceSettings.ExperimentalGroupUnreadChannels, GroupUnreadChannelsDefaultOn)

	c1 = Config{
		ServiceSettings: ServiceSettings{
			ExperimentalGroupUnreadChannels: NewPointer("0"),
		},
	}
	c1.SetDefaults()

	require.Equal(t, *c1.ServiceSettings.ExperimentalGroupUnreadChannels, GroupUnreadChannelsDisabled)
}

func TestConfigDefaultNPSPluginState(t *testing.T) {
	t.Run("should enable NPS plugin by default", func(t *testing.T) {
		c1 := Config{}
		c1.SetDefaults()

		assert.True(t, c1.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
	})

	t.Run("should enable NPS plugin if diagnostics are enabled", func(t *testing.T) {
		c1 := Config{
			LogSettings: LogSettings{
				EnableDiagnostics: NewPointer(true),
			},
		}

		c1.SetDefaults()

		assert.True(t, c1.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
	})

	t.Run("should not enable NPS plugin if diagnostics are disabled", func(t *testing.T) {
		c1 := Config{
			LogSettings: LogSettings{
				EnableDiagnostics: NewPointer(false),
			},
		}

		c1.SetDefaults()

		assert.False(t, c1.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
	})

	t.Run("should not re-enable NPS plugin after it has been disabled", func(t *testing.T) {
		c1 := Config{
			PluginSettings: PluginSettings{
				PluginStates: map[string]*PluginState{
					"com.mattermost.nps": {
						Enable: false,
					},
				},
			},
		}

		c1.SetDefaults()

		assert.False(t, c1.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
	})
}

func TestConfigDefaultChannelExportPluginState(t *testing.T) {
	t.Run("should not enable ChannelExport plugin by default", func(t *testing.T) {
		BuildEnterpriseReady = "true"
		c1 := Config{}
		c1.SetDefaults()

		assert.Nil(t, c1.PluginSettings.PluginStates["com.mattermost.plugin-channel-export"])
	})
}

func TestTeamSettingsIsValidSiteNameEmpty(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()
	c1.TeamSettings.SiteName = NewPointer("")

	// should not fail if ts.SiteName is not set, defaults are used
	require.Nil(t, c1.TeamSettings.isValid())
}

func TestTeamSettingsDefaultJoinLeaveMessage(t *testing.T) {
	c1 := Config{}
	c1.SetDefaults()

	// should default to true
	require.Equal(t, NewPointer(true), c1.TeamSettings.EnableJoinLeaveMessageByDefault)
}

func TestMessageExportSettingsIsValidEnableExportNotSet(t *testing.T) {
	mes := &MessageExportSettings{}

	// should fail fast because mes.EnableExport is not set
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidEnableExportFalse(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport: NewPointer(false),
	}

	// should fail fast because message export isn't enabled
	require.Nil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidExportFromTimestampInvalid(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport: NewPointer(true),
	}

	// should fail fast because export from timestamp isn't set
	require.NotNil(t, mes.isValid())

	mes.ExportFromTimestamp = NewPointer(int64(-1))

	// should fail fast because export from timestamp isn't valid
	require.NotNil(t, mes.isValid())

	mes.ExportFromTimestamp = NewPointer(GetMillis() + 10000)

	// should fail fast because export from timestamp is greater than current time
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidDailyRunTimeInvalid(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFromTimestamp: NewPointer(int64(0)),
	}

	// should fail fast because daily runtime isn't set
	require.NotNil(t, mes.isValid())

	mes.DailyRunTime = NewPointer("33:33:33")

	// should fail fast because daily runtime is invalid format
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidBatchSizeInvalid(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFromTimestamp: NewPointer(int64(0)),
		DailyRunTime:        NewPointer("15:04"),
	}

	// should fail fast because batch size isn't set
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidExportFormatInvalid(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFromTimestamp: NewPointer(int64(0)),
		DailyRunTime:        NewPointer("15:04"),
		BatchSize:           NewPointer(100),
	}

	// should fail fast because export format isn't set
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidGlobalRelayEmailAddressInvalid(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFormat:        NewPointer(ComplianceExportTypeGlobalrelay),
		ExportFromTimestamp: NewPointer(int64(0)),
		DailyRunTime:        NewPointer("15:04"),
		BatchSize:           NewPointer(100),
	}

	// should fail fast because global relay email address isn't set
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidActiance(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFormat:        NewPointer(ComplianceExportTypeActiance),
		ExportFromTimestamp: NewPointer(int64(0)),
		DailyRunTime:        NewPointer("15:04"),
		BatchSize:           NewPointer(100),
	}

	// should pass because everything is valid
	require.Nil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsMissing(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFormat:        NewPointer(ComplianceExportTypeGlobalrelay),
		ExportFromTimestamp: NewPointer(int64(0)),
		DailyRunTime:        NewPointer("15:04"),
		BatchSize:           NewPointer(100),
	}

	// should fail because globalrelay settings are missing
	require.NotNil(t, mes.isValid())
}

func TestMessageExportSettingsIsValidGlobalRelaySettingsInvalidCustomerType(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFormat:        NewPointer(ComplianceExportTypeGlobalrelay),
		ExportFromTimestamp: NewPointer(int64(0)),
		DailyRunTime:        NewPointer("15:04"),
		BatchSize:           NewPointer(100),
		GlobalRelaySettings: &GlobalRelayMessageExportSettings{
			CustomerType: NewPointer("Invalid"),
			EmailAddress: NewPointer("valid@mattermost.com"),
			SMTPUsername: NewPointer("SomeUsername"),
			SMTPPassword: NewPointer("SomePassword"),
		},
	}

	// should fail because customer type is invalid
	require.NotNil(t, mes.isValid())
}

// func TestMessageExportSettingsIsValidGlobalRelaySettingsInvalidEmailAddress(t *testing.T) {
func TestMessageExportSettingsGlobalRelaySettings(t *testing.T) {
	tests := []struct {
		name    string
		value   *GlobalRelayMessageExportSettings
		success bool
	}{
		{
			"Invalid email address",
			&GlobalRelayMessageExportSettings{
				CustomerType: NewPointer(GlobalrelayCustomerTypeA9),
				EmailAddress: NewPointer("invalidEmailAddress"),
				SMTPUsername: NewPointer("SomeUsername"),
				SMTPPassword: NewPointer("SomePassword"),
			},
			false,
		},
		{
			"Missing smtp username",
			&GlobalRelayMessageExportSettings{
				CustomerType: NewPointer(GlobalrelayCustomerTypeA10),
				EmailAddress: NewPointer("valid@mattermost.com"),
				SMTPPassword: NewPointer("SomePassword"),
			},
			false,
		},
		{
			"Invalid smtp username",
			&GlobalRelayMessageExportSettings{
				CustomerType: NewPointer(GlobalrelayCustomerTypeA10),
				EmailAddress: NewPointer("valid@mattermost.com"),
				SMTPUsername: NewPointer(""),
				SMTPPassword: NewPointer("SomePassword"),
			},
			false,
		},
		{
			"Invalid smtp password",
			&GlobalRelayMessageExportSettings{
				CustomerType: NewPointer(GlobalrelayCustomerTypeA10),
				EmailAddress: NewPointer("valid@mattermost.com"),
				SMTPUsername: NewPointer("SomeUsername"),
				SMTPPassword: NewPointer(""),
			},
			false,
		},
		{
			"Valid data",
			&GlobalRelayMessageExportSettings{
				CustomerType: NewPointer(GlobalrelayCustomerTypeA9),
				EmailAddress: NewPointer("valid@mattermost.com"),
				SMTPUsername: NewPointer("SomeUsername"),
				SMTPPassword: NewPointer("SomePassword"),
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mes := &MessageExportSettings{
				EnableExport:        NewPointer(true),
				ExportFormat:        NewPointer(ComplianceExportTypeGlobalrelay),
				ExportFromTimestamp: NewPointer(int64(0)),
				DailyRunTime:        NewPointer("15:04"),
				BatchSize:           NewPointer(100),
				GlobalRelaySettings: tt.value,
			}

			if tt.success {
				require.Nil(t, mes.isValid())
			} else {
				require.NotNil(t, mes.isValid())
			}
		})
	}
}

func TestMessageExportSetDefaults(t *testing.T) {
	mes := &MessageExportSettings{}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
	require.Equal(t, ComplianceExportTypeActiance, *mes.ExportFormat)
}

func TestMessageExportSetDefaultsExportEnabledExportFromTimestampNil(t *testing.T) {
	// Test retained as protection against regression of MM-13185
	mes := &MessageExportSettings{
		EnableExport: NewPointer(true),
	}
	mes.SetDefaults()

	require.True(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.True(t, *mes.ExportFromTimestamp <= GetMillis())
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportEnabledExportFromTimestampZero(t *testing.T) {
	// Test retained as protection against regression of MM-13185
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFromTimestamp: NewPointer(int64(0)),
	}
	mes.SetDefaults()

	require.True(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.True(t, *mes.ExportFromTimestamp <= GetMillis())
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportEnabledExportFromTimestampNonZero(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(true),
		ExportFromTimestamp: NewPointer(int64(12345)),
	}
	mes.SetDefaults()

	require.True(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(12345), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportDisabledExportFromTimestampNil(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport: NewPointer(false),
	}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportDisabledExportFromTimestampZero(t *testing.T) {
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(false),
		ExportFromTimestamp: NewPointer(int64(0)),
	}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(0), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestMessageExportSetDefaultsExportDisabledExportFromTimestampNonZero(t *testing.T) {
	// Test retained as protection against regression of MM-13185
	mes := &MessageExportSettings{
		EnableExport:        NewPointer(false),
		ExportFromTimestamp: NewPointer(int64(12345)),
	}
	mes.SetDefaults()

	require.False(t, *mes.EnableExport)
	require.Equal(t, "01:00", *mes.DailyRunTime)
	require.Equal(t, int64(12345), *mes.ExportFromTimestamp)
	require.Equal(t, 10000, *mes.BatchSize)
}

func TestDisplaySettingsIsValidCustomURLSchemes(t *testing.T) {
	tests := []struct {
		name  string
		value []string
		valid bool
	}{
		{
			name:  "empty",
			value: []string{},
			valid: true,
		},
		{
			name:  "custom protocol",
			value: []string{"steam"},
			valid: true,
		},
		{
			name:  "multiple custom protocols",
			value: []string{"bitcoin", "rss", "redis"},
			valid: true,
		},
		{
			name:  "containing numbers",
			value: []string{"ut2004", "ts3server", "h323"},
			valid: true,
		},
		{
			name:  "containing period",
			value: []string{"iris.beep"},
			valid: true,
		},
		{
			name:  "containing hyphen",
			value: []string{"ms-excel"},
			valid: true,
		},
		{
			name:  "containing plus",
			value: []string{"coap+tcp", "coap+ws"},
			valid: true,
		},
		{
			name:  "starting with number",
			value: []string{"4four"},
			valid: false,
		},
		{
			name:  "starting with period",
			value: []string{"data", ".dot"},
			valid: false,
		},
		{
			name:  "starting with hyphen",
			value: []string{"-hyphen", "dns"},
			valid: false,
		},
		{
			name:  "invalid symbols",
			value: []string{"!!fun!!"},
			valid: false,
		},
		{
			name:  "invalid letters",
			value: []string{"école"},
			valid: false,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ds := &DisplaySettings{}
			ds.SetDefaults()

			ds.CustomURLSchemes = test.value

			if appErr := ds.isValid(); appErr != nil && test.valid {
				t.Error("Expected CustomURLSchemes to be valid but got error:", appErr)
			} else if appErr == nil && !test.valid {
				t.Error("Expected CustomURLSchemes to be invalid but got no error")
			}
		})
	}
}

func TestListenAddressIsValidated(t *testing.T) {
	testValues := map[string]bool{
		":8065":                true,
		":9917":                true,
		"0.0.0.0:9917":         true,
		"[2001:db8::68]:9918":  true,
		"[::1]:8065":           true,
		"localhost:8065":       true,
		"test.com:8065":        true,
		":0":                   true,
		":33147":               true,
		"123:8065":             false,
		"[::1]:99999":          false,
		"[::1]:-1":             false,
		"[::1]:8065a":          false,
		"0.0.0:9917":           false,
		"0.0.0.0:9917/":        false,
		"0..0.0:9917/":         false,
		"0.0.0222.0:9917/":     false,
		"http://0.0.0.0:9917/": false,
		"http://0.0.0.0:9917":  false,
		"8065":                 false,
		"[2001:db8::68]":       false,
	}

	for key, expected := range testValues {
		ss := &ServiceSettings{
			ListenAddress: NewPointer(key),
		}
		ss.SetDefaults(true)
		if expected {
			require.Nil(t, ss.isValid(), fmt.Sprintf("Got an error from '%v'.", key))
		} else {
			appErr := ss.isValid()
			require.NotNil(t, appErr, fmt.Sprintf("Expected '%v' to throw an error.", key))
			require.Equal(t, "model.config.is_valid.listen_address.app_error", appErr.Message)
		}
	}
}

func TestImageProxySettingsSetDefaults(t *testing.T) {
	t.Run("default settings", func(t *testing.T) {
		ips := ImageProxySettings{}
		ips.SetDefaults()

		assert.Equal(t, false, *ips.Enable)
		assert.Equal(t, ImageProxyTypeLocal, *ips.ImageProxyType)
		assert.Equal(t, "", *ips.RemoteImageProxyURL)
		assert.Equal(t, "", *ips.RemoteImageProxyOptions)
	})
}

func TestImageProxySettingsIsValid(t *testing.T) {
	for _, test := range []struct {
		Name                    string
		Enable                  bool
		ImageProxyType          string
		RemoteImageProxyURL     string
		RemoteImageProxyOptions string
		ExpectError             bool
	}{
		{
			Name:        "disabled",
			Enable:      false,
			ExpectError: false,
		},
		{
			Name:                    "disabled with bad values",
			Enable:                  false,
			ImageProxyType:          "garbage",
			RemoteImageProxyURL:     "garbage",
			RemoteImageProxyOptions: "garbage",
			ExpectError:             false,
		},
		{
			Name:           "missing type",
			Enable:         true,
			ImageProxyType: "",
			ExpectError:    true,
		},
		{
			Name:                    "local",
			Enable:                  true,
			ImageProxyType:          "local",
			RemoteImageProxyURL:     "garbage",
			RemoteImageProxyOptions: "garbage",
			ExpectError:             false,
		},
		{
			Name:                    "atmos/camo",
			Enable:                  true,
			ImageProxyType:          ImageProxyTypeAtmosCamo,
			RemoteImageProxyURL:     "someurl",
			RemoteImageProxyOptions: "someoptions",
			ExpectError:             false,
		},
		{
			Name:                    "atmos/camo, missing url",
			Enable:                  true,
			ImageProxyType:          ImageProxyTypeAtmosCamo,
			RemoteImageProxyURL:     "",
			RemoteImageProxyOptions: "garbage",
			ExpectError:             true,
		},
		{
			Name:                    "atmos/camo, missing options",
			Enable:                  true,
			ImageProxyType:          ImageProxyTypeAtmosCamo,
			RemoteImageProxyURL:     "someurl",
			RemoteImageProxyOptions: "",
			ExpectError:             true,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			ips := &ImageProxySettings{
				Enable:                  &test.Enable,
				ImageProxyType:          &test.ImageProxyType,
				RemoteImageProxyURL:     &test.RemoteImageProxyURL,
				RemoteImageProxyOptions: &test.RemoteImageProxyOptions,
			}

			appErr := ips.isValid()
			if test.ExpectError {
				assert.NotNil(t, appErr)
			} else {
				assert.Nil(t, appErr)
			}
		})
	}
}

func TestLdapSettingsIsValid(t *testing.T) {
	for _, test := range []struct {
		Name         string
		LdapSettings LdapSettings
		ExpectError  bool
	}{
		{
			Name: "disabled",
			LdapSettings: LdapSettings{
				Enable: NewPointer(false),
			},
			ExpectError: false,
		},
		{
			Name: "missing server",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer(""),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer(""),
			},
			ExpectError: true,
		},
		{
			Name: "empty user filter",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer(""),
			},
			ExpectError: false,
		},
		{
			Name: "valid user filter #1",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("(property=value)"),
			},
			ExpectError: false,
		},
		{
			Name: "invalid user filter #1",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("("),
			},
			ExpectError: true,
		},
		{
			Name: "invalid user filter #2",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("()"),
			},
			ExpectError: true,
		},
		{
			Name: "valid user filter #2",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("(&(property=value)(otherthing=othervalue))"),
			},
			ExpectError: false,
		},
		{
			Name: "valid user filter #3",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("(&(property=value)(|(otherthing=othervalue)(other=thing)))"),
			},
			ExpectError: false,
		},
		{
			Name: "invalid user filter #3",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("(&(property=value)(|(otherthing=othervalue)(other=thing))"),
			},
			ExpectError: true,
		},
		{
			Name: "invalid user filter #4",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				UserFilter:        NewPointer("(&(property=value)((otherthing=othervalue)(other=thing)))"),
			},
			ExpectError: true,
		},

		{
			Name: "valid guest filter #1",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("(property=value)"),
			},
			ExpectError: false,
		},
		{
			Name: "invalid guest filter #1",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("("),
			},
			ExpectError: true,
		},
		{
			Name: "invalid guest filter #2",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("()"),
			},
			ExpectError: true,
		},
		{
			Name: "valid guest filter #2",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("(&(property=value)(otherthing=othervalue))"),
			},
			ExpectError: false,
		},
		{
			Name: "valid guest filter #3",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("(&(property=value)(|(otherthing=othervalue)(other=thing)))"),
			},
			ExpectError: false,
		},
		{
			Name: "invalid guest filter #3",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("(&(property=value)(|(otherthing=othervalue)(other=thing))"),
			},
			ExpectError: true,
		},
		{
			Name: "invalid guest filter #4",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				GuestFilter:       NewPointer("(&(property=value)((otherthing=othervalue)(other=thing)))"),
			},
			ExpectError: true,
		},

		{
			Name: "valid Admin filter #1",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("(property=value)"),
			},
			ExpectError: false,
		},
		{
			Name: "invalid Admin filter #1",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("("),
			},
			ExpectError: true,
		},
		{
			Name: "invalid Admin filter #2",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("()"),
			},
			ExpectError: true,
		},
		{
			Name: "valid Admin filter #2",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("(&(property=value)(otherthing=othervalue))"),
			},
			ExpectError: false,
		},
		{
			Name: "valid Admin filter #3",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("(&(property=value)(|(otherthing=othervalue)(other=thing)))"),
			},
			ExpectError: false,
		},
		{
			Name: "invalid Admin filter #3",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("(&(property=value)(|(otherthing=othervalue)(other=thing))"),
			},
			ExpectError: true,
		},
		{
			Name: "invalid Admin filter #4",
			LdapSettings: LdapSettings{
				Enable:            NewPointer(true),
				LdapServer:        NewPointer("server"),
				BaseDN:            NewPointer("basedn"),
				EmailAttribute:    NewPointer("email"),
				UsernameAttribute: NewPointer("username"),
				IdAttribute:       NewPointer("id"),
				LoginIdAttribute:  NewPointer("loginid"),
				AdminFilter:       NewPointer("(&(property=value)((otherthing=othervalue)(other=thing)))"),
			},
			ExpectError: true,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			test.LdapSettings.SetDefaults()

			appErr := test.LdapSettings.isValid()
			if test.ExpectError {
				assert.NotNil(t, appErr)
			} else {
				assert.Nil(t, appErr)
			}
		})
	}
}

func TestLogSettingsIsValid(t *testing.T) {
	for name, test := range map[string]struct {
		LogSettings LogSettings
		ExpectError bool
	}{
		"empty": {
			LogSettings: LogSettings{},
			ExpectError: false,
		},
		"AdvancedLoggingJSON contains empty string": {
			LogSettings: LogSettings{
				AdvancedLoggingJSON: json.RawMessage(``),
			},
			ExpectError: false,
		},
		"AdvancedLoggingJSON contains empty JSON": {
			LogSettings: LogSettings{
				AdvancedLoggingJSON: json.RawMessage(`{}`),
			},
			ExpectError: false,
		},
		"AdvancedLoggingJSON has JSON error ": {
			LogSettings: LogSettings{
				AdvancedLoggingJSON: json.RawMessage(`
				{
					"foo": "bar",
				`),
			},
			ExpectError: true,
		},
		"AdvancedLoggingJSON has missing target": {
			LogSettings: LogSettings{
				AdvancedLoggingJSON: json.RawMessage(`
				{
					"foo": "bar",
				}
				`),
			},
			ExpectError: true,
		},
		"AdvancedLoggingJSON has an unknown Type": {
			LogSettings: LogSettings{
				AdvancedLoggingJSON: json.RawMessage(`
				{
					"console-log": {
							"Type": "XYZ",
							"Format": "json",
							"Levels": [
							  {"ID": 10, "Name": "stdlog", "Stacktrace": false},
									{"ID": 5, "Name": "debug", "Stacktrace": false},
									{"ID": 4, "Name": "info", "Stacktrace": false, "color": 36},
									{"ID": 3, "Name": "warn", "Stacktrace": false, "color": 33},
									{"ID": 2, "Name": "error", "Stacktrace": true, "color": 31},
									{"ID": 1, "Name": "fatal", "Stacktrace": true},
									{"ID": 0, "Name": "panic", "Stacktrace": true}
							],
							"Options": {
									"Out": "stdout"
							},
							"MaxQueueSize": 1000
					}
				}
				`),
			},
			ExpectError: true,
		},
		"AdvancedLoggingJSON is valid": {
			LogSettings: LogSettings{
				AdvancedLoggingJSON: json.RawMessage(`
				{
					"console-log": {
							"Type": "console",
							"Format": "json",
							"Levels": [
								{"ID": 5, "Name": "debug", "Stacktrace": false},
								{"ID": 4, "Name": "info", "Stacktrace": false, "color": 36},
								{"ID": 3, "Name": "warn", "Stacktrace": false, "color": 33},
								{"ID": 2, "Name": "error", "Stacktrace": true, "color": 31}
							],
							"Options": {
									"Out": "stdout"
							},
							"MaxQueueSize": 1000
					}
				}
				`),
			},
			ExpectError: false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			test.LogSettings.SetDefaults()

			appErr := test.LogSettings.isValid()
			if test.ExpectError {
				assert.NotNil(t, appErr)
			} else {
				assert.Nil(t, appErr)
			}
		})
	}
}

func TestConfigSanitize(t *testing.T) {
	c := Config{}
	c.SetDefaults()

	*c.LdapSettings.BindPassword = "foo"
	*c.FileSettings.AmazonS3SecretAccessKey = "bar"
	*c.EmailSettings.SMTPPassword = "baz"
	*c.GitLabSettings.Secret = "bingo"
	*c.OpenIdSettings.Secret = "secret"
	c.SqlSettings.DataSourceReplicas = []string{"stuff"}
	c.SqlSettings.DataSourceSearchReplicas = []string{"stuff"}
	c.SqlSettings.ReplicaLagSettings = []*ReplicaLagSettings{{
		DataSource:       NewPointer("DataSource"),
		QueryAbsoluteLag: NewPointer("QueryAbsoluteLag"),
		QueryTimeLag:     NewPointer("QueryTimeLag"),
	}}

	c.Sanitize(nil)

	assert.Equal(t, FakeSetting, *c.LdapSettings.BindPassword)
	assert.Equal(t, FakeSetting, *c.FileSettings.PublicLinkSalt)
	assert.Equal(t, FakeSetting, *c.FileSettings.AmazonS3SecretAccessKey)
	assert.Equal(t, FakeSetting, *c.EmailSettings.SMTPPassword)
	assert.Equal(t, FakeSetting, *c.GitLabSettings.Secret)
	assert.Equal(t, FakeSetting, *c.OpenIdSettings.Secret)
	assert.Equal(t, FakeSetting, *c.SqlSettings.DataSource)
	assert.Equal(t, FakeSetting, *c.SqlSettings.AtRestEncryptKey)
	assert.Equal(t, FakeSetting, *c.ElasticsearchSettings.Password)
	assert.Equal(t, FakeSetting, c.SqlSettings.DataSourceReplicas[0])
	assert.Equal(t, FakeSetting, c.SqlSettings.DataSourceSearchReplicas[0])

	require.Len(t, c.SqlSettings.ReplicaLagSettings, 1)
	assert.Equal(t, FakeSetting, *c.SqlSettings.ReplicaLagSettings[0].DataSource)
	assert.Equal(t, "QueryAbsoluteLag", *c.SqlSettings.ReplicaLagSettings[0].QueryAbsoluteLag)
	assert.Equal(t, "QueryTimeLag", *c.SqlSettings.ReplicaLagSettings[0].QueryTimeLag)

	t.Run("with default config", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()
		c.Sanitize(nil)

		assert.Len(t, c.SqlSettings.ReplicaLagSettings, 0)
	})
}

func TestPluginSettingsSanitize(t *testing.T) {
	plugins := map[string]map[string]any{
		"plugin.id": {
			"somesetting":  "some value",
			"secrettext":   "a secret",
			"secretnumber": 123,
		},
		"another.plugin": {
			"somesetting": 456,
		},
	}

	for name, tc := range map[string]struct {
		manifests []*Manifest
		expected  map[string]map[string]any
	}{
		"nil list of manifests": {
			manifests: nil,
			expected: map[string]map[string]any{
				"plugin.id": {
					"somesetting":  FakeSetting,
					"secrettext":   FakeSetting,
					"secretnumber": FakeSetting,
				},
				"another.plugin": {
					"somesetting": FakeSetting,
				},
			},
		},
		"empty list of manifests": {
			manifests: []*Manifest{},
			expected: map[string]map[string]any{
				"plugin.id": {
					"somesetting":  FakeSetting,
					"secrettext":   FakeSetting,
					"secretnumber": FakeSetting,
				},
				"another.plugin": {
					"somesetting": FakeSetting,
				},
			},
		},
		"one plugin installed": {
			manifests: []*Manifest{
				{
					Id: "plugin.id",
					SettingsSchema: &PluginSettingsSchema{
						Settings: []*PluginSetting{
							{
								Key:    "somesetting",
								Type:   "text",
								Secret: false,
							},
							{
								Key:    "secrettext",
								Type:   "text",
								Secret: true,
							},
							{
								Key:    "secretnumber",
								Type:   "number",
								Secret: true,
							},
						},
					},
				},
			},
			expected: map[string]map[string]any{
				"plugin.id": {
					"somesetting":  "some value",
					"secrettext":   FakeSetting,
					"secretnumber": FakeSetting,
				},
			},
		},
		"two plugins installed": {
			manifests: []*Manifest{
				{
					Id: "plugin.id",
					SettingsSchema: &PluginSettingsSchema{
						Settings: []*PluginSetting{
							{
								Key:    "somesetting",
								Type:   "text",
								Secret: false,
							},
							{
								Key:    "secrettext",
								Type:   "text",
								Secret: true,
							},
							{
								Key:    "secretnumber",
								Type:   "number",
								Secret: true,
							},
						},
					},
				},
				{
					Id: "another.plugin",
					SettingsSchema: &PluginSettingsSchema{
						Settings: []*PluginSetting{
							{
								Key:    "somesetting",
								Type:   "number",
								Secret: false,
							},
						},
					},
				},
			},
			expected: map[string]map[string]any{
				"plugin.id": {
					"somesetting":  "some value",
					"secrettext":   FakeSetting,
					"secretnumber": FakeSetting,
				},
				"another.plugin": {
					"somesetting": 456,
				},
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			if name != "one plugin installed" {
				return
			}

			c := PluginSettings{}
			c.SetDefaults(*NewLogSettings())
			c.Plugins = plugins

			c.Sanitize(tc.manifests)

			assert.Equal(t, tc.expected, c.Plugins, name)
		})
	}
}

func TestConfigFilteredByTag(t *testing.T) {
	c := Config{}
	c.SetDefaults()

	cfgMap := configToMapFilteredByTag(c, ConfigAccessTagType, ConfigAccessTagCloudRestrictable)

	// Remove entire sections but the map is still there
	clusterSettings, ok := cfgMap["SqlSettings"].(map[string]any)
	require.True(t, ok)
	require.Empty(t, clusterSettings)

	// Some fields are removed if they have the filtering tag
	serviceSettings, ok := cfgMap["ServiceSettings"].(map[string]any)
	require.True(t, ok)
	_, ok = serviceSettings["ListenAddress"]
	require.False(t, ok)
}

func TestConfigToJSONFiltered(t *testing.T) {
	c := Config{}
	c.SetDefaults()

	jsonCfgFiltered, err := c.ToJSONFiltered(ConfigAccessTagType, ConfigAccessTagCloudRestrictable)
	require.NoError(t, err)

	unmarshaledCfg := make(map[string]json.RawMessage)
	err = json.Unmarshal(jsonCfgFiltered, &unmarshaledCfg)
	require.NoError(t, err)

	_, ok := unmarshaledCfg["SqlSettings"]
	require.False(t, ok)

	serviceSettingsRaw, ok := unmarshaledCfg["ServiceSettings"]
	require.True(t, ok)

	unmarshaledServiceSettings := make(map[string]json.RawMessage)
	err = json.Unmarshal([]byte(serviceSettingsRaw), &unmarshaledServiceSettings)
	require.NoError(t, err)

	_, ok = unmarshaledServiceSettings["ListenAddress"]
	require.False(t, ok)
	_, ok = unmarshaledServiceSettings["SiteURL"]
	require.True(t, ok)
}

func TestConfigMarketplaceDefaults(t *testing.T) {
	t.Parallel()

	t.Run("no marketplace url", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()

		require.True(t, *c.PluginSettings.EnableMarketplace)
		require.Equal(t, PluginSettingsDefaultMarketplaceURL, *c.PluginSettings.MarketplaceURL)
	})

	t.Run("old marketplace url", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()

		*c.PluginSettings.MarketplaceURL = PluginSettingsOldMarketplaceURL
		c.SetDefaults()

		require.True(t, *c.PluginSettings.EnableMarketplace)
		require.Equal(t, PluginSettingsDefaultMarketplaceURL, *c.PluginSettings.MarketplaceURL)
	})

	t.Run("custom marketplace url", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()

		*c.PluginSettings.MarketplaceURL = "https://marketplace.example.com"
		c.SetDefaults()

		require.True(t, *c.PluginSettings.EnableMarketplace)
		require.Equal(t, "https://marketplace.example.com", *c.PluginSettings.MarketplaceURL)
	})
}

func TestSetDefaultFeatureFlagBehaviour(t *testing.T) {
	cfg := Config{}
	cfg.SetDefaults()

	require.NotNil(t, cfg.FeatureFlags)
	require.Equal(t, "off", cfg.FeatureFlags.TestFeature)

	cfg = Config{
		FeatureFlags: &FeatureFlags{
			TestFeature: "somevalue",
		},
	}
	cfg.SetDefaults()
	require.NotNil(t, cfg.FeatureFlags)
	require.Equal(t, "somevalue", cfg.FeatureFlags.TestFeature)
}

func TestConfigImportSettingsDefaults(t *testing.T) {
	cfg := Config{}
	cfg.SetDefaults()

	require.Equal(t, "./import", *cfg.ImportSettings.Directory)
	require.Equal(t, 30, *cfg.ImportSettings.RetentionDays)
}

func TestConfigImportSettingsIsValid(t *testing.T) {
	cfg := Config{}
	cfg.SetDefaults()

	appErr := cfg.ImportSettings.isValid()
	require.Nil(t, appErr)

	*cfg.ImportSettings.Directory = ""
	appErr = cfg.ImportSettings.isValid()
	require.NotNil(t, appErr)
	require.Equal(t, "model.config.is_valid.import.directory.app_error", appErr.Id)

	cfg.SetDefaults()

	*cfg.ImportSettings.RetentionDays = 0
	appErr = cfg.ImportSettings.isValid()
	require.NotNil(t, appErr)
	require.Equal(t, "model.config.is_valid.import.retention_days_too_low.app_error", appErr.Id)
}

func TestConfigExportSettingsDefaults(t *testing.T) {
	cfg := Config{}
	cfg.SetDefaults()

	require.Equal(t, "./export", *cfg.ExportSettings.Directory)
	require.Equal(t, 30, *cfg.ExportSettings.RetentionDays)
}

func TestConfigExportSettingsIsValid(t *testing.T) {
	cfg := Config{}
	cfg.SetDefaults()

	appErr := cfg.ExportSettings.isValid()
	require.Nil(t, appErr)

	*cfg.ExportSettings.Directory = ""
	appErr = cfg.ExportSettings.isValid()
	require.NotNil(t, appErr)
	require.Equal(t, "model.config.is_valid.export.directory.app_error", appErr.Id)

	cfg.SetDefaults()

	*cfg.ExportSettings.RetentionDays = 0
	appErr = cfg.ExportSettings.isValid()
	require.NotNil(t, appErr)
	require.Equal(t, "model.config.is_valid.export.retention_days_too_low.app_error", appErr.Id)
}

func TestConfigServiceSettingsIsValid(t *testing.T) {
	t.Run("local socket file should exist if local mode enabled", func(t *testing.T) {
		cfg := Config{}
		cfg.SetDefaults()

		appErr := cfg.ServiceSettings.isValid()
		require.Nil(t, appErr)

		*cfg.ServiceSettings.EnableLocalMode = false
		// we don't need to check as local mode is not enabled
		*cfg.ServiceSettings.LocalModeSocketLocation = "an_invalid_path.socket"
		appErr = cfg.ServiceSettings.isValid()
		require.Nil(t, appErr)

		// now we can check if the file exist or not
		*cfg.ServiceSettings.EnableLocalMode = true
		*cfg.ServiceSettings.LocalModeSocketLocation = "/invalid_directory/mattermost_local.socket"
		appErr = cfg.ServiceSettings.isValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.config.is_valid.local_mode_socket.app_error", appErr.Id)
	})

	t.Run("CRT settings should have consistent values", func(t *testing.T) {
		cfg := Config{}
		cfg.SetDefaults()

		appErr := cfg.ServiceSettings.isValid()
		require.Nil(t, appErr)

		*cfg.ServiceSettings.CollapsedThreads = CollapsedThreadsDisabled
		appErr = cfg.ServiceSettings.isValid()
		require.Nil(t, appErr)

		*cfg.ServiceSettings.ThreadAutoFollow = false
		appErr = cfg.ServiceSettings.isValid()
		require.Nil(t, appErr)

		*cfg.ServiceSettings.CollapsedThreads = CollapsedThreadsDefaultOff
		appErr = cfg.ServiceSettings.isValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.config.is_valid.collapsed_threads.autofollow.app_error", appErr.Id)

		*cfg.ServiceSettings.CollapsedThreads = CollapsedThreadsDefaultOn
		appErr = cfg.ServiceSettings.isValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.config.is_valid.collapsed_threads.autofollow.app_error", appErr.Id)

		*cfg.ServiceSettings.CollapsedThreads = CollapsedThreadsAlwaysOn
		appErr = cfg.ServiceSettings.isValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.config.is_valid.collapsed_threads.autofollow.app_error", appErr.Id)

		*cfg.ServiceSettings.ThreadAutoFollow = true
		*cfg.ServiceSettings.CollapsedThreads = "test_status"
		appErr = cfg.ServiceSettings.isValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.config.is_valid.collapsed_threads.app_error", appErr.Id)
	})
}

func TestConfigDefaultCallsPluginState(t *testing.T) {
	t.Run("should enable Calls plugin by default on self-hosted", func(t *testing.T) {
		c1 := Config{}
		c1.SetDefaults()

		assert.True(t, c1.PluginSettings.PluginStates["com.mattermost.calls"].Enable)
	})

	t.Run("should enable Calls plugin by default on Cloud", func(t *testing.T) {
		os.Setenv("MM_CLOUD_INSTALLATION_ID", "test")
		defer os.Unsetenv("MM_CLOUD_INSTALLATION_ID")
		c1 := Config{}
		c1.SetDefaults()

		assert.True(t, c1.PluginSettings.PluginStates["com.mattermost.calls"].Enable)
	})

	t.Run("should not re-enable Calls plugin after it has been disabled", func(t *testing.T) {
		c1 := Config{
			PluginSettings: PluginSettings{
				PluginStates: map[string]*PluginState{
					"com.mattermost.calls": {
						Enable: false,
					},
				},
			},
		}

		c1.SetDefaults()
		assert.False(t, c1.PluginSettings.PluginStates["com.mattermost.calls"].Enable)
	})
}

func TestConfigDefaultAIPluginState(t *testing.T) {
	t.Run("should enable AI plugin by default on self-hosted", func(t *testing.T) {
		c1 := Config{}
		c1.SetDefaults()

		assert.True(t, c1.PluginSettings.PluginStates["mattermost-ai"].Enable)
	})

	t.Run("should enable AI plugin by default on Cloud", func(t *testing.T) {
		os.Setenv("MM_CLOUD_INSTALLATION_ID", "test")
		defer os.Unsetenv("MM_CLOUD_INSTALLATION_ID")
		c1 := Config{}
		c1.SetDefaults()

		assert.True(t, c1.PluginSettings.PluginStates["mattermost-ai"].Enable)
	})

	t.Run("should not re-enable AI plugin after it has been disabled", func(t *testing.T) {
		c1 := Config{
			PluginSettings: PluginSettings{
				PluginStates: map[string]*PluginState{
					"mattermost-ai": {
						Enable: false,
					},
				},
			},
		}

		c1.SetDefaults()
		assert.False(t, c1.PluginSettings.PluginStates["mattermost-ai"].Enable)
	})
}

func TestConfigGetMessageRetentionHours(t *testing.T) {
	tests := []struct {
		name   string
		config Config
		value  int
	}{
		{
			name:   "should return MessageRetentionDays config value in hours by default",
			config: Config{},
			value:  8760,
		},
		{
			name: "should return MessageRetentionHours config value",
			config: Config{
				DataRetentionSettings: DataRetentionSettings{
					MessageRetentionHours: NewPointer(48),
				},
			},
			value: 48,
		},
		{
			name: "should return MessageRetentionHours config value",
			config: Config{
				DataRetentionSettings: DataRetentionSettings{
					MessageRetentionDays:  NewPointer(50),
					MessageRetentionHours: NewPointer(48),
				},
			},
			value: 48,
		},
		{
			name: "should return MessageRetentionDays config value in hours",
			config: Config{
				DataRetentionSettings: DataRetentionSettings{
					MessageRetentionDays:  NewPointer(50),
					MessageRetentionHours: NewPointer(0),
				},
			},
			value: 1200,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			test.config.SetDefaults()

			require.Equal(t, test.value, test.config.DataRetentionSettings.GetMessageRetentionHours())
		})
	}
}

func TestConfigGetFileRetentionHours(t *testing.T) {
	tests := []struct {
		name   string
		config Config
		value  int
	}{
		{
			name:   "should return FileRetentionDays config value in hours by default",
			config: Config{},
			value:  8760,
		},
		{
			name: "should return FileRetentionHours config value",
			config: Config{
				DataRetentionSettings: DataRetentionSettings{
					FileRetentionHours: NewPointer(48),
				},
			},
			value: 48,
		},
		{
			name: "should return FileRetentionHours config value",
			config: Config{
				DataRetentionSettings: DataRetentionSettings{
					FileRetentionDays:  NewPointer(50),
					FileRetentionHours: NewPointer(48),
				},
			},
			value: 48,
		},
		{
			name: "should return FileRetentionDays config value in hours",
			config: Config{
				DataRetentionSettings: DataRetentionSettings{
					FileRetentionDays:  NewPointer(50),
					FileRetentionHours: NewPointer(0),
				},
			},
			value: 1200,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			test.config.SetDefaults()

			require.Equal(t, test.value, test.config.DataRetentionSettings.GetFileRetentionHours())
		})
	}
}

func TestConfigDefaultConnectedWorkspacesSettings(t *testing.T) {
	t.Run("if the config is new, default values should be established", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()
		require.False(t, *c.ConnectedWorkspacesSettings.EnableSharedChannels)
		require.False(t, *c.ConnectedWorkspacesSettings.EnableRemoteClusterService)
	})

	t.Run("if the config is being updated and server federation settings had no values, experimental settings values should be migrated", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()
		c.ConnectedWorkspacesSettings = ConnectedWorkspacesSettings{}
		c.ExperimentalSettings.EnableSharedChannels = NewPointer(true)
		c.ExperimentalSettings.EnableRemoteClusterService = NewPointer(false)

		c.SetDefaults()
		require.True(t, *c.ConnectedWorkspacesSettings.EnableSharedChannels)
		require.False(t, *c.ConnectedWorkspacesSettings.EnableRemoteClusterService)
	})

	t.Run("if the config is being updated and server federation settings already have values, they should not change", func(t *testing.T) {
		c := Config{}
		c.SetDefaults()
		c.ConnectedWorkspacesSettings.EnableSharedChannels = NewPointer(false)
		c.ConnectedWorkspacesSettings.EnableRemoteClusterService = NewPointer(true)
		c.ExperimentalSettings.EnableSharedChannels = NewPointer(true)
		c.ExperimentalSettings.EnableRemoteClusterService = NewPointer(false)

		c.SetDefaults()
		require.False(t, *c.ConnectedWorkspacesSettings.EnableSharedChannels)
		require.True(t, *c.ConnectedWorkspacesSettings.EnableRemoteClusterService)
	})
}

func TestFilterConfig(t *testing.T) {
	t.Run("should clear default values", func(t *testing.T) {
		cfg := &Config{}
		cfg.SetDefaults()

		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.Empty(t, m)

		cfg.ServiceSettings = ServiceSettings{
			EnableLocalMode: NewPointer(true),
		}

		m, err = FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)
		require.Equal(t, true, m["ServiceSettings"].(map[string]any)["EnableLocalMode"])
	})

	t.Run("should clear masked config values", func(t *testing.T) {
		cfg := &Config{}
		cfg.SetDefaults()

		dsn := "somedb://user:password@localhost:5432/mattermost"
		cfg.SqlSettings.DataSource = NewPointer(dsn)

		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)
		require.Equal(t, dsn, m["SqlSettings"].(map[string]any)["DataSource"])

		cfg.Sanitize(nil)
		m, err = FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)
		require.Equal(t, FakeSetting, m["SqlSettings"].(map[string]any)["DataSource"])

		cfg.Sanitize(nil)
		m, err = FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
				RemoveMasked:   true,
			},
		})
		require.NoError(t, err)
		require.Empty(t, m)

		cfg.SqlSettings.DriverName = NewPointer("mysql")
		m, err = FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
				RemoveMasked:   true,
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)
		require.Equal(t, "mysql", m["SqlSettings"].(map[string]any)["DriverName"])
	})

	t.Run("should not clear non primitive types", func(t *testing.T) {
		cfg := &Config{}
		cfg.SetDefaults()

		cfg.TeamSettings.ExperimentalDefaultChannels = []string{"ch-a", "ch-b"}
		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)
		require.ElementsMatch(t, []string{"ch-a", "ch-b"}, m["TeamSettings"].(map[string]any)["ExperimentalDefaultChannels"])
	})

	t.Run("should be able to handle nil values", func(t *testing.T) {
		var cfg *Config

		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.Empty(t, m)
	})

	t.Run("should be able to handle float64 values", func(t *testing.T) {
		cfg := &Config{}
		cfg.SetDefaults()
		cfg.PluginSettings.Plugins = map[string]map[string]any{
			"com.mattermost.plugin-a": {
				"setting": 1.0,
			},
		}

		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{
				RemoveDefaults: true,
			},
		})
		require.NoError(t, err)
		require.Equal(t, 1.0, m["PluginSettings"].(map[string]any)["Plugins"].(map[string]any)["com.mattermost.plugin-a"].(map[string]any)["setting"])
	})

	t.Run("should be able to filter specific tag", func(t *testing.T) {
		cfg := &Config{}
		cfg.SetDefaults()

		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{},
			TagFilters: []FilterTag{
				{
					TagType: ConfigAccessTagType,
					TagName: ConfigAccessTagCloudRestrictable,
				},
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)

		fileSettings, ok := m["FileSettings"]
		require.True(t, ok)

		enableFileAttachments, ok := fileSettings.(map[string]any)["EnableFileAttachments"]
		require.True(t, ok)
		require.Equal(t, true, enableFileAttachments)

		// All fields of SqlSettings are ConfigAccessTagCloudRestrictable
		_, ok = m["SqlSettings"]
		require.False(t, ok)
	})

	t.Run("should be able to filter multiple tags", func(t *testing.T) {
		cfg := &Config{}
		cfg.SetDefaults()

		m, err := FilterConfig(cfg, ConfigFilterOptions{
			GetConfigOptions: GetConfigOptions{},
			TagFilters: []FilterTag{
				{
					TagType: ConfigAccessTagType,
					TagName: "site_file_sharing_and_downloads",
				},
				{
					TagType: ConfigAccessTagType,
					TagName: ConfigAccessTagCloudRestrictable,
				},
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, m)

		fileSettings, ok := m["FileSettings"]
		require.True(t, ok)
		// EnableFileAttachments has "site_file_sharing_and_downloads" tag
		_, ok = fileSettings.(map[string]any)["EnableFileAttachments"]
		require.False(t, ok)

		// All fields of SqlSettings are ConfigAccessTagCloudRestrictable
		_, ok = m["SqlSettings"]
		require.False(t, ok)
	})
}
