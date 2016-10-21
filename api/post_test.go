// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"

	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestCreatePost(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam
	team2 := th.CreateTeam(th.BasicClient)
	user3 := th.CreateUser(th.BasicClient)
	LinkUserToTeam(user3, team2)
	channel1 := th.BasicChannel
	channel2 := th.CreateChannel(Client, team)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag a" + model.NewId() + "a"}
	rpost1, err := Client.CreatePost(post1)
	if err != nil {
		t.Fatal(err)
	}

	if rpost1.Data.(*model.Post).Message != post1.Message {
		t.Fatal("message didn't match")
	}

	if rpost1.Data.(*model.Post).Hashtags != "#hashtag" {
		t.Fatal("hashtag didn't match")
	}

	if len(rpost1.Data.(*model.Post).FileIds) != 0 {
		t.Fatal("shouldn't have files")
	}

	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id}
	rpost2, err := Client.CreatePost(post2)
	if err != nil {
		t.Fatal(err)
	}

	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id, ParentId: rpost2.Data.(*model.Post).Id}
	_, err = Client.CreatePost(post3)
	if err != nil {
		t.Fatal(err)
	}

	post4 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: "junk"}
	_, err = Client.CreatePost(post4)
	if err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should have been invalid param")
	}

	post5 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id, ParentId: "junk"}
	_, err = Client.CreatePost(post5)
	if err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should have been invalid param")
	}

	post1c2 := &model.Post{ChannelId: channel2.Id, Message: "a" + model.NewId() + "a"}
	rpost1c2, err := Client.CreatePost(post1c2)

	post2c2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: rpost1c2.Data.(*model.Post).Id}
	_, err = Client.CreatePost(post2c2)
	if err.StatusCode != http.StatusBadRequest {
		t.Fatal("Should have been invalid param")
	}

	post6 := &model.Post{ChannelId: "junk", Message: "a" + model.NewId() + "a"}
	_, err = Client.CreatePost(post6)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	th.LoginBasic2()

	post7 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	_, err = Client.CreatePost(post7)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	Client.Login(user3.Email, user3.Password)
	Client.SetTeamId(team2.Id)
	channel3 := th.CreateChannel(Client, team2)

	post8 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	_, err = Client.CreatePost(post8)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	if _, err = Client.DoApiPost("/channels/"+channel3.Id+"/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}

	fileIds := make([]string, 4)
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		for i := 0; i < 3; i++ {
			fileIds[i] = Client.MustGeneric(Client.UploadPostAttachment(data, channel3.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		}
	}

	// Make sure duplicated file ids are removed
	fileIds[3] = fileIds[0]

	post9 := &model.Post{
		ChannelId: channel3.Id,
		Message:   "test",
		FileIds:   fileIds,
	}
	if resp, err := Client.CreatePost(post9); err != nil {
		t.Fatal(err)
	} else if rpost9 := resp.Data.(*model.Post); len(rpost9.FileIds) != 3 {
		t.Fatal("post should have 3 files")
	} else {
		infos := store.Must(Srv.Store.FileInfo().GetForPost(rpost9.Id)).([]*model.FileInfo)

		if len(infos) != 3 {
			t.Fatal("should've attached all 3 files to post")
		}
	}
}

func testCreatePostWithOutgoingHook(
	t *testing.T,
	hookContentType string,
	expectedContentType string,
) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	user := th.SystemAdminUser
	channel := th.CreateChannel(Client, team)

	enableOutgoingHooks := utils.Cfg.ServiceSettings.EnableOutgoingWebhooks
	defer func() {
		utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = enableOutgoingHooks
	}()
	utils.Cfg.ServiceSettings.EnableOutgoingWebhooks = true

	var hook *model.OutgoingWebhook
	var post *model.Post

	// Create a test server that is the target of the outgoing webhook. It will
	// validate the webhook body fields and write to the success channel on
	// success/failure.
	success := make(chan bool)
	wait := make(chan bool, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-wait

		requestContentType := r.Header.Get("Content-Type")
		if requestContentType != expectedContentType {
			t.Logf("Content-Type is %s, should be %s", requestContentType, expectedContentType)
			success <- false
			return
		}

		expectedPayload := &model.OutgoingWebhookPayload{
			Token:       hook.Token,
			TeamId:      hook.TeamId,
			TeamDomain:  team.Name,
			ChannelId:   post.ChannelId,
			ChannelName: channel.Name,
			Timestamp:   post.CreateAt,
			UserId:      post.UserId,
			UserName:    user.Username,
			PostId:      post.Id,
			Text:        post.Message,
			TriggerWord: strings.Fields(post.Message)[0],
		}

		// depending on the Content-Type, we expect to find a JSON or form encoded payload
		if requestContentType == "application/json" {
			decoder := json.NewDecoder(r.Body)
			o := &model.OutgoingWebhookPayload{}
			decoder.Decode(&o)

			if !reflect.DeepEqual(expectedPayload, o) {
				t.Logf("JSON payload is %+v, should be %+v", o, expectedPayload)
				success <- false
				return
			}
		} else {
			err := r.ParseForm()
			if err != nil {
				t.Logf("Error parsing form: %q", err)
				success <- false
				return
			}

			expectedFormValues, _ := url.ParseQuery(expectedPayload.ToFormValues())
			if !reflect.DeepEqual(expectedFormValues, r.Form) {
				t.Logf("Form values are %q, should be %q", r.Form, expectedFormValues)
				success <- false
				return
			}
		}

		success <- true
	}))
	defer ts.Close()

	// create an outgoing webhook, passing it the test server URL
	triggerWord := "bingo"
	hook = &model.OutgoingWebhook{
		ChannelId:    channel.Id,
		ContentType:  hookContentType,
		TriggerWords: []string{triggerWord},
		CallbackURLs: []string{ts.URL},
	}

	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		hook = result.Data.(*model.OutgoingWebhook)
	}

	// create a post to trigger the webhook
	message := triggerWord + " lorem ipusm"
	post = &model.Post{
		ChannelId: channel.Id,
		Message:   message,
	}

	if result, err := Client.CreatePost(post); err != nil {
		t.Fatal(err)
	} else {
		post = result.Data.(*model.Post)
	}

	wait <- true

	// We wait for the test server to write to the success channel and we make
	// the test fail if that doesn't happen before the timeout.
	select {
	case ok := <-success:
		if !ok {
			t.Fatal("Test server was sent an invalid webhook.")
		}
	case <-time.After(time.Second):
		t.Fatal("Timeout, test server wasn't sent the webhook.")
	}
}

