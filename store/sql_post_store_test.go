// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestPostStoreSave(t *testing.T) {
	Setup()

	o1 := model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"

	if err := (<-store.Post().Save(&o1)).Err; err != nil {
		t.Fatal("couldn't save item", err)
	}

	if err := (<-store.Post().Save(&o1)).Err; err == nil {
		t.Fatal("shouldn't be able to update from save")
	}
}

func TestPostStoreGet(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"

	etag1 := (<-store.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	etag2 := (<-store.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag2, fmt.Sprintf("%v.%v", model.CurrentVersion, o1.UpdateAt)) != 0 {
		t.Fatal("Invalid Etag")
	}

	if r1 := <-store.Post().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.PostList).Posts[o1.Id].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned post")
		}
	}

	if err := (<-store.Post().Get("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}

	if err := (<-store.Post().Get("")).Err; err == nil {
		t.Fatal("should fail for blank post ids")
	}
}

func TestPostStoreGetSingle(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"

	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	if r1 := <-store.Post().GetSingle(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Post).CreateAt != o1.CreateAt {
			t.Fatal("invalid returned post")
		}
	}

	if err := (<-store.Post().GetSingle("123")).Err; err == nil {
		t.Fatal("Missing id should have failed")
	}
}

func TestGetEtagCache(t *testing.T) {
	Setup()
	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"

	etag1 := (<-store.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	// This one should come from the cache
	etag2 := (<-store.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag2, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	// We have not invalidated the cache so this should be the same as above
	etag3 := (<-store.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag3, etag2) != 0 {
		t.Fatal("Invalid Etag")
	}

	store.Post().InvalidateLastPostTimeCache(o1.ChannelId)

	// Invalidated cache so we should get a good result
	etag4 := (<-store.Post().GetEtag(o1.ChannelId, true)).Data.(string)
	if strings.Index(etag4, fmt.Sprintf("%v.%v", model.CurrentVersion, o1.UpdateAt)) != 0 {
		t.Fatal("Invalid Etag")
	}
}

func TestPostStoreUpdate(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "AAAAAAAAAAA"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "CCCCCCCCC"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "QQQQQQQQQQ"
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	ro1 := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]
	ro2 := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]
	ro3 := (<-store.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro1.Message != o1.Message {
		t.Fatal("Failed to save/get")
	}

	o1a := &model.Post{}
	*o1a = *ro1
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	if result := <-store.Post().Update(o1a, ro1); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro1a := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]

	if ro1a.Message != o1a.Message {
		t.Fatal("Failed to update/get")
	}

	o2a := &model.Post{}
	*o2a = *ro2
	o2a.Message = ro2.Message + "DDDDDDD"
	if result := <-store.Post().Update(o2a, ro2); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro2a := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]

	if ro2a.Message != o2a.Message {
		t.Fatal("Failed to update/get")
	}

	o3a := &model.Post{}
	*o3a = *ro3
	o3a.Message = ro3.Message + "WWWWWWW"
	if result := <-store.Post().Update(o3a, ro3); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro3a := (<-store.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro3a.Message != o3a.Message && ro3a.Hashtags != o3a.Hashtags {
		t.Fatal("Failed to update/get")
	}

	o4 := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})).(*model.Post)

	ro4 := (<-store.Post().Get(o4.Id)).Data.(*model.PostList).Posts[o4.Id]

	o4a := &model.Post{}
	*o4a = *ro4
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	if result := <-store.Post().Update(o4a, ro4); result.Err != nil {
		t.Fatal(result.Err)
	}

	if ro4a := Must(store.Post().Get(o4.Id)).(*model.PostList).Posts[o4.Id]; len(ro4a.Filenames) != 0 {
		t.Fatal("Failed to clear Filenames")
	} else if len(ro4a.FileIds) != 1 {
		t.Fatal("Failed to set FileIds")
	}
}

func TestPostStoreDelete(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"

	etag1 := (<-store.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	if r1 := <-store.Post().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.PostList).Posts[o1.Id].CreateAt != o1.CreateAt {
			t.Fatal("invalid returned post")
		}
	}

	if r2 := <-store.Post().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Post().Get(o1.Id)); r3.Err == nil {
		t.Log(r3.Data)
		t.Fatal("Missing id should have failed")
	}

	etag2 := (<-store.Post().GetEtag(o1.ChannelId, false)).Data.(string)
	if strings.Index(etag2, model.CurrentVersion+".") != 0 {
		t.Fatal("Invalid Etag")
	}
}

