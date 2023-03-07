// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v7/boards/model"
	"github.com/mattermost/mattermost-server/server/v7/boards/utils"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func (a *App) CreateSubscription(sub *model.Subscription) (*model.Subscription, error) {
	sub, err := a.store.CreateSubscription(sub)
	if err != nil {
		return nil, err
	}
	a.notifySubscriptionChanged(sub)

	return sub, nil
}

func (a *App) DeleteSubscription(blockID string, subscriberID string) (*model.Subscription, error) {
	sub, err := a.store.GetSubscription(blockID, subscriberID)
	if err != nil {
		return nil, err
	}
	if err := a.store.DeleteSubscription(blockID, subscriberID); err != nil {
		return nil, err
	}
	sub.DeleteAt = utils.GetMillis()
	a.notifySubscriptionChanged(sub)

	return sub, nil
}

func (a *App) GetSubscriptions(subscriberID string) ([]*model.Subscription, error) {
	return a.store.GetSubscriptions(subscriberID)
}

func (a *App) notifySubscriptionChanged(subscription *model.Subscription) {
	if a.notifications == nil {
		return
	}

	board, err := a.getBoardForBlock(subscription.BlockID)
	if err != nil {
		a.logger.Error("Error notifying subscription change",
			mlog.String("subscriber_id", subscription.SubscriberID),
			mlog.String("block_id", subscription.BlockID),
			mlog.Err(err),
		)
	}
	a.wsAdapter.BroadcastSubscriptionChange(board.TeamID, subscription)
}
