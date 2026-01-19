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
	t.Run("GetManyByRootIds", func(t *testing.T) { testGetManyByRootIds(t, rctx, ss) })
	t.Run("GetDraftsForUser", func(t *testing.T) { testGetDraftsForUser(t, rctx, ss) })
	t.Run("GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration", func(t *testing.T) { testGetLastCreateAtAndUserIDValuesForEmptyDraftsMigration(t, rctx, ss) })
	t.Run("DeleteEmptyDraftsByCreateAtAndUserId", func(t *testing.T) { testDeleteEmptyDraftsByCreateAtAndUserID(t, rctx, ss) })
	t.Run("DeleteOrphanDraftsByCreateAtAndUserId", func(t *testing.T) { testDeleteOrphanDraftsByCreateAtAndUserID(t, rctx, ss) })
	t.Run("PermanentDeleteByUser", func(t *testing.T) { testPermanentDeleteDraftsByUser(t, rctx, ss) })
	t.Run("UpdatePropsOnly", func(t *testing.T) { testUpdatePropsOnly(t, rctx, ss) })

	// Page draft tests
	t.Run("BatchUpdateDraftParentId", func(t *testing.T) { testBatchUpdateDraftParentId(t, rctx, ss) })
	t.Run("UpdateDraftParent", func(t *testing.T) { testUpdateDraftParent(t, rctx, ss) })
	t.Run("GetPageDraft", func(t *testing.T) { testGetPageDraft(t, rctx, ss) })
	t.Run("GetPageDraftsForUser", func(t *testing.T) { testGetPageDraftsForUser(t, rctx, ss) })
	t.Run("UpsertPageDraftContent", func(t *testing.T) { testUpsertPageDraftContent(t, rctx, ss) })
	t.Run("DeletePageDraft", func(t *testing.T) { testDeletePageDraft(t, rctx, ss) })
	t.Run("PageDraftExists", func(t *testing.T) { testPageDraftExists(t, rctx, ss) })
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

