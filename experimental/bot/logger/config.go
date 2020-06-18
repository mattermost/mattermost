// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package logger

type Config struct {
	// AdminLogLevel is "debug", "info", "warn", or "error".
	AdminLogLevel string

	// AdminLogVerbose: set to include full context with admin log messages.
	AdminLogVerbose bool
}

func (c Config) ToStorableConfig(configMap map[string]interface{}) map[string]interface{} {
	if configMap == nil {
		configMap = map[string]interface{}{}
	}
	configMap["AdminLogLevel"] = c.AdminLogLevel
	configMap["AdminLogVerbose"] = c.AdminLogVerbose
	return configMap
}
