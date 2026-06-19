// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestPageReactionStore(t *testing.T, _ request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testPageReactionSave(t, ss) })
	t.Run("GetForPage", func(t *testing.T) { testPageReactionGetForPage(t, ss) })
	t.Run("Delete", func(t *testing.T) { testPageReactionDelete(t, ss) })
	t.Run("DeleteByPageIds", func(t *testing.T) { testPageReactionDeleteByPageIds(t, ss) })
	t.Run("PermanentDeleteByUser", func(t *testing.T) { testPageReactionPermanentDeleteByUser(t, ss) })

	t.Cleanup(func() {
		_, _ = s.GetMaster().Exec("DELETE FROM PageReactions")
	})
}

func testPageReactionSave(t *testing.T, ss store.Store) {
	pageId := model.NewId()
	userId := model.NewId()

	t.Run("save valid reaction", func(t *testing.T) {
		r := &model.PageReaction{
			PageId:    pageId,
			UserId:    userId,
			EmojiName: "+1",
		}

		saved, err := ss.PageReaction().Save(r)
		require.NoError(t, err)
		require.NotNil(t, saved)
		assert.Equal(t, pageId, saved.PageId)
		assert.Equal(t, userId, saved.UserId)
		assert.Equal(t, "+1", saved.EmojiName)
		assert.NotZero(t, saved.CreateAt)
	})

	t.Run("save duplicate is idempotent", func(t *testing.T) {
		r := &model.PageReaction{
			PageId:    pageId,
			UserId:    userId,
			EmojiName: "+1",
		}

		saved, err := ss.PageReaction().Save(r)
		require.NoError(t, err)
		require.NotNil(t, saved)
		assert.Equal(t, "+1", saved.EmojiName)
	})

	t.Run("save with invalid page id returns error", func(t *testing.T) {
		r := &model.PageReaction{
			PageId:    "not-valid",
			UserId:    model.NewId(),
			EmojiName: "+1",
		}

		_, err := ss.PageReaction().Save(r)
		require.Error(t, err)
	})

	t.Run("save with empty emoji name returns error", func(t *testing.T) {
		r := &model.PageReaction{
			PageId:    model.NewId(),
			UserId:    model.NewId(),
			EmojiName: "",
		}

		_, err := ss.PageReaction().Save(r)
		require.Error(t, err)
	})
}

func testPageReactionGetForPage(t *testing.T, ss store.Store) {
	pageId := model.NewId()
	userId1 := model.NewId()
	userId2 := model.NewId()

	_, err := ss.PageReaction().Save(&model.PageReaction{PageId: pageId, UserId: userId1, EmojiName: "smile"})
	require.NoError(t, err)
	_, err = ss.PageReaction().Save(&model.PageReaction{PageId: pageId, UserId: userId2, EmojiName: "heart"})
	require.NoError(t, err)

	t.Run("returns all reactions for page", func(t *testing.T) {
		reactions, err := ss.PageReaction().GetForPage(pageId)
		require.NoError(t, err)
		assert.Len(t, reactions, 2)
	})

	t.Run("returns empty for unknown page", func(t *testing.T) {
		reactions, err := ss.PageReaction().GetForPage(model.NewId())
		require.NoError(t, err)
		assert.Empty(t, reactions)
	})

	t.Run("invalid page id returns error", func(t *testing.T) {
		_, err := ss.PageReaction().GetForPage("bad-id")
		require.Error(t, err)
	})
}

func testPageReactionDelete(t *testing.T, ss store.Store) {
	pageId := model.NewId()
	userId := model.NewId()

	_, err := ss.PageReaction().Save(&model.PageReaction{PageId: pageId, UserId: userId, EmojiName: "wave"})
	require.NoError(t, err)

	t.Run("deletes existing reaction", func(t *testing.T) {
		err := ss.PageReaction().Delete(&model.PageReaction{PageId: pageId, UserId: userId, EmojiName: "wave"})
		require.NoError(t, err)

		reactions, err := ss.PageReaction().GetForPage(pageId)
		require.NoError(t, err)
		assert.Empty(t, reactions)
	})

	t.Run("delete non-existent reaction is a no-op", func(t *testing.T) {
		err := ss.PageReaction().Delete(&model.PageReaction{PageId: model.NewId(), UserId: model.NewId(), EmojiName: "wave"})
		require.NoError(t, err)
	})
}

func testPageReactionDeleteByPageIds(t *testing.T, ss store.Store) {
	pageId1 := model.NewId()
	pageId2 := model.NewId()
	pageId3 := model.NewId()
	userId := model.NewId()

	_, err := ss.PageReaction().Save(&model.PageReaction{PageId: pageId1, UserId: userId, EmojiName: "+1"})
	require.NoError(t, err)
	_, err = ss.PageReaction().Save(&model.PageReaction{PageId: pageId2, UserId: userId, EmojiName: "+1"})
	require.NoError(t, err)
	_, err = ss.PageReaction().Save(&model.PageReaction{PageId: pageId3, UserId: userId, EmojiName: "+1"})
	require.NoError(t, err)

	t.Run("deletes reactions for given page ids", func(t *testing.T) {
		err := ss.PageReaction().DeleteByPageIds([]string{pageId1, pageId2})
		require.NoError(t, err)

		r1, err := ss.PageReaction().GetForPage(pageId1)
		require.NoError(t, err)
		assert.Empty(t, r1)

		r2, err := ss.PageReaction().GetForPage(pageId2)
		require.NoError(t, err)
		assert.Empty(t, r2)

		r3, err := ss.PageReaction().GetForPage(pageId3)
		require.NoError(t, err)
		assert.Len(t, r3, 1)
	})

	t.Run("empty slice is a no-op", func(t *testing.T) {
		err := ss.PageReaction().DeleteByPageIds([]string{})
		require.NoError(t, err)
	})
}

func testPageReactionPermanentDeleteByUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	pageId1 := model.NewId()
	pageId2 := model.NewId()

	_, err := ss.PageReaction().Save(&model.PageReaction{PageId: pageId1, UserId: userId, EmojiName: "tada"})
	require.NoError(t, err)
	_, err = ss.PageReaction().Save(&model.PageReaction{PageId: pageId2, UserId: userId, EmojiName: "tada"})
	require.NoError(t, err)

	t.Run("deletes all reactions by user", func(t *testing.T) {
		err := ss.PageReaction().PermanentDeleteByUser(userId)
		require.NoError(t, err)

		r1, err := ss.PageReaction().GetForPage(pageId1)
		require.NoError(t, err)
		assert.Empty(t, r1)

		r2, err := ss.PageReaction().GetForPage(pageId2)
		require.NoError(t, err)
		assert.Empty(t, r2)
	})
}
