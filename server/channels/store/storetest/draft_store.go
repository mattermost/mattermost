// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestDraftStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("SaveDraft", func(t *testing.T) { testSaveDraft(t, rctx, ss) })
	t.Run("UpdateDraft", func(t *testing.T) { testUpdateDraft(t, rctx, ss) })
	t.Run("DeleteDraft", func(t *testing.T) { testDeleteDraft(t, rctx, ss) })
	t.Run("DeleteDraftsAssociatedWithPost", func(t *testing.T) { testDeleteDraftsAssociatedWithPost(t, rctx, ss) })
	t.Run("GetDraft", func(t *testing.T) { testGetDraft(t, rctx, ss) })
	t.Run("GetDraftsForUser", func(t *testing.T) { testGetDraftsForUser(t, rctx, ss) })
	t.Run("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", func(t *testing.T) { testGetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(t, rctx, ss) })
	t.Run("DeleteEmptyDraftsByCreateAtAndUserId", func(t *testing.T) { testDeleteEmptyDraftsByCreateAtAndUserId(t, rctx, ss) })
	t.Run("DeleteOrphanDraftsByCreateAtAndUserId", func(t *testing.T) { testDeleteOrphanDraftsByCreateAtAndUserId(t, rctx, ss) })
}

func testSaveDraft(t *testing.T, rctx request.CTX, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(rctx, member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	t.Run("save drafts", func(t *testing.T) {
		draftResp, err := ss.Draft().Upsert(draft1)
		assert.NoError(t, err)

		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		draftResp, err = ss.Draft().Upsert(draft2)
		assert.NoError(t, err)

		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)

		drafts, err := ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, drafts, 2)
	})
}

func testUpdateDraft(t *testing.T, rctx request.CTX, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}

	member := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(rctx, member)
	require.NoError(t, err)

	t.Run("update drafts", func(t *testing.T) {
		draft := &model.Draft{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "draft",
		}
		_, err := ss.Draft().Upsert(draft)
		assert.NoError(t, err)

		drafts, err := ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, drafts, 1)
		draft1 := drafts[0]

		assert.Greater(t, draft1.CreateAt, int64(0))
		assert.Equal(t, draft1.UpdateAt, draft1.CreateAt)
		assert.Equal(t, channel.Id, draft1.ChannelId)
		assert.Equal(t, "draft", draft1.Message)

		updatedDraft := &model.Draft{
			UserId:    user.Id,
			ChannelId: channel.Id,
			Message:   "updatedDraft",
		}
		_, err = ss.Draft().Upsert(updatedDraft)
		assert.NoError(t, err)

		drafts, err = ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, drafts, 1)
		draft2 := drafts[0]

		assert.Greater(t, draft2.CreateAt, int64(0))
		assert.Equal(t, "updatedDraft", draft2.Message)
		assert.Equal(t, channel.Id, draft2.ChannelId)
		assert.Equal(t, draft1.CreateAt, draft2.CreateAt)
	})
}

func testDeleteDraft(t *testing.T, rctx request.CTX, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(rctx, member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	t.Run("delete drafts", func(t *testing.T) {
		err := ss.Draft().Delete(user.Id, channel.Id, "")
		assert.NoError(t, err)

		err = ss.Draft().Delete(user.Id, channel2.Id, "")
		assert.NoError(t, err)

		_, err = ss.Draft().Get(user.Id, channel.Id, "", false)
		require.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)

		_, err = ss.Draft().Get(user.Id, channel2.Id, "", false)
		assert.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)
	})
}

func testGetDraft(t *testing.T, rctx request.CTX, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(rctx, member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00005,
		UpdateAt:  00005,
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := ss.Draft().Get(user.Id, channel.Id, "", false)
		assert.NoError(t, err)
		assert.Equal(t, draft1.Message, draftResp.Message)
		assert.Equal(t, draft1.ChannelId, draftResp.ChannelId)

		draftResp, err = ss.Draft().Get(user.Id, channel2.Id, "", false)
		assert.NoError(t, err)
		assert.Equal(t, draft2.Message, draftResp.Message)
		assert.Equal(t, draft2.ChannelId, draftResp.ChannelId)
	})
}

