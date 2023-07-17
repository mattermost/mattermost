// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/retrylayer"
)

func TestReactionStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("ReactionSave", func(t *testing.T) { testReactionSave(t, ss) })
	t.Run("ReactionDelete", func(t *testing.T) { testReactionDelete(t, ss) })
	t.Run("ReactionGetForPost", func(t *testing.T) { testReactionGetForPost(t, ss) })
	t.Run("ReactionGetForPostSince", func(t *testing.T) { testReactionGetForPostSince(t, ss, s) })
	t.Run("ReactionDeleteAllWithEmojiName", func(t *testing.T) { testReactionDeleteAllWithEmojiName(t, ss, s) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testReactionStorePermanentDeleteBatch(t, ss) })
	t.Run("ReactionBulkGetForPosts", func(t *testing.T) { testReactionBulkGetForPosts(t, ss) })
	t.Run("ReactionDeadlock", func(t *testing.T) { testReactionDeadlock(t, ss) })
}

func testReactionSave(t *testing.T, ss store.Store) {
	post, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	firstUpdateAt := post.UpdateAt

	reaction1 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}

	time.Sleep(time.Millisecond)
	reaction, nErr := ss.Reaction().Save(reaction1)
	require.NoError(t, nErr)

	saved := reaction
	assert.Equal(t, saved.UserId, reaction1.UserId, "should've saved reaction user_id and returned it")
	assert.Equal(t, saved.PostId, reaction1.PostId, "should've saved reaction post_id and returned it")
	assert.Equal(t, saved.EmojiName, reaction1.EmojiName, "should've saved reaction emoji_name and returned it")
	assert.NotZero(t, saved.UpdateAt, "should've saved reaction update_at and returned it")
	assert.Equal(t, saved.ChannelId, post.ChannelId, "should've saved reaction update_at and returned it")
	assert.Zero(t, saved.DeleteAt, "should've saved reaction delete_at with zero value and returned it")

	var secondUpdateAt int64
	postList, err := ss.Post().Get(context.Background(), reaction1.PostId, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	assert.True(t, postList.Posts[post.Id].HasReactions, "should've set HasReactions = true on post")
	assert.NotEqual(t, postList.Posts[post.Id].UpdateAt, firstUpdateAt, "should've marked post as updated when HasReactions changed")

	if postList.Posts[post.Id].HasReactions && postList.Posts[post.Id].UpdateAt != firstUpdateAt {
		secondUpdateAt = postList.Posts[post.Id].UpdateAt
	}

	_, nErr = ss.Reaction().Save(reaction1)
	assert.NoError(t, nErr, "should've allowed saving a duplicate reaction")

	// different user
	reaction2 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    reaction1.PostId,
		EmojiName: reaction1.EmojiName,
	}

	time.Sleep(time.Millisecond)
	_, nErr = ss.Reaction().Save(reaction2)
	require.NoError(t, nErr)

	postList, err = ss.Post().Get(context.Background(), reaction2.PostId, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)

	assert.NotEqual(t, postList.Posts[post.Id].UpdateAt, secondUpdateAt, "should've marked post as updated even if HasReactions doesn't change")

	// different post
	// create post1
	post1, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err)

	reaction3 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    post1.Id,
		EmojiName: reaction1.EmojiName,
	}
	_, nErr = ss.Reaction().Save(reaction3)
	require.NoError(t, nErr)

	// different emoji
	reaction4 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    reaction1.PostId,
		EmojiName: model.NewId(),
	}
	_, nErr = ss.Reaction().Save(reaction4)
	require.NoError(t, nErr)

	// invalid reaction
	reaction5 := &model.Reaction{
		UserId: reaction1.UserId,
		PostId: reaction1.PostId,
	}
	_, nErr = ss.Reaction().Save(reaction5)
	require.Error(t, nErr, "should've failed for invalid reaction")

	t.Run("channel not found", func(t *testing.T) {
		// invalid reaction
		reaction5 := &model.Reaction{
			UserId:    reaction1.UserId,
			PostId:    model.NewId(), // Unknown PostId
			EmojiName: model.NewId(),
		}
		_, nErr = ss.Reaction().Save(reaction5)
		require.Error(t, nErr, "should've failed because postId doesn't belong to a stored post")
	})
}

