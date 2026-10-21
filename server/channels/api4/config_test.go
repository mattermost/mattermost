// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/config"
)

func TestGetConfig(t *testing.T) {
	th := Setup(t)
	client := th.Client

	_, resp, err := client.GetConfig(context.Background())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	t.Run("Get config for system admin client", func(t *testing.T) {
		cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
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
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceReplicas, " "), model.FakeSetting) && len(cfg.SqlSettings.DataSourceReplicas) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceSearchReplicas, " "), model.FakeSetting) && len(cfg.SqlSettings.DataSourceSearchReplicas) != 0 {
			require.FailNow(t, "did not sanitize properly")
		}
	})

	t.Run("Get config for local client", func(t *testing.T) {
		cfg, _, err := th.LocalClient.GetConfig(context.Background())
		require.NoError(t, err)

		require.NotEqual(t, model.FakeSetting, *cfg.SqlSettings.DataSource)
		require.NotEqual(t, model.FakeSetting, *cfg.FileSettings.PublicLinkSalt)
	})
}

func TestGetConfigWithAccessTag(t *testing.T) {
	th := Setup(t)

	// set some values so that we know they're not blank
	mockVaryByHeader := model.NewId()
	mockSupportEmail := model.NewId() + "@mattermost.com"
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.RateLimitSettings.VaryByHeader = mockVaryByHeader
		cfg.SupportSettings.SupportEmail = &mockSupportEmail
	})

	_, _, err := th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)

	// add read sysconsole environment config
	th.AddPermissionToRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)

	cfg, _, err := th.Client.GetConfig(context.Background())
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

	_, _, err := th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)
	_, resp, _ := th.Client.GetConfig(context.Background())

	t.Run("Check permissions error with no sysconsole read permission", func(t *testing.T) {
		CheckForbiddenStatus(t, resp)
	})

	// add read sysconsole environment config
	th.AddPermissionToRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)

	cfg, _, err := th.Client.GetConfig(context.Background())
	require.NoError(t, err)
	t.Run("Can read value with permission", func(t *testing.T) {
		assert.NotNil(t, cfg.FeatureFlags)
		assert.NotNil(t, cfg.ExperimentalSettings.RestrictSystemAdmin)
	})
}

