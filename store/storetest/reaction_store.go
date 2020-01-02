// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/assert"
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
	post, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.Nil(t, err)
	firstUpdateAt := post.UpdateAt

	reaction1 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}
	reaction, err := ss.Reaction().Save(reaction1)
	require.Nil(t, err)

	saved := reaction
	assert.Equal(t, saved.UserId, reaction1.UserId, "should've saved reaction user_id and returned it")
	assert.Equal(t, saved.PostId, reaction1.PostId, "should've saved reaction post_id and returned it")
	assert.Equal(t, saved.EmojiName, reaction1.EmojiName, "should've saved reaction emoji_name and returned it")

	var secondUpdateAt int64
	postList, err := ss.Post().Get(reaction1.PostId, false)
	require.Nil(t, err)

	assert.True(t, postList.Posts[post.Id].HasReactions, "should've set HasReactions = true on post")
	assert.NotEqual(t, postList.Posts[post.Id].UpdateAt, firstUpdateAt, "should've marked post as updated when HasReactions changed")

	if postList.Posts[post.Id].HasReactions && postList.Posts[post.Id].UpdateAt != firstUpdateAt {
		secondUpdateAt = postList.Posts[post.Id].UpdateAt
	}

	_, err = ss.Reaction().Save(reaction1)
	assert.Nil(t, err, "should've allowed saving a duplicate reaction")

	// different user
	reaction2 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    reaction1.PostId,
		EmojiName: reaction1.EmojiName,
	}
	_, err = ss.Reaction().Save(reaction2)
	require.Nil(t, err)

	postList, err = ss.Post().Get(reaction2.PostId, false)
	require.Nil(t, err)

	assert.NotEqual(t, postList.Posts[post.Id].UpdateAt, secondUpdateAt, "should've marked post as updated even if HasReactions doesn't change")

	// different post
	reaction3 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    model.NewId(),
		EmojiName: reaction1.EmojiName,
	}
	_, err = ss.Reaction().Save(reaction3)
	require.Nil(t, err)

	// different emoji
	reaction4 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    reaction1.PostId,
		EmojiName: model.NewId(),
	}
	_, err = ss.Reaction().Save(reaction4)
	require.Nil(t, err)

	// invalid reaction
	reaction5 := &model.Reaction{
		UserId: reaction1.UserId,
		PostId: reaction1.PostId,
	}
	_, err = ss.Reaction().Save(reaction5)
	require.NotNil(t, err, "should've failed for invalid reaction")

}

func testReactionDelete(t *testing.T, ss store.Store) {
	post, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.Nil(t, err)

	reaction := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}

	_, err = ss.Reaction().Save(reaction)
	require.Nil(t, err)

	result, err := ss.Post().Get(reaction.PostId, false)
	require.Nil(t, err)

	firstUpdateAt := result.Posts[post.Id].UpdateAt

	_, err = ss.Reaction().Delete(reaction)
	require.Nil(t, err)

	reactions, rErr := ss.Reaction().GetForPost(post.Id, false)
	require.Nil(t, rErr)

	assert.Empty(t, reactions, "should've deleted reaction")

	postList, err := ss.Post().Get(post.Id, false)
	require.Nil(t, err)

	assert.False(t, postList.Posts[post.Id].HasReactions, "should've set HasReactions = false on post")
	assert.NotEqual(t, postList.Posts[post.Id].UpdateAt, firstUpdateAt, "should mark post as updated after deleting reactions")
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

	returned, err := ss.Reaction().GetForPost(postId, false)
	require.Nil(t, err)
	require.Len(t, returned, 3, "should've returned 3 reactions")

	for _, reaction := range reactions {
		found := false

		for _, returnedReaction := range returned {
			if returnedReaction.UserId == reaction.UserId && returnedReaction.PostId == reaction.PostId &&
				returnedReaction.EmojiName == reaction.EmojiName {
				found = true
				break
			}
		}

		if !found {
			assert.NotEqual(t, reaction.PostId, postId, "should've returned reaction for post %v", reaction)
		} else if found {
			assert.Equal(t, reaction.PostId, postId, "shouldn't have returned reaction for another post")
		}
	}

	// Should return cached item
	returned, err = ss.Reaction().GetForPost(postId, true)
	require.Nil(t, err)
	require.Len(t, returned, 3, "should've returned 3 reactions")

	for _, reaction := range reactions {
		found := false

		for _, returnedReaction := range returned {
			if returnedReaction.UserId == reaction.UserId && returnedReaction.PostId == reaction.PostId &&
				returnedReaction.EmojiName == reaction.EmojiName {
				found = true
				break
			}
		}

		if !found {
			assert.NotEqual(t, reaction.PostId, postId, "should've returned reaction for post %v", reaction)
		} else if found {
			assert.Equal(t, reaction.PostId, postId, "shouldn't have returned reaction for another post")
		}
	}
}

func testReactionDeleteAllWithEmojiName(t *testing.T, ss store.Store) {
	emojiToDelete := model.NewId()

	post, err1 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.Nil(t, err1)
	post2, err2 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.Nil(t, err2)
	post3, err3 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.Nil(t, err3)

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

	err := ss.Reaction().DeleteAllWithEmojiName(emojiToDelete)
	require.Nil(t, err)

	// check that the reactions were deleted
	returned, err := ss.Reaction().GetForPost(post.Id, false)
	require.Nil(t, err)
	require.Len(t, returned, 1, "should've only removed reactions with emoji name")

	for _, reaction := range returned {
		assert.NotEqual(t, reaction.EmojiName, "smile", "should've removed reaction with emoji name")
	}

	returned, err = ss.Reaction().GetForPost(post2.Id, false)
	require.Nil(t, err)
	assert.Len(t, returned, 1, "should've only removed reactions with emoji name")

	returned, err = ss.Reaction().GetForPost(post3.Id, false)
	require.Nil(t, err)
	assert.Empty(t, returned, "should've only removed reactions with emoji name")

	// check that the posts are updated
	postList, err := ss.Post().Get(post.Id, false)
	require.Nil(t, err)
	assert.True(t, postList.Posts[post.Id].HasReactions, "post should still have reactions")

	postList, err = ss.Post().Get(post2.Id, false)
	require.Nil(t, err)
	assert.True(t, postList.Posts[post2.Id].HasReactions, "post should still have reactions")

	postList, err = ss.Post().Get(post3.Id, false)
	require.Nil(t, err)
	assert.False(t, postList.Posts[post3.Id].HasReactions, "post shouldn't have reactions any more")

}

func testReactionStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	post, err1 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.Nil(t, err1)

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

	returned, err := ss.Reaction().GetForPost(post.Id, false)
	require.Nil(t, err)
	require.Len(t, returned, 4, "expected 4 reactions")

	_, err = ss.Reaction().PermanentDeleteBatch(1800, 1000)
	require.Nil(t, err)

	// This is to force a clear of the cache.
	_, err = ss.Reaction().Delete(lastReaction)
	require.Nil(t, err)

	returned, err = ss.Reaction().GetForPost(post.Id, false)
	require.Nil(t, err)
	require.Len(t, returned, 1, "expected 1 reaction. Got: %v", len(returned))
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
	returned, err := ss.Reaction().BulkGetForPosts(postIds)
	require.Nil(t, err)
	require.Len(t, returned, 5, "should've returned 5 reactions")

	post4IdFound := false
	for _, reaction := range returned {
		if reaction.PostId == post4Id {
			post4IdFound = true
			break
		}
	}

	require.False(t, post4IdFound, "Wrong reaction returned")

}
