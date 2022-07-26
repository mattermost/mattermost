// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"fmt"
	"reflect"
)

// StructFieldFilter defines a callback function used to decide if a patch value should be applied.
type StructFieldFilter func(structField reflect.StructField, base reflect.Value, patch reflect.Value) bool

// MergeConfig allows for optional merge customizations.
type MergeConfig struct {
	StructFieldFilter StructFieldFilter
}

// Merge will return a new value of the same type as base and patch, recursively merging non-nil values from patch on top of base.
//
// Restrictions/guarantees:
//   - base and patch must be the same type
//   - base and patch will never be modified
//   - values from patch are always selected when non-nil
//   - structs are merged recursively
//   - maps and slices are treated as pointers, and merged as a single value
//
// Note that callers need to cast the returned interface back into the original type:
// func mergeTestStruct(base, patch *testStruct) (*testStruct, error) {
//     ret, err := merge(base, patch)
//     if err != nil {
//         return nil, err
//     }
//
//     retTS := ret.(testStruct)
//     return &retTS, nil
// }
func Merge(base any, patch any, mergeConfig *MergeConfig) (any, error) {
	if reflect.TypeOf(base) != reflect.TypeOf(patch) {
		return nil, fmt.Errorf(
			"cannot merge different types. base type: %s, patch type: %s",
			reflect.TypeOf(base),
			reflect.TypeOf(patch),
		)
	}

	commonType := reflect.TypeOf(base)
	baseVal := reflect.ValueOf(base)
	patchVal := reflect.ValueOf(patch)
	if commonType.Kind() == reflect.Ptr {
		commonType = commonType.Elem()
		baseVal = baseVal.Elem()
		patchVal = patchVal.Elem()
	}

	ret := reflect.New(commonType)

	val, ok := merge(baseVal, patchVal, mergeConfig)
	if ok {
		ret.Elem().Set(val)
	}
	return ret.Elem().Interface(), nil
}

// merge recursively merges patch into base and returns the new struct, ptr, slice/map, or value
func merge(base, patch reflect.Value, mergeConfig *MergeConfig) (reflect.Value, bool) {
	commonType := base.Type()

	switch commonType.Kind() {
	case reflect.Struct:
		merged := reflect.New(commonType).Elem()
		for i := 0; i < base.NumField(); i++ {
			if !merged.Field(i).CanSet() {
				continue
			}
			if mergeConfig != nil && mergeConfig.StructFieldFilter != nil {
				if !mergeConfig.StructFieldFilter(commonType.Field(i), base.Field(i), patch.Field(i)) {
					merged.Field(i).Set(base.Field(i))
					continue
				}
			}
			val, ok := merge(base.Field(i), patch.Field(i), mergeConfig)
			if ok {
				merged.Field(i).Set(val)
			}
		}
		return merged, true

	case reflect.Ptr:
		mergedPtr := reflect.New(commonType.Elem())
		if base.IsNil() && patch.IsNil() {
			return mergedPtr, false
		}

		// clone reference values (if any)
		if base.IsNil() {
			val, _ := merge(patch.Elem(), patch.Elem(), mergeConfig)
			mergedPtr.Elem().Set(val)
		} else if patch.IsNil() {
			val, _ := merge(base.Elem(), base.Elem(), mergeConfig)
			mergedPtr.Elem().Set(val)
		} else {
			val, _ := merge(base.Elem(), patch.Elem(), mergeConfig)
			mergedPtr.Elem().Set(val)
		}
		return mergedPtr, true

	case reflect.Slice:
		if base.IsNil() && patch.IsNil() {
			return reflect.Zero(commonType), false
		}
		if !patch.IsNil() {
			// use patch
			merged := reflect.MakeSlice(commonType, 0, patch.Len())
			for i := 0; i < patch.Len(); i++ {
				// recursively merge patch with itself. This will clone reference values.
				val, _ := merge(patch.Index(i), patch.Index(i), mergeConfig)
				merged = reflect.Append(merged, val)
			}
			return merged, true
		}
		// use base
		merged := reflect.MakeSlice(commonType, 0, base.Len())
		for i := 0; i < base.Len(); i++ {

			// recursively merge base with itself. This will clone reference values.
			val, _ := merge(base.Index(i), base.Index(i), mergeConfig)
			merged = reflect.Append(merged, val)
		}
		return merged, true

	case reflect.Map:
		// maps are merged according to these rules:
		// - if patch is not nil, replace the base map completely
		// - otherwise, keep the base map
		// - reference values (eg. slice/ptr/map) will be cloned
		if base.IsNil() && patch.IsNil() {
			return reflect.Zero(commonType), false
		}
		merged := reflect.MakeMap(commonType)
		mapPtr := base
		if !patch.IsNil() {
			mapPtr = patch
		}
		for _, key := range mapPtr.MapKeys() {
			// clone reference values
			val, ok := merge(mapPtr.MapIndex(key), mapPtr.MapIndex(key), mergeConfig)
			if !ok {
				val = reflect.New(mapPtr.MapIndex(key).Type()).Elem()
			}
			merged.SetMapIndex(key, val)
		}
		return merged, true

	case reflect.Interface:
		var val reflect.Value
		if base.IsNil() && patch.IsNil() {
			return reflect.Zero(commonType), false
		}

		// clone reference values (if any)
		if base.IsNil() {
			val, _ = merge(patch.Elem(), patch.Elem(), mergeConfig)
		} else if patch.IsNil() {
			val, _ = merge(base.Elem(), base.Elem(), mergeConfig)
		} else {
			val, _ = merge(base.Elem(), patch.Elem(), mergeConfig)
		}
		return val, true

	default:
		return patch, true
	}
}
