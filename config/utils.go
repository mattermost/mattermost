// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"reflect"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

// desanitize replaces fake settings with their actual values.
func desanitize(actual, target *model.Config) {
	if target.LdapSettings.BindPassword != nil && *target.LdapSettings.BindPassword == model.FAKE_SETTING {
		*target.LdapSettings.BindPassword = *actual.LdapSettings.BindPassword
	}

	if *target.FileSettings.PublicLinkSalt == model.FAKE_SETTING {
		*target.FileSettings.PublicLinkSalt = *actual.FileSettings.PublicLinkSalt
	}
	if *target.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
		target.FileSettings.AmazonS3SecretAccessKey = actual.FileSettings.AmazonS3SecretAccessKey
	}

	if *target.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		target.EmailSettings.SMTPPassword = actual.EmailSettings.SMTPPassword
	}

	if *target.GitLabSettings.Secret == model.FAKE_SETTING {
		target.GitLabSettings.Secret = actual.GitLabSettings.Secret
	}

	if target.GoogleSettings.Secret != nil && *target.GoogleSettings.Secret == model.FAKE_SETTING {
		target.GoogleSettings.Secret = actual.GoogleSettings.Secret
	}

	if target.Office365Settings.Secret != nil && *target.Office365Settings.Secret == model.FAKE_SETTING {
		target.Office365Settings.Secret = actual.Office365Settings.Secret
	}

	if *target.SqlSettings.DataSource == model.FAKE_SETTING {
		*target.SqlSettings.DataSource = *actual.SqlSettings.DataSource
	}
	if *target.SqlSettings.AtRestEncryptKey == model.FAKE_SETTING {
		target.SqlSettings.AtRestEncryptKey = actual.SqlSettings.AtRestEncryptKey
	}

	if *target.ElasticsearchSettings.Password == model.FAKE_SETTING {
		*target.ElasticsearchSettings.Password = *actual.ElasticsearchSettings.Password
	}

	if len(target.SqlSettings.DataSourceReplicas) == len(actual.SqlSettings.DataSourceReplicas) {
		for i, value := range target.SqlSettings.DataSourceReplicas {
			if value == model.FAKE_SETTING {
				target.SqlSettings.DataSourceReplicas[i] = actual.SqlSettings.DataSourceReplicas[i]
			}
		}
	}

	if len(target.SqlSettings.DataSourceSearchReplicas) == len(actual.SqlSettings.DataSourceSearchReplicas) {
		for i, value := range target.SqlSettings.DataSourceSearchReplicas {
			if value == model.FAKE_SETTING {
				target.SqlSettings.DataSourceSearchReplicas[i] = actual.SqlSettings.DataSourceSearchReplicas[i]
			}
		}
	}

	if *target.MessageExportSettings.GlobalRelaySettings.SmtpPassword == model.FAKE_SETTING {
		*target.MessageExportSettings.GlobalRelaySettings.SmtpPassword = *actual.MessageExportSettings.GlobalRelaySettings.SmtpPassword
	}

	if target.ServiceSettings.GfycatApiSecret != nil && *target.ServiceSettings.GfycatApiSecret == model.FAKE_SETTING {
		*target.ServiceSettings.GfycatApiSecret = *actual.ServiceSettings.GfycatApiSecret
	}

	if *target.ServiceSettings.SplitKey == model.FAKE_SETTING {
		*target.ServiceSettings.SplitKey = *actual.ServiceSettings.SplitKey
	}
}

// fixConfig patches invalid or missing data in the configuration, returning true if changed.
func fixConfig(cfg *model.Config) bool {
	changed := false

	// Ensure SiteURL has no trailing slash.
	if strings.HasSuffix(*cfg.ServiceSettings.SiteURL, "/") {
		*cfg.ServiceSettings.SiteURL = strings.TrimRight(*cfg.ServiceSettings.SiteURL, "/")
		changed = true
	}

	// Ensure the directory for a local file store has a trailing slash.
	if *cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if *cfg.FileSettings.Directory != "" && !strings.HasSuffix(*cfg.FileSettings.Directory, "/") {
			*cfg.FileSettings.Directory += "/"
			changed = true
		}
	}

	if FixInvalidLocales(cfg) {
		changed = true
	}

	return changed
}

// FixInvalidLocales checks and corrects the given config for invalid locale-related settings.
//
// Ideally, this function would be completely internal, but it's currently exposed to allow the cli
// to test the config change before allowing the save.
func FixInvalidLocales(cfg *model.Config) bool {
	var changed bool

	locales := utils.GetSupportedLocales()
	if _, ok := locales[*cfg.LocalizationSettings.DefaultServerLocale]; !ok {
		*cfg.LocalizationSettings.DefaultServerLocale = model.DEFAULT_LOCALE
		mlog.Warn("DefaultServerLocale must be one of the supported locales. Setting DefaultServerLocale to en as default value.")
		changed = true
	}

	if _, ok := locales[*cfg.LocalizationSettings.DefaultClientLocale]; !ok {
		*cfg.LocalizationSettings.DefaultClientLocale = model.DEFAULT_LOCALE
		mlog.Warn("DefaultClientLocale must be one of the supported locales. Setting DefaultClientLocale to en as default value.")
		changed = true
	}

	if len(*cfg.LocalizationSettings.AvailableLocales) > 0 {
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
	ret, err := utils.Merge(cfg, patch, mergeConfig)
	if err != nil {
		return nil, err
	}

	retCfg := ret.(model.Config)
	return &retCfg, nil
}

// stripPassword remove the password from a given DSN
func stripPassword(dsn, schema string) string {
	prefix := schema + "://"
	dsn = strings.TrimPrefix(dsn, prefix)

	i := strings.Index(dsn, ":")
	j := strings.LastIndex(dsn, "@")

	// Return error if no @ sign is found
	if j < 0 {
		return "(omitted due to error parsing the DSN)"
	}

	// Return back the input if no password is found
	if i < 0 || i > j {
		return prefix + dsn
	}

	return prefix + dsn[:i+1] + dsn[j:]
}

func IsJsonMap(data string) bool {
	var m map[string]interface{}
	return json.Unmarshal([]byte(data), &m) == nil
}

func JSONToLogTargetCfg(data []byte) (mlog.LogTargetCfg, error) {
	cfg := make(mlog.LogTargetCfg)
	err := json.Unmarshal(data, &cfg)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func GetValueByPath(path []string, obj interface{}) (interface{}, bool) {
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
