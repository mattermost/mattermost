// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostStore(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("Save", func(t *testing.T) { testPostStoreSave(t, ss) })
	t.Run("SaveAndUpdateChannelMsgCounts", func(t *testing.T) { testPostStoreSaveChannelMsgCounts(t, ss) })
	t.Run("Get", func(t *testing.T) { testPostStoreGet(t, ss) })
	t.Run("GetSingle", func(t *testing.T) { testPostStoreGetSingle(t, ss) })
	t.Run("Update", func(t *testing.T) { testPostStoreUpdate(t, ss) })
	t.Run("Delete", func(t *testing.T) { testPostStoreDelete(t, ss) })
	t.Run("Delete1Level", func(t *testing.T) { testPostStoreDelete1Level(t, ss) })
	t.Run("Delete2Level", func(t *testing.T) { testPostStoreDelete2Level(t, ss) })
	t.Run("PermDelete1Level", func(t *testing.T) { testPostStorePermDelete1Level(t, ss) })
	t.Run("PermDelete1Level2", func(t *testing.T) { testPostStorePermDelete1Level2(t, ss) })
	t.Run("GetWithChildren", func(t *testing.T) { testPostStoreGetWithChildren(t, ss) })
	t.Run("GetPostsWithDetails", func(t *testing.T) { testPostStoreGetPostsWithDetails(t, ss) })
	t.Run("GetPostsBeforeAfter", func(t *testing.T) { testPostStoreGetPostsBeforeAfter(t, ss) })
	t.Run("GetPostsSince", func(t *testing.T) { testPostStoreGetPostsSince(t, ss) })
	t.Run("GetPostBeforeAfter", func(t *testing.T) { testPostStoreGetPostBeforeAfter(t, ss) })
	t.Run("Search", func(t *testing.T) { testPostStoreSearch(t, ss) })
	t.Run("UserCountsWithPostsByDay", func(t *testing.T) { testUserCountsWithPostsByDay(t, ss) })
	t.Run("PostCountsByDay", func(t *testing.T) { testPostCountsByDay(t, ss) })
	t.Run("GetFlaggedPostsForTeam", func(t *testing.T) { testPostStoreGetFlaggedPostsForTeam(t, ss, s) })
	t.Run("GetFlaggedPosts", func(t *testing.T) { testPostStoreGetFlaggedPosts(t, ss) })
	t.Run("GetFlaggedPostsForChannel", func(t *testing.T) { testPostStoreGetFlaggedPostsForChannel(t, ss) })
	t.Run("GetPostsCreatedAt", func(t *testing.T) { testPostStoreGetPostsCreatedAt(t, ss) })
	t.Run("Overwrite", func(t *testing.T) { testPostStoreOverwrite(t, ss) })
	t.Run("GetPostsByIds", func(t *testing.T) { testPostStoreGetPostsByIds(t, ss) })
	t.Run("GetPostsBatchForIndexing", func(t *testing.T) { testPostStoreGetPostsBatchForIndexing(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testPostStorePermanentDeleteBatch(t, ss) })
	t.Run("GetOldest", func(t *testing.T) { testPostStoreGetOldest(t, ss) })
	t.Run("TestGetMaxPostSize", func(t *testing.T) { testGetMaxPostSize(t, ss) })
	t.Run("GetParentsForExportAfter", func(t *testing.T) { testPostStoreGetParentsForExportAfter(t, ss) })
	t.Run("GetRepliesForExport", func(t *testing.T) { testPostStoreGetRepliesForExport(t, ss) })
	t.Run("GetDirectPostParentsForExportAfter", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfter(t, ss, s) })
	t.Run("GetDirectPostParentsForExportAfterDeleted", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfterDeleted(t, ss, s) })
	t.Run("GetDirectPostParentsForExportAfterBatched", func(t *testing.T) { testPostStoreGetDirectPostParentsForExportAfterBatched(t, ss, s) })
}

func testPostStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	_, err := ss.Post().Save(&o1)
	require.Nil(t, err, "couldn't save item")

	_, err = ss.Post().Save(&o1)
	require.NotNil(t, err, "shouldn't be able to update from save")
}

func testPostStoreSaveChannelMsgCounts(t *testing.T, ss store.Store) {
	c1 := &model.Channel{Name: model.NewId(), DisplayName: "posttestchannel", Type: model.CHANNEL_OPEN}
	_, err := ss.Channel().Save(c1, 1000000)
	require.Nil(t, err)

	o1 := model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	_, err = ss.Post().Save(&o1)
	require.Nil(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.Nil(t, err)
	assert.Equal(t, int64(1), c1.TotalMsgCount, "Message count should update by 1")

	o1.Id = ""
	o1.Type = model.POST_ADD_TO_TEAM
	_, err = ss.Post().Save(&o1)
	require.Nil(t, err)

	o1.Id = ""
	o1.Type = model.POST_REMOVE_FROM_TEAM
	_, err = ss.Post().Save(&o1)
	require.Nil(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.Nil(t, err)
	assert.Equal(t, int64(1), c1.TotalMsgCount, "Message count should not update for team add/removed message")

	oldLastPostAt := c1.LastPostAt

	o2 := model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.CreateAt = int64(7)
	_, err = ss.Post().Save(&o2)
	require.Nil(t, err)

	c1, err = ss.Channel().Get(c1.Id, false)
	require.Nil(t, err)
	assert.Equal(t, oldLastPostAt, c1.LastPostAt, "LastPostAt should not update for old message save")
}

func testPostStoreGet(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	etag1 := ss.Post().GetEtag(o1.ChannelId, false)
	require.Equal(t, 0, strings.Index(etag1, model.CurrentVersion+"."), "Invalid Etag")

	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	etag2 := ss.Post().GetEtag(o1.ChannelId, false)
	require.Equal(t, 0, strings.Index(etag2, fmt.Sprintf("%v.%v", model.CurrentVersion, o1.UpdateAt)), "Invalid Etag")

	r1, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.Posts[o1.Id].CreateAt, o1.CreateAt, "invalid returned post")

	_, err = ss.Post().Get("123")
	require.NotNil(t, err, "Missing id should have failed")

	_, err = ss.Post().Get("")
	require.NotNil(t, err, "should fail for blank post ids")
}

func testPostStoreGetSingle(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	post, err := ss.Post().GetSingle(o1.Id)
	require.Nil(t, err)
	require.Equal(t, post.CreateAt, o1.CreateAt, "invalid returned post")

	_, err = ss.Post().GetSingle("123")
	require.NotNil(t, err, "Missing id should have failed")
}

func testPostStoreUpdate(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	r1, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(o3.Id)
	require.Nil(t, err)
	ro3 := r3.Posts[o3.Id]

	require.Equal(t, ro1.Message, o1.Message, "Failed to save/get")

	o1a := &model.Post{}
	*o1a = *ro1
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	_, err = ss.Post().Update(o1a, ro1)
	require.Nil(t, err)

	r1, err = ss.Post().Get(o1.Id)
	require.Nil(t, err)

	ro1a := r1.Posts[o1.Id]
	require.Equal(t, ro1a.Message, o1a.Message, "Failed to update/get")

	o2a := &model.Post{}
	*o2a = *ro2
	o2a.Message = ro2.Message + "DDDDDDD"
	_, err = ss.Post().Update(o2a, ro2)
	require.Nil(t, err)

	r2, err = ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro2a := r2.Posts[o2.Id]

	require.Equal(t, ro2a.Message, o2a.Message, "Failed to update/get")

	o3a := &model.Post{}
	*o3a = *ro3
	o3a.Message = ro3.Message + "WWWWWWW"
	_, err = ss.Post().Update(o3a, ro3)
	require.Nil(t, err)

	r3, err = ss.Post().Get(o3.Id)
	require.Nil(t, err)
	ro3a := r3.Posts[o3.Id]

	if ro3a.Message != o3a.Message {
		require.Equal(t, ro3a.Hashtags, o3a.Hashtags, "Failed to update/get")
	}

	o4, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})
	require.Nil(t, err)

	r4, err := ss.Post().Get(o4.Id)
	require.Nil(t, err)
	ro4 := r4.Posts[o4.Id]

	o4a := &model.Post{}
	*o4a = *ro4
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	_, err = ss.Post().Update(o4a, ro4)
	require.Nil(t, err)

	r4, err = ss.Post().Get(o4.Id)
	require.Nil(t, err)

	ro4a := r4.Posts[o4.Id]
	require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
	require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
}

