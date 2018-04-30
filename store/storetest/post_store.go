// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
)

func TestPostStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testPostStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testPostStoreGet(t, ss) })
	t.Run("GetSingle", func(t *testing.T) { testPostStoreGetSingle(t, ss) })
	t.Run("GetEtagCache", func(t *testing.T) { testGetEtagCache(t, ss) })
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
	t.Run("Search", func(t *testing.T) { testPostStoreSearch(t, ss) })
	t.Run("UserCountsWithPostsByDay", func(t *testing.T) { testUserCountsWithPostsByDay(t, ss) })
	t.Run("PostCountsByDay", func(t *testing.T) { testPostCountsByDay(t, ss) })
	t.Run("GetFlaggedPostsForTeam", func(t *testing.T) { testPostStoreGetFlaggedPostsForTeam(t, ss) })
	t.Run("GetFlaggedPosts", func(t *testing.T) { testPostStoreGetFlaggedPosts(t, ss) })
	t.Run("GetFlaggedPostsForChannel", func(t *testing.T) { testPostStoreGetFlaggedPostsForChannel(t, ss) })
	t.Run("GetPostsCreatedAt", func(t *testing.T) { testPostStoreGetPostsCreatedAt(t, ss) })
	t.Run("Overwrite", func(t *testing.T) { testPostStoreOverwrite(t, ss) })
	t.Run("GetPostsByIds", func(t *testing.T) { testPostStoreGetPostsByIds(t, ss) })
	t.Run("GetPostsBatchForIndexing", func(t *testing.T) { testPostStoreGetPostsBatchForIndexing(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testPostStorePermanentDeleteBatch(t, ss) })
	t.Run("GetOldest", func(t *testing.T) { testPostStoreGetOldest(t, ss) })
	t.Run("TestGetMaxPostSize", func(t *testing.T) { testGetMaxPostSize(t, ss) })
}

func testPostStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	if err := (<-ss.Post().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-ss.Post().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func testPostStoreGet(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	etag1 := (<-ss.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	etag2 := (<-ss.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag2, fmt.Sprintf("%v.%v", model.CurrentVersion, o1.UpdateAt)) != 0 {
		t.Fatal("Invalid Etag")
	}

	if r1 := <-ss.Post().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.PostList).Posts[o1.Id].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned post")
		}
	}

	if err := (<-ss.Post().Get("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if err := (<-ss.Post().Get("")).Err; err == nil {
		t.Fatal("should fail for blank post ids")
	}
}

func testPostStoreGetSingle(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	if r1 := <-ss.Post().GetSingle(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Post).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned post")
		}
	}

	if err := (<-ss.Post().GetSingle("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func testGetEtagCache(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	etag1 := (<-ss.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	// This one should come from the cache
	etag2 := (<-ss.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag2, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	// We have not invalidated the cache so this should be the same as above
	etag3 := (<-ss.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag3, etag2) != 0 {
		t.Fatal("Invalid Etag")
	}

	ss.Post().InvalidateLastPostTimeCache(o1.ChannelId)

	// Invalidated cache so we should get a good result
	etag4 := (<-ss.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag4, fmt.Sprintf("%v.%v", model.CurrentVersion, o1.UpdateAt)) != 0 {
		t.Fatal("Invalid Etag")
	}
}

func testPostStoreUpdate(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	ro1 := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]
	ro2 := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]
	ro3 := (<-ss.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro1.Message != o1.Message {
		t.Fatal("Failed to save/get")
	}

	o1a := &model.Post{}
	*o1a = *ro1
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	if result := <-ss.Post().Update(o1a, ro1); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro1a := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]

	if ro1a.Message != o1a.Message {
		t.Fatal("Failed to update/get")
	}

	o2a := &model.Post{}
	*o2a = *ro2
	o2a.Message = ro2.Message + "DDDDDDD"
	if result := <-ss.Post().Update(o2a, ro2); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro2a := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]

	if ro2a.Message != o2a.Message {
		t.Fatal("Failed to update/get")
	}

	o3a := &model.Post{}
	*o3a = *ro3
	o3a.Message = ro3.Message + "WWWWWWW"
	if result := <-ss.Post().Update(o3a, ro3); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro3a := (<-ss.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro3a.Message != o3a.Message && ro3a.Hashtags != o3a.Hashtags {
		t.Fatal("Failed to update/get")
	}

	o4 := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})).(*model.Post)

	ro4 := (<-ss.Post().Get(o4.Id)).Data.(*model.PostList).Posts[o4.Id]

	o4a := &model.Post{}
	*o4a = *ro4
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	if result := <-ss.Post().Update(o4a, ro4); result.Err != nil {
		t.Fatal(result.Err)
	}

	if ro4a := store.Must(ss.Post().Get(o4.Id)).(*model.PostList).Posts[o4.Id]; len(ro4a.Filenames) != 0 {
		t.Fatal("Failed to clear Filenames")
	} else if len(ro4a.FileIds) != 1 {
		t.Fatal("Failed to set FileIds")
	}
}

