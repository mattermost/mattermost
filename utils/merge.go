package utils

import (
	"fmt"
	"reflect"
)

// Merge will return a new struct of the same type as base and patch, with patch merged into base.
// Specifically, patch's values will be preferred except when patch's value is `nil`.
// Restrictions/guarantees:
//   - base or patch will not be modified
//   - base and patch can be pointers or values
//   - base and patch must be the same type
//   - base and patch must have no unexported types (at the moment)
//   - if maps or slices are different, the entire map or slice will be replaced (at the moment)
//
// Usage: callers need to cast the returned interface back into the original type, eg:
// func mergeTestStruct(base, patch *testStruct) (*testStruct, error) {
//	   ret, err := merge(base, patch)
//	   if err != nil {
//         return nil, err
//	   }
//	   retTS := ret.(testStruct)
//	   return &retTS, nil
// }
func Merge(base interface{}, patch interface{}) (interface{}, error) {
	if reflect.TypeOf(base) != reflect.TypeOf(patch) {
		return nil, fmt.Errorf("cannot merge different types. base type: %s, patch type: %s",
			reflect.TypeOf(base), reflect.TypeOf(patch))
	}

	baseType := reflect.TypeOf(base)
	if baseType.Kind() == reflect.Ptr {
		baseType = baseType.Elem()
	}

	ret := reflect.New(baseType)
	if err := initStruct(baseType, ret.Elem()); err != nil {
		return nil, err
	}

	if err := mergeRec(base, patch, ret.Elem()); err != nil {
		return nil, err
	}
	return ret.Elem().Interface(), nil
}

// mergeRec recursively merges into ret
func mergeRec(base interface{}, patch interface{}, ret reflect.Value) (err error) {
	bt := reflect.TypeOf(base)
	bv := reflect.ValueOf(base)
	pv := reflect.ValueOf(patch)
	if bt.Kind() == reflect.Ptr {
		bt = bt.Elem()
		bv = bv.Elem()
		// if the patch value is nil, just assign the base value and we're done.
		if pv.IsNil() {
			ret.Set(bv)
			return nil
		}
		pv = pv.Elem()
	}
	for i := 0; i < bt.NumField(); i++ {
		patchWasNil := false
		bti := bt.Field(i).Type
		bvi := bv.Field(i)
		pvi := pv.Field(i)
		rvi := ret.Field(i)
		switch bti.Kind() {
		case reflect.Ptr:
			patchWasNil = pvi.IsNil()
			bti = bti.Elem()
			bvi = bvi.Elem()
			pvi = pvi.Elem()
			rvi = rvi.Elem()
		case reflect.Slice:
			patchWasNil = pvi.IsNil()
		case reflect.Map:
			patchWasNil = pvi.IsNil()
		}

		if bti.Kind() == reflect.Struct {
			err := mergeRec(bv.Field(i).Interface(), pv.Field(i).Interface(), rvi)
			if err != nil {
				return fmt.Errorf("failed in mergeRec on field # %d of type %v, err: %v", i, bti, err)
			}
		} else {
			if !patchWasNil && bvi != pvi {
				rvi.Set(pvi)
			} else {
				rvi.Set(bvi)
			}
		}
	}
	return nil
}

// initStruct creates a new struct of type t
func initStruct(t reflect.Type, v reflect.Value) (err error) {
	// WIP: if we want to support structs with unexported fields, we need to do that explicitly.
	for i := 0; i < v.NumField(); i++ {
		ft := t.Field(i).Type
		fv := v.Field(i)

		switch ft.Kind() {
		case reflect.Slice:
			fv.Set(reflect.MakeSlice(ft, 0, 0))
		case reflect.Map:
			fv.Set(reflect.MakeMap(ft))
		case reflect.Chan:
			fv.Set(reflect.MakeChan(ft, 0))
		case reflect.Struct:
			if e := initStruct(ft, fv); e != nil {
				return e
			}
		case reflect.Ptr:
			p := reflect.New(ft.Elem())
			if ft.Elem().Kind() == reflect.Struct {
				if e := initStruct(ft.Elem(), p.Elem()); e != nil {
					return e
				}
			}
			fv.Set(p)
		default:
		}
	}
	return nil
}