func testPostStoreDelete(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	deleteByID := model.NewId()

	etag1 := ss.Post().GetEtag(o1.ChannelId, false)
	require.Equal(t, 0, strings.Index(etag1, model.CurrentVersion+"."), "Invalid Etag")

	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.Posts[o1.Id].CreateAt, o1.CreateAt, "invalid returned post")

	err = ss.Post().Delete(o1.Id, model.GetMillis(), deleteByID)
	require.Nil(t, err)

	posts, _ := ss.Post().GetPostsCreatedAt(o1.ChannelId, o1.CreateAt)
	post := posts[0]
	actual := post.Props[model.POST_PROPS_DELETE_BY]

	assert.Equal(t, deleteByID, actual, "Expected (*Post).Props[model.POST_PROPS_DELETE_BY] to be %v but got %v.", deleteByID, actual)

	r3, err := ss.Post().Get(o1.Id)
	require.NotNil(t, err, "Missing id should have failed - PostList %v", r3)

	etag2 := ss.Post().GetEtag(o1.ChannelId, false)
	require.Equal(t, 0, strings.Index(etag2, model.CurrentVersion+"."), "Invalid Etag")
}

func testPostStoreDelete1Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	err = ss.Post().Delete(o1.Id, model.GetMillis(), "")
	require.Nil(t, err)

	_, err = ss.Post().Get(o1.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(o2.Id)
	require.NotNil(t, err, "Deleted id should have failed")
}

func testPostStoreDelete2Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o2.Id
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4, err = ss.Post().Save(o4)
	require.Nil(t, err)

	err = ss.Post().Delete(o1.Id, model.GetMillis(), "")
	require.Nil(t, err)

	_, err = ss.Post().Get(o1.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(o2.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(o3.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(o4.Id)
	require.Nil(t, err)
}

func testPostStorePermDelete1Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	err2 := ss.Post().PermanentDeleteByUser(o2.UserId)
	require.Nil(t, err2)

	_, err = ss.Post().Get(o1.Id)
	require.Nil(t, err, "Deleted id shouldn't have failed")

	_, err = ss.Post().Get(o2.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	err = ss.Post().PermanentDeleteByChannel(o3.ChannelId)
	require.Nil(t, err)

	_, err = ss.Post().Get(o3.Id)
	require.NotNil(t, err, "Deleted id should have failed")
}

func testPostStorePermDelete1Level2(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	err2 := ss.Post().PermanentDeleteByUser(o1.UserId)
	require.Nil(t, err2)

	_, err = ss.Post().Get(o1.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(o2.Id)
	require.NotNil(t, err, "Deleted id should have failed")

	_, err = ss.Post().Get(o3.Id)
	require.Nil(t, err, "Deleted id should have failed")
}

func testPostStoreGetWithChildren(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o2.Id
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	pl, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)

	require.Len(t, pl.Posts, 3, "invalid returned post")

	dErr := ss.Post().Delete(o3.Id, model.GetMillis(), "")
	require.Nil(t, dErr)

	pl, err = ss.Post().Get(o1.Id)
	require.Nil(t, err)

	require.Len(t, pl.Posts, 2, "invalid returned post")

	dErr = ss.Post().Delete(o2.Id, model.GetMillis(), "")
	require.Nil(t, dErr)

	pl, err = ss.Post().Get(o1.Id)
	require.Nil(t, err)

	require.Len(t, pl.Posts, 1, "invalid returned post")
}

func testPostStoreGetPostsWithDetails(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	_, err = ss.Post().Save(o2)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "zz" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a, err = ss.Post().Save(o2a)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4, err = ss.Post().Save(o4)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "zz" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5, err = ss.Post().Save(o5)
	require.Nil(t, err)

	r1, err := ss.Post().GetPosts(o1.ChannelId, 0, 4, false)
	require.Nil(t, err)

	require.Equal(t, r1.Order[0], o5.Id, "invalid order")
	require.Equal(t, r1.Order[1], o4.Id, "invalid order")
	require.Equal(t, r1.Order[2], o3.Id, "invalid order")
	require.Equal(t, r1.Order[3], o2a.Id, "invalid order")

	//the last 4, + o1 (o2a and o3's parent) + o2 (in same thread as o2a and o3)
	require.Len(t, r1.Posts, 6, "wrong size")

	require.Equal(t, r1.Posts[o1.Id].Message, o1.Message, "Missing parent")

	r2, err := ss.Post().GetPosts(o1.ChannelId, 0, 4, true)
	require.Nil(t, err)

	require.Equal(t, r2.Order[0], o5.Id, "invalid order")
	require.Equal(t, r2.Order[1], o4.Id, "invalid order")
	require.Equal(t, r2.Order[2], o3.Id, "invalid order")
	require.Equal(t, r2.Order[3], o2a.Id, "invalid order")

	//the last 4, + o1 (o2a and o3's parent) + o2 (in same thread as o2a and o3)
	require.Len(t, r2.Posts, 6, "wrong size")

	require.Equal(t, r2.Posts[o1.Id].Message, o1.Message, "Missing parent")

	// Run once to fill cache
	_, err = ss.Post().GetPosts(o1.ChannelId, 0, 30, false)
	require.Nil(t, err)

	o6 := &model.Post{}
	o6.ChannelId = o1.ChannelId
	o6.UserId = model.NewId()
	o6.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(o6)
	require.Nil(t, err)

	r3, err := ss.Post().GetPosts(o1.ChannelId, 0, 30, false)
	require.Nil(t, err)
	assert.Equal(t, 7, len(r3.Order))
}

func testPostStoreGetPostsBeforeAfter(t *testing.T, ss store.Store) {
	t.Run("without threads", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		var posts []*model.Post
		for i := 0; i < 10; i++ {
			post, err := ss.Post().Save(&model.Post{
				ChannelId: channelId,
				UserId:    userId,
				Message:   "message",
			})
			require.Nil(t, err)

			posts = append(posts, post)

			time.Sleep(time.Millisecond)
		}

		t.Run("should not return anything before the first post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(channelId, posts[0].Id, 10, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{}, postList.Order)
			assert.Equal(t, map[string]*model.Post{}, postList.Posts)
		})

		t.Run("should return posts before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(channelId, posts[5].Id, 10, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{posts[4].Id, posts[3].Id, posts[2].Id, posts[1].Id, posts[0].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[0].Id: posts[0],
				posts[1].Id: posts[1],
				posts[2].Id: posts[2],
				posts[3].Id: posts[3],
				posts[4].Id: posts[4],
			}, postList.Posts)
		})

		t.Run("should limit posts before", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(channelId, posts[5].Id, 2, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{posts[4].Id, posts[3].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[3].Id: posts[3],
				posts[4].Id: posts[4],
			}, postList.Posts)
		})

		t.Run("should not return anything after the last post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(channelId, posts[len(posts)-1].Id, 10, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{}, postList.Order)
			assert.Equal(t, map[string]*model.Post{}, postList.Posts)
		})

		t.Run("should return posts after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(channelId, posts[5].Id, 10, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{posts[9].Id, posts[8].Id, posts[7].Id, posts[6].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[6].Id: posts[6],
				posts[7].Id: posts[7],
				posts[8].Id: posts[8],
				posts[9].Id: posts[9],
			}, postList.Posts)
		})

		t.Run("should limit posts after", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(channelId, posts[5].Id, 2, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{posts[7].Id, posts[6].Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				posts[6].Id: posts[6],
				posts[7].Id: posts[7],
			}, postList.Posts)
		})
	})

	t.Run("with threads", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		// This creates a series of posts that looks like:
		// post1
		// post2
		// post3 (in response to post1)
		// post4 (in response to post2)
		// post5
		// post6 (in response to post2)

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post2, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			ParentId:  post1.Id,
			RootId:    post1.Id,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			RootId:    post2.Id,
			ParentId:  post2.Id,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			ParentId:  post2.Id,
			RootId:    post2.Id,
			Message:   "message",
		})
		require.Nil(t, err)

		// Adding a post to a thread changes the UpdateAt timestamp of the parent post
		post1.UpdateAt = post3.UpdateAt
		post2.UpdateAt = post6.UpdateAt

		t.Run("should return each post and thread before a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsBefore(channelId, post4.Id, 2, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{post3.Id, post2.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post1.Id: post1,
				post2.Id: post2,
				post3.Id: post3,
				post4.Id: post4,
				post6.Id: post6,
			}, postList.Posts)
		})

		t.Run("should return each post and the root of each thread after a post", func(t *testing.T) {
			postList, err := ss.Post().GetPostsAfter(channelId, post4.Id, 2, 0)
			assert.Nil(t, err)

			assert.Equal(t, []string{post6.Id, post5.Id}, postList.Order)
			assert.Equal(t, map[string]*model.Post{
				post2.Id: post2,
				post4.Id: post4,
				post5.Id: post5,
				post6.Id: post6,
			}, postList.Posts)
		})
	})
}