func testReactionDelete(t *testing.T, ss store.Store) {
	t.Run("Delete", func(t *testing.T) {
		post, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
		})
		require.NoError(t, err)

		reaction := &model.Reaction{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: model.NewId(),
		}

		_, nErr := ss.Reaction().Save(reaction)
		require.NoError(t, nErr)

		result, err := ss.Post().Get(context.Background(), reaction.PostId, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)

		firstUpdateAt := result.Posts[post.Id].UpdateAt

		_, nErr = ss.Reaction().Delete(reaction)
		require.NoError(t, nErr)

		reactions, rErr := ss.Reaction().GetForPost(post.Id, false)
		require.NoError(t, rErr)

		assert.Empty(t, reactions, "should've deleted reaction")

		postList, err := ss.Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", map[string]bool{})
		require.NoError(t, err)

		assert.False(t, postList.Posts[post.Id].HasReactions, "should've set HasReactions = false on post")
		assert.NotEqual(t, postList.Posts[post.Id].UpdateAt, firstUpdateAt, "should mark post as updated after deleting reactions")
	})

	t.Run("Undelete", func(t *testing.T) {
		post, err := ss.Post().Save(&model.Post{
			ChannelId: model.NewId(),
			UserId:    model.NewId(),
		})
		require.NoError(t, err)

		reaction := &model.Reaction{
			UserId:    model.NewId(),
			PostId:    post.Id,
			EmojiName: model.NewId(),
		}

		savedReaction, nErr := ss.Reaction().Save(reaction)
		require.NoError(t, nErr)

		updateAt := savedReaction.UpdateAt

		_, nErr = ss.Reaction().Delete(savedReaction)
		require.NoError(t, nErr)

		// add same reaction back and ensure update_at is set
		_, nErr = ss.Reaction().Save(savedReaction)
		require.NoError(t, nErr)

		reactions, err := ss.Reaction().GetForPost(post.Id, false)
		require.NoError(t, err)

		assert.Len(t, reactions, 1)
		assert.GreaterOrEqual(t, reactions[0].UpdateAt, updateAt)
	})
}

func testReactionGetForPost(t *testing.T, ss store.Store) {
	userId := model.NewId()
	// create post
	post, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	require.NoError(t, err)
	post1, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	require.NoError(t, err)

	postId := post.Id
	post1Id := post1.Id

	reactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    post1Id,
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
			PostId:    post1Id,
			EmojiName: "angry",
		},
	}

	for _, reaction := range reactions {
		_, err = ss.Reaction().Save(reaction)
		require.NoError(t, err)
	}

	// save and delete an additional reaction to test soft deletion
	temp := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "grin",
	}
	savedTmp, err := ss.Reaction().Save(temp)
	require.NoError(t, err)
	_, err = ss.Reaction().Delete(savedTmp)
	require.NoError(t, err)

	returned, err := ss.Reaction().GetForPost(postId, false)
	require.NoError(t, err)
	require.Len(t, returned, 3, "should've returned 3 reactions")

	for _, reaction := range reactions {
		found := false

		for _, returnedReaction := range returned {
			if returnedReaction.UserId == reaction.UserId && returnedReaction.PostId == reaction.PostId &&
				returnedReaction.EmojiName == reaction.EmojiName && returnedReaction.UpdateAt > 0 {
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
	require.NoError(t, err)
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

func testReactionGetForPostSince(t *testing.T, ss store.Store, s SqlStore) {
	now := model.GetMillis()
	later := now + 1800000 // add 30 minutes
	remoteId := model.NewId()
	userId := model.NewId()

	// create post
	post, _ := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	post1, _ := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})

	postId := post.Id
	post1Id := post1.Id

	reactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "smile",
			UpdateAt:  later,
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
			UpdateAt:  later,
			RemoteId:  &remoteId,
		},
		{
			UserId:    userId,
			PostId:    post1Id,
			EmojiName: "angry",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "angry",
			DeleteAt:  now + 1,
			UpdateAt:  later,
		},
	}

	for _, reaction := range reactions {
		del := reaction.DeleteAt
		update := reaction.UpdateAt

		_, err := ss.Reaction().Save(reaction)
		require.NoError(t, err)

		if del > 0 {
			_, err = ss.Reaction().Delete(reaction)
			require.NoError(t, err)
		}
		if update > 0 {
			err = forceUpdateAt(reaction, update, s)
			require.NoError(t, err)
		}
		err = forceNULL(reaction, s) // test COALESCE
		require.NoError(t, err)
	}

	t.Run("reactions since", func(t *testing.T) {
		// should return 2 reactions that are not deleted for post
		returned, err := ss.Reaction().GetForPostSince(postId, later-1, "", false)
		require.NoError(t, err)
		require.Len(t, returned, 2, "should've returned 2 non-deleted reactions")
		for _, r := range returned {
			assert.Zero(t, r.DeleteAt, "should not have returned deleted reaction")
		}

	})

	t.Run("reactions since, incl deleted", func(t *testing.T) {
		// should return 3 reactions for post, including one deleted
		returned, err := ss.Reaction().GetForPostSince(postId, later-1, "", true)
		require.NoError(t, err)
		require.Len(t, returned, 3, "should've returned 3 reactions")
		var count int
		for _, r := range returned {
			if r.DeleteAt > 0 {
				count++
			}
		}
		assert.Equal(t, 1, count, "should not have returned 1 deleted reaction")

	})

	t.Run("reactions since, filter remoteId", func(t *testing.T) {
		// should return 1 reactions that are not deleted for post and have no remoteId
		returned, err := ss.Reaction().GetForPostSince(postId, later-1, remoteId, false)
		require.NoError(t, err)
		require.Len(t, returned, 1, "should've returned 1 filtered reactions")
		for _, r := range returned {
			assert.Zero(t, r.DeleteAt, "should not have returned deleted reaction")
		}
	})

	t.Run("reactions since, invalid post", func(t *testing.T) {
		// should return 0 reactions for invalid post
		returned, err := ss.Reaction().GetForPostSince(model.NewId(), later-1, "", true)
		require.NoError(t, err)
		require.Empty(t, returned, "should've returned 0 reactions")
	})

	t.Run("reactions since, far future", func(t *testing.T) {
		// should return 0 reactions for since far in the future
		returned, err := ss.Reaction().GetForPostSince(postId, later*2, "", true)
		require.NoError(t, err)
		require.Empty(t, returned, "should've returned 0 reactions")
	})
}

