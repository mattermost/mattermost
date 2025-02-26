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
	s.SetupTestHelper().InitBasic()

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
	s.SetupTestHelper().InitBasic()

	tmpFile, err := os.CreateTemp(os.TempDir(), "config_*.json")
	s.Require().Nil(err)

	invalidFile, err := os.CreateTemp(os.TempDir(), "invalid_config_*.json")
	s.Require().Nil(err)

	_, err = tmpFile.Write([]byte(configFilePayload))
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
	s.SetupTestHelper().InitBasic()

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
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("Set config value for a given key", func(c client.Client) {
		printer.Clean()

		args := []string{"SqlSettings.DriverName", "mysql"}
		err := configSetCmdF(c, &cobra.Command{}, args)
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		config, ok := printer.GetLines()[0].(*model.Config)
		s.Require().True(ok)
		s.Require().Equal("mysql", *(config.SqlSettings.DriverName))
	})

	s.RunForSystemAdminAndLocal("Get error if the key doesn't exist", func(c client.Client) {
		printer.Clean()

		args := []string{"SqlSettings.WrongKey", "mysql"}
		err := configSetCmdF(c, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Set config value for a given key without permissions", func() {
		printer.Clean()

		args := []string{"SqlSettings.DriverName", "mysql"}
		err := configSetCmdF(s.th.Client, &cobra.Command{}, args)
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestConfigEditCmd() {
	s.SetupTestHelper().InitBasic()

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
		_, err = file.Write([]byte(content))
		s.Require().Nil(err)
		s.Require().Nil(file.Close())
		s.Require().Nil(os.Chmod(file.Name(), 0700))

		os.Setenv("EDITOR", file.Name())

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
	s.SetupTestHelper().InitBasic()

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

func (s *MmctlE2ETestSuite) TestConfigExportCmdF() {
	s.SetupTestHelper().InitBasic()

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
