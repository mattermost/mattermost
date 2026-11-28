// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"fmt"
	"reflect"
	"testing"
)

// runPermutations generates permutations from the given params struct and runs the callback as a
// subtest for each permutation.
//
// For now, the given struct must only contain boolean fields.
func runPermutations[T any](t *testing.T, params T, f func(t *testing.T, params T)) {
	t.Helper()

	paramsV := reflect.ValueOf(params)
	paramsT := reflect.TypeOf(params)
	if paramsV.Kind() == reflect.Ptr {
		if paramsV.Elem().Kind() != reflect.Struct {
			t.Fatal("params should be a struct or a pointer to a struct")
		}
		paramsV = paramsV.Elem()
	} else if paramsV.Kind() != reflect.Struct {
		t.Fatal("params should be a struct or a pointer to a struct")
	}

	numberOfPermutations := 1
	for i := 0; i < paramsV.NumField(); i++ {
		if paramsV.Field(i).Kind() != reflect.Bool {
			t.Fatal("unsupported permutation parameter type: " + paramsV.Field(i).Kind().String())
		}

		// If there's a non-empty value tag, we don't permute this field.
		if paramsT.Field(i).Tag.Get("value") == "" {
			numberOfPermutations *= 2
		}
	}

	type run struct {
		description string
		params      T
	}
	var runs []run

	for i := 0; i < numberOfPermutations; i++ {
		var description string
		var params T
		paramsValue := reflect.ValueOf(&params).Elem()

		// Track which bit of i we're using to decide the value of the field. We don't use
		// the iterator j directly, since we sometimes skip fields if they have a value tag
		// defining a fixed value.
		fieldBit := 0
		for j := 0; j < paramsV.NumField(); j++ {
			var enabled, fixed bool
			switch paramsT.Field(j).Tag.Get("value") {
			case "":
				enabled = (i & (1 << fieldBit)) > 0
				fieldBit++
			case "true":
				enabled = true
				fixed = true
			case "false":
				enabled = false
				fixed = true
			default:
				t.Fatalf("unknown value tag: %s", paramsT.Field(j).Tag.Get("value"))
			}

			if len(description) > 0 {
				description += ","
			}
			if fixed {
				description += fmt.Sprintf("%s=%v!", paramsV.Type().Field(j).Name, enabled)
			} else {
				description += fmt.Sprintf("%s=%v", paramsV.Type().Field(j).Name, enabled)
			}

			paramsValue.Field(j).SetBool(enabled)
		}

		runs = append(runs, run{description, params})
	}

	for _, r := range runs {
		t.Run(r.description, func(t *testing.T) {
			t.Helper()
			f(t, r.params)
		})
	}
}
