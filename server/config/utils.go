// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/mail"
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

// Desanitize replaces fake settings with their actual values. Safe to call on
// partial configs: every pointer dereference is nil-guarded so callers do not
// need to run SetDefaults() first.
func Desanitize(actual, target *model.Config) {
	if target.LdapSettings.BindPassword != nil && *target.LdapSettings.BindPassword == model.FakeSetting && actual.LdapSettings.BindPassword != nil {
		*target.LdapSettings.BindPassword = *actual.LdapSettings.BindPassword
	}

	if target.FileSettings.PublicLinkSalt != nil && *target.FileSettings.PublicLinkSalt == model.FakeSetting && actual.FileSettings.PublicLinkSalt != nil {
		*target.FileSettings.PublicLinkSalt = *actual.FileSettings.PublicLinkSalt
	}
	if target.FileSettings.AmazonS3SecretAccessKey != nil && *target.FileSettings.AmazonS3SecretAccessKey == model.FakeSetting && actual.FileSettings.AmazonS3SecretAccessKey != nil {
		target.FileSettings.AmazonS3SecretAccessKey = actual.FileSettings.AmazonS3SecretAccessKey
	}
	if target.FileSettings.ExportAmazonS3SecretAccessKey != nil && *target.FileSettings.ExportAmazonS3SecretAccessKey == model.FakeSetting && actual.FileSettings.ExportAmazonS3SecretAccessKey != nil {
		target.FileSettings.ExportAmazonS3SecretAccessKey = actual.FileSettings.ExportAmazonS3SecretAccessKey
	}
	if target.FileSettings.AzureAccessKey != nil && *target.FileSettings.AzureAccessKey == model.FakeSetting && actual.FileSettings.AzureAccessKey != nil {
		target.FileSettings.AzureAccessKey = actual.FileSettings.AzureAccessKey
	}
	if target.FileSettings.ExportAzureAccessKey != nil && *target.FileSettings.ExportAzureAccessKey == model.FakeSetting && actual.FileSettings.ExportAzureAccessKey != nil {
		target.FileSettings.ExportAzureAccessKey = actual.FileSettings.ExportAzureAccessKey
	}

	if target.EmailSettings.SMTPPassword != nil && *target.EmailSettings.SMTPPassword == model.FakeSetting {
		target.EmailSettings.SMTPPassword = actual.EmailSettings.SMTPPassword
	}

	if target.GitLabSettings.Secret != nil && *target.GitLabSettings.Secret == model.FakeSetting {
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

	if target.SqlSettings.DataSource != nil && *target.SqlSettings.DataSource == model.FakeSetting && actual.SqlSettings.DataSource != nil {
		*target.SqlSettings.DataSource = *actual.SqlSettings.DataSource
	}

	if target.ElasticsearchSettings.Password != nil && *target.ElasticsearchSettings.Password == model.FakeSetting && actual.ElasticsearchSettings.Password != nil {
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

	if target.MessageExportSettings.GlobalRelaySettings != nil &&
		target.MessageExportSettings.GlobalRelaySettings.SMTPPassword != nil &&
		*target.MessageExportSettings.GlobalRelaySettings.SMTPPassword == model.FakeSetting &&
		actual.MessageExportSettings.GlobalRelaySettings != nil &&
		actual.MessageExportSettings.GlobalRelaySettings.SMTPPassword != nil {
		*target.MessageExportSettings.GlobalRelaySettings.SMTPPassword = *actual.MessageExportSettings.GlobalRelaySettings.SMTPPassword
	}

	if target.ServiceSettings.SplitKey != nil && *target.ServiceSettings.SplitKey == model.FakeSetting && actual.ServiceSettings.SplitKey != nil {
		*target.ServiceSettings.SplitKey = *actual.ServiceSettings.SplitKey
	}

	if target.ServiceSettings.GoogleDeveloperKey != nil && *target.ServiceSettings.GoogleDeveloperKey == model.FakeSetting {
		target.ServiceSettings.GoogleDeveloperKey = actual.ServiceSettings.GoogleDeveloperKey
	}

	if target.ServiceSettings.GiphySdkKey != nil && *target.ServiceSettings.GiphySdkKey == model.FakeSetting {
		target.ServiceSettings.GiphySdkKey = actual.ServiceSettings.GiphySdkKey
	}

	if target.CacheSettings.RedisPassword != nil && *target.CacheSettings.RedisPassword == model.FakeSetting {
		target.CacheSettings.RedisPassword = actual.CacheSettings.RedisPassword
	}

	if target.AutoTranslationSettings.LibreTranslate != nil &&
		target.AutoTranslationSettings.LibreTranslate.APIKey != nil &&
		*target.AutoTranslationSettings.LibreTranslate.APIKey == model.FakeSetting {
		target.AutoTranslationSettings.LibreTranslate.APIKey = actual.AutoTranslationSettings.LibreTranslate.APIKey
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
	fixLegacyImageProxyType(cfg)
	fixRetiredFeatureFlags(cfg)
	fixTLSMinVer(cfg)
	fixWebserverMode(cfg)
	fixEmailAddressDisplayNames(cfg)
	fixOutOfRangeNumericSettings(cfg)
}

// fixOutOfRangeNumericSettings resets numeric settings that v12 began range-checking to
// their defaults when they hold a value earlier versions accepted but v12 rejects.
func fixOutOfRangeNumericSettings(cfg *model.Config) bool {
	defaults := &model.Config{}
	defaults.SetDefaults()

	var changed bool
	resetInt := func(setting string, value, defaultValue *int, minimum int) {
		changed = resetBelowMinimum(setting, value, *defaultValue, minimum) || changed
	}
	resetInt64 := func(setting string, value, defaultValue *int64, minimum int64) {
		changed = resetBelowMinimum(setting, value, *defaultValue, minimum) || changed
	}

	s, d := &cfg.ServiceSettings, &defaults.ServiceSettings
	resetInt64("ServiceSettings.TLSStrictTransportMaxAge", s.TLSStrictTransportMaxAge, d.TLSStrictTransportMaxAge, 0)
	resetInt("ServiceSettings.IdleTimeout", s.IdleTimeout, d.IdleTimeout, 1)
	resetInt("ServiceSettings.SessionLengthMobileInDays", s.SessionLengthMobileInDays, d.SessionLengthMobileInDays, 1)
	resetInt("ServiceSettings.SessionLengthMobileInHours", s.SessionLengthMobileInHours, d.SessionLengthMobileInHours, 1)
	resetInt("ServiceSettings.SessionLengthSSOInDays", s.SessionLengthSSOInDays, d.SessionLengthSSOInDays, 1)
	resetInt("ServiceSettings.SessionLengthSSOInHours", s.SessionLengthSSOInHours, d.SessionLengthSSOInHours, 1)
	resetInt("ServiceSettings.SessionCacheInMinutes", s.SessionCacheInMinutes, d.SessionCacheInMinutes, 1)
	resetInt("ServiceSettings.SessionIdleTimeoutInMinutes", s.SessionIdleTimeoutInMinutes, d.SessionIdleTimeoutInMinutes, 0)
	resetInt("ServiceSettings.MinimumHashtagLength", s.MinimumHashtagLength, d.MinimumHashtagLength, 1)
	resetInt("ServiceSettings.ClusterLogTimeoutMilliseconds", s.ClusterLogTimeoutMilliseconds, d.ClusterLogTimeoutMilliseconds, 1)
	resetInt("ServiceSettings.AWSMeteringTimeoutSeconds", s.AWSMeteringTimeoutSeconds, d.AWSMeteringTimeoutSeconds, 1)
	resetInt("ServiceSettings.FeatureFlagSyncIntervalSeconds", s.FeatureFlagSyncIntervalSeconds, d.FeatureFlagSyncIntervalSeconds, 1)
	resetInt("ServiceSettings.BurnOnReadDurationSeconds", s.BurnOnReadDurationSeconds, d.BurnOnReadDurationSeconds, 1)
	resetInt("ServiceSettings.BurnOnReadMaximumTimeToLiveSeconds", s.BurnOnReadMaximumTimeToLiveSeconds, d.BurnOnReadMaximumTimeToLiveSeconds, 1)
	resetInt("ServiceSettings.BurnOnReadSchedulerFrequencySeconds", s.BurnOnReadSchedulerFrequencySeconds, d.BurnOnReadSchedulerFrequencySeconds, 1)

	resetInt("LogSettings.MaxFieldSize", cfg.LogSettings.MaxFieldSize, defaults.LogSettings.MaxFieldSize, 0)
	resetInt("SupportSettings.CustomTermsOfServiceReAcceptancePeriod", cfg.SupportSettings.CustomTermsOfServiceReAcceptancePeriod, defaults.SupportSettings.CustomTermsOfServiceReAcceptancePeriod, 0)
	resetInt("AnnouncementSettings.NoticesFetchFrequency", cfg.AnnouncementSettings.NoticesFetchFrequency, defaults.AnnouncementSettings.NoticesFetchFrequency, 1)
	resetInt("EmailSettings.PushNotificationBuffer", cfg.EmailSettings.PushNotificationBuffer, defaults.EmailSettings.PushNotificationBuffer, 1)
	resetInt("LdapSettings.QueryTimeout", cfg.LdapSettings.QueryTimeout, defaults.LdapSettings.QueryTimeout, 1)

	cw, dcw := &cfg.ConnectedWorkspacesSettings, &defaults.ConnectedWorkspacesSettings
	resetInt("ConnectedWorkspacesSettings.GlobalUserSyncBatchSize", cw.GlobalUserSyncBatchSize, dcw.GlobalUserSyncBatchSize, 1)
	resetInt("ConnectedWorkspacesSettings.MaxPostsPerSync", cw.MaxPostsPerSync, dcw.MaxPostsPerSync, 1)
	resetInt("ConnectedWorkspacesSettings.MemberSyncBatchSize", cw.MemberSyncBatchSize, dcw.MemberSyncBatchSize, 1)

	resetInt("SqlSettings.MigrationsStatementTimeoutSeconds", cfg.SqlSettings.MigrationsStatementTimeoutSeconds, defaults.SqlSettings.MigrationsStatementTimeoutSeconds, 0)
	resetInt("SqlSettings.ReplicaMonitorIntervalSeconds", cfg.SqlSettings.ReplicaMonitorIntervalSeconds, defaults.SqlSettings.ReplicaMonitorIntervalSeconds, 1)

	f, df := &cfg.FileSettings, &defaults.FileSettings
	resetInt64("FileSettings.MaxImageResolution", f.MaxImageResolution, df.MaxImageResolution, 1)
	resetInt64("FileSettings.AmazonS3UploadPartSizeBytes", f.AmazonS3UploadPartSizeBytes, df.AmazonS3UploadPartSizeBytes, model.FileSettingsDefaultS3UploadPartSizeBytes)
	resetInt64("FileSettings.ExportAmazonS3UploadPartSizeBytes", f.ExportAmazonS3UploadPartSizeBytes, df.ExportAmazonS3UploadPartSizeBytes, model.FileSettingsDefaultS3UploadPartSizeBytes)

	es, des := &cfg.ElasticsearchSettings, &defaults.ElasticsearchSettings
	resetInt("ElasticsearchSettings.PostIndexShards", es.PostIndexShards, des.PostIndexShards, 1)
	resetInt("ElasticsearchSettings.ChannelIndexShards", es.ChannelIndexShards, des.ChannelIndexShards, 1)
	resetInt("ElasticsearchSettings.UserIndexShards", es.UserIndexShards, des.UserIndexShards, 1)
	resetInt("ElasticsearchSettings.PostIndexReplicas", es.PostIndexReplicas, des.PostIndexReplicas, 0)
	resetInt("ElasticsearchSettings.ChannelIndexReplicas", es.ChannelIndexReplicas, des.ChannelIndexReplicas, 0)
	resetInt("ElasticsearchSettings.UserIndexReplicas", es.UserIndexReplicas, des.UserIndexReplicas, 0)

	dr, ddr := &cfg.DataRetentionSettings, &defaults.DataRetentionSettings
	resetInt("DataRetentionSettings.BatchSize", dr.BatchSize, ddr.BatchSize, 1)
	resetInt("DataRetentionSettings.TimeBetweenBatchesMilliseconds", dr.TimeBetweenBatchesMilliseconds, ddr.TimeBetweenBatchesMilliseconds, 0)
	resetInt("DataRetentionSettings.RetentionIdsBatchSize", dr.RetentionIdsBatchSize, ddr.RetentionIdsBatchSize, 1)

	return changed
}

func resetBelowMinimum[T int | int64](setting string, value *T, defaultValue, minimum T) bool {
	if *value >= minimum {
		return false
	}

	mlog.Warn("Setting is out of range. Resetting it to the default value.", mlog.String("setting", setting), mlog.Int("value", *value), mlog.Int("default", defaultValue))
	*value = defaultValue
	return true
}

// fixEmailAddressDisplayNames reduces email settings written as "Name <user@example.com>"
// to the bare address, which is the only form v12 accepts. Values that do not parse as an
// address are left for validation to reject.
func fixEmailAddressDisplayNames(cfg *model.Config) bool {
	var changed bool

	for _, setting := range []struct {
		name  string
		value *string
	}{
		{"SupportSettings.SupportEmail", cfg.SupportSettings.SupportEmail},
		{"EmailSettings.FeedbackEmail", cfg.EmailSettings.FeedbackEmail},
		{"EmailSettings.ReplyToAddress", cfg.EmailSettings.ReplyToAddress},
	} {
		if *setting.value == "" {
			continue
		}

		addr, err := mail.ParseAddress(*setting.value)
		if err != nil || addr.Address == *setting.value {
			continue
		}

		mlog.Warn("Email setting must be a plain email address. Removing the display name.", mlog.String("setting", setting.name), mlog.String("value", *setting.value), mlog.String("address", addr.Address))
		*setting.value = addr.Address
		changed = true
	}

	return changed
}

// fixWebserverMode replaces an unrecognized webserver mode with nogzip, which servers
// before v12 silently used for any value other than gzip or disabled.
func fixWebserverMode(cfg *model.Config) bool {
	switch *cfg.ServiceSettings.WebserverMode {
	case "gzip", "nogzip", "disabled":
		return false
	}

	mlog.Warn("ServiceSettings.WebserverMode is not a supported mode. Setting WebserverMode to nogzip.", mlog.String("webserver_mode", *cfg.ServiceSettings.WebserverMode))
	*cfg.ServiceSettings.WebserverMode = "nogzip"
	return true
}

// fixTLSMinVer replaces an unrecognized TLS minimum version with 1.2, which servers
// before v12 silently used for any value other than 1.0 or 1.1.
func fixTLSMinVer(cfg *model.Config) bool {
	switch *cfg.ServiceSettings.TLSMinVer {
	case "1.0", "1.1", "1.2", "1.3":
		return false
	}

	mlog.Warn("ServiceSettings.TLSMinVer is not a supported TLS version. Setting TLSMinVer to 1.2.", mlog.String("tls_min_ver", *cfg.ServiceSettings.TLSMinVer))
	*cfg.ServiceSettings.TLSMinVer = "1.2"
	return true
}

// fixRetiredFeatureFlags forces off feature flags whose features have been removed.
func fixRetiredFeatureFlags(cfg *model.Config) bool {
	if cfg.FeatureFlags == nil {
		return false
	}

	var changed bool

	if cfg.FeatureFlags.AppsEnabled {
		mlog.Warn("The AppsEnabled feature flag is no longer supported. Setting AppsEnabled to false.")
		cfg.FeatureFlags.AppsEnabled = false
		changed = true
	}

	if cfg.FeatureFlags.MoveThreadsEnabled {
		mlog.Warn("The MoveThreadsEnabled feature flag is no longer supported. Setting MoveThreadsEnabled to false.")
		cfg.FeatureFlags.MoveThreadsEnabled = false
		changed = true
	}

	return changed
}

// fixLegacyImageProxyType migrates the removed atmos/camo image proxy type to local.
func fixLegacyImageProxyType(cfg *model.Config) bool {
	if *cfg.ImageProxySettings.ImageProxyType != model.ImageProxyTypeLegacyAtmosCamo {
		return false
	}

	mlog.Warn("The atmos/camo image proxy type is no longer supported. Setting ImageProxyType to local.")
	*cfg.ImageProxySettings.ImageProxyType = model.ImageProxyTypeLocal
	return true
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
		for word := range strings.SplitSeq(*cfg.LocalizationSettings.AvailableLocales, ",") {
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
	return strings.HasPrefix(dsn, "postgres://") ||
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
				if mapVal.Kind() == reflect.Pointer {
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
