package config_test

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

var emptyConfig, readOnlyConfig, minimalConfig, invalidConfig, fixesRequiredConfig, ldapConfig, testConfig *model.Config

func init() {
	emptyConfig = &model.Config{}
	readOnlyConfig = &model.Config{
		ClusterSettings: model.ClusterSettings{
			Enable:         bToP(true),
			ReadOnlyConfig: bToP(true),
		},
	}
	minimalConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://minimal"),
		},
		SqlSettings: model.SqlSettings{
			AtRestEncryptKey: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		FileSettings: model.FileSettings{
			PublicLinkSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		EmailSettings: model.EmailSettings{
			InviteSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: sToP("en"),
			DefaultClientLocale: sToP("en"),
		},
	}
	invalidConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("invalid"),
		},
	}
	fixesRequiredConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://trailingslash/"),
		},
		SqlSettings: model.SqlSettings{
			AtRestEncryptKey: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		FileSettings: model.FileSettings{
			DriverName:     sToP(model.IMAGE_DRIVER_LOCAL),
			Directory:      sToP("/path/to/directory"),
			PublicLinkSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		EmailSettings: model.EmailSettings{
			InviteSalt: sToP("abcdefghijklmnopqrstuvwxyz0123456789"),
		},
		LocalizationSettings: model.LocalizationSettings{
			DefaultServerLocale: sToP("garbage"),
			DefaultClientLocale: sToP("garbage"),
		},
	}
	ldapConfig = &model.Config{
		LdapSettings: model.LdapSettings{
			BindPassword: sToP("password"),
		},
	}
	testConfig = &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: sToP("http://TestStoreNew"),
		},
	}
}

func prepareExpectedConfig(t *testing.T, expectedCfg *model.Config) *model.Config {
	// These fields require special initialization for our tests.
	expectedCfg = expectedCfg.Clone()
	expectedCfg.MessageExportSettings.GlobalRelaySettings = &model.GlobalRelayMessageExportSettings{}
	expectedCfg.PluginSettings.Plugins = make(map[string]map[string]interface{})
	expectedCfg.PluginSettings.PluginStates = make(map[string]*model.PluginState)

	return expectedCfg
}
