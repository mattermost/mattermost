// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

func TestCreateChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	team2 := &model.Team{DisplayName: "Name Team 2", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel := model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	rchannel, err := Client.CreateChannel(&channel)
	if err != nil {
		t.Fatal(err)
	}

	if rchannel.Data.(*model.Channel).Name != channel.Name {
		t.Fatal("full name didn't match")
	}

	rget := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)
	nameMatch := false
	for _, c := range rget.Channels {
		if c.Name == channel.Name {
			nameMatch = true
		}
	}

	if !nameMatch {
		t.Fatal("Did not create channel with correct name")
	}

	if _, err := Client.CreateChannel(rchannel.Data.(*model.Channel)); err == nil {
		t.Fatal("Cannot create an existing")
	}

	savedId := rchannel.Data.(*model.Channel).Id

	rchannel.Data.(*model.Channel).Id = ""
	if _, err := Client.CreateChannel(rchannel.Data.(*model.Channel)); err != nil {
		if err.Message != "A channel with that handle already exists" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost("/channels/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}

	Client.DeleteChannel(savedId)
	if _, err := Client.CreateChannel(rchannel.Data.(*model.Channel)); err != nil {
		if err.Message != "A channel with that handle was previously created" {
			t.Fatal(err)
		}
	}

	channel = model.Channel{DisplayName: "Channel on Different Team", Name: "aaaa" + model.NewId() + "abbb", Type: model.CHANNEL_OPEN, TeamId: team2.Id}

	if _, err := Client.CreateChannel(&channel); err.StatusCode != http.StatusForbidden {
		t.Fatal(err)
	}

	channel = model.Channel{DisplayName: "Test API Name", Name: model.NewId() + "__" + model.NewId(), Type: model.CHANNEL_OPEN, TeamId: team.Id}

	if _, err := Client.CreateChannel(&channel); err == nil {
		t.Fatal("Should have errored out on invalid '__' character")
	}

	channel = model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_DIRECT, TeamId: team.Id}

	if _, err := Client.CreateChannel(&channel); err == nil {
		t.Fatal("Should have errored out on direct channel type")
	}
}

func TestCreateDirectChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	data := make(map[string]string)
	data["user_id"] = user2.Id

	rchannel, err := Client.CreateDirectChannel(data)
	if err != nil {
		t.Fatal(err)
	}

	channelName := ""
	if user2.Id > user.Id {
		channelName = user.Id + "__" + user2.Id
	} else {
		channelName = user2.Id + "__" + user.Id
	}

	if rchannel.Data.(*model.Channel).Name != channelName {
		t.Fatal("channel name didn't match")
	}

	if rchannel.Data.(*model.Channel).Type != model.CHANNEL_DIRECT {
		t.Fatal("channel type was not direct")
	}

	if _, err := Client.CreateDirectChannel(data); err == nil {
		t.Fatal("channel already exists and should have failed")
	}

	data["user_id"] = "junk"
	if _, err := Client.CreateDirectChannel(data); err == nil {
		t.Fatal("should have failed with bad user id")
	}

	data["user_id"] = "12345678901234567890123456"
	if _, err := Client.CreateDirectChannel(data); err == nil {
		t.Fatal("should have failed with non-existent user")
	}

}

func TestUpdateChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	userTeamAdmin := &model.User{TeamId: team.Id, Email: team.Email, Nickname: "Corey Hulen", Password: "pwd"}
	userTeamAdmin = Client.Must(Client.CreateUser(userTeamAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userTeamAdmin.Id))

	userChannelAdmin := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	userChannelAdmin = Client.Must(Client.CreateUser(userChannelAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userChannelAdmin.Id))

	userStd := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	userStd = Client.Must(Client.CreateUser(userStd, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userStd.Id))
	userStd.Roles = ""

	Client.LoginByEmail(team.Name, userChannelAdmin.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	Client.AddChannelMember(channel1.Id, userTeamAdmin.Id)

	desc := "a" + model.NewId() + "a"
	upChannel1 := &model.Channel{Id: channel1.Id, Description: desc}
	upChannel1 = Client.Must(Client.UpdateChannel(upChannel1)).Data.(*model.Channel)

	if upChannel1.Description != desc {
		t.Fatal("Channel admin failed to update desc")
	}

	if upChannel1.DisplayName != channel1.DisplayName {
		t.Fatal("Channel admin failed to skip displayName")
	}

	Client.LoginByEmail(team.Name, userTeamAdmin.Email, "pwd")

	desc = "b" + model.NewId() + "b"
	upChannel1 = &model.Channel{Id: channel1.Id, Description: desc}
	upChannel1 = Client.Must(Client.UpdateChannel(upChannel1)).Data.(*model.Channel)

	if upChannel1.Description != desc {
		t.Fatal("Team admin failed to update desc")
	}

	if upChannel1.DisplayName != channel1.DisplayName {
		t.Fatal("Team admin failed to skip displayName")
	}

	rget := Client.Must(Client.GetChannels(""))
	data := rget.Data.(*model.ChannelList)
	for _, c := range data.Channels {
		if c.Name == model.DEFAULT_CHANNEL {
			c.Description = "new desc"
			if _, err := Client.UpdateChannel(c); err == nil {
				t.Fatal("should have errored on updating default channel")
			}
			break
		}
	}

	Client.LoginByEmail(team.Name, userStd.Email, "pwd")

	if _, err := Client.UpdateChannel(upChannel1); err == nil {
		t.Fatal("Standard User should have failed to update")
	}
}

func TestUpdateChannelDesc(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	data := make(map[string]string)
	data["channel_id"] = channel1.Id
	data["channel_description"] = "new desc"

	var upChannel1 *model.Channel
	if result, err := Client.UpdateChannelDesc(data); err != nil {
		t.Fatal(err)
	} else {
		upChannel1 = result.Data.(*model.Channel)
	}

	if upChannel1.Description != data["channel_description"] {
		t.Fatal("Failed to update desc")
	}

	data["channel_id"] = "junk"
	if _, err := Client.UpdateChannelDesc(data); err == nil {
		t.Fatal("should have errored on junk channel id")
	}

	data["channel_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateChannelDesc(data); err == nil {
		t.Fatal("should have errored on non-existent channel id")
	}

	data["channel_id"] = channel1.Id
	data["channel_description"] = ""
	for i := 0; i < 1050; i++ {
		data["channel_description"] += "a"
	}
	if _, err := Client.UpdateChannelDesc(data); err == nil {
		t.Fatal("should have errored on bad channel desc")
	}

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	data["channel_id"] = channel1.Id
	data["channel_description"] = "new desc"
	if _, err := Client.UpdateChannelDesc(data); err == nil {
		t.Fatal("should have errored non-channel member trying to update desc")
	}
}

func TestGetChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	rget := Client.Must(Client.GetChannels(""))
	data := rget.Data.(*model.ChannelList)

	if data.Channels[0].DisplayName != channel1.DisplayName {
		t.Fatal("full name didn't match")
	}

	if data.Channels[1].DisplayName != channel2.DisplayName {
		t.Fatal("full name didn't match")
	}

	// test etag caching
	if cache_result, err := Client.GetChannels(rget.Etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}

	if _, err := Client.UpdateLastViewedAt(channel2.Id); err != nil {
		t.Fatal(err)
	}

	if resp, err := Client.GetChannel(channel1.Id, ""); err != nil {
		t.Fatal(err)
	} else {
		data := resp.Data.(*model.ChannelData)
		if data.Channel.DisplayName != channel1.DisplayName {
			t.Fatal("name didn't match")
		}

		// test etag caching
		if cache_result, err := Client.GetChannel(channel1.Id, resp.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(*model.ChannelData) != nil {
			t.Log(cache_result.Data)
			t.Fatal("cache should be empty")
		}
	}

	if _, err := Client.GetChannel("junk", ""); err == nil {
		t.Fatal("should have failed - bad channel id")
	}
}

func TestGetMoreChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	rget := Client.Must(Client.GetMoreChannels(""))
	data := rget.Data.(*model.ChannelList)

	if data.Channels[0].DisplayName != channel1.DisplayName {
		t.Fatal("full name didn't match")
	}

	if data.Channels[1].DisplayName != channel2.DisplayName {
		t.Fatal("full name didn't match")
	}

	// test etag caching
	if cache_result, err := Client.GetMoreChannels(rget.Etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}
}

