// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"io/ioutil"
	"os"
	"path"

	rice "github.com/GeertJohan/go.rice"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/web"
)

var GenerateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate mattermost files",
}

var GenerateDefaultConfigCmd = &cobra.Command{
	Use:     "config",
	Short:   "Generate the default config file",
	Long:    "This will generate the default configuration file for mattermost.",
	Example: `  generate config config.json`,
	Args:    cobra.ExactArgs(1),
	RunE:    generateDefaultConfigCmdF,
}

var GenerateClientCmd = &cobra.Command{
	Use:     "client",
	Short:   "Generate the mattermost web client directory",
	Long:    "Generate the mattermost web client directory to override the one bundled with the application.",
	Example: `  generate client my-custom-client`,
	Args:    cobra.ExactArgs(1),
	RunE:    generateClientCmdF,
}

var GenerateTemplatesCmd = &cobra.Command{
	Use:     "templates",
	Short:   "Generate the mattermost mail templates directory",
	Long:    "Generate the mattermost mail templates directory to override the one bundled with the application.",
	Example: `  generate client my-custom-client`,
	Args:    cobra.ExactArgs(1),
	RunE:    generateTemplatesCmdF,
}

var GenerateI18nCmd = &cobra.Command{
	Use:     "i18n",
	Short:   "Generate the mattermost internationalization directory",
	Long:    "Generate the mattermost internationalization directory to override the one bundled with the application.",
	Example: `  generate i18n my-custom-translations`,
	Args:    cobra.ExactArgs(1),
	RunE:    generateI18nCmdF,
}

func init() {
	GenerateCmd.AddCommand(
		GenerateDefaultConfigCmd,
		GenerateClientCmd,
		GenerateTemplatesCmd,
		GenerateI18nCmd,
	)
	RootCmd.AddCommand(GenerateCmd)
}

func generateDefaultConfigCmdF(command *cobra.Command, args []string) error {
	config := model.Config{}
	config.SetDefaults()
	utils.SaveConfig(args[0], &config)
	return nil
}

func extractBoxToDir(box *rice.Box, directory string) error {
	if err := os.MkdirAll(directory, 0755); err != nil {
		return err
	}

	box.Walk("", func(filepath string, info os.FileInfo, err error) error {
		if info.IsDir() {
			if err := os.MkdirAll(path.Join(directory, filepath), 0755); err != nil {
				return err
			}
		} else {
			bytes, err := box.Bytes(filepath)
			if err != nil {
				return err
			}
			if err := ioutil.WriteFile(path.Join(directory, filepath), bytes, 0644); err != nil {
				return err
			}
		}
		return nil
	})

	return nil
}

func generateClientCmdF(command *cobra.Command, args []string) error {
	return extractBoxToDir(web.GetClientBox(), args[0])
}

func generateTemplatesCmdF(command *cobra.Command, args []string) error {
	return extractBoxToDir(utils.GetTemplatesBox(), args[0])
}

func generateI18nCmdF(command *cobra.Command, args []string) error {
	return extractBoxToDir(utils.GetI18nBox(), args[0])
}