func forceUpdateAt(reaction *model.Reaction, updateAt int64, s SqlStore) error {
	params := map[string]any{
		"userid":    reaction.UserId,
		"postid":    reaction.PostId,
		"emojiname": reaction.EmojiName,
		"updateat":  updateAt,
	}

	sqlResult, err := s.GetMasterX().NamedExec(`
		UPDATE
			Reactions
		SET
			UpdateAt=:updateat
		WHERE
			UserId = :userid AND
			PostId = :postid AND
			EmojiName = :emojiname`, params,
	)

	if err != nil {
		return err
	}

	rows, err := sqlResult.RowsAffected()
	if err != nil {
		return err
	}

	if rows != 1 {
		return errors.New("expected one row affected")
	}
	return nil
}

func forceNULL(reaction *model.Reaction, s SqlStore) error {
	if _, err := s.GetMasterX().Exec(`UPDATE Reactions SET UpdateAt = NULL WHERE UpdateAt = 0`); err != nil {
		return err
	}
	if _, err := s.GetMasterX().Exec(`UPDATE Reactions SET DeleteAt = NULL WHERE DeleteAt = 0`); err != nil {
		return err
	}
	return nil
}

func testReactionDeleteAllWithEmojiName(t *testing.T, ss store.Store, s SqlStore) {
	emojiToDelete := model.NewId()

	post, err1 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err1)
	post2, err2 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err2)
	post3, err3 := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err3)

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
		require.NoError(t, err)

		// make at least one Reaction record contain NULL for Update and DeleteAt to simulate post schema upgrade case.
		if reaction.EmojiName == emojiToDelete {
			err = forceNULL(reaction, s)
			require.NoError(t, err)
		}
	}

	err := ss.Reaction().DeleteAllWithEmojiName(emojiToDelete)
	require.NoError(t, err)

	// check that the reactions were deleted
	returned, err := ss.Reaction().GetForPost(post.Id, false)
	require.NoError(t, err)
	require.Len(t, returned, 1, "should've only removed reactions with emoji name")

	for _, reaction := range returned {
		assert.NotEqual(t, reaction.EmojiName, "smile", "should've removed reaction with emoji name")
	}

	returned, err = ss.Reaction().GetForPost(post2.Id, false)
	require.NoError(t, err)
	assert.Len(t, returned, 1, "should've only removed reactions with emoji name")

	returned, err = ss.Reaction().GetForPost(post3.Id, false)
	require.NoError(t, err)
	assert.Empty(t, returned, "should've only removed reactions with emoji name")

	// check that the posts are updated
	postList, err := ss.Post().Get(context.Background(), post.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	assert.True(t, postList.Posts[post.Id].HasReactions, "post should still have reactions")

	postList, err = ss.Post().Get(context.Background(), post2.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	assert.True(t, postList.Posts[post2.Id].HasReactions, "post should still have reactions")

	postList, err = ss.Post().Get(context.Background(), post3.Id, model.GetPostsOptions{}, "", map[string]bool{})
	require.NoError(t, err)
	assert.False(t, postList.Posts[post3.Id].HasReactions, "post shouldn't have reactions any more")

}

func testReactionStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	const limit = 1000
	team, err := ss.Team().Save(&model.Team{
		DisplayName: "DisplayName",
		Name:        "team" + model.NewId(),
		Email:       MakeEmail(),
		Type:        model.TeamOpen,
	})
	require.NoError(t, err)
	channel, err := ss.Channel().Save(&model.Channel{
		TeamId:      team.Id,
		DisplayName: "DisplayName",
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}, -1)
	require.NoError(t, err)
	olderPost, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		CreateAt:  1000,
	})
	require.NoError(t, err)
	newerPost, err := ss.Post().Save(&model.Post{
		ChannelId: channel.Id,
		UserId:    model.NewId(),
		CreateAt:  3000,
	})
	require.NoError(t, err)

	// Reactions will be deleted based on the timestamp of their post. So the time at
	// which a reaction was created doesn't matter.
	reactions := []*model.Reaction{
		{
			UserId:    model.NewId(),
			PostId:    olderPost.Id,
			EmojiName: "sad",
		},
		{
			UserId:    model.NewId(),
			PostId:    olderPost.Id,
			EmojiName: "sad",
		},
		{
			UserId:    model.NewId(),
			PostId:    newerPost.Id,
			EmojiName: "smile",
		},
	}

	for _, reaction := range reactions {
		_, err = ss.Reaction().Save(reaction)
		require.NoError(t, err)
	}

	_, _, err = ss.Post().PermanentDeleteBatchForRetentionPolicies(0, 2000, limit, model.RetentionPolicyCursor{})
	require.NoError(t, err)

	_, err = ss.Reaction().DeleteOrphanedRows(limit)
	require.NoError(t, err)

	returned, err := ss.Reaction().GetForPost(olderPost.Id, false)
	require.NoError(t, err)
	require.Len(t, returned, 0, "reactions for older post should have been deleted")

	returned, err = ss.Reaction().GetForPost(newerPost.Id, false)
	require.NoError(t, err)
	require.Len(t, returned, 1, "reactions for newer post should not have been deleted")
}

