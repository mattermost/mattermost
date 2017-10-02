// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestSaveReaction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	user := th.BasicUser
	user2 := th.BasicUser2

	channel := th.BasicChannel
	post := th.BasicPost

	// saving a reaction
	reaction := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: "smile",
	}
	if returned, err := Client.SaveReaction(channel.Id, reaction); err != nil {
		t.Fatal(err)
	} else {
		reaction = returned
	}

	if reactions := Client.MustGeneric(Client.ListReactions(channel.Id, post.Id)).([]*model.Reaction); len(reactions) != 1 || *reactions[0] != *reaction {
		t.Fatal("didn't save reaction correctly")
	}

	// saving a duplicate reaction
	if _, err := Client.SaveReaction(channel.Id, reaction); err != nil {
		t.Fatal(err)
	}

	// saving a second reaction on a post
	reaction2 := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: "sad",
	}
	if returned, err := Client.SaveReaction(channel.Id, reaction2); err != nil {
		t.Fatal(err)
	} else {
		reaction2 = returned
	}

	if reactions := Client.MustGeneric(Client.ListReactions(channel.Id, post.Id)).([]*model.Reaction); len(reactions) != 2 ||
		(*reactions[0] != *reaction && *reactions[1] != *reaction) || (*reactions[0] != *reaction2 && *reactions[1] != *reaction2) {
		t.Fatal("didn't save multiple reactions correctly")
	}

	// saving a reaction without a user id
	reaction3 := &model.Reaction{
		PostId:    post.Id,
		EmojiName: "smile",
	}
	if _, err := Client.SaveReaction(channel.Id, reaction3); err == nil {
		t.Fatal("should've failed to save reaction without user id")
	}

	// saving a reaction without a post id
	reaction4 := &model.Reaction{
		UserId:    user.Id,
		EmojiName: "smile",
	}
	if _, err := Client.SaveReaction(channel.Id, reaction4); err == nil {
		t.Fatal("should've failed to save reaction without post id")
	}

	// saving a reaction without a emoji name
	reaction5 := &model.Reaction{
		UserId: user.Id,
		PostId: post.Id,
	}
	if _, err := Client.SaveReaction(channel.Id, reaction5); err == nil {
		t.Fatal("should've failed to save reaction without emoji name")
	}

	// saving a reaction for another user
	reaction6 := &model.Reaction{
		UserId:    user2.Id,
		PostId:    post.Id,
		EmojiName: "smile",
	}
	if _, err := Client.SaveReaction(channel.Id, reaction6); err == nil {
		t.Fatal("should've failed to save reaction for another user")
	}

	// saving a reaction to a channel we're not a member of
	th.LoginBasic2()
	channel2 := th.CreateChannel(th.BasicClient, th.BasicTeam)
	post2 := th.CreatePost(th.BasicClient, channel2)
	th.LoginBasic()

	reaction7 := &model.Reaction{
		UserId:    user.Id,
		PostId:    post2.Id,
		EmojiName: "smile",
	}
	if _, err := Client.SaveReaction(channel2.Id, reaction7); err == nil {
		t.Fatal("should've failed to save reaction to a channel we're not a member of")
	}

	// saving a reaction to a direct channel
	directChannel := Client.Must(Client.CreateDirectChannel(user2.Id)).Data.(*model.Channel)
	directPost := th.CreatePost(th.BasicClient, directChannel)

	reaction8 := &model.Reaction{
		UserId:    user.Id,
		PostId:    directPost.Id,
		EmojiName: "smile",
	}
	if returned, err := Client.SaveReaction(directChannel.Id, reaction8); err != nil {
		t.Fatal(err)
	} else {
		reaction8 = returned
	}

	if reactions := Client.MustGeneric(Client.ListReactions(directChannel.Id, directPost.Id)).([]*model.Reaction); len(reactions) != 1 || *reactions[0] != *reaction8 {
		t.Fatal("didn't save reaction correctly")
	}

	// saving a reaction for a post in the wrong channel
	reaction9 := &model.Reaction{
		UserId:    user.Id,
		PostId:    directPost.Id,
		EmojiName: "sad",
	}
	if _, err := Client.SaveReaction(channel.Id, reaction9); err == nil {
		t.Fatal("should've failed to save reaction to a post that isn't in the given channel")
	}
}