func testPostStoreGetPostsSince(t *testing.T, ss store.Store) {
	t.Run("should return posts created after the given time", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		_, err = ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post3, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post4, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post5, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
			RootId:    post3.Id,
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		post6, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
			RootId:    post1.Id,
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		postList, err := ss.Post().GetPostsSince(channelId, post3.CreateAt, false)
		assert.Nil(t, err)

		assert.Equal(t, []string{
			post6.Id,
			post5.Id,
			post4.Id,
			post3.Id,
			post1.Id,
		}, postList.Order)

		assert.Len(t, postList.Posts, 5)
		assert.NotNil(t, postList.Posts[post1.Id], "should return the parent post")
		assert.NotNil(t, postList.Posts[post3.Id])
		assert.NotNil(t, postList.Posts[post4.Id])
		assert.NotNil(t, postList.Posts[post5.Id])
		assert.NotNil(t, postList.Posts[post6.Id])
	})

	t.Run("should return empty list when nothing has changed", func(t *testing.T) {
		channelId := model.NewId()
		userId := model.NewId()

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		postList, err := ss.Post().GetPostsSince(channelId, post1.CreateAt, false)
		assert.Nil(t, err)

		assert.Equal(t, []string{}, postList.Order)
		assert.Empty(t, postList.Posts)
	})

	t.Run("should not cache a timestamp of 0 when nothing has changed", func(t *testing.T) {
		ss.Post().ClearCaches()

		channelId := model.NewId()
		userId := model.NewId()

		post1, err := ss.Post().Save(&model.Post{
			ChannelId: channelId,
			UserId:    userId,
			Message:   "message",
		})
		require.Nil(t, err)
		time.Sleep(time.Millisecond)

		// Make a request that returns no results
		postList, err := ss.Post().GetPostsSince(channelId, post1.CreateAt, true)
		require.Nil(t, err)
		require.Equal(t, model.NewPostList(), postList)

		// And then ensure that it doesn't cause future requests to also return no results
		postList, err = ss.Post().GetPostsSince(channelId, post1.CreateAt-1, true)
		assert.Nil(t, err)

		assert.Equal(t, []string{post1.Id}, postList.Order)

		assert.Len(t, postList.Posts, 1)
		assert.NotNil(t, postList.Posts[post1.Id])
	})
}

