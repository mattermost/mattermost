// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.GetConfig()
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		cfg, resp := client.GetConfig()
		CheckNoError(t, resp)

		require.NotEqual(t, "", cfg.TeamSettings.SiteName)

		if *cfg.LdapSettings.BindPassword != model.FAKE_SETTING && len(*cfg.LdapSettings.BindPassword) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		require.Equal(t, model.FAKE_SETTING, *cfg.FileSettings.PublicLinkSalt, "did not sanitize properly")

		if *cfg.FileSettings.AmazonS3SecretAccessKey != model.FAKE_SETTING && len(*cfg.FileSettings.AmazonS3SecretAccessKey) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		if *cfg.EmailSettings.SMTPPassword != model.FAKE_SETTING && len(*cfg.EmailSettings.SMTPPassword) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		if *cfg.GitLabSettings.Secret != model.FAKE_SETTING && len(*cfg.GitLabSettings.Secret) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		require.Equal(t, model.FAKE_SETTING, *cfg.SqlSettings.DataSource, "did not sanitize properly")
		require.Equal(t, model.FAKE_SETTING, *cfg.SqlSettings.AtRestEncryptKey, "did not sanitize properly")
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceReplicas) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceSearchReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceSearchReplicas) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
	})
}

func TestReloadConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	t.Run("as system user", func(t *testing.T) {
		ok, resp := Client.ReloadConfig()
		CheckForbiddenStatus(t, resp)
		require.False(t, ok, "should not Reload the config due no permission.")
	})

	t.Run("as system admin", func(t *testing.T) {
		ok, resp := th.SystemAdminClient.ReloadConfig()
		CheckNoError(t, resp)
		require.True(t, ok, "should Reload the config")
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		ok, resp := Client.ReloadConfig()
		CheckForbiddenStatus(t, resp)
		require.False(t, ok, "should not Reload the config due no permission.")
	})
}

func TestUpdateConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client

	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	_, resp = Client.UpdateConfig(cfg)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		SiteName := th.App.Config().TeamSettings.SiteName

		*cfg.TeamSettings.SiteName = "MyFancyName"
		cfg, resp = client.UpdateConfig(cfg)
		CheckNoError(t, resp)

		require.Equal(t, "MyFancyName", *cfg.TeamSettings.SiteName, "It should update the SiteName")

		//Revert the change
		cfg.TeamSettings.SiteName = SiteName
		cfg, resp = client.UpdateConfig(cfg)
		CheckNoError(t, resp)

		require.Equal(t, SiteName, cfg.TeamSettings.SiteName, "It should update the SiteName")

		t.Run("Should set defaults for missing fields", func(t *testing.T) {
			_, appErr := th.SystemAdminClient.DoApiPut(th.SystemAdminClient.GetConfigRoute(), `{"ServiceSettings":{}}`)
			require.Nil(t, appErr)
		})

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

		t.Run("Should not be able to modify PluginSettings.SignaturePublicKeyFiles", func(t *testing.T) {
			oldPublicKeys := th.App.Config().PluginSettings.SignaturePublicKeyFiles
			cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, "new_signature")

			cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
			CheckNoError(t, resp)
			assert.Equal(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)

			cfg.PluginSettings.SignaturePublicKeyFiles = nil
			cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
			CheckNoError(t, resp)
			assert.Equal(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)
		})
	})
}

func TestUpdateConfigMessageExportSpecialHandling(t *testing.T) {
	th := Setup(t).InitBasic()
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
	th := Setup(t).InitBasic()
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

	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("as system admin", func(t *testing.T) {
		SystemAdminClient := th.SystemAdminClient

		envConfig, resp := SystemAdminClient.GetEnvironmentConfig()
		CheckNoError(t, resp)

		serviceSettings, ok := envConfig["ServiceSettings"]
		require.True(t, ok, "should've returned ServiceSettings")

		serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{})
		require.True(t, ok, "should've returned ServiceSettings as a map")

		siteURL, ok := serviceSettingsAsMap["SiteURL"]
		require.True(t, ok, "should've returned ServiceSettings.SiteURL")

		siteURLAsBool, ok := siteURL.(bool)
		require.True(t, ok, "should've returned ServiceSettings.SiteURL as a boolean")
		require.True(t, siteURLAsBool, "should've returned ServiceSettings.SiteURL as true")

		enableCustomEmoji, ok := serviceSettingsAsMap["EnableCustomEmoji"]
		require.True(t, ok, "should've returned ServiceSettings.EnableCustomEmoji")

		enableCustomEmojiAsBool, ok := enableCustomEmoji.(bool)
		require.True(t, ok, "should've returned ServiceSettings.EnableCustomEmoji as a boolean")
		require.True(t, enableCustomEmojiAsBool, "should've returned ServiceSettings.EnableCustomEmoji as true")

		_, ok = envConfig["TeamSettings"]
		require.False(t, ok, "should not have returned TeamSettings")
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
	th := Setup(t).InitBasic()
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

		require.NotEmpty(t, config["Version"], "config not returned correctly")
		require.Equal(t, testKey, config["GoogleDeveloperKey"])
	})

	t.Run("without session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		Client := th.CreateClient()

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		require.NotEmpty(t, config["Version"], "config not returned correctly")
		require.Empty(t, config["GoogleDeveloperKey"], "config should be missing developer key")
	})

	t.Run("missing format", func(t *testing.T) {
		Client := th.Client

		_, err := Client.DoApiGet("/config/client", "")
		require.NotNil(t, err)
		require.Equal(t, http.StatusNotImplemented, err.StatusCode)
	})

	t.Run("invalid format", func(t *testing.T) {
		Client := th.Client

		_, err := Client.DoApiGet("/config/client?format=junk", "")
		require.NotNil(t, err)
		require.Equal(t, http.StatusBadRequest, err.StatusCode)
	})
}

func TestPatchConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	t.Run("config is missing", func(t *testing.T) {
		_, response := client.PatchConfig(nil)
		CheckBadRequestStatus(t, response)
	})

	t.Run("user is not system admin", func(t *testing.T) {
		_, response := client.PatchConfig(&model.Config{})
		CheckForbiddenStatus(t, response)
	})

	t.Run("should not update the restricted fields when restrict toggle is on", func(t *testing.T) {
		*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = true

		config := model.Config{LogSettings: model.LogSettings{
			ConsoleLevel: model.NewString("INFO"),
		}}

		updatedConfig, _ := th.SystemAdminClient.PatchConfig(&config)

		assert.Equal(t, "DEBUG", *updatedConfig.LogSettings.ConsoleLevel)
	})

	t.Run("check if config is valid", func(t *testing.T) {
		config := model.Config{PasswordSettings: model.PasswordSettings{
			MinimumLength: model.NewInt(4),
		}}

		_, response := th.SystemAdminClient.PatchConfig(&config)

		assert.Equal(t, http.StatusBadRequest, response.StatusCode)
		assert.NotNil(t, response.Error)
		assert.Equal(t, "model.config.is_valid.password_length.app_error", response.Error.Id)
	})

	t.Run("should patch the config", func(t *testing.T) {
		*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = false
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.ExperimentalDefaultChannels = []string{"some-channel"} })

		oldConfig, _ := th.SystemAdminClient.GetConfig()

		assert.False(t, *oldConfig.PasswordSettings.Lowercase)
		assert.NotEqual(t, 15, *oldConfig.PasswordSettings.MinimumLength)
		assert.Equal(t, "DEBUG", *oldConfig.LogSettings.ConsoleLevel)
		assert.True(t, oldConfig.PluginSettings.PluginStates["com.mattermost.nps"].Enable)

		states := make(map[string]*model.PluginState)
		states["com.mattermost.nps"] = &model.PluginState{Enable: *model.NewBool(false)}
		config := model.Config{PasswordSettings: model.PasswordSettings{
			Lowercase:     model.NewBool(true),
			MinimumLength: model.NewInt(15),
		}, LogSettings: model.LogSettings{
			ConsoleLevel: model.NewString("INFO"),
		},
			TeamSettings: model.TeamSettings{
				ExperimentalDefaultChannels: []string{"another-channel"},
			},
			PluginSettings: model.PluginSettings{
				PluginStates: states,
			},
		}

		_, response := th.SystemAdminClient.PatchConfig(&config)

		updatedConfig, _ := th.SystemAdminClient.GetConfig()
		assert.True(t, *updatedConfig.PasswordSettings.Lowercase)
		assert.Equal(t, "INFO", *updatedConfig.LogSettings.ConsoleLevel)
		assert.Equal(t, []string{"another-channel"}, updatedConfig.TeamSettings.ExperimentalDefaultChannels)
		assert.False(t, updatedConfig.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
		assert.Equal(t, "no-cache, no-store, must-revalidate", response.Header.Get("Cache-Control"))
	})

	t.Run("should sanitize config", func(t *testing.T) {
		config := model.Config{PasswordSettings: model.PasswordSettings{
			Symbol: model.NewBool(true),
		}}

		updatedConfig, _ := th.SystemAdminClient.PatchConfig(&config)

		assert.Equal(t, model.FAKE_SETTING, *updatedConfig.SqlSettings.DataSource)
	})

	t.Run("not allowing to toggle enable uploads for plugin via api", func(t *testing.T) {
		config := model.Config{PluginSettings: model.PluginSettings{
			EnableUploads: model.NewBool(true),
		}}

		updatedConfig, _ := th.SystemAdminClient.PatchConfig(&config)

		assert.Equal(t, false, *updatedConfig.PluginSettings.EnableUploads)
	})
}
