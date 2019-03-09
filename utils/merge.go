// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"fmt"
	"reflect"
)

// Merge will return a new struct/map/slice of the same type as base and patch, with patch merged into base.
// Specifically, patch's values will be preferred except when patch's value is `nil`.
// Restrictions/guarantees:
//   - base and patch will not be modified
//   - base and patch can be pointers or values
//   - base and patch must be the same type
//   - if slices are different, they will be merged according to the following rules:
//       - start with elements from base (if any)
//		 - then for each item, patch will overwrite if different
//		 - and then add the extra items from patch (if any)
//   - if maps are different, they will be merged according to the following rules:
//       - keys in base are added first
//       - keys in patch are added after, overwriting existing keys with values from patch
//       - reference values (eg. slice/ptr/map/chan) will not be cloned
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

	baseType := reflect.TypeOf(base)
	baseVal := reflect.ValueOf(base)
	patchVal := reflect.ValueOf(patch)
	if baseType.Kind() == reflect.Ptr {
		baseType = baseType.Elem()
		baseVal = baseVal.Elem()
		patchVal = patchVal.Elem()
	}

	ret := reflect.New(baseType)

	val, ok := merge(baseVal, patchVal)
	if ok {
		ret.Elem().Set(val)
	}
	return ret.Elem().Interface(), nil
}

// merge recursively merges patch into base and returns the new struct, ptr, slice/map, or value
func merge(base, patch reflect.Value) (reflect.Value, bool) {
	baseType := base.Type()

	switch baseType.Kind() {
	case reflect.Struct:
		merged := reflect.New(baseType).Elem()
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
		mergedPtr := reflect.New(baseType.Elem())
		if base.IsNil() && patch.IsNil() {
			return mergedPtr, false
		} else if base.IsNil() {
			mergedPtr.Elem().Set(patch.Elem())
			return mergedPtr, true
		} else if patch.IsNil() {
			mergedPtr.Elem().Set(base.Elem())
			return mergedPtr, true
		}
		val, ok := merge(base.Elem(), patch.Elem())
		if ok {
			mergedPtr.Elem().Set(val)
		}
		return mergedPtr, true

	case reflect.Slice:
		// merge with these rules:
		// - start with elements from base (if any)
		// - then for each item, patch will overwrite if different
		// - and then add the extra items from patch (if any)
		if base.IsNil() && patch.IsNil() {
			return reflect.Zero(baseType), false
		}
		var maxLen int
		if base.Len() > patch.Len() {
			maxLen = base.Len()
		} else {
			maxLen = patch.Len()
		}
		merged := reflect.MakeSlice(baseType, maxLen, maxLen)
		if !base.IsNil() {
			reflect.Copy(merged, base)
		}
		if !patch.IsNil() {
			reflect.Copy(merged, patch)
		}
		return merged, true

	case reflect.Map:
		// for now, maps are merged in a very rudimentary way:
		// - keys in base are added first
		// - keys in patch are added after, overwriting existing keys with values from patch
		// - reference values (eg. slice/ptr/map/chan) will not be cloned
		if base.IsNil() && patch.IsNil() {
			return reflect.Zero(baseType), false
		}
		merged := reflect.MakeMap(baseType)
		if !base.IsNil() {
			for _, key := range base.MapKeys() {
				merged.SetMapIndex(key, base.MapIndex(key))
			}
		}
		if !patch.IsNil() {
			for _, key := range patch.MapKeys() {
				merged.SetMapIndex(key, patch.MapIndex(key))
			}
		}
		return merged, true

	// reflect.Chan not handled for now

	default:
		if base != patch {
			return patch, true
		}
		return base, true
	}
}
