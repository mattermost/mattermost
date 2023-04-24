// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/config"
	"github.com/mattermost/mattermost-server/server/v8/model"
)

func TestGetConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	_, resp, err := client.GetConfig()
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		cfg, _, err := client.GetConfig()
		require.NoError(t, err)

		require.NotEqual(t, "", cfg.TeamSettings.SiteName)

		if *cfg.LdapSettings.BindPassword != model.FakeSetting && *cfg.LdapSettings.BindPassword != "" {
			require.FailNow(t, "did not sanitize properly")
		}
		require.Equal(t, model.FakeSetting, *cfg.FileSettings.PublicLinkSalt, "did not sanitize properly")

		if *cfg.FileSettings.AmazonS3SecretAccessKey != model.FakeSetting && *cfg.FileSettings.AmazonS3SecretAccessKey != "" {
			require.FailNow(t, "did not sanitize properly")
		}
		if *cfg.EmailSettings.SMTPPassword != model.FakeSetting && *cfg.EmailSettings.SMTPPassword != "" {
			require.FailNow(t, "did not sanitize properly")
		}
		if *cfg.GitLabSettings.Secret != model.FakeSetting && *cfg.GitLabSettings.Secret != "" {
			require.FailNow(t, "did not sanitize properly")
		}
		require.Equal(t, model.FakeSetting, *cfg.SqlSettings.DataSource, "did not sanitize properly")
		require.Equal(t, model.FakeSetting, *cfg.SqlSettings.AtRestEncryptKey, "did not sanitize properly")
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceReplicas, " "), model.FakeSetting) && len(cfg.SqlSettings.DataSourceReplicas) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceSearchReplicas, " "), model.FakeSetting) && len(cfg.SqlSettings.DataSourceSearchReplicas) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
	})
}

func TestGetConfigWithAccessTag(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// set some values so that we know they're not blank
	mockVaryByHeader := model.NewId()
	mockSupportEmail := model.NewId() + "@mattermost.com"
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.RateLimitSettings.VaryByHeader = mockVaryByHeader
		cfg.SupportSettings.SupportEmail = &mockSupportEmail
	})

	th.Client.Login(th.BasicUser.Username, th.BasicUser.Password)

	// add read sysconsole environment config
	th.AddPermissionToRole(model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)
	defer th.RemovePermissionFromRole(model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)

	cfg, _, err := th.Client.GetConfig()
	require.NoError(t, err)

	t.Run("Cannot read value without permission", func(t *testing.T) {
		assert.Nil(t, cfg.SupportSettings.SupportEmail)
	})

	t.Run("Can read value with permission", func(t *testing.T) {
		assert.Equal(t, mockVaryByHeader, cfg.RateLimitSettings.VaryByHeader)
	})

	t.Run("Contains Feature Flags", func(t *testing.T) {
		assert.NotNil(t, cfg.FeatureFlags)
	})
}

func TestGetConfigAnyFlagsAccess(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.Client.Login(th.BasicUser.Username, th.BasicUser.Password)
	_, resp, _ := th.Client.GetConfig()

	t.Run("Check permissions error with no sysconsole read permission", func(t *testing.T) {
		CheckForbiddenStatus(t, resp)
	})

	// add read sysconsole environment config
	th.AddPermissionToRole(model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)
	defer th.RemovePermissionFromRole(model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)

	cfg, _, err := th.Client.GetConfig()
	require.NoError(t, err)
	t.Run("Can read value with permission", func(t *testing.T) {
		assert.NotNil(t, cfg.FeatureFlags)
	})
}

func TestReloadConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.ReloadConfig()
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err := client.ReloadConfig()
		require.NoError(t, err)
	}, "as system admin and local mode")

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := client.ReloadConfig()
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	cfg, _, err := th.SystemAdminClient.GetConfig()
	require.NoError(t, err)

	_, resp, err := client.UpdateConfig(cfg)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		SiteName := th.App.Config().TeamSettings.SiteName

		*cfg.TeamSettings.SiteName = "MyFancyName"
		cfg, _, err = client.UpdateConfig(cfg)
		require.NoError(t, err)

		require.Equal(t, "MyFancyName", *cfg.TeamSettings.SiteName, "It should update the SiteName")

		//Revert the change
		cfg.TeamSettings.SiteName = SiteName
		cfg, _, err = client.UpdateConfig(cfg)
		require.NoError(t, err)

		require.Equal(t, SiteName, cfg.TeamSettings.SiteName, "It should update the SiteName")

		t.Run("Should set defaults for missing fields", func(t *testing.T) {
			_, err = th.SystemAdminClient.DoAPIPut("/config", "{}")
			require.NoError(t, err)
		})

		t.Run("Should fail with validation error if invalid config setting is passed", func(t *testing.T) {
			//Revert the change
			badcfg := cfg.Clone()
			badcfg.PasswordSettings.MinimumLength = model.NewInt(4)
			badcfg.PasswordSettings.MinimumLength = model.NewInt(4)
			_, resp, err = client.UpdateConfig(badcfg)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
			CheckErrorID(t, err, "model.config.is_valid.password_length.app_error")
		})

		t.Run("Should not be able to modify PluginSettings.EnableUploads", func(t *testing.T) {
			oldEnableUploads := *th.App.Config().PluginSettings.EnableUploads
			*cfg.PluginSettings.EnableUploads = !oldEnableUploads

			cfg, _, err = client.UpdateConfig(cfg)
			require.NoError(t, err)
			assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
			assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)

			cfg.PluginSettings.EnableUploads = nil
			cfg, _, err = client.UpdateConfig(cfg)
			require.NoError(t, err)
			assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
			assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)
		})

		t.Run("Should not be able to modify PluginSettings.SignaturePublicKeyFiles", func(t *testing.T) {
			oldPublicKeys := th.App.Config().PluginSettings.SignaturePublicKeyFiles
			cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, "new_signature")

			cfg, _, err = client.UpdateConfig(cfg)
			require.NoError(t, err)
			assert.Equal(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)

			cfg.PluginSettings.SignaturePublicKeyFiles = nil
			cfg, _, err = client.UpdateConfig(cfg)
			require.NoError(t, err)
			assert.Equal(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)
		})
	})

	t.Run("Should not be able to modify PluginSettings.MarketplaceURL if EnableUploads is disabled", func(t *testing.T) {
		oldURL := "hello.com"
		newURL := "new.com"
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableUploads = false
			*cfg.PluginSettings.MarketplaceURL = oldURL
		})

		cfg2 := th.App.Config().Clone()
		*cfg2.PluginSettings.MarketplaceURL = newURL

		cfg2, _, err = th.SystemAdminClient.UpdateConfig(cfg2)
		require.NoError(t, err)
		assert.Equal(t, oldURL, *cfg2.PluginSettings.MarketplaceURL)

		// Allowing uploads
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.MarketplaceURL = oldURL
		})

		cfg2 = th.App.Config().Clone()
		*cfg2.PluginSettings.MarketplaceURL = newURL

		cfg2, _, err = th.SystemAdminClient.UpdateConfig(cfg2)
		require.NoError(t, err)
		assert.Equal(t, newURL, *cfg2.PluginSettings.MarketplaceURL)
	})

	t.Run("Should not be able to modify ComplianceSettings.Directory in cloud", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		defer th.App.Srv().RemoveLicense()

		cfg2 := th.App.Config().Clone()
		*cfg2.ComplianceSettings.Directory = "hellodir"

		_, resp, err = th.SystemAdminClient.UpdateConfig(cfg2)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("System Admin should not be able to clear Site URL", func(t *testing.T) {
		siteURL := cfg.ServiceSettings.SiteURL
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.SiteURL = siteURL })

		nonEmptyURL := "http://localhost"
		cfg.ServiceSettings.SiteURL = &nonEmptyURL

		// Set the SiteURL
		cfg, _, err = th.SystemAdminClient.UpdateConfig(cfg)
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *cfg.ServiceSettings.SiteURL)

		// Check that the Site URL can't be cleared
		cfg.ServiceSettings.SiteURL = sToP("")
		cfg, resp, err = th.SystemAdminClient.UpdateConfig(cfg)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.config.update_config.clear_siteurl.app_error")
		// Check that the Site URL wasn't cleared
		cfg, _, err = th.SystemAdminClient.GetConfig()
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *cfg.ServiceSettings.SiteURL)
	})
}

