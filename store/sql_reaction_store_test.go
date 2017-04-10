// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestReactionSave(t *testing.T) {
	Setup()

	post := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)
	firstUpdateAt := post.UpdateAt

	reaction1 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}
	if result := <-store.Reaction().Save(reaction1); result.Err != nil {
		t.Fatal(result.Err)
	} else if saved := result.Data.(*model.Reaction); saved.UserId != reaction1.UserId ||
		saved.PostId != reaction1.PostId || saved.EmojiName != reaction1.EmojiName {
		t.Fatal("should've saved reaction and returned it")
	}

	var secondUpdateAt int64
	if postList := Must(store.Post().Get(reaction1.PostId)).(*model.PostList); !postList.Posts[post.Id].HasReactions {
		t.Fatal("should've set HasReactions = true on post")
	} else if postList.Posts[post.Id].UpdateAt == firstUpdateAt {
		t.Fatal("should've marked post as updated when HasReactions changed")
	} else {
		secondUpdateAt = postList.Posts[post.Id].UpdateAt
	}

	if result := <-store.Reaction().Save(reaction1); result.Err != nil {
		t.Log(result.Err)
		t.Fatal("should've allowed saving a duplicate reaction")
	}

	// different user
	reaction2 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    reaction1.PostId,
		EmojiName: reaction1.EmojiName,
	}
	if result := <-store.Reaction().Save(reaction2); result.Err != nil {
		t.Fatal(result.Err)
	}

	if postList := Must(store.Post().Get(reaction2.PostId)).(*model.PostList); postList.Posts[post.Id].UpdateAt != secondUpdateAt {
		t.Fatal("shouldn't mark as updated when HasReactions hasn't changed")
	}

	// different post
	reaction3 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    model.NewId(),
		EmojiName: reaction1.EmojiName,
	}
	if result := <-store.Reaction().Save(reaction3); result.Err != nil {
		t.Fatal(result.Err)
	}

	// different emoji
	reaction4 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    reaction1.PostId,
		EmojiName: model.NewId(),
	}
	if result := <-store.Reaction().Save(reaction4); result.Err != nil {
		t.Fatal(result.Err)
	}

	// invalid reaction
	reaction5 := &model.Reaction{
		UserId: reaction1.UserId,
		PostId: reaction1.PostId,
	}
	if result := <-store.Reaction().Save(reaction5); result.Err == nil {
		t.Fatal("should've failed for invalid reaction")
	}
}

func TestReactionDelete(t *testing.T) {
	Setup()

	post := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)

	reaction := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}

	Must(store.Reaction().Save(reaction))
	firstUpdateAt := Must(store.Post().Get(reaction.PostId)).(*model.PostList).Posts[post.Id].UpdateAt

	if result := <-store.Reaction().Delete(reaction); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.Reaction().GetForPost(post.Id, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if len(result.Data.([]*model.Reaction)) != 0 {
		t.Fatal("should've deleted reaction")
	}

	if postList := Must(store.Post().Get(post.Id)).(*model.PostList); postList.Posts[post.Id].HasReactions {
		t.Fatal("should've set HasReactions = false on post")
	} else if postList.Posts[post.Id].UpdateAt == firstUpdateAt {
		t.Fatal("shouldn't mark as updated when HasReactions has changed after deleting reactions")
	}
}

func TestReactionGetForPost(t *testing.T) {
	Setup()

	postId := model.NewId()

	userId := model.NewId()

	reactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    model.NewId(),
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "sad",
		},
		{
			UserId:    userId,
			PostId:    model.NewId(),
			EmojiName: "angry",
		},
	}

	for _, reaction := range reactions {
		Must(store.Reaction().Save(reaction))
	}

	if result := <-store.Reaction().GetForPost(postId, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.Reaction); len(returned) != 3 {
		t.Fatal("should've returned 3 reactions")
	} else {
		for _, reaction := range reactions {
			found := false

			for _, returnedReaction := range returned {
				if returnedReaction.UserId == reaction.UserId && returnedReaction.PostId == reaction.PostId &&
					returnedReaction.EmojiName == reaction.EmojiName {
					found = true
					break
				}
			}

			if !found && reaction.PostId == postId {
				t.Fatalf("should've returned reaction for post %v", reaction)
			} else if found && reaction.PostId != postId {
				t.Fatal("shouldn't have returned reaction for another post")
			}
		}
	}

	// Should return cached item
	if result := <-store.Reaction().GetForPost(postId, true); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.Reaction); len(returned) != 3 {
		t.Fatal("should've returned 3 reactions")
	} else {
		for _, reaction := range reactions {
			found := false

			for _, returnedReaction := range returned {
				if returnedReaction.UserId == reaction.UserId && returnedReaction.PostId == reaction.PostId &&
					returnedReaction.EmojiName == reaction.EmojiName {
					found = true
					break
				}
			}

			if !found && reaction.PostId == postId {
				t.Fatalf("should've returned reaction for post %v", reaction)
			} else if found && reaction.PostId != postId {
				t.Fatal("shouldn't have returned reaction for another post")
			}
		}
	}
}

func TestReactionDeleteAllWithEmojiName(t *testing.T) {
	Setup()

	emojiToDelete := model.NewId()

	post := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)
	post2 := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)
	post3 := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)

	userId := model.NewId()

	reactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: emojiToDelete,
		},
		{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: emojiToDelete,
		},
		{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "sad",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "angry",
		},
		{
			UserId:    userId,
			PostId:    post3.Id,
			EmojiName: emojiToDelete,
		},
	}

	for _, reaction := range reactions {
		Must(store.Reaction().Save(reaction))
	}

	if result := <-store.Reaction().DeleteAllWithEmojiName(emojiToDelete); result.Err != nil {
		t.Fatal(result.Err)
	}

	// check that the reactions were deleted
	if returned := Must(store.Reaction().GetForPost(post.Id, false)).([]*model.Reaction); len(returned) != 1 {
		t.Fatal("should've only removed reactions with emoji name")
	} else {
		for _, reaction := range returned {
			if reaction.EmojiName == "smile" {
				t.Fatal("should've removed reaction with emoji name")
			}
		}
	}

	if returned := Must(store.Reaction().GetForPost(post2.Id, false)).([]*model.Reaction); len(returned) != 1 {
		t.Fatal("should've only removed reactions with emoji name")
	}

	if returned := Must(store.Reaction().GetForPost(post3.Id, false)).([]*model.Reaction); len(returned) != 0 {
		t.Fatal("should've only removed reactions with emoji name")
	}

	// check that the posts are updated
	if postList := Must(store.Post().Get(post.Id)).(*model.PostList); !postList.Posts[post.Id].HasReactions {
		t.Fatal("post should still have reactions")
	}

	if postList := Must(store.Post().Get(post2.Id)).(*model.PostList); !postList.Posts[post2.Id].HasReactions {
		t.Fatal("post should still have reactions")
	}

	if postList := Must(store.Post().Get(post3.Id)).(*model.PostList); postList.Posts[post3.Id].HasReactions {
		t.Fatal("post shouldn't have reactions any more")
	}
}
