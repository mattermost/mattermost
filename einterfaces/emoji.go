// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type EmojiInterface interface {
	CanUserCreateEmoji(string, []*model.TeamMember) bool
}