func testPostStoreGetPostBeforeAfter(t *testing.T, ss store.Store) {
	channelId := model.NewId()

	o0 := &model.Post{}
	o0.ChannelId = channelId
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	_, err := ss.Post().Save(o0)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = channelId
	o1.Type = model.POST_JOIN_CHANNEL
	o1.UserId = model.NewId()
	o1.Message = "system_join_channel message"
	_, err = ss.Post().Save(o1)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o0a := &model.Post{}
	o0a.ChannelId = channelId
	o0a.UserId = model.NewId()
	o0a.Message = "zz" + model.NewId() + "b"
	o0a.ParentId = o1.Id
	o0a.RootId = o1.Id
	_, err = ss.Post().Save(o0a)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o0b := &model.Post{}
	o0b.ChannelId = channelId
	o0b.UserId = model.NewId()
	o0b.Message = "deleted message"
	o0b.ParentId = o1.Id
	o0b.RootId = o1.Id
	o0b.DeleteAt = 1
	_, err = ss.Post().Save(o0b)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	otherChannelPost := &model.Post{}
	otherChannelPost.ChannelId = model.NewId()
	otherChannelPost.UserId = model.NewId()
	otherChannelPost.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(otherChannelPost)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = channelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(o2)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = channelId
	o2a.UserId = model.NewId()
	o2a.Message = "zz" + model.NewId() + "b"
	o2a.ParentId = o2.Id
	o2a.RootId = o2.Id
	_, err = ss.Post().Save(o2a)
	require.Nil(t, err)

	rPostId1, err := ss.Post().GetPostIdBeforeTime(channelId, o0a.CreateAt)
	require.Equal(t, rPostId1, o1.Id, "should return before post o1")
	require.Nil(t, err)

	rPostId1, err = ss.Post().GetPostIdAfterTime(channelId, o0b.CreateAt)
	require.Equal(t, rPostId1, o2.Id, "should return before post o2")
	require.Nil(t, err)

	rPost1, err := ss.Post().GetPostAfterTime(channelId, o0b.CreateAt)
	require.Equal(t, rPost1.Id, o2.Id, "should return before post o2")
	require.Nil(t, err)

	rPostId2, err := ss.Post().GetPostIdBeforeTime(channelId, o0.CreateAt)
	require.Empty(t, rPostId2, "should return no post")
	require.Nil(t, err)

	rPostId2, err = ss.Post().GetPostIdAfterTime(channelId, o0.CreateAt)
	require.Equal(t, rPostId2, o1.Id, "should return before post o1")
	require.Nil(t, err)

	rPost2, err := ss.Post().GetPostAfterTime(channelId, o0.CreateAt)
	require.Equal(t, rPost2.Id, o1.Id, "should return before post o1")
	require.Nil(t, err)

	rPostId3, err := ss.Post().GetPostIdBeforeTime(channelId, o2a.CreateAt)
	require.Equal(t, rPostId3, o2.Id, "should return before post o2")
	require.Nil(t, err)

	rPostId3, err = ss.Post().GetPostIdAfterTime(channelId, o2a.CreateAt)
	require.Empty(t, rPostId3, "should return no post")
	require.Nil(t, err)

	rPost3, err := ss.Post().GetPostAfterTime(channelId, o2a.CreateAt)
	require.Empty(t, rPost3, "should return no post")
	require.Nil(t, err)
}

