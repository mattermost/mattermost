// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"reflect"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

const defaultEditor = "vi"

var ErrConfigInvalidPath = errors.New("selected path object is not valid")

var ConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration",
}

var ConfigGetCmd = &cobra.Command{
	Use:     "get",
	Short:   "Get config setting",
	Long:    "Gets the value of a config setting by its name in dot notation.",
	Example: `config get SqlSettings.DriverName`,
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(configGetCmdF),
}

var ConfigSetCmd = &cobra.Command{
	Use:     "set",
	Short:   "Set config setting",
	Long:    "Sets the value of a config setting by its name in dot notation. Accepts multiple values for array settings",
	Example: "config set SqlSettings.DriverName mysql\nconfig set SqlSettings.DataSourceReplicas \"replica1\" \"replica2\"",
	Args:    cobra.MinimumNArgs(2),
	RunE:    withClient(configSetCmdF),
}

var ConfigPatchCmd = &cobra.Command{
	Use:     "patch <config-file>",
	Short:   "Patch the config",
	Long:    "Patches config settings with the given config file.",
	Example: "config patch /path/to/config.json",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(configPatchCmdF),
}

var ConfigEditCmd = &cobra.Command{
	Use:     "edit",
	Short:   "Edit the config",
	Long:    "Opens the editor defined in the EDITOR environment variable to modify the server's configuration and then uploads it",
	Example: "config edit",
	Args:    cobra.NoArgs,
	RunE:    withClient(configEditCmdF),
}

var ConfigResetCmd = &cobra.Command{
	Use:     "reset",
	Short:   "Reset config setting",
	Long:    "Resets the value of a config setting by its name in dot notation or a setting section. Accepts multiple values for array settings.",
	Example: "config reset SqlSettings.DriverName LogSettings",
	Args:    cobra.MinimumNArgs(1),
	RunE:    withClient(configResetCmdF),
}

var ConfigShowCmd = &cobra.Command{
	Use:     "show",
	Short:   "Writes the server configuration to STDOUT",
	Long:    "Prints the server configuration and writes to STDOUT in JSON format.",
	Example: "config show",
	Args:    cobra.NoArgs,
	RunE:    withClient(configShowCmdF),
}

var ConfigReloadCmd = &cobra.Command{
	Use:     "reload",
	Short:   "Reload the server configuration",
	Long:    "Reload the server configuration in case you want to new settings to be applied.",
	Example: "config reload",
	Args:    cobra.NoArgs,
	RunE:    withClient(configReloadCmdF),
}

var ConfigMigrateCmd = &cobra.Command{
	Use:     "migrate [from_config] [to_config]",
	Short:   "Migrate existing config between backends",
	Long:    "Migrate a file-based configuration to (or from) a database-based configuration. Point the Mattermost server at the target configuration to start using it. Note that this command is only available in `--local` mode.",
	Example: `config migrate path/to/config.json "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10"`,
	Args:    cobra.ExactArgs(2),
	RunE:    withClient(configMigrateCmdF),
}

var ConfigSubpathCmd = &cobra.Command{
	Use:   "subpath",
	Short: "Update client asset loading to use the configured subpath",
	Long:  "Update the hard-coded production client asset paths to take into account Mattermost running on a subpath. This command needs access to the Mattermost assets directory to be able to rewrite the paths.",
	Example: `  # you can rewrite the assets to use a subpath
  mmctl config subpath --assets-dir /opt/mattermost/client --path /mattermost

  # the subpath can have multiple steps
  mmctl config subpath --assets-dir /opt/mattermost/client --path /my/custom/subpath

  # or you can fallback to the root path passing /
  mmctl config subpath --assets-dir /opt/mattermost/client --path /`,
	Args: cobra.NoArgs,
	RunE: configSubpathCmdF,
}

