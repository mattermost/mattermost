// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"reflect"
)

// Merge will return a new struct/map/slice of the same type as base and patch, with patch merged into base.
// Specifically, patch's values will be preferred except when patch's value is `nil`.
// Note: a referenced value (eg. *bool) will only be `nil` if the pointer is nil. If the value is a zero value,
//       then that is considered a legitimate value. Eg, *bool(false) will overwrite *bool(true).
//
// Restrictions/guarantees:
//   - base and patch will not be modified
//   - base and patch can be pointers or values
//   - base and patch must be the same type
//   - if slices are different, this rule applies:
//       - if patch is not nil, overwrite the base slice.
//       - otherwise, keep the base slice
//   - maps will be merged according to the following rules:
//       - if patch is not nil, replace the base map completely
//		 - otherwise, keep the base map
//		 - reference values (eg. slice/ptr/map) will be cloned
//   - channel values are not supported at the moment
//
// Usage: callers need to cast the returned interface back into the original type, eg:
// func mergeTestStruct(base, patch *testStruct) (*testStruct, error) {
//     ret, err := merge(base, patch)
//     if err != nil {
//         return nil, err
//     }
//     retTS := ret.(testStruct)
//     return &retTS, nil
// }
func Merge(base interface{}, patch interface{}) (interface{}, error) {
	if reflect.TypeOf(base) != reflect.TypeOf(patch) {
		return nil, fmt.Errorf("cannot merge different types. base type: %s, patch type: %s",
			reflect.TypeOf(base), reflect.TypeOf(patch))
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

	val, ok := merge(baseVal, patchVal)
	if ok {
		ret.Elem().Set(val)
	}
	return ret.Elem().Interface(), nil
}

// merge recursively merges patch into base and returns the new struct, ptr, slice/map, or value
func merge(base, patch reflect.Value) (reflect.Value, bool) {
	commonType := base.Type()

	switch commonType.Kind() {
	case reflect.Struct:
		merged := reflect.New(commonType).Elem()
		for i := 0; i < base.NumField(); i++ {
			if !merged.Field(i).CanSet() {
				continue
			}
			val, ok := merge(base.Field(i), patch.Field(i))
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
			val, _ := merge(patch.Elem(), patch.Elem())
			mergedPtr.Elem().Set(val)
		} else if patch.IsNil() {
			val, _ := merge(base.Elem(), base.Elem())
			mergedPtr.Elem().Set(val)
		} else {
			val, _ := merge(base.Elem(), patch.Elem())
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
				val, _ := merge(patch.Index(i), patch.Index(i))
				merged = reflect.Append(merged, val)
			}
			return merged, true
		}
		// use base
		merged := reflect.MakeSlice(commonType, 0, base.Len())
		for i := 0; i < base.Len(); i++ {

			// recursively merge base with itself. This will clone reference values.
			val, _ := merge(base.Index(i), base.Index(i))
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
			val, ok := merge(mapPtr.MapIndex(key), mapPtr.MapIndex(key))
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
			val, _ = merge(patch.Elem(), patch.Elem())
		} else if patch.IsNil() {
			val, _ = merge(base.Elem(), base.Elem())
		} else {
			val, _ = merge(base.Elem(), patch.Elem())
		}
		return val, true

	default:
		return patch, true
	}
}
