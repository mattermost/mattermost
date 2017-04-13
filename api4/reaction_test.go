// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"reflect"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func TestGetReactions(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id
	postId := th.BasicPost.Id

	userReactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "sad",
		},
		{
			UserId:    user2Id,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    user2Id,
			PostId:    postId,
			EmojiName: "sad",
		},
	}

	var reactions []*model.Reaction

	for _, userReaction := range userReactions {
		if result := <-app.Srv.Store.Reaction().Save(userReaction); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			reactions = append(reactions, result.Data.(*model.Reaction))
		}
	}

	rr, resp := Client.GetReactions(postId)
	CheckNoError(t, resp)

	if len(rr) != 5 {
		t.Fatal("reactions should returned correct length")
	}

	if !reflect.DeepEqual(rr, reactions) {
		t.Fatal("reactions should have matched")
	}

	rr, resp = Client.GetReactions("junk")
	CheckBadRequestStatus(t, resp)

	if len(rr) != 0 {
		t.Fatal("reactions should return empty")
	}

	_, resp = Client.GetReactions(GenerateTestId())
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetReactions(postId)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetReactions(postId)
	CheckNoError(t, resp)
}