func testPermanentDeleteDraftsByUser(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("should delete all drafts for a given user", func(t *testing.T) {
		userId := model.NewId()
		channel1Id := model.NewId()
		channel2Id := model.NewId()

		member1 := &model.ChannelMember{
			ChannelId:   channel1Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}

		member2 := &model.ChannelMember{
			ChannelId:   channel2Id,
			UserId:      userId,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
		}

		_, err := ss.Channel().SaveMember(rctx, member1)
		require.NoError(t, err)

		_, err = ss.Channel().SaveMember(rctx, member2)
		require.NoError(t, err)

		draft1 := &model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    userId,
			ChannelId: channel1Id,
			Message:   "draft1",
		}

		draft2 := &model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    userId,
			ChannelId: channel2Id,
			Message:   "draft2",
		}

		_, err = ss.Draft().Upsert(draft1)
		require.NoError(t, err)

		_, err = ss.Draft().Upsert(draft2)
		require.NoError(t, err)

		draftsResp, err := ss.Draft().GetDraftsForUser(userId, "")
		assert.NoError(t, err)
		assert.Len(t, draftsResp, 2)

		// Delete draft for the user
		err = ss.Draft().PermanentDeleteByUser(userId)
		assert.NoError(t, err)

		// Verify that no drafts exist for the user
		draftsResp, err = ss.Draft().GetDraftsForUser(userId, "")
		assert.NoError(t, err)
		assert.Len(t, draftsResp, 0)
	})

	t.Run("should not fail if no drafts exist for the user", func(t *testing.T) {
		userId := model.NewId()

		// Attempt to delete drafts for a user with no drafts
		err := ss.Draft().PermanentDeleteByUser(userId)
		assert.NoError(t, err)
	})

	t.Run("should handle empty user id", func(t *testing.T) {
		err := ss.Draft().PermanentDeleteByUser("")
		assert.NoError(t, err)
	})

	t.Run("should handle non-existing user id", func(t *testing.T) {
		nonExistingUserId := model.NewId()
		err := ss.Draft().PermanentDeleteByUser(nonExistingUserId)
		assert.NoError(t, err)
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

func testGetManyByRootIds(t *testing.T, rctx request.CTX, ss store.Store) {
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

	rootId1 := model.NewId()
	rootId2 := model.NewId()
	rootId3 := model.NewId()

	draft1 := &model.Draft{
		CreateAt:  00001,
		UpdateAt:  00001,
		UserId:    user.Id,
		ChannelId: channel.Id,
		RootId:    rootId1,
		Message:   "draft1",
	}

	draft2 := &model.Draft{
		CreateAt:  00002,
		UpdateAt:  00002,
		UserId:    user.Id,
		ChannelId: channel.Id,
		RootId:    rootId2,
		Message:   "draft2",
	}

	draft3 := &model.Draft{
		CreateAt:  00003,
		UpdateAt:  00003,
		UserId:    user.Id,
		ChannelId: channel.Id,
		RootId:    rootId3,
		Message:   "draft3",
	}

	_, err = ss.Draft().Upsert(draft1)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft2)
	require.NoError(t, err)

	_, err = ss.Draft().Upsert(draft3)
	require.NoError(t, err)

	t.Run("get multiple drafts by root ids", func(t *testing.T) {
		rootIds := []string{rootId1, rootId2, rootId3}
		drafts, err := ss.Draft().GetManyByRootIds(user.Id, channel.Id, rootIds, false)
		assert.NoError(t, err)
		assert.Len(t, drafts, 3)

		messages := []string{drafts[0].Message, drafts[1].Message, drafts[2].Message}
		assert.Contains(t, messages, "draft1")
		assert.Contains(t, messages, "draft2")
		assert.Contains(t, messages, "draft3")
	})

	t.Run("get subset of drafts", func(t *testing.T) {
		rootIds := []string{rootId1, rootId3}
		drafts, err := ss.Draft().GetManyByRootIds(user.Id, channel.Id, rootIds, false)
		assert.NoError(t, err)
		assert.Len(t, drafts, 2)

		messages := []string{drafts[0].Message, drafts[1].Message}
		assert.Contains(t, messages, "draft1")
		assert.Contains(t, messages, "draft3")
	})

	t.Run("get with empty root ids", func(t *testing.T) {
		rootIds := []string{}
		drafts, err := ss.Draft().GetManyByRootIds(user.Id, channel.Id, rootIds, false)
		assert.NoError(t, err)
		assert.Len(t, drafts, 0)
	})

	t.Run("get with non-existent root ids", func(t *testing.T) {
		rootIds := []string{model.NewId(), model.NewId()}
		drafts, err := ss.Draft().GetManyByRootIds(user.Id, channel.Id, rootIds, false)
		assert.NoError(t, err)
		assert.Len(t, drafts, 0)
	})

	t.Run("get with mix of existing and non-existing root ids", func(t *testing.T) {
		rootIds := []string{rootId1, model.NewId(), rootId2}
		drafts, err := ss.Draft().GetManyByRootIds(user.Id, channel.Id, rootIds, false)
		assert.NoError(t, err)
		assert.Len(t, drafts, 2)

		messages := []string{drafts[0].Message, drafts[1].Message}
		assert.Contains(t, messages, "draft1")
		assert.Contains(t, messages, "draft2")
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

	_, err := ss.GetInternalMasterDB().Exec("DELETE FROM PageContents WHERE UserId != ''")
	require.NoError(t, err)
	_, err = ss.GetInternalMasterDB().Exec("DELETE FROM Drafts")
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
		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Channel " + model.NewId(),
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		channel, err := ss.Channel().Save(nil, channel, 9999)
		require.NoError(t, err)

		_, err = ss.Draft().Upsert(&model.Draft{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: channel.Id,
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
	userID := ""

	for {
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)

		if nextCreateAt == 0 && nextUserID == "" {
			break
		}

		// Ensure we're always making progress.
		if nextCreateAt == createAt {
			require.Greater(t, nextUserID, userID)
		} else {
			require.Greater(t, nextCreateAt, createAt)
		}

		pages++
		createAt = nextCreateAt
		userID = nextUserID
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
		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Channel " + model.NewId(),
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		channel, err := ss.Channel().Save(rctx, channel, 9999)
		require.NoError(t, err)

		post, err := ss.Post().Save(rctx, &model.Post{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: channel.Id,
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
		channel := &model.Channel{
			TeamId:      model.NewId(),
			DisplayName: "Channel " + model.NewId(),
			Name:        "channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		channel, err := ss.Channel().Save(rctx, channel, 9999)
		require.NoError(t, err)

		post, err := ss.Post().Save(rctx, &model.Post{
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			DeleteAt:  model.GetMillis(),
			UserId:    model.NewId(),
			ChannelId: channel.Id,
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

func testGetLastCreateAtAndUserIDValuesForEmptyDraftsMigration(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("no drafts", func(t *testing.T) {
		clearDrafts(t, rctx, ss)

		createAt, userID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(0, "")
		require.NoError(t, err)
		assert.EqualValues(t, 0, createAt)
		assert.Equal(t, "", userID)

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

func testDeleteEmptyDraftsByCreateAtAndUserID(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("nil parameters", func(t *testing.T) {
		clearDrafts(t, rctx, ss)

		err := ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(0, "")
		require.NoError(t, err)
	})

	t.Run("delete single page, all empty", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		makeDrafts(t, ss, 100, "")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, all empty", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		makeDrafts(t, ss, 300, "")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 2, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
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

		createAt, userID := int64(0), ""

		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Only deleted 50, so still 5 pages
		assert.Equal(t, 5, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Now deleted 100, so down to 4 pages
		assert.Equal(t, 4, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Only deleted 150 now, so still 4 pages
		assert.Equal(t, 4, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Now deleted all 200 empty messages, so down to 3 pages
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		// Keep going through all pages to verify nothing else gets deleted.

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Verify we're done iterating

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})
}

func testDeleteOrphanDraftsByCreateAtAndUserID(t *testing.T, rctx request.CTX, ss store.Store) {
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

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, drafts with no post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDrafts(t, ss, 300, "Okay")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 2, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})

	t.Run("delete single page, drafts with deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithDeletedPosts(t, rctx, ss, 100, "Okay")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, drafts with deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithDeletedPosts(t, rctx, ss, 300, "Okay")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 2, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 0, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})

	t.Run("delete single page, drafts with non deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithNonDeletedPosts(t, rctx, ss, 100, "Okay")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 100, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 1, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
	})

	t.Run("delete multiple pages, drafts with non deleted post", func(t *testing.T) {
		clearDrafts(t, rctx, ss)
		clearPosts(t, rctx, ss)

		makeDraftsWithNonDeletedPosts(t, rctx, ss, 300, "Okay")

		createAt, userID := int64(0), ""
		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
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

		createAt, userID := int64(0), ""

		nextCreateAt, nextUserID, err := ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Only deleted 50, so still 5 pages
		assert.Equal(t, 5, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 450, countDrafts(t, rctx, ss), "incorrect number of drafts")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Now deleted 150, so down to 4 pages
		assert.Equal(t, 4, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 350, countDrafts(t, rctx, ss), "incorrect number of drafts")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Now deleted 200 now, so down to 3 pages
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 300, countDrafts(t, rctx, ss), "incorrect number of drafts")

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Now deleted 270 empty messages, so still 3 pages
		assert.Equal(t, 3, countDraftPages(t, rctx, ss), "incorrect number of pages")
		assert.Equal(t, 230, countDrafts(t, rctx, ss), "incorrect number of drafts")

		// Keep going through all pages to verify nothing else gets deleted.

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		err = ss.Draft().DeleteOrphanDraftsByCreateAtAndUserId(createAt, userID)
		require.NoError(t, err)
		createAt, userID = nextCreateAt, nextUserID

		// Verify we're done iterating

		nextCreateAt, nextUserID, err = ss.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
		require.NoError(t, err)
		assert.EqualValues(t, 0, nextCreateAt, "should have finished iterating through drafts")
		assert.Equal(t, "", nextUserID, "should have finished iterating through drafts")
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

func testUpdatePropsOnly(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	draftId := model.NewId()

	t.Run("successfully updates props with correct version", func(t *testing.T) {
		initialProps := map[string]any{
			model.DraftPropsPageParentID: "old-parent-id",
			model.PagePropsPageID:        "page-123",
		}

		draft := &model.Draft{
			UserId:    userId,
			WikiId:    wikiId,
			ChannelId: wikiId,
			RootId:    draftId,
			Message:   "",
		}
		draft.SetProps(initialProps)

		savedDraft, err := ss.Draft().UpsertPageDraft(draft)
		require.NoError(t, err)
		require.NotNil(t, savedDraft)

		time.Sleep(10 * time.Millisecond)

		updatedProps := map[string]any{
			model.DraftPropsPageParentID: "new-parent-id",
			model.PagePropsPageID:        "page-123",
		}

		err = ss.Draft().UpdatePropsOnly(userId, wikiId, draftId, updatedProps, savedDraft.UpdateAt)
		require.NoError(t, err)

		retrievedDraft, err := ss.Draft().Get(userId, wikiId, draftId, false)
		require.NoError(t, err)

		retrievedProps := retrievedDraft.GetProps()
		assert.Equal(t, "new-parent-id", retrievedProps[model.DraftPropsPageParentID])
		assert.Equal(t, "page-123", retrievedProps[model.PagePropsPageID])

		assert.Greater(t, retrievedDraft.UpdateAt, savedDraft.UpdateAt)
	})

	t.Run("fails with stale version (optimistic lock)", func(t *testing.T) {
		userId2 := model.NewId()
		wikiId2 := model.NewId()
		draftId2 := model.NewId()

		initialProps := map[string]any{
			model.DraftPropsPageParentID: "old-parent-id",
			model.PagePropsPageID:        "page-456",
		}

		draft := &model.Draft{
			UserId:    userId2,
			WikiId:    wikiId2,
			ChannelId: wikiId2,
			RootId:    draftId2,
			Message:   "",
		}
		draft.SetProps(initialProps)

		savedDraft, err := ss.Draft().UpsertPageDraft(draft)
		require.NoError(t, err)

		staleUpdateAt := savedDraft.UpdateAt

		time.Sleep(10 * time.Millisecond)

		intermediateProps := map[string]any{
			model.DraftPropsPageParentID: "intermediate-parent-id",
			model.PagePropsPageID:        "page-456",
		}
		draft.SetProps(intermediateProps)
		updatedDraft, err := ss.Draft().UpsertPageDraft(draft)
		require.NoError(t, err)
		require.Greater(t, updatedDraft.UpdateAt, staleUpdateAt)

		updatedPropsWithStaleVersion := map[string]any{
			model.DraftPropsPageParentID: "should-not-be-saved",
			model.PagePropsPageID:        "page-456",
		}

		err = ss.Draft().UpdatePropsOnly(userId2, wikiId2, draftId2, updatedPropsWithStaleVersion, staleUpdateAt)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "draft was modified by another process")

		retrievedDraft, err := ss.Draft().Get(userId2, wikiId2, draftId2, false)
		require.NoError(t, err)

		retrievedProps := retrievedDraft.GetProps()
		assert.Equal(t, "intermediate-parent-id", retrievedProps[model.DraftPropsPageParentID])
		assert.NotEqual(t, "should-not-be-saved", retrievedProps[model.DraftPropsPageParentID])
	})

	t.Run("fails when draft does not exist", func(t *testing.T) {
		nonExistentUserId := model.NewId()
		nonExistentWikiId := model.NewId()
		nonExistentDraftId := model.NewId()

		props := map[string]any{
			model.DraftPropsPageParentID: "some-parent",
		}

		err := ss.Draft().UpdatePropsOnly(nonExistentUserId, nonExistentWikiId, nonExistentDraftId, props, model.GetMillis())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "draft was modified by another process or does not exist")
	})
}

func testBatchUpdateDraftParentId(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	oldParentId := model.NewId()
	newParentId := model.NewId()

	t.Run("updates drafts with matching parent id", func(t *testing.T) {
		// Create drafts with the old parent ID in Props
		// For page drafts, ChannelId is set to WikiId
		draft1 := &model.Draft{
			UserId:    userId,
			ChannelId: wikiId, // page drafts use wikiId as channelId
			WikiId:    wikiId,
			RootId:    model.NewId(),
			Message:   "draft 1",
			CreateAt:  model.GetMillis(),
		}
		draft1.SetProps(map[string]any{
			model.DraftPropsPageParentID: oldParentId,
		})

		draft2 := &model.Draft{
			UserId:    userId,
			ChannelId: wikiId,
			WikiId:    wikiId,
			RootId:    model.NewId(),
			Message:   "draft 2",
			CreateAt:  model.GetMillis(),
		}
		draft2.SetProps(map[string]any{
			model.DraftPropsPageParentID: oldParentId,
		})

		// Draft with different parent - should not be updated
		draft3 := &model.Draft{
			UserId:    userId,
			ChannelId: wikiId,
			WikiId:    wikiId,
			RootId:    model.NewId(),
			Message:   "draft 3",
			CreateAt:  model.GetMillis(),
		}
		draft3.SetProps(map[string]any{
			model.DraftPropsPageParentID: model.NewId(), // different parent
		})

		_, err := ss.Draft().UpsertPageDraft(draft1)
		require.NoError(t, err)
		_, err = ss.Draft().UpsertPageDraft(draft2)
		require.NoError(t, err)
		_, err = ss.Draft().UpsertPageDraft(draft3)
		require.NoError(t, err)

		// Batch update
		updatedDrafts, err := ss.Draft().BatchUpdateDraftParentId(userId, wikiId, oldParentId, newParentId)
		require.NoError(t, err)
		assert.Len(t, updatedDrafts, 2)

		// Verify the updated drafts have the new parent ID
		for _, d := range updatedDrafts {
			props := d.GetProps()
			assert.Equal(t, newParentId, props[model.DraftPropsPageParentID])
		}

		// Verify draft3 was not updated (Get uses channelId which equals wikiId for page drafts)
		draft3Retrieved, err := ss.Draft().Get(userId, wikiId, draft3.RootId, false)
		require.NoError(t, err)
		props3 := draft3Retrieved.GetProps()
		assert.NotEqual(t, newParentId, props3[model.DraftPropsPageParentID])
	})

	t.Run("returns empty slice when no matching drafts", func(t *testing.T) {
		nonExistentParentId := model.NewId()
		updatedDrafts, err := ss.Draft().BatchUpdateDraftParentId(userId, wikiId, nonExistentParentId, newParentId)
		require.NoError(t, err)
		assert.Len(t, updatedDrafts, 0)
	})
}

func testUpdateDraftParent(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	draftId := model.NewId()
	oldParentId := model.NewId()
	newParentId := model.NewId()

	t.Run("updates single draft parent id", func(t *testing.T) {
		// For page drafts, ChannelId is set to WikiId
		draft := &model.Draft{
			UserId:    userId,
			ChannelId: wikiId, // page drafts use wikiId as channelId
			WikiId:    wikiId,
			RootId:    draftId,
			Message:   "test draft",
			CreateAt:  model.GetMillis(),
		}
		draft.SetProps(map[string]any{
			model.DraftPropsPageParentID: oldParentId,
		})

		_, err := ss.Draft().UpsertPageDraft(draft)
		require.NoError(t, err)

		err = ss.Draft().UpdateDraftParent(userId, wikiId, draftId, newParentId)
		require.NoError(t, err)

		// Verify the update (wikiId == channelId for page drafts)
		retrieved, err := ss.Draft().Get(userId, wikiId, draftId, false)
		require.NoError(t, err)
		props := retrieved.GetProps()
		assert.Equal(t, newParentId, props[model.DraftPropsPageParentID])
	})

	t.Run("fails when draft does not exist", func(t *testing.T) {
		err := ss.Draft().UpdateDraftParent(model.NewId(), model.NewId(), model.NewId(), newParentId)
		require.Error(t, err)
	})
}

func testGetPageDraft(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	pageId := model.NewId()

	t.Run("gets existing page draft", func(t *testing.T) {
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Test content"}]}]}`
		title := "Test Page"

		_, err := ss.Draft().UpsertPageDraftContent(pageId, userId, wikiId, content, title, 0)
		require.NoError(t, err)

		retrieved, err := ss.Draft().GetPageDraft(pageId, userId)
		require.NoError(t, err)
		assert.Equal(t, pageId, retrieved.PageId)
		assert.Equal(t, userId, retrieved.UserId)
		assert.Equal(t, title, retrieved.Title)
	})

	t.Run("returns error for non-existent draft", func(t *testing.T) {
		_, err := ss.Draft().GetPageDraft(model.NewId(), model.NewId())
		require.Error(t, err)
	})
}

func testGetPageDraftsForUser(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()

	t.Run("gets all drafts for user in wiki", func(t *testing.T) {
		// Create multiple drafts
		content := `{"type":"doc","content":[]}`
		for i := range 3 {
			pageId := model.NewId()
			_, err := ss.Draft().UpsertPageDraftContent(pageId, userId, wikiId, content, "Page "+string(rune('A'+i)), 0)
			require.NoError(t, err)
			time.Sleep(10 * time.Millisecond) // ensure different UpdateAt
		}

		drafts, err := ss.Draft().GetPageDraftsForUser(userId, wikiId)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(drafts), 3)
	})

	t.Run("returns empty slice for user with no drafts", func(t *testing.T) {
		drafts, err := ss.Draft().GetPageDraftsForUser(model.NewId(), model.NewId())
		require.NoError(t, err)
		assert.Len(t, drafts, 0)
	})
}

func testUpsertPageDraftContent(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	pageId := model.NewId()

	t.Run("creates new page draft", func(t *testing.T) {
		content := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"New draft"}]}]}`
		title := "New Draft"

		created, err := ss.Draft().UpsertPageDraftContent(pageId, userId, wikiId, content, title, 0)
		require.NoError(t, err)
		assert.Equal(t, pageId, created.PageId)
		assert.Equal(t, userId, created.UserId)
		assert.Equal(t, title, created.Title)
	})

	t.Run("updates existing page draft", func(t *testing.T) {
		existingPageId := model.NewId()
		content1 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version 1"}]}]}`
		title1 := "Version 1"

		created, err := ss.Draft().UpsertPageDraftContent(existingPageId, userId, wikiId, content1, title1, 0)
		require.NoError(t, err)

		// Wait to ensure different timestamp
		time.Sleep(10 * time.Millisecond)

		content2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version 2"}]}]}`
		title2 := "Version 2"

		updated, err := ss.Draft().UpsertPageDraftContent(existingPageId, userId, wikiId, content2, title2, created.UpdateAt)
		require.NoError(t, err)
		assert.Equal(t, title2, updated.Title)
		assert.Greater(t, updated.UpdateAt, created.UpdateAt)
	})
}

func testDeletePageDraft(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	pageId := model.NewId()

	t.Run("deletes existing page draft", func(t *testing.T) {
		content := `{"type":"doc","content":[]}`
		_, err := ss.Draft().UpsertPageDraftContent(pageId, userId, wikiId, content, "To Delete", 0)
		require.NoError(t, err)

		err = ss.Draft().DeletePageDraft(pageId, userId)
		require.NoError(t, err)

		// Verify it's deleted
		_, err = ss.Draft().GetPageDraft(pageId, userId)
		require.Error(t, err)
	})

	t.Run("returns error when draft does not exist", func(t *testing.T) {
		err := ss.Draft().DeletePageDraft(model.NewId(), model.NewId())
		require.Error(t, err)
	})
}

func testPageDraftExists(t *testing.T, rctx request.CTX, ss store.Store) {
	userId := model.NewId()
	wikiId := model.NewId()
	pageId := model.NewId()

	t.Run("returns true for existing draft", func(t *testing.T) {
		content := `{"type":"doc","content":[]}`
		created, err := ss.Draft().UpsertPageDraftContent(pageId, userId, wikiId, content, "Exists", 0)
		require.NoError(t, err)

		exists, updateAt, err := ss.Draft().PageDraftExists(pageId, userId)
		require.NoError(t, err)
		assert.True(t, exists)
		assert.Equal(t, created.UpdateAt, updateAt)
	})

	t.Run("returns false for non-existent draft", func(t *testing.T) {
		exists, updateAt, err := ss.Draft().PageDraftExists(model.NewId(), model.NewId())
		require.NoError(t, err)
		assert.False(t, exists)
		assert.Equal(t, int64(0), updateAt)
	})
}
