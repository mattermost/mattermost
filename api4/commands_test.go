// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestEchoCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel1 := th.BasicChannel

	echoTestString := "/echo test"

	r1 := Client.Must(Client.ExecuteCommand(channel1.Id, echoTestString)).(*model.CommandResponse)
	require.NotNil(t, r1, "Echo command failed to execute")

	r1 = Client.Must(Client.ExecuteCommand(channel1.Id, "/echo ")).(*model.CommandResponse)
	require.NotNil(t, r1, "Echo command failed to execute")

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPostsForChannel(channel1.Id, 0, 2, "")).(*model.PostList)
	require.Len(t, p1.Order, 2, "Echo command failed to send")
}

func TestGroupmsgCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	user4 := th.CreateUser()
	user5 := th.CreateUser()
	user6 := th.CreateUser()
	user7 := th.CreateUser()
	user8 := th.CreateUser()
	user9 := th.CreateUser()
	th.LinkUserToTeam(user3, team)
	th.LinkUserToTeam(user4, team)

	rs1 := Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg "+user2.Username+","+user3.Username)).(*model.CommandResponse)

	group1 := model.GetGroupNameFromUserIds([]string{user1.Id, user2.Id, user3.Id})
	require.True(t, strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+group1), "failed to create group channel")

	rs2 := Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg "+user3.Username+","+user4.Username+" foobar")).(*model.CommandResponse)
	group2 := model.GetGroupNameFromUserIds([]string{user1.Id, user3.Id, user4.Id})

	require.True(t, strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+group2), "failed to create second direct channel")

	result := Client.Must(Client.SearchPosts(team.Id, "foobar", false)).(*model.PostList)
	require.NotEqual(t, 0, len(result.Order), "post did not get sent to direct message")

	rs3 := Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg "+user2.Username+","+user3.Username)).(*model.CommandResponse)
	require.True(t, strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+group1), "failed to go back to existing group channel")

	Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg "+user2.Username+" foobar"))
	Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg "+user2.Username+","+user3.Username+","+user4.Username+","+user5.Username+","+user6.Username+","+user7.Username+","+user8.Username+","+user9.Username+" foobar"))
	Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg junk foobar"))
	Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/groupmsg junk,junk2 foobar"))
}

func TestInvitePeopleCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	r1 := Client.Must(Client.ExecuteCommand(channel.Id, "/invite_people test@example.com")).(*model.CommandResponse)
	require.NotNil(t, r1, "Command failed to execute")

	r2 := Client.Must(Client.ExecuteCommand(channel.Id, "/invite_people test1@example.com test2@example.com")).(*model.CommandResponse)
	require.NotNil(t, r2, "Command failed to execute")

	r3 := Client.Must(Client.ExecuteCommand(channel.Id, "/invite_people")).(*model.CommandResponse)
	require.NotNil(t, r3, "Command failed to execute")
}

// also used to test /open (see command_open_test.go)
func testJoinCommands(t *testing.T, alias string) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	team := th.BasicTeam
	user2 := th.BasicUser2

	channel0 := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel0 = Client.Must(Client.CreateChannel(channel0)).(*model.Channel)

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).(*model.Channel)
	Client.Must(Client.RemoveUserFromChannel(channel1.Id, th.BasicUser.Id))

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).(*model.Channel)
	Client.Must(Client.RemoveUserFromChannel(channel2.Id, th.BasicUser.Id))

	channel3 := Client.Must(Client.CreateDirectChannel(th.BasicUser.Id, user2.Id)).(*model.Channel)

	rs5 := Client.Must(Client.ExecuteCommand(channel0.Id, "/"+alias+" "+channel2.Name)).(*model.CommandResponse)
	require.True(t, strings.HasSuffix(rs5.GotoLocation, "/"+team.Name+"/channels/"+channel2.Name), "failed to join channel")

	rs6 := Client.Must(Client.ExecuteCommand(channel0.Id, "/"+alias+" "+channel3.Name)).(*model.CommandResponse)
	require.False(t, strings.HasSuffix(rs6.GotoLocation, "/"+team.Name+"/channels/"+channel3.Name), "should not have joined direct message channel")

	c1 := Client.Must(Client.GetChannelsForTeamForUser(th.BasicTeam.Id, th.BasicUser.Id, "")).([]*model.Channel)

	found := false
	for _, c := range c1 {
		if c.Id == channel2.Id {
			found = true
		}
	}
	require.True(t, found, "did not join channel")
}

func TestJoinCommands(t *testing.T) {
	testJoinCommands(t, "join")
}

func TestLoadTestHelpCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.ExecuteCommand(channel.Id, "/test help")).(*model.CommandResponse)
	require.True(t, strings.Contains(rs.Text, "Mattermost testing commands to help"), rs.Text)

	time.Sleep(2 * time.Second)
}

func TestLoadTestSetupCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.ExecuteCommand(channel.Id, "/test setup fuzz 1 1 1")).(*model.CommandResponse)
	require.Equal(t, "Created environment", rs.Text, rs.Text)

	time.Sleep(2 * time.Second)
}

func TestLoadTestUsersCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.ExecuteCommand(channel.Id, "/test users fuzz 1 2")).(*model.CommandResponse)
	require.Equal(t, "Added users", rs.Text, rs.Text)

	time.Sleep(2 * time.Second)
}

func TestLoadTestChannelsCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.ExecuteCommand(channel.Id, "/test channels fuzz 1 2")).(*model.CommandResponse)
	require.Equal(t, "Added channels", rs.Text, rs.Text)

	time.Sleep(2 * time.Second)
}

func TestLoadTestPostsCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs := Client.Must(Client.ExecuteCommand(channel.Id, "/test posts fuzz 2 3 2")).(*model.CommandResponse)
	require.Equal(t, "Added posts", rs.Text, rs.Text)

	time.Sleep(2 * time.Second)
}

func TestLeaveCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	team := th.BasicTeam
	user2 := th.BasicUser2

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).(*model.Channel)
	Client.Must(Client.AddChannelMember(channel1.Id, th.BasicUser.Id))

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).(*model.Channel)
	Client.Must(Client.AddChannelMember(channel2.Id, th.BasicUser.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, user2.Id))

	channel3 := Client.Must(Client.CreateDirectChannel(th.BasicUser.Id, user2.Id)).(*model.Channel)

	rs1 := Client.Must(Client.ExecuteCommand(channel1.Id, "/leave")).(*model.CommandResponse)
	require.True(t, strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+model.DEFAULT_CHANNEL), "failed to leave open channel 1")

	rs2 := Client.Must(Client.ExecuteCommand(channel2.Id, "/leave")).(*model.CommandResponse)
	require.True(t, strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+model.DEFAULT_CHANNEL), "failed to leave private channel 1")

	_, err := Client.ExecuteCommand(channel3.Id, "/leave")
	require.NotNil(t, err, "should fail leaving direct channel")

	cdata := Client.Must(Client.GetChannelsForTeamForUser(th.BasicTeam.Id, th.BasicUser.Id, "")).([]*model.Channel)

	found := false
	for _, c := range cdata {
		if c.Id == channel1.Id || c.Id == channel2.Id {
			found = true
		}
	}
	require.False(t, found, "did not leave right channels")

	for _, c := range cdata {
		if c.Name == model.DEFAULT_CHANNEL {
			_, err := Client.RemoveUserFromChannel(c.Id, th.BasicUser.Id)
			require.NotNil(t, err, "should have errored on leaving default channel")
			break
		}
	}
}

func TestLogoutTestCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Client.Must(th.Client.ExecuteCommand(th.BasicChannel.Id, "/logout"))
}

func TestMeCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	testString := "/me hello"

	r1 := Client.Must(Client.ExecuteCommand(channel.Id, testString)).(*model.CommandResponse)
	require.NotNil(t, r1, "Command failed to execute")

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPostsForChannel(channel.Id, 0, 2, "")).(*model.PostList)
	require.Len(t, p1.Order, 2, "Command failed to send")

	pt := p1.Posts[p1.Order[0]].Type
	require.Equal(t, model.POST_ME, pt, "invalid post type")

	msg := p1.Posts[p1.Order[0]].Message
	want := "*hello*"
	require.Equal(t, want, msg, "invalid me response")
}

func TestMsgCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	th.LinkUserToTeam(user3, team)

	Client.Must(Client.CreateDirectChannel(th.BasicUser.Id, user2.Id))
	Client.Must(Client.CreateDirectChannel(th.BasicUser.Id, user3.Id))

	rs1 := Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/msg "+user2.Username)).(*model.CommandResponse)
	require.Condition(t, func() bool {
		return strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) ||
			strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id)
	}, "failed to create direct channel")

	rs2 := Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/msg "+user3.Username+" foobar")).(*model.CommandResponse)
	require.Condition(t, func() bool {
		return strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user3.Id) ||
			strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user3.Id+"__"+user1.Id)
	}, "failed to create second direct channel")

	result := Client.Must(Client.SearchPosts(th.BasicTeam.Id, "foobar", false)).(*model.PostList)
	require.NotEqual(t, 0, len(result.Order), "post did not get sent to direct message")

	rs3 := Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/msg "+user2.Username)).(*model.CommandResponse)
	require.Condition(t, func() bool {
		return strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) ||
			strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id)
	}, "failed to go back to existing direct channel")

	Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/msg "+th.BasicUser.Username+" foobar"))
	Client.Must(Client.ExecuteCommand(th.BasicChannel.Id, "/msg junk foobar"))
}

func TestOpenCommands(t *testing.T) {
	testJoinCommands(t, "open")
}

func TestSearchCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Client.Must(th.Client.ExecuteCommand(th.BasicChannel.Id, "/search"))
}

func TestSettingsCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Client.Must(th.Client.ExecuteCommand(th.BasicChannel.Id, "/settings"))
}

func TestShortcutsCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Client.Must(th.Client.ExecuteCommand(th.BasicChannel.Id, "/shortcuts"))
}

func TestShrugCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	testString := "/shrug"

	r1 := Client.Must(Client.ExecuteCommand(channel.Id, testString)).(*model.CommandResponse)
	require.NotNil(t, r1, "Command failed to execute")

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPostsForChannel(channel.Id, 0, 2, "")).(*model.PostList)
	require.Len(t, p1.Order, 2, "Command failed to send")
	require.Equal(t, `¯\\\_(ツ)\_/¯`, p1.Posts[p1.Order[0]].Message, "invalid shrug response")
}

func TestStatusCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	commandAndTest(t, th, "away")
	commandAndTest(t, th, "offline")
	commandAndTest(t, th, "online")
}

func commandAndTest(t *testing.T, th *TestHelper, status string) {
	Client := th.Client
	channel := th.BasicChannel
	user := th.BasicUser

	r1 := Client.Must(Client.ExecuteCommand(channel.Id, "/"+status)).(*model.CommandResponse)
	require.NotEqual(t, "Command failed to execute", r1)

	time.Sleep(1000 * time.Millisecond)

	rstatus := Client.Must(Client.GetUserStatus(user.Id, "")).(*model.Status)
	require.Equal(t, status, rstatus.Status, "Error setting status")
}
