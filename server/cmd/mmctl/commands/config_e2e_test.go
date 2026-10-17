// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestConfigResetCmdE2E() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("System admin and local reset", func(c client.Client) {
		printer.Clean()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PrivacySettings.ShowEmailAddress = false })
		resetCmd := &cobra.Command{}
		resetCmd.Flags().Bool("confirm", true, "")
		err := configResetCmdF(c, resetCmd, []string{"PrivacySettings"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		config := s.th.App.Config()
		s.Require().True(*config.PrivacySettings.ShowEmailAddress)
	})

	s.Run("Reset for user without permission", func() {
		printer.Clean()
		resetCmd := &cobra.Command{}
		args := []string{"PrivacySettings"}
		resetCmd.Flags().Bool("confirm", true, "")
		err := configResetCmdF(s.th.Client, resetCmd, args)
		s.Require().NotNil(err)
		s.Assert().Errorf(err, "You do not have the appropriate permissions.")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigPatchCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	tmpFile, err := os.CreateTemp(os.TempDir(), "config_*.json")
	s.Require().Nil(err)

	invalidFile, err := os.CreateTemp(os.TempDir(), "invalid_config_*.json")
	s.Require().Nil(err)

	_, err = tmpFile.WriteString(configFilePayload)
	s.Require().Nil(err)

	defer func() {
		os.Remove(tmpFile.Name())
		os.Remove(invalidFile.Name())
	}()

	s.RunForSystemAdminAndLocal("MM-T4051 - System admin and local patch", func(c client.Client) {
		printer.Clean()

		err := configPatchCmdF(c, &cobra.Command{}, []string{tmpFile.Name()})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T4052 - System admin and local patch with invalid file", func(c client.Client) {
		printer.Clean()

		err := configPatchCmdF(c, &cobra.Command{}, []string{invalidFile.Name()})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("MM-T4053 - Patch config for user without permission", func() {
		printer.Clean()

		err := configPatchCmdF(s.th.Client, &cobra.Command{}, []string{tmpFile.Name()})
		s.Require().NotNil(err)
		s.Assert().Errorf(err, "You do not have the appropriate permissions.")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigGetCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	var driver string
	if d := s.th.App.Config().SqlSettings.DriverName; d != nil {
		driver = *d
	}

	s.RunForSystemAdminAndLocal("Get config value for a given key", func(c client.Client) {
		printer.Clean()

		args := []string{"SqlSettings.DriverName"}
		err := configGetCmdF(c, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(driver, *(printer.GetLines()[0].(*string)))
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("Expect error when using a nonexistent key", func(c client.Client) {
		printer.Clean()

		args := []string{"NonExistent.Key"}
		err := configGetCmdF(c, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get config value for a given key without permissions", func() {
		printer.Clean()

		args := []string{"SqlSettings.DriverName"}
		err := configGetCmdF(s.th.Client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigSetCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("Set config value for a given key", func(c client.Client) {
		printer.Clean()

		args := []string{"SqlSettings.DriverName", "postgres"}
		err := configSetCmdF(c, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		config, ok := printer.GetLines()[0].(*model.Config)
		s.Require().True(ok)
		s.Require().Equal("postgres", *(config.SqlSettings.DriverName))
	})

	s.RunForSystemAdminAndLocal("Set a list config value to multiple values and then to a single value", func(c client.Client) {
		printer.Clean()
		originalChannels := s.th.App.Config().TeamSettings.ExperimentalDefaultChannels
		defer s.th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.ExperimentalDefaultChannels = originalChannels
		})

		args := []string{"TeamSettings.ExperimentalDefaultChannels", "off-topic", "town-square"}
		err := configSetCmdF(c, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal([]string{"off-topic", "town-square"}, s.th.App.Config().TeamSettings.ExperimentalDefaultChannels)

		printer.Clean()
		args = []string{"TeamSettings.ExperimentalDefaultChannels", "town-square"}
		err = configSetCmdF(c, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		config, ok := printer.GetLines()[0].(*model.Config)
		s.Require().True(ok)
		s.Require().Equal([]string{"town-square"}, config.TeamSettings.ExperimentalDefaultChannels)
		s.Require().Equal([]string{"town-square"}, s.th.App.Config().TeamSettings.ExperimentalDefaultChannels)
	})

	s.RunForSystemAdminAndLocal("Get error if the key doesn't exist", func(c client.Client) {
		printer.Clean()

		args := []string{"SqlSettings.WrongKey", "postgres"}
		err := configSetCmdF(c, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set config value for a given key without permissions", func() {
		printer.Clean()

		args := []string{"SqlSettings.DriverName", "postgres"}
		err := configSetCmdF(s.th.Client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("ImportSettings.Directory cannot be set via API but can via local mode", func() {
		printer.Clean()
		originalDir := *s.th.App.Config().ImportSettings.Directory

		args := []string{"ImportSettings.Directory", "./api-blocked-import"}
		err := configSetCmdF(s.th.SystemAdminClient, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "not allowed due to security reasons")
		s.Require().Len(printer.GetLines(), 0)

		// Verify value didn't change
		s.Require().Equal(originalDir, *s.th.App.Config().ImportSettings.Directory)

		printer.Clean()
		args = []string{"ImportSettings.Directory", "./local-allowed-import"}
		err = configSetCmdF(s.th.LocalClient, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		config, ok := printer.GetLines()[0].(*model.Config)
		s.Require().True(ok)
		s.Require().Equal("./local-allowed-import", *config.ImportSettings.Directory)

		// Reset to original
		s.th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ImportSettings.Directory = &originalDir
		})
	})
}

func (s *MmctlE2ETestSuite) TestConfigEditCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("Edit a key in config", func(c client.Client) {
		printer.Clean()

		// ensure the value before editing
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableSVGs = false })

		// create a shell script to edit config
		content := `#!/bin/bash
sed -i'old' 's/\"EnableSVGs\": false/\"EnableSVGs\": true/' $1
rm $1'old'`

		file, err := os.CreateTemp(os.TempDir(), "config_edit_*.sh")
		s.Require().Nil(err)
		defer func() {
			os.Remove(file.Name())
		}()
		_, err = file.WriteString(content)
		s.Require().Nil(err)
		s.Require().Nil(file.Close())
		s.Require().Nil(os.Chmod(file.Name(), 0700))

		s.T().Setenv("EDITOR", file.Name())

		// check the value after editing
		err = configEditCmdF(c, nil, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		config := s.th.App.Config()
		s.Require().True(*config.ServiceSettings.EnableSVGs)
	})

	s.Run("Edit config value without permissions", func() {
		printer.Clean()

		err := configEditCmdF(s.th.Client, nil, nil)
		s.Require().NotNil(err)
		s.Require().Error(err, "You do not have the appropriate permissions.")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigShowCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("Show server configs", func(c client.Client) {
		printer.Clean()

		err := configShowCmdF(c, nil, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Show server configs without permissions", func() {
		printer.Clean()

		err := configShowCmdF(s.th.Client, nil, nil)
		s.Require().NotNil(err)
		s.Require().Error(err, "You do not have the appropriate permissions")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigReloadCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("Reload server config", func(c client.Client) {
		printer.Clean()

		err := configReloadCmdF(c, nil, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Reload server config without permissions", func() {
		printer.Clean()

		err := configReloadCmdF(s.th.Client, nil, nil)
		s.Require().NotNil(err)
		s.Require().Error(err, "You do not have the appropriate permissions")
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigExportCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	s.RunForSystemAdminAndLocal("Get config normally", func(c client.Client) {
		printer.Clean()

		err := configExportCmdF(c, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		m, ok := printer.GetLines()[0].(map[string]any)
		s.Require().True(ok)
		if c == s.th.LocalClient {
			// filter config is used to convert the config to a map[string]any
			// local client has unrestricted access to the config
			expectedConfig, err2 := model.FilterConfig(s.th.App.Config(), model.ConfigFilterOptions{GetConfigOptions: model.GetConfigOptions{}})
			s.Require().NoError(err2)
			s.Require().Equal(expectedConfig, m)
		} else {
			// filter config is used to convert the config to a map[string]any
			// system admin client has restricted access to the config
			expectedConfig, err2 := model.FilterConfig(s.th.App.GetSanitizedConfig(), model.ConfigFilterOptions{GetConfigOptions: model.GetConfigOptions{}})
			s.Require().NoError(err2)
			s.Require().Equal(expectedConfig, m)
		}
	})

	s.Run("Should remove masked values for system admin client", func() {
		printer.Clean()

		exportCmd := &cobra.Command{}
		exportCmd.Flags().Bool("remove-masked", true, "")
		err := configExportCmdF(s.th.SystemAdminClient, exportCmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		m, ok := printer.GetLines()[0].(map[string]any)
		s.Require().True(ok)
		ss, ok := m["SqlSettings"].(map[string]any)
		s.Require().True(ok)
		_, ok = ss["DataSource"]
		s.Require().False(ok)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should retrieve configuration as-is with local client", func() {
		printer.Clean()

		exportCmd := &cobra.Command{}
		err := configExportCmdF(s.th.LocalClient, exportCmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		m, ok := printer.GetLines()[0].(map[string]any)
		s.Require().True(ok)
		ss, ok := m["SqlSettings"].(map[string]any)
		s.Require().True(ok)
		ds, ok := ss["DataSource"]
		s.Require().True(ok)
		cfg := s.th.App.Config()
		s.Require().Equal(*cfg.SqlSettings.DataSource, ds)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("Should remove default values", func(c client.Client) {
		printer.Clean()

		exportCmd := &cobra.Command{}
		exportCmd.Flags().Bool("remove-defaults", true, "")
		err := configExportCmdF(c, exportCmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		m, ok := printer.GetLines()[0].(map[string]any)
		s.Require().True(ok)
		ss, ok := m["TeamSettings"].(map[string]any)
		s.Require().True(ok)
		_, ok = ss["MaxUsersPerTeam"] // it's not being changed by the test suite
		s.Require().False(ok)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Get config value for a given key without permissions", func() {
		printer.Clean()

		err := configExportCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigMigrateCmdF() {
	s.SetupTestHelper().InitBasic(s.T())

	s.Run("Should fail without the --local flag", func() {
		printer.Clean()
		args := []string{"config.json", "output.json"}

		err := configMigrateCmdF(s.th.Client, &cobra.Command{}, args)
		s.Require().Error(err)
		s.Require().Equal("this command is only available in local mode. Please set the --local flag", err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should be able to migrate config to file", func() {
		printer.Clean()
		args := []string{"config.json", "output.json"}

		cmd := &cobra.Command{}
		cmd.Flags().Bool("local", true, "")

		err := configMigrateCmdF(s.th.LocalClient, cmd, args)
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should be able to migrate config to database", func() {
		printer.Clean()

		// Get the current database DSN from the test configuration
		currentDSN := *s.th.App.Config().SqlSettings.DataSource
		args := []string{"config.json", currentDSN}

		cmd := &cobra.Command{}
		cmd.Flags().Bool("local", true, "")

		err := configMigrateCmdF(s.th.LocalClient, cmd, args)
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Should fail on error when migrating config", func() {
		printer.Clean()
		args := []string{"from", "to"}

		cmd := &cobra.Command{}
		cmd.Flags().Bool("local", true, "")

		err := configMigrateCmdF(s.th.LocalClient, cmd, args)
		s.Require().Error(err)
		s.Require().Equal("Failed to migrate config store.", err.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func newConfigHistoryCmd(perPage int, detailed bool) *cobra.Command {
	cmd := &cobra.Command{}
	cmd.Flags().Int("page", 0, "")
	cmd.Flags().Int("per-page", perPage, "")
	cmd.Flags().Bool("detailed", detailed, "")
	return cmd
}

// latestConfigID returns the id of the active saved configuration.
func (s *MmctlE2ETestSuite) latestConfigID() string {
	entries, appErr := s.th.App.GetConfigHistory(0, 1)
	s.Require().Nil(appErr)
	s.Require().Len(entries, 1)
	return entries[0].Id
}

func (s *MmctlE2ETestSuite) TestConfigHistoryCmd() {
	s.SetupTestHelperWithDatabaseConfigStore()
	s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "Old Site" })
	s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "New Site" })

	s.RunForSystemAdminAndLocal("List the saved configurations", func(c client.Client) {
		printer.Clean()

		err := configHistoryCmdF(c, newConfigHistoryCmd(2, false), nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Empty(printer.GetErrorLines())

		entry := printer.GetLines()[0].(*model.ConfigHistoryEntry)
		s.Require().True(entry.Active)
		s.Require().Contains(entry.Changes, &model.ConfigChange{Path: "TeamSettings.SiteName", OldValue: "Old Site", NewValue: "New Site"})
	})

	s.Run("Show the old and new values", func() {
		printer.Clean()
		printer.SetFormat(printer.FormatPlain)
		defer printer.SetFormat(printer.FormatJSON)

		err := configHistoryCmdF(s.th.SystemAdminClient, newConfigHistoryCmd(1, true), nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Contains(printer.GetLines()[0], "(active)")
		s.Require().Contains(printer.GetLines()[0], `TeamSettings.SiteName: "Old Site" -> "New Site"`)
	})

	s.Run("List the saved configurations without permission", func() {
		printer.Clean()

		err := configHistoryCmdF(s.th.Client, newConfigHistoryCmd(2, false), nil)
		s.Require().Error(err)
		s.Require().Empty(printer.GetLines())
	})
}

func (s *MmctlE2ETestSuite) TestConfigHistoryCmdWithoutDatabaseStore() {
	s.SetupTestHelper()

	s.RunForSystemAdminAndLocal("List the saved configurations of a memory store", func(c client.Client) {
		printer.Clean()

		err := configHistoryCmdF(c, newConfigHistoryCmd(2, false), nil)
		s.Require().ErrorContains(err, "Configuration history is only available when the configuration is stored in the database.")
		s.Require().Empty(printer.GetLines())
	})
}

func (s *MmctlE2ETestSuite) TestConfigRollbackCmd() {
	s.SetupTestHelperWithDatabaseConfigStore()

	s.RunForSystemAdminAndLocal("Roll back to a saved configuration", func(c client.Client) {
		printer.Clean()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "Old Site" })
		oldConfigID := s.latestConfigID()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "New Site" })

		err := configRollbackCmdF(c, &cobra.Command{}, []string{oldConfigID})
		s.Require().NoError(err)
		s.Require().Equal("Old Site", *s.th.App.Config().TeamSettings.SiteName)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(&configRollbackResult{
			ConfigId: oldConfigID,
			Changes:  []*model.ConfigChange{{Path: "TeamSettings.SiteName", OldValue: "New Site", NewValue: "Old Site"}},
		}, printer.GetLines()[0])
	})

	s.Run("Keep sensitive values without local mode", func() {
		printer.Clean()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.SMTPPassword = "old-password" })
		oldConfigID := s.latestConfigID()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.SMTPPassword = "new-password" })

		err := configRollbackCmdF(s.th.SystemAdminClient, &cobra.Command{}, []string{oldConfigID})
		s.Require().NoError(err)
		s.Require().Equal("new-password", *s.th.App.Config().EmailSettings.SMTPPassword)
		s.Require().Equal(&configRollbackResult{ConfigId: oldConfigID, Changes: []*model.ConfigChange{}}, printer.GetLines()[0])
	})

	s.Run("Restore sensitive values in local mode", func() {
		printer.Clean()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.SMTPPassword = "old-password" })
		oldConfigID := s.latestConfigID()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.EmailSettings.SMTPPassword = "new-password" })

		err := configRollbackCmdF(s.th.LocalClient, &cobra.Command{}, []string{oldConfigID})
		s.Require().NoError(err)
		s.Require().Equal("old-password", *s.th.App.Config().EmailSettings.SMTPPassword)
		s.Require().Equal(&configRollbackResult{
			ConfigId: oldConfigID,
			Changes:  []*model.ConfigChange{{Path: "EmailSettings.SMTPPassword", OldValue: model.FakeSetting, NewValue: model.FakeSetting}},
		}, printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("Roll back to an unknown configuration", func(c client.Client) {
		printer.Clean()

		err := configRollbackCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().ErrorContains(err, "No saved configuration has this ID.")
		s.Require().Empty(printer.GetLines())
	})

	s.Run("Roll back without permission", func() {
		printer.Clean()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "Old Site" })
		oldConfigID := s.latestConfigID()
		s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.SiteName = "New Site" })

		err := configRollbackCmdF(s.th.Client, &cobra.Command{}, []string{oldConfigID})
		s.Require().Error(err)
		s.Require().Equal("New Site", *s.th.App.Config().TeamSettings.SiteName)
		s.Require().Empty(printer.GetLines())
	})
}
