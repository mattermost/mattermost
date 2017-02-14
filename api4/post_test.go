// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/mattermost/platform/model"
)

func TestCreatePost(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "#hashtag a" + model.NewId() + "a"}
	rpost, resp := Client.CreatePost(post)
	CheckNoError(t, resp)

	if rpost.Message != post.Message {
		t.Fatal("message didn't match")
	}

	if rpost.Hashtags != "#hashtag" {
		t.Fatal("hashtag didn't match")
	}

	if len(rpost.FileIds) != 0 {
		t.Fatal("shouldn't have files")
	}

	if rpost.EditAt != 0 {
		t.Fatal("newly created post shouldn't have EditAt set")
	}

	post.RootId = rpost.Id
	post.ParentId = rpost.Id
	_, resp = Client.CreatePost(post)
	CheckNoError(t, resp)

	post.RootId = "junk"
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post.RootId = rpost.Id
	post.ParentId = "junk"
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post2 := &model.Post{ChannelId: th.BasicChannel2.Id, Message: "a" + model.NewId() + "a", CreateAt: 123}
	rpost2, resp := Client.CreatePost(post2)

	if rpost2.CreateAt == post2.CreateAt {
		t.Fatal("create at should not match")
	}

	post.RootId = rpost2.Id
	post.ParentId = rpost2.Id
	_, resp = Client.CreatePost(post)
	CheckBadRequestStatus(t, resp)

	post.RootId = ""
	post.ParentId = ""
	post.ChannelId = "junk"
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	post.ChannelId = model.NewId()
	_, resp = Client.CreatePost(post)
	CheckForbiddenStatus(t, resp)

	if r, err := Client.DoApiPost("/posts", "garbage"); err == nil {
		t.Fatal("should have errored")
	} else {
		if r.StatusCode != http.StatusBadRequest {
			t.Log("actual: " + strconv.Itoa(r.StatusCode))
			t.Log("expected: " + strconv.Itoa(http.StatusBadRequest))
			t.Fatal("wrong status code")
		}
	}

	Client.Logout()
	_, resp = Client.CreatePost(post)
	CheckUnauthorizedStatus(t, resp)

	post.ChannelId = th.BasicChannel.Id
	post.CreateAt = 123
	rpost, resp = th.SystemAdminClient.CreatePost(post)
	CheckNoError(t, resp)

	if rpost.CreateAt != post.CreateAt {
		t.Fatal("create at should match")
	}
}

func TestGetPostsForChannel(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	post1 := th.CreatePost()
	post2 := th.CreatePost()
	post3 := th.CreatePost()
	post4 := &model.Post{ChannelId: th.BasicChannel.Id, Message: "a" + model.NewId() + "a", RootId: post1.Id}
	post4, _ = Client.CreatePost(post4)

	posts, resp := Client.GetPostsForChannel(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)

	if posts.Order[0] != post4.Id {
		t.Fatal("wrong order")
	}

	if posts.Order[1] != post3.Id {
		t.Fatal("wrong order")
	}

	if posts.Order[2] != post2.Id {
		t.Fatal("wrong order")
	}

	if posts.Order[3] != post1.Id {
		t.Fatal("wrong order")
	}

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 0, 3, resp.Etag)
	CheckEtag(t, posts, resp)

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 0, 3, "")
	CheckNoError(t, resp)

	if len(posts.Order) != 3 {
		t.Fatal("wrong number returned")
	}

	if _, ok := posts.Posts[post4.Id]; !ok {
		t.Fatal("missing comment")
	}

	if _, ok := posts.Posts[post1.Id]; !ok {
		t.Fatal("missing root post")
	}

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 1, 1, "")
	CheckNoError(t, resp)

	if posts.Order[0] != post3.Id {
		t.Fatal("wrong order")
	}

	posts, resp = Client.GetPostsForChannel(th.BasicChannel.Id, 10000, 10000, "")
	CheckNoError(t, resp)

	if len(posts.Order) != 0 {
		t.Fatal("should be no posts")
	}

	_, resp = Client.GetPostsForChannel("", 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = Client.GetPostsForChannel("junk", 0, 60, "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPostsForChannel(model.NewId(), 0, 60, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPostsForChannel(model.NewId(), 0, 60, "")
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetPostsForChannel(th.BasicChannel.Id, 0, 60, "")
	CheckNoError(t, resp)
}

func TestGetPost(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	post, resp := Client.GetPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	if post.Id != th.BasicPost.Id {
		t.Fatal("post ids don't match")
	}

	post, resp = Client.GetPost(th.BasicPost.Id, resp.Etag)
	CheckEtag(t, post, resp)

	_, resp = Client.GetPost("", "")
	CheckNotFoundStatus(t, resp)

	_, resp = Client.GetPost("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPost(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPost(model.NewId(), "")
	CheckUnauthorizedStatus(t, resp)

	post, resp = th.SystemAdminClient.GetPost(th.BasicPost.Id, "")
	CheckNoError(t, resp)
}

func TestGetPostThread(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	post := &model.Post{ChannelId: th.BasicChannel.Id, Message: "a" + model.NewId() + "a", RootId: th.BasicPost.Id}
	post, _ = Client.CreatePost(post)

	list, resp := Client.GetPostThread(th.BasicPost.Id, "")
	CheckNoError(t, resp)

	var list2 *model.PostList
	list2, resp = Client.GetPostThread(th.BasicPost.Id, resp.Etag)
	CheckEtag(t, list2, resp)

	if list.Order[0] != th.BasicPost.Id {
		t.Fatal("wrong order")
	}

	if _, ok := list.Posts[th.BasicPost.Id]; !ok {
		t.Fatal("should have had post")
	}

	if _, ok := list.Posts[post.Id]; !ok {
		t.Fatal("should have had post")
	}

	_, resp = Client.GetPostThread("junk", "")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPostThread(model.NewId(), "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPostThread(model.NewId(), "")
	CheckUnauthorizedStatus(t, resp)

	list, resp = th.SystemAdminClient.GetPostThread(th.BasicPost.Id, "")
	CheckNoError(t, resp)
}
