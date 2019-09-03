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

var PluginPublicKeysCmd = &cobra.Command{
	Use:     "keys",
	Short:   "List public keys",
	Long:    "List names of all public keys installed on your Mattermost server.",
	Example: `  plugin keys`,
	RunE:    pluginPublicKeysCmdF,
}

var PluginPublicKeyDetailsCmd = &cobra.Command{
	Use:     "key-details",
	Short:   "List public keys in detailed format",
	Long:    "List names and details of all public keys installed on your Mattermost server.",
	Example: `  plugin key-details`,
	RunE:    pluginPublicKeyDetailsCmdF,
}

var PluginAddPublicKeyCmd = &cobra.Command{
	Use:     "add-key [keys]",
	Short:   "Adds public keys",
	Long:    "Adds public keys for plugins on your Mattermost server.",
	Example: `  plugin add-key my-pk-file1.asc my-pk-file2.asc`,
	RunE:    pluginAddPublicKeyCmdF,
}

var PluginDeletePublicKeyCmd = &cobra.Command{
	Use:     "delete-key [public-keys]",
	Short:   "Deletes public keys",
	Long:    "Deletes public keys for plugins on your Mattermost server.",
	Example: `  plugin delete-key my-pk-file1.asc my-pk-file2.asc `,
	RunE:    pluginDeletePublicKeyCmdF,
}

func init() {
	PluginCmd.AddCommand(
		PluginAddCmd,
		PluginDeleteCmd,
		PluginEnableCmd,
		PluginDisableCmd,
		PluginListCmd,
		PluginPublicKeysCmd,
		PluginPublicKeyDetailsCmd,
		PluginAddPublicKeyCmd,
		PluginDeletePublicKeyCmd,
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

func pluginPublicKeysCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	pluginPublicKeysResp, appErr := a.GetPluginPublicKeys()
	if appErr != nil {
		return errors.New("Unable to list public keys. Error: " + appErr.Error())
	}

	for _, publicKey := range pluginPublicKeysResp {
		CommandPrettyPrintln(publicKey)
	}

	return nil
}

func pluginPublicKeyDetailsCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	pluginPublicKeysResp, appErr := a.GetPluginPublicKeys()
	if appErr != nil {
		return errors.New("Unable to list public keys. Error: " + appErr.Error())
	}

	for _, publicKey := range pluginPublicKeysResp {
		key, err := a.GetPublicKey(publicKey)
		if err != nil {
			CommandPrintErrorln("Unable to get plugin public key: " + publicKey + ". Error: " + err.Error())
		}
		CommandPrettyPrintln("Plugin name: " + publicKey + ". \nPublic key: \n" + string(key) + "\n")
	}

	return nil
}

func pluginAddPublicKeyCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, pkFile := range args {
		if err := a.AddPublicKey(pkFile); err != nil {
			CommandPrintErrorln("Unable to add public key: " + pkFile + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Added public key: " + pkFile)
		}

	}

	return nil
}

func pluginDeletePublicKeyCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, pkFile := range args {
		if err := a.DeletePublicKey(pkFile); err != nil {
			CommandPrintErrorln("Unable to delete public key: " + pkFile + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted public key: " + pkFile)
		}

	}

	return nil
}
