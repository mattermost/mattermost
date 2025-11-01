// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"os"
	"reflect"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

func GetEnvironment() map[string]string {
	mmenv := make(map[string]string)
	for _, env := range os.Environ() {
		kv := strings.SplitN(env, "=", 2)
		key := strings.ToUpper(kv[0])
		if strings.HasPrefix(key, "MM") {
			mmenv[key] = kv[1]
		}
	}

	return mmenv
}

func applyEnvKey(key, value string, rValueSubject reflect.Value) {
	keyParts := strings.SplitN(key, "_", 2)
	if len(keyParts) < 1 {
		return
	}
	rFieldValue := rValueSubject.FieldByNameFunc(func(candidate string) bool {
		candidateUpper := strings.ToUpper(candidate)
		return candidateUpper == keyParts[0]
	})

	if !rFieldValue.IsValid() {
		return
	}

	if rFieldValue.Kind() == reflect.Ptr {
		rFieldValue = rFieldValue.Elem()
		if !rFieldValue.IsValid() {
			return
		}
	}

	switch rFieldValue.Kind() {
	case reflect.Struct:
		// If we have only one part left, we can't deal with a struct
		// the env var is incomplete so give up.
		if len(keyParts) < 2 {
			return
		}
		applyEnvKey(keyParts[1], value, rFieldValue)
	case reflect.String:
		rFieldValue.Set(reflect.ValueOf(value))
	case reflect.Bool:
		boolVal, err := strconv.ParseBool(value)
		if err == nil {
			rFieldValue.Set(reflect.ValueOf(boolVal))
		}
	case reflect.Int:
		intVal, err := strconv.ParseInt(value, 10, 0)
		if err == nil {
			rFieldValue.Set(reflect.ValueOf(int(intVal)))
		}
	case reflect.Int64:
		intVal, err := strconv.ParseInt(value, 10, 0)
		if err == nil {
			rFieldValue.Set(reflect.ValueOf(intVal))
		}
	case reflect.Slice:
		if rFieldValue.Type() == reflect.TypeFor[json.RawMessage]() {
			rFieldValue.Set(reflect.ValueOf([]byte(value)))
			break
		}
		rFieldValue.Set(reflect.ValueOf(strings.Split(value, " ")))
	case reflect.Map:
		target := reflect.New(rFieldValue.Type()).Interface()
		if err := json.Unmarshal([]byte(value), target); err == nil {
			rFieldValue.Set(reflect.ValueOf(target).Elem())
		}
	}
}

func applyEnvironmentMap(inputConfig *model.Config, env map[string]string) *model.Config {
	appliedConfig := inputConfig.Clone()

	rvalConfig := reflect.ValueOf(appliedConfig).Elem()
	for envKey, envValue := range env {
		applyEnvKey(strings.TrimPrefix(envKey, "MM_"), envValue, rvalConfig)
	}

	return appliedConfig
}

// generateEnvironmentMap creates a map[string]any containing true at the leaves mirroring the
// configuration structure so the client can know which env variables are overridden
func generateEnvironmentMap(env map[string]string, filter func(reflect.StructField) bool) map[string]any {
	rType := reflect.TypeFor[model.Config]()
	return generateEnvironmentMapWithBaseKey(env, rType, "MM", filter)
}

func generateEnvironmentMapWithBaseKey(env map[string]string, rType reflect.Type, base string, filter func(reflect.StructField) bool) map[string]any {
	if rType.Kind() != reflect.Struct {
		return nil
	}

	mapRepresentation := make(map[string]any)
	for i := 0; i < rType.NumField(); i++ {
		rField := rType.Field(i)
		if filter != nil && !filter(rField) {
			continue
		}
		if rField.Type.Kind() == reflect.Struct {
			if val := generateEnvironmentMapWithBaseKey(env, rField.Type, base+"_"+rField.Name, filter); val != nil {
				mapRepresentation[rField.Name] = val
			}
		} else {
			if _, ok := env[strings.ToUpper(base+"_"+rField.Name)]; ok {
				mapRepresentation[rField.Name] = true
			}
		}
	}

	if len(mapRepresentation) == 0 {
		return nil
	}

	return mapRepresentation
}

// removeEnvOverrides returns a new config without the given environment overrides.
// If a config variable has an environment override, that variable is set to the value that was
// read from the store.
func removeEnvOverrides(cfg, cfgWithoutEnv *model.Config, envOverrides map[string]any) *model.Config {
	paths := getPaths(envOverrides)
	newCfg := cfg.Clone()
	for _, path := range paths {
		originalVal := getVal(cfgWithoutEnv, path)
		newVal := getVal(newCfg, path)
		if newVal.CanSet() {
			newVal.Set(originalVal)
		}
	}
	return newCfg
}

// getPaths turns a nested map into a slice of paths describing the keys of the map. Eg:
// map[string]map[string]map[string]bool{"this":{"is first":{"path":true}, "is second":{"path":true}))) is turned into:
// [][]string{{"this", "is first", "path"}, {"this", "is second", "path"}}
func getPaths(m map[string]any) [][]string {
	return getPathsRec(m, nil)
}

// getPathsRec assembles the paths (see `getPaths` above)
func getPathsRec(src any, curPath []string) [][]string {
	if srcMap, ok := src.(map[string]any); ok {
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
func getVal(src any, path []string) reflect.Value {
	var val reflect.Value

	// If we recursed on a Value, we already have it. If we're calling on an any, get the Value.
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