func TestCreatePostWithOutgoingHook_form_urlencoded(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "application/x-www-form-urlencoded", "application/x-www-form-urlencoded")
}

func TestCreatePostWithOutgoingHook_json(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "application/json", "application/json")
}

// hooks created before we added the ContentType field should be considered as
// application/x-www-form-urlencoded
func TestCreatePostWithOutgoingHook_no_content_type(t *testing.T) {
	testCreatePostWithOutgoingHook(t, "", "application/x-www-form-urlencoded")
}

func TestUpdatePost(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	rpost1, err := Client.CreatePost(post1)
	if err != nil {
		t.Fatal(err)
	}

	if rpost1.Data.(*model.Post).Message != post1.Message {
		t.Fatal("full name didn't match")
	}

	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: rpost1.Data.(*model.Post).Id}
	rpost2, err := Client.CreatePost(post2)
	if err != nil {
		t.Fatal(err)
	}

	msg2 := "a" + model.NewId() + " update post 1"
	rpost2.Data.(*model.Post).Message = msg2
	if rupost2, err := Client.UpdatePost(rpost2.Data.(*model.Post)); err != nil {
		t.Fatal(err)
	} else {
		if rupost2.Data.(*model.Post).Message != msg2 {
			t.Fatal("failed to updates")
		}
	}

	msg1 := "#hashtag a" + model.NewId() + " update post 2"
	rpost1.Data.(*model.Post).Message = msg1
	if rupost1, err := Client.UpdatePost(rpost1.Data.(*model.Post)); err != nil {
		t.Fatal(err)
	} else {
		if rupost1.Data.(*model.Post).Message != msg1 && rupost1.Data.(*model.Post).Hashtags != "#hashtag" {
			t.Fatal("failed to updates")
		}
	}

	up12 := &model.Post{Id: rpost1.Data.(*model.Post).Id, ChannelId: channel1.Id, Message: "a" + model.NewId() + " updaet post 1 update 2"}
	if rup12, err := Client.UpdatePost(up12); err != nil {
		t.Fatal(err)
	} else {
		if rup12.Data.(*model.Post).Message != up12.Message {
			t.Fatal("failed to updates")
		}
	}

	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", Type: model.POST_JOIN_LEAVE}
	rpost3, err := Client.CreatePost(post3)
	if err != nil {
		t.Fatal(err)
	}

	up3 := &model.Post{Id: rpost3.Data.(*model.Post).Id, ChannelId: channel1.Id, Message: "a" + model.NewId() + " update post 3"}
	if _, err := Client.UpdatePost(up3); err == nil {
		t.Fatal("shouldn't have been able to update system message")
	}
}