func TestReloadConfig(t *testing.T) {
	th := Setup(t)
	client := th.Client

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.ReloadConfig(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, err := client.ReloadConfig(context.Background())
		require.NoError(t, err)
	}, "as system admin and local mode")

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := client.ReloadConfig(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateConfig(t *testing.T) {
	th := Setup(t)
	client := th.Client

	cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
	require.NoError(t, err)

	_, resp, err := client.UpdateConfig(context.Background(), cfg)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		SiteName := th.App.Config().TeamSettings.SiteName

		*cfg.TeamSettings.SiteName = "MyFancyName"
		cfg, _, err = client.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		require.Equal(t, "MyFancyName", *cfg.TeamSettings.SiteName, "It should update the SiteName")

		//Revert the change
		cfg.TeamSettings.SiteName = SiteName
		cfg, _, err = client.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		require.Equal(t, SiteName, cfg.TeamSettings.SiteName, "It should update the SiteName")

		t.Run("Should set defaults for missing fields", func(t *testing.T) {
			_, err = th.SystemAdminClient.DoAPIPut(context.Background(), "/config", "{}")
			require.NoError(t, err)
		})

		t.Run("Should fail with validation error if invalid config setting is passed", func(t *testing.T) {
			//Revert the change
			badcfg := cfg.Clone()
			badcfg.PasswordSettings.MinimumLength = new(4)
			_, resp, err = client.UpdateConfig(context.Background(), badcfg)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
			CheckErrorID(t, err, "model.config.is_valid.password_length.app_error")
		})
	})

	t.Run("Ensure PluginSettings.EnableUploads settings are protected", func(t *testing.T) {
		t.Run("sysadmin", func(t *testing.T) {
			oldEnableUploads := *th.App.Config().PluginSettings.EnableUploads
			*cfg.PluginSettings.EnableUploads = !oldEnableUploads

			cfg, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
			assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)

			cfg.PluginSettings.EnableUploads = nil
			cfg, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
			assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)
		})

		t.Run("local mode", func(t *testing.T) {
			oldEnableUploads := *th.App.Config().PluginSettings.EnableUploads
			*cfg.PluginSettings.EnableUploads = !oldEnableUploads

			cfg, _, err = th.LocalClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.NotEqual(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
			assert.NotEqual(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)

			cfg.PluginSettings.EnableUploads = nil
			cfg, _, err = th.LocalClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
			assert.Equal(t, oldEnableUploads, *th.App.Config().PluginSettings.EnableUploads)
		})
	})

	t.Run("Should not be able to modify PluginSettings.SignaturePublicKeyFiles", func(t *testing.T) {
		t.Run("sysadmin", func(t *testing.T) {
			oldPublicKeys := th.App.Config().PluginSettings.SignaturePublicKeyFiles
			cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, "new_signature")

			cfg, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.Equal(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)

			cfg.PluginSettings.SignaturePublicKeyFiles = nil
			cfg, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.Equal(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)
		})

		t.Run("local mode", func(t *testing.T) {
			oldPublicKeys := th.App.Config().PluginSettings.SignaturePublicKeyFiles
			cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, "new_signature")

			cfg, _, err = th.LocalClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)
			assert.NotEqual(t, oldPublicKeys, cfg.PluginSettings.SignaturePublicKeyFiles)
			assert.NotEqual(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)

			cfg.PluginSettings.SignaturePublicKeyFiles = nil
			cfg, _, err = th.LocalClient.UpdateConfig(context.Background(), cfg)
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

		cfg2, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg2)
		require.NoError(t, err)
		assert.Equal(t, oldURL, *cfg2.PluginSettings.MarketplaceURL)

		// Allowing uploads
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.MarketplaceURL = oldURL
		})

		cfg2 = th.App.Config().Clone()
		*cfg2.PluginSettings.MarketplaceURL = newURL

		cfg2, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg2)
		require.NoError(t, err)
		assert.Equal(t, newURL, *cfg2.PluginSettings.MarketplaceURL)
	})

	t.Run("Should not be able to modify ComplianceSettings.Directory in cloud", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		cfg2 := th.App.Config().Clone()
		*cfg2.ComplianceSettings.Directory = "hellodir"

		_, resp, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg2)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Should not be able to modify ImportSettings.Directory", func(t *testing.T) {
		t.Run("sysadmin", func(t *testing.T) {
			oldDirectory := *th.App.Config().ImportSettings.Directory
			cfg2 := th.App.Config().Clone()
			*cfg2.ImportSettings.Directory = "./new-import-dir"

			cfg2, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg2)
			require.NoError(t, err)
			assert.Equal(t, oldDirectory, *cfg2.ImportSettings.Directory)
			assert.Equal(t, oldDirectory, *th.App.Config().ImportSettings.Directory)

			cfg2.ImportSettings.Directory = nil
			cfg2, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg2)
			require.NoError(t, err)
			assert.Equal(t, oldDirectory, *cfg2.ImportSettings.Directory)
			assert.Equal(t, oldDirectory, *th.App.Config().ImportSettings.Directory)
		})

		t.Run("local mode", func(t *testing.T) {
			oldDirectory := *th.App.Config().ImportSettings.Directory
			cfg2 := th.App.Config().Clone()
			newDirectory := "./new-import-dir"
			*cfg2.ImportSettings.Directory = newDirectory

			cfg2, _, err = th.LocalClient.UpdateConfig(context.Background(), cfg2)
			require.NoError(t, err)
			assert.Equal(t, newDirectory, *cfg2.ImportSettings.Directory)
			assert.Equal(t, newDirectory, *th.App.Config().ImportSettings.Directory)

			cfg2.ImportSettings.Directory = nil
			cfg2, _, err = th.LocalClient.UpdateConfig(context.Background(), cfg2)
			require.NoError(t, err)
			assert.Equal(t, oldDirectory, *cfg2.ImportSettings.Directory)
			assert.Equal(t, oldDirectory, *th.App.Config().ImportSettings.Directory)
		})
	})

	t.Run("System Admin should not be able to clear Site URL", func(t *testing.T) {
		siteURL := cfg.ServiceSettings.SiteURL
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.SiteURL = siteURL })

		nonEmptyURL := "http://localhost"
		cfg.ServiceSettings.SiteURL = &nonEmptyURL

		// Set the SiteURL
		cfg, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *cfg.ServiceSettings.SiteURL)

		// Check that the Site URL can't be cleared
		cfg.ServiceSettings.SiteURL = new("")
		cfg, resp, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.config.update_config.clear_siteurl.app_error")
		// Check that the Site URL wasn't cleared
		cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *cfg.ServiceSettings.SiteURL)
	})

	t.Run("Should keep the settings of plugins that aren't shown unless they are sent", func(t *testing.T) {
		pluginDir := filepath.Join(*th.App.Config().PluginSettings.Directory, "com.example.installed")
		require.NoError(t, os.MkdirAll(pluginDir, 0700))
		defer os.RemoveAll(pluginDir)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte(`{"id": "com.example.installed"}`), 0600))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Plugins["com.example.installed"] = map[string]any{"key": "installed"}
			cfg.PluginSettings.Plugins["com.example.uninstalled"] = map[string]any{"key": "uninstalled"}
			cfg.PluginSettings.Plugins["com.example.replaced"] = map[string]any{"key": "old"}
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			delete(cfg.PluginSettings.Plugins, "com.example.installed")
			delete(cfg.PluginSettings.Plugins, "com.example.uninstalled")
			delete(cfg.PluginSettings.Plugins, "com.example.replaced")
		})

		cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)
		require.Contains(t, cfg.PluginSettings.Plugins, "com.example.installed")
		require.NotContains(t, cfg.PluginSettings.Plugins, "com.example.uninstalled")
		require.NotContains(t, cfg.PluginSettings.Plugins, "com.example.replaced")

		delete(cfg.PluginSettings.Plugins, "com.example.installed")
		cfg.PluginSettings.Plugins["com.example.replaced"] = map[string]any{"key": "new"}
		_, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		plugins := th.App.Config().PluginSettings.Plugins
		require.NotContains(t, plugins, "com.example.installed")
		require.Equal(t, map[string]any{"key": "uninstalled"}, plugins["com.example.uninstalled"])
		require.Equal(t, map[string]any{"key": "new"}, plugins["com.example.replaced"])
	})
}

func TestGetConfigWithoutManageSystemPermission(t *testing.T) {
	th := Setup(t)
	_, _, err := th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)

	t.Run("any sysconsole read permission provides config read access", func(t *testing.T) {
		// forbidden by default
		_, resp, err := th.Client.GetConfig(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// add any sysconsole read permission
		th.AddPermissionToRole(t, model.SysconsoleReadPermissions[0].Id, model.SystemUserRoleId)
		_, _, err = th.Client.GetConfig(context.Background())
		// should be readable now
		require.NoError(t, err)
	})
}

