// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

const noSettingsNamed = "unable to find a setting named: %s"

var ConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration",
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
		ConfigSetCmd,
	)
	RootCmd.AddCommand(ConfigCmd)
}

func configSubpathCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

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

func getConfigStore(command *cobra.Command) (*config.Store, error) {
	if err := utils.TranslationsPreInit(); err != nil {
		return nil, errors.Wrap(err, "failed to initialize i18n")
	}

	configStore, err := config.NewStoreFromDSN(getConfigDSN(command, config.GetEnvironment()), false, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to initialize config store")
	}

	return configStore, nil
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
			return printStringMap(value, 0), nil
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
	configStore, err := getConfigStore(command)
	if err != nil {
		return err
	}

	// args[0] -> holds the config setting that we want to change
	// args[1:] -> the new value of the config setting
	configSetting := args[0]
	newVal := args[1:]

	// create the function to update config
	oldConfig := configStore.Get().Clone()
	newConfig := configStore.Get().Clone()

	f := updateConfigValue(configSetting, newVal, oldConfig, newConfig)
	f(newConfig)

	// UpdateConfig above would have already fixed these invalid locales, but we check again
	// in the context of an explicit change to these parameters to avoid saving the fixed
	// settings in the first place.
	if changed := config.FixInvalidLocales(newConfig); changed {
		return errors.New("Invalid locale configuration")
	}

	oldCfg, newCfg, errSet := configStore.Set(newConfig)
	if errSet != nil {
		return errors.Wrap(errSet, "failed to set config")
	}

	a, errInit := InitDBCommandContextCobra(command)
	if errInit != nil {
		return errInit
	}
	defer a.Srv().Shutdown()

	auditRec := a.MakeAuditRecord("configSet", audit.Success)
	defer a.LogAuditRec(auditRec, nil)
	diffs, diffErr := config.Diff(oldCfg, newCfg)
	if diffErr != nil {
		return errors.Wrap(diffErr, "failed to diff configs")
	}
	auditRec.AddMeta("diff", diffs)

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
		return fmt.Errorf(noSettingsNamed, configSettings[0])
	}

	value := reflect.ValueOf(res)

	switch value.Kind() {

	case reflect.Map:
		// we can only change the value of a particular setting, not the whole map, return error
		if len(configSettings) == 1 {
			return errors.New("unable to set multiple settings at once")
		}
		simpleMap, ok := res.(map[string]interface{})
		if ok {
			return UpdateMap(simpleMap, configSettings[1:], newVal)
		}
		mapOfTheMap, ok := res.(map[string]map[string]interface{})
		if ok {
			convertedMap := make(map[string]interface{})
			for k, v := range mapOfTheMap {
				convertedMap[k] = v
			}
			return UpdateMap(convertedMap, configSettings[1:], newVal)
		}
		pluginStateMap, ok := res.(map[string]*model.PluginState)
		if ok {
			convertedMap := make(map[string]interface{})
			for k, v := range pluginStateMap {
				convertedMap[k] = v
			}
			return UpdateMap(convertedMap, configSettings[1:], newVal)
		}
		return fmt.Errorf(noSettingsNamed, configSettings[1])

	case reflect.Int:
		if len(configSettings) == 1 {
			val, err := strconv.Atoi(newVal[0])
			if err != nil {
				return err
			}
			configMap[configSettings[0]] = val
			return nil
		}
		return fmt.Errorf(noSettingsNamed, configSettings[0])

	case reflect.Int64:
		if len(configSettings) == 1 {
			val, err := strconv.Atoi(newVal[0])
			if err != nil {
				return err
			}
			configMap[configSettings[0]] = int64(val)
			return nil
		}
		return fmt.Errorf(noSettingsNamed, configSettings[0])

	case reflect.Bool:
		if len(configSettings) == 1 {
			val, err := strconv.ParseBool(newVal[0])
			if err != nil {
				return err
			}
			configMap[configSettings[0]] = val
			return nil
		}
		return fmt.Errorf(noSettingsNamed, configSettings[0])

	case reflect.String:
		if len(configSettings) == 1 {
			configMap[configSettings[0]] = newVal[0]
			return nil
		}
		return fmt.Errorf(noSettingsNamed, configSettings[0])

	case reflect.Slice:
		if len(configSettings) == 1 {
			configMap[configSettings[0]] = newVal
			return nil
		}
		return fmt.Errorf(noSettingsNamed, configSettings[0])

	case reflect.Ptr:
		state, ok := res.(*model.PluginState)
		if !ok || len(configSettings) != 2 {
			return errors.New("type not supported yet")
		}
		val, err := strconv.ParseBool(newVal[0])
		if err != nil {
			return err
		}
		state.Enable = val
		return nil

	default:
		return errors.New("type not supported yet")
	}
}

// configToMap converts our config into a map
func configToMap(s interface{}) map[string]interface{} {
	return structToMap(s)
}