func TestGetPosts(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	r1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)

	if r1.Order[0] != post3a1.Id {
		t.Fatal("wrong order")
	}

	if r1.Order[1] != post3.Id {
		t.Fatal("wrong order")
	}

	if len(r1.Posts) != 2 { // 3a1 and 3; 3a1's parent already there
		t.Fatal("wrong size")
	}

	r2 := Client.Must(Client.GetPosts(channel1.Id, 2, 2, "")).Data.(*model.PostList)

	if r2.Order[0] != post2.Id {
		t.Fatal("wrong order")
	}

	if r2.Order[1] != post1a1.Id {
		t.Fatal("wrong order")
	}

	if len(r2.Posts) != 3 { // 2 and 1a1; + 1a1's parent
		t.Log(r2.Posts)
		t.Fatal("wrong size")
	}
}

func TestGetPostsSince(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post0 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post0 = Client.Must(Client.CreatePost(post0)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	r1 := Client.Must(Client.GetPostsSince(channel1.Id, post1.CreateAt)).Data.(*model.PostList)

	if r1.Order[0] != post3a1.Id {
		t.Fatal("wrong order")
	}

	if r1.Order[1] != post3.Id {
		t.Fatal("wrong order")
	}

	if len(r1.Posts) != 5 {
		t.Fatal("wrong size")
	}

	now := model.GetMillis()
	r2 := Client.Must(Client.GetPostsSince(channel1.Id, now)).Data.(*model.PostList)

	if len(r2.Posts) != 0 {
		t.Fatal("should have been empty")
	}

	post2.Message = "new message"
	Client.Must(Client.UpdatePost(post2))

	r3 := Client.Must(Client.GetPostsSince(channel1.Id, now)).Data.(*model.PostList)

	if len(r3.Order) != 2 { // 2 because deleted post is returned as well
		t.Fatal("missing post update")
	}
}

func TestGetPostsBeforeAfter(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post0 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post0 = Client.Must(Client.CreatePost(post0)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	r1 := Client.Must(Client.GetPostsBefore(channel1.Id, post1a1.Id, 0, 10, "")).Data.(*model.PostList)

	if r1.Order[0] != post1.Id {
		t.Fatal("wrong order")
	}

	if r1.Order[1] != post0.Id {
		t.Fatal("wrong order")
	}

	if len(r1.Posts) != 3 {
		t.Log(r1.Posts)
		t.Fatal("wrong size")
	}

	r2 := Client.Must(Client.GetPostsAfter(channel1.Id, post3a1.Id, 0, 3, "")).Data.(*model.PostList)

	if len(r2.Posts) != 0 {
		t.Fatal("should have been empty")
	}

	post2.Message = "new message"
	Client.Must(Client.UpdatePost(post2))

	r3 := Client.Must(Client.GetPostsAfter(channel1.Id, post1a1.Id, 0, 2, "")).Data.(*model.PostList)

	if r3.Order[0] != post3.Id {
		t.Fatal("wrong order")
	}

	if r3.Order[1] != post2.Id {
		t.Fatal("wrong order")
	}

	if len(r3.Order) != 2 {
		t.Fatal("missing post update")
	}
}

func TestSearchPosts(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	post1 := &model.Post{ChannelId: channel1.Id, Message: "search for post1"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "search for post2"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag search for post3"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel1.Id, Message: "hashtag for post4"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	r1 := Client.Must(Client.SearchPosts("search", false)).Data.(*model.PostList)

	if len(r1.Order) != 3 {
		t.Fatal("wrong search")
	}

	r2 := Client.Must(Client.SearchPosts("post2", false)).Data.(*model.PostList)

	if len(r2.Order) != 1 && r2.Order[0] == post2.Id {
		t.Fatal("wrong search")
	}

	r3 := Client.Must(Client.SearchPosts("#hashtag", false)).Data.(*model.PostList)

	if len(r3.Order) != 1 && r3.Order[0] == post3.Id {
		t.Fatal("wrong search")
	}

	if r4 := Client.Must(Client.SearchPosts("*", false)).Data.(*model.PostList); len(r4.Order) != 0 {
		t.Fatal("searching for just * shouldn't return any results")
	}

	r5 := Client.Must(Client.SearchPosts("post1 post2", true)).Data.(*model.PostList)

	if len(r5.Order) != 2 {
		t.Fatal("wrong search results")
	}
}

func TestSearchHashtagPosts(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	post1 := &model.Post{ChannelId: channel1.Id, Message: "#sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "#sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "no hashtag"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	r1 := Client.Must(Client.SearchPosts("#sgtitlereview", false)).Data.(*model.PostList)

	if len(r1.Order) != 2 {
		t.Fatal("wrong search")
	}
}

func TestSearchPostsInChannel(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel
	team := th.BasicTeam

	post1 := &model.Post{ChannelId: channel1.Id, Message: "sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	channel2 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	post2 := &model.Post{ChannelId: channel2.Id, Message: "sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel2.Id, Message: "other message with no return"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel3.Id, Message: "other message with no return"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("channel:", false)).Data.(*model.PostList); len(result.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("in:", false)).Data.(*model.PostList); len(result.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel:"+channel1.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("in: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("ChAnNeL: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview", false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview channel:"+channel1.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview in: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview channel: "+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel: "+channel2.Name+" channel: "+channel3.Name, false)).Data.(*model.PostList); len(result.Order) != 3 {
		t.Fatalf("wrong number of posts returned :) %v :) %v", result.Posts, result.Order)
	}
}

func TestSearchPostsFromUser(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	channel2 := th.CreateChannel(Client, team)
	Client.Must(Client.AddChannelMember(channel1.Id, th.BasicUser2.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser2.Id))
	user3 := th.CreateUser(Client)
	LinkUserToTeam(user3, team)
	Client.Must(Client.AddChannelMember(channel1.Id, user3.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, user3.Id))

	post1 := &model.Post{ChannelId: channel1.Id, Message: "sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	th.LoginBasic2()

	post2 := &model.Post{ChannelId: channel2.Id, Message: "sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("from: "+user1.Username, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" sgtitlereview", false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	post3 := &model.Post{ChannelId: channel1.Id, Message: "hullo"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" in:"+channel1.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	Client.Login(user3.Email, user3.Password)

	// wait for the join/leave messages to be created for user3 since they're done asynchronously
	time.Sleep(100 * time.Millisecond)

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" from: "+user3.Username, false)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" from: "+user3.Username+" in:"+channel2.Name, false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	post4 := &model.Post{ChannelId: channel2.Id, Message: "coconut"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	if result := Client.Must(Client.SearchPosts("from: "+user2.Username+" from: "+user3.Username+" in:"+channel2.Name+" coconut", false)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}
}

func TestGetPostsCache(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	etag := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Etag

	// test etag caching
	if cache_result, err := Client.GetPosts(channel1.Id, 0, 2, etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.PostList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}

	etag = Client.Must(Client.GetPost(channel1.Id, post1.Id, "")).Etag

	// test etag caching
	if cache_result, err := Client.GetPost(channel1.Id, post1.Id, etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.PostList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}

}

func TestDeletePosts(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel
	UpdateUserToTeamAdmin(th.BasicUser2, th.BasicTeam)

	time.Sleep(10 * time.Millisecond)
	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post1.Id}
	post1a1 = Client.Must(Client.CreatePost(post1a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post1a2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post1.Id, ParentId: post1a1.Id}
	post1a2 = Client.Must(Client.CreatePost(post1a2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post2 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	post3a1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", RootId: post3.Id}
	post3a1 = Client.Must(Client.CreatePost(post3a1)).Data.(*model.Post)

	time.Sleep(10 * time.Millisecond)
	Client.Must(Client.DeletePost(channel1.Id, post3.Id))

	r2 := Client.Must(Client.GetPosts(channel1.Id, 0, 10, "")).Data.(*model.PostList)

	if len(r2.Posts) != 5 {
		t.Fatal("should have returned 4 items")
	}

	time.Sleep(10 * time.Millisecond)
	post4 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	th.LoginBasic2()
	Client.Must(Client.JoinChannel(channel1.Id))

	Client.Must(Client.DeletePost(channel1.Id, post4.Id))
}

func TestEmailMention(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	post1 := &model.Post{ChannelId: channel1.Id, Message: th.BasicUser.Username}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	// No easy way to verify the email was sent, but this will at least cause the server to throw errors if the code is broken

}

func TestFuzzyPosts(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	for i := 0; i < len(utils.FUZZY_STRINGS_POSTS); i++ {
		post := &model.Post{ChannelId: channel1.Id, Message: utils.FUZZY_STRINGS_POSTS[i]}

		_, err := Client.CreatePost(post)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestMakeDirectChannelVisible(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2

	th.LoginBasic2()

	preferences := &model.Preferences{
		{
			UserId:   user2.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     user1.Id,
			Value:    "false",
		},
	}
	Client.Must(Client.SetPreferences(preferences))

	Client.Must(Client.Logout())
	th.LoginBasic()
	th.BasicClient.SetTeamId(team.Id)

	channel := Client.Must(Client.CreateDirectChannel(user2.Id)).Data.(*model.Channel)

	makeDirectChannelVisible(channel.Id)

	if result, err := Client.GetPreference(model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, user2.Id); err != nil {
		t.Fatal("Errored trying to set direct channel to be visible for user1")
	} else if pref := result.Data.(*model.Preference); pref.Value != "true" {
		t.Fatal("Failed to set direct channel to be visible for user1")
	}
}

func TestGetMentionKeywords(t *testing.T) {
	// user with username or custom mentions enabled
	user1 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
		},
	}

	profiles := map[string]*model.User{user1.Id: user1}
	mentions := getMentionKeywordsInChannel(profiles)
	if len(mentions) != 3 {
		t.Fatal("should've returned three mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user1.Id {
		t.Fatal("should've returned mention key of mention")
	}

	// user with first name mention enabled
	user2 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"first_name": "true",
		},
	}

	profiles = map[string]*model.User{user2.Id: user2}
	mentions = getMentionKeywordsInChannel(profiles)
	if len(mentions) != 1 {
		t.Fatal("should've returned one mention keyword")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user2.Id {
		t.Fatal("should've returned mention key of First")
	}

	// user with @channel/@all mentions enabled
	user3 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"channel": "true",
		},
	}

	profiles = map[string]*model.User{user3.Id: user3}
	mentions = getMentionKeywordsInChannel(profiles)
	if len(mentions) != 2 {
		t.Fatal("should've returned two mention keywords")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user3.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// user with all types of mentions enabled
	user4 := &model.User{
		Id:        model.NewId(),
		FirstName: "First",
		Username:  "User",
		NotifyProps: map[string]string{
			"mention_keys": "User,@User,MENTION",
			"first_name":   "true",
			"channel":      "true",
		},
	}

	profiles = map[string]*model.User{user4.Id: user4}
	mentions = getMentionKeywordsInChannel(profiles)
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of user")
	} else if ids, ok := mentions["@user"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @user")
	} else if ids, ok := mentions["mention"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of mention")
	} else if ids, ok := mentions["First"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of First")
	} else if ids, ok := mentions["@channel"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @channel")
	} else if ids, ok := mentions["@all"]; !ok || ids[0] != user4.Id {
		t.Fatal("should've returned mention key of @all")
	}

	// multiple users
	profiles = map[string]*model.User{
		user1.Id: user1,
		user2.Id: user2,
		user3.Id: user3,
		user4.Id: user4,
	}
	mentions = getMentionKeywordsInChannel(profiles)
	if len(mentions) != 6 {
		t.Fatal("should've returned six mention keywords")
	} else if ids, ok := mentions["user"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with user")
	} else if ids, ok := mentions["@user"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with @user")
	} else if ids, ok := mentions["mention"]; !ok || len(ids) != 2 || (ids[0] != user1.Id && ids[1] != user1.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user1 and user4 with mention")
	} else if ids, ok := mentions["First"]; !ok || len(ids) != 2 || (ids[0] != user2.Id && ids[1] != user2.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user2 and user4 with mention")
	} else if ids, ok := mentions["@channel"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @channel")
	} else if ids, ok := mentions["@all"]; !ok || len(ids) != 2 || (ids[0] != user3.Id && ids[1] != user3.Id) || (ids[0] != user4.Id && ids[1] != user4.Id) {
		t.Fatal("should've mentioned user3 and user4 with @all")
	}
}

func TestGetExplicitMentionsAtHere(t *testing.T) {
	// test all the boundary cases that we know can break up terms (and those that we know won't)
	cases := map[string]bool{
		"":          false,
		"here":      false,
		"@here":     true,
		" @here ":   true,
		"\t@here\t": true,
		"\n@here\n": true,
		// "!@here!": true,
		// "@@here@": true,
		// "#@here#": true,
		// "$@here$": true,
		// "%@here%": true,
		// "^@here^": true,
		// "&@here&": true,
		// "*@here*": true,
		"(@here(": true,
		")@here)": true,
		// "-@here-": true,
		// "_@here_": true,
		// "=@here=": true,
		"+@here+":   true,
		"[@here[":   true,
		"{@here{":   true,
		"]@here]":   true,
		"}@here}":   true,
		"\\@here\\": true,
		// "|@here|": true,
		";@here;": true,
		":@here:": true,
		// "'@here'": true,
		// "\"@here\"": true,
		",@here,": true,
		"<@here<": true,
		".@here.": true,
		">@here>": true,
		"/@here/": true,
		"?@here?": true,
		// "`@here`": true,
		// "~@here~": true,
	}

	for message, shouldMention := range cases {
		if _, _, hereMentioned := getExplicitMentions(message, nil); hereMentioned && !shouldMention {
			t.Fatalf("shouldn't have mentioned @here with \"%v\"", message)
		} else if !hereMentioned && shouldMention {
			t.Fatalf("should've have mentioned @here with \"%v\"", message)
		}
	}

	// mentioning @here and someone
	id := model.NewId()
	if mentions, potential, hereMentioned := getExplicitMentions("@here @user @potential", map[string][]string{"@user": {id}}); !hereMentioned {
		t.Fatal("should've mentioned @here with \"@here @user\"")
	} else if len(mentions) != 1 || !mentions[id] {
		t.Fatal("should've mentioned @user with \"@here @user\"")
	} else if len(potential) > 1 {
		t.Fatal("should've potential mentions for @potential")
	}
}

func TestGetExplicitMentions(t *testing.T) {
	id1 := model.NewId()
	id2 := model.NewId()

	// not mentioning anybody
	message := "this is a message"
	keywords := map[string][]string{}
	if mentions, potential, _ := getExplicitMentions(message, keywords); len(mentions) != 0 || len(potential) != 0 {
		t.Fatal("shouldn't have mentioned anybody or have any potencial mentions")
	}

	// mentioning a user that doesn't exist
	message = "this is a message for @user"
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 0 {
		t.Fatal("shouldn't have mentioned user that doesn't exist")
	}

	// mentioning one person
	keywords = map[string][]string{"@user": {id1}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] {
		t.Fatal("should've mentioned @user")
	}

	// mentioning one person without an @mention
	message = "this is a message for @user"
	keywords = map[string][]string{"this": {id1}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] {
		t.Fatal("should've mentioned this")
	}

	// mentioning multiple people with one word
	message = "this is a message for @user"
	keywords = map[string][]string{"@user": {id1, id2}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @user")
	}

	// mentioning only one of multiple people
	keywords = map[string][]string{"@user": {id1}, "@mention": {id2}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] {
		t.Fatal("should've mentioned @user and not @mention")
	}

	// mentioning multiple people with multiple words
	message = "this is an @mention for @user"
	keywords = map[string][]string{"@user": {id1}, "@mention": {id2}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @user and @mention")
	}

	// mentioning @channel (not a special case, but it's good to double check)
	message = "this is an message for @channel"
	keywords = map[string][]string{"@channel": {id1, id2}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @channel")
	}

	// mentioning @all (not a special case, but it's good to double check)
	message = "this is an message for @all"
	keywords = map[string][]string{"@all": {id1, id2}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 2 || !mentions[id1] || !mentions[id2] {
		t.Fatal("should've mentioned two users with @all")
	}

	// mentioning user.period without mentioning user (PLT-3222)
	message = "user.period doesn't complicate things at all by including periods in their username"
	keywords = map[string][]string{"user.period": {id1}, "user": {id2}}
	if mentions, _, _ := getExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || mentions[id2] {
		t.Fatal("should've mentioned user.period and not user")
	}

	// mentioning a potential out of channel user
	message = "this is an message for @potential and @user"
	keywords = map[string][]string{"@user": {id1}}
	if mentions, potential, _ := getExplicitMentions(message, keywords); len(mentions) != 1 || !mentions[id1] || len(potential) != 1 {
		t.Fatal("should've mentioned user and have a potential not in channel")
	}
}

func TestGetFlaggedPosts(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	user1 := th.BasicUser
	post1 := th.BasicPost

	preferences := &model.Preferences{
		{
			UserId:   user1.Id,
			Category: model.PREFERENCE_CATEGORY_FLAGGED_POST,
			Name:     post1.Id,
			Value:    "true",
		},
	}
	Client.Must(Client.SetPreferences(preferences))

	r1 := Client.Must(Client.GetFlaggedPosts(0, 2)).Data.(*model.PostList)

	if len(r1.Order) == 0 {
		t.Fatal("should have gotten a flagged post")
	}

	if _, ok := r1.Posts[post1.Id]; !ok {
		t.Fatal("missing flagged post")
	}

	Client.DeletePreferences(preferences)

	r2 := Client.Must(Client.GetFlaggedPosts(0, 2)).Data.(*model.PostList)

	if len(r2.Order) != 0 {
		t.Fatal("should not have gotten a flagged post")
	}
}

func TestGetMessageForNotification(t *testing.T) {
	Setup().InitBasic()

	testPng := store.Must(Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test1.png",
		Name:      "test1.png",
		MimeType:  "image/png",
	})).(*model.FileInfo)

	testJpg1 := store.Must(Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test2.jpg",
		Name:      "test2.jpg",
		MimeType:  "image/jpeg",
	})).(*model.FileInfo)

	testFile := store.Must(Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test1.go",
		Name:      "test1.go",
		MimeType:  "text/plain",
	})).(*model.FileInfo)

	testJpg2 := store.Must(Srv.Store.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "test3.jpg",
		Name:      "test3.jpg",
		MimeType:  "image/jpeg",
	})).(*model.FileInfo)

	translateFunc := utils.GetUserTranslations("en")

	post := &model.Post{
		Id:      model.NewId(),
		Message: "test",
	}

	if getMessageForNotification(post, translateFunc) != "test" {
		t.Fatal("should've returned message text")
	}

	post.FileIds = model.StringArray{testPng.Id}
	store.Must(Srv.Store.FileInfo().AttachToPost(testPng.Id, post.Id))
	if getMessageForNotification(post, translateFunc) != "test" {
		t.Fatal("should've returned message text, even with attachments")
	}

	post.Message = ""
	if message := getMessageForNotification(post, translateFunc); message != "1 image sent: test1.png" {
		t.Fatal("should've returned number of images:", message)
	}

	post.FileIds = model.StringArray{testPng.Id, testJpg1.Id}
	store.Must(Srv.Store.FileInfo().AttachToPost(testJpg1.Id, post.Id))
	if message := getMessageForNotification(post, translateFunc); message != "2 images sent: test1.png, test2.jpg" {
		t.Fatal("should've returned number of images:", message)
	}

	post.Id = model.NewId()
	post.FileIds = model.StringArray{testFile.Id}
	store.Must(Srv.Store.FileInfo().AttachToPost(testFile.Id, post.Id))
	if message := getMessageForNotification(post, translateFunc); message != "1 file sent: test1.go" {
		t.Fatal("should've returned number of files:", message)
	}

	store.Must(Srv.Store.FileInfo().AttachToPost(testJpg2.Id, post.Id))
	post.FileIds = model.StringArray{testFile.Id, testJpg2.Id}
	if message := getMessageForNotification(post, translateFunc); message != "2 files sent: test1.go, test3.jpg" {
		t.Fatal("should've returned number of mixed files:", message)
	}
}