func TestPostStoreDelete1Level(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	if r2 := <-store.Post().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Post().Get(o1.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r4 := (<-store.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}
}

func TestPostStoreDelete2Level(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.ParentId = o2.Id
	o3.RootId = o1.Id
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "a" + model.NewId() + "b"
	o4 = (<-store.Post().Save(o4)).Data.(*model.Post)

	if r2 := <-store.Post().Delete(o1.Id, model.GetMillis()); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Post().Get(o1.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r4 := (<-store.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r5 := (<-store.Post().Get(o3.Id)); r5.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r6 := <-store.Post().Get(o4.Id); r6.Err != nil {
		t.Fatal(r6.Err)
	}
}

func TestPostStorePermDelete1Level(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	if r2 := <-store.Post().PermanentDeleteByUser(o2.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Post().Get(o1.Id)); r3.Err != nil {
		t.Fatal("Deleted id shouldn't have failed")
	}

	if r4 := (<-store.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r2 := <-store.Post().PermanentDeleteByChannel(o3.ChannelId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Post().Get(o3.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}
}

func TestPostStorePermDelete1Level2(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	if r2 := <-store.Post().PermanentDeleteByUser(o1.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}

	if r3 := (<-store.Post().Get(o1.Id)); r3.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r4 := (<-store.Post().Get(o2.Id)); r4.Err == nil {
		t.Fatal("Deleted id should have failed")
	}

	if r5 := (<-store.Post().Get(o3.Id)); r5.Err != nil {
		t.Fatal("Deleted id shouldn't have failed")
	}
}

func TestPostStoreGetWithChildren(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.ParentId = o2.Id
	o3.RootId = o1.Id
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	if r1 := <-store.Post().Get(o1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		pl := r1.Data.(*model.PostList)
		if len(pl.Posts) != 3 {
			t.Fatal("invalid returned post")
		}
	}

	Must(store.Post().Delete(o3.Id, model.GetMillis()))

	if r2 := <-store.Post().Get(o1.Id); r2.Err != nil {
		t.Fatal(r2.Err)
	} else {
		pl := r2.Data.(*model.PostList)
		if len(pl.Posts) != 2 {
			t.Fatal("invalid returned post")
		}
	}

	Must(store.Post().Delete(o2.Id, model.GetMillis()))

	if r3 := <-store.Post().Get(o1.Id); r3.Err != nil {
		t.Fatal(r3.Err)
	} else {
		pl := r3.Data.(*model.PostList)
		if len(pl.Posts) != 1 {
			t.Fatal("invalid returned post")
		}
	}
}

func TestPostStoreGetPostsWtihDetails(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "a" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a = (<-store.Post().Save(o2a)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "a" + model.NewId() + "b"
	o4 = (<-store.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "a" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5 = (<-store.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-store.Post().GetPosts(o1.ChannelId, 0, 4, false)).Data.(*model.PostList)

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

	r2 := (<-store.Post().GetPosts(o1.ChannelId, 0, 4, true)).Data.(*model.PostList)

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
}

func TestPostStoreGetPostsBeforeAfter(t *testing.T) {
	Setup()
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "a" + model.NewId() + "b"
	o0 = (<-store.Post().Save(o0)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "a" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a = (<-store.Post().Save(o2a)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "a" + model.NewId() + "b"
	o4 = (<-store.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "a" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5 = (<-store.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-store.Post().GetPostsBefore(o1.ChannelId, o1.Id, 4, 0)).Data.(*model.PostList)

	if len(r1.Posts) != 0 {
		t.Fatal("Wrong size")
	}

	r2 := (<-store.Post().GetPostsAfter(o1.ChannelId, o1.Id, 4, 0)).Data.(*model.PostList)

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

	r3 := (<-store.Post().GetPostsBefore(o3.ChannelId, o3.Id, 2, 0)).Data.(*model.PostList)

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

func TestPostStoreGetPostsSince(t *testing.T) {
	Setup()
	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "a" + model.NewId() + "b"
	o0 = (<-store.Post().Save(o0)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2a := &model.Post{}
	o2a.ChannelId = o1.ChannelId
	o2a.UserId = model.NewId()
	o2a.Message = "a" + model.NewId() + "b"
	o2a.ParentId = o1.Id
	o2a.RootId = o1.Id
	o2a = (<-store.Post().Save(o2a)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.ParentId = o1.Id
	o3.RootId = o1.Id
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = o1.ChannelId
	o4.UserId = model.NewId()
	o4.Message = "a" + model.NewId() + "b"
	o4 = (<-store.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o5 := &model.Post{}
	o5.ChannelId = o1.ChannelId
	o5.UserId = model.NewId()
	o5.Message = "a" + model.NewId() + "b"
	o5.ParentId = o4.Id
	o5.RootId = o4.Id
	o5 = (<-store.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-store.Post().GetPostsSince(o1.ChannelId, o1.CreateAt, false)).Data.(*model.PostList)

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

	r2 := (<-store.Post().GetPostsSince(o1.ChannelId, o5.UpdateAt, true)).Data.(*model.PostList)

	if len(r2.Order) != 0 {
		t.Fatal("wrong size ", len(r2.Posts))
	}
}

func TestPostStoreSearch(t *testing.T) {
	Setup()

	teamId := model.NewId()
	userId := model.NewId()

	c1 := &model.Channel{}
	c1.TeamId = teamId
	c1.DisplayName = "Channel1"
	c1.Name = "a" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = (<-store.Channel().Save(c1)).Data.(*model.Channel)

	m1 := model.ChannelMember{}
	m1.ChannelId = c1.Id
	m1.UserId = userId
	m1.NotifyProps = model.GetDefaultChannelNotifyProps()
	Must(store.Channel().SaveMember(&m1))

	c2 := &model.Channel{}
	c2.TeamId = teamId
	c2.DisplayName = "Channel1"
	c2.Name = "a" + model.NewId() + "b"
	c2.Type = model.CHANNEL_OPEN
	c2 = (<-store.Channel().Save(c2)).Data.(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "corey mattermost new york"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.Message = "corey mattermost new york"
	o1a.Type = model.POST_JOIN_CHANNEL
	o1a = (<-store.Post().Save(o1a)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.Message = "New Jersey is where John is from"
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = c2.Id
	o3.UserId = model.NewId()
	o3.Message = "New Jersey is where John is from corey new york"
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	o4 := &model.Post{}
	o4.ChannelId = c1.Id
	o4.UserId = model.NewId()
	o4.Hashtags = "#hashtag"
	o4.Message = "(message)blargh"
	o4 = (<-store.Post().Save(o4)).Data.(*model.Post)

	o5 := &model.Post{}
	o5.ChannelId = c1.Id
	o5.UserId = model.NewId()
	o5.Hashtags = "#secret #howdy"
	o5 = (<-store.Post().Save(o5)).Data.(*model.Post)

	r1 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "corey", IsHashtag: false})).Data.(*model.PostList)
	if len(r1.Order) != 1 || r1.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r3 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "new", IsHashtag: false})).Data.(*model.PostList)
	if len(r3.Order) != 2 || (r3.Order[0] != o1.Id && r3.Order[1] != o1.Id) {
		t.Fatal("returned wrong search result")
	}

	r4 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "john", IsHashtag: false})).Data.(*model.PostList)
	if len(r4.Order) != 1 || r4.Order[0] != o2.Id {
		t.Fatal("returned wrong search result")
	}

	r5 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "matter*", IsHashtag: false})).Data.(*model.PostList)
	if len(r5.Order) != 1 || r5.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r6 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "#hashtag", IsHashtag: true})).Data.(*model.PostList)
	if len(r6.Order) != 1 || r6.Order[0] != o4.Id {
		t.Fatal("returned wrong search result")
	}

	r7 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "#secret", IsHashtag: true})).Data.(*model.PostList)
	if len(r7.Order) != 1 || r7.Order[0] != o5.Id {
		t.Fatal("returned wrong search result")
	}

	r8 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "@thisshouldmatchnothing", IsHashtag: true})).Data.(*model.PostList)
	if len(r8.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r9 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "mattermost jersey", IsHashtag: false})).Data.(*model.PostList)
	if len(r9.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r9a := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "corey new york", IsHashtag: false})).Data.(*model.PostList)
	if len(r9a.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r10 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "matter* jer*", IsHashtag: false})).Data.(*model.PostList)
	if len(r10.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r11 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "message blargh", IsHashtag: false})).Data.(*model.PostList)
	if len(r11.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r12 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "blargh>", IsHashtag: false})).Data.(*model.PostList)
	if len(r12.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r13 := (<-store.Post().Search(teamId, userId, &model.SearchParams{Terms: "Jersey corey", IsHashtag: false, OrTerms: true})).Data.(*model.PostList)
	if len(r13.Order) != 2 {
		t.Fatal("returned wrong search result")
	}
}

