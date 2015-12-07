// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"net/http"
	"testing"
	"time"
)

func TestCreatePost(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	team2 := &model.Team{DisplayName: "Name Team 2", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	filenames := []string{"/12345678901234567890123456/12345678901234567890123456/12345678901234567890123456/test.png", "/" + channel1.Id + "/" + user1.Id + "/test.png", "www.mattermost.com/fake/url", "junk"}

	post1 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag a" + model.NewId() + "a", Filenames: filenames}
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

	if len(rpost1.Data.(*model.Post).Filenames) != 2 {
		t.Fatal("filenames didn't parse correctly")
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

	Client.LoginByEmail(team.Name, user2.Email, "pwd")
	post7 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	_, err = Client.CreatePost(post7)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	user3 := &model.User{TeamId: team2.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user3.Id))

	Client.LoginByEmail(team2.Name, user3.Email, "pwd")

	channel3 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team2.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	post8 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	_, err = Client.CreatePost(post8)
	if err.StatusCode != http.StatusForbidden {
		t.Fatal("Should have been forbidden")
	}

	if _, err = Client.DoApiPost("/channels/"+channel3.Id+"/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestUpdatePost(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	team2 := &model.Team{DisplayName: "Name Team 2", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

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
}

func TestGetPosts(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

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
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

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
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

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

	if len(r1.Posts) != 2 {
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
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "search for post1"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "search for post2"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag search for post3"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel1.Id, Message: "hashtag for post4"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	r1 := Client.Must(Client.SearchPosts("search")).Data.(*model.PostList)

	if len(r1.Order) != 3 {
		t.Fatal("wrong serach")
	}

	r2 := Client.Must(Client.SearchPosts("post2")).Data.(*model.PostList)

	if len(r2.Order) != 1 && r2.Order[0] == post2.Id {
		t.Fatal("wrong serach")
	}

	r3 := Client.Must(Client.SearchPosts("#hashtag")).Data.(*model.PostList)

	if len(r3.Order) != 1 && r3.Order[0] == post3.Id {
		t.Fatal("wrong serach")
	}

	if r4 := Client.Must(Client.SearchPosts("*")).Data.(*model.PostList); len(r4.Order) != 0 {
		t.Fatal("searching for just * shouldn't return any results")
	}
}

func TestSearchHashtagPosts(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "#sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "#sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "no hashtag"}
	post3 = Client.Must(Client.CreatePost(post3)).Data.(*model.Post)

	r1 := Client.Must(Client.SearchPosts("#sgtitlereview")).Data.(*model.PostList)

	if len(r1.Order) != 2 {
		t.Fatal("wrong search")
	}
}

func TestSearchPostsInChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

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

	if result := Client.Must(Client.SearchPosts("channel:")).Data.(*model.PostList); len(result.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("in:")).Data.(*model.PostList); len(result.Order) != 0 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel:" + channel1.Name)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("in: " + channel2.Name)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel: " + channel2.Name)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("ChAnNeL: " + channel2.Name)).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview")).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview in:")).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview channel:" + channel1.Name)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview in: " + channel2.Name)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("sgtitlereview channel: " + channel2.Name)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("channel: " + channel2.Name + " channel: " + channel3.Name)).Data.(*model.PostList); len(result.Order) != 3 {
		t.Fatalf("wrong number of posts returned :) %v :) %v", result.Posts, result.Order)
	}
}

func TestSearchPostsFromUser(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "sgtitlereview with space"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")
	Client.Must(Client.JoinChannel(channel1.Id))
	Client.Must(Client.JoinChannel(channel2.Id))

	post2 := &model.Post{ChannelId: channel2.Id, Message: "sgtitlereview\n with return"}
	post2 = Client.Must(Client.CreatePost(post2)).Data.(*model.Post)

	// includes "X has joined the channel" messages for both user2 and user3

	if result := Client.Must(Client.SearchPosts("from: " + user1.Username)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username)).Data.(*model.PostList); len(result.Order) != 3 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username + " sgtitlereview")).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username + " in:" + channel1.Name)).Data.(*model.PostList); len(result.Order) != 1 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	user3 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user3.Id))

	Client.LoginByEmail(team.Name, user3.Email, "pwd")
	Client.Must(Client.JoinChannel(channel1.Id))
	Client.Must(Client.JoinChannel(channel2.Id))

	// wait for the join/leave messages to be created for user3 since they're done asynchronously
	time.Sleep(100 * time.Millisecond)

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username)).Data.(*model.PostList); len(result.Order) != 3 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username + " from: " + user3.Username)).Data.(*model.PostList); len(result.Order) != 5 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username + " from: " + user3.Username + " in:" + channel2.Name)).Data.(*model.PostList); len(result.Order) != 3 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}

	if result := Client.Must(Client.SearchPosts("from: " + user2.Username + " from: " + user3.Username + " in:" + channel2.Name + " joined")).Data.(*model.PostList); len(result.Order) != 2 {
		t.Fatalf("wrong number of posts returned %v", len(result.Order))
	}
}

func TestGetPostsCache(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

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
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	userAdmin := &model.User{TeamId: team.Id, Email: team.Email, Nickname: "Corey Hulen", Password: "pwd"}
	userAdmin = Client.Must(Client.CreateUser(userAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userAdmin.Id))

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

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

	if len(r2.Posts) != 4 {
		t.Fatal("should have returned 4 items")
	}

	time.Sleep(10 * time.Millisecond)
	post4 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	post4 = Client.Must(Client.CreatePost(post4)).Data.(*model.Post)

	Client.LoginByEmail(team.Name, userAdmin.Email, "pwd")

	Client.Must(Client.DeletePost(channel1.Id, post4.Id))
}

func TestEmailMention(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: "corey@test.com", Nickname: "Bob Bobby", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "bob"}
	post1 = Client.Must(Client.CreatePost(post1)).Data.(*model.Post)

	// No easy way to verify the email was sent, but this will at least cause the server to throw errors if the code is broken

}

func TestFuzzyPosts(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	filenames := []string{"junk"}

	for i := 0; i < len(utils.FUZZY_STRINGS_POSTS); i++ {
		post := &model.Post{ChannelId: channel1.Id, Message: utils.FUZZY_STRINGS_POSTS[i], Filenames: filenames}

		_, err := Client.CreatePost(post)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestMakeDirectChannelVisible(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	// user2 will be created with prefs created to show user1 in the sidebar so set that to false to get rid of it
	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	preferences := &model.Preferences{
		{
			UserId:   user2.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     user1.Id,
			Value:    "false",
		},
	}
	Client.Must(Client.SetPreferences(preferences))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel := Client.Must(Client.CreateDirectChannel(map[string]string{"user_id": user2.Id})).Data.(*model.Channel)

	makeDirectChannelVisible(team.Id, channel.Id)

	if result, err := Client.GetPreference(model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, user2.Id); err != nil {
		t.Fatal("Errored trying to set direct channel to be visible for user1")
	} else if pref := result.Data.(*model.Preference); pref.Value != "true" {
		t.Fatal("Failed to set direct channel to be visible for user1")
	}

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if result, err := Client.GetPreference(model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, user1.Id); err != nil {
		t.Fatal("Errored trying to set direct channel to be visible for user2")
	} else if pref := result.Data.(*model.Preference); pref.Value != "true" {
		t.Fatal("Failed to set direct channel to be visible for user2")
	}
}
