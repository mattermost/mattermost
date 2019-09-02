package api4

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetConfig(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.GetConfig()
	CheckForbiddenStatus(t, resp)

	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	require.NotEqual(t, "", cfg.TeamSettings.SiteName)

	if *cfg.LdapSettings.BindPassword != model.FAKE_SETTING && len(*cfg.LdapSettings.BindPassword) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.FileSettings.PublicLinkSalt != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.FileSettings.AmazonS3SecretAccessKey != model.FAKE_SETTING && len(*cfg.FileSettings.AmazonS3SecretAccessKey) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.EmailSettings.SMTPPassword != model.FAKE_SETTING && len(*cfg.EmailSettings.SMTPPassword) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.GitLabSettings.Secret != model.FAKE_SETTING && len(*cfg.GitLabSettings.Secret) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.SqlSettings.DataSource != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.SqlSettings.AtRestEncryptKey != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceReplicas) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceSearchReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceSearchReplicas) != 0 {
		t.Fatal("did not sanitize properly")
	}
}

func TestReloadConfig(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	t.Run("as system user", func(t *testing.T) {
		ok, resp := Client.ReloadConfig()
		CheckForbiddenStatus(t, resp)
		if ok {
			t.Fatal("should not Reload the config due no permission.")
		}
	})

	t.Run("as system admin", func(t *testing.T) {
		ok, resp := th.SystemAdminClient.ReloadConfig()
		CheckNoError(t, resp)
		if !ok {
			t.Fatal("should Reload the config")
		}
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := Client.ReloadConfig()
		CheckForbiddenStatus(t, resp)
		if ok {
			t.Fatal("should not Reload the config due no permission.")
		}
	})
}

func TestUpdateConfig(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	_, resp = Client.UpdateConfig(cfg)
	CheckForbiddenStatus(t, resp)

	SiteName := th.App.Config().TeamSettings.SiteName

	*cfg.TeamSettings.SiteName = "MyFancyName"
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	require.Equal(t, "MyFancyName", *cfg.TeamSettings.SiteName, "It should update the SiteName")

	//Revert the change
	cfg.TeamSettings.SiteName = SiteName
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	require.Equal(t, SiteName, cfg.TeamSettings.SiteName, "It should update the SiteName")

	t.Run("Should fail with validation error if invalid config setting is passed", func(t *testing.T) {
		//Revert the change
		badcfg := cfg.Clone()
		badcfg.PasswordSettings.MinimumLength = model.NewInt(4)
		badcfg.PasswordSettings.MinimumLength = model.NewInt(4)
		_, resp = th.SystemAdminClient.UpdateConfig(badcfg)
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, resp, "model.config.is_valid.password_length.app_error")
	})

	t.Run("Should not be able to modify PluginSettings.EnableUploads", func(t *testing.T) {
		oldEnableUploads := *th.App.Config().PluginSettings.EnableUploads
		*cfg.PluginSettings.EnableUploads = !oldEnableUploads

		cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
		CheckNoError(t, resp)
		assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
		assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)

		cfg.PluginSettings.EnableUploads = nil
		cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
		CheckNoError(t, resp)
		assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
		assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)
	})
}

