// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"io/ioutil"
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

	tmpFile, err := ioutil.TempFile(os.TempDir(), "config_*.json")
	s.Require().Nil(err)

	invalidFile, err := ioutil.TempFile(os.TempDir(), "invalid_config_*.json")
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

	s.RunForSystemAdminAndLocal("Get error if the key doesn't exists", func(c client.Client) {
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

		file, err := ioutil.TempFile(os.TempDir(), "config_edit_*.sh")
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
