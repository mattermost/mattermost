// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"testing"
)

const (
	NUM_CHANNELS = 140
	NUM_USERS    = 40
)

func BenchmarkCreateChannel(b *testing.B) {
	th := Setup().InitBasic()

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		channelCreator.CreateTestChannels(utils.Range{NUM_CHANNELS, NUM_CHANNELS})
	}
}

func BenchmarkCreateDirectChannel(b *testing.B) {
	th := Setup().InitBasic()

	userCreator := NewAutoUserCreator(th.BasicClient, th.BasicTeam)
	users, err := userCreator.CreateTestUsers(utils.Range{NUM_USERS, NUM_USERS})
	if err == false {
		b.Fatal("Could not create users")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := 0; j < NUM_USERS; j++ {
			th.BasicClient.CreateDirectChannel(users[j].Id)
		}
	}
}

func BenchmarkUpdateChannel(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
		CHANNEL_HEADER_LEN = 50
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	for i := range channels {
		channels[i].Header = utils.RandString(CHANNEL_HEADER_LEN, utils.ALPHANUMERIC)
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			if _, err := th.BasicClient.UpdateChannel(channels[j]); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkGetChannels(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	_, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		th.BasicClient.Must(th.BasicClient.GetChannels(""))
	}
}

func BenchmarkGetMoreChannels(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	_, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		th.BasicClient.Must(th.BasicClient.GetMoreChannels(""))
	}
}

func BenchmarkJoinChannel(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Secondary test user to join channels created by primary test user
	user := &model.User{Email: "success+" + model.NewId() + "@simulator.amazonses.com", Nickname: "That Guy", Password: "pwd"}
	user = th.BasicClient.Must(th.BasicClient.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, th.BasicTeam)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))
	th.BasicClient.Login(user.Email, "pwd")

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			th.BasicClient.Must(th.BasicClient.JoinChannel(channels[j].Id))
		}
	}
}

func BenchmarkDeleteChannel(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			th.BasicClient.Must(th.BasicClient.DeleteChannel(channels[j].Id))
		}
	}
}

func BenchmarkGetChannelExtraInfo(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			th.BasicClient.Must(th.BasicClient.GetChannelExtraInfo(channels[j].Id, -1, ""))
		}
	}
}

func BenchmarkAddChannelMember(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_USERS       = 100
		NUM_USERS_RANGE = utils.Range{NUM_USERS, NUM_USERS}
	)

	channel := &model.Channel{DisplayName: "Test Channel", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}
	channel = th.BasicClient.Must(th.BasicClient.CreateChannel(channel)).Data.(*model.Channel)

	userCreator := NewAutoUserCreator(th.BasicClient, th.BasicTeam)
	users, valid := userCreator.CreateTestUsers(NUM_USERS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test users")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range users {
			if _, err := th.BasicClient.AddChannelMember(channel.Id, users[j].Id); err != nil {
				b.Fatal(err)
			}
		}
	}
}

// Is this benchmark failing? Raise your file ulimit! 2048 worked for me.
func BenchmarkRemoveChannelMember(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_USERS       = 140
		NUM_USERS_RANGE = utils.Range{NUM_USERS, NUM_USERS}
	)

	channel := &model.Channel{DisplayName: "Test Channel", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: th.BasicTeam.Id}
	channel = th.BasicClient.Must(th.BasicClient.CreateChannel(channel)).Data.(*model.Channel)

	userCreator := NewAutoUserCreator(th.BasicClient, th.BasicTeam)
	users, valid := userCreator.CreateTestUsers(NUM_USERS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test users")
	}

	for i := range users {
		if _, err := th.BasicClient.AddChannelMember(channel.Id, users[i].Id); err != nil {
			b.Fatal(err)
		}
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range users {
			if _, err := th.BasicClient.RemoveChannelMember(channel.Id, users[j].Id); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkUpdateNotifyProps(b *testing.B) {
	th := Setup().InitBasic()

	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)

	channelCreator := NewAutoChannelCreator(th.BasicClient, th.BasicTeam)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	data := make([]map[string]string, len(channels))

	for i := range data {
		newmap := map[string]string{
			"channel_id":  channels[i].Id,
			"user_id":     th.BasicUser.Id,
			"desktop":     model.CHANNEL_NOTIFY_MENTION,
			"mark_unread": model.CHANNEL_MARK_UNREAD_MENTION,
		}
		data[i] = newmap
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			th.BasicClient.Must(th.BasicClient.UpdateNotifyProps(data[j]))
		}
	}
}
