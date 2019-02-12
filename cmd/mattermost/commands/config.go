// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/fileutils"
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

var ConfigGetCmd = &cobra.Command{
	Use:     "get",
	Short:   "Get config setting",
	Long:    "Gets the value of a config setting by its name in dot notation.",
	Example: `config get SqlSettings.DriverName`,
	Args:    cobra.ExactArgs(1),
	RunE:    configGetCmdF,
}

var ConfigShowCmd = &cobra.Command{
	Use:     "show",
	Short:   "Writes the server configuration to STDOUT",
	Long:    "Pretty-prints the server configuration and writes to STDOUT",
	Example: "config show",
	RunE:    configShowCmdF,
}

var ConfigSetCmd = &cobra.Command{
	Use:     "set",
	Short:   "Set config setting",
	Long:    "Sets the value of a config setting by its name in dot notation. Accepts multiple values for array settings",
	Example: "config set SqlSettings.DriverName mysql",
	Args:    cobra.MinimumNArgs(2),
	RunE:    configSetCmdF,
}

func init() {
	ConfigSubpathCmd.Flags().String("path", "", "Optional subpath; defaults to value in SiteURL")

	ConfigCmd.AddCommand(
		ValidateConfigCmd,
		ConfigSubpathCmd,
		ConfigGetCmd,
		ConfigShowCmd,
		ConfigSetCmd,
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

	filePath = fileutils.FindConfigFile(filePath)

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

func configGetCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer app.Shutdown()

	// create the model for config
	// Note: app.Config() returns a pointer, make appropriate changes
	config := app.Config()

	// get the print config setting and any error if there is
	out, err := printConfigValues(configToMap(*config), strings.Split(args[0], "."), args[0])
	if err != nil {
		return err
	}

	fmt.Printf("%s", out)

	return nil
}

func configShowCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer app.Shutdown()

	// check that no arguments are given
	err = cobra.NoArgs(command, args)
	if err != nil {
		return err
	}

	// set up the config object
	config := app.Config()

	// pretty print
	fmt.Printf("%s", prettyPrintStruct(*config))
	return nil
}

// printConfigValues function prints out the value of the configSettings working recursively or
// gives an error if config setting is not in the file.
func printConfigValues(configMap map[string]interface{}, configSetting []string, name string) (string, error) {

	res, ok := configMap[configSetting[0]]
	if !ok {
		return "", fmt.Errorf("%s configuration setting is not in the file", name)
	}
	value := reflect.ValueOf(res)
	switch value.Kind() {
	case reflect.Map:
		if len(configSetting) == 1 {
			return printMap(value, 0), nil
		}
		return printConfigValues(res.(map[string]interface{}), configSetting[1:], name)
	default:
		if len(configSetting) == 1 {
			return fmt.Sprintf("%s: \"%v\"\n", name, res), nil
		}
		return "", fmt.Errorf("%s configuration setting is not in the file", name)
	}
}

func configSetCmdF(command *cobra.Command, args []string) error {
	app, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}

	defer app.Shutdown()

	// args[0] -> holds the config setting that we want to change
	// args[1:] -> the new value of the config setting
	configSetting := args[0]
	newVal := args[1:]

	// Update the config

	// first disable the watchers
	app.DisableConfigWatch()

	// create the function to update config
	oldConfig := app.Config()
	newConfig := app.Config()
	f := updateConfigValue(configSetting, newVal, oldConfig, newConfig)

	// update the config
	app.UpdateConfig(f)

	// Verify new config
	if err := newConfig.IsValid(); err != nil {
		return err
	}

	if err := config.ValidateLocales(app.Config()); err != nil {
		return errors.New("Invalid locale configuration")
	}

	// make the changes persist
	app.PersistConfig()

	// reload config
	app.ReloadConfig()

	// Enable config watchers
	app.EnableConfigWatch()

	return nil
}

func updateConfigValue(configSetting string, newVal []string, oldConfig, newConfig *model.Config) func(*model.Config) {
	return func(update *model.Config) {

		// convert config to map[string]interface
		configMap := configToMap(*oldConfig)

		// iterate through the map and update the value or print an error and exit
		err := UpdateMap(configMap, strings.Split(configSetting, "."), newVal)
		if err != nil {
			fmt.Printf("%s\n", err)
			os.Exit(1)
		}

		// convert map to json
		bs, err := json.Marshal(configMap)
		if err != nil {
			fmt.Printf("Error while marshalling map to json %s\n", err)
			os.Exit(1)
		}

		// convert json to struct
		err = json.Unmarshal(bs, newConfig)
		if err != nil {
			fmt.Printf("Error while unmarshalling json to struct %s\n", err)
			os.Exit(1)
		}

		*update = *newConfig

	}
}

func UpdateMap(configMap map[string]interface{}, configSettings []string, newVal []string) error {
	res, ok := configMap[configSettings[0]]
	if !ok {
		return fmt.Errorf("unable to find a setting with that name %s", configSettings[0])
	}

	value := reflect.ValueOf(res)

	switch value.Kind() {

	case reflect.Map:
		// we can only change the value of a particular setting, not the whole map, return error
		if len(configSettings) == 1 {
			return errors.New("unable to set multiple settings at once")
		}
		return UpdateMap(res.(map[string]interface{}), configSettings[1:], newVal)

	case reflect.Int:
		if len(configSettings) == 1 {
			val, err := strconv.Atoi(newVal[0])
			if err != nil {
				return err
			}
			configMap[configSettings[0]] = val
			return nil
		}
		return fmt.Errorf("unable to find a setting with that name %s", configSettings[0])

	case reflect.Int64:
		if len(configSettings) == 1 {
			val, err := strconv.Atoi(newVal[0])
			if err != nil {
				return err
			}
			configMap[configSettings[0]] = int64(val)
			return nil
		}
		return fmt.Errorf("unable to find a setting with that name %s", configSettings[0])

	case reflect.Bool:
		if len(configSettings) == 1 {
			val, err := strconv.ParseBool(newVal[0])
			if err != nil {
				return err
			}
			configMap[configSettings[0]] = val
			return nil
		}
		return fmt.Errorf("unable to find a setting with that name %s", configSettings[0])

	case reflect.String:
		if len(configSettings) == 1 {
			configMap[configSettings[0]] = newVal[0]
			return nil
		}
		return fmt.Errorf("unable to find a setting with that name %s", configSettings[0])

	case reflect.Slice:
		if len(configSettings) == 1 {
			configMap[configSettings[0]] = newVal
			return nil
		}
		return fmt.Errorf("unable to find a setting with that name %s", configSettings[0])

	default:
		return errors.New("type not supported yet")
	}
}

// configToMap converts our config into a map
func configToMap(s interface{}) map[string]interface{} {
	return structToMap(s)
}
