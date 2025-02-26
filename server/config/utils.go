// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// marshalConfig converts the given configuration into JSON bytes for persistence.
func marshalConfig(cfg *model.Config) ([]byte, error) {
	return json.MarshalIndent(cfg, "", "    ")
}

// desanitize replaces fake settings with their actual values.
func desanitize(actual, target *model.Config) {
	if target.LdapSettings.BindPassword != nil && *target.LdapSettings.BindPassword == model.FakeSetting {
		*target.LdapSettings.BindPassword = *actual.LdapSettings.BindPassword
	}

	if *target.FileSettings.PublicLinkSalt == model.FakeSetting {
		*target.FileSettings.PublicLinkSalt = *actual.FileSettings.PublicLinkSalt
	}
	if *target.FileSettings.AmazonS3SecretAccessKey == model.FakeSetting {
		target.FileSettings.AmazonS3SecretAccessKey = actual.FileSettings.AmazonS3SecretAccessKey
	}

	if *target.EmailSettings.SMTPPassword == model.FakeSetting {
		target.EmailSettings.SMTPPassword = actual.EmailSettings.SMTPPassword
	}

	if *target.GitLabSettings.Secret == model.FakeSetting {
		target.GitLabSettings.Secret = actual.GitLabSettings.Secret
	}

	if target.GoogleSettings.Secret != nil && *target.GoogleSettings.Secret == model.FakeSetting {
		target.GoogleSettings.Secret = actual.GoogleSettings.Secret
	}

	if target.Office365Settings.Secret != nil && *target.Office365Settings.Secret == model.FakeSetting {
		target.Office365Settings.Secret = actual.Office365Settings.Secret
	}

	if target.OpenIdSettings.Secret != nil && *target.OpenIdSettings.Secret == model.FakeSetting {
		target.OpenIdSettings.Secret = actual.OpenIdSettings.Secret
	}

	if *target.SqlSettings.DataSource == model.FakeSetting {
		*target.SqlSettings.DataSource = *actual.SqlSettings.DataSource
	}
	if *target.SqlSettings.AtRestEncryptKey == model.FakeSetting {
		target.SqlSettings.AtRestEncryptKey = actual.SqlSettings.AtRestEncryptKey
	}

	if *target.ElasticsearchSettings.Password == model.FakeSetting {
		*target.ElasticsearchSettings.Password = *actual.ElasticsearchSettings.Password
	}

	if len(target.SqlSettings.DataSourceReplicas) == len(actual.SqlSettings.DataSourceReplicas) {
		for i, value := range target.SqlSettings.DataSourceReplicas {
			if value == model.FakeSetting {
				target.SqlSettings.DataSourceReplicas[i] = actual.SqlSettings.DataSourceReplicas[i]
			}
		}
	}

	if len(target.SqlSettings.DataSourceSearchReplicas) == len(actual.SqlSettings.DataSourceSearchReplicas) {
		for i, value := range target.SqlSettings.DataSourceSearchReplicas {
			if value == model.FakeSetting {
				target.SqlSettings.DataSourceSearchReplicas[i] = actual.SqlSettings.DataSourceSearchReplicas[i]
			}
		}
	}

	if *target.MessageExportSettings.GlobalRelaySettings.SMTPPassword == model.FakeSetting {
		*target.MessageExportSettings.GlobalRelaySettings.SMTPPassword = *actual.MessageExportSettings.GlobalRelaySettings.SMTPPassword
	}

	if *target.ServiceSettings.SplitKey == model.FakeSetting {
		*target.ServiceSettings.SplitKey = *actual.ServiceSettings.SplitKey
	}

	for id, settings := range target.PluginSettings.Plugins {
		for k, v := range settings {
			if v == model.FakeSetting {
				settings[k] = actual.PluginSettings.Plugins[id][k]
			}
		}
	}
}

// fixConfig patches invalid or missing data in the configuration.
func fixConfig(cfg *model.Config) {
	// Ensure SiteURL has no trailing slash.
	if strings.HasSuffix(*cfg.ServiceSettings.SiteURL, "/") {
		*cfg.ServiceSettings.SiteURL = strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
	}

	// Ensure the directory for a local file store has a trailing slash.
	if *cfg.FileSettings.DriverName == model.ImageDriverLocal {
		if *cfg.FileSettings.Directory != "" && !strings.HasSuffix(*cfg.FileSettings.Directory, "/") {
			*cfg.FileSettings.Directory += "/"
		}
	}

	fixInvalidLocales(cfg)
}

