// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

// GetIntegrationsUsage returns usage information on integrations, including the count of enabled integrations
func (a *App) GetIntegrationsUsage() (*model.IntegrationsUsage, *model.AppError) {
	return a.ch.getIntegrationsUsage()
}

// getIntegrationsUsage returns usage information on integrations, including the count of enabled integrations
func (ch *Channels) getIntegrationsUsage() (*model.IntegrationsUsage, *model.AppError) {
	installed, appErr := ch.getInstalledIntegrations()
	if appErr != nil {
		return nil, appErr
	}

	var count int64 = 0
	for _, i := range installed {
		if i.Enabled {
			count++
		}
	}

	return &model.IntegrationsUsage{Count: count}, nil
}
