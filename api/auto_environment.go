// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"math/rand"
	"time"
)

type TestEnvironment struct {
	Teams        []*model.Team
	Environments []TeamEnvironment
}

func CreateTestEnvironmentWithTeams(client *model.Client, rangeTeams utils.Range, rangeChannels utils.Range, rangeUsers utils.Range, rangePosts utils.Range, fuzzy bool) (TestEnvironment, bool) {
	rand.Seed(time.Now().UTC().UnixNano())

	teamCreator := NewAutoTeamCreator(client)
	teamCreator.Fuzzy = fuzzy
	teams, err := teamCreator.CreateTestTeams(rangeTeams)
	if err != true {
		return TestEnvironment{}, false
	}

	environment := TestEnvironment{teams, make([]TeamEnvironment, len(teams))}

	for i, team := range teams {
		userCreator := NewAutoUserCreator(client, team)
		userCreator.Fuzzy = fuzzy
		randomUser, err := userCreator.createRandomUser()
		if err != true {
			return TestEnvironment{}, false
		}
		client.LoginById(randomUser.Id, USER_PASSWORD)
		client.SetTeamId(team.Id)
		teamEnvironment, err := CreateTestEnvironmentInTeam(client, team, rangeChannels, rangeUsers, rangePosts, fuzzy)
		if err != true {
			return TestEnvironment{}, false
		}
		environment.Environments[i] = teamEnvironment
	}

	return environment, true
}

func CreateTestEnvironmentInTeam(client *model.Client, team *model.Team, rangeChannels utils.Range, rangeUsers utils.Range, rangePosts utils.Range, fuzzy bool) (TeamEnvironment, bool) {
	rand.Seed(time.Now().UTC().UnixNano())

	// We need to create at least one user
	if rangeUsers.Begin <= 0 {
		rangeUsers.Begin = 1
	}

	userCreator := NewAutoUserCreator(client, team)
	userCreator.Fuzzy = fuzzy
	users, err := userCreator.CreateTestUsers(rangeUsers)
	if err != true {
		return TeamEnvironment{}, false
	}
	usernames := make([]string, len(users))
	for i, user := range users {
		usernames[i] = user.Username
	}

	channelCreator := NewAutoChannelCreator(client, team)
	channelCreator.Fuzzy = fuzzy
	channels, err := channelCreator.CreateTestChannels(rangeChannels)

	// Have every user join every channel
	for _, user := range users {
		for _, channel := range channels {
			client.LoginById(user.Id, USER_PASSWORD)
			client.JoinChannel(channel.Id)
		}
	}

	if err != true {
		return TeamEnvironment{}, false
	}

	numPosts := utils.RandIntFromRange(rangePosts)
	numImages := utils.RandIntFromRange(rangePosts) / 4
	for j := 0; j < numPosts; j++ {
		user := users[utils.RandIntFromRange(utils.Range{0, len(users) - 1})]
		client.LoginById(user.Id, USER_PASSWORD)
		for i, channel := range channels {
			postCreator := NewAutoPostCreator(client, channel.Id)
			postCreator.HasImage = i < numImages
			postCreator.Users = usernames
			postCreator.Fuzzy = fuzzy
			postCreator.CreateRandomPost()
		}
	}

	return TeamEnvironment{users, channels}, true
}
