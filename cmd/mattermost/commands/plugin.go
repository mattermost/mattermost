// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
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
	Long:    "List all enabled and disabled plugins installed on your Mattermost server.",
	Example: `  plugin list`,
	RunE:    pluginListCmdF,
}

var PluginPublicKeysCmd = &cobra.Command{
	Use:   "keys",
	Short: "List public keys",
	Long:  "List names of all public keys installed on your Mattermost server.",
	Example: `  plugin keys
  plugin keys --verbose`,
	RunE: pluginPublicKeysCmdF,
}

var PluginAddPublicKeyCmd = &cobra.Command{
	Use:     "add [keys]",
	Short:   "Adds public key(s)",
	Long:    "Adds public key(s) for plugins on your Mattermost server.",
	Example: `  plugin keys add my-pk-file1 my-pk-file2`,
	RunE:    pluginAddPublicKeyCmdF,
}

var PluginDeletePublicKeyCmd = &cobra.Command{
	Use:     "delete [keys]",
	Short:   "Deletes public key(s)",
	Long:    "Deletes public key(s) for plugins on your Mattermost server.",
	Example: `  plugin keys delete my-pk-file1 my-pk-file2`,
	RunE:    pluginDeletePublicKeyCmdF,
}

func init() {
	PluginPublicKeysCmd.Flags().Bool("verbose", false, "List names and details of all public keys installed on your Mattermost server.")
	PluginPublicKeysCmd.AddCommand(
		PluginAddPublicKeyCmd,
		PluginDeletePublicKeyCmd,
	)
	PluginCmd.AddCommand(
		PluginAddCmd,
		PluginDeleteCmd,
		PluginEnableCmd,
		PluginDisableCmd,
		PluginListCmd,
		PluginPublicKeysCmd,
	)

	RootCmd.AddCommand(PluginCmd)
}

func pluginAddCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobraReadWrite(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

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
			auditRec := a.MakeAuditRecord("pluginAdd", audit.Success)
			auditRec.AddMeta("plugin", plugin)
			a.LogAuditRec(auditRec, nil)
		}
		fileReader.Close()
	}
	return nil
}

func pluginDeleteCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobraReadWrite(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, plugin := range args {
		if err := a.RemovePlugin(plugin); err != nil {
			CommandPrintErrorln("Unable to delete plugin: " + plugin + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted plugin: " + plugin)
			auditRec := a.MakeAuditRecord("pluginDelete", audit.Success)
			auditRec.AddMeta("plugin", plugin)
			a.LogAuditRec(auditRec, nil)
		}
	}
	return nil
}

func pluginEnableCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobraReadWrite(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, plugin := range args {
		if err := a.EnablePlugin(plugin); err != nil {
			CommandPrintErrorln("Unable to enable plugin: " + plugin + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Enabled plugin: " + plugin)
			auditRec := a.MakeAuditRecord("pluginEnable", audit.Success)
			auditRec.AddMeta("plugin", plugin)
			a.LogAuditRec(auditRec, nil)
		}
	}
	return nil
}

func pluginDisableCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobraReadWrite(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, plugin := range args {
		if err := a.DisablePlugin(plugin); err != nil {
			CommandPrintErrorln("Unable to disable plugin: " + plugin + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Disabled plugin: " + plugin)
			auditRec := a.MakeAuditRecord("pluginDisable", audit.Success)
			auditRec.AddMeta("plugin", plugin)
			a.LogAuditRec(auditRec, nil)
		}
	}
	return nil
}

func pluginListCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	pluginsResp, appErr := a.GetPlugins()
	if appErr != nil {
		return errors.Wrap(appErr, "Unable to list plugins.")
	}

	CommandPrettyPrintln("Listing enabled plugins")
	for _, plugin := range pluginsResp.Active {
		CommandPrettyPrintln(plugin.Manifest.Name + ", Version: " + plugin.Manifest.Version)
	}

	CommandPrettyPrintln("Listing disabled plugins")
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
	defer a.Srv().Shutdown()

	verbose, err := command.Flags().GetBool("verbose")
	if err != nil {
		return errors.Wrap(err, "Failed reading verbose flag.")
	}

	pluginPublicKeysResp, appErr := a.GetPluginPublicKeyFiles()
	if appErr != nil {
		return errors.Wrap(appErr, "Unable to list public keys.")
	}

	if verbose {
		for _, publicKey := range pluginPublicKeysResp {
			key, err := a.GetPublicKey(publicKey)
			if err != nil {
				CommandPrintErrorln("Unable to get plugin public key: " + publicKey + ". Error: " + err.Error())
			}
			CommandPrettyPrintln("Plugin name: " + publicKey + ". \nPublic key: \n" + string(key) + "\n")
		}
	} else {
		for _, publicKey := range pluginPublicKeysResp {
			CommandPrettyPrintln(publicKey)
		}
	}

	return nil
}

func pluginAddPublicKeyCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobraReadWrite(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, pkFile := range args {
		filename := filepath.Base(pkFile)
		fileReader, err := os.Open(pkFile)
		if err != nil {
			return model.NewAppError("AddPublicKey", "api.plugin.add_public_key.open.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		defer fileReader.Close()

		if err := a.AddPublicKey(filename, fileReader); err != nil {
			CommandPrintErrorln("Unable to add public key: " + pkFile + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Added public key: " + pkFile)
			auditRec := a.MakeAuditRecord("pluginAddPublicKey", audit.Success)
			auditRec.AddMeta("file", pkFile)
			a.LogAuditRec(auditRec, nil)
		}
	}
	return nil
}

func pluginDeletePublicKeyCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobraReadWrite(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if len(args) < 1 {
		return errors.New("Expected at least one argument. See help text for details.")
	}

	for _, pkFile := range args {
		if err := a.DeletePublicKey(pkFile); err != nil {
			CommandPrintErrorln("Unable to delete public key: " + pkFile + ". Error: " + err.Error())
		} else {
			CommandPrettyPrintln("Deleted public key: " + pkFile)
			auditRec := a.MakeAuditRecord("pluginDeletePublicKey", audit.Success)
			auditRec.AddMeta("file", pkFile)
			a.LogAuditRec(auditRec, nil)
		}
	}
	return nil
}