func TestUpdateConfigMessageExportSpecialHandling(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	messageExportEnabled := *th.App.Config().MessageExportSettings.EnableExport
	messageExportTimestamp := *th.App.Config().MessageExportSettings.ExportFromTimestamp

	defer th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = messageExportEnabled
		*cfg.MessageExportSettings.ExportFromTimestamp = messageExportTimestamp
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = false
		*cfg.MessageExportSettings.ExportFromTimestamp = int64(0)
	})

	// Turn it on, timestamp should be updated.
	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	*cfg.MessageExportSettings.EnableExport = true
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	assert.True(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.NotEqual(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Turn it off, timestamp should be cleared.
	cfg, resp = th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	*cfg.MessageExportSettings.EnableExport = false
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	assert.False(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Set a value from the config file.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = false
		*cfg.MessageExportSettings.ExportFromTimestamp = int64(12345)
	})

	// Turn it on, timestamp should *not* be updated.
	cfg, resp = th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	*cfg.MessageExportSettings.EnableExport = true
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	assert.True(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(12345), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Turn it off, timestamp should be cleared.
	cfg, resp = th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	*cfg.MessageExportSettings.EnableExport = false
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	assert.False(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)
}

func TestUpdateConfigRestrictSystemAdmin(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

	originalCfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	cfg := originalCfg.Clone()
	*cfg.TeamSettings.SiteName = "MyFancyName"          // Allowed
	*cfg.ServiceSettings.SiteURL = "http://example.com" // Ignored

	returnedCfg, resp := th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	require.Equal(t, "MyFancyName", *returnedCfg.TeamSettings.SiteName)
	require.Equal(t, *originalCfg.ServiceSettings.SiteURL, *returnedCfg.ServiceSettings.SiteURL)

	actualCfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	require.Equal(t, returnedCfg, actualCfg)
}

func TestGetEnvironmentConfig(t *testing.T) {
	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://example.mattermost.com")
	os.Setenv("MM_SERVICESETTINGS_ENABLECUSTOMEMOJI", "true")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")
	defer os.Unsetenv("MM_SERVICESETTINGS_ENABLECUSTOMEMOJI")

	th := Setup().InitBasic()
	defer th.TearDown()

	t.Run("as system admin", func(t *testing.T) {
		SystemAdminClient := th.SystemAdminClient

		envConfig, resp := SystemAdminClient.GetEnvironmentConfig()
		CheckNoError(t, resp)

		if serviceSettings, ok := envConfig["ServiceSettings"]; !ok {
			t.Fatal("should've returned ServiceSettings")
		} else if serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{}); !ok {
			t.Fatal("should've returned ServiceSettings as a map")
		} else {
			if siteURL, ok := serviceSettingsAsMap["SiteURL"]; !ok {
				t.Fatal("should've returned ServiceSettings.SiteURL")
			} else if siteURLAsBool, ok := siteURL.(bool); !ok {
				t.Fatal("should've returned ServiceSettings.SiteURL as a boolean")
			} else if !siteURLAsBool {
				t.Fatal("should've returned ServiceSettings.SiteURL as true")
			}

			if enableCustomEmoji, ok := serviceSettingsAsMap["EnableCustomEmoji"]; !ok {
				t.Fatal("should've returned ServiceSettings.EnableCustomEmoji")
			} else if enableCustomEmojiAsBool, ok := enableCustomEmoji.(bool); !ok {
				t.Fatal("should've returned ServiceSettings.EnableCustomEmoji as a boolean")
			} else if !enableCustomEmojiAsBool {
				t.Fatal("should've returned ServiceSettings.EnableCustomEmoji as true")
			}
		}

		if _, ok := envConfig["TeamSettings"]; ok {
			t.Fatal("should not have returned TeamSettings")
		}
	})

	t.Run("as team admin", func(t *testing.T) {
		TeamAdminClient := th.CreateClient()
		th.LoginTeamAdminWithClient(TeamAdminClient)

		_, resp := TeamAdminClient.GetEnvironmentConfig()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as regular user", func(t *testing.T) {
		Client := th.Client

		_, resp := Client.GetEnvironmentConfig()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as not-regular user", func(t *testing.T) {
		Client := th.CreateClient()

		_, resp := Client.GetEnvironmentConfig()
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetOldClientConfig(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testKey := "supersecretkey"
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoogleDeveloperKey = testKey })

	t.Run("with session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		Client := th.Client

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		if len(config["Version"]) == 0 {
			t.Fatal("config not returned correctly")
		}

		if config["GoogleDeveloperKey"] != testKey {
			t.Fatal("config missing developer key")
		}
	})

	t.Run("without session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		Client := th.CreateClient()

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		if len(config["Version"]) == 0 {
			t.Fatal("config not returned correctly")
		}

		if _, ok := config["GoogleDeveloperKey"]; ok {
			t.Fatal("config should be missing developer key")
		}
	})

	t.Run("missing format", func(t *testing.T) {
		Client := th.Client

		if _, err := Client.DoApiGet("/config/client", ""); err == nil || err.StatusCode != http.StatusNotImplemented {
			t.Fatal("should have errored with 501")
		}
	})

	t.Run("invalid format", func(t *testing.T) {
		Client := th.Client

		if _, err := Client.DoApiGet("/config/client?format=junk", ""); err == nil || err.StatusCode != http.StatusBadRequest {
			t.Fatal("should have errored with 400")
		}
	})
}