func TestGetConfigWithoutManageSystemPermission(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	th.Client.Login(th.BasicUser.Username, th.BasicUser.Password)

	t.Run("any sysconsole read permission provides config read access", func(t *testing.T) {
		// forbidden by default
		_, resp, err := th.Client.GetConfig()
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// add any sysconsole read permission
		th.AddPermissionToRole(model.SysconsoleReadPermissions[0].Id, model.SystemUserRoleId)
		_, _, err = th.Client.GetConfig()
		// should be readable now
		require.NoError(t, err)
	})
}

func TestUpdateConfigWithoutManageSystemPermission(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	th.Client.Login(th.BasicUser.Username, th.BasicUser.Password)

	// add read sysconsole integrations config
	th.AddPermissionToRole(model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.SystemUserRoleId)
	defer th.RemovePermissionFromRole(model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.SystemUserRoleId)

	t.Run("sysconsole read permission does not provides config write access", func(t *testing.T) {
		// should be readable because has a sysconsole read permission
		cfg, _, err := th.Client.GetConfig()
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateConfig(cfg)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("the wrong write permission does not grant access", func(t *testing.T) {
		// should be readable because has a sysconsole read permission
		cfg, _, err := th.SystemAdminClient.GetConfig()
		require.NoError(t, err)

		originalValue := *cfg.ServiceSettings.AllowCorsFrom

		// add the wrong write permission
		th.AddPermissionToRole(model.PermissionSysconsoleWriteAboutEditionAndLicense.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(model.PermissionSysconsoleWriteAboutEditionAndLicense.Id, model.SystemUserRoleId)

		// try update a config value allowed by sysconsole WRITE integrations
		mockVal := model.NewId()
		cfg.ServiceSettings.AllowCorsFrom = &mockVal
		_, _, err = th.Client.UpdateConfig(cfg)
		require.NoError(t, err)

		// ensure the config setting was not updated
		cfg, _, err = th.SystemAdminClient.GetConfig()
		require.NoError(t, err)
		assert.Equal(t, *cfg.ServiceSettings.AllowCorsFrom, originalValue)
	})

	t.Run("config value is writeable by specific system console permission", func(t *testing.T) {
		// should be readable because has a sysconsole read permission
		cfg, _, err := th.SystemAdminClient.GetConfig()
		require.NoError(t, err)

		th.AddPermissionToRole(model.PermissionSysconsoleWriteIntegrationsCors.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(model.PermissionSysconsoleWriteIntegrationsCors.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(model.PermissionSysconsoleReadIntegrationsCors.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(model.PermissionSysconsoleReadIntegrationsCors.Id, model.SystemUserRoleId)

		// try update a config value allowed by sysconsole WRITE integrations
		mockVal := model.NewId()
		cfg.ServiceSettings.AllowCorsFrom = &mockVal
		_, _, err = th.Client.UpdateConfig(cfg)
		require.NoError(t, err)

		// ensure the config setting was updated
		cfg, _, err = th.Client.GetConfig()
		require.NoError(t, err)
		assert.Equal(t, *cfg.ServiceSettings.AllowCorsFrom, mockVal)
	})
}

func TestUpdateConfigMessageExportSpecialHandling(t *testing.T) {
	th := Setup(t)
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
	cfg, _, err := th.SystemAdminClient.GetConfig()
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = true
	_, _, err = th.SystemAdminClient.UpdateConfig(cfg)
	require.NoError(t, err)

	assert.True(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.NotEqual(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Turn it off, timestamp should be cleared.
	cfg, _, err = th.SystemAdminClient.GetConfig()
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = false
	_, _, err = th.SystemAdminClient.UpdateConfig(cfg)
	require.NoError(t, err)

	assert.False(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Set a value from the config file.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = false
		*cfg.MessageExportSettings.ExportFromTimestamp = int64(12345)
	})

	// Turn it on, timestamp should *not* be updated.
	cfg, _, err = th.SystemAdminClient.GetConfig()
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = true
	_, _, err = th.SystemAdminClient.UpdateConfig(cfg)
	require.NoError(t, err)

	assert.True(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(12345), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Turn it off, timestamp should be cleared.
	cfg, _, err = th.SystemAdminClient.GetConfig()
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = false
	_, _, err = th.SystemAdminClient.UpdateConfig(cfg)
	require.NoError(t, err)

	assert.False(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)
}

func TestUpdateConfigRestrictSystemAdmin(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

	t.Run("Restrict flag should be honored for sysadmin", func(t *testing.T) {
		originalCfg, _, err := th.SystemAdminClient.GetConfig()
		require.NoError(t, err)

		cfg := originalCfg.Clone()
		*cfg.TeamSettings.SiteName = "MyFancyName"          // Allowed
		*cfg.ServiceSettings.SiteURL = "http://example.com" // Ignored

		returnedCfg, _, err := th.SystemAdminClient.UpdateConfig(cfg)
		require.NoError(t, err)

		require.Equal(t, "MyFancyName", *returnedCfg.TeamSettings.SiteName)
		require.Equal(t, *originalCfg.ServiceSettings.SiteURL, *returnedCfg.ServiceSettings.SiteURL)

		actualCfg, _, err := th.SystemAdminClient.GetConfig()
		require.NoError(t, err)

		require.Equal(t, returnedCfg, actualCfg)
	})

	t.Run("Restrict flag should be ignored by local mode", func(t *testing.T) {
		originalCfg, _, err := th.LocalClient.GetConfig()
		require.NoError(t, err)

		cfg := originalCfg.Clone()
		*cfg.TeamSettings.SiteName = "MyFancyName"          // Allowed
		*cfg.ServiceSettings.SiteURL = "http://example.com" // Ignored

		returnedCfg, _, err := th.LocalClient.UpdateConfig(cfg)
		require.NoError(t, err)

		require.Equal(t, "MyFancyName", *returnedCfg.TeamSettings.SiteName)
		require.Equal(t, "http://example.com", *returnedCfg.ServiceSettings.SiteURL)
	})
}

func TestUpdateConfigDiffInAuditRecord(t *testing.T) {
	logFile, err := os.CreateTemp("", "adv.log")
	require.NoError(t, err)
	defer os.Remove(logFile.Name())

	os.Setenv("MM_EXPERIMENTALAUDITSETTINGS_FILEENABLED", "true")
	os.Setenv("MM_EXPERIMENTALAUDITSETTINGS_FILENAME", logFile.Name())
	defer os.Unsetenv("MM_EXPERIMENTALAUDITSETTINGS_FILEENABLED")
	defer os.Unsetenv("MM_EXPERIMENTALAUDITSETTINGS_FILENAME")

	options := []app.Option{app.WithLicense(model.NewTestLicense("advanced_logging"))}
	th := SetupWithServerOptions(t, options)
	defer th.TearDown()

	cfg, _, err := th.SystemAdminClient.GetConfig()
	require.NoError(t, err)

	timeoutVal := *cfg.ServiceSettings.ReadTimeout
	cfg.ServiceSettings.ReadTimeout = model.NewInt(timeoutVal + 1)
	cfg, _, err = th.SystemAdminClient.UpdateConfig(cfg)
	require.NoError(t, err)
	defer th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.ReadTimeout = model.NewInt(timeoutVal)
	})
	require.Equal(t, timeoutVal+1, *cfg.ServiceSettings.ReadTimeout)

	// Forcing a flush before attempting to read log's content.
	err = th.Server.Audit.Flush()
	require.NoError(t, err)

	require.NoError(t, logFile.Sync())

	data, err := io.ReadAll(logFile)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	require.Contains(t, string(data),
		fmt.Sprintf(`"config_diffs":[{"actual_val":%d,"base_val":%d,"path":"ServiceSettings.ReadTimeout"}]`,
			timeoutVal+1, timeoutVal))
}

func TestGetEnvironmentConfig(t *testing.T) {
	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://example.mattermost.com")
	os.Setenv("MM_SERVICESETTINGS_ENABLECUSTOMEMOJI", "true")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")
	defer os.Unsetenv("MM_SERVICESETTINGS_ENABLECUSTOMEMOJI")

	th := Setup(t)
	defer th.TearDown()

	t.Run("as system admin", func(t *testing.T) {
		SystemAdminClient := th.SystemAdminClient

		envConfig, _, err := SystemAdminClient.GetEnvironmentConfig()
		require.NoError(t, err)

		serviceSettings, ok := envConfig["ServiceSettings"]
		require.True(t, ok, "should've returned ServiceSettings")

		serviceSettingsAsMap, ok := serviceSettings.(map[string]any)
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

		envConfig, _, err := TeamAdminClient.GetEnvironmentConfig()
		require.NoError(t, err)
		require.Empty(t, envConfig)
	})

	t.Run("as regular user", func(t *testing.T) {
		client := th.Client

		envConfig, _, err := client.GetEnvironmentConfig()
		require.NoError(t, err)
		require.Empty(t, envConfig)
	})

	t.Run("as not-regular user", func(t *testing.T) {
		client := th.CreateClient()

		_, resp, err := client.GetEnvironmentConfig()
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetOldClientConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testKey := "supersecretkey"
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoogleDeveloperKey = testKey })

	t.Run("with session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		client := th.Client

		config, _, err := client.GetOldClientConfig("")
		require.NoError(t, err)

		require.NotEmpty(t, config["Version"], "config not returned correctly")
		require.Equal(t, testKey, config["GoogleDeveloperKey"])
	})

	t.Run("without session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		client := th.CreateClient()

		config, _, err := client.GetOldClientConfig("")
		require.NoError(t, err)

		require.NotEmpty(t, config["Version"], "config not returned correctly")
		require.Empty(t, config["GoogleDeveloperKey"], "config should be missing developer key")
	})

	t.Run("missing format", func(t *testing.T) {
		client := th.Client

		resp, err := client.DoAPIGet("/config/client", "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("invalid format", func(t *testing.T) {
		client := th.Client

		resp, err := client.DoAPIGet("/config/client?format=junk", "")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestPatchConfig(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("config is missing", func(t *testing.T) {
		_, response, err := th.Client.PatchConfig(nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("user is not system admin", func(t *testing.T) {
		_, response, err := th.Client.PatchConfig(&model.Config{})
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	t.Run("should not update the restricted fields when restrict toggle is on for sysadmin", func(t *testing.T) {
		*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = true

		config := model.Config{LogSettings: model.LogSettings{
			ConsoleLevel: model.NewString("INFO"),
		}}

		updatedConfig, _, _ := th.SystemAdminClient.PatchConfig(&config)

		assert.Equal(t, "DEBUG", *updatedConfig.LogSettings.ConsoleLevel)
	})

	t.Run("should not bypass the restrict toggle if local client", func(t *testing.T) {
		*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = true

		config := model.Config{LogSettings: model.LogSettings{
			ConsoleLevel: model.NewString("INFO"),
		}}

		oldConfig, _, _ := th.LocalClient.GetConfig()
		updatedConfig, _, _ := th.LocalClient.PatchConfig(&config)

		assert.Equal(t, "INFO", *updatedConfig.LogSettings.ConsoleLevel)
		// reset the config
		_, _, err := th.LocalClient.UpdateConfig(oldConfig)
		require.NoError(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("check if config is valid", func(t *testing.T) {
			config := model.Config{PasswordSettings: model.PasswordSettings{
				MinimumLength: model.NewInt(4),
			}}

			_, response, err := client.PatchConfig(&config)

			assert.Equal(t, http.StatusBadRequest, response.StatusCode)
			assert.Error(t, err)
			CheckErrorID(t, err, "model.config.is_valid.password_length.app_error")
		})

		t.Run("should patch the config", func(t *testing.T) {
			*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = false
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.ExperimentalDefaultChannels = []string{"some-channel"} })

			oldConfig, _, err := client.GetConfig()
			require.NoError(t, err)

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

			_, response, err := client.PatchConfig(&config)
			require.NoError(t, err)

			updatedConfig, _, err := client.GetConfig()
			require.NoError(t, err)
			assert.True(t, *updatedConfig.PasswordSettings.Lowercase)
			assert.Equal(t, "INFO", *updatedConfig.LogSettings.ConsoleLevel)
			assert.Equal(t, []string{"another-channel"}, updatedConfig.TeamSettings.ExperimentalDefaultChannels)
			assert.False(t, updatedConfig.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
			assert.Equal(t, "no-cache, no-store, must-revalidate", response.Header.Get("Cache-Control"))

			// reset the config
			_, _, err = client.UpdateConfig(oldConfig)
			require.NoError(t, err)
		})

		t.Run("should sanitize config", func(t *testing.T) {
			config := model.Config{PasswordSettings: model.PasswordSettings{
				Symbol: model.NewBool(true),
			}}

			updatedConfig, _, err := client.PatchConfig(&config)
			require.NoError(t, err)

			assert.Equal(t, model.FakeSetting, *updatedConfig.SqlSettings.DataSource)
		})

		t.Run("not allowing to toggle enable uploads for plugin via api", func(t *testing.T) {
			config := model.Config{PluginSettings: model.PluginSettings{
				EnableUploads: model.NewBool(true),
			}}

			updatedConfig, resp, err := client.PatchConfig(&config)
			if client == th.LocalClient {
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				assert.Equal(t, true, *updatedConfig.PluginSettings.EnableUploads)
			} else {
				require.Error(t, err)
				CheckForbiddenStatus(t, resp)
			}
		})
	})

	t.Run("Should not be able to modify PluginSettings.MarketplaceURL if EnableUploads is disabled", func(t *testing.T) {
		oldURL := "hello.com"
		newURL := "new.com"
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableUploads = false
			*cfg.PluginSettings.MarketplaceURL = oldURL
		})

		cfg := th.App.Config().Clone()
		*cfg.PluginSettings.MarketplaceURL = newURL

		_, _, err := th.SystemAdminClient.PatchConfig(cfg)
		require.Error(t, err)

		// Allowing uploads
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.MarketplaceURL = oldURL
		})

		cfg = th.App.Config().Clone()
		*cfg.PluginSettings.MarketplaceURL = newURL

		cfg, _, err = th.SystemAdminClient.PatchConfig(cfg)
		require.NoError(t, err)
		assert.Equal(t, newURL, *cfg.PluginSettings.MarketplaceURL)
	})

	t.Run("System Admin should not be able to clear Site URL", func(t *testing.T) {
		cfg, _, err := th.SystemAdminClient.GetConfig()
		require.NoError(t, err)
		siteURL := cfg.ServiceSettings.SiteURL
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.SiteURL = siteURL })

		// Set the SiteURL
		nonEmptyURL := "http://localhost"
		config := model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: model.NewString(nonEmptyURL),
			},
		}
		updatedConfig, _, err := th.SystemAdminClient.PatchConfig(&config)
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *updatedConfig.ServiceSettings.SiteURL)

		// Check that the Site URL can't be cleared
		config = model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: model.NewString(""),
			},
		}
		_, resp, err := th.SystemAdminClient.PatchConfig(&config)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.config.update_config.clear_siteurl.app_error")

		// Check that the Site URL wasn't cleared
		cfg, _, err = th.SystemAdminClient.GetConfig()
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *cfg.ServiceSettings.SiteURL)

		// Check that sending an empty config returns no error.
		_, _, err = th.SystemAdminClient.PatchConfig(&model.Config{})
		require.NoError(t, err)
	})
}

func TestMigrateConfig(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("LocalClient", func(t *testing.T) {
		cfg := &model.Config{}
		cfg.SetDefaults()

		file, err := json.MarshalIndent(cfg, "", "  ")
		require.NoError(t, err)

		err = os.WriteFile("from.json", file, 0644)
		require.NoError(t, err)

		defer os.Remove("from.json")

		f, err := config.NewStoreFromDSN("from.json", false, nil, false)
		require.NoError(t, err)
		defer f.RemoveFile("from.json")

		_, err = config.NewStoreFromDSN("to.json", false, nil, true)
		require.NoError(t, err)
		defer f.RemoveFile("to.json")

		_, err = th.LocalClient.MigrateConfig("from.json", "to.json")
		require.NoError(t, err)
	})
}
