// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"reflect"

	"github.com/mattermost/mattermost-server/model"
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
	if reflect.ValueOf(src).Kind() == reflect.Ptr {
		val = reflect.ValueOf(src).Elem().FieldByName(path[0])
	} else {
		val = reflect.ValueOf(src).FieldByName(path[0])
	}
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	if val.Kind() == reflect.Struct {
		return getVal(val.Interface(), path[1:])
	}
	return val
}