func TestUpdateConfigWithoutManageSystemPermission(t *testing.T) {
	th := Setup(t)
	_, _, err := th.Client.Login(context.Background(), th.BasicUser.Username, th.BasicUser.Password)
	require.NoError(t, err)

	// add read sysconsole integrations config
	th.AddPermissionToRole(t, model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.SystemUserRoleId)
	defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadIntegrationsIntegrationManagement.Id, model.SystemUserRoleId)

	t.Run("sysconsole read permission does not provides config write access", func(t *testing.T) {
		// should be readable because has a sysconsole read permission
		cfg, _, err := th.Client.GetConfig(context.Background())
		require.NoError(t, err)

		_, resp, err := th.Client.UpdateConfig(context.Background(), cfg)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("the wrong write permission does not grant access", func(t *testing.T) {
		// should be readable because has a sysconsole read permission
		cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)

		originalValue := *cfg.ServiceSettings.AllowCorsFrom

		// add the wrong write permission
		th.AddPermissionToRole(t, model.PermissionSysconsoleWriteAboutEditionAndLicense.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleWriteAboutEditionAndLicense.Id, model.SystemUserRoleId)

		// try update a config value allowed by sysconsole WRITE integrations
		mockVal := model.NewId()
		cfg.ServiceSettings.AllowCorsFrom = &mockVal
		_, _, err = th.Client.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		// ensure the config setting was not updated
		cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)
		assert.Equal(t, *cfg.ServiceSettings.AllowCorsFrom, originalValue)
	})

	t.Run("config value is writeable by specific system console permission", func(t *testing.T) {
		// should be readable because has a sysconsole read permission
		cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)

		th.AddPermissionToRole(t, model.PermissionSysconsoleWriteIntegrationsCors.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleWriteIntegrationsCors.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadIntegrationsCors.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadIntegrationsCors.Id, model.SystemUserRoleId)

		// try update a config value allowed by sysconsole WRITE integrations
		mockVal := model.NewId()
		cfg.ServiceSettings.AllowCorsFrom = &mockVal
		_, _, err = th.Client.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		// ensure the config setting was updated
		cfg, _, err = th.Client.GetConfig(context.Background())
		require.NoError(t, err)
		assert.Equal(t, *cfg.ServiceSettings.AllowCorsFrom, mockVal)
	})

	t.Run("the site URL is kept for a user who can't read it", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "" })
		th.AddPermissionToRole(t, model.PermissionSysconsoleWriteIntegrationsCors.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleWriteIntegrationsCors.Id, model.SystemUserRoleId)
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadIntegrationsCors.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadIntegrationsCors.Id, model.SystemUserRoleId)

		cfg, _, err := th.Client.GetConfig(context.Background())
		require.NoError(t, err)
		require.Nil(t, cfg.ServiceSettings.SiteURL)

		mockVal := model.NewId()
		cfg.ServiceSettings.AllowCorsFrom = &mockVal
		_, _, err = th.Client.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)
		assert.Equal(t, mockVal, *th.App.Config().ServiceSettings.AllowCorsFrom)
		assert.Equal(t, "http://localhost:8065", *th.App.Config().ServiceSettings.SiteURL)
	})
}

func TestUpdateConfigMessageExportSpecialHandling(t *testing.T) {
	th := Setup(t)

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
	cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = true
	_, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(t, err)

	assert.True(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.NotEqual(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Turn it off, timestamp should be cleared.
	cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = false
	_, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(t, err)

	assert.False(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Set a value from the config file.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = false
		*cfg.MessageExportSettings.ExportFromTimestamp = int64(12345)
	})

	// Turn it on, timestamp should *not* be updated.
	cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = true
	_, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(t, err)

	assert.True(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(12345), *th.App.Config().MessageExportSettings.ExportFromTimestamp)

	// Turn it off, timestamp should be cleared.
	cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
	require.NoError(t, err)

	*cfg.MessageExportSettings.EnableExport = false
	_, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(t, err)

	assert.False(t, *th.App.Config().MessageExportSettings.EnableExport)
	assert.Equal(t, int64(0), *th.App.Config().MessageExportSettings.ExportFromTimestamp)
}

func TestUpdateConfigRestrictSystemAdmin(t *testing.T) {
	th := Setup(t)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

	t.Run("Restrict flag should be honored for sysadmin", func(t *testing.T) {
		originalCfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)

		cfg := originalCfg.Clone()
		*cfg.TeamSettings.SiteName = "MyFancyName"          // Allowed
		*cfg.ServiceSettings.SiteURL = "http://example.com" // Ignored

		returnedCfg, _, err := th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		require.Equal(t, "MyFancyName", *returnedCfg.TeamSettings.SiteName)
		require.Equal(t, *originalCfg.ServiceSettings.SiteURL, *returnedCfg.ServiceSettings.SiteURL)

		actualCfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)

		require.Equal(t, returnedCfg, actualCfg)
	})

	t.Run("Restrict flag should be ignored by local mode", func(t *testing.T) {
		originalCfg, _, err := th.LocalClient.GetConfig(context.Background())
		require.NoError(t, err)

		cfg := originalCfg.Clone()
		*cfg.TeamSettings.SiteName = "MyFancyName"          // Allowed
		*cfg.ServiceSettings.SiteURL = "http://example.com" // Ignored

		returnedCfg, _, err := th.LocalClient.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)

		require.Equal(t, "MyFancyName", *returnedCfg.TeamSettings.SiteName)
		require.Equal(t, "http://example.com", *returnedCfg.ServiceSettings.SiteURL)
	})
}

