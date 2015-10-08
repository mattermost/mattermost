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
)

func BenchmarkCreateChannel(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	}
}

func BenchmarkCreateDirectChannel(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	userCreator := NewAutoUserCreator(Client, team.Id)
	users, err := userCreator.CreateTestUsers(NUM_CHANNELS_RANGE)
	if err == false {
		b.Fatal("Could not create users")
	}

	data := make([]map[string]string, len(users))

	for i := range data {
		newmap := map[string]string{
			"user_id": users[i].Id,
		}
		data[i] = newmap
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := 0; j < NUM_CHANNELS; j++ {
			Client.CreateDirectChannel(data[j])
		}
	}
}

func BenchmarkUpdateChannel(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE      = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
		CHANNEL_DESCRIPTION_LEN = 50
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	for i := range channels {
		channels[i].Description = utils.RandString(CHANNEL_DESCRIPTION_LEN, utils.ALPHANUMERIC)
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			if _, err := Client.UpdateChannel(channels[j]); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkGetChannels(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	_, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Client.Must(Client.GetChannels(""))
	}
}

func BenchmarkGetMoreChannels(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	_, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Client.Must(Client.GetMoreChannels(""))
	}
}

func BenchmarkJoinChannel(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Secondary test user to join channels created by primary test user
	user := &model.User{TeamId: team.Id, Email: model.NewId() + "random@test.com", Nickname: "That Guy", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))
	Client.LoginByEmail(team.Name, user.Email, "pwd")

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			Client.Must(Client.JoinChannel(channels[j].Id))
		}
	}
}

func BenchmarkDeleteChannel(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			Client.Must(Client.DeleteChannel(channels[j].Id))
		}
	}
}

func BenchmarkGetChannelExtraInfo(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, _, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			Client.Must(Client.GetChannelExtraInfo(channels[j].Id, ""))
		}
	}
}

func BenchmarkAddChannelMember(b *testing.B) {
	var (
		NUM_USERS       = 100
		NUM_USERS_RANGE = utils.Range{NUM_USERS, NUM_USERS}
	)
	team, _, _ := SetupBenchmark()

	channel := &model.Channel{DisplayName: "Test Channel", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	userCreator := NewAutoUserCreator(Client, team.Id)
	users, valid := userCreator.CreateTestUsers(NUM_USERS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test users")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range users {
			if _, err := Client.AddChannelMember(channel.Id, users[j].Id); err != nil {
				b.Fatal(err)
			}
		}
	}
}

// Is this benchmark failing? Raise your file ulimit! 2048 worked for me.
func BenchmarkRemoveChannelMember(b *testing.B) {
	var (
		NUM_USERS       = 140
		NUM_USERS_RANGE = utils.Range{NUM_USERS, NUM_USERS}
	)
	team, _, _ := SetupBenchmark()

	channel := &model.Channel{DisplayName: "Test Channel", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)

	userCreator := NewAutoUserCreator(Client, team.Id)
	users, valid := userCreator.CreateTestUsers(NUM_USERS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test users")
	}

	for i := range users {
		if _, err := Client.AddChannelMember(channel.Id, users[i].Id); err != nil {
			b.Fatal(err)
		}
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range users {
			if _, err := Client.RemoveChannelMember(channel.Id, users[j].Id); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkUpdateNotifyProps(b *testing.B) {
	var (
		NUM_CHANNELS_RANGE = utils.Range{NUM_CHANNELS, NUM_CHANNELS}
	)
	team, user, _ := SetupBenchmark()

	channelCreator := NewAutoChannelCreator(Client, team.Id)
	channels, valid := channelCreator.CreateTestChannels(NUM_CHANNELS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test channels")
	}

	data := make([]map[string]string, len(channels))

	for i := range data {
		newmap := map[string]string{
			"channel_id":  channels[i].Id,
			"user_id":     user.Id,
			"desktop":     model.CHANNEL_NOTIFY_MENTION,
			"mark_unread": model.CHANNEL_MARK_UNREAD_MENTION,
		}
		data[i] = newmap
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j := range channels {
			Client.Must(Client.UpdateNotifyProps(data[j]))
		}
	}
}