func TestGetChannelCounts(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	if result, err := Client.GetChannelCounts(""); err != nil {
		t.Fatal(err)
	} else {
		counts := result.Data.(*model.ChannelCounts)

		if len(counts.Counts) != 4 {
			t.Fatal("wrong number of channel counts")
		}

		if len(counts.UpdateTimes) != 4 {
			t.Fatal("wrong number of channel update times")
		}

		if cache_result, err := Client.GetChannelCounts(result.Etag); err != nil {
			t.Fatal(err)
		} else if cache_result.Data.(*model.ChannelCounts) != nil {
			t.Log(cache_result.Data)
			t.Fatal("result data should be empty")
		}
	}

}

func TestJoinChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	Client.Must(Client.JoinChannel(channel1.Id))

	if _, err := Client.JoinChannel(channel3.Id); err == nil {
		t.Fatal("shouldn't be able to join secret group")
	}

	data := make(map[string]string)
	data["user_id"] = user1.Id
	rchannel := Client.Must(Client.CreateDirectChannel(data)).Data.(*model.Channel)

	user3 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)

	Client.LoginByEmail(team.Name, user3.Email, "pwd")

	if _, err := Client.JoinChannel(rchannel.Id); err == nil {
		t.Fatal("shoudn't be able to join direct channel")
	}
}

func TestLeaveChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel3 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel3 = Client.Must(Client.CreateChannel(channel3)).Data.(*model.Channel)

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	Client.Must(Client.JoinChannel(channel1.Id))

	// No error if you leave a channel you cannot see
	Client.Must(Client.LeaveChannel(channel3.Id))

	data := make(map[string]string)
	data["user_id"] = user1.Id
	rchannel := Client.Must(Client.CreateDirectChannel(data)).Data.(*model.Channel)

	if _, err := Client.LeaveChannel(rchannel.Id); err == nil {
		t.Fatal("should have errored, cannot leave direct channel")
	}

	rget := Client.Must(Client.GetChannels(""))
	cdata := rget.Data.(*model.ChannelList)
	for _, c := range cdata.Channels {
		if c.Name == model.DEFAULT_CHANNEL {
			if _, err := Client.LeaveChannel(c.Id); err == nil {
				t.Fatal("should have errored on leaving default channel")
			}
			break
		}
	}
}

func TestDeleteChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	userTeamAdmin := &model.User{TeamId: team.Id, Email: team.Email, Nickname: "Corey Hulen", Password: "pwd"}
	userTeamAdmin = Client.Must(Client.CreateUser(userTeamAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userTeamAdmin.Id))

	userChannelAdmin := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	userChannelAdmin = Client.Must(Client.CreateUser(userChannelAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userChannelAdmin.Id))

	Client.LoginByEmail(team.Name, userChannelAdmin.Email, "pwd")

	channelMadeByCA := &model.Channel{DisplayName: "C Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channelMadeByCA = Client.Must(Client.CreateChannel(channelMadeByCA)).Data.(*model.Channel)

	Client.AddChannelMember(channelMadeByCA.Id, userTeamAdmin.Id)

	Client.LoginByEmail(team.Name, userTeamAdmin.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	if _, err := Client.DeleteChannel(channel1.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DeleteChannel(channelMadeByCA.Id); err != nil {
		t.Fatal("Team admin failed to delete Channel Admin's channel")
	}

	post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a"}
	if _, err := Client.CreatePost(post1); err == nil {
		t.Fatal("should have failed to post to deleted channel")
	}

	userStd := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	userStd = Client.Must(Client.CreateUser(userStd, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userStd.Id))

	Client.LoginByEmail(team.Name, userStd.Email, "pwd")

	if _, err := Client.JoinChannel(channel1.Id); err == nil {
		t.Fatal("should have failed to join deleted channel")
	}

	Client.Must(Client.JoinChannel(channel2.Id))

	if _, err := Client.DeleteChannel(channel2.Id); err == nil {
		t.Fatal("should have failed to delete channel you're not an admin of")
	}

	rget := Client.Must(Client.GetChannels(""))
	cdata := rget.Data.(*model.ChannelList)
	for _, c := range cdata.Channels {
		if c.Name == model.DEFAULT_CHANNEL {
			if _, err := Client.DeleteChannel(c.Id); err == nil {
				t.Fatal("should have errored on deleting default channel")
			}
			break
		}
	}
}

func TestGetChannelExtraInfo(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	rget := Client.Must(Client.GetChannelExtraInfo(channel1.Id, ""))
	data := rget.Data.(*model.ChannelExtra)
	if data.Id != channel1.Id {
		t.Fatal("couldnt't get extra info")
	}

	//
	// Testing etag caching
	//

	currentEtag := rget.Etag

	if cache_result, err := Client.GetChannelExtraInfo(channel1.Id, currentEtag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelExtra) != nil {
		t.Log(cache_result.Data)
		t.Fatal("response should be empty")
	} else {
		currentEtag = cache_result.Etag
	}

	Client2 := model.NewClient("http://localhost:"+utils.Cfg.ServiceSettings.Port, "http://localhost:"+utils.Cfg.ServiceSettings.Port+"/api/v1")

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "tester2@test.com", Nickname: "Tester 2", Password: "pwd"}
	user2 = Client2.Must(Client2.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client2.LoginByEmail(team.Name, user2.Email, "pwd")
	Client2.Must(Client2.JoinChannel(channel1.Id))

	if cache_result, err := Client.GetChannelExtraInfo(channel1.Id, currentEtag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelExtra) == nil {
		t.Log(cache_result.Data)
		t.Fatal("response should not be empty")
	} else {
		currentEtag = cache_result.Etag
	}

	if cache_result, err := Client.GetChannelExtraInfo(channel1.Id, currentEtag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelExtra) != nil {
		t.Log(cache_result.Data)
		t.Fatal("response should be empty")
	} else {
		currentEtag = cache_result.Etag
	}

	Client2.Must(Client2.LeaveChannel(channel1.Id))

	if cache_result, err := Client.GetChannelExtraInfo(channel1.Id, currentEtag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelExtra) == nil {
		t.Log(cache_result.Data)
		t.Fatal("response should not be empty")
	} else {
		currentEtag = cache_result.Etag
	}

	if cache_result, err := Client.GetChannelExtraInfo(channel1.Id, currentEtag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelExtra) != nil {
		t.Log(cache_result.Data)
		t.Fatal("response should be empty")
	} else {
		currentEtag = cache_result.Etag
	}
}

func TestAddChannelMember(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	if _, err := Client.AddChannelMember(channel1.Id, user2.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.AddChannelMember(channel1.Id, "dsgsdg"); err == nil {
		t.Fatal("Should have errored, bad user id")
	}

	if _, err := Client.AddChannelMember(channel1.Id, "12345678901234567890123456"); err == nil {
		t.Fatal("Should have errored, bad user id")
	}

	if _, err := Client.AddChannelMember(channel1.Id, user2.Id); err == nil {
		t.Fatal("Should have errored, user already a member")
	}

	if _, err := Client.AddChannelMember("sgdsgsdg", user2.Id); err == nil {
		t.Fatal("Should have errored, bad channel id")
	}

	channel2 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if _, err := Client.AddChannelMember(channel2.Id, user2.Id); err == nil {
		t.Fatal("Should have errored, user not in channel")
	}

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	Client.Must(Client.DeleteChannel(channel2.Id))

	if _, err := Client.AddChannelMember(channel2.Id, user2.Id); err == nil {
		t.Fatal("Should have errored, channel deleted")
	}

}

func TestRemoveChannelMember(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	userTeamAdmin := &model.User{TeamId: team.Id, Email: team.Email, Nickname: "Corey Hulen", Password: "pwd"}
	userTeamAdmin = Client.Must(Client.CreateUser(userTeamAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userTeamAdmin.Id))

	userChannelAdmin := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	userChannelAdmin = Client.Must(Client.CreateUser(userChannelAdmin, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userChannelAdmin.Id))

	Client.LoginByEmail(team.Name, userChannelAdmin.Email, "pwd")

	channelMadeByCA := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channelMadeByCA = Client.Must(Client.CreateChannel(channelMadeByCA)).Data.(*model.Channel)

	Client.Must(Client.AddChannelMember(channelMadeByCA.Id, userTeamAdmin.Id))

	Client.LoginByEmail(team.Name, userTeamAdmin.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	userStd := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	userStd = Client.Must(Client.CreateUser(userStd, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(userStd.Id))

	Client.Must(Client.AddChannelMember(channel1.Id, userStd.Id))

	Client.Must(Client.AddChannelMember(channelMadeByCA.Id, userStd.Id))

	if _, err := Client.RemoveChannelMember(channel1.Id, "dsgsdg"); err == nil {
		t.Fatal("Should have errored, bad user id")
	}

	if _, err := Client.RemoveChannelMember("sgdsgsdg", userStd.Id); err == nil {
		t.Fatal("Should have errored, bad channel id")
	}

	if _, err := Client.RemoveChannelMember(channel1.Id, userStd.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.RemoveChannelMember(channelMadeByCA.Id, userStd.Id); err != nil {
		t.Fatal("Team Admin failed to remove member from Channel Admin's channel")
	}

	channel2 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	Client.LoginByEmail(team.Name, userStd.Email, "pwd")

	if _, err := Client.RemoveChannelMember(channel2.Id, userStd.Id); err == nil {
		t.Fatal("Should have errored, user not channel admin")
	}

	Client.LoginByEmail(team.Name, userTeamAdmin.Email, "pwd")
	Client.Must(Client.AddChannelMember(channel2.Id, userStd.Id))

	Client.Must(Client.DeleteChannel(channel2.Id))

	if _, err := Client.RemoveChannelMember(channel2.Id, userStd.Id); err == nil {
		t.Fatal("Should have errored, channel deleted")
	}

}

func TestUpdateNotifyLevel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	data := make(map[string]string)
	data["channel_id"] = channel1.Id
	data["user_id"] = user.Id
	data["notify_level"] = model.CHANNEL_NOTIFY_MENTION

	timeBeforeUpdate := model.GetMillis()
	time.Sleep(100 * time.Millisecond)

	if _, err := Client.UpdateNotifyLevel(data); err != nil {
		t.Fatal(err)
	}

	rget := Client.Must(Client.GetChannels(""))
	rdata := rget.Data.(*model.ChannelList)
	if len(rdata.Members) == 0 || rdata.Members[channel1.Id].NotifyLevel != data["notify_level"] {
		t.Fatal("NotifyLevel did not update properly")
	}

	if rdata.Members[channel1.Id].LastUpdateAt <= timeBeforeUpdate {
		t.Fatal("LastUpdateAt did not update")
	}

	data["user_id"] = "junk"
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	data["user_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	data["user_id"] = user.Id
	data["channel_id"] = "junk"
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - bad channel id")
	}

	data["channel_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - bad channel id")
	}

	data["channel_id"] = channel1.Id
	data["notify_level"] = ""
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - empty notify level")
	}

	data["notify_level"] = "junk"
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - bad notify level")
	}

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	data["channel_id"] = channel1.Id
	data["user_id"] = user2.Id
	data["notify_level"] = model.CHANNEL_NOTIFY_MENTION
	if _, err := Client.UpdateNotifyLevel(data); err == nil {
		t.Fatal("Should have errored - user not in channel")
	}
}

func TestFuzzyChannel(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	// Strings that should pass as acceptable channel names
	var fuzzyStringsPass = []string{
		"*", "?", ".", "}{][)(><", "{}[]()<>",

		"qahwah ( قهوة)",
		"שָׁלוֹם עֲלֵיכֶם",
		"Ramen チャーシュー chāshū",
		"言而无信",
		"Ṫ͌ó̍ ̍͂̓̍̍̀i̊ͯ͒",
		"&amp; &lt; &qu",

		"' or '1'='1' -- ",
		"' or '1'='1' ({ ",
		"' or '1'='1' /* ",
		"1;DROP TABLE users",

		"<b><i><u><strong><em>",

		"sue@thatmightbe",
		"sue@thatmightbe.",
		"sue@thatmightbe.c",
		"sue@thatmightbe.co",
		"su+san@thatmightbe.com",
		"a@b.中国",
		"1@2.am",
		"a@b.co.uk",
		"a@b.cancerresearch",
		"local@[127.0.0.1]",
	}

	for i := 0; i < len(fuzzyStringsPass); i++ {
		channel := model.Channel{DisplayName: fuzzyStringsPass[i], Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}

		_, err := Client.CreateChannel(&channel)
		if err != nil {
			t.Fatal(err)
		}
	}
}
