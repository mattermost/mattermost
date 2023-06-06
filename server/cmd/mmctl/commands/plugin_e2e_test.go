// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"
	"os"

	"github.com/hashicorp/go-multierror"
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"

	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestPluginAddCmd() {
	s.SetupTestHelper().InitBasic()

	pluginPath := filepath.Join(os.Getenv("MM_SERVER_PATH"), "tests", "testplugin.tar.gz")

	s.RunForSystemAdminAndLocal("add an already installed plugin without force", func(c client.Client) {
		printer.Clean()

		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
		})

		defer s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
			*cfg.PluginSettings.EnableUploads = false
		})

		err := pluginAddCmdF(c, &cobra.Command{}, []string{pluginPath})
		s.Require().Nil(err)

		s.Require().Equal(1, len(printer.GetLines()))
		s.Require().Contains(printer.GetLines()[0], "Added plugin: ")

		printer.Clean()

		err = pluginAddCmdF(c, &cobra.Command{}, []string{pluginPath})
		s.Require().Nil(err)

		s.Require().Equal(0, len(printer.GetLines()))
		s.Require().Equal(1, len(printer.GetErrorLines()))
		s.Require().Contains(printer.GetErrorLines()[0], "Unable to install plugin. A plugin with the same ID is already installed.")

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 1)

		// teardown
		pInfo := plugins.Inactive[0]
		err = pluginDeleteCmdF(c, &cobra.Command{}, []string{pInfo.Id})
		s.Require().Nil(err)
	})

	s.RunForSystemAdminAndLocal("add an already installed plugin with force", func(c client.Client) {
		printer.Clean()

		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
		})

		defer s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
			*cfg.PluginSettings.EnableUploads = false
		})

		err := pluginAddCmdF(c, &cobra.Command{}, []string{pluginPath})
		s.Require().Nil(err)

		s.Require().Equal(1, len(printer.GetLines()))
		s.Require().Contains(printer.GetLines()[0], "Added plugin: ")

		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Bool("force", true, "")
		err = pluginAddCmdF(c, cmd, []string{pluginPath})
		s.Require().Nil(err)

		s.Require().Equal(1, len(printer.GetLines()))
		s.Require().Equal(0, len(printer.GetErrorLines()))
		s.Require().Contains(printer.GetLines()[0], "Added plugin: ")

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 1)

		// teardown
		pInfo := plugins.Inactive[0]
		err = pluginDeleteCmdF(c, &cobra.Command{}, []string{pInfo.Id})
		s.Require().Nil(err)
	})

	s.RunForSystemAdminAndLocal("admin and local can't add plugins if the config doesn't allow it", func(c client.Client) {
		printer.Clean()

		err := pluginAddCmdF(c, &cobra.Command{}, []string{pluginPath})
		s.Require().Nil(err)
		s.Require().Equal(1, len(printer.GetErrorLines()))
		s.Require().Contains(printer.GetErrorLines()[0], "Plugins and/or plugin uploads have been disabled.")
	})

	s.RunForSystemAdminAndLocal("admin and local can add a plugin if the config allows it", func(c client.Client) {
		printer.Clean()

		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
		})

		defer s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
			*cfg.PluginSettings.EnableUploads = false
		})

		err := pluginAddCmdF(c, &cobra.Command{}, []string{pluginPath})
		s.Require().Nil(err)

		s.Require().Equal(1, len(printer.GetLines()))
		s.Require().Contains(printer.GetLines()[0], "Added plugin: ")

		res, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Equal(1, len(res.Inactive))

		// teardown
		pInfo := res.Inactive[0]
		err = pluginDeleteCmdF(c, &cobra.Command{}, []string{pInfo.Id})
		s.Require().Nil(err)
	})

	s.Run("normal user can't add plugin", func() {
		printer.Clean()

		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
		})

		defer s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
			*cfg.PluginSettings.EnableUploads = false
		})

		err := pluginAddCmdF(s.th.Client, &cobra.Command{}, []string{pluginPath})
		s.Require().Nil(err)
		s.Require().Equal(1, len(printer.GetErrorLines()))
		s.Require().Contains(printer.GetErrorLines()[0], "You do not have the appropriate permissions")
	})
}

