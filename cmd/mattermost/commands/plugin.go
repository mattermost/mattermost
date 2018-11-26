// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"errors"
	"os"

	"github.com/spf13/cobra"
)

var PluginCmd = &cobra.Command{
	Use:   "plugin",
	Short: "Management of plugins",
}

var PluginAddCmd = &cobra.Command{
	Use:     "add [plugins]",
	Short:   "Add plugins",
	Long:    "Add plugins to your Mattermost server.",
	Example: `  plugin add hovercardexample.tar.gz pluginexample.tar.gz`,
	RunE:    pluginAddCmdF,
}

var PluginDeleteCmd = &cobra.Command{
	Use:     "delete [plugins]",
	Short:   "Delete plugins",
	Long:    "Delete previously uploaded plugins from your Mattermost server.",
	Example: `  plugin delete hovercardexample pluginexample`,
	RunE:    pluginDeleteCmdF,
}

var PluginEnableCmd = &cobra.Command{
	Use:     "enable [plugins]",
	Short:   "Enable plugins",
	Long:    "Enable plugins for use on your Mattermost server.",
	Example: `  plugin enable hovercardexample pluginexample`,
	RunE:    pluginEnableCmdF,
}

var PluginDisableCmd = &cobra.Command{
	Use:     "disable [plugins]",
	Short:   "Disable plugins",
	Long:    "Disable plugins. Disabled plugins are immediately removed from the user interface and logged out of all sessions.",
	Example: `  plugin disable hovercardexample pluginexample`,
	RunE:    pluginDisableCmdF,
}

var PluginListCmd = &cobra.Command{
	Use:     "list",
	Short:   "List plugins",
	Long:    "List all active and inactive plugins installed on your Mattermost server.",
	Example: `  plugin list`,
	RunE:    pluginListCmdF,
}

func init() {
	PluginCmd.AddCommand(
		PluginAddCmd,
		PluginDeleteCmd,
		PluginEnableCmd,
		PluginDisableCmd,
		PluginListCmd,
	)
	RootCmd.AddCommand(PluginCmd)
}

func pluginAddCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for i, plugin := range args {
		fileReader, err := os.Open(plugin)
		if err != nil {
			return err
		}

		if _, err := a.InstallPlugin(fileReader, false); err != nil {
			CommandPrintErrorln("Unable to add plugin: " + args[i] + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Added plugin: " + plugin)
		}
		fileReader.Close()
	}

	return nil
}

func pluginDeleteCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, plugin := range args {
		if err := a.RemovePlugin(plugin); err != nil {
			CommandPrintErrorln("Unable to delete plugin: " + plugin + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted plugin: " + plugin)
		}
	}

	return nil
}

func pluginEnableCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, plugin := range args {
		if err := a.EnablePlugin(plugin); err != nil {
			CommandPrintErrorln("Unable to enable plugin: " + plugin + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Enabled plugin: " + plugin)
		}
	}

	return nil
}

func pluginDisableCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, plugin := range args {
		if err := a.DisablePlugin(plugin); err != nil {
			CommandPrintErrorln("Unable to disable plugin: " + plugin + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Disabled plugin: " + plugin)
		}
	}

	return nil
}

func pluginListCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	pluginsResp, appErr := a.GetPlugins()
	if appErr != nil {
		return errors.New("Unable to list plugins. Error: " + appErr.Error())
	}

	CommandPrettyPrintln("Listing active plugins")
	for _, plugin := range pluginsResp.Active {
		CommandPrettyPrintln(plugin.Manifest.Name + ", Version: " + plugin.Manifest.Version)
	}

	CommandPrettyPrintln("Listing inactive plugins")
	for _, plugin := range pluginsResp.Inactive {
		CommandPrettyPrintln(plugin.Manifest.Name + ", Version: " + plugin.Manifest.Version)
	}

	return nil
}