func TestUserCountsWithPostsByDay(t *testing.T) {
	Setup()

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "a" + model.NewId() + "b"
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = Must(store.Team().Save(t1)).(*model.Team)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "a" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = Must(store.Channel().Save(c1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = "a" + model.NewId() + "b"
	o1 = Must(store.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = "a" + model.NewId() + "b"
	o1a = Must(store.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2.Message = "a" + model.NewId() + "b"
	o2 = Must(store.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24)
	o2a.Message = "a" + model.NewId() + "b"
	o2a = Must(store.Post().Save(o2a)).(*model.Post)

	if r1 := <-store.Post().AnalyticsUserCountsWithPostsByDay(t1.Id); r1.Err != nil {
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

func TestPostCountsByDay(t *testing.T) {
	Setup()

	t1 := &model.Team{}
	t1.DisplayName = "DisplayName"
	t1.Name = "a" + model.NewId() + "b"
	t1.Email = model.NewId() + "@nowhere.com"
	t1.Type = model.TEAM_OPEN
	t1 = Must(store.Team().Save(t1)).(*model.Team)

	c1 := &model.Channel{}
	c1.TeamId = t1.Id
	c1.DisplayName = "Channel2"
	c1.Name = "a" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = Must(store.Channel().Save(c1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.CreateAt = utils.MillisFromTime(utils.Yesterday())
	o1.Message = "a" + model.NewId() + "b"
	o1 = Must(store.Post().Save(o1)).(*model.Post)

	o1a := &model.Post{}
	o1a.ChannelId = c1.Id
	o1a.UserId = model.NewId()
	o1a.CreateAt = o1.CreateAt
	o1a.Message = "a" + model.NewId() + "b"
	o1a = Must(store.Post().Save(o1a)).(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = c1.Id
	o2.UserId = model.NewId()
	o2.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2.Message = "a" + model.NewId() + "b"
	o2 = Must(store.Post().Save(o2)).(*model.Post)

	o2a := &model.Post{}
	o2a.ChannelId = c1.Id
	o2a.UserId = o2.UserId
	o2a.CreateAt = o1.CreateAt - (1000 * 60 * 60 * 24 * 2)
	o2a.Message = "a" + model.NewId() + "b"
	o2a = Must(store.Post().Save(o2a)).(*model.Post)

	time.Sleep(1 * time.Second)

	if r1 := <-store.Post().AnalyticsPostCountsByDay(t1.Id); r1.Err != nil {
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

	if r1 := <-store.Post().AnalyticsPostCount(t1.Id, false, false); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) != 4 {
			t.Fatal("wrong value")
		}
	}
}

func TestPostStoreGetFlaggedPostsForTeam(t *testing.T) {
	Setup()

	c1 := &model.Channel{}
	c1.TeamId = model.NewId()
	c1.DisplayName = "Channel1"
	c1.Name = "a" + model.NewId() + "b"
	c1.Type = model.CHANNEL_OPEN
	c1 = Must(store.Channel().Save(c1)).(*model.Channel)

	o1 := &model.Post{}
	o1.ChannelId = c1.Id
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o4 := &model.Post{}
	o4.ChannelId = model.NewId()
	o4.UserId = model.NewId()
	o4.Message = "a" + model.NewId() + "b"
	o4 = (<-store.Post().Save(o4)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	r1 := (<-store.Post().GetFlaggedPosts(o1.ChannelId, 0, 2)).Data.(*model.PostList)

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

	Must(store.Preference().Save(&preferences))

	r2 := (<-store.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

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

	Must(store.Preference().Save(&preferences))

	r3 := (<-store.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 1)).Data.(*model.PostList)

	if len(r3.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r4 := (<-store.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

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

	Must(store.Preference().Save(&preferences))

	r4 = (<-store.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

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

	r4 = (<-store.Post().GetFlaggedPostsForTeam(o1.UserId, c1.TeamId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}

	r4 = (<-store.Post().GetFlaggedPostsForTeam(o1.UserId, model.NewId(), 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 0 {
		t.Fatal("should have 0 posts")
	}
}

func TestPostStoreGetFlaggedPosts(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.DeleteAt = 1
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	r1 := (<-store.Post().GetFlaggedPosts(o1.ChannelId, 0, 2)).Data.(*model.PostList)

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

	Must(store.Preference().Save(&preferences))

	r2 := (<-store.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

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

	Must(store.Preference().Save(&preferences))

	r3 := (<-store.Post().GetFlaggedPosts(o1.UserId, 0, 1)).Data.(*model.PostList)

	if len(r3.Order) != 1 {
		t.Fatal("should have 1 post")
	}

	r4 := (<-store.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

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

	Must(store.Preference().Save(&preferences))

	r4 = (<-store.Post().GetFlaggedPosts(o1.UserId, 0, 2)).Data.(*model.PostList)

	if len(r4.Order) != 2 {
		t.Fatal("should have 2 posts")
	}
}

func TestPostStoreGetPostsCreatedAt(t *testing.T) {
	Setup()

	createTime := model.GetMillis()

	o0 := &model.Post{}
	o0.ChannelId = model.NewId()
	o0.UserId = model.NewId()
	o0.Message = "a" + model.NewId() + "b"
	o0.CreateAt = createTime
	o0 = (<-store.Post().Save(o0)).Data.(*model.Post)

	o1 := &model.Post{}
	o1.ChannelId = o0.Id
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"
	o0.CreateAt = createTime
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "b"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	o3 := &model.Post{}
	o3.ChannelId = model.NewId()
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "b"
	o3.CreateAt = createTime
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)
	time.Sleep(2 * time.Millisecond)

	r1 := (<-store.Post().GetPostsCreatedAt(o1.ChannelId, createTime)).Data.([]*model.Post)

	if len(r1) != 2 {
		t.Fatalf("Got the wrong number of posts.")
	}
}

func TestPostStoreOverwrite(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "AAAAAAAAAAA"
	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	o2 := &model.Post{}
	o2.ChannelId = o1.ChannelId
	o2.UserId = model.NewId()
	o2.Message = "a" + model.NewId() + "CCCCCCCCC"
	o2.ParentId = o1.Id
	o2.RootId = o1.Id
	o2 = (<-store.Post().Save(o2)).Data.(*model.Post)

	o3 := &model.Post{}
	o3.ChannelId = o1.ChannelId
	o3.UserId = model.NewId()
	o3.Message = "a" + model.NewId() + "QQQQQQQQQQ"
	o3 = (<-store.Post().Save(o3)).Data.(*model.Post)

	ro1 := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]
	ro2 := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]
	ro3 := (<-store.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro1.Message != o1.Message {
		t.Fatal("Failed to save/get")
	}

	o1a := &model.Post{}
	*o1a = *ro1
	o1a.Message = ro1.Message + "BBBBBBBBBB"
	if result := <-store.Post().Overwrite(o1a); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro1a := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]

	if ro1a.Message != o1a.Message {
		t.Fatal("Failed to overwrite/get")
	}

	o2a := &model.Post{}
	*o2a = *ro2
	o2a.Message = ro2.Message + "DDDDDDD"
	if result := <-store.Post().Overwrite(o2a); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro2a := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]

	if ro2a.Message != o2a.Message {
		t.Fatal("Failed to overwrite/get")
	}

	o3a := &model.Post{}
	*o3a = *ro3
	o3a.Message = ro3.Message + "WWWWWWW"
	if result := <-store.Post().Overwrite(o3a); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro3a := (<-store.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro3a.Message != o3a.Message && ro3a.Hashtags != o3a.Hashtags {
		t.Fatal("Failed to overwrite/get")
	}

	o4 := Must(store.Post().Save(&model.Post{
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		Message:   model.NewId(),
		Filenames: []string{"test"},
	})).(*model.Post)

	ro4 := (<-store.Post().Get(o4.Id)).Data.(*model.PostList).Posts[o4.Id]

	o4a := &model.Post{}
	*o4a = *ro4
	o4a.Filenames = []string{}
	o4a.FileIds = []string{model.NewId()}
	if result := <-store.Post().Overwrite(o4a); result.Err != nil {
		t.Fatal(result.Err)
	}

	if ro4a := Must(store.Post().Get(o4.Id)).(*model.PostList).Posts[o4.Id]; len(ro4a.Filenames) != 0 {
		t.Fatal("Failed to clear Filenames")
	} else if len(ro4a.FileIds) != 1 {
		t.Fatal("Failed to set FileIds")
	}
}