func testPostStoreDelete(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"

	etag1 := (<-ss.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	if r1 := <-ss.Post().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.PostList).Posts[o1.Id].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned post")
		}
	}

	if r2 := <-ss.Post().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Post().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}

	etag2 := (<-ss.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag2, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}
}

func testPostStoreDelete1Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	if r2 := <-ss.Post().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Post().Get(o1.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r4 := (<-ss.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}
}

func testPostStoreDelete2Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o2.Id
	o3.RootId = o1.Id
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)

	if r2 := <-ss.Post().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Post().Get(o1.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r4 := (<-ss.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r5 := (<-ss.Post().Get(o3.Id)); r5.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r6 := <-ss.Post().Get(o4.Id); r6.Err != nil {
		t.Fatal(r6.Err)
	}
}

func testPostStorePermDelete1Level(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	if r2 := <-ss.Post().PermanentDeleteByUser(o2.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Post().Get(o1.Id)); r3.Err != nil {
		t.Fatal("Deleted id shouldn't have failed")
	}

	if r4 := (<-ss.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r2 := <-ss.Post().PermanentDeleteByChannel(o3.ChannelId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Post().Get(o3.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}
}

func testPostStorePermDelete1Level2(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	if r2 := <-ss.Post().PermanentDeleteByUser(o1.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-ss.Post().Get(o1.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r4 := (<-ss.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r5 := (<-ss.Post().Get(o3.Id)); r5.Err != nil {
		t.Fatal("Deleted id shouldn't have failed")
	}
}

func testPostStoreGetWithChildren(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o2.Id
	o3.RootId = o1.Id
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	if r1 := <-ss.Post().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		pl := r1.Data.(*model.PostList)
		if len(pl.Posts) != 3 {
			t.Fatal("invalid returned post")
		}
	}

	store.Must(ss.Post().Delete(o3.Id, model.GetMillis()))

	if r2 := <-ss.Post().Get(o1.Id); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		pl := r2.Data.(*model.PostList)
		if len(pl.Posts) != 2 {
			t.Fatal("invalid returned post")
		}
	}

	store.Must(ss.Post().Delete(o2.Id, model.GetMillis()))

	if r3 := <-ss.Post().Get(o1.Id); r3.Err != nil {
		t.Fatal(r3.Err)
	} else {
		pl := r3.Data.(*model.PostList)
		if len(pl.Posts) != 1 {
			t.Fatal("invalid returned post")
		}
	}
}

func testPostStoreGetPostsWithDetails(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "zz" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a = (<-ss.Post().Save(o2a)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "zz" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5 = (<-ss.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-ss.Post().GetPosts(o1.ChannelId, 0, 4, false)).Data.(*model.PostList)

	if r1.Order[0] != o5.Id {
		t.Fatal("invalid order")
	}

	if r1.Order[1] != o4.Id {
		t.Fatal("invalid order")
	}

	if r1.Order[2] != o3.Id {
		t.Fatal("invalid order")
	}

	if r1.Order[3] != o2a.Id {
		t.Fatal("invalid order")
	}

	if len(r1.Posts) != 6 { //the last 4, + o1 (o2a and o3's parent) + o2 (in same thread as o2a and o3)
		t.Fatal("wrong size")
	}

	if r1.Posts[o1.Id].Message != o1.Message {
		t.Fatal("Missing parent")
	}

	r2 := (<-ss.Post().GetPosts(o1.ChannelId, 0, 4, true)).Data.(*model.PostList)

	if r2.Order[0] != o5.Id {
		t.Fatal("invalid order")
	}

	if r2.Order[1] != o4.Id {
		t.Fatal("invalid order")
	}

	if r2.Order[2] != o3.Id {
		t.Fatal("invalid order")
	}

	if r2.Order[3] != o2a.Id {
		t.Fatal("invalid order")
	}

	if len(r2.Posts) != 6 { //the last 4, + o1 (o2a and o3's parent) + o2 (in same thread as o2a and o3)
		t.Fatal("wrong size")
	}

	if r2.Posts[o1.Id].Message != o1.Message {
		t.Fatal("Missing parent")
	}

	// Run once to fill cache
	<-ss.Post().GetPosts(o1.ChannelId, 0, 30, true)

	o6 := &model.Post{}
	o6.ChannelId = o1.ChannelId
	o6.UserId = model.NewId()
	o6.Message = "zz" + model.NewId() + "b"
	o6 = (<-ss.Post().Save(o6)).Data.(*model.Post)

	// Should only be 6 since we hit the cache
	r3 := (<-ss.Post().GetPosts(o1.ChannelId, 0, 30, true)).Data.(*model.PostList)
	assert.Equal(t, 6, len(r3.Order))

	ss.Post().InvalidateLastPostTimeCache(o1.ChannelId)

	// Cache was invalidated, we should get all the posts
	r4 := (<-ss.Post().GetPosts(o1.ChannelId, 0, 30, true)).Data.(*model.PostList)
	assert.Equal(t, 7, len(r4.Order))
}

func testPostStoreGetPostsBeforeAfter(t *testing.T, ss store.Store) {
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	o0 = (<-ss.Post().Save(o0)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "zz" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a = (<-ss.Post().Save(o2a)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "zz" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5 = (<-ss.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-ss.Post().GetPostsBefore(o1.ChannelId, o1.Id, 4, 0)).Data.(*model.PostList)

	if len(r1.Posts) != 0 {
		t.Fatal("Wrong size")
	}

	r2 := (<-ss.Post().GetPostsAfter(o1.ChannelId, o1.Id, 4, 0)).Data.(*model.PostList)

	if r2.Order[0] != o4.Id {
		t.Fatal("invalid order")
	}

	if r2.Order[1] != o3.Id {
		t.Fatal("invalid order")
	}

	if r2.Order[2] != o2a.Id {
		t.Fatal("invalid order")
	}

	if r2.Order[3] != o2.Id {
		t.Fatal("invalid order")
	}

	if len(r2.Posts) != 5 {
		t.Fatal("wrong size")
	}

	r3 := (<-ss.Post().GetPostsBefore(o3.ChannelId, o3.Id, 2, 0)).Data.(*model.PostList)

	if r3.Order[0] != o2a.Id {
		t.Fatal("invalid order")
	}

	if r3.Order[1] != o2.Id {
		t.Fatal("invalid order")
	}

	if len(r3.Posts) != 3 {
		t.Fatal("wrong size")
	}

	if r3.Posts[o1.Id].Message != o1.Message {
		t.Fatal("Missing parent")
	}
}

func testPostStoreGetPostsSince(t *testing.T, ss store.Store) {
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	o0 = (<-ss.Post().Save(o0)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "zz" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a = (<-ss.Post().Save(o2a)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "zz" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5 = (<-ss.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-ss.Post().GetPostsSince(o1.ChannelId, o1.CreateAt, false)).Data.(*model.PostList)

	if r1.Order[0] != o5.Id {
		t.Fatal("invalid order")
	}

	if r1.Order[1] != o4.Id {
		t.Fatal("invalid order")
	}

	if r1.Order[2] != o3.Id {
		t.Fatal("invalid order")
	}

	if r1.Order[3] != o2a.Id {
		t.Fatal("invalid order")
	}

	if len(r1.Posts) != 6 {
		t.Fatal("wrong size")
	}

	if r1.Posts[o1.Id].Message != o1.Message {
		t.Fatal("Missing parent")
	}

	r2 := (<-ss.Post().GetPostsSince(o1.ChannelId, o5.UpdateAt, true)).Data.(*model.PostList)

	if len(r2.Order) != 0 {
		t.Fatal("wrong size ", len(r2.Posts))
	}
}

func testPostStoreSearch(t *testing.T, ss store.Store) {
	teamId := model.NewId()
	userId := model.NewId()

	c1 := &model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = (<-ss.Channel().Save(c1, -1)).Data.(*model.Channel)

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = userId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	store.Must(ss.Channel().SaveMember(&m1))

	c2 := &model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Channel1"
	c2.Name = "zz" + model.NewId() + "b"
	c2.Type = model.CHANNEL_OPEN
	c2 = (<-ss.Channel().Save(c2, -1)).Data.(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "corey mattermost new york"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.Message = "corey mattermost new york"
	o1a.Type = model.POST_JOIN_CHANNEL
	o1a = (<-ss.Post().Save(o1a)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.Message = "New Jersey is where John is from"
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = c2.Id
	o3.UserId = model.NewId()
	o3.Message = "New Jersey is where John is from corey new york"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	o4 := &model.Post{}
	o4.ChannelId = c1.Id
	o4.UserId = model.NewId()
	o4.Hashtags = "#hashtag"
	o4.Message = "(message)blargh"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)

	o5 := &model.Post{}
	o5.ChannelId = c1.Id
	o5.UserId = model.NewId()
	o5.Hashtags = "#secret #howdy"
	o5 = (<-ss.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "corey", IsHashtag: false})).Data.(*model.PostList)
	if len(r1.Order) != 1 || r1.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r3 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "new", IsHashtag: false})).Data.(*model.PostList)
	if len(r3.Order) != 2 || (r3.Order[0] != o1.Id && r3.Order[1] != o1.Id) {
		t.Fatal("returned wrong search result")
	}

	r4 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "john", IsHashtag: false})).Data.(*model.PostList)
	if len(r4.Order) != 1 || r4.Order[0] != o2.Id {
		t.Fatal("returned wrong search result")
	}

	r5 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "matter*", IsHashtag: false})).Data.(*model.PostList)
	if len(r5.Order) != 1 || r5.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r6 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "#hashtag", IsHashtag: true})).Data.(*model.PostList)
	if len(r6.Order) != 1 || r6.Order[0] != o4.Id {
		t.Fatal("returned wrong search result")
	}

	r7 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "#secret", IsHashtag: true})).Data.(*model.PostList)
	if len(r7.Order) != 1 || r7.Order[0] != o5.Id {
		t.Fatal("returned wrong search result")
	}

	r8 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "@thisshouldmatchnothing", IsHashtag: true})).Data.(*model.PostList)
	if len(r8.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r9 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "mattermost jersey", IsHashtag: false})).Data.(*model.PostList)
	if len(r9.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r9a := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "corey new york", IsHashtag: false})).Data.(*model.PostList)
	if len(r9a.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r10 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "matter* jer*", IsHashtag: false})).Data.(*model.PostList)
	if len(r10.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r11 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "message blargh", IsHashtag: false})).Data.(*model.PostList)
	if len(r11.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r12 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "blargh>", IsHashtag: false})).Data.(*model.PostList)
	if len(r12.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r13 := (<-ss.Post().Search(teamId, userId, &model.SearchParams{Terms: "Jersey corey", IsHashtag: false, OrTerms: true})).Data.(*model.PostList)
	if len(r13.Order) != 2 {
		t.Fatal("returned wrong search result")
	}
}

