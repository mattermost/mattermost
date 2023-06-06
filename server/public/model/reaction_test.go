// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReactionIsValid(t *testing.T) {
	tests := []struct {
		// reaction
		reaction Reaction
		// error message to print
		errMsg string
		// should there be an error
		shouldErr bool
	}{
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "emoji",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "",
			shouldErr: false,
		},
		{
			reaction: Reaction{
				UserId:    "",
				PostId:    NewId(),
				EmojiName: "emoji",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "user id should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    "1234garbage",
				PostId:    NewId(),
				EmojiName: "emoji",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "user id should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    "",
				EmojiName: "emoji",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "post id should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    "1234garbage",
				EmojiName: "emoji",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "post id should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: strings.Repeat("a", 64),
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "",
			shouldErr: false,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "emoji-",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "",
			shouldErr: false,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "emoji_",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "",
			shouldErr: false,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "+1",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "",
			shouldErr: false,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "emoji:",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "",
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "emoji name should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: strings.Repeat("a", 65),
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
			},
			errMsg:    "emoji name should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "emoji",
				CreateAt:  0,
				UpdateAt:  GetMillis(),
			},
			errMsg:    "create at should be invalid",
			shouldErr: true,
		},
		{
			reaction: Reaction{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "emoji",
				CreateAt:  GetMillis(),
				UpdateAt:  0,
			},
			errMsg:    "update at should be invalid",
			shouldErr: true,
		},
	}

	for _, test := range tests {
		appErr := test.reaction.IsValid()
		if test.shouldErr {
			// there should be an error here
			require.NotNil(t, appErr, test.errMsg)
		} else {
			// err should be nil here
			require.Nil(t, appErr, test.errMsg)
		}
	}
}
