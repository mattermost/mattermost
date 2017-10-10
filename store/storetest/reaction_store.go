// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestReactionStore(t *testing.T, ss store.Store) {
	t.Run("ReactionSave", func(t *testing.T) { testReactionSave(t, ss) })
	t.Run("ReactionDelete", func(t *testing.T) { testReactionDelete(t, ss) })
	t.Run("ReactionGetForPost", func(t *testing.T) { testReactionGetForPost(t, ss) })
	t.Run("ReactionDeleteAllWithEmojiName", func(t *testing.T) { testReactionDeleteAllWithEmojiName(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testReactionStorePermanentDeleteBatch(t, ss) })
}

func testReactionSave(t *testing.T, ss store.Store) {
	post := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)
	firstUpdateAt := post.UpdateAt

	reaction1 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}
	if result := <-ss.Reaction().Save(reaction1); result.Err != nil {
		t.Fatal(result.Err)
	} else if saved := result.Data.(*model.Reaction); saved.UserId != reaction1.UserId ||
		saved.PostId != reaction1.PostId || saved.EmojiName != reaction1.EmojiName {
		t.Fatal("should've saved reaction and returned it")
	}

	var secondUpdateAt int64
	if postList := store.Must(ss.Post().Get(reaction1.PostId)).(*model.PostList); !postList.Posts[post.Id].HasReactions {
		t.Fatal("should've set HasReactions = true on post")
	} else if postList.Posts[post.Id].UpdateAt == firstUpdateAt {
		t.Fatal("should've marked post as updated when HasReactions changed")
	} else {
		secondUpdateAt = postList.Posts[post.Id].UpdateAt
	}

	if result := <-ss.Reaction().Save(reaction1); result.Err != nil {
		t.Log(result.Err)
		t.Fatal("should've allowed saving a duplicate reaction")
	}

	// different user
	reaction2 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    reaction1.PostId,
		EmojiName: reaction1.EmojiName,
	}
	if result := <-ss.Reaction().Save(reaction2); result.Err != nil {
		t.Fatal(result.Err)
	}

	if postList := store.Must(ss.Post().Get(reaction2.PostId)).(*model.PostList); postList.Posts[post.Id].UpdateAt != secondUpdateAt {
		t.Fatal("shouldn't mark as updated when HasReactions hasn't changed")
	}

	// different post
	reaction3 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    model.NewId(),
		EmojiName: reaction1.EmojiName,
	}
	if result := <-ss.Reaction().Save(reaction3); result.Err != nil {
		t.Fatal(result.Err)
	}

	// different emoji
	reaction4 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    reaction1.PostId,
		EmojiName: model.NewId(),
	}
	if result := <-ss.Reaction().Save(reaction4); result.Err != nil {
		t.Fatal(result.Err)
	}

	// invalid reaction
	reaction5 := &model.Reaction{
		UserId: reaction1.UserId,
		PostId: reaction1.PostId,
	}
	if result := <-ss.Reaction().Save(reaction5); result.Err == nil {
		t.Fatal("should've failed for invalid reaction")
	}
}

func testReactionDelete(t *testing.T, ss store.Store) {
	post := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)

	reaction := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}

	store.Must(ss.Reaction().Save(reaction))
	firstUpdateAt := store.Must(ss.Post().Get(reaction.PostId)).(*model.PostList).Posts[post.Id].UpdateAt

	if result := <-ss.Reaction().Delete(reaction); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.Reaction().GetForPost(post.Id, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if len(result.Data.([]*model.Reaction)) != 0 {
		t.Fatal("should've deleted reaction")
	}

	if postList := store.Must(ss.Post().Get(post.Id)).(*model.PostList); postList.Posts[post.Id].HasReactions {
		t.Fatal("should've set HasReactions = false on post")
	} else if postList.Posts[post.Id].UpdateAt == firstUpdateAt {
		t.Fatal("shouldn't mark as updated when HasReactions has changed after deleting reactions")
	}
}

func testReactionGetForPost(t *testing.T, ss store.Store) {
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
		store.Must(ss.Reaction().Save(reaction))
	}

	if result := <-ss.Reaction().GetForPost(postId, false); result.Err != nil {
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
	if result := <-ss.Reaction().GetForPost(postId, true); result.Err != nil {
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

func testReactionDeleteAllWithEmojiName(t *testing.T, ss store.Store) {
	emojiToDelete := model.NewId()

	post := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)
	post2 := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)
	post3 := store.Must(ss.Post().Save(&model.Post{
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
		store.Must(ss.Reaction().Save(reaction))
	}

	if result := <-ss.Reaction().DeleteAllWithEmojiName(emojiToDelete); result.Err != nil {
		t.Fatal(result.Err)
	}

	// check that the reactions were deleted
	if returned := store.Must(ss.Reaction().GetForPost(post.Id, false)).([]*model.Reaction); len(returned) != 1 {
		t.Fatal("should've only removed reactions with emoji name")
	} else {
		for _, reaction := range returned {
			if reaction.EmojiName == "smile" {
				t.Fatal("should've removed reaction with emoji name")
			}
		}
	}

	if returned := store.Must(ss.Reaction().GetForPost(post2.Id, false)).([]*model.Reaction); len(returned) != 1 {
		t.Fatal("should've only removed reactions with emoji name")
	}

	if returned := store.Must(ss.Reaction().GetForPost(post3.Id, false)).([]*model.Reaction); len(returned) != 0 {
		t.Fatal("should've only removed reactions with emoji name")
	}

	// check that the posts are updated
	if postList := store.Must(ss.Post().Get(post.Id)).(*model.PostList); !postList.Posts[post.Id].HasReactions {
		t.Fatal("post should still have reactions")
	}

	if postList := store.Must(ss.Post().Get(post2.Id)).(*model.PostList); !postList.Posts[post2.Id].HasReactions {
		t.Fatal("post should still have reactions")
	}

	if postList := store.Must(ss.Post().Get(post3.Id)).(*model.PostList); postList.Posts[post3.Id].HasReactions {
		t.Fatal("post shouldn't have reactions any more")
	}
}

func testReactionStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	post := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})).(*model.Post)

	reactions := []*model.Reaction{
		{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: "sad",
			CreateAt:  1000,
		},
		{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: "sad",
			CreateAt:  1500,
		},
		{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: "sad",
			CreateAt:  2000,
		},
		{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: "sad",
			CreateAt:  2000,
		},
	}

	// Need to hang on to a reaction to delete later in order to clear the cache, as "allowFromCache" isn't honoured any more.
	var lastReaction *model.Reaction
	for _, reaction := range reactions {
		lastReaction = store.Must(ss.Reaction().Save(reaction)).(*model.Reaction)
	}

	if returned := store.Must(ss.Reaction().GetForPost(post.Id, false)).([]*model.Reaction); len(returned) != 4 {
		t.Fatal("expected 4 reactions")
	}

	store.Must(ss.Reaction().PermanentDeleteBatch(1800, 1000))

	// This is to force a clear of the cache.
	store.Must(ss.Reaction().Delete(lastReaction))

	if returned := store.Must(ss.Reaction().GetForPost(post.Id, false)).([]*model.Reaction); len(returned) != 1 {
		t.Fatalf("expected 1 reaction. Got: %v", len(returned))
	}
}
