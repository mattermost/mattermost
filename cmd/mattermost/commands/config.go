// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"os"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

var ConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration",
}

var ValidateConfigCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate config file",
	Long:  "If the config file is valid, this command will output a success message and have a zero exit code. If it is invalid, this command will output an error and have a non-zero exit code.",
	RunE:  configValidateCmdF,
}

var ConfigSubpathCmd = &cobra.Command{
	Use:   "subpath",
	Short: "Update client asset loading to use the configured subpath",
	Long:  "Update the hard-coded production client asset paths to take into account Mattermost running on a subpath.",
	Example: `  config subpath
  config subpath --path /mattermost
  config subpath --path /`,
	RunE: configSubpathCmdF,
}

func init() {
	ConfigSubpathCmd.Flags().String("path", "", "Optional subpath; defaults to value in SiteURL")

	ConfigCmd.AddCommand(
		ValidateConfigCmd,
		ConfigSubpathCmd,
	)
	RootCmd.AddCommand(ConfigCmd)
}

func configValidateCmdF(command *cobra.Command, args []string) error {
	utils.TranslationsPreInit()
	model.AppErrorInit(utils.T)
	filePath, err := command.Flags().GetString("config")
	if err != nil {
		return err
	}

	filePath = utils.FindConfigFile(filePath)

	file, err := os.Open(filePath)
	if err != nil {
		return err
	}

	decoder := json.NewDecoder(file)
	config := model.Config{}
	err = decoder.Decode(&config)
	if err != nil {
		return err
	}

	if _, err := file.Stat(); err != nil {
		return err
	}

	if err := config.IsValid(); err != nil {
		return errors.New(utils.T(err.Id))
	}

	CommandPrettyPrintln("The document is valid")
	return nil
}

func configSubpathCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	path, err := command.Flags().GetString("path")
	if err != nil {
		return errors.Wrap(err, "failed reading path")
	}

	if path == "" {
		return utils.UpdateAssetsSubpathFromConfig(a.Config())
	}

	if err := utils.UpdateAssetsSubpath(path); err != nil {
		return errors.Wrap(err, "failed to update assets subpath")
	}

	return nil
}
