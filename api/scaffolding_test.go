// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	//l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"strings"
	"testing"
)

type testTeam struct {
	server model.Team
	client model.Team
}

type testUser struct {
	server model.User
	client model.User
	team   *testTeam
}

type testChannel struct {
	server model.Channel
	team   *testTeam
}

func createTestUser() testUser {
	return createUsers(1)[0]
}

func createTwoUsers() (u1, u2 testUser) {
	users := createUsers(2)
	return users[0], users[1]
}

func createUsers(count int) []testUser {
	serverTeam := model.Team{
		DisplayName: "Name",
		Name:        "z-z-" + model.NewId() + "a",
		Email:       "test@nowhere.com",
		Type:        model.TEAM_OPEN}

	r, _ := Client.CreateTeam(&serverTeam)
	clientTeam := r.Data.(*model.Team)
	team := &testTeam{server: serverTeam, client: *clientTeam}

	users := make([]testUser, count)
	for i := range users {
		user := &users[i]
		user.team = team
		user.server = model.User{
			TeamId:   team.client.Id,
			Email:    strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com",
			Nickname: "Corey Hulen",
			Password: "pwd"}
		user.client = *Client.Must(Client.CreateUser(&user.server, "")).Data.(*model.User)
		store.Must(Srv.Store.User().VerifyEmail(user.client.Id))
	}
	return users
}

func (team *testTeam) createChannel(displayName string) testChannel {
	channel := &model.Channel{
		DisplayName: displayName,
		Name:        displayName + model.NewId(),
		Type:        model.CHANNEL_OPEN,
		TeamId:      team.client.Id}
	channel = Client.Must(Client.CreateChannel(channel)).Data.(*model.Channel)
	return testChannel{
		server: *channel,
		team:   team}
}

func (user *testUser) loginByEmail() {
	Client.LoginByEmail(user.team.server.Name, user.server.Email, user.server.Password)
}

func (user *testUser) setStatus(status string, t *testing.T) {
	_, err := Client.UpdateStatus(status)
	if err != nil {
		t.Fatal(err)
	}
}

func (user *testUser) assertStatusIs(expectedValue string, t *testing.T) {
	userIds := []string{user.client.Id}

	r1, err := Client.GetStatuses(userIds)
	if err != nil {
		t.Fatal(err)
	}

	statuses := r1.Data.(map[string]string)

	if len(statuses) != 1 {
		t.Fatal(fmt.Sprintf("invalid number of statuses: %v", len(statuses)))
	}

	actualValue := statuses[user.client.Id]
	if actualValue != expectedValue {
		t.Fatal("invalid status value: " + actualValue + "; expected - " + expectedValue)
	}
}

const (
	only_inactivity     = false
	inactivity_and_ping = true
)

func (user *testUser) setInactivityPeriod(millis int64, noPing bool) {
	inactivityTime := model.GetMillis() - millis
	noPingTime := model.GetMillis()
	if noPing {
		noPingTime = noPingTime - millis
	}
	store.Must(Srv.Store.User().UpdateLastActivityAt(user.client.Id, inactivityTime))
	store.Must(Srv.Store.User().UpdateLastPingAt(user.client.Id, noPingTime))
}

func (channel *testChannel) command(command string, t *testing.T) {
	r1 := Client.Must(Client.Command(channel.server.Id, command, false)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}
}

func (channel *testChannel) chatterPosts() *model.PostList {
	return Client.Must(Client.GetPosts(channel.server.Id, 0, 100, "")).Data.(*model.PostList)
}

func (channel *testChannel) latestChatterPost() string {
	posts := channel.chatterPosts()
	return posts.Posts[posts.Order[0]].Message
}