func testGetDraftsForUser(t *testing.T, rctx request.CTX, ss store.Store) {
	user := &model.User{
		Id: model.NewId(),
	}

	channel := &model.Channel{
		Id: model.NewId(),
	}
	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	member1 := &model.ChannelMember{
		ChannelId:   channel.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	member2 := &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	_, err := ss.Channel().SaveMember(rctx, member1)
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, member2)
	require.NoError(t, err)

	draft1 := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel.Id,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		UserId:    user.Id,
		ChannelId: channel2.Id,
		Message:   "draft2",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	t.Run("get drafts", func(t *testing.T) {
		draftResp, err := ss.Draft().GetDraftsForUser(user.Id, "")
		assert.NoError(t, err)
		assert.Len(t, draftResp, 2)

		assert.ElementsMatch(t, []*model.Draft{draft1, draft2}, draftResp)
	})
}

func clearDrafts(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Helper()

	_, err := ss.GetInternalMasterDB().Exec("DELETE FROM Drafts")
	require.NoError(t, err)
}

func makeDrafts(t *testing.T, ss store.Store, count int, message string) {
	t.Helper()

	var delay time.Duration
	if count > 100 {
		// When creating more than one page of drafts, improve the odds we get
		// some results with different CreateAt timetsamps.
		delay = 5 * time.Millisecond
	}

	for i := 1; i <= count; i++ {
		_, err := ss.Draft().Upsert(&model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   message,
		})
		require.NoError(t, err)

		if delay > 0 {
			time.Sleep(delay)
		}
	}
}

func countDrafts(t *testing.T, rctx request.CTX, ss store.Store) int {
	t.Helper()

	var count int
	err := ss.GetInternalMasterDB().QueryRow("SELECT COUNT(*) FROM Drafts").Scan(&count)
	require.NoError(t, err)

	return count
}

func countDraftPages(t *testing.T, rctx request.CTX, ss store.Store) int {
	t.Helper()

	pages := 0
	createAt := int64(0)
	userId := ""

	for {
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)

		if nextCreateAt == 0 && nextUserId == "" {
			break
		}

		// Ensure we're always making progress.
		if nextCreateAt == createAt {
			require.Greater(t, nextUserId, userId)
		} else {
			require.Greater(t, nextCreateAt, createAt)
		}

		pages++
		createAt = nextCreateAt
		userId = nextUserId
	}

	return pages
}

func clearPosts(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Helper()

	_, err := ss.GetInternalMasterDB().Exec("DELETE FROM Posts")
	require.NoError(t, err)
}

func makeDraftsWithNonDeletedPosts(t *testing.T, rctx request.CTX, ss store.Store, count int, message string) {
	t.Helper()

	for i := 1; i <= count; i++ {
		post, err := ss.Post().Save(rctx, &model.Post{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   message,
		})
		require.NoError(t, err)

		_, err = ss.Draft().Upsert(&model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    post.UserId,
			ChannelId: post.ChannelId,
			RootId:    post.Id,
			Message:   message,
		})
		require.NoError(t, err)

		if i%100 == 0 {
			time.Sleep(5 * time.Millisecond)
		}
	}

	time.Sleep(5 * time.Millisecond)
}

func makeDraftsWithDeletedPosts(t *testing.T, rctx request.CTX, ss store.Store, count int, message string) {
	t.Helper()

	for i := 1; i <= count; i++ {
		post, err := ss.Post().Save(rctx, &model.Post{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			DeleteAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   message,
		})
		require.NoError(t, err)

		_, err = ss.Draft().Upsert(&model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    post.UserId,
			ChannelId: post.ChannelId,
			RootId:    post.Id,
			Message:   message,
		})
		require.NoError(t, err)

		if i%100 == 0 {
			time.Sleep(5 * time.Millisecond)
		}
	}

	time.Sleep(5 * time.Millisecond)
}

func testGetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("no drafts", func(t *testing.T) {
		clearDrafts(t, rctx, ss)

		createAt, userId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(0, "")
		require.NoError(t, err)
		assert.EqualValues(t, 0, createAt)
		assert.Equal(t, "", userId)

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")
	})

	t.Run("single page", func(t *testing.T) {
		clearDrafts(t, rctx, ss)

		makeDrafts(t, ss, 100, model.NewRandomString(16))
		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")
	})

	t.Run("multiple pages", func(t *testing.T) {
		clearDrafts(t, rctx, ss)

		makeDrafts(t, ss, 300, model.NewRandomString(16))
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")
	})
}

func testDeleteEmptyDraftsByCreateAtAndUserId(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("nil parameters", func(t *testing.T) {
		clearDrafts(t, rctx, ss)

		err := ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(0, "")
		require.NoError(t, err)
	})

	t.Run("delete single page, all empty", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		makeDrafts(t, ss, 100, "")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, all empty", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		makeDrafts(t, ss, 300, "")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 2, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, some empty", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		makeDrafts(t, ss, 50, "")
		makeDrafts(t, ss, 50, "message")
		makeDrafts(t, ss, 50, "")
		makeDrafts(t, ss, 50, "message")
		makeDrafts(t, ss, 50, "")
		makeDrafts(t, ss, 50, "message")
		makeDrafts(t, ss, 50, "")
		makeDrafts(t, ss, 50, "message")
		makeDrafts(t, ss, 50, "message")
		makeDrafts(t, ss, 50, "message")

		// Verify initially 5 pages
		assert.Equal(t, 5, countDraftPages(t, rctx, ss), "incorrect number of pages")

		createAt, userId := int64(0), ""

		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Only deleted 50, so still 5 pages
		assert.Equal(t, 5, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Now deleted 100, so down to 4 pages
		assert.Equal(t, 4, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Only deleted 150 now, so still 4 pages
		assert.Equal(t, 4, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Now deleted all 200 empty messages, so down to 3 pages
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		// Keep going through all pages to verify nothing else gets deleted.

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Verify we're done iterating

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})
}

func testDeleteOrphanDraftsByCreateAtAndUserId(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("nil parameters", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		err := ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(0, "")
		require.NoError(t, err)
	})

	t.Run("delete single page, drafts with no post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDrafts(t, ss, 100, "Okay")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, drafts with no post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDrafts(t, ss, 300, "Okay")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 2, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete single page, drafts with deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithDeletedPosts(t, rctx, ss, 100, "Okay")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, drafts with deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithDeletedPosts(t, rctx, ss, 300, "Okay")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 2, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete single page, drafts with non deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithNonDeletedPosts(t, rctx, ss, 100, "Okay")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 100, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, drafts with non deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithNonDeletedPosts(t, rctx, ss, 300, "Okay")

		createAt, userId := int64(0), ""
		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})

	// This test is a bit more complicated, but it's the most realistic scenario and covers all the remaining cases
	t.Run("delete multiple pages, some drafts with deleted post, some with non deleted post, and some with no post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		// 50 drafts will be deleted from this page
		makeDrafts(t, ss, 50, "Yup")
		makeDraftsWithNonDeletedPosts(t, rctx, ss, 50, "Okay")

		// 100 drafts will be deleted from this page
		makeDrafts(t, ss, 50, "Yup")
		makeDraftsWithDeletedPosts(t, rctx, ss, 50, "Okay")

		// 50 drafts will be deleted from this page
		makeDraftsWithDeletedPosts(t, rctx, ss, 50, "Okay")
		makeDraftsWithNonDeletedPosts(t, rctx, ss, 50, "Okay")

		// 70 drafts will be deleted from this page
		makeDrafts(t, ss, 40, "Yup")
		makeDraftsWithDeletedPosts(t, rctx, ss, 30, "Okay")
		makeDraftsWithNonDeletedPosts(t, rctx, ss, 30, "Okay")

		// No drafts will be deleted from this page
		makeDraftsWithNonDeletedPosts(t, rctx, ss, 100, "Okay")

		// Verify initially 5 pages with 500 drafts
		assert.Equal(t, 5, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 500, countDrafts(t, rctx, ss), "incorrect number of drafts")

		createAt, userId := int64(0), ""

		nextCreateAt, nextUserId, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Only deleted 50, so still 5 pages
		assert.Equal(t, 5, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 450, countDrafts(t, rctx, ss), "incorrect number of drafts")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Now deleted 150, so down to 4 pages
		assert.Equal(t, 4, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 350, countDrafts(t, rctx, ss), "incorrect number of drafts")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Now deleted 200 now, so down to 3 pages
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Now deleted 270 empty messages, so still 3 pages
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 230, countDrafts(t, rctx, ss), "incorrect number of drafts")

		// Keep going through all pages to verify nothing else gets deleted.

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userId)
		require.NoError(t, err)
		createAt, userId = nextCreateAt, nextUserId

		// Verify we're done iterating

		nextCreateAt, nextUserId, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userId)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserId, "should have finished iterating through drafts")
	})
}