func testUserCountsWithPostsByDay(t *testing.T, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = store.Must(ss.Channel().Save(c1, -1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = "zz" + model.NewId() + "b"
	o1 = store.Must(ss.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = "zz" + model.NewId() + "b"
	o1a = store.Must(ss.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2.Message = "zz" + model.NewId() + "b"
	o2 = store.Must(ss.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2a.Message = "zz" + model.NewId() + "b"
	o2a = store.Must(ss.Post().Save(o2a)).(*model.Post)

	if r1 := <-ss.Post().AnalyticsUserCountsWithPostsByDay(t1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		row1 := r1.Data.(model.AnalyticsRows)[0]
		if row1.Value != 2 {
			t.Fatal("wrong value")
		}

		row2 := r1.Data.(model.AnalyticsRows)[1]
		if row2.Value != 1 {
			t.Fatal("wrong value")
		}
	}
}

func testPostCountsByDay(t *testing.T, ss store.Store) {
	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "zz" + model.NewId() + "b"
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = store.Must(ss.Team().Save(t1)).(*model.Team)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = store.Must(ss.Channel().Save(c1, -1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = "zz" + model.NewId() + "b"
	o1 = store.Must(ss.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = "zz" + model.NewId() + "b"
	o1a = store.Must(ss.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2.Message = "zz" + model.NewId() + "b"
	o2 = store.Must(ss.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2a.Message = "zz" + model.NewId() + "b"
	o2a = store.Must(ss.Post().Save(o2a)).(*model.Post)

	time.Sleep(1 * time.Second)

	if r1 := <-ss.Post().AnalyticsPostCountsByDay(t1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		row1 := r1.Data.(model.AnalyticsRows)[0]
		if row1.Value != 2 {
			t.Fatal(row1)
		}

		row2 := r1.Data.(model.AnalyticsRows)[1]
		if row2.Value != 2 {
			t.Fatal("wrong value")
		}
	}

	if r1 := <-ss.Post().AnalyticsPostCount(t1.Id, false, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) != 4 {
			t.Fatal("wrong value")
		}
	}
}

func testPostStoreGetFlaggedPostsForTeam(t *testing.T, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = store.Must(ss.Channel().Save(c1, -1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)
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

	c2 = store.Must(ss.Channel().SaveDirectChannel(c2, m1, m2)).(*model.Channel)

	o5 := &model.Post{}
	o5.ChannelId = c2.Id
	o5.UserId = m2.UserId
	o5.Message = "zz" + model.NewId() + "b"
	o5 = (<-ss.Post().Save(o5)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	r1 := (<-ss.Post().GetFlaggedPosts(o1.ChannelId, 0, 2)).Data.(*model.PostList)

	if len(r1.Order) != 0 {
		t.Fatal("should be empty")
	}

	preferences := model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o1.Id,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&preferences))

	r2 := (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

	if len(r2.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o2.Id,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&preferences))

	r3 := (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 1)).Data.(*model.PostList)

	if len(r3.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r3 = (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 1, 1)).Data.(*model.PostList)

	if len(r3.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r3 = (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 1000, 10)).Data.(*model.PostList)

	if len(r3.Order) != 0 {
		t.Fatal("should be empty")
	}

	r4 := (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o3.Id,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&preferences))

	r4 = (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o4.Id,
			Value:    "true",
		},
	}
	store.Must(ss.Preference().Save(&preferences))

	r4 = (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}

	r4 = (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, model.NewId(), 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 0 {
		t.Fatal("should have 0 posts")
	}

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o5.Id,
			Value:    "true",
		},
	}
	store.Must(ss.Preference().Save(&preferences))

	r4 = (<-ss.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 10)).Data.(*model.PostList)

	if len(r4.Order) != 3 {
		t.Fatal("should have 3 posts")
	}
}

func testPostStoreGetFlaggedPosts(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	r1 := (<-ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

	if len(r1.Order) != 0 {
		t.Fatal("should be empty")
	}

	preferences := model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o1.Id,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&preferences))

	r2 := (<-ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

	if len(r2.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o2.Id,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&preferences))

	r3 := (<-ss.Post().GetFlaggedPosts(o1.UserId, 0, 1)).Data.(*model.PostList)

	if len(r3.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r3 = (<-ss.Post().GetFlaggedPosts(o1.UserId, 1, 1)).Data.(*model.PostList)

	if len(r3.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r3 = (<-ss.Post().GetFlaggedPosts(o1.UserId, 1000, 10)).Data.(*model.PostList)

	if len(r3.Order) != 0 {
		t.Fatal("should be empty")
	}

	r4 := (<-ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}

	preferences = model.Preferences{
		{
			UserId:   o1.UserId,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     o3.Id,
			Value:    "true",
		},
	}

	store.Must(ss.Preference().Save(&preferences))

	r4 = (<-ss.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}
}

func testPostStoreGetFlaggedPostsForChannel(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	// deleted post
	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = o1.ChannelId
	o3.Message = "zz" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "zz" + model.NewId() + "b"
	o4 = (<-ss.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	r := (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)).Data.(*model.PostList)

	if len(r.Order) != 0 {
		t.Fatal("should be empty")
	}

	preference := model.Preference{
		UserId:   o1.UserId,
		Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
		Name:     o1.Id,
		Value:    "true",
	}

	store.Must(ss.Preference().Save(&model.Preferences{preference}))

	r = (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)).Data.(*model.PostList)

	if len(r.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	preference.Name = o2.Id
	store.Must(ss.Preference().Save(&model.Preferences{preference}))

	preference.Name = o3.Id
	store.Must(ss.Preference().Save(&model.Preferences{preference}))

	r = (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 1)).Data.(*model.PostList)

	if len(r.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r = (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 1, 1)).Data.(*model.PostList)

	if len(r.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r = (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 1000, 10)).Data.(*model.PostList)

	if len(r.Order) != 0 {
		t.Fatal("should be empty")
	}

	r = (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o1.ChannelId, 0, 10)).Data.(*model.PostList)

	if len(r.Order) != 2 {
		t.Fatal("should have 2 posts")
	}

	preference.Name = o4.Id
	store.Must(ss.Preference().Save(&model.Preferences{preference}))

	r = (<-ss.Post().GetFlaggedPostsForChannel(o1.UserId, o4.ChannelId, 0, 10)).Data.(*model.PostList)

	if len(r.Order) != 1 {
		t.Fatal("should have 1 post")
	}
}

func testPostStoreGetPostsCreatedAt(t *testing.T, ss store.Store) {
	createTime := model.GetMillis() + 1

	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	o0.CreateAt = createTime
	o0 = (<-ss.Post().Save(o0)).Data.(*model.Post)

	o1 := &model.Post{}
	o1.ChannelId = o0.ChannelId
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1.CreateAt = createTime
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2.CreateAt = createTime + 1
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "b"
	o3.CreateAt = createTime
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	r1 := (<-ss.Post().GetPostsCreatedAt(o1.ChannelId, createTime)).Data.([]*model.Post)
	assert.Equal(t, 2, len(r1))
}

func testPostStoreOverwrite(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	ro1 := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]
	ro2 := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]
	ro3 := (<-ss.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro1.Message != o1.Message {
		t.Fatal("Failed to save/get")
	}

	o1a := &model.Post{}
	*o1a = *ro1
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	if result := <-ss.Post().Overwrite(o1a); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro1a := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]

	if ro1a.Message != o1a.Message {
		t.Fatal("Failed to overwrite/get")
	}

	o2a := &model.Post{}
	*o2a = *ro2
	o2a.Message = ro2.Message + "DDDDDDD"
	if result := <-ss.Post().Overwrite(o2a); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro2a := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]

	if ro2a.Message != o2a.Message {
		t.Fatal("Failed to overwrite/get")
	}

	o3a := &model.Post{}
	*o3a = *ro3
	o3a.Message = ro3.Message + "WWWWWWW"
	if result := <-ss.Post().Overwrite(o3a); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro3a := (<-ss.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro3a.Message != o3a.Message && ro3a.Hashtags != o3a.Hashtags {
		t.Fatal("Failed to overwrite/get")
	}

	o4 := store.Must(ss.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})).(*model.Post)

	ro4 := (<-ss.Post().Get(o4.Id)).Data.(*model.PostList).Posts[o4.Id]

	o4a := &model.Post{}
	*o4a = *ro4
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	if result := <-ss.Post().Overwrite(o4a); result.Err != nil {
		t.Fatal(result.Err)
	}

	if ro4a := store.Must(ss.Post().Get(o4.Id)).(*model.PostList).Posts[o4.Id]; len(ro4a.Filenames) != 0 {
		t.Fatal("Failed to clear Filenames")
	} else if len(ro4a.FileIds) != 1 {
		t.Fatal("Failed to set FileIds")
	}
}

