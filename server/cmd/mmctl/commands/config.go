// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"text/template"
	"time"

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
	Example: "config set SqlSettings.DriverName postgres\nconfig set SqlSettings.DataSourceReplicas \"replica1\"\nconfig set SqlSettings.DataSourceReplicas \"replica1\" \"replica2\"",
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
	Example: `config migrate path/to/config.json "postgres://mmuser:mostest_password@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10"`,
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

var ConfigExportCmd = &cobra.Command{
	Use:     "export",
	Short:   "Export the server configuration",
	Long:    "Export the server configuration in case you want to import somewhere else.",
	Example: "config export --remove-masked --remove-defaults",
	Args:    cobra.NoArgs,
	RunE:    withClient(configExportCmdF),
}

var ConfigHistoryCmd = &cobra.Command{
	Use:   "history",
	Short: "List saved configurations",
	Long: `Lists the configurations saved by the server, newest first, with the settings that changed in each one. The server keeps this history only when its configuration is stored in the database.

Only settings you have permission to read are listed, and sensitive values are always hidden.`,
	Example: `  config history
  config history --detailed
  config history --page 1 --per-page 20`,
	Args: cobra.NoArgs,
	RunE: withClient(configHistoryCmdF),
}

var ConfigRollbackCmd = &cobra.Command{
	Use:   "rollback <config-id>",
	Short: "Roll back to a saved configuration",
	Long: `Replaces the server configuration with a saved configuration from "config history". The configuration it replaces stays in the history.

Settings set through environment variables keep the values set there. Without --local, settings with sensitive values, such as passwords and database connection strings, settings that can't be changed through the API, and settings you don't have permission to change also keep their current values.`,
	Example: "  config rollback hpgt7dw7si8odbc9gg938iqjhr",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(configRollbackCmdF),
}

func init() {
	ConfigResetCmd.Flags().Bool("confirm", false, "confirm you really want to reset all configuration settings to its default value")

	ConfigSubpathCmd.Flags().StringP("assets-dir", "a", "", "directory of the Mattermost assets in the local filesystem")
	_ = ConfigSubpathCmd.MarkFlagRequired("assets-dir")
	ConfigSubpathCmd.Flags().StringP("path", "p", "", "path to update the assets with")
	_ = ConfigSubpathCmd.MarkFlagRequired("path")

	ConfigExportCmd.Flags().Bool("remove-masked", true, "remove masked values from the exported configuration")
	ConfigExportCmd.Flags().Bool("remove-defaults", false, "remove default values from the exported configuration")

	ConfigHistoryCmd.Flags().Int("page", 0, "Page number to fetch for the list of saved configurations")
	ConfigHistoryCmd.Flags().Int("per-page", 10, "Number of saved configurations to be fetched")
	ConfigHistoryCmd.Flags().Bool("detailed", false, "Show the old and new value of each changed setting")

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
		ConfigExportCmd,
		ConfigHistoryCmd,
		ConfigRollbackCmd,
	)
	RootCmd.AddCommand(ConfigCmd)
}

func getValue(path []string, obj any) (any, bool) {
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
				if mapVal.Kind() == reflect.Pointer {
					data = mapVal.Elem().Interface() // if value is a pointer, dereference it
				}
				// pass subpath
				return getValue(path[i:], data)
			}
		}
	}
	return nil, false
}

func setValueWithConversion(val reflect.Value, newValue any) error {
	switch val.Kind() {
	case reflect.Struct:
		val.Set(reflect.ValueOf(newValue))
		return nil
	case reflect.Slice:
		v := reflect.ValueOf(newValue)
		if v.Kind() != reflect.Slice {
			elemType := val.Type().Elem()
			switch {
			// Special case when setting a string to a byte slice
			case elemType.Kind() == reflect.Uint8 && v.Kind() == reflect.String:
				s := newValue.(string)
				v = reflect.ValueOf([]byte(s))
			// A single value for a list setting is a one-element list
			case v.Type().AssignableTo(elemType):
				v = reflect.Append(reflect.MakeSlice(val.Type(), 0, 1), v)
			default:
				return errors.Errorf("target value is of type %v and provided value is %v", val.Kind(), v.Kind())
			}
		}
		val.Set(v)
		return nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		bits := val.Type().Bits()
		v, err := strconv.ParseInt(newValue.(string), 10, bits)
		if err != nil {
			return fmt.Errorf("target value is of type %v and provided value is not, err: %w", val.Kind(), err)
		}
		val.SetInt(v)
		return nil
	case reflect.Float32, reflect.Float64:
		bits := val.Type().Bits()
		v, err := strconv.ParseFloat(newValue.(string), bits)
		if err != nil {
			return fmt.Errorf("target value is of type %v and provided value is not, err: %w", val.Kind(), err)
		}
		val.SetFloat(v)
		return nil
	case reflect.String:
		val.SetString(newValue.(string))
		return nil
	case reflect.Bool:
		v, err := strconv.ParseBool(newValue.(string))
		if err != nil {
			return fmt.Errorf("target value is of type %v and provided value is not, err: %w", val.Kind(), err)
		}
		val.SetBool(v)
		return nil
	default:
		return errors.Errorf("value type %v is not supported", val.Kind())
	}
}