func init() {
	ConfigResetCmd.Flags().Bool("confirm", false, "confirm you really want to reset all configuration settings to its default value")

	ConfigSubpathCmd.Flags().StringP("assets-dir", "a", "", "directory of the Mattermost assets in the local filesystem")
	_ = ConfigSubpathCmd.MarkFlagRequired("assets-dir")
	ConfigSubpathCmd.Flags().StringP("path", "p", "", "path to update the assets with")
	_ = ConfigSubpathCmd.MarkFlagRequired("path")

	ConfigCmd.AddCommand(
		ConfigGetCmd,
		ConfigSetCmd,
		ConfigPatchCmd,
		ConfigEditCmd,
		ConfigResetCmd,
		ConfigShowCmd,
		ConfigReloadCmd,
		ConfigMigrateCmd,
		ConfigSubpathCmd,
	)
	RootCmd.AddCommand(ConfigCmd)
}

func getValue(path []string, obj interface{}) (interface{}, bool) {
	r := reflect.ValueOf(obj)
	var val reflect.Value
	if r.Kind() == reflect.Map {
		val = r.MapIndex(reflect.ValueOf(path[0]))
		if val.IsValid() {
			val = val.Elem()
		}
	} else {
		val = r.FieldByName(path[0])
	}

	if !val.IsValid() {
		return nil, false
	}

	switch {
	case len(path) == 1:
		return val.Interface(), true
	case val.Kind() == reflect.Struct:
		return getValue(path[1:], val.Interface())
	case val.Kind() == reflect.Map:
		remainingPath := strings.Join(path[1:], ".")
		mapIter := val.MapRange()
		for mapIter.Next() {
			key := mapIter.Key().String()
			if strings.HasPrefix(remainingPath, key) {
				i := strings.Count(key, ".") + 2 // number of dots + a dot on each side
				mapVal := mapIter.Value()
				// if no sub field path specified, return the object
				if len(path[i:]) == 0 {
					return mapVal.Interface(), true
				}
				data := mapVal.Interface()
				if mapVal.Kind() == reflect.Ptr {
					data = mapVal.Elem().Interface() // if value is a pointer, dereference it
				}
				// pass subpath
				return getValue(path[i:], data)
			}
		}
	}
	return nil, false
}

func setValueWithConversion(val reflect.Value, newValue interface{}) error {
	switch val.Kind() {
	case reflect.Struct:
		val.Set(reflect.ValueOf(newValue))
		return nil
	case reflect.Slice:
		if val.Type().Elem().Kind() != reflect.String {
			return errors.New("unsupported type of slice")
		}
		v := reflect.ValueOf(newValue)
		if v.Kind() != reflect.Slice {
			return errors.New("target value is of type Array and provided value is not")
		}
		val.Set(v)
		return nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		bits := val.Type().Bits()
		v, err := strconv.ParseInt(newValue.(string), 10, bits)
		if err != nil {
			return fmt.Errorf("target value is of type %v and provided value is not", val.Kind())
		}
		val.SetInt(v)
		return nil
	case reflect.Float32, reflect.Float64:
		bits := val.Type().Bits()
		v, err := strconv.ParseFloat(newValue.(string), bits)
		if err != nil {
			return fmt.Errorf("target value is of type %v and provided value is not", val.Kind())
		}
		val.SetFloat(v)
		return nil
	case reflect.String:
		val.SetString(newValue.(string))
		return nil
	case reflect.Bool:
		v, err := strconv.ParseBool(newValue.(string))
		if err != nil {
			return errors.New("target value is of type Bool and provided value is not")
		}
		val.SetBool(v)
		return nil
	default:
		return errors.New("target value type is not supported")
	}
}

