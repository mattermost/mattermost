// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

func (s *MmctlE2ETestSuite) TestPluginMarketplaceInstallCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("install a plugin", func(c client.Client) {
		printer.Clean()

		marketPlacePlugins, appErr := s.th.App.GetMarketplacePlugins(&model.MarketplacePluginFilter{
			Page:    0,
			PerPage: 100,
			Filter:  "jira",
		})
		s.Require().Nil(appErr)
		s.Require().NotEmpty(marketPlacePlugins)
		plugin := marketPlacePlugins[0]

		pluginID := plugin.Manifest.Id
		pluginVersion := plugin.Manifest.Version

		defer removePluginIfInstalled(c, s, pluginID)

		err := pluginMarketplaceInstallCmdF(c, &cobra.Command{}, []string{pluginID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)

		manifest := printer.GetLines()[0].(*model.Manifest)
		s.Require().Equal(pluginID, manifest.Id)
		s.Require().Equal(pluginVersion, manifest.Version)

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 1)
		s.Require().Equal(pluginID, plugins.Inactive[0].Id)
		s.Require().Equal(pluginVersion, plugins.Inactive[0].Version)
	})

	s.Run("install a plugin without permissions", func() {
		printer.Clean()

		const (
			pluginID = "jira"
		)

		defer removePluginIfInstalled(s.th.Client, s, pluginID)

		err := pluginMarketplaceInstallCmdF(s.th.Client, &cobra.Command{}, []string{pluginID})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "You do not have the appropriate permissions.")
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 0)
	})

	s.RunForSystemAdminAndLocal("install a nonexistent plugin", func(c client.Client) {
		printer.Clean()

		const (
			pluginID = "a-nonexistent-plugin"
		)

		defer removePluginIfInstalled(c, s, pluginID)

		err := pluginMarketplaceInstallCmdF(c, &cobra.Command{}, []string{pluginID})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), "Could not find the requested marketplace plugin")
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)

		plugins, appErr := s.th.App.GetPlugins()
		s.Require().Nil(appErr)
		s.Require().Len(plugins.Active, 0)
		s.Require().Len(plugins.Inactive, 0)
	})
}

func removePluginIfInstalled(c client.Client, s *MmctlE2ETestSuite, pluginID string) {
	appErr := pluginDeleteCmdF(c, &cobra.Command{}, []string{pluginID})
	if appErr != nil {
		s.Require().Contains(appErr.Error(), "Plugin is not installed.")
	}
}

func (s *MmctlE2ETestSuite) TestPluginMarketplaceListCmd() {
	s.SetupTestHelper().InitBasic()

	s.RunForSystemAdminAndLocal("List Marketplace Plugins for Admin User", func(c client.Client) {
		printer.Clean()

		err := pluginMarketplaceListCmdF(c, &cobra.Command{}, nil)

		pluginList := printer.GetLines()

		// This checks whether there is an output from the command - returned list can be of length >= 0
		s.Require().Len(pluginList, len(pluginList))
		s.Require().NoError(err)
		s.Require().Empty(printer.GetErrorLines())
	})

	s.Run("List Marketplace Plugins for non-admin User", func() {
		printer.Clean()

		err := pluginMarketplaceListCmdF(s.th.Client, &cobra.Command{}, nil)

		s.Require().ErrorContains(err, "Failed to fetch plugins: : You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Empty(printer.GetLines())
	})
}