func TestUpdateConfigDiffInAuditRecord(t *testing.T) {
	logFile, err := os.CreateTemp("", "adv.log")
	require.NoError(t, err)
	defer os.Remove(logFile.Name())

	options := []app.Option{app.WithLicense(model.NewTestLicense("advanced_logging"))}
	th := SetupWithServerOptionsAndConfig(t, options, func(cfg *model.Config) {
		cfg.ExperimentalAuditSettings.FileEnabled = new(true)
		cfg.ExperimentalAuditSettings.FileName = new(logFile.Name())
	})

	cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
	require.NoError(t, err)

	timeoutVal := *cfg.ServiceSettings.ReadTimeout
	cfg.ServiceSettings.ReadTimeout = new(timeoutVal + 1)
	cfg, _, err = th.SystemAdminClient.UpdateConfig(context.Background(), cfg)
	require.NoError(t, err)
	defer th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.ReadTimeout = new(timeoutVal)
	})
	require.Equal(t, timeoutVal+1, *cfg.ServiceSettings.ReadTimeout)

	// Forcing a flush before attempting to read log's content.
	err = th.Server.Audit.Flush()
	require.NoError(t, err)

	require.NoError(t, logFile.Sync())

	data, err := io.ReadAll(logFile)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	entry := FindAuditEntry(string(data), "updateConfig", "")
	require.NotNil(t, entry, "should find an updateConfig audit entry")
	// Verify config diffs are in the raw entry
	require.Contains(t, fmt.Sprintf("%v", entry.Raw),
		fmt.Sprintf("actual_val:%d", timeoutVal+1))
	require.Contains(t, fmt.Sprintf("%v", entry.Raw),
		fmt.Sprintf("base_val:%d", timeoutVal))
}

func TestGetEnvironmentConfig(t *testing.T) {
	// These MUST be t.Setenv (not UpdateConfig) because GetEnvironmentConfig
	// returns only config values sourced from environment variables.
	// t.Setenv prevents t.Parallel — intentionally serial.
	t.Setenv("MM_SERVICESETTINGS_SITEURL", "http://example.mattermost.com")
	t.Setenv("MM_SERVICESETTINGS_ENABLECUSTOMEMOJI", "true")

	th := Setup(t)

	t.Run("as system admin", func(t *testing.T) {
		SystemAdminClient := th.SystemAdminClient

		envConfig, _, err := SystemAdminClient.GetEnvironmentConfig(context.Background())
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
		th.LoginTeamAdminWithClient(t, TeamAdminClient)

		envConfig, _, err := TeamAdminClient.GetEnvironmentConfig(context.Background())
		require.NoError(t, err)
		require.Empty(t, envConfig)
	})

	t.Run("as regular user", func(t *testing.T) {
		client := th.Client

		envConfig, _, err := client.GetEnvironmentConfig(context.Background())
		require.NoError(t, err)
		require.Empty(t, envConfig)
	})

	t.Run("as not-regular user", func(t *testing.T) {
		client := th.CreateClient()

		_, resp, err := client.GetEnvironmentConfig(context.Background())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetClientConfig(t *testing.T) {
	th := Setup(t)

	testKey := "supersecretkey"
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoogleDeveloperKey = testKey })

	t.Run("with session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		client := th.Client

		config, _, err := client.GetClientConfig(context.Background(), "")
		require.NoError(t, err)

		require.NotEmpty(t, config["Version"], "config not returned correctly")
		require.Equal(t, testKey, config["GoogleDeveloperKey"])
	})

	t.Run("without session", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.GoogleDeveloperKey = testKey
		})

		client := th.CreateClient()

		config, _, err := client.GetClientConfig(context.Background(), "")
		require.NoError(t, err)

		require.NotEmpty(t, config["Version"], "config not returned correctly")
		require.Empty(t, config["GoogleDeveloperKey"], "config should be missing developer key")
	})

	t.Run("format=old (backward compatibility)", func(t *testing.T) {
		client := th.Client

		resp, err := client.DoAPIGet(context.Background(), "/config/client?format=old", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var config map[string]string
		err = json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, err)
		require.NotEmpty(t, config["Version"], "config not returned correctly")
	})

	t.Run("format=junk (ignored)", func(t *testing.T) {
		client := th.Client

		resp, err := client.DoAPIGet(context.Background(), "/config/client?format=junk", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var config map[string]string
		err = json.NewDecoder(resp.Body).Decode(&config)
		require.NoError(t, err)
		require.NotEmpty(t, config["Version"], "config not returned correctly")
	})
}

