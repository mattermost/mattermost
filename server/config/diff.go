// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"maps"
	"reflect"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
)

type ConfigDiffs []ConfigDiff

type ConfigDiff struct {
	Path      string `json:"path"`
	BaseVal   any    `json:"base_val"`
	ActualVal any    `json:"actual_val"`
}

func (c *ConfigDiff) Auditable() map[string]any {
	return map[string]any{
		"path":       c.Path,
		"base_val":   c.BaseVal,
		"actual_val": c.ActualVal,
	}
}

func (cd *ConfigDiffs) Auditable() map[string]any {
	var s []any
	for _, d := range cd.Sanitize() {
		s = append(s, d.Auditable())
	}
	return map[string]any{
		"config_diffs": s,
	}
}

var configSensitivePaths = map[string]bool{
	"LdapSettings.BindPassword":                              true,
	"FileSettings.PublicLinkSalt":                            true,
	"FileSettings.AmazonS3SecretAccessKey":                   true,
	"FileSettings.AzureAccessKey":                            true,
	"FileSettings.ExportAzureAccessKey":                      true,
	"SqlSettings.DataSource":                                 true,
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
	"ServiceSettings.SplitKey":                               true,
	"PluginSettings.Plugins":                                 true,
}

// Sanitize replaces sensitive config values in the diff with asterisks filled strings.
func (cd ConfigDiffs) Sanitize() ConfigDiffs {
	if len(cd) == 1 {
		// PluginSettings.Plugins gets sanitized anyway, so there is no need to use the plugin manifests here.
		var pluginManifests []*model.Manifest

		cfgPtr, ok := cd[0].BaseVal.(*model.Config)
		if ok {
			cfgPtr.Sanitize(pluginManifests, nil)
		}
		cfgPtr, ok = cd[0].ActualVal.(*model.Config)
		if ok {
			cfgPtr.Sanitize(pluginManifests, nil)
		}
		cfgVal, ok := cd[0].BaseVal.(model.Config)
		if ok {
			cfgVal.Sanitize(pluginManifests, nil)
		}
		cfgVal, ok = cd[0].ActualVal.(model.Config)
		if ok {
			cfgVal.Sanitize(pluginManifests, nil)
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

	if baseType.Kind() == reflect.Pointer {
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
		for i := range base.NumField() {
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

// SanitizedDiff returns the differences between base and actual, with the values that
// sanitize masks replaced. A setting whose change is entirely masked is still listed,
// with model.FakeSetting on both sides. A change to a map, such as PluginSettings.Plugins,
// is listed as a change to each key that changed. base and actual are not modified.
//
// Unlike ConfigDiffs.Sanitize, which masks a fixed list of settings for the audit log,
// including all plugin settings, it masks what sanitize masks, so that with the sanitizer
// of GET /config, which uses the plugin manifests, it hides the same values.
func SanitizedDiff(base, actual *model.Config, sanitize func(*model.Config)) (ConfigDiffs, error) {
	diffs, err := Diff(base, actual)
	if err != nil || len(diffs) == 0 {
		return diffs, err
	}
	diffs = expandMapDiffs(diffs)

	sanitizedBase := base.Clone()
	sanitize(sanitizedBase)
	sanitizedActual := actual.Clone()
	sanitize(sanitizedActual)
	sanitizedDiffs, err := Diff(sanitizedBase, sanitizedActual)
	if err != nil {
		return nil, err
	}

	visible := make(map[string]ConfigDiff, len(sanitizedDiffs))
	for _, d := range expandMapDiffs(sanitizedDiffs) {
		visible[d.Path] = d
	}

	for i, d := range diffs {
		if v, ok := visible[d.Path]; ok {
			diffs[i] = v
			continue
		}
		diffs[i].BaseVal = model.FakeSetting
		diffs[i].ActualVal = model.FakeSetting
	}

	return diffs, nil
}

// expandMapDiffs replaces each change to a map keyed by strings with a change to each of
// its keys that changed, recursively.
func expandMapDiffs(diffs ConfigDiffs) ConfigDiffs {
	expanded := make(ConfigDiffs, 0, len(diffs))
	for _, d := range diffs {
		expanded = append(expanded, expandMapDiff(d)...)
	}
	return expanded
}

func expandMapDiff(d ConfigDiff) ConfigDiffs {
	base := reflect.ValueOf(d.BaseVal)
	actual := reflect.ValueOf(d.ActualVal)
	// A map added to or removed from another map has no value on the other side.
	if !base.IsValid() && isStringKeyedMap(actual) {
		base = reflect.Zero(actual.Type())
	}
	if !actual.IsValid() && isStringKeyedMap(base) {
		actual = reflect.Zero(base.Type())
	}
	if !isStringKeyedMap(base) || !isStringKeyedMap(actual) {
		return ConfigDiffs{d}
	}

	keys := make(map[string]bool, base.Len()+actual.Len())
	for _, k := range base.MapKeys() {
		keys[k.String()] = true
	}
	for _, k := range actual.MapKeys() {
		keys[k.String()] = true
	}

	var expanded ConfigDiffs
	for _, key := range slices.Sorted(maps.Keys(keys)) {
		baseVal := mapValue(base, key)
		actualVal := mapValue(actual, key)
		if reflect.DeepEqual(baseVal, actualVal) {
			continue
		}
		expanded = append(expanded, expandMapDiff(ConfigDiff{Path: d.Path + "." + key, BaseVal: baseVal, ActualVal: actualVal})...)
	}
	return expanded
}

func isStringKeyedMap(v reflect.Value) bool {
	return v.Kind() == reflect.Map && v.Type().Key().Kind() == reflect.String
}

// mapValue returns the value of key in m, or nil if m has no such key.
func mapValue(m reflect.Value, key string) any {
	v := m.MapIndex(reflect.ValueOf(key).Convert(m.Type().Key()))
	if !v.IsValid() {
		return nil
	}
	return v.Interface()
}

// ToConfigChanges converts the diffs to their API representation.
func (cd ConfigDiffs) ToConfigChanges() []*model.ConfigChange {
	changes := make([]*model.ConfigChange, len(cd))
	for i, d := range cd {
		changes[i] = &model.ConfigChange{
			Path:     d.Path,
			OldValue: d.BaseVal,
			NewValue: d.ActualVal,
		}
	}
	return changes
}

func (cd ConfigDiffs) String() string {
	return fmt.Sprintf("%+v", []ConfigDiff(cd))
}
