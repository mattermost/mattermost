// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"reflect"

	"github.com/mattermost/mattermost-server/v5/model"
)

type ConfigDiff struct {
	Path      string      `json:"path"`
	BaseVal   interface{} `json:"base_val"`
	ActualVal interface{} `json:"actual_val"`
}

func diff(base, actual reflect.Value, label string) ([]ConfigDiff, error) {
	var diffs []ConfigDiff

	if base.IsZero() && actual.IsZero() {
		return diffs, nil
	}

	if base.IsZero() || actual.IsZero() {
		return append(diffs, ConfigDiff{
			Path:      label,
			BaseVal:   base.Interface(),
			ActualVal: actual.Interface(),
		}), nil
	}

	baseType := base.Type()
	actualType := actual.Type()

	if baseType.Kind() == reflect.Ptr {
		base = reflect.Indirect(base)
		actual = reflect.Indirect(actual)
		baseType = base.Type()
		actualType = actual.Type()
	}

	if baseType != actualType {
		return nil, fmt.Errorf("not same type %s %s", baseType, actualType)
	}

	switch baseType.Kind() {
	case reflect.Struct:
		if base.NumField() != actual.NumField() {
			return nil, fmt.Errorf("not same number of fields in struct")
		}
		for i := 0; i < base.NumField(); i++ {
			fieldLabel := baseType.Field(i).Name
			if label != "" {
				fieldLabel = label + "." + fieldLabel
			}
			d, err := diff(base.Field(i), actual.Field(i), fieldLabel)
			if err != nil {
				return nil, err
			}
			diffs = append(diffs, d...)
		}
	default:
		if !reflect.DeepEqual(base.Interface(), actual.Interface()) {
			diffs = append(diffs, ConfigDiff{
				Path:      label,
				BaseVal:   base.Interface(),
				ActualVal: actual.Interface(),
			})
		}
	}

	return diffs, nil
}

func Diff(base, actual *model.Config) ([]ConfigDiff, error) {
	if base == nil || actual == nil {
		return nil, fmt.Errorf("input configs should not be nil")
	}
	baseVal := reflect.Indirect(reflect.ValueOf(base))
	actualVal := reflect.Indirect(reflect.ValueOf(actual))
	return diff(baseVal, actualVal, "")
}
