// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"reflect"

	"github.com/mattermost/mattermost-server/v5/model"
)

// removeEnvOverrides returns a new config without the given environment overrides.
// If a config variable has an environment override, that variable is set to the value that was
// read from the store.
func removeEnvOverrides(cfg, cfgWithoutEnv *model.Config, envOverrides map[string]interface{}) *model.Config {
	paths := getPaths(envOverrides)
	newCfg := cfg.Clone()
	for _, path := range paths {
		originalVal := getVal(cfgWithoutEnv, path)
		getVal(newCfg, path).Set(originalVal)
	}
	return newCfg
}

// getPaths turns a nested map into a slice of paths describing the keys of the map. Eg:
// map[string]map[string]map[string]bool{"this":{"is first":{"path":true}, "is second":{"path":true}))) is turned into:
// [][]string{{"this", "is first", "path"}, {"this", "is second", "path"}}
func getPaths(m map[string]interface{}) [][]string {
	return getPathsRec(m, nil)
}

// getPathsRec assembles the paths (see `getPaths` above)
func getPathsRec(src interface{}, curPath []string) [][]string {
	if srcMap, ok := src.(map[string]interface{}); ok {
		paths := [][]string{}
		for k, v := range srcMap {
			paths = append(paths, getPathsRec(v, append(curPath, k))...)
		}
		return paths
	}

	return [][]string{curPath}
}

// getVal walks `src` (here it starts with a model.Config, then recurses into its leaves)
// and returns the reflect.Value of the leaf at the end `path`
func getVal(src interface{}, path []string) reflect.Value {
	var val reflect.Value

	// If we recursed on a Value, we already have it. If we're calling on an interface{}, get the Value.
	switch v := src.(type) {
	case reflect.Value:
		val = v
	default:
		val = reflect.ValueOf(src)
	}

	// Move into the struct
	if val.Kind() == reflect.Ptr {
		val = val.Elem().FieldByName(path[0])
	} else {
		val = val.FieldByName(path[0])
	}
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	if val.Kind() == reflect.Struct {
		return getVal(val, path[1:])
	}
	return val
}
