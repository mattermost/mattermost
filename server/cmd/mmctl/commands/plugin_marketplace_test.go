// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func createMarketplacePlugin(name string) *model.MarketplacePlugin {
	return &model.MarketplacePlugin{
		BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
			Manifest: &model.Manifest{Name: name},
		},
	}
}

func (s *MmctlUnitTestSuite) TestPluginMarketplaceInstallCmd() {
	s.Run("Install a valid plugin", func() {
		printer.Clean()

		id := "myplugin"
		args := []string{id}
		pluginRequest := &model.InstallMarketplacePluginRequest{Id: id}
		manifest := &model.Manifest{Name: "My Plugin", Id: id}

		s.client.
			EXPECT().
			InstallMarketplacePlugin(context.Background(), pluginRequest).
			Return(manifest, &model.Response{}, nil).
			Times(1)

		err := pluginMarketplaceInstallCmdF(s.client, &cobra.Command{}, args)
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(manifest, printer.GetLines()[0])
	})

	s.Run("Install an invalid plugin", func() {
		printer.Clean()

		id := "myplugin"
		args := []string{id}
		pluginRequest := &model.InstallMarketplacePluginRequest{Id: id}

		s.client.
			EXPECT().
			InstallMarketplacePlugin(context.Background(), pluginRequest).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := pluginMarketplaceInstallCmdF(s.client, &cobra.Command{}, args)
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestPluginMarketplaceListCmd() {
	s.Run("List honoring pagination flags", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 1, "")
		pluginFilter := &model.MarketplacePluginFilter{Page: 0, PerPage: 1}
		mockPlugin := createMarketplacePlugin("My Plugin")
		plugins := []*model.MarketplacePlugin{mockPlugin}

		s.client.
			EXPECT().
			GetMarketplacePlugins(context.Background(), pluginFilter).
			Return(plugins, &model.Response{}, nil).
			Times(1)

		err := pluginMarketplaceListCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(mockPlugin, printer.GetLines()[0])
	})

	s.Run("List all plugins", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("per-page", 1, "")
		cmd.Flags().Bool("all", true, "")
		mockPlugin1 := createMarketplacePlugin("My Plugin One")
		mockPlugin2 := createMarketplacePlugin("My Plugin Two")

		s.client.
			EXPECT().
			GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Page: 0, PerPage: 1}).
			Return([]*model.MarketplacePlugin{mockPlugin1}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Page: 1, PerPage: 1}).
			Return([]*model.MarketplacePlugin{mockPlugin2}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Page: 2, PerPage: 1}).
			Return([]*model.MarketplacePlugin{}, &model.Response{}, nil).
			Times(1)

		err := pluginMarketplaceListCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(mockPlugin1, printer.GetLines()[0])
		s.Require().Equal(mockPlugin2, printer.GetLines()[1])
	})

	s.Run("List all plugins with errors", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("per-page", 200, "")

		s.client.
			EXPECT().
			GetMarketplacePlugins(context.Background(), &model.MarketplacePluginFilter{Page: 0, PerPage: 200}).
			Return(nil, &model.Response{}, errors.New("mock error")).
			Times(1)

		err := pluginMarketplaceListCmdF(s.client, cmd, []string{})
		s.Require().Error(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("List honoring filter and local only flags", func() {
		printer.Clean()

		filter := "jit"
		cmd := &cobra.Command{}
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().String("filter", filter, "")
		cmd.Flags().Bool("local-only", true, "")
		pluginFilter := &model.MarketplacePluginFilter{Page: 0, PerPage: 200, Filter: filter, LocalOnly: true}
		mockPlugin := createMarketplacePlugin("Jitsi")
		plugins := []*model.MarketplacePlugin{mockPlugin}

		s.client.
			EXPECT().
			GetMarketplacePlugins(context.Background(), pluginFilter).
			Return(plugins, &model.Response{}, nil).
			Times(1)

		err := pluginMarketplaceListCmdF(s.client, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(mockPlugin, printer.GetLines()[0])
	})
}
