// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"errors"
	"os"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/spf13/cobra"
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

func init() {
	ConfigCmd.AddCommand(
		ValidateConfigCmd,
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
