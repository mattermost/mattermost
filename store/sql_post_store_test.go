// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
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

	etag1 := (<-store.Post().GetEtag(o1.ChannelId)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".0.") != 0 {
		t.Fatal("Invalid Etag")
	}

	o1 = (<-store.Post().Save(o1)).Data.(*model.Post)

	etag2 := (<-store.Post().GetEtag(o1.ChannelId)).Data.(string)
	if strings.Index(etag2, model.CurrentVersion+"."+o1.Id) != 0 {
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
	ro6 := (<-store.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro1.Message != o1.Message {
		t.Fatal("Failed to save/get")
	}

	msg := o1.Message + "BBBBBBBBBB"
	if result := <-store.Post().Update(ro1, msg, ""); result.Err != nil {
		t.Fatal(result.Err)
	}

	msg2 := o2.Message + "DDDDDDD"
	if result := <-store.Post().Update(ro2, msg2, ""); result.Err != nil {
		t.Fatal(result.Err)
	}

	msg3 := o3.Message + "WWWWWWW"
	if result := <-store.Post().Update(ro6, msg3, "#hashtag"); result.Err != nil {
		t.Fatal(result.Err)
	}

	ro3 := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o1.Id]

	if ro3.Message != msg {
		t.Fatal("Failed to update/get")
	}

	ro4 := (<-store.Post().Get(o1.Id)).Data.(*model.PostList).Posts[o2.Id]

	if ro4.Message != msg2 {
		t.Fatal("Failed to update/get")
	}

	ro5 := (<-store.Post().Get(o3.Id)).Data.(*model.PostList).Posts[o3.Id]

	if ro5.Message != msg3 && ro5.Hashtags != "#hashtag" {
		t.Fatal("Failed to update/get")
	}

}

func TestPostStoreDelete(t *testing.T) {
	Setup()

	o1 := &model.Post{}
	o1.ChannelId = model.NewId()
	o1.UserId = model.NewId()
	o1.Message = "a" + model.NewId() + "b"

	etag1 := (<-store.Post().GetEtag(o1.ChannelId)).Data.(string)
	if strings.Index(etag1, model.CurrentVersion+".0.") != 0 {
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

	etag2 := (<-store.Post().GetEtag(o1.ChannelId)).Data.(string)
	if strings.Index(etag2, model.CurrentVersion+"."+o1.Id) != 0 {
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

	r1 := (<-store.Post().GetPosts(o1.ChannelId, 0, 4)).Data.(*model.PostList)

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

	if len(r1.Posts) != 5 { //the last 4, + o1 (o3 and o2a's parent)
		t.Fatal("wrong size")
	}

	if r1.Posts[o1.Id].Message != o1.Message {
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

	r1 := (<-store.Post().GetPostsSince(o1.ChannelId, o1.CreateAt)).Data.(*model.PostList)

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

	r1 := (<-store.Post().Search(teamId, userId, "corey", false)).Data.(*model.PostList)
	if len(r1.Order) != 1 && r1.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r3 := (<-store.Post().Search(teamId, userId, "new", false)).Data.(*model.PostList)
	if len(r3.Order) != 2 && r3.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r4 := (<-store.Post().Search(teamId, userId, "john", false)).Data.(*model.PostList)
	if len(r4.Order) != 1 && r4.Order[0] != o2.Id {
		t.Fatal("returned wrong search result")
	}

	r5 := (<-store.Post().Search(teamId, userId, "matter*", false)).Data.(*model.PostList)
	if len(r5.Order) != 1 && r5.Order[0] != o1.Id {
		t.Fatal("returned wrong search result")
	}

	r6 := (<-store.Post().Search(teamId, userId, "#hashtag", true)).Data.(*model.PostList)
	if len(r6.Order) != 1 && r6.Order[0] != o4.Id {
		t.Fatal("returned wrong search result")
	}

	r7 := (<-store.Post().Search(teamId, userId, "#secret", true)).Data.(*model.PostList)
	if len(r7.Order) != 1 && r7.Order[0] != o5.Id {
		t.Fatal("returned wrong search result")
	}

	r8 := (<-store.Post().Search(teamId, userId, "@thisshouldmatchnothing", true)).Data.(*model.PostList)
	if len(r8.Order) != 0 {
		t.Fatal("returned wrong search result")
	}

	r9 := (<-store.Post().Search(teamId, userId, "mattermost jersey", false)).Data.(*model.PostList)
	if len(r9.Order) != 2 {
		t.Fatal("returned wrong search result")
	}

	r10 := (<-store.Post().Search(teamId, userId, "matter* jer*", false)).Data.(*model.PostList)
	if len(r10.Order) != 2 {
		t.Fatal("returned wrong search result")
	}

	r11 := (<-store.Post().Search(teamId, userId, "message blargh", false)).Data.(*model.PostList)
	if len(r11.Order) != 1 {
		t.Fatal("returned wrong search result")
	}

	r12 := (<-store.Post().Search(teamId, userId, "blargh>", false)).Data.(*model.PostList)
	if len(r12.Order) != 1 {
		t.Fatal("returned wrong search result")
	}
}
