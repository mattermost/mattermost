// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v6/model"
)

const CustomDefaultsEnvVar = "MM_CUSTOM_DEFAULTS_PATH"

// printStringMap takes a reflect.Value and prints it out alphabetically based on key values, which must be strings.
// This is done recursively if it's a map, and uses the given tab settings.
func printStringMap(value reflect.Value, tabVal int) string {
	out := &bytes.Buffer{}

	var sortedKeys []string
	stringToKeyMap := make(map[string]reflect.Value)
	for _, k := range value.MapKeys() {
		sortedKeys = append(sortedKeys, k.String())
		stringToKeyMap[k.String()] = k
	}

	sort.Strings(sortedKeys)

	for _, keyString := range sortedKeys {
		key := stringToKeyMap[keyString]
		val := value.MapIndex(key)
		if newVal, ok := val.Interface().(map[string]any); !ok {
			fmt.Fprintf(out, "%s", strings.Repeat("\t", tabVal))
			fmt.Fprintf(out, "%v: \"%v\"\n", key.Interface(), val.Interface())
		} else {
			fmt.Fprintf(out, "%s", strings.Repeat("\t", tabVal))
			fmt.Fprintf(out, "%v:\n", key.Interface())
			// going one level in, increase the tab
			tabVal++
			fmt.Fprintf(out, "%s", printStringMap(reflect.ValueOf(newVal), tabVal))
			// coming back one level, decrease the tab
			tabVal--
		}
	}

	return out.String()
}

func getConfigDSN(command *cobra.Command, env map[string]string) string {
	configDSN, _ := command.Flags().GetString("config")

	// Config not supplied in flag, check env
	if configDSN == "" {
		configDSN = env["MM_CONFIG"]
	}

	// Config not supplied in env or flag use default
	if configDSN == "" {
		configDSN = "config.json"
	}

	return configDSN
}

func loadCustomDefaults() (*model.Config, error) {
	customDefaultsPath := os.Getenv(CustomDefaultsEnvVar)
	if customDefaultsPath == "" {
		return nil, nil
	}

	file, err := os.Open(customDefaultsPath)
	if err != nil {
		return nil, fmt.Errorf("unable to open custom defaults file at %q: %w", customDefaultsPath, err)
	}
	defer file.Close()

	var customDefaults *model.Config
	err = json.NewDecoder(file).Decode(&customDefaults)
	if err != nil {
		return nil, fmt.Errorf("unable to decode custom defaults configuration: %w", err)
	}

	return customDefaults, nil
}