func TestPatchConfig(t *testing.T) {
	th := Setup(t)

	// Ensure ConsoleLevel is set to DEBUG
	config := model.Config{LogSettings: model.LogSettings{
		ConsoleLevel: new("DEBUG"),
	}}
	_, _, err := th.SystemAdminClient.PatchConfig(context.Background(), &config)
	require.NoError(t, err)

	t.Run("config is missing", func(t *testing.T) {
		_, response, err := th.Client.PatchConfig(context.Background(), nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, response)
	})

	t.Run("user is not system admin", func(t *testing.T) {
		_, response, err := th.Client.PatchConfig(context.Background(), &model.Config{})
		require.Error(t, err)
		CheckForbiddenStatus(t, response)
	})

	t.Run("should not update the restricted fields when restrict toggle is on for sysadmin", func(t *testing.T) {
		*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = true

		config := model.Config{LogSettings: model.LogSettings{
			ConsoleLevel: new("INFO"),
		}}

		updatedConfig, _, _ := th.SystemAdminClient.PatchConfig(context.Background(), &config)

		assert.Equal(t, "DEBUG", *updatedConfig.LogSettings.ConsoleLevel)
	})

	t.Run("should not bypass the restrict toggle if local client", func(t *testing.T) {
		*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = true

		config := model.Config{LogSettings: model.LogSettings{
			ConsoleLevel: new("INFO"),
		}}

		oldConfig, _, _ := th.LocalClient.GetConfig(context.Background())
		updatedConfig, _, _ := th.LocalClient.PatchConfig(context.Background(), &config)

		assert.Equal(t, "INFO", *updatedConfig.LogSettings.ConsoleLevel)
		// reset the config
		_, _, err := th.LocalClient.UpdateConfig(context.Background(), oldConfig)
		require.NoError(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("check if config is valid", func(t *testing.T) {
			config := model.Config{PasswordSettings: model.PasswordSettings{
				MinimumLength: new(4),
			}}

			_, response, err := client.PatchConfig(context.Background(), &config)

			assert.Equal(t, http.StatusBadRequest, response.StatusCode)
			assert.Error(t, err)
			CheckErrorID(t, err, "model.config.is_valid.password_length.app_error")
		})

		t.Run("should patch the config", func(t *testing.T) {
			*th.App.Config().ExperimentalSettings.RestrictSystemAdmin = false
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.ExperimentalDefaultChannels = []string{"some-channel"} })

			oldConfig, _, err := client.GetConfig(context.Background())
			require.NoError(t, err)

			assert.False(t, *oldConfig.PasswordSettings.Lowercase)
			assert.NotEqual(t, 15, *oldConfig.PasswordSettings.MinimumLength)
			assert.Equal(t, "DEBUG", *oldConfig.LogSettings.ConsoleLevel)
			assert.True(t, oldConfig.PluginSettings.PluginStates["com.mattermost.nps"].Enable)

			states := make(map[string]*model.PluginState)
			states["com.mattermost.nps"] = &model.PluginState{Enable: *new(false)}
			config := model.Config{PasswordSettings: model.PasswordSettings{
				Lowercase:     new(true),
				MinimumLength: new(15),
			}, LogSettings: model.LogSettings{
				ConsoleLevel: new("INFO"),
			},
				TeamSettings: model.TeamSettings{
					ExperimentalDefaultChannels: []string{"another-channel"},
				},
				PluginSettings: model.PluginSettings{
					PluginStates: states,
				},
			}

			_, response, err := client.PatchConfig(context.Background(), &config)
			require.NoError(t, err)

			updatedConfig, _, err := client.GetConfig(context.Background())
			require.NoError(t, err)
			assert.True(t, *updatedConfig.PasswordSettings.Lowercase)
			assert.Equal(t, "INFO", *updatedConfig.LogSettings.ConsoleLevel)
			assert.Equal(t, []string{"another-channel"}, updatedConfig.TeamSettings.ExperimentalDefaultChannels)
			assert.False(t, updatedConfig.PluginSettings.PluginStates["com.mattermost.nps"].Enable)
			assert.Equal(t, "no-cache, no-store, must-revalidate", response.Header.Get("Cache-Control"))

			// reset the config
			_, _, err = client.UpdateConfig(context.Background(), oldConfig)
			require.NoError(t, err)
		})

		t.Run("should sanitize config", func(t *testing.T) {
			config := model.Config{PasswordSettings: model.PasswordSettings{
				Symbol: new(true),
			}}

			updatedConfig, _, err := client.PatchConfig(context.Background(), &config)
			require.NoError(t, err)

			assert.Equal(t, model.FakeSetting, *updatedConfig.SqlSettings.DataSource)
		})

		t.Run("not allowing to toggle enable uploads for plugin via api", func(t *testing.T) {
			config := model.Config{PluginSettings: model.PluginSettings{
				EnableUploads: new(true),
			}}

			updatedConfig, resp, err := client.PatchConfig(context.Background(), &config)
			if client == th.LocalClient {
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				assert.Equal(t, true, *updatedConfig.PluginSettings.EnableUploads)
			} else {
				require.Error(t, err)
				CheckForbiddenStatus(t, resp)
			}
		})

		t.Run("not allowing to change import directory via api, unless local mode", func(t *testing.T) {
			oldDirectory := *th.App.Config().ImportSettings.Directory
			config := model.Config{ImportSettings: model.ImportSettings{
				Directory: new("./new-import-dir"),
			}}

			updatedConfig, resp, err := client.PatchConfig(context.Background(), &config)
			if client == th.LocalClient {
				require.NoError(t, err)
				CheckOKStatus(t, resp)
				assert.Equal(t, "./new-import-dir", *updatedConfig.ImportSettings.Directory)
			} else {
				require.Error(t, err)
				CheckForbiddenStatus(t, resp)
			}

			// Reset for local mode
			if client == th.LocalClient {
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.ImportSettings.Directory = oldDirectory
				})
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

		_, _, err := th.SystemAdminClient.PatchConfig(context.Background(), cfg)
		require.Error(t, err)

		// Allowing uploads
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.EnableUploads = true
			*cfg.PluginSettings.MarketplaceURL = oldURL
		})

		cfg = th.App.Config().Clone()
		*cfg.PluginSettings.MarketplaceURL = newURL

		cfg, _, err = th.SystemAdminClient.PatchConfig(context.Background(), cfg)
		require.NoError(t, err)
		assert.Equal(t, newURL, *cfg.PluginSettings.MarketplaceURL)
	})

	t.Run("Should not be able to modify PluginSettings.SignaturePublicKeyFiles", func(t *testing.T) {
		// Mirror the behavior of the full update endpoint (TestUpdateConfig):
		// changes to this field are silently preserved, not rejected.
		oldPublicKeys := th.App.Config().PluginSettings.SignaturePublicKeyFiles

		cfg := th.App.Config().Clone()
		cfg.PluginSettings.SignaturePublicKeyFiles = append(cfg.PluginSettings.SignaturePublicKeyFiles, "new_signature")

		updatedConfig, _, err := th.SystemAdminClient.PatchConfig(context.Background(), cfg)
		require.NoError(t, err)
		assert.Equal(t, oldPublicKeys, updatedConfig.PluginSettings.SignaturePublicKeyFiles)
		assert.Equal(t, oldPublicKeys, th.App.Config().PluginSettings.SignaturePublicKeyFiles)
	})

	t.Run("System Admin should not be able to clear Site URL", func(t *testing.T) {
		cfg, _, err := th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)
		siteURL := cfg.ServiceSettings.SiteURL
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.SiteURL = siteURL })

		// Set the SiteURL
		nonEmptyURL := "http://localhost"
		config := model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: new(nonEmptyURL),
			},
		}
		updatedConfig, _, err := th.SystemAdminClient.PatchConfig(context.Background(), &config)
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *updatedConfig.ServiceSettings.SiteURL)

		// Check that the Site URL can't be cleared
		config = model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL: new(""),
			},
		}
		_, resp, err := th.SystemAdminClient.PatchConfig(context.Background(), &config)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.config.update_config.clear_siteurl.app_error")

		// Check that the Site URL wasn't cleared
		cfg, _, err = th.SystemAdminClient.GetConfig(context.Background())
		require.NoError(t, err)
		require.Equal(t, nonEmptyURL, *cfg.ServiceSettings.SiteURL)

		// Check that sending an empty config returns no error.
		_, _, err = th.SystemAdminClient.PatchConfig(context.Background(), &model.Config{})
		require.NoError(t, err)
	})

	t.Run("should preserve plugin configs when toggling plugin enable off then on", func(t *testing.T) {
		// Have some plugin settings setup
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Enable = new(true)
			cfg.PluginSettings.Plugins = map[string]map[string]any{
				"com.example.oauth-plugin": {
					"clientid":     "test-client-id",
					"clientsecret": "test-client-secret",
				},
			}
		})

		// First PATCH: disable the plugin subsystem
		disablePatch := &model.Config{}
		disablePatch.PluginSettings.Enable = new(false)
		disabledResponse, _, err := th.SystemAdminClient.PatchConfig(context.Background(), disablePatch)
		require.NoError(t, err)
		// The sanitized response returns an empty Plugins map when plugins are disabled
		assert.Empty(t, disabledResponse.PluginSettings.Plugins)

		// Second PATCH: re-enable plugins using the response from the first PATCH
		disabledResponse.PluginSettings.Enable = new(true)
		_, _, err = th.SystemAdminClient.PatchConfig(context.Background(), &model.Config{
			PluginSettings: disabledResponse.PluginSettings,
		})
		require.NoError(t, err)

		// Plugin configs must survive the round-trip unchanged
		storedCfg := th.App.Config()
		require.Contains(t, storedCfg.PluginSettings.Plugins, "com.example.oauth-plugin")
		assert.Equal(t, "test-client-id", storedCfg.PluginSettings.Plugins["com.example.oauth-plugin"]["clientid"])
	})

	t.Run("local client should preserve plugin configs when toggling plugin enable off then on", func(t *testing.T) {
		// Have some plugin settings setup
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Enable = new(true)
			cfg.PluginSettings.Plugins = map[string]map[string]any{
				"com.example.oauth-plugin": {
					"clientid":     "test-client-id",
					"clientsecret": "test-client-secret",
				},
			}
		})

		// First PATCH: disable the plugin subsystem
		disablePatch := &model.Config{}
		disablePatch.PluginSettings.Enable = new(false)
		disabledResponse, _, err := th.LocalClient.PatchConfig(context.Background(), disablePatch)
		require.NoError(t, err)
		// The sanitized response returns an empty Plugins map when plugins are disabled
		assert.Empty(t, disabledResponse.PluginSettings.Plugins)

		// Second PATCH: re-enable plugins using the response from the first PATCH
		disabledResponse.PluginSettings.Enable = new(true)
		_, _, err = th.LocalClient.PatchConfig(context.Background(), &model.Config{
			PluginSettings: disabledResponse.PluginSettings,
		})
		require.NoError(t, err)

		// Plugin configs must survive the round-trip unchanged
		storedCfg := th.App.Config()
		require.Contains(t, storedCfg.PluginSettings.Plugins, "com.example.oauth-plugin")
		assert.Equal(t, "test-client-id", storedCfg.PluginSettings.Plugins["com.example.oauth-plugin"]["clientid"])
	})

	t.Run("should preserve plugin configs absent from patch due to partial sync", func(t *testing.T) {
		// Start with multiple plugins configured.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Enable = new(true)
			cfg.PluginSettings.Plugins = map[string]map[string]any{
				"com.example.plugin-a": {"token": "token-a"},
				"com.example.plugin-b": {"token": "token-b"},
			}
		})

		// simulate a client receives a partial sanitized config with only plugin-a, and PATCHes it back. Plugin-b should survive.
		patch := &model.Config{}
		patch.PluginSettings.Enable = new(true)
		patch.PluginSettings.Plugins = map[string]map[string]any{
			"com.example.plugin-a": {"token": "token-a-updated"},
		}
		_, _, err := th.SystemAdminClient.PatchConfig(context.Background(), patch)
		require.NoError(t, err)

		// All plugin configs must survive; only the synced plugin was in the patch.
		storedCfg := th.App.Config()
		require.Contains(t, storedCfg.PluginSettings.Plugins, "com.example.plugin-a")
		require.Contains(t, storedCfg.PluginSettings.Plugins, "com.example.plugin-b")
		assert.Equal(t, "token-a-updated", storedCfg.PluginSettings.Plugins["com.example.plugin-a"]["token"])
		assert.Equal(t, "token-b", storedCfg.PluginSettings.Plugins["com.example.plugin-b"]["token"])
	})

	t.Run("should preserve plugin configs absent from patch due to partial sync while using local client", func(t *testing.T) {
		// Start with multiple plugins configured.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.Enable = new(true)
			cfg.PluginSettings.Plugins = map[string]map[string]any{
				"com.example.plugin-a": {"token": "token-a"},
				"com.example.plugin-b": {"token": "token-b"},
			}
		})

		// Simulate a client receives a partial sanitized config with only plugin-a, and PATCHes it back. Plugin-b should survive.
		patch := &model.Config{}
		patch.PluginSettings.Enable = new(true)
		patch.PluginSettings.Plugins = map[string]map[string]any{
			"com.example.plugin-a": {"token": "token-a-updated"},
		}
		_, _, err := th.LocalClient.PatchConfig(context.Background(), patch)
		require.NoError(t, err)

		// All plugin configs must survive; only the synced plugin was in the patch.
		storedCfg := th.App.Config()
		require.Contains(t, storedCfg.PluginSettings.Plugins, "com.example.plugin-a")
		require.Contains(t, storedCfg.PluginSettings.Plugins, "com.example.plugin-b")
		assert.Equal(t, "token-a-updated", storedCfg.PluginSettings.Plugins["com.example.plugin-a"]["token"])
		assert.Equal(t, "token-b", storedCfg.PluginSettings.Plugins["com.example.plugin-b"]["token"])
	})
}

