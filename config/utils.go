// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
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

	if *target.SqlSettings.DataSource == model.FAKE_SETTING {
		*target.SqlSettings.DataSource = *actual.SqlSettings.DataSource
	}
	if *target.SqlSettings.AtRestEncryptKey == model.FAKE_SETTING {
		target.SqlSettings.AtRestEncryptKey = actual.SqlSettings.AtRestEncryptKey
	}

	if *target.ElasticsearchSettings.Password == model.FAKE_SETTING {
		*target.ElasticsearchSettings.Password = *actual.ElasticsearchSettings.Password
	}

	target.SqlSettings.DataSourceReplicas = make([]string, len(actual.SqlSettings.DataSourceReplicas))
	for i := range target.SqlSettings.DataSourceReplicas {
		target.SqlSettings.DataSourceReplicas[i] = actual.SqlSettings.DataSourceReplicas[i]
	}

	target.SqlSettings.DataSourceSearchReplicas = make([]string, len(actual.SqlSettings.DataSourceSearchReplicas))
	for i := range target.SqlSettings.DataSourceSearchReplicas {
		target.SqlSettings.DataSourceSearchReplicas[i] = actual.SqlSettings.DataSourceSearchReplicas[i]
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
		if !strings.HasSuffix(*cfg.FileSettings.Directory, "/") {
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