func setValue(path []string, obj reflect.Value, newValue interface{}) error {
	var val reflect.Value
	switch obj.Kind() {
	case reflect.Struct:
		val = obj.FieldByName(path[0])
	case reflect.Map:
		val = obj.MapIndex(reflect.ValueOf(path[0]))
		if val.IsValid() {
			val = val.Elem()
		}
	default:
		val = obj
	}

	if val.Kind() == reflect.Invalid {
		return ErrConfigInvalidPath
	}

	if len(path) == 1 {
		if val.Kind() == reflect.Ptr {
			return setValue(path, val.Elem(), newValue)
		} else if obj.Kind() == reflect.Map {
			// since we cannot set map elements directly, we clone the value, set it, and then put it back in the map
			mapKey := reflect.ValueOf(path[0])
			subVal := obj.MapIndex(mapKey)
			if subVal.IsValid() {
				tmpVal := reflect.New(subVal.Elem().Type())
				if err := setValueWithConversion(tmpVal.Elem(), newValue); err != nil {
					return err
				}
				obj.SetMapIndex(mapKey, tmpVal)
				return nil
			}
		}
		return setValueWithConversion(val, newValue)
	}

	if val.Kind() == reflect.Struct {
		return setValue(path[1:], val, newValue)
	} else if val.Kind() == reflect.Map {
		remainingPath := strings.Join(path[1:], ".")
		mapIter := val.MapRange()
		for mapIter.Next() {
			key := mapIter.Key().String()
			if strings.HasPrefix(remainingPath, key) {
				mapVal := mapIter.Value()

				if mapVal.Kind() == reflect.Ptr {
					mapVal = mapVal.Elem() // if value is a pointer, dereference it
				}
				i := len(strings.Split(key, ".")) + 1

				if i > len(path)-1 { // leaf element
					i = 1
					mapVal = val
				}
				// pass subpath
				return setValue(path[i:], mapVal, newValue)
			}
		}
	}
	return errors.New("path object type is not supported")
}

func setConfigValue(path []string, config *model.Config, newValue []string) error {
	if len(newValue) > 1 {
		return setValue(path, reflect.ValueOf(config).Elem(), newValue)
	}
	return setValue(path, reflect.ValueOf(config).Elem(), newValue[0])
}

func resetConfigValue(path []string, config *model.Config, newValue interface{}) error {
	nv := reflect.ValueOf(newValue)
	if nv.Kind() == reflect.Ptr {
		switch nv.Elem().Kind() {
		case reflect.Int:
			return setValue(path, reflect.ValueOf(config).Elem(), strconv.Itoa(*newValue.(*int)))
		case reflect.Bool:
			return setValue(path, reflect.ValueOf(config).Elem(), strconv.FormatBool(*newValue.(*bool)))
		default:
			return setValue(path, reflect.ValueOf(config).Elem(), *newValue.(*string))
		}
	} else {
		return setValue(path, reflect.ValueOf(config).Elem(), newValue)
	}
}

func configGetCmdF(c client.Client, _ *cobra.Command, args []string) error {
	printer.SetSingle(true)
	printer.SetFormat(printer.FormatJSON)

	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	path := strings.Split(args[0], ".")
	val, ok := getValue(path, *config)
	if !ok {
		return errors.New("invalid key")
	}

	if cloudRestricted(config, path) && reflect.ValueOf(val).IsNil() {
		return fmt.Errorf("accessing this config path: %s is restricted in a cloud environment", args[0])
	}

	printer.Print(val)
	return nil
}

func configSetCmdF(c client.Client, _ *cobra.Command, args []string) error {
	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	path := parseConfigPath(args[0])
	if cErr := setConfigValue(path, config, args[1:]); cErr != nil {
		if errors.Is(cErr, ErrConfigInvalidPath) && cloudRestricted(config, path) {
			return fmt.Errorf("changing this config path: %s is restricted in a cloud environment", args[0])
		}

		return cErr
	}
	newConfig, _, err := c.PatchConfig(context.TODO(), config)
	if err != nil {
		return err
	}

	printer.PrintT("Value changed successfully", newConfig)
	return nil
}

func configPatchCmdF(c client.Client, _ *cobra.Command, args []string) error {
	configBytes, err := ioutil.ReadFile(args[0])
	if err != nil {
		return err
	}

	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	if jErr := json.Unmarshal(configBytes, config); jErr != nil {
		return jErr
	}

	newConfig, _, err := c.PatchConfig(context.TODO(), config)
	if err != nil {
		return err
	}

	printer.PrintT("Config patched successfully", newConfig)
	return nil
}