// fixInvalidLocales checks and corrects the given config for invalid locale-related settings.
func fixInvalidLocales(cfg *model.Config) bool {
	var changed bool

	locales := i18n.GetSupportedLocales()
	if _, ok := locales[*cfg.LocalizationSettings.DefaultServerLocale]; !ok {
		mlog.Warn("DefaultServerLocale must be one of the supported locales. Setting DefaultServerLocale to en as default value.", mlog.String("locale", *cfg.LocalizationSettings.DefaultServerLocale))
		*cfg.LocalizationSettings.DefaultServerLocale = model.DefaultLocale
		changed = true
	}

	if _, ok := locales[*cfg.LocalizationSettings.DefaultClientLocale]; !ok {
		mlog.Warn("DefaultClientLocale must be one of the supported locales. Setting DefaultClientLocale to en as default value.", mlog.String("locale", *cfg.LocalizationSettings.DefaultClientLocale))
		*cfg.LocalizationSettings.DefaultClientLocale = model.DefaultLocale
		changed = true
	}

	if *cfg.LocalizationSettings.AvailableLocales != "" {
		isDefaultClientLocaleInAvailableLocales := false
		for _, word := range strings.Split(*cfg.LocalizationSettings.AvailableLocales, ",") {
			if _, ok := locales[word]; !ok {
				*cfg.LocalizationSettings.AvailableLocales = ""
				isDefaultClientLocaleInAvailableLocales = true
				mlog.Warn("AvailableLocales must include DefaultClientLocale. Setting AvailableLocales to all locales as default value.")
				changed = true
				break
			}

			if word == *cfg.LocalizationSettings.DefaultClientLocale {
				isDefaultClientLocaleInAvailableLocales = true
			}
		}

		availableLocales := *cfg.LocalizationSettings.AvailableLocales

		if !isDefaultClientLocaleInAvailableLocales {
			availableLocales += "," + *cfg.LocalizationSettings.DefaultClientLocale
			mlog.Warn("Adding DefaultClientLocale to AvailableLocales.")
			changed = true
		}

		*cfg.LocalizationSettings.AvailableLocales = strings.Join(utils.RemoveDuplicatesFromStringArray(strings.Split(availableLocales, ",")), ",")
	}

	return changed
}

// Merge merges two configs together. The receiver's values are overwritten with the patch's
// values except when the patch's values are nil.
func Merge(cfg *model.Config, patch *model.Config, mergeConfig *utils.MergeConfig) (*model.Config, error) {
	return utils.Merge(cfg, patch, mergeConfig)
}

func IsDatabaseDSN(dsn string) bool {
	return strings.HasPrefix(dsn, "mysql://") ||
		strings.HasPrefix(dsn, "postgres://") ||
		strings.HasPrefix(dsn, "postgresql://")
}

func isJSONMap(data []byte) bool {
	var m map[string]any
	err := json.Unmarshal(data, &m)
	return err == nil
}

func GetValueByPath(path []string, obj any) (any, bool) {
	r := reflect.ValueOf(obj)
	var val reflect.Value
	if r.Kind() == reflect.Map {
		val = r.MapIndex(reflect.ValueOf(path[0]))
		if val.IsValid() {
			val = val.Elem()
		}
	} else {
		val = r.FieldByName(path[0])
	}

	if !val.IsValid() {
		return nil, false
	}

	switch {
	case len(path) == 1:
		return val.Interface(), true
	case val.Kind() == reflect.Struct:
		return GetValueByPath(path[1:], val.Interface())
	case val.Kind() == reflect.Map:
		remainingPath := strings.Join(path[1:], ".")
		mapIter := val.MapRange()
		for mapIter.Next() {
			key := mapIter.Key().String()
			if strings.HasPrefix(remainingPath, key) {
				i := strings.Count(key, ".") + 2 // number of dots + a dot on each side
				mapVal := mapIter.Value()
				// if no sub field path specified, return the object
				if len(path[i:]) == 0 {
					return mapVal.Interface(), true
				}
				data := mapVal.Interface()
				if mapVal.Kind() == reflect.Ptr {
					data = mapVal.Elem().Interface() // if value is a pointer, dereference it
				}
				// pass subpath
				return GetValueByPath(path[i:], data)
			}
		}
	}
	return nil, false
}

func equal(oldCfg, newCfg *model.Config) (bool, error) {
	oldCfgBytes, err := json.Marshal(oldCfg)
	if err != nil {
		return false, fmt.Errorf("failed to marshal old config: %w", err)
	}
	newCfgBytes, err := json.Marshal(newCfg)
	if err != nil {
		return false, fmt.Errorf("failed to marshal new config: %w", err)
	}
	return !bytes.Equal(oldCfgBytes, newCfgBytes), nil
}