func testPostStoreSearch(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	userId := model.NewId()

	u1 := &model.User{}
	u1.Username = "usera1"
	u1.Email = MakeEmail()
	u1, err := ss.User().Save(u1)
	require.Nil(t, err)

	t1 := &model.TeamMember{}
	t1.TeamId = teamId
	t1.UserId = u1.Id
	_, err = ss.Team().SaveMember(t1, 1000)
	require.Nil(t, err)

	u2 := &model.User{}
	u2.Username = "userb2"
	u2.Email = MakeEmail()
	u2, err = ss.User().Save(u2)
	require.Nil(t, err)

	t2 := &model.TeamMember{}
	t2.TeamId = teamId
	t2.UserId = u2.Id
	_, err = ss.Team().SaveMember(t2, 1000)
	require.Nil(t, err)

	u3 := &model.User{}
	u3.Username = "userc3"
	u3.Email = MakeEmail()
	u3, err = ss.User().Save(u3)
	require.Nil(t, err)

	t3 := &model.TeamMember{}
	t3.TeamId = teamId
	t3.UserId = u3.Id
	_, err = ss.Team().SaveMember(t3, 1000)
	require.Nil(t, err)

	c1 := &model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Channel1"
	c1.Name = "channel-x"
	c1.Type = model.CHANNEL_OPEN
	c1, _ = ss.Channel().Save(c1, -1)

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = userId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(&m1)
	require.Nil(t, err)

	c2 := &model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Channel2"
	c2.Name = "channel-y"
	c2.Type = model.CHANNEL_OPEN
	c2, _ = ss.Channel().Save(c2, -1)

	c3 := &model.Channel{}
	c3.TeamId = teamId
	c3.DisplayName = "Channel3"
	c3.Name = "channel-z"
	c3.Type = model.CHANNEL_OPEN
	c3, _ = ss.Channel().Save(c3, -1)

	ss.Channel().Delete(c3.Id, model.GetMillis())

	m3 := model.ChannelMember{}
	m3.ChannelId = c3.Id
	m3.UserId = userId
	m3.NotifyProps = model.GetDefaultChannelNotifyProps()
	_, err = ss.Channel().SaveMember(&m3)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = u1.Id
	o1.Message = "corey mattermost new york United States"
	o1, err = ss.Post().Save(o1)
	require.Nil(t, err)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.Message = "corey mattermost new york United States"
	o1a.Type = model.POST_JOIN_CHANNEL
	_, err = ss.Post().Save(o1a)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = u2.Id
	o2.Message = "New Jersey United States is where John is from"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = c2.Id
	o3.UserId = model.NewId()
	o3.Message = "New Jersey United States is where John is from corey new york"
	_, err = ss.Post().Save(o3)
	require.Nil(t, err)

	o4 := &model.Post{}
	o4.ChannelId = c1.Id
	o4.UserId = model.NewId()
	o4.Hashtags = "#hashtag #tagme"
	o4.Message = "(message)blargh"
	o4, err = ss.Post().Save(o4)
	require.Nil(t, err)

	o5 := &model.Post{}
	o5.ChannelId = c1.Id
	o5.UserId = model.NewId()
	o5.Hashtags = "#secret #howdy #tagme"
	o5, err = ss.Post().Save(o5)
	require.Nil(t, err)

	o6 := &model.Post{}
	o6.ChannelId = c3.Id
	o6.UserId = model.NewId()
	o6.Hashtags = "#hashtag"
	o6, err = ss.Post().Save(o6)
	require.Nil(t, err)

	o7 := &model.Post{}
	o7.ChannelId = c3.Id
	o7.UserId = u3.Id
	o7.Message = "New Jersey United States is where John is from corey new york"
	o7, err = ss.Post().Save(o7)
	require.Nil(t, err)

	o8 := &model.Post{}
	o8.ChannelId = c3.Id
	o8.UserId = model.NewId()
	o8.Message = "Deleted"
	o8, err = ss.Post().Save(o8)
	require.Nil(t, err)

	tt := []struct {
		name                     string
		searchParams             *model.SearchParams
		expectedResultsCount     int
		expectedMessageResultIds []string
	}{
		{
			"normal-search-1",
			&model.SearchParams{Terms: "corey"},
			1,
			[]string{o1.Id},
		},
		{
			"normal-search-2",
			&model.SearchParams{Terms: "new"},
			2,
			[]string{o1.Id, o2.Id},
		},
		{
			"normal-search-3",
			&model.SearchParams{Terms: "john"},
			1,
			[]string{o2.Id},
		},
		{
			"wildcard-search",
			&model.SearchParams{Terms: "matter*"},
			1,
			[]string{o1.Id},
		},
		{
			"hashtag-search",
			&model.SearchParams{Terms: "#hashtag", IsHashtag: true},
			1,
			[]string{o4.Id},
		},
		{
			"hashtag-search-2",
			&model.SearchParams{Terms: "#secret", IsHashtag: true},
			1,
			[]string{o5.Id},
		},
		{
			"hashtag-search-with-exclusion",
			&model.SearchParams{Terms: "#tagme", ExcludedTerms: "#hashtag", IsHashtag: true},
			1,
			[]string{o5.Id},
		},
		{
			"no-match-mention",
			&model.SearchParams{Terms: "@thisshouldmatchnothing", IsHashtag: true},
			0,
			[]string{},
		},
		{
			"no-results-search",
			&model.SearchParams{Terms: "mattermost jersey"},
			0,
			[]string{},
		},
		{
			"exclude-search",
			&model.SearchParams{Terms: "united", ExcludedTerms: "jersey"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-words-search",
			&model.SearchParams{Terms: "corey new york"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-words-with-exclusion-search",
			&model.SearchParams{Terms: "united states", ExcludedTerms: "jersey"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-excluded-words-search",
			&model.SearchParams{Terms: "united", ExcludedTerms: "corey john"},
			0,
			[]string{},
		},
		{
			"multiple-wildcard-search",
			&model.SearchParams{Terms: "matter* jer*"},
			0,
			[]string{},
		},
		{
			"multiple-wildcard-with-exclusion-search",
			&model.SearchParams{Terms: "unite* state*", ExcludedTerms: "jers*"},
			1,
			[]string{o1.Id},
		},
		{
			"multiple-wildcard-excluded-words-search",
			&model.SearchParams{Terms: "united states", ExcludedTerms: "jers* yor*"},
			0,
			[]string{},
		},
		{
			"search-with-work-next-to-a-symbol",
			&model.SearchParams{Terms: "message blargh"},
			1,
			[]string{o4.Id},
		},
		{
			"search-with-or",
			&model.SearchParams{Terms: "Jersey corey", OrTerms: true},
			2,
			[]string{o1.Id, o2.Id},
		},
		{
			"exclude-search-with-or",
			&model.SearchParams{Terms: "york jersey", ExcludedTerms: "john", OrTerms: true},
			1,
			[]string{o1.Id},
		},
		{
			"search-with-from-user",
			&model.SearchParams{Terms: "united states", FromUsers: []string{"usera1"}, IncludeDeletedChannels: true},
			1,
			[]string{o1.Id},
		},
		{
			"search-with-multiple-from-user",
			&model.SearchParams{Terms: "united states", FromUsers: []string{"usera1", "userc3"}, IncludeDeletedChannels: true},
			2,
			[]string{o1.Id, o7.Id},
		},
		{
			"search-with-excluded-user",
			&model.SearchParams{Terms: "united states", ExcludedUsers: []string{"usera1"}, IncludeDeletedChannels: true},
			2,
			[]string{o2.Id, o7.Id},
		},
		{
			"search-with-multiple-excluded-user",
			&model.SearchParams{Terms: "united states", ExcludedUsers: []string{"usera1", "userb2"}, IncludeDeletedChannels: true},
			1,
			[]string{o7.Id},
		},
		{
			"search-with-deleted-and-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", InChannels: []string{"channel-x"}, IncludeDeletedChannels: true, OrTerms: true},
			2,
			[]string{o1.Id, o2.Id},
		},
		{
			"search-with-deleted-and-multiple-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", InChannels: []string{"channel-x", "channel-z"}, IncludeDeletedChannels: true, OrTerms: true},
			3,
			[]string{o1.Id, o2.Id, o7.Id},
		},
		{
			"search-with-deleted-and-excluded-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", ExcludedChannels: []string{"channel-x"}, IncludeDeletedChannels: true, OrTerms: true},
			1,
			[]string{o7.Id},
		},
		{
			"search-with-deleted-and-multiple-excluded-channel-filter",
			&model.SearchParams{Terms: "Jersey corey", ExcludedChannels: []string{"channel-x", "channel-z"}, IncludeDeletedChannels: true, OrTerms: true},
			0,
			[]string{},
		},
		{
			"search-with-or-and-deleted",
			&model.SearchParams{Terms: "Jersey corey", OrTerms: true, IncludeDeletedChannels: true},
			3,
			[]string{o1.Id, o2.Id, o7.Id},
		},
		{
			"search-hashtag-deleted",
			&model.SearchParams{Terms: "#hashtag", IsHashtag: true, IncludeDeletedChannels: true},
			2,
			[]string{o4.Id, o6.Id},
		},
		{
			"search-deleted-only",
			&model.SearchParams{Terms: "Deleted", IncludeDeletedChannels: true},
			1,
			[]string{o8.Id},
		},
	}
	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			result, err := ss.Post().Search(teamId, userId, tc.searchParams)
			require.Nil(t, err)
			require.Len(t, result.Order, tc.expectedResultsCount)
			for _, expectedMessageResultId := range tc.expectedMessageResultIds {
				assert.Contains(t, result.Order, expectedMessageResultId)
			}
		})
	}
}

func testUserCountsWithPostsByDay(t *testing.T, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	t1, err := ss.Team().Save(t1)
	require.Nil(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1, err = ss.Channel().Save(c1, -1)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = "zz" + model.NewId() + "b"
	o1, err = ss.Post().Save(o1)
	require.Nil(t, err)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(o1a)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2.Message = "zz" + model.NewId() + "b"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2a.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(o2a)
	require.Nil(t, err)

	r1, err := ss.Post().AnalyticsUserCountsWithPostsByDay(t1.Id)
	require.Nil(t, err)

	row1 := r1[0]
	require.Equal(t, float64(2), row1.Value, "wrong value")

	row2 := r1[1]
	require.Equal(t, float64(1), row2.Value, "wrong value")
}

func testPostCountsByDay(t *testing.T, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	t1, err := ss.Team().Save(t1)
	require.Nil(t, err)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1, err = ss.Channel().Save(c1, -1)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = "zz" + model.NewId() + "b"
	o1, err = ss.Post().Save(o1)
	require.Nil(t, err)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(o1a)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2.Message = "zz" + model.NewId() + "b"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2a.Message = "zz" + model.NewId() + "b"
	_, err = ss.Post().Save(o2a)
	require.Nil(t, err)

	bot1 := &model.Bot{
		Username:    "username",
		Description: "a bot",
		OwnerId:     model.NewId(),
		UserId:      model.NewId(),
	}
	_, err = ss.Bot().Save(bot1)
	require.Nil(t, err)

	b1 := &model.Post{}
	b1.Message = "bot message one"
	b1.ChannelId = c1.Id
	b1.UserId = bot1.UserId
	b1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	_, err = ss.Post().Save(b1)
	require.Nil(t, err)

	b1a := &model.Post{}
	b1a.Message = "bot message two"
	b1a.ChannelId = c1.Id
	b1a.UserId = bot1.UserId
	b1a.CreateAt = utils.MillisFromTime(utils.Yesterday()) - (1000 * 60 * 60 * 24 * 2)
	_, err = ss.Post().Save(b1a)
	require.Nil(t, err)

	time.Sleep(1 * time.Second)

	// summary of posts
	// yesterday - 2 non-bot user posts, 1 bot user post
	// 3 days ago - 2 non-bot user posts, 1 bot user post

	// last 31 days, all users (including bots)
	postCountsOptions := &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: false, YesterdayOnly: false}
	r1, err := ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.Nil(t, err)
	assert.Equal(t, float64(3), r1[0].Value)
	assert.Equal(t, float64(3), r1[1].Value)

	// last 31 days, bots only
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: true, YesterdayOnly: false}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.Nil(t, err)
	assert.Equal(t, float64(1), r1[0].Value)
	assert.Equal(t, float64(1), r1[1].Value)

	// yesterday only, all users (including bots)
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: false, YesterdayOnly: true}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.Nil(t, err)
	assert.Equal(t, float64(3), r1[0].Value)

	// yesterday only, bots only
	postCountsOptions = &model.AnalyticsPostCountsOptions{TeamId: t1.Id, BotsOnly: true, YesterdayOnly: true}
	r1, err = ss.Post().AnalyticsPostCountsByDay(postCountsOptions)
	require.Nil(t, err)
	assert.Equal(t, float64(1), r1[0].Value)

	// total
	r2, err := ss.Post().AnalyticsPostCount(t1.Id, false, false)
	require.Nil(t, err)
	assert.Equal(t, int64(6), r2)
}

