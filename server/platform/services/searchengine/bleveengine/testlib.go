// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"fmt"

	"github.com/mattermost/mattermost-server/server/v7/model"
)

func createPost(userId string, channelId string) *model.Post {
	post := &model.Post{
		Message:       model.NewRandomString(15),
		ChannelId:     channelId,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userId,
		CreateAt:      1000000,
	}
	post.PreSave()

	return post
}
