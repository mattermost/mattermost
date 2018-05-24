// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"errors"
	"os"

	"github.com/spf13/cobra"
)

var PluginCmd = &cobra.Command{
	Use:   "plugin",
	Short: "Management of plugins",
}

var PluginCreateCmd = &cobra.Command{
	Use:     "add",
	Short:   "Add a plugin",
	Long:    "Add a plugin or multiple plugins",
	Example: `  plugin add hovercardexample.tar.gz pluginexample.tar.gz`,
	RunE:    pluginCreateCmdF,
}

var PluginDeleteCmd = &cobra.Command{
	Use:     "delete",
	Short:   "Delete a plugin",
	Long:    "Delete a plugin",
	Example: `  plugin delete hovercardexample`,
	RunE:    pluginDeleteCmdF,
}

var PluginActivateCmd = &cobra.Command{
	Use:     "activate",
	Short:   "Activate a plugin",
	Long:    "Activate a plugin or multiple plugins",
	Example: `  plugin activate hovercardexample.tar.gz pluginexample.tar.gz`,
	RunE:    pluginActivateCmdF,
}

var PluginDeactivateCmd = &cobra.Command{
	Use:     "deactivate",
	Short:   "Deactivate a plugin",
	Long:    "Deactivate a plugin",
	Example: `  plugin deactivate hovercardexample`,
	RunE:    pluginDeactivateCmdF,
}

var PluginListCmd = &cobra.Command{
	Use:     "list",
	Short:   "List plugins",
	Long:    "List all active and inactive plugins",
	Example: `  plugin list`,
	RunE:    pluginListCmdF,
}

func init() {
	PluginCmd.AddCommand(
		PluginCreateCmd,
		PluginDeleteCmd,
		PluginActivateCmd,
		PluginDeactivateCmd,
		PluginListCmd,
	)
	RootCmd.AddCommand(PluginCmd)
}

func pluginCreateCmdF(command *cobra.Command, args []string) error {
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

		if _, err := a.InstallPlugin(fileReader); err != nil {
			return errors.New("Unable to create plugin: " + args[i])
		}
		fileReader.Close()
	}

	CommandPrettyPrintln("Created plugin(s)")

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

	if err := a.RemovePlugin(args[0]); err != nil {
		return errors.New("Unable to delete plugin: " + args[0])
	}

	CommandPrettyPrintln("Deleted plugin")

	return nil
}

func pluginActivateCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for i, pluginID := range args {
		if err := a.EnablePlugin(pluginID); err != nil {
			return errors.New("Unable to activate plugin: " + args[i])
		}
	}

	CommandPrettyPrintln("Activated plugin(s)")

	return nil
}

func pluginDeactivateCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	if err := a.DisablePlugin(args[0]); err != nil {
		return errors.New("Unable to deactivate plugin: " + args[0])
	}

	CommandPrettyPrintln("Deactivated plugin")

	return nil
}

func pluginListCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	plugins, err := a.GetPlugins()
	if err != nil {
		return errors.New("Unable to get plugins. Error: " + err.Error())
	}

	CommandPrettyPrintln("Listing plugins")

	pluginList, err := json.MarshalIndent(plugins, "", "  ")
	if err != nil {
		return errors.New("Unable to list plugins. Error: " + err.Error())
	}

	CommandPrettyPrintln(pluginList)

	return nil
}