func testPostStoreGetFlaggedPostsForTeam(t *testing.T, ss store.Store, s SqlSupplier) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1, err := ss.Channel().Save(c1, -1)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err = ss.Post().Save(o1)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4, err = ss.Post().Save(o4)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	c2 := &model.Channel{}
	c2.DisplayName = "DMChannel1"
	c2.Name = "zz" + model.NewId() + "b"
	c2.Type = model.CHANNEL_DIRECT

	m1 := &model.ChannelMember{}
	m1.ChannelId = c2.Id
	m1.UserId = o1.UserId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := &model.ChannelMember{}
	m2.ChannelId = c2.Id
	m2.UserId = model.NewId()
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	c2, err = ss.Channel().SaveDirectChannel(c2, m1, m2)
	require.Nil(t, err)

	o5 := &model.Post{}
	o5.ChannelId = c2.Id
	o5.UserId = m2.UserId
	o5.Message = "zz" + model.NewId() + "b"
	o5, err = ss.Post().Save(o5)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	r1, err := ss.Post().GetFlaggedPosts(o1.ChannelId, 0, 2)
	require.Nil(t, err)

	require.Empty(t, r1.Order, "should be empty")

	preferences := model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o1.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r2, err := ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r2.Order, 1, "should have 1 post")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o2.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r3, err := ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 1)
	require.Nil(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 1, 1)
	require.Nil(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 1000, 10)
	require.Nil(t, err)
	require.Empty(t, r3.Order, "should be empty")

	r4, err := ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o3.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o4.Id,
			Value:    "true",
		},
	}
	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, model.NewId(), 0, 2)
	require.Nil(t, err)
	require.Empty(t, r4.Order, "should have 0 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o5.Id,
			Value:    "true",
		},
	}
	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r4, err = ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 10)
	require.Nil(t, err)
	require.Len(t, r4.Order, 3, "should have 3 posts")

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testPostStoreGetFlaggedPosts(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	r1, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.Nil(t, err)
	require.Empty(t, r1.Order, "should be empty")

	preferences := model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o1.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r2, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r2.Order, 1, "should have 1 post")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o2.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r3, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 1)
	require.Nil(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPosts(o1.UserId, 1, 1)
	require.Nil(t, err)
	require.Len(t, r3.Order, 1, "should have 1 post")

	r3, err = ss.Post().GetFlaggedPosts(o1.UserId, 1000, 10)
	require.Nil(t, err)
	require.Empty(t, r3.Order, "should be empty")

	r4, err := ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o3.Id,
			Value:    "true",
		},
	}

	err = ss.Preference().Save(&preferences)
	require.Nil(t, err)

	r4, err = ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)
	require.Nil(t, err)
	require.Len(t, r4.Order, 2, "should have 2 posts")
}

func testPostStoreGetFlaggedPostsForChannel(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	// deleted post
	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = o1.ChannelId
	o3.Message = "zz" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4, err = ss.Post().Save(o4)
	require.Nil(t, err)
	time.Sleep(2 * time.Millisecond)

	r, err := ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)
	require.Nil(t, err)
	require.Empty(t, r.Order, "should be empty")

	preference := model.Preference{
		UserId:   o1.UserId,
		Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
		Name:     o1.Id,
		Value:    "true",
	}

	err = ss.Preference().Save(&model.Preferences{preference})
	require.Nil(t, err)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)
	require.Nil(t, err)
	require.Len(t, r.Order, 1, "should have 1 post")

	preference.Name = o2.Id
	err = ss.Preference().Save(&model.Preferences{preference})
	require.Nil(t, err)

	preference.Name = o3.Id
	err = ss.Preference().Save(&model.Preferences{preference})
	require.Nil(t, err)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 1)
	require.Nil(t, err)
	require.Len(t, r.Order, 1, "should have 1 post")

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 1, 1)
	require.Nil(t, err)
	require.Len(t, r.Order, 1, "should have 1 post")

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 1000, 10)
	require.Nil(t, err)
	require.Empty(t, r.Order, "should be empty")

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)
	require.Nil(t, err)
	require.Len(t, r.Order, 2, "should have 2 posts")

	preference.Name = o4.Id
	err = ss.Preference().Save(&model.Preferences{preference})
	require.Nil(t, err)

	r, err = ss.Post().GetFlaggedPostsForChannel(o1.UserId, o4.ChannelId, 0, 10)
	require.Nil(t, err)
	require.Len(t, r.Order, 1, "should have 1 posts")
}

func testPostStoreGetPostsCreatedAt(t *testing.T, ss store.Store) {
	createTime := model.GetMillis() + 1

	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	o0.CreateAt = createTime
	o0, err := ss.Post().Save(o0)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = o0.ChannelId
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1.CreateAt = createTime
	o1, err = ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2.CreateAt = createTime + 1
	_, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.CreateAt = createTime
	_, err = ss.Post().Save(o3)
	require.Nil(t, err)

	r1, _ := ss.Post().GetPostsCreatedAt(o1.ChannelId, createTime)
	assert.Equal(t, 2, len(r1))
}