func setValue(path []string, obj reflect.Value, newValue any) error {
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
		if val.Kind() == reflect.Pointer {
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

				if mapVal.Kind() == reflect.Pointer {
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

func resetConfigValue(path []string, config *model.Config, newValue any) error {
	nv := reflect.ValueOf(newValue)
	if nv.Kind() == reflect.Pointer {
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
	configBytes, err := os.ReadFile(args[0])
	if err != nil {
		return err
	}

	config, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return err
	}

	// get original plugin map
	var pluginConfig map[string]map[string]any
	if config.PluginSettings.Plugins != nil {
		pluginConfig = (config.Clone()).PluginSettings.Plugins
	}

	// apply path onto the existing config
	if jErr := json.Unmarshal(configBytes, config); jErr != nil {
		return jErr
	}

	// merge config plugin map on top of the original, and assign the
	// result to the config key
	config.PluginSettings.Plugins = MergePluginConfigs(pluginConfig, config.PluginSettings.Plugins)

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

	file, err := os.CreateTemp(os.TempDir(), "mmctl-*.json")
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

	newConfigBytes, err := os.ReadFile(file.Name())
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
	if t.Kind() == reflect.Pointer {
		t = t.Elem()
	}

	if t.Kind() != reflect.Struct {
		return false
	}

	for field := range t.Fields() {
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

func configExportCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	removeDefaults, _ := cmd.Flags().GetBool("remove-defaults")
	removeMasked, _ := cmd.Flags().GetBool("remove-masked")
	config, _, err := c.GetConfigWithOptions(context.TODO(), model.GetConfigOptions{
		RemoveDefaults: removeDefaults,
		RemoveMasked:   removeMasked,
	})
	if err != nil {
		return err
	}

	printer.SetSingle(true)
	printer.SetFormat(printer.FormatJSON)

	printer.Print(config)

	return nil
}

func configHistoryCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	page, _ := cmd.Flags().GetInt("page")
	perPage, _ := cmd.Flags().GetInt("per-page")
	detailed, _ := cmd.Flags().GetBool("detailed")

	entries, _, err := c.GetConfigHistory(context.TODO(), page, perPage)
	if err != nil {
		return fmt.Errorf("failed to get the configuration history: %w", err)
	}

	tpl := template.Must(template.New("").Funcs(template.FuncMap{
		"savedAt": formatSavedAt,
		"change": func(change *model.ConfigChange) string {
			if !detailed {
				return change.Path
			}
			return formatConfigChange(change)
		},
	}).Parse(`{{.Id}}  {{savedAt .CreateAt}}{{if .Active}}  (active){{end}}{{if .Unreadable}}  (can't be read){{end}}{{range .Changes}}
  {{change .}}{{end}}`))

	for _, entry := range entries {
		printer.PrintPreparedT(tpl, entry)
	}

	return nil
}

type configRollbackResult struct {
	ConfigId string                `json:"config_id"`
	Changes  []*model.ConfigChange `json:"changes"`
}

func configRollbackCmdF(c client.Client, _ *cobra.Command, args []string) error {
	configID := args[0]
	if !model.IsValidId(configID) {
		return fmt.Errorf("invalid configuration ID: %s", configID)
	}

	savedConfig, _, err := c.GetHistoricalConfig(context.TODO(), configID)
	if err != nil {
		return fmt.Errorf("failed to get saved configuration %s: %w", configID, err)
	}

	currentConfig, _, err := c.GetConfig(context.TODO())
	if err != nil {
		return fmt.Errorf("failed to get the current configuration: %w", err)
	}

	savedConfig, err = keepMaskedSettings(savedConfig, currentConfig)
	if err != nil {
		return fmt.Errorf("failed to keep the current values of sensitive settings: %w", err)
	}

	// The changed settings are listed as the history lists them, since only the server can
	// tell which plugin settings are sensitive.
	active, _, err := c.GetConfigHistory(context.TODO(), 0, 1)
	if err != nil {
		return fmt.Errorf("failed to get the active configuration: %w", err)
	}
	if len(active) == 0 {
		return errors.New("failed to get the active configuration: the configuration history is empty")
	}

	if _, _, err = c.UpdateConfig(context.TODO(), savedConfig); err != nil {
		return fmt.Errorf("failed to roll back to saved configuration %s: %w", configID, err)
	}

	changes, err := changesSavedAfter(c, active[0].Id)
	if err != nil {
		return fmt.Errorf("rolled back to saved configuration %s, but failed to get the changed settings: %w", configID, err)
	}

	tpl := template.Must(template.New("").Funcs(template.FuncMap{
		"change": formatConfigChange,
	}).Parse(`{{if .Changes}}Rolled back to saved configuration {{.ConfigId}}. Changed settings:{{range .Changes}}
  {{change .}}{{end}}{{else}}Rolled back to saved configuration {{.ConfigId}}. No settings changed, but settings that keep their current values, such as sensitive values without --local, may still differ from it.{{end}}`))

	printer.PrintPreparedT(tpl, &configRollbackResult{ConfigId: configID, Changes: changes})

	return nil
}

// configRollbackHistorySize is how many of the newest saved configurations are searched for the
// one saved by a rollback, which others may follow, such as one saved by a plugin it enabled.
const configRollbackHistorySize = 10

// changesSavedAfter returns the changes of the configuration saved right after the one with
// previousID, or none if no configuration was saved after it.
func changesSavedAfter(c client.Client, previousID string) ([]*model.ConfigChange, error) {
	history, _, err := c.GetConfigHistory(context.TODO(), 0, configRollbackHistorySize)
	if err != nil {
		return nil, err
	}

	for i, entry := range history {
		if entry.Id != previousID {
			continue
		}
		if i == 0 {
			// The server saves nothing when the configuration doesn't change.
			return []*model.ConfigChange{}, nil
		}
		return history[i-1].Changes, nil
	}

	return nil, fmt.Errorf("configuration %s isn't among the %d saved last", previousID, len(history))
}

// keepMaskedSettings returns a copy of saved in which each setting that is masked in saved or
// in current has its value in current. On save, the server puts the current value back in place
// of a mask only when it can match the mask to a current value, and saves any other mask as the
// value itself, such as one for a database replica removed since. A sensitive value that was
// empty, and so not masked, would clear the current one.
func keepMaskedSettings(saved, current *model.Config) (*model.Config, error) {
	savedMap, err := configAsMap(saved)
	if err != nil {
		return nil, err
	}
	currentMap, err := configAsMap(current)
	if err != nil {
		return nil, err
	}

	keepMaskedValues(savedMap, currentMap)

	b, err := json.Marshal(savedMap)
	if err != nil {
		return nil, err
	}
	var kept *model.Config
	if err := json.Unmarshal(b, &kept); err != nil {
		return nil, err
	}
	return kept, nil
}

// configAsMap returns cfg as JSON objects, keeping numbers as written.
func configAsMap(cfg *model.Config) (map[string]any, error) {
	b, err := json.Marshal(cfg)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(b))
	decoder.UseNumber()
	var m map[string]any
	if err := decoder.Decode(&m); err != nil {
		return nil, err
	}
	return m, nil
}

// keepMaskedValues sets each value in saved that is or holds a mask, in saved or in current,
// to its value in current. Objects, such as each plugin's settings, are compared key by key, an
// object missing on one side counting as empty.
func keepMaskedValues(saved, current map[string]any) {
	keys := make(map[string]bool, len(saved)+len(current))
	for key := range saved {
		keys[key] = true
	}
	for key := range current {
		keys[key] = true
	}

	for key := range keys {
		savedValue := saved[key]
		currentValue, inCurrent := current[key]

		savedMap, savedIsMap := savedValue.(map[string]any)
		currentMap, currentIsMap := currentValue.(map[string]any)
		if savedIsMap && currentValue == nil {
			currentMap, currentIsMap = map[string]any{}, true
		}
		if currentIsMap && savedValue == nil {
			savedMap, savedIsMap = map[string]any{}, true
		}
		if savedIsMap && currentIsMap {
			keepMaskedValues(savedMap, currentMap)
			if savedValue != nil || len(savedMap) > 0 {
				saved[key] = savedMap
			}
			continue
		}

		if !holdsMask(savedValue) && !holdsMask(currentValue) {
			continue
		}
		if inCurrent {
			saved[key] = currentValue
		} else {
			delete(saved, key)
		}
	}
}

// holdsMask reports whether v is a masked value or holds one.
func holdsMask(v any) bool {
	switch v := v.(type) {
	case string:
		return v == model.FakeSetting
	case []any:
		return slices.ContainsFunc(v, holdsMask)
	case map[string]any:
		for _, value := range v {
			if holdsMask(value) {
				return true
			}
		}
	}
	return false
}

func formatSavedAt(millis int64) string {
	return time.UnixMilli(millis).Format("2006-01-02 15:04:05 MST")
}

func formatConfigChange(change *model.ConfigChange) string {
	if change.OldValue == model.FakeSetting && change.NewValue == model.FakeSetting {
		return change.Path + ": [redacted]"
	}
	return fmt.Sprintf("%s: %s -> %s", change.Path, formatConfigValue(change.OldValue), formatConfigValue(change.NewValue))
}

func formatConfigValue(value any) string {
	if value == model.FakeSetting {
		return "[redacted]"
	}
	b, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(b)
}
