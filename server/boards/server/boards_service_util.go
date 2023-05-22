// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"math"
	"path"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/boards/services/config"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
)

const defaultS3Timeout = 60 * 1000 // 60 seconds

func CreateBoardsConfig(mmconfig mm_model.Config, baseURL string, serverID string) *config.Configuration {
	filesS3Config := config.AmazonS3Config{}
	if mmconfig.FileSettings.AmazonS3AccessKeyId != nil {
		filesS3Config.AccessKeyID = *mmconfig.FileSettings.AmazonS3AccessKeyId
	}
	if mmconfig.FileSettings.AmazonS3SecretAccessKey != nil {
		filesS3Config.SecretAccessKey = *mmconfig.FileSettings.AmazonS3SecretAccessKey
	}
	if mmconfig.FileSettings.AmazonS3Bucket != nil {
		filesS3Config.Bucket = *mmconfig.FileSettings.AmazonS3Bucket
	}
	if mmconfig.FileSettings.AmazonS3PathPrefix != nil {
		filesS3Config.PathPrefix = *mmconfig.FileSettings.AmazonS3PathPrefix
	}
	if mmconfig.FileSettings.AmazonS3Region != nil {
		filesS3Config.Region = *mmconfig.FileSettings.AmazonS3Region
	}
	if mmconfig.FileSettings.AmazonS3Endpoint != nil {
		filesS3Config.Endpoint = *mmconfig.FileSettings.AmazonS3Endpoint
	}
	if mmconfig.FileSettings.AmazonS3SSL != nil {
		filesS3Config.SSL = *mmconfig.FileSettings.AmazonS3SSL
	}
	if mmconfig.FileSettings.AmazonS3SignV2 != nil {
		filesS3Config.SignV2 = *mmconfig.FileSettings.AmazonS3SignV2
	}
	if mmconfig.FileSettings.AmazonS3SSE != nil {
		filesS3Config.SSE = *mmconfig.FileSettings.AmazonS3SSE
	}
	if mmconfig.FileSettings.AmazonS3Trace != nil {
		filesS3Config.Trace = *mmconfig.FileSettings.AmazonS3Trace
	}
	if mmconfig.FileSettings.AmazonS3RequestTimeoutMilliseconds != nil && *mmconfig.FileSettings.AmazonS3RequestTimeoutMilliseconds > 0 {
		filesS3Config.Timeout = *mmconfig.FileSettings.AmazonS3RequestTimeoutMilliseconds
	} else {
		filesS3Config.Timeout = defaultS3Timeout
	}

	enableTelemetry := false
	if mmconfig.LogSettings.EnableDiagnostics != nil {
		enableTelemetry = *mmconfig.LogSettings.EnableDiagnostics
	}

	enablePublicSharedBoards := false
	if mmconfig.ProductSettings.EnablePublicSharedBoards != nil {
		enablePublicSharedBoards = *mmconfig.ProductSettings.EnablePublicSharedBoards
	}

	enableBoardsDeletion := false
	if mmconfig.DataRetentionSettings.EnableBoardsDeletion != nil {
		enableBoardsDeletion = true
	}

	featureFlags := parseFeatureFlags(mmconfig.FeatureFlags.ToMap())

	showEmailAddress := false
	if mmconfig.PrivacySettings.ShowEmailAddress != nil {
		showEmailAddress = *mmconfig.PrivacySettings.ShowEmailAddress
	}

	showFullName := false
	if mmconfig.PrivacySettings.ShowFullName != nil {
		showFullName = *mmconfig.PrivacySettings.ShowFullName
	}

	return &config.Configuration{
		ServerRoot:               baseURL + "/boards",
		Port:                     -1,
		DBType:                   *mmconfig.SqlSettings.DriverName,
		DBConfigString:           *mmconfig.SqlSettings.DataSource,
		DBTablePrefix:            "focalboard_",
		UseSSL:                   false,
		SecureCookie:             true,
		WebPath:                  path.Join(*mmconfig.PluginSettings.Directory, "focalboard", "pack"),
		FilesDriver:              *mmconfig.FileSettings.DriverName,
		FilesPath:                *mmconfig.FileSettings.Directory,
		FilesS3Config:            filesS3Config,
		MaxFileSize:              *mmconfig.FileSettings.MaxFileSize,
		Telemetry:                enableTelemetry,
		TelemetryID:              serverID,
		WebhookUpdate:            []string{},
		SessionExpireTime:        2592000,
		SessionRefreshTime:       18000,
		LocalOnly:                false,
		EnableLocalMode:          false,
		LocalModeSocketLocation:  "",
		AuthMode:                 "mattermost",
		EnablePublicSharedBoards: enablePublicSharedBoards,
		FeatureFlags:             featureFlags,
		NotifyFreqCardSeconds:    getPluginSettingInt(mmconfig, notifyFreqCardSecondsKey, 120),
		NotifyFreqBoardSeconds:   getPluginSettingInt(mmconfig, notifyFreqBoardSecondsKey, 86400),
		EnableDataRetention:      enableBoardsDeletion,
		DataRetentionDays:        *mmconfig.DataRetentionSettings.BoardsRetentionDays,
		TeammateNameDisplay:      *mmconfig.TeamSettings.TeammateNameDisplay,
		ShowEmailAddress:         showEmailAddress,
		ShowFullName:             showFullName,
	}
}

func getPluginSetting(mmConfig mm_model.Config, key string) (interface{}, bool) {
	plugin, ok := mmConfig.PluginSettings.Plugins[PluginName]
	if !ok {
		return nil, false
	}

	val, ok := plugin[key]
	if !ok {
		return nil, false
	}
	return val, true
}

func getPluginSettingInt(mmConfig mm_model.Config, key string, def int) int {
	val, ok := getPluginSetting(mmConfig, key)
	if !ok {
		return def
	}
	valFloat, ok := val.(float64)
	if !ok {
		return def
	}
	return int(math.Round(valFloat))
}

func parseFeatureFlags(configFeatureFlags map[string]string) map[string]string {
	featureFlags := make(map[string]string)
	for key, value := range configFeatureFlags {
		// Break out FeatureFlags and pass remaining
		if key == boardsFeatureFlagName {
			for _, flag := range strings.Split(value, "-") {
				featureFlags[flag] = "true"
			}
		} else {
			featureFlags[key] = value
		}
	}
	return featureFlags
}
