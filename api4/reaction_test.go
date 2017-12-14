// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestSaveReaction(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	postId := th.BasicPost.Id

	reaction := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "smile",
	}

	rr, resp := Client.SaveReaction(reaction)
	CheckNoError(t, resp)

	if rr.UserId != reaction.UserId {
		t.Fatal("UserId did not match")
	}

	if rr.PostId != reaction.PostId {
		t.Fatal("PostId did not match")
	}

	if rr.EmojiName != reaction.EmojiName {
		t.Fatal("EmojiName did not match")
	}

	if rr.CreateAt == 0 {
		t.Fatal("CreateAt should exist")
	}

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 1 {
		t.Fatal("didn't save reaction correctly")
	}

	// saving a duplicate reaction
	rr, resp = Client.SaveReaction(reaction)
	CheckNoError(t, resp)

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 1 {
		t.Fatal("should have not save duplicated reaction")
	}

	reaction.EmojiName = "sad"

	rr, resp = Client.SaveReaction(reaction)
	CheckNoError(t, resp)

	if rr.EmojiName != reaction.EmojiName {
		t.Fatal("EmojiName did not match")
	}

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 2 {
		t.Fatal("should have save multiple reactions")
	}

	// saving special case
	reaction.EmojiName = "+1"

	rr, resp = Client.SaveReaction(reaction)
	CheckNoError(t, resp)

	if rr.EmojiName != reaction.EmojiName {
		t.Fatal("EmojiName did not match")
	}

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 3 {
		t.Fatal("should have save multiple reactions")
	}

	reaction.PostId = GenerateTestId()

	_, resp = Client.SaveReaction(reaction)
	CheckForbiddenStatus(t, resp)

	reaction.PostId = "junk"

	_, resp = Client.SaveReaction(reaction)
	CheckBadRequestStatus(t, resp)

	reaction.PostId = postId
	reaction.UserId = GenerateTestId()

	_, resp = Client.SaveReaction(reaction)
	CheckForbiddenStatus(t, resp)

	reaction.UserId = "junk"

	_, resp = Client.SaveReaction(reaction)
	CheckBadRequestStatus(t, resp)

	reaction.UserId = userId
	reaction.EmojiName = ""

	_, resp = Client.SaveReaction(reaction)
	CheckBadRequestStatus(t, resp)

	reaction.EmojiName = strings.Repeat("a", 65)

	_, resp = Client.SaveReaction(reaction)
	CheckBadRequestStatus(t, resp)

	reaction.EmojiName = "smile"
	otherUser := th.CreateUser()
	Client.Logout()
	Client.Login(otherUser.Email, otherUser.Password)

	_, resp = Client.SaveReaction(reaction)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.SaveReaction(reaction)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.SaveReaction(reaction)
	CheckForbiddenStatus(t, resp)
}

func TestGetReactions(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
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
		if result := <-th.App.Srv.Store.Reaction().Save(userReaction); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			reactions = append(reactions, result.Data.(*model.Reaction))
		}
	}

	rr, resp := Client.GetReactions(postId)
	CheckNoError(t, resp)

	assert.Len(t, rr, 5)
	for _, r := range reactions {
		assert.Contains(t, reactions, r)
	}

	rr, resp = Client.GetReactions("junk")
	CheckBadRequestStatus(t, resp)

	assert.Empty(t, rr)

	_, resp = Client.GetReactions(GenerateTestId())
	CheckForbiddenStatus(t, resp)

	Client.Logout()

	_, resp = Client.GetReactions(postId)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetReactions(postId)
	CheckNoError(t, resp)
}

func TestDeleteReaction(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id
	postId := th.BasicPost.Id

	r1 := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "smile",
	}

	th.App.SaveReactionForPost(r1)
	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
		t.Fatal("didn't save reaction correctly")
	}

	ok, resp := Client.DeleteReaction(r1)
	CheckNoError(t, resp)

	if !ok {
		t.Fatal("should have returned true")
	}

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 0 {
		t.Fatal("should have deleted reaction")
	}

	// deleting one reaction when a post has multiple reactions
	r2 := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "smile-",
	}

	th.App.SaveReactionForPost(r1)
	th.App.SaveReactionForPost(r2)
	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
		t.Fatal("didn't save reactions correctly")
	}

	_, resp = Client.DeleteReaction(r2)
	CheckNoError(t, resp)

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 || *reactions[0] != *r1 {
		t.Fatal("should have deleted 1 reaction only")
	}

	// deleting one reaction of name +1
	r3 := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "+1",
	}

	th.App.SaveReactionForPost(r3)
	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
		t.Fatal("didn't save reactions correctly")
	}

	_, resp = Client.DeleteReaction(r3)
	CheckNoError(t, resp)

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 || *reactions[0] != *r1 {
		t.Fatal("should have deleted 1 reaction only")
	}

	// deleting a reaction made by another user
	r4 := &model.Reaction{
		UserId:    user2Id,
		PostId:    postId,
		EmojiName: "smile_",
	}

	th.LoginBasic2()
	th.App.SaveReactionForPost(r4)
	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
		t.Fatal("didn't save reaction correctly")
	}

	th.LoginBasic()

	ok, resp = Client.DeleteReaction(r4)
	CheckForbiddenStatus(t, resp)

	if ok {
		t.Fatal("should have returned false")
	}

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
		t.Fatal("should have not deleted a reaction")
	}

	r1.PostId = GenerateTestId()
	_, resp = Client.DeleteReaction(r1)
	CheckForbiddenStatus(t, resp)

	r1.PostId = "junk"

	_, resp = Client.DeleteReaction(r1)
	CheckBadRequestStatus(t, resp)

	r1.PostId = postId
	r1.UserId = GenerateTestId()

	_, resp = Client.DeleteReaction(r1)
	CheckForbiddenStatus(t, resp)

	r1.UserId = "junk"

	_, resp = Client.DeleteReaction(r1)
	CheckBadRequestStatus(t, resp)

	r1.UserId = userId
	r1.EmojiName = ""

	_, resp = Client.DeleteReaction(r1)
	CheckNotFoundStatus(t, resp)

	r1.EmojiName = strings.Repeat("a", 65)

	_, resp = Client.DeleteReaction(r1)
	CheckBadRequestStatus(t, resp)

	Client.Logout()
	r1.EmojiName = "smile"

	_, resp = Client.DeleteReaction(r1)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.DeleteReaction(r1)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.DeleteReaction(r4)
	CheckNoError(t, resp)

	if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 0 {
		t.Fatal("should have deleted both reactions")
	}
}