func configEditCmdF(c client.Client, _ *cobra.Command, _ []string) error {
	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	configBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	file, err := ioutil.TempFile(os.TempDir(), "mmctl-*.json")
	if err != nil {
		return err
	}
	defer func() {
		file.Close()
		os.Remove(file.Name())
	}()
	if _, writeErr := file.Write(configBytes); writeErr != nil {
		return writeErr
	}

	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = defaultEditor
	}

	editorCmd := exec.Command(editor, file.Name())
	editorCmd.Stdout = os.Stdout
	editorCmd.Stdin = os.Stdin
	editorCmd.Stderr = os.Stderr

	if cmdErr := editorCmd.Run(); cmdErr != nil {
		return cmdErr
	}

	newConfigBytes, err := ioutil.ReadFile(file.Name())
	if err != nil {
		return err
	}

	if jErr := json.Unmarshal(newConfigBytes, config); jErr != nil {
		return jErr
	}

	newConfig, _, err := c.UpdateConfig(context.TODO(), config)
	if err != nil {
		return err
	}

	printer.PrintT("Config updated successfully", newConfig)
	return nil
}

func configResetCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	confirmFlag, _ := cmd.Flags().GetBool("confirm")

	if !confirmFlag && len(args) > 0 {
		if err := getConfirmation(fmt.Sprintf(
			"Are you sure you want to reset %s to their default value? (YES/NO): ",
			args[0]), false); err != nil {
			return err
		}
	}

	defaultConfig := &model.Config{}
	defaultConfig.SetDefaults()
	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	for _, arg := range args {
		path := parseConfigPath(arg)
		defaultValue, ok := getValue(path, *defaultConfig)
		if !ok {
			return errors.New("invalid key")
		}
		nErr := resetConfigValue(path, config, defaultValue)
		if nErr != nil {
			return nErr
		}
	}
	newConfig, _, err := c.UpdateConfig(context.TODO(), config)
	if err != nil {
		return err
	}

	printer.PrintT("Value/s reset successfully", newConfig)
	return nil
}

func configShowCmdF(c client.Client, _ *cobra.Command, _ []string) error {
	printer.SetSingle(true)
	printer.SetFormat(printer.FormatJSON)
	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	printer.Print(config)

	return nil
}

func parseConfigPath(configPath string) []string {
	return strings.Split(configPath, ".")
}

func configReloadCmdF(c client.Client, _ *cobra.Command, _ []string) error {
	_, err := c.ReloadConfig(context.TODO())
	if err != nil {
		return err
	}

	return nil
}

func configMigrateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	isLocal, _ := cmd.Flags().GetBool("local")
	if !isLocal {
		return errors.New("this command is only available in local mode. Please set the --local flag")
	}

	_, err := c.MigrateConfig(context.TODO(), args[0], args[1])
	if err != nil {
		return err
	}

	return nil
}

func configSubpathCmdF(cmd *cobra.Command, _ []string) error {
	assetsDir, _ := cmd.Flags().GetString("assets-dir")
	path, _ := cmd.Flags().GetString("path")

	if err := utils.UpdateAssetsSubpathInDir(path, assetsDir); err != nil {
		return errors.Wrap(err, "failed to update assets subpath")
	}

	printer.Print("Config subpath successfully modified")

	return nil
}

func cloudRestricted(cfg any, path []string) bool {
	return cloudRestrictedR(reflect.TypeOf(cfg), path)
}

// cloudRestricted checks if the config path is restricted to the cloud
func cloudRestrictedR(t reflect.Type, path []string) bool {
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	if t.Kind() != reflect.Struct {
		return false
	}

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		if len(path) == 0 || field.Name != path[0] {
			continue
		}

		accessTag := field.Tag.Get(model.ConfigAccessTagType)
		if strings.Contains(accessTag, model.ConfigAccessTagCloudRestrictable) {
			return true
		}

		return cloudRestrictedR(field.Type, path[1:])
	}

	return false
}