func testPostStoreOverwrite(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	r1, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(o3.Id)
	require.Nil(t, err)
	ro3 := r3.Posts[o3.Id]

	require.Equal(t, ro1.Message, o1.Message, "Failed to save/get")

	o1a := &model.Post{}
	*o1a = *ro1
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	_, err = ss.Post().Overwrite(o1a)
	require.Nil(t, err)

	r1, err = ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro1a := r1.Posts[o1.Id]

	require.Equal(t, ro1a.Message, o1a.Message, "Failed to overwrite/get")

	o2a := &model.Post{}
	*o2a = *ro2
	o2a.Message = ro2.Message + "DDDDDDD"
	_, err = ss.Post().Overwrite(o2a)
	require.Nil(t, err)

	r2, err = ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro2a := r2.Posts[o2.Id]

	require.Equal(t, ro2a.Message, o2a.Message, "Failed to overwrite/get")

	o3a := &model.Post{}
	*o3a = *ro3
	o3a.Message = ro3.Message + "WWWWWWW"
	_, err = ss.Post().Overwrite(o3a)
	require.Nil(t, err)

	r3, err = ss.Post().Get(o3.Id)
	require.Nil(t, err)
	ro3a := r3.Posts[o3.Id]

	require.Equal(t, ro3a.Message, o3a.Message, "Failed to overwrite/get")

	o4, err := ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})
	require.Nil(t, err)

	r4, err := ss.Post().Get(o4.Id)
	require.Nil(t, err)
	ro4 := r4.Posts[o4.Id]

	o4a := &model.Post{}
	*o4a = *ro4
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	_, err = ss.Post().Overwrite(o4a)
	require.Nil(t, err)

	r4, err = ss.Post().Get(o4.Id)
	require.Nil(t, err)

	ro4a := r4.Posts[o4.Id]
	require.Empty(t, ro4a.Filenames, "Failed to clear Filenames")
	require.Len(t, ro4a.FileIds, 1, "Failed to set FileIds")
}

func testPostStoreGetPostsByIds(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	r1, err := ss.Post().Get(o1.Id)
	require.Nil(t, err)
	ro1 := r1.Posts[o1.Id]

	r2, err := ss.Post().Get(o2.Id)
	require.Nil(t, err)
	ro2 := r2.Posts[o2.Id]

	r3, err := ss.Post().Get(o3.Id)
	require.Nil(t, err)
	ro3 := r3.Posts[o3.Id]

	postIds := []string{
		ro1.Id,
		ro2.Id,
		ro3.Id,
	}

	posts, err := ss.Post().GetPostsByIds(postIds)
	require.Nil(t, err)
	require.Len(t, posts, 3, "Expected 3 posts in results. Got %v", len(posts))

	err = ss.Post().Delete(ro1.Id, model.GetMillis(), "")
	require.Nil(t, err)

	posts, err = ss.Post().GetPostsByIds(postIds)
	require.Nil(t, err)
	require.Len(t, posts, 3, "Expected 3 posts in results. Got %v", len(posts))
}

func testPostStoreGetPostsBatchForIndexing(t *testing.T, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1, _ = ss.Channel().Save(c1, -1)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = "zz" + model.NewId() + "b"
	c2.Type = model.CHANNEL_OPEN
	c2, _ = ss.Channel().Save(c2, -1)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = c2.Id
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = c1.Id
	o3.UserId = model.NewId()
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	r, err := ss.Post().GetPostsBatchForIndexing(o1.CreateAt, model.GetMillis()+100000, 100)
	require.Nil(t, err)
	require.Len(t, r, 3, "Expected 3 posts in results. Got %v", len(r))
	for _, p := range r {
		if p.Id == o1.Id {
			require.Equal(t, p.TeamId, c1.TeamId, "Unexpected team ID")
			require.Nil(t, p.ParentCreateAt, "Unexpected parent create at")
		} else if p.Id == o2.Id {
			require.Equal(t, p.TeamId, c2.TeamId, "Unexpected team ID")
			require.Nil(t, p.ParentCreateAt, "Unexpected parent create at")
		} else if p.Id == o3.Id {
			require.Equal(t, p.TeamId, c1.TeamId, "Unexpected team ID")
			require.Equal(t, *p.ParentCreateAt, o1.CreateAt, "Unexpected parent create at")
		} else {
			require.Fail(t, "unexpected post returned")
		}
	}
}

func testPostStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1.CreateAt = 1000
	o1, err := ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = model.NewId()
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o2.CreateAt = 1000
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o3.CreateAt = 100000
	o3, err = ss.Post().Save(o3)
	require.Nil(t, err)

	_, err = ss.Post().PermanentDeleteBatch(2000, 1000)
	require.Nil(t, err)

	_, err = ss.Post().Get(o1.Id)
	require.NotNil(t, err, "Should have not found post 1 after purge")

	_, err = ss.Post().Get(o2.Id)
	require.NotNil(t, err, "Should have not found post 2 after purge")

	_, err = ss.Post().Get(o3.Id)
	require.Nil(t, err, "Should have not found post 3 after purge")
}

func testPostStoreGetOldest(t *testing.T, ss store.Store) {
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	o0.CreateAt = 3
	o0, err := ss.Post().Save(o0)
	require.Nil(t, err)

	o1 := &model.Post{}
	o1.ChannelId = o0.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1.CreateAt = 2
	o1, err = ss.Post().Save(o1)
	require.Nil(t, err)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.CreateAt = 1
	o2, err = ss.Post().Save(o2)
	require.Nil(t, err)

	r1, err := ss.Post().GetOldest()

	require.Nil(t, err)
	assert.EqualValues(t, o2.Id, r1.Id)
}

func testGetMaxPostSize(t *testing.T, ss store.Store) {
	assert.Equal(t, model.POST_MESSAGE_MAX_RUNES_V2, ss.Post().GetMaxPostSize())
	assert.Equal(t, model.POST_MESSAGE_MAX_RUNES_V2, ss.Post().GetMaxPostSize())
}

func testPostStoreGetParentsForExportAfter(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = "zz" + model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	_, err := ss.Team().Save(&t1)
	require.Nil(t, err)

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	_, err = ss.Channel().Save(&c1, -1)
	require.Nil(t, err)

	u1 := model.User{}
	u1.Username = model.NewId()
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(&u1)
	require.Nil(t, err)

	p1 := &model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	p1.CreateAt = 1000
	p1, err = ss.Post().Save(p1)
	require.Nil(t, err)

	posts, err := ss.Post().GetParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, err)

	found := false
	for _, p := range posts {
		if p.Id == p1.Id {
			found = true
			assert.Equal(t, p.Id, p1.Id)
			assert.Equal(t, p.Message, p1.Message)
			assert.Equal(t, p.Username, u1.Username)
			assert.Equal(t, p.TeamName, t1.Name)
			assert.Equal(t, p.ChannelName, c1.Name)
		}
	}
	assert.True(t, found)
}