func TestMigrateConfig(t *testing.T) {
	th := Setup(t).InitBasic(t)

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
		defer func() {
			err = f.RemoveFile("from.json")
			require.NoError(t, err)
		}()

		_, err = config.NewStoreFromDSN("to.json", false, nil, true)
		require.NoError(t, err)
		defer func() {
			err = f.RemoveFile("to.json")
			require.NoError(t, err)
		}()

		_, err = th.LocalClient.MigrateConfig(context.Background(), "from.json", "to.json")
		require.NoError(t, err)
	})
}

// setupConfigHistory saves two configurations that change a plain setting, a sensitive
// setting, a setting basic users can be allowed to read, and a cloud restricted setting.
func setupConfigHistory(t *testing.T) *TestHelper {
	th := SetupWithDatabaseConfigStore(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.SiteName = "Old Site"
		*cfg.EmailSettings.SMTPPassword = "old-password"
		cfg.RateLimitSettings.VaryByHeader = "X-Old"
		*cfg.ServiceSettings.TLSStrictTransport = false
	})
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.SiteName = "New Site"
		*cfg.EmailSettings.SMTPPassword = "new-password"
		cfg.RateLimitSettings.VaryByHeader = "X-New"
		*cfg.ServiceSettings.TLSStrictTransport = true
	})

	return th
}

