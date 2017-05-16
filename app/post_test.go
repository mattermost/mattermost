// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/platform/model"
	"fmt"
)

func TestPostReplyToPostWhereRootPosterLeftChannel(t *testing.T) {
	// This test ensures that when replying to a root post made by a user who has since left the channel, the reply
	// post completes successfully. This is a regression test for PLT-6523.
	th := Setup().InitBasic()

	channel := th.BasicChannel
	userInChannel := th.BasicUser2
	userNotInChannel := th.BasicUser
	rootPost := th.BasicPost

	if _, err := AddUserToChannel(userInChannel, channel); err != nil {
		t.Fatal(err)
	}

	if err := RemoveUserFromChannel(userNotInChannel.Id, "", channel); err != nil {
		t.Fatal(err)
	}

	replyPost := model.Post{
		Message: "asd",
		ChannelId: channel.Id,
		RootId: rootPost.Id,
		ParentId: rootPost.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId: userInChannel.Id,
		CreateAt: 0,
	}

	if _, err := CreatePostAsUser(&replyPost); err != nil {
		t.Fatal(err)
	}
}
