// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v7/boards/model"
)

func (a *App) GetClientConfig() *model.ClientConfig {
	return &model.ClientConfig{
		Telemetry:                a.config.Telemetry,
		TelemetryID:              a.config.TelemetryID,
		EnablePublicSharedBoards: a.config.EnablePublicSharedBoards,
		TeammateNameDisplay:      a.config.TeammateNameDisplay,
		FeatureFlags:             a.config.FeatureFlags,
		MaxFileSize:              a.config.MaxFileSize,
	}
}
