// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/require"
)

func TestReactionStore(t *testing.T, ss store.Store) {
	t.Run("ReactionSave", func(t *testing.T) { testReactionSave(t, ss) })
	t.Run("ReactionDelete", func(t *testing.T) { testReactionDelete(t, ss) })
	t.Run("ReactionGetForPost", func(t *testing.T) { testReactionGetForPost(t, ss) })
	t.Run("ReactionDeleteAllWithEmojiName", func(t *testing.T) { testReactionDeleteAllWithEmojiName(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testReactionStorePermanentDeleteBatch(t, ss) })
	t.Run("ReactionBulkGetForPosts", func(t *testing.T) { testReactionBulkGetForPosts(t, ss) })
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
	if reaction, err := ss.Reaction().Save(reaction1); err != nil {
		t.Fatal(err)
	} else if saved := reaction; saved.UserId != reaction1.UserId ||
		saved.PostId != reaction1.PostId || saved.EmojiName != reaction1.EmojiName {
		t.Fatal("should've saved reaction and returned it")
	}

	var secondUpdateAt int64
	postList, err := ss.Post().Get(reaction1.PostId)
	if err != nil {
		t.Fatal(err)
	}
	if !postList.Posts[post.Id].HasReactions {
		t.Fatal("should've set HasReactions = true on post")
	} else if postList.Posts[post.Id].UpdateAt == firstUpdateAt {
		t.Fatal("should've marked post as updated when HasReactions changed")
	} else {
		secondUpdateAt = postList.Posts[post.Id].UpdateAt
	}

	if _, err = ss.Reaction().Save(reaction1); err != nil {
		t.Log(err)
		t.Fatal("should've allowed saving a duplicate reaction")
	}

	// different user
	reaction2 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    reaction1.PostId,
		EmojiName: reaction1.EmojiName,
	}
	if _, err = ss.Reaction().Save(reaction2); err != nil {
		t.Fatal(err)
	}

	postList, err = ss.Post().Get(reaction2.PostId)
	if err != nil {
		t.Fatal(err)
	}

	if postList.Posts[post.Id].UpdateAt == secondUpdateAt {
		t.Fatal("should've marked post as updated even if HasReactions doesn't change")
	}

	// different post
	reaction3 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    model.NewId(),
		EmojiName: reaction1.EmojiName,
	}
	if _, err := ss.Reaction().Save(reaction3); err != nil {
		t.Fatal(err)
	}

	// different emoji
	reaction4 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    reaction1.PostId,
		EmojiName: model.NewId(),
	}
	if _, err := ss.Reaction().Save(reaction4); err != nil {
		t.Fatal(err)
	}

	// invalid reaction
	reaction5 := &model.Reaction{
		UserId: reaction1.UserId,
		PostId: reaction1.PostId,
	}
	if _, err := ss.Reaction().Save(reaction5); err == nil {
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

	_, err := ss.Reaction().Save(reaction)
	require.Nil(t, err)
	result, err := ss.Post().Get(reaction.PostId)
	if err != nil {
		t.Fatal(err)
	}
	firstUpdateAt := result.Posts[post.Id].UpdateAt

	if _, err = ss.Reaction().Delete(reaction); err != nil {
		t.Fatal(err)
	}

	if reactions, rErr := ss.Reaction().GetForPost(post.Id, false); rErr != nil {
		t.Fatal(rErr)
	} else if len(reactions) != 0 {
		t.Fatal("should've deleted reaction")
	}
	postList, err := ss.Post().Get(post.Id)
	if err != nil {
		t.Fatal(err)
	}
	if postList.Posts[post.Id].HasReactions {
		t.Fatal("should've set HasReactions = false on post")
	} else if postList.Posts[post.Id].UpdateAt == firstUpdateAt {
		t.Fatal("should mark post as updated after deleting reactions")
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
		_, err := ss.Reaction().Save(reaction)
		require.Nil(t, err)
	}

	if returned, err := ss.Reaction().GetForPost(postId, false); err != nil {
		t.Fatal(err)
	} else if len(returned) != 3 {
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
	if returned, err := ss.Reaction().GetForPost(postId, true); err != nil {
		t.Fatal(err)
	} else if len(returned) != 3 {
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
		_, err := ss.Reaction().Save(reaction)
		require.Nil(t, err)
	}

	if err := ss.Reaction().DeleteAllWithEmojiName(emojiToDelete); err != nil {
		t.Fatal(err)
	}

	// check that the reactions were deleted
	if returned, err := ss.Reaction().GetForPost(post.Id, false); err != nil {
		t.Fatal(err)
	} else if len(returned) != 1 {
		t.Fatal("should've only removed reactions with emoji name")
	} else {
		for _, reaction := range returned {
			if reaction.EmojiName == "smile" {
				t.Fatal("should've removed reaction with emoji name")
			}
		}
	}

	if returned, err := ss.Reaction().GetForPost(post2.Id, false); err != nil {
		t.Fatal(err)
	} else if len(returned) != 1 {
		t.Fatal("should've only removed reactions with emoji name")
	}

	if returned, err := ss.Reaction().GetForPost(post3.Id, false); err != nil {
		t.Fatal(err)
	} else if len(returned) != 0 {
		t.Fatal("should've only removed reactions with emoji name")
	}

	// check that the posts are updated
	postList, err := ss.Post().Get(post.Id)
	if err != nil {
		t.Fatal(err)
	}
	if !postList.Posts[post.Id].HasReactions {
		t.Fatal("post should still have reactions")
	}

	postList, err = ss.Post().Get(post2.Id)
	if err != nil {
		t.Fatal(err)
	}
	if !postList.Posts[post2.Id].HasReactions {
		t.Fatal("post should still have reactions")
	}

	postList, err = ss.Post().Get(post3.Id)
	if err != nil {
		t.Fatal(err)
	}

	if postList.Posts[post3.Id].HasReactions {
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
		var err *model.AppError
		lastReaction, err = ss.Reaction().Save(reaction)
		require.Nil(t, err)
	}

	if returned, err := ss.Reaction().GetForPost(post.Id, false); err != nil {
		t.Fatal(err)
	} else if len(returned) != 4 {
		t.Fatal("expected 4 reactions")
	}

	_, err := ss.Reaction().PermanentDeleteBatch(1800, 1000)
	require.Nil(t, err)

	// This is to force a clear of the cache.
	_, err = ss.Reaction().Delete(lastReaction)
	require.Nil(t, err)

	if returned, err := ss.Reaction().GetForPost(post.Id, false); err != nil {
		t.Fatal(err)
	} else if len(returned) != 1 {
		t.Fatalf("expected 1 reaction. Got: %v", len(returned))
	}
}

func testReactionBulkGetForPosts(t *testing.T, ss store.Store) {
	postId := model.NewId()
	post2Id := model.NewId()
	post3Id := model.NewId()
	post4Id := model.NewId()

	userId := model.NewId()

	reactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    model.NewId(),
			PostId:    post2Id,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    post3Id,
			EmojiName: "sad",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "angry",
		},
		{
			UserId:    userId,
			PostId:    post2Id,
			EmojiName: "angry",
		},
		{
			UserId:    userId,
			PostId:    post4Id,
			EmojiName: "angry",
		},
	}

	for _, reaction := range reactions {
		_, err := ss.Reaction().Save(reaction)
		require.Nil(t, err)
	}

	postIds := []string{postId, post2Id, post3Id}
	if returned, err := ss.Reaction().BulkGetForPosts(postIds); err != nil {
		t.Fatal(err)
	} else if len(returned) != 5 {
		t.Fatal("should've returned 5 reactions")
	} else {
		post4IdFound := false
		for _, reaction := range returned {
			if reaction.PostId == post4Id {
				post4IdFound = true
				break
			}
		}

		if post4IdFound {
			t.Fatal("Wrong reaction returned")
		}
	}

}