func testDeleteDraftsAssociatedWithPost(t *testing.T, rctx request.CTX, ss store.Store) {
	user1 := &model.User{
		Id: model.NewId(),
	}

	user2 := &model.User{
		Id: model.NewId(),
	}

	channel1 := &model.Channel{
		Id: model.NewId(),
	}

	channel2 := &model.Channel{
		Id: model.NewId(),
	}

	_, err := ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   channel1.Id,
		UserId:      user1.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	_, err = ss.Channel().SaveMember(rctx, &model.ChannelMember{
		ChannelId:   channel2.Id,
		UserId:      user2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	})
	require.NoError(t, err)

	post1, err := ss.Post().Save(rctx, &model.Post{
		UserId:    user1.Id,
		ChannelId: channel1.Id,
		Message:   "post1",
	})
	require.NoError(t, err)

	post2, err := ss.Post().Save(rctx, &model.Post{
		UserId:    user2.Id,
		ChannelId: channel2.Id,
		Message:   "post2",
	})
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(&model.Draft{
		UserId:    user1.Id,
		ChannelId: channel1.Id,
		RootId:    post1.Id,
		Message:   "draft1",
	})
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(&model.Draft{
		UserId:    user2.Id,
		ChannelId: channel1.Id,
		RootId:    post1.Id,
		Message:   "draft2",
	})
	require.NoError(t, err)

	draft3, err := ss.Draft().Upsert(&model.Draft{
		UserId:    user1.Id,
		ChannelId: channel2.Id,
		RootId:    post2.Id,
		Message:   "draft3",
	})
	require.NoError(t, err)

	draft4, err := ss.Draft().Upsert(&model.Draft{
		UserId:    user2.Id,
		ChannelId: channel2.Id,
		RootId:    post2.Id,
		Message:   "draft4",
	})
	require.NoError(t, err)

	t.Run("delete drafts associated with post", func(t *testing.T) {
		err = ss.Draft().DeleteDraftsAssociatedWithPost(channel1.Id, post1.Id)
		require.NoError(t, err)

		_, err = ss.Draft().Get(user1.Id, channel1.Id, post1.Id, false)
		require.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)

		_, err = ss.Draft().Get(user2.Id, channel1.Id, post1.Id, false)
		require.Error(t, err)
		assert.IsType(t, &store.ErrNotFound{}, err)

		draft, err := ss.Draft().Get(user1.Id, channel2.Id, post2.Id, false)
		require.NoError(t, err)
		assert.Equal(t, draft3.Message, draft.Message)

		draft, err = ss.Draft().Get(user2.Id, channel2.Id, post2.Id, false)
		require.NoError(t, err)
		assert.Equal(t, draft4.Message, draft.Message)
	})
}