func findConfigChange(changes []*model.ConfigChange, path string) *model.ConfigChange {
	for _, change := range changes {
		if change.Path == path {
			return change
		}
	}
	return nil
}

func TestGetConfigHistory(t *testing.T) {
	th := setupConfigHistory(t)

	t.Run("requires a system console read permission", func(t *testing.T) {
		_, resp, err := th.Client.GetConfigHistory(context.Background(), 0, 2)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		entries, _, err := client.GetConfigHistory(context.Background(), 0, 2)
		require.NoError(t, err)
		require.Len(t, entries, 2)
		assert.True(t, entries[0].Active)
		assert.False(t, entries[1].Active)

		siteName := findConfigChange(entries[0].Changes, "TeamSettings.SiteName")
		require.NotNil(t, siteName)
		assert.Equal(t, "Old Site", siteName.OldValue)
		assert.Equal(t, "New Site", siteName.NewValue)

		smtpPassword := findConfigChange(entries[0].Changes, "EmailSettings.SMTPPassword")
		require.NotNil(t, smtpPassword, "a changed sensitive setting should be listed")
		assert.Equal(t, model.FakeSetting, smtpPassword.OldValue)
		assert.Equal(t, model.FakeSetting, smtpPassword.NewValue)
	}, "lists the changes with sensitive values masked")

	t.Run("pages through the history", func(t *testing.T) {
		entries, _, err := th.SystemAdminClient.GetConfigHistory(context.Background(), 0, 2)
		require.NoError(t, err)
		require.Len(t, entries, 2)

		page, _, err := th.SystemAdminClient.GetConfigHistory(context.Background(), 1, 1)
		require.NoError(t, err)
		require.Len(t, page, 1)
		assert.Equal(t, entries[1], page[0], "the oldest entry on a page should still list its changes")
	})

	t.Run("lists a configuration that can't be loaded", func(t *testing.T) {
		entries, _, err := th.SystemAdminClient.GetConfigHistory(context.Background(), 0, 2)
		require.NoError(t, err)
		require.Len(t, entries, 2)

		// Saved between the two newest configurations.
		id := model.NewId()
		db := th.Server.Store().GetInternalMasterDB()
		_, err = db.Exec("INSERT INTO Configurations (Id, Value, CreateAt) VALUES ($1, $2, $3)", id, `{"ServiceSettings": {"SiteURL": 5}}`, entries[1].CreateAt+1)
		require.NoError(t, err)
		defer func() {
			_, deleteErr := db.Exec("DELETE FROM Configurations WHERE Id = $1", id)
			require.NoError(t, deleteErr)
		}()

		page, _, err := th.SystemAdminClient.GetConfigHistory(context.Background(), 0, 1)
		require.NoError(t, err)
		require.Len(t, page, 1)
		assert.Equal(t, entries[0].Id, page[0].Id)
		assert.Nil(t, page[0].Changes, "the changes from a configuration that can't be loaded aren't known")

		page, _, err = th.SystemAdminClient.GetConfigHistory(context.Background(), 1, 1)
		require.NoError(t, err)
		require.Len(t, page, 1)
		assert.Equal(t, id, page[0].Id)
		assert.True(t, page[0].Unreadable)
		assert.Nil(t, page[0].Changes)

		page, _, err = th.SystemAdminClient.GetConfigHistory(context.Background(), 2, 1)
		require.NoError(t, err)
		require.Len(t, page, 1)
		assert.Equal(t, entries[1], page[0])

		_, resp, err := th.SystemAdminClient.GetHistoricalConfig(context.Background(), id)
		require.Error(t, err)
		CheckInternalErrorStatus(t, resp)
	})

	t.Run("lists only the settings the user may read", func(t *testing.T) {
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)

		entries, _, err := th.Client.GetConfigHistory(context.Background(), 0, 1)
		require.NoError(t, err)
		require.Len(t, entries, 1)

		varyByHeader := findConfigChange(entries[0].Changes, "RateLimitSettings.VaryByHeader")
		require.NotNil(t, varyByHeader)
		assert.Equal(t, "X-Old", varyByHeader.OldValue)
		assert.Equal(t, "X-New", varyByHeader.NewValue)
		assert.Nil(t, findConfigChange(entries[0].Changes, "TeamSettings.SiteName"))
	})

	t.Run("hides cloud restricted settings in cloud", func(t *testing.T) {
		entries, _, err := th.SystemAdminClient.GetConfigHistory(context.Background(), 0, 1)
		require.NoError(t, err)
		require.Len(t, entries, 1)
		require.NotNil(t, findConfigChange(entries[0].Changes, "ServiceSettings.TLSStrictTransport"))

		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		defer func() {
			appErr := th.App.Srv().RemoveLicense()
			require.Nil(t, appErr)
		}()

		entries, _, err = th.SystemAdminClient.GetConfigHistory(context.Background(), 0, 1)
		require.NoError(t, err)
		require.Len(t, entries, 1)
		assert.Nil(t, findConfigChange(entries[0].Changes, "ServiceSettings.TLSStrictTransport"))
		assert.NotNil(t, findConfigChange(entries[0].Changes, "TeamSettings.SiteName"))
	})
}