func testPostStoreGetPostsByIds(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	ro1 := (<-ss.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]
	ro2 := (<-ss.Post().Get(o2.Id)).Data.(*model.PostList).Posts[o2.Id]
	ro3 := (<-ss.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	postIds := []string{
		ro1.Id,
		ro2.Id,
		ro3.Id,
	}

	if ro4 := store.Must(ss.Post().GetPostsByIds(postIds)).([]*model.Post); len(ro4) != 3 {
		t.Fatalf("Expected 3 posts in results. Got %v", len(ro4))
	}

	store.Must(ss.Post().Delete(ro1.Id, model.GetMillis()))

	if ro5 := store.Must(ss.Post().GetPostsByIds(postIds)).([]*model.Post); len(ro5) != 2 {
		t.Fatalf("Expected 2 posts in results. Got %v", len(ro5))
	}
}

func testPostStoreGetPostsBatchForIndexing(t *testing.T, ss store.Store) {
	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = "zz" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = (<-ss.Channel().Save(c1, -1)).Data.(*model.Channel)

	c2 := &model.Channel{}
	c2.TeamId = model.NewId()
	c2.DisplayName = "Channel2"
	c2.Name = "zz" + model.NewId() + "b"
	c2.Type = model.CHANNEL_OPEN
	c2 = (<-ss.Channel().Save(c2, -1)).Data.(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c2.Id
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "CCCCCCCCC"
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = c1.Id
	o3.UserId = model.NewId()
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3.Message = "zz" + model.NewId() + "QQQQQQQQQQ"
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	if r := store.Must(ss.Post().GetPostsBatchForIndexing(o1.CreateAt, model.GetMillis()+100000, 100)).([]*model.PostForIndexing); len(r) != 3 {
		t.Fatalf("Expected 3 posts in results. Got %v", len(r))
	} else {
		for _, p := range r {
			if p.Id == o1.Id {
				if p.TeamId != c1.TeamId {
					t.Fatalf("Unexpected team ID")
				}
				if p.ParentCreateAt != nil {
					t.Fatalf("Unexpected parent create at")
				}
			} else if p.Id == o2.Id {
				if p.TeamId != c2.TeamId {
					t.Fatalf("Unexpected team ID")
				}
				if p.ParentCreateAt != nil {
					t.Fatalf("Unexpected parent create at")
				}
			} else if p.Id == o3.Id {
				if p.TeamId != c1.TeamId {
					t.Fatalf("Unexpected team ID")
				}
				if *p.ParentCreateAt != o1.CreateAt {
					t.Fatalf("Unexpected parent create at")
				}
			} else {
				t.Fatalf("unexpected post returned")
			}
		}
	}
}

func testPostStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o1.CreateAt = 1000
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = model.NewId()
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o2.CreateAt = 1000
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "zz" + model.NewId() + "AAAAAAAAAAA"
	o3.CreateAt = 100000
	o3 = (<-ss.Post().Save(o3)).Data.(*model.Post)

	store.Must(ss.Post().PermanentDeleteBatch(2000, 1000))

	if p := <-ss.Post().Get(o1.Id); p.Err == nil {
		t.Fatalf("Should have not found post 1 after purge")
	}

	if p := <-ss.Post().Get(o2.Id); p.Err == nil {
		t.Fatalf("Should have not found post 2 after purge")
	}

	if p := <-ss.Post().Get(o3.Id); p.Err != nil {
		t.Fatalf("Should have found post 3 after purge")
	}
}

func testPostStoreGetOldest(t *testing.T, ss store.Store) {
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "zz" + model.NewId() + "b"
	o0.CreateAt = 3
	o0 = (<-ss.Post().Save(o0)).Data.(*model.Post)

	o1 := &model.Post{}
	o1.ChannelId = o0.Id
	o1.UserId = model.NewId()
	o1.Message = "zz" + model.NewId() + "b"
	o1.CreateAt = 2
	o1 = (<-ss.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "zz" + model.NewId() + "b"
	o2.CreateAt = 1
	o2 = (<-ss.Post().Save(o2)).Data.(*model.Post)

	r1 := (<-ss.Post().GetOldest()).Data.(*model.Post)

	assert.EqualValues(t, o2.Id, r1.Id)
}

func testGetMaxPostSize(t *testing.T, ss store.Store) {
	assert.Equal(t, model.POST_MESSAGE_MAX_RUNES_V2, (<-ss.Post().GetMaxPostSize()).Data.(int))
	assert.Equal(t, model.POST_MESSAGE_MAX_RUNES_V2, (<-ss.Post().GetMaxPostSize()).Data.(int))
}
