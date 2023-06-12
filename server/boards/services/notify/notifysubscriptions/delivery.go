// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifysubscriptions

import (
	"github.com/mattermost/mattermost/server/v8/boards/model"

	mm_model "github.com/mattermost/mattermost/server/public/model"
)

// SubscriptionDelivery provides an interface for delivering subscription notifications to other systems, such as
// channels server via plugin API.
type SubscriptionDelivery interface {
	SubscriptionDeliverSlackAttachments(teamID string, subscriberID string, subscriberType model.SubscriberType,
		attachments []*mm_model.SlackAttachment) error
}
