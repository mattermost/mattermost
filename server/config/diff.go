// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"reflect"

	"github.com/mattermost/mattermost-server/v6/model"
)

type ConfigDiffs []ConfigDiff

type ConfigDiff struct {
	Path      string `json:"path"`
	BaseVal   any    `json:"base_val"`
	ActualVal any    `json:"actual_val"`
}

func (c *ConfigDiff) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"path":       c.Path,
		"base_val":   c.BaseVal,
		"actual_val": c.ActualVal,
	}
}

func (cd *ConfigDiffs) Auditable() map[string]interface{} {
	var s []interface{}
	for _, d := range cd.Sanitize() {
		s = append(s, d.Auditable())
	}
	return map[string]interface{}{
		"config_diffs": s,
	}
}

var configSensitivePaths = map[string]bool{
	"LdapSettings.BindPassword":                              true,
	"FileSettings.PublicLinkSalt":                            true,
	"FileSettings.AmazonS3SecretAccessKey":                   true,
	"SqlSettings.DataSource":                                 true,
	"SqlSettings.AtRestEncryptKey":                           true,
	"SqlSettings.DataSourceReplicas":                         true,
	"SqlSettings.DataSourceSearchReplicas":                   true,
	"EmailSettings.SMTPPassword":                             true,
	"GitLabSettings.Secret":                                  true,
	"GoogleSettings.Secret":                                  true,
	"Office365Settings.Secret":                               true,
	"OpenIdSettings.Secret":                                  true,
	"ElasticsearchSettings.Password":                         true,
	"MessageExportSettings.GlobalRelaySettings.SMTPUsername": true,
	"MessageExportSettings.GlobalRelaySettings.SMTPPassword": true,
	"MessageExportSettings.GlobalRelaySettings.EmailAddress": true,
	"ServiceSettings.GfycatAPISecret":                        true,
	"ServiceSettings.SplitKey":                               true,
	"PluginSettings.Plugins":                                 true,
}

// Sanitize replaces sensitive config values in the diff with asterisks filled strings.
func (cd ConfigDiffs) Sanitize() ConfigDiffs {
	if len(cd) == 1 {
		cfgPtr, ok := cd[0].BaseVal.(*model.Config)
		if ok {
			cfgPtr.Sanitize()
		}
		cfgPtr, ok = cd[0].ActualVal.(*model.Config)
		if ok {
			cfgPtr.Sanitize()
		}
		cfgVal, ok := cd[0].BaseVal.(model.Config)
		if ok {
			cfgVal.Sanitize()
		}
		cfgVal, ok = cd[0].ActualVal.(model.Config)
		if ok {
			cfgVal.Sanitize()
		}
	}

	for i := range cd {
		if configSensitivePaths[cd[i].Path] {
			cd[i].BaseVal = model.FakeSetting
			cd[i].ActualVal = model.FakeSetting
		}
	}

	return cd
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

func Diff(base, actual *model.Config) (ConfigDiffs, error) {
	if base == nil || actual == nil {
		return nil, fmt.Errorf("input configs should not be nil")
	}
	baseVal := reflect.Indirect(reflect.ValueOf(base))
	actualVal := reflect.Indirect(reflect.ValueOf(actual))
	return diff(baseVal, actualVal, "")
}

func (cd ConfigDiffs) String() string {
	return fmt.Sprintf("%+v", []ConfigDiff(cd))
}
