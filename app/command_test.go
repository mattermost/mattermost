// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestCreateCommandPost(t *testing.T) {
	th := Setup().InitBasic()

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Type:      model.POST_SYSTEM_GENERIC,
	}

	resp := &model.CommandResponse{
		Text: "some message",
	}

	_, err := CreateCommandPost(post, th.BasicTeam.Id, resp)
	if err == nil && err.Id != "api.context.invalid_param.app_error" {
		t.Fatal("should have failed - bad post type")
	}
}
