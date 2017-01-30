// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"github.com/mattermost/platform/model"
)

type EmojiInterface interface {
	CanUserCreateEmoji(string, []*model.TeamMember) bool
}

var theEmojiInterface EmojiInterface

func RegisterEmojiInterface(newInterface EmojiInterface) {
	theEmojiInterface = newInterface
}

func GetEmojiInterface() EmojiInterface {
	return theEmojiInterface
}