func testReactionBulkGetForPosts(t *testing.T, ss store.Store) {
	userId := model.NewId()
	post, _ := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	postId := post.Id
	post, _ = ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	post2Id := post.Id
	post, _ = ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	post3Id := post.Id
	post, _ = ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    userId,
	})
	post4Id := post.Id

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
		require.NoError(t, err)
	}

	postIds := []string{postId, post2Id, post3Id}
	returned, err := ss.Reaction().BulkGetForPosts(postIds)
	require.NoError(t, err)
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

// testReactionDeadlock is a best-case attempt to recreate the deadlock scenario.
// It at least deadlocks 2 times out of 5.
func testReactionDeadlock(t *testing.T, ss store.Store) {
	ss = retrylayer.New(ss)

	post, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	postId := post.Id
	post, err = ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
	})
	require.NoError(t, err)
	reaction1 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: model.NewId(),
	}
	_, nErr := ss.Reaction().Save(reaction1)
	require.NoError(t, nErr)

	// different user
	reaction2 := &model.Reaction{
		UserId:    model.NewId(),
		PostId:    reaction1.PostId,
		EmojiName: reaction1.EmojiName,
	}
	_, nErr = ss.Reaction().Save(reaction2)
	require.NoError(t, nErr)

	// different post
	reaction3 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    postId,
		EmojiName: reaction1.EmojiName,
	}
	_, nErr = ss.Reaction().Save(reaction3)
	require.NoError(t, nErr)

	// different emoji
	reaction4 := &model.Reaction{
		UserId:    reaction1.UserId,
		PostId:    reaction1.PostId,
		EmojiName: model.NewId(),
	}
	_, nErr = ss.Reaction().Save(reaction4)
	require.NoError(t, nErr)

	var wg sync.WaitGroup
	wg.Add(2)
	// 1st tx
	go func() {
		defer wg.Done()
		err := ss.Reaction().DeleteAllWithEmojiName(reaction1.EmojiName)
		require.NoError(t, err)
	}()

	// 2nd tx
	go func() {
		defer wg.Done()
		_, err := ss.Reaction().Delete(reaction2)
		require.NoError(t, err)
	}()
	wg.Wait()
}