func (s *MmctlE2ETestSuite) TestPluginInstallURLCmd() {
	s.SetupTestHelper().InitBasic()
	s.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
	})

	const (
		jiraURL        = "https://plugins-store.test.mattermost.com/release/mattermost-plugin-jira-v3.0.0.tar.gz"
		jiraPluginID   = "jira"
		githubURL      = "https://plugins-store.test.mattermost.com/release/mattermost-plugin-github-v2.0.0.tar.gz"
		githubPluginID = "github"
	)

	s.RunForSystemAdminAndLocal("install new plugins", func(c client.Client) {
		printer.Clean()
		defer removePluginIfInstalled(c, s, jiraPluginID)
		defer removePluginIfInstalled(c, s, githubPluginID)

		err := pluginInstallURLCmdF(c, &cobra.Command{}, []string{jiraURL, githubURL})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(jiraPluginID, printer.GetLines()[0].(*model.Manifest).Id)
		s.Require().Equal(githubPluginID, printer.GetLines()[1].(*model.Manifest).Id)

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 2)
	})

	s.Run("install a plugin without permissions", func() {
		printer.Clean()
		defer removePluginIfInstalled(s.th.Client, s, jiraPluginID)

		var expected error
		expected = multierror.Append(expected, errors.New(": You do not have the appropriate permissions.")) //nolint:revive
		err := pluginInstallURLCmdF(s.th.Client, &cobra.Command{}, []string{jiraURL})
		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("Unable to install plugin from URL \"%s\".", jiraURL))
		s.Require().Contains(printer.GetErrorLines()[0], "You do not have the appropriate permissions.")

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 0)
	})

	s.RunForSystemAdminAndLocal("install a nonexistent plugin", func(c client.Client) {
		printer.Clean()

		const pluginURL = "https://plugins-store.test.mattermost.com/release/mattermost-nonexistent-plugin-v2.0.0.tar.gz"
		var expected error
		expected = multierror.Append(expected, errors.New(": An error occurred while downloading the plugin.")) //nolint:revive

		err := pluginInstallURLCmdF(c, &cobra.Command{}, []string{pluginURL})
		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("Unable to install plugin from URL \"%s\".", pluginURL))
		s.Require().Contains(printer.GetErrorLines()[0], "An error occurred while downloading the plugin.")

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 0)
	})

	s.RunForSystemAdminAndLocal("install an already installed plugin without force", func(c client.Client) {
		printer.Clean()
		defer removePluginIfInstalled(c, s, jiraPluginID)

		err := pluginInstallURLCmdF(c, &cobra.Command{}, []string{jiraURL})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(jiraPluginID, printer.GetLines()[0].(*model.Manifest).Id)

		var expected error
		expected = multierror.Append(expected, errors.New(": Unable to install plugin. A plugin with the same ID is already installed.")) //nolint:revive
		err = pluginInstallURLCmdF(c, &cobra.Command{}, []string{jiraURL})
		s.Require().EqualError(err, expected.Error())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("Unable to install plugin from URL \"%s\".", jiraURL))
		s.Require().Contains(printer.GetErrorLines()[0], "Unable to install plugin. A plugin with the same ID is already installed.")

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 1)
	})

	s.RunForSystemAdminAndLocal("install an already installed plugin with force", func(c client.Client) {
		printer.Clean()
		defer removePluginIfInstalled(c, s, jiraPluginID)

		err := pluginInstallURLCmdF(c, &cobra.Command{}, []string{jiraURL})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(jiraPluginID, printer.GetLines()[0].(*model.Manifest).Id)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("force", true, "")
		err = pluginInstallURLCmdF(c, cmd, []string{jiraURL})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(jiraPluginID, printer.GetLines()[1].(*model.Manifest).Id)

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 1)
	})
}

func (s *MmctlE2ETestSuite) TestPluginDeleteCmd() {
	s.SetupTestHelper().InitBasic()

	const (
		jiraURL       = "https://plugins-store.test.mattermost.com/release/mattermost-plugin-jira-v3.0.0.tar.gz"
		jiraPluginID  = "jira"
		dummyPluginID = "randompluginxz" // This will be used to check response when tried to delete this plugin with randomchars which was not installed/enabled already
	)

	s.RunForSystemAdminAndLocal("Delete Plugin", func(c client.Client) {
		printer.Clean()

		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
		})

		defer s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
			*cfg.PluginSettings.EnableUploads = false
		})

		errInstall := pluginInstallURLCmdF(c, &cobra.Command{}, []string{jiraURL})
		s.Require().Nil(errInstall)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(jiraPluginID, printer.GetLines()[0].(*model.Manifest).Id)

		pluginsAvail, appErrInstall := s.th.App.GetPlugins()
		s.Require().Nil(appErrInstall)
		s.Require().Len(pluginsAvail.Active, 0)
		s.Require().Len(pluginsAvail.Inactive, 1)

		err := pluginDeleteCmdF(c, &cobra.Command{}, []string{jiraPluginID})
		s.Require().Nil(err)

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 0)
	})

	s.RunForSystemAdminAndLocal("Delete Unknown Plugin", func(c client.Client) {
		printer.Clean()

		err := pluginDeleteCmdF(c, &cobra.Command{}, []string{dummyPluginID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("Unable to delete plugin: %s.", dummyPluginID))
		s.Require().Contains(printer.GetErrorLines()[0], "Plugins have been disabled.")
	})

	s.Run("Delete a Plugin without permissions", func() {
		printer.Clean()

		s.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = true
			*cfg.PluginSettings.EnableUploads = true
		})

		defer func() {
			errDelete := pluginDeleteCmdF(s.th.SystemAdminClient, &cobra.Command{}, []string{jiraPluginID})
			s.Require().Nil(errDelete)
			s.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = false
				*cfg.PluginSettings.EnableUploads = false
			})
		}()

		// Installs plugin using SystemAdmin Privilege and check whether plugin has been installed properly so that delete plugin test can be done
		errInstall := pluginInstallURLCmdF(s.th.SystemAdminClient, &cobra.Command{}, []string{jiraURL})
		s.Require().Nil(errInstall)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Equal(jiraPluginID, printer.GetLines()[0].(*model.Manifest).Id)

		pluginsAvail, appErrInstall := s.th.App.GetPlugins()
		s.Require().Nil(appErrInstall)
		s.Require().Len(pluginsAvail.Active, 0)
		s.Require().Len(pluginsAvail.Inactive, 1)

		// Delete Test
		err := pluginDeleteCmdF(s.th.Client, &cobra.Command{}, []string{jiraPluginID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], fmt.Sprintf("Unable to delete plugin: %s.", jiraPluginID))
		s.Require().Contains(printer.GetErrorLines()[0], "You do not have the appropriate permissions.")

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 1)
	})
}
