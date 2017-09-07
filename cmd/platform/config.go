// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
package main

import (
	"encoding/json"
	"errors"
	"os"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration",
}

var validateConfigCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate config file",
	Run:   configValidateCmdF,
}

func init() {
	configCmd.AddCommand(
		validateConfigCmd,
	)
}

func configValidateCmdF(cmd *cobra.Command, args []string) {
	utils.TranslationsPreInit()
	filePath, err := cmd.Flags().GetString("config")
	if err != nil {
		CommandPrintErrorln(err)
		return
	}

	filePath = utils.FindConfigFile(filePath)

	file, err := os.Open(filePath)
	if err != nil {
		CommandPrintErrorln(err)
		return
	}

	decoder := json.NewDecoder(file)
	config := model.Config{}
	err = decoder.Decode(&config)
	if err != nil {
		CommandPrintErrorln(err)
		return
	}

	if _, err := file.Stat(); err != nil {
		CommandPrintErrorln(err)
		return
	}

	if err := config.IsValid(); err != nil {
		CommandPrintErrorln(errors.New(utils.T(err.Id)))
		return
	}

	CommandPrettyPrintln("The document is valid")
}