func TestDeleteReaction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	user := th.BasicUser
	user2 := th.BasicUser2

	channel := th.BasicChannel
	post := th.BasicPost

	reaction1 := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: "smile",
	}

	// deleting a reaction that does exist
	Client.MustGeneric(Client.SaveReaction(channel.Id, reaction1))
	if err := Client.DeleteReaction(channel.Id, reaction1); err != nil {
		t.Fatal(err)
	}

	if reactions := Client.MustGeneric(Client.ListReactions(channel.Id, post.Id)).([]*model.Reaction); len(reactions) != 0 {
		t.Fatal("should've deleted reaction")
	}

	// deleting one reaction when a post has multiple
	reaction2 := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: "sad",
	}
	reaction1 = Client.MustGeneric(Client.SaveReaction(channel.Id, reaction1)).(*model.Reaction)
	reaction2 = Client.MustGeneric(Client.SaveReaction(channel.Id, reaction2)).(*model.Reaction)
	if err := Client.DeleteReaction(channel.Id, reaction2); err != nil {
		t.Fatal(err)
	}

	if reactions := Client.MustGeneric(Client.ListReactions(channel.Id, post.Id)).([]*model.Reaction); len(reactions) != 1 || *reactions[0] != *reaction1 {
		t.Fatal("should've deleted only one reaction")
	}

	// deleting a reaction made by another user
	reaction3 := &model.Reaction{
		UserId:    user2.Id,
		PostId:    post.Id,
		EmojiName: "smile",
	}

	th.LoginBasic2()
	Client.Must(Client.JoinChannel(channel.Id))
	reaction3 = Client.MustGeneric(Client.SaveReaction(channel.Id, reaction3)).(*model.Reaction)

	th.LoginBasic()
	if err := Client.DeleteReaction(channel.Id, reaction3); err == nil {
		t.Fatal("should've failed to delete another user's reaction")
	}

	// deleting a reaction for a post we can't see
	channel2 := th.CreateChannel(th.BasicClient, th.BasicTeam)
	post2 := th.CreatePost(th.BasicClient, channel2)

	reaction4 := &model.Reaction{
		UserId:    user.Id,
		PostId:    post2.Id,
		EmojiName: "smile",
	}

	reaction4 = Client.MustGeneric(Client.SaveReaction(channel2.Id, reaction4)).(*model.Reaction)
	Client.Must(Client.LeaveChannel(channel2.Id))

	if err := Client.DeleteReaction(channel2.Id, reaction4); err == nil {
		t.Fatal("should've failed to delete a reaction from a channel we're not in")
	}

	// deleting a reaction for a post with the wrong channel
	channel3 := th.CreateChannel(th.BasicClient, th.BasicTeam)

	reaction5 := &model.Reaction{
		UserId:    user.Id,
		PostId:    post.Id,
		EmojiName: "happy",
	}
	if _, err := Client.SaveReaction(channel3.Id, reaction5); err == nil {
		t.Fatal("should've failed to save reaction to a post that isn't in the given channel")
	}
}

func TestListReactions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	user := th.BasicUser
	user2 := th.BasicUser2

	channel := th.BasicChannel

	post := th.BasicPost

	userReactions := []*model.Reaction{
		{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "smile",
		},
		{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "happy",
		},
		{
			UserId:    user.Id,
			PostId:    post.Id,
			EmojiName: "sad",
		},
	}

	for i, reaction := range userReactions {
		userReactions[i] = Client.MustGeneric(Client.SaveReaction(channel.Id, reaction)).(*model.Reaction)
	}

	th.LoginBasic2()
	Client.Must(Client.JoinChannel(channel.Id))

	userReactions2 := []*model.Reaction{
		{
			UserId:    user2.Id,
			PostId:    post.Id,
			EmojiName: "smile",
		},
		{
			UserId:    user2.Id,
			PostId:    post.Id,
			EmojiName: "sad",
		},
	}

	for i, reaction := range userReactions2 {
		userReactions2[i] = Client.MustGeneric(Client.SaveReaction(channel.Id, reaction)).(*model.Reaction)
	}

	if reactions, err := Client.ListReactions(channel.Id, post.Id); err != nil {
		t.Fatal(err)
	} else if len(reactions) != 5 {
		t.Fatal("should've returned 5 reactions")
	} else {
		checkForReaction := func(expected *model.Reaction) {
			found := false

			for _, reaction := range reactions {
				if *reaction == *expected {
					found = true
					break
				}
			}

			if !found {
				t.Fatalf("didn't return expected reaction %v", *expected)
			}
		}

		for _, reaction := range userReactions {
			checkForReaction(reaction)
		}

		for _, reaction := range userReactions2 {
			checkForReaction(reaction)
		}
	}
}