func TestGetFileInfosForPost(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel1 := th.BasicChannel

	fileIds := make([]string, 3, 3)
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		for i := 0; i < 3; i++ {
			fileIds[i] = Client.MustGeneric(Client.UploadPostAttachment(data, channel1.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		}
	}

	post1 := Client.Must(Client.CreatePost(&model.Post{
		ChannelId: channel1.Id,
		Message:   "test",
		FileIds:   fileIds,
	})).Data.(*model.Post)

	var etag string
	if infos, err := Client.GetFileInfosForPost(channel1.Id, post1.Id, ""); err != nil {
		t.Fatal(err)
	} else if len(infos) != 3 {
		t.Fatal("should've received 3 files")
	} else if Client.Etag == "" {
		t.Fatal("should've received etag")
	} else {
		etag = Client.Etag
	}

	if infos, err := Client.GetFileInfosForPost(channel1.Id, post1.Id, etag); err != nil {
		t.Fatal(err)
	} else if len(infos) != 0 {
		t.Fatal("should've returned nothing because of etag")
	}
}

// TODO: Needs to be vastly fleshed out
func TestSendNotifications(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient

	AddUserToChannel(th.BasicUser2, th.BasicChannel)

	mockSession := model.Session{
		UserId:      th.BasicUser.Id,
		TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id}},
		IsOAuth:     false,
	}

	newContext := &Context{
		Session:   mockSession,
		RequestId: model.NewId(),
		IpAddress: "",
		Path:      "fake",
		Err:       nil,
		siteURL:   *utils.Cfg.ServiceSettings.SiteURL,
		TeamId:    th.BasicTeam.Id,
	}

	post1 := Client.Must(Client.CreatePost(&model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "@" + th.BasicUser2.Username,
	})).Data.(*model.Post)

	mentions := sendNotifications(newContext, post1, th.BasicTeam, th.BasicChannel)
	if mentions == nil {
		t.Log(mentions)
		t.Fatal("user should have been mentioned")
	} else if mentions[0] != th.BasicUser2.Id {
		t.Log(mentions)
		t.Fatal("user should have been mentioned")
	}
}