func TestGetHistoricalConfig(t *testing.T) {
	th := setupConfigHistory(t)

	history, appErr := th.App.GetConfigHistory(0, 2)
	require.Nil(t, appErr)
	require.Len(t, history, 2)
	oldConfigID := history[1].Id

	t.Run("requires a system console read permission", func(t *testing.T) {
		_, resp, err := th.Client.GetHistoricalConfig(context.Background(), oldConfigID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("sanitizes the configuration for a system admin", func(t *testing.T) {
		cfg, _, err := th.SystemAdminClient.GetHistoricalConfig(context.Background(), oldConfigID)
		require.NoError(t, err)
		assert.Equal(t, "Old Site", *cfg.TeamSettings.SiteName)
		assert.Equal(t, model.FakeSetting, *cfg.EmailSettings.SMTPPassword)
		assert.Equal(t, model.FakeSetting, *cfg.SqlSettings.DataSource)
	})

	t.Run("returns the configuration unsanitized in local mode", func(t *testing.T) {
		cfg, _, err := th.LocalClient.GetHistoricalConfig(context.Background(), oldConfigID)
		require.NoError(t, err)
		assert.Equal(t, "Old Site", *cfg.TeamSettings.SiteName)
		assert.Equal(t, "old-password", *cfg.EmailSettings.SMTPPassword)
	})

	t.Run("returns only the settings the user may read", func(t *testing.T) {
		th.AddPermissionToRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionSysconsoleReadEnvironmentRateLimiting.Id, model.SystemUserRoleId)

		cfg, _, err := th.Client.GetHistoricalConfig(context.Background(), oldConfigID)
		require.NoError(t, err)
		assert.Equal(t, "X-Old", cfg.RateLimitSettings.VaryByHeader)
		assert.Nil(t, cfg.TeamSettings.SiteName)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetHistoricalConfig(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		CheckErrorID(t, err, "app.config.history.not_found.app_error")

		_, resp, err = client.GetHistoricalConfig(context.Background(), "notanid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	}, "unknown or invalid id")
}

func TestConfigHistoryNotSupported(t *testing.T) {
	th := Setup(t)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.GetConfigHistory(context.Background(), 0, 10)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "app.config.history.not_supported.app_error")

		_, resp, err = client.GetHistoricalConfig(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		CheckErrorID(t, err, "app.config.history.not_supported.app_error")
	}, "memory store")
}