func testPostStoreGetRepliesForExport(t *testing.T, ss store.Store) {
	t1 := model.Team{}
	t1.DisplayName = "Name"
	t1.Name = "zz" + model.NewId()
	t1.Email = MakeEmail()
	t1.Type = model.TEAM_OPEN
	_, err := ss.Team().Save(&t1)
	require.Nil(t, err)

	c1 := model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	_, err = ss.Channel().Save(&c1, -1)
	require.Nil(t, err)

	u1 := model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err = ss.User().Save(&u1)
	require.Nil(t, err)

	p1 := &model.Post{}
	p1.ChannelId = c1.Id
	p1.UserId = u1.Id
	p1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	p1.CreateAt = 1000
	p1, err = ss.Post().Save(p1)
	require.Nil(t, err)

	p2 := &model.Post{}
	p2.ChannelId = c1.Id
	p2.UserId = u1.Id
	p2.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	p2.CreateAt = 1001
	p2.ParentId = p1.Id
	p2.RootId = p1.Id
	p2, err = ss.Post().Save(p2)
	require.Nil(t, err)

	r1, err := ss.Post().GetRepliesForExport(p1.Id)
	assert.Nil(t, err)

	assert.Len(t, r1, 1)

	reply1 := r1[0]
	assert.Equal(t, reply1.Id, p2.Id)
	assert.Equal(t, reply1.Message, p2.Message)
	assert.Equal(t, reply1.Username, u1.Username)

	// Checking whether replies by deleted user are exported
	u1.DeleteAt = 1002
	_, err = ss.User().Update(&u1, false)
	require.Nil(t, err)

	r1, err = ss.Post().GetRepliesForExport(p1.Id)
	assert.Nil(t, err)

	assert.Len(t, r1, 1)

	reply1 = r1[0]
	assert.Equal(t, reply1.Id, p2.Id)
	assert.Equal(t, reply1.Message, p2.Message)
	assert.Equal(t, reply1.Username, u1.Username)

}

func testPostStoreGetDirectPostParentsForExportAfter(t *testing.T, ss store.Store, s SqlSupplier) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_DIRECT

	u1 := &model.User{}
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(u1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.Nil(t, err)

	u2 := &model.User{}
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(u2)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.Nil(t, err)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	ss.Channel().SaveDirectChannel(&o1, &m1, &m2)

	p1 := &model.Post{}
	p1.ChannelId = o1.Id
	p1.UserId = u1.Id
	p1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	p1.CreateAt = 1000
	p1, err = ss.Post().Save(p1)
	require.Nil(t, err)

	r1, err := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, err)

	assert.Equal(t, p1.Message, r1[0].Message)

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testPostStoreGetDirectPostParentsForExportAfterDeleted(t *testing.T, ss store.Store, s SqlSupplier) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_DIRECT

	u1 := &model.User{}
	u1.DeleteAt = 1
	u1.Email = MakeEmail()
	u1.Nickname = model.NewId()
	_, err := ss.User().Save(u1)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
	require.Nil(t, err)

	u2 := &model.User{}
	u2.DeleteAt = 1
	u2.Email = MakeEmail()
	u2.Nickname = model.NewId()
	_, err = ss.User().Save(u2)
	require.Nil(t, err)
	_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
	require.Nil(t, err)

	m1 := model.ChannelMember{}
	m1.ChannelId = o1.Id
	m1.UserId = u1.Id
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()

	m2 := model.ChannelMember{}
	m2.ChannelId = o1.Id
	m2.UserId = u2.Id
	m2.NotifyProps = model.GetDefaultChannelNotifyProps()

	ss.Channel().SaveDirectChannel(&o1, &m1, &m2)

	o1.DeleteAt = 1
	err = ss.Channel().SetDeleteAt(o1.Id, 1, 1)
	assert.Nil(t, err)

	p1 := &model.Post{}
	p1.ChannelId = o1.Id
	p1.UserId = u1.Id
	p1.Message = "zz" + model.NewId() + "BBBBBBBBBBBB"
	p1.CreateAt = 1000
	p1, err = ss.Post().Save(p1)
	require.Nil(t, err)

	o1a := &model.Post{}
	*o1a = *p1
	o1a.DeleteAt = 1
	o1a.Message = p1.Message + "BBBBBBBBBB"
	_, err = ss.Post().Update(o1a, p1)
	require.Nil(t, err)

	r1, err := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, err)

	assert.Equal(t, 0, len(r1))

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}

func testPostStoreGetDirectPostParentsForExportAfterBatched(t *testing.T, ss store.Store, s SqlSupplier) {
	teamId := model.NewId()

	o1 := model.Channel{}
	o1.TeamId = teamId
	o1.DisplayName = "Name"
	o1.Name = "zz" + model.NewId() + "b"
	o1.Type = model.CHANNEL_DIRECT

	var postIds []string
	for i := 0; i < 150; i++ {
		u1 := &model.User{}
		u1.Email = MakeEmail()
		u1.Nickname = model.NewId()
		_, err := ss.User().Save(u1)
		require.Nil(t, err)
		_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u1.Id}, -1)
		require.Nil(t, err)

		u2 := &model.User{}
		u2.Email = MakeEmail()
		u2.Nickname = model.NewId()
		_, err = ss.User().Save(u2)
		require.Nil(t, err)
		_, err = ss.Team().SaveMember(&model.TeamMember{TeamId: model.NewId(), UserId: u2.Id}, -1)
		require.Nil(t, err)

		m1 := model.ChannelMember{}
		m1.ChannelId = o1.Id
		m1.UserId = u1.Id
		m1.NotifyProps = model.GetDefaultChannelNotifyProps()

		m2 := model.ChannelMember{}
		m2.ChannelId = o1.Id
		m2.UserId = u2.Id
		m2.NotifyProps = model.GetDefaultChannelNotifyProps()

		ss.Channel().SaveDirectChannel(&o1, &m1, &m2)

		p1 := &model.Post{}
		p1.ChannelId = o1.Id
		p1.UserId = u1.Id
		p1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
		p1.CreateAt = 1000
		p1, err = ss.Post().Save(p1)
		require.Nil(t, err)
		postIds = append(postIds, p1.Id)
	}
	sort.Slice(postIds, func(i, j int) bool { return postIds[i] < postIds[j] })

	// Get all posts
	r1, err := ss.Post().GetDirectPostParentsForExportAfter(10000, strings.Repeat("0", 26))
	assert.Nil(t, err)
	assert.Equal(t, len(postIds), len(r1))
	var exportedPostIds []string
	for i := range r1 {
		exportedPostIds = append(exportedPostIds, r1[i].Id)
	}
	sort.Slice(exportedPostIds, func(i, j int) bool { return exportedPostIds[i] < exportedPostIds[j] })
	assert.ElementsMatch(t, postIds, exportedPostIds)

	// Get 100
	r1, err = ss.Post().GetDirectPostParentsForExportAfter(100, strings.Repeat("0", 26))
	assert.Nil(t, err)
	assert.Equal(t, 100, len(r1))
	exportedPostIds = []string{}
	for i := range r1 {
		exportedPostIds = append(exportedPostIds, r1[i].Id)
	}
	sort.Slice(exportedPostIds, func(i, j int) bool { return exportedPostIds[i] < exportedPostIds[j] })
	assert.ElementsMatch(t, postIds[:100], exportedPostIds)

	// Manually truncate Channels table until testlib can handle cleanups
	s.GetMaster().Exec("TRUNCATE Channels")
}
