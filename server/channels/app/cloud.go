// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) AdjustInProductLimits(limits *model.ProductLimits, subscription *model.Subscription) *model.AppError {
	if limits.Teams != nil && limits.Teams.Active != nil && *limits.Teams.Active > 0 {
		err := a.AdjustTeamsFromProductLimits(limits.Teams)
		if err != nil {
			return err
		}
	}

	return nil
}

// Create/ Update a subscription history event
// This function is run daily to record the number of activated users in the system for Cloud workspaces
func (a *App) SendSubscriptionHistoryEvent(userID string) (*model.SubscriptionHistory, error) {
	license := a.Srv().License()

	// No need to create a Subscription History Event if the license isn't cloud
	if !license.IsCloud() {
		return nil, nil
	}

	userCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, err
	}

	return a.Cloud().CreateOrUpdateSubscriptionHistoryEvent(userID, int(userCount))
}
