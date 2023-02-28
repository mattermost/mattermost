// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifymentions

import (
	"github.com/mattermost/mattermost-server/v6/boards/services/notify"

	mm_model "github.com/mattermost/mattermost-server/v6/model"
)

// MentionDelivery provides an interface for delivering @mention notifications to other systems, such as
// channels server via plugin API.
// On success the user id of the user mentioned is returned.
type MentionDelivery interface {
	MentionDeliver(mentionedUser *mm_model.User, extract string, evt notify.BlockChangeEvent) (string, error)
	UserByUsername(mentionUsername string) (*mm_model.User, error)
}
