// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	_ "github.com/mattermost/mattermost/server/v8/channels/app/slashcommands"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestEchoCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel1 := th.BasicChannel

	echoTestString := "/echo test"

	r1, _, err := client.ExecuteCommand(context.Background(), channel1.Id, echoTestString)
	require.NoError(t, err)
	require.NotNil(t, r1, "Echo command failed to execute")

	r1, _, err = client.ExecuteCommand(context.Background(), channel1.Id, "/echo ")
	require.NoError(t, err)
	require.NotNil(t, r1, "Echo command failed to execute")

	time.Sleep(time.Second)

	p1, _, err := client.GetPostsForChannel(context.Background(), channel1.Id, 0, 2, "", false, false)
	require.NoError(t, err)
	require.Len(t, p1.Order, 2, "Echo command failed to send")
}

func TestGroupmsgCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
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

	rs1, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg "+user2.Username+","+user3.Username)
	require.NoError(t, err)

	group1 := model.GetGroupNameFromUserIds([]string{user1.Id, user2.Id, user3.Id})
	require.True(t, strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+group1), "failed to create group channel")

	rs2, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg "+user3.Username+","+user4.Username+" foobar")
	require.NoError(t, err)
	group2 := model.GetGroupNameFromUserIds([]string{user1.Id, user3.Id, user4.Id})

	require.True(t, strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+group2), "failed to create second direct channel")

	result, _, err := client.SearchPosts(context.Background(), team.Id, "foobar", false)
	require.NoError(t, err)
	require.NotEqual(t, 0, len(result.Order), "post did not get sent to direct message")

	rs3, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg "+user2.Username+","+user3.Username)
	require.NoError(t, err)
	require.True(t, strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+group1), "failed to go back to existing group channel")

	_, _, err = client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg "+user2.Username+" foobar")
	require.NoError(t, err)
	_, _, err = client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg "+user2.Username+","+user3.Username+","+user4.Username+","+user5.Username+","+user6.Username+","+user7.Username+","+user8.Username+","+user9.Username+" foobar")
	require.NoError(t, err)
	_, _, err = client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg junk foobar")
	require.NoError(t, err)
	_, _, err = client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg junk,junk2 foobar")
	require.NoError(t, err)
}

func TestInvitePeopleCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	r1, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/invite_people test@example.com")
	require.NoError(t, err)
	require.NotNil(t, r1, "Command failed to execute")

	r2, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/invite_people test1@example.com test2@example.com")
	require.NoError(t, err)
	require.NotNil(t, r2, "Command failed to execute")

	r3, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/invite_people")
	require.NoError(t, err)
	require.NotNil(t, r3, "Command failed to execute")
}

// also used to test /open (see command_open_test.go)
func testJoinCommands(t *testing.T, alias string) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	team := th.BasicTeam
	user2 := th.BasicUser2

	channel0 := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.ChannelTypeOpen, TeamId: team.Id}
	channel0, _, err := client.CreateChannel(context.Background(), channel0)
	require.NoError(t, err)

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.ChannelTypeOpen, TeamId: team.Id}
	channel1, _, err = client.CreateChannel(context.Background(), channel1)
	require.NoError(t, err)
	_, err = client.RemoveUserFromChannel(context.Background(), channel1.Id, th.BasicUser.Id)
	require.NoError(t, err)

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.ChannelTypeOpen, TeamId: team.Id}
	channel2, _, err = client.CreateChannel(context.Background(), channel2)
	require.NoError(t, err)
	_, err = client.RemoveUserFromChannel(context.Background(), channel2.Id, th.BasicUser.Id)
	require.NoError(t, err)

	channel3, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user2.Id)
	require.NoError(t, err)

	rs5, _, err := client.ExecuteCommand(context.Background(), channel0.Id, "/"+alias+" "+channel2.Name)
	require.NoError(t, err)
	require.True(t, strings.HasSuffix(rs5.GotoLocation, "/"+team.Name+"/channels/"+channel2.Name), "failed to join channel")

	rs6, _, err := client.ExecuteCommand(context.Background(), channel0.Id, "/"+alias+" "+channel3.Name)
	require.NoError(t, err)
	require.False(t, strings.HasSuffix(rs6.GotoLocation, "/"+team.Name+"/channels/"+channel3.Name), "should not have joined direct message channel")

	c1, _, err := client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, "")
	require.NoError(t, err)

	found := false
	for _, c := range c1 {
		if c.Id == channel2.Id {
			found = true
		}
	}
	require.True(t, found, "did not join channel")

	// test case insensitively
	channel4 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.ChannelTypeOpen, TeamId: team.Id}
	channel4, _, err = client.CreateChannel(context.Background(), channel4)
	require.NoError(t, err)
	_, err = client.RemoveUserFromChannel(context.Background(), channel4.Id, th.BasicUser.Id)
	require.NoError(t, err)
	rs7, _, err := client.ExecuteCommand(context.Background(), channel0.Id, "/"+alias+" "+strings.ToUpper(channel4.Name))
	require.NoError(t, err)
	require.True(t, strings.HasSuffix(rs7.GotoLocation, "/"+team.Name+"/channels/"+channel4.Name), "failed to join channel")
}

func TestJoinCommands(t *testing.T) {
	testJoinCommands(t, "join")
}

func TestLoadTestHelpCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/test help")
	require.NoError(t, err)
	require.True(t, strings.Contains(rs.Text, "Mattermost testing commands to help"), rs.Text)
}

func TestLoadTestSetupCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/test setup fuzz 1 1 1")
	require.NoError(t, err)
	require.Equal(t, "Created environment", rs.Text, rs.Text)
}

func TestLoadTestUsersCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/test users fuzz 1 2")
	require.NoError(t, err)
	require.Equal(t, "Added users", rs.Text, rs.Text)
}

func TestLoadTestChannelsCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/test channels fuzz 1 2")
	require.NoError(t, err)
	require.Equal(t, "Added channels", rs.Text, rs.Text)
}

func TestLoadTestPostsCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/test posts fuzz 2 3 2")
	require.NoError(t, err)
	require.Equal(t, "Added posts", rs.Text, rs.Text)
}

func TestLeaveCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	team := th.BasicTeam
	user2 := th.BasicUser2

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.ChannelTypeOpen, TeamId: team.Id}
	channel1, _, err := client.CreateChannel(context.Background(), channel1)
	require.NoError(t, err)
	_, _, err = client.AddChannelMember(context.Background(), channel1.Id, th.BasicUser.Id)
	require.NoError(t, err)

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.ChannelTypePrivate, TeamId: team.Id}
	channel2, _, err = client.CreateChannel(context.Background(), channel2)
	require.NoError(t, err)
	_, _, err = client.AddChannelMember(context.Background(), channel2.Id, th.BasicUser.Id)
	require.NoError(t, err)
	_, _, err = client.AddChannelMember(context.Background(), channel2.Id, user2.Id)
	require.NoError(t, err)

	channel3, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user2.Id)
	require.NoError(t, err)

	rs1, _, err := client.ExecuteCommand(context.Background(), channel1.Id, "/leave")
	require.NoError(t, err)
	require.True(t, strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+model.DefaultChannelName), "failed to leave open channel 1")

	rs2, _, err := client.ExecuteCommand(context.Background(), channel2.Id, "/leave")
	require.NoError(t, err)
	require.True(t, strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+model.DefaultChannelName), "failed to leave private channel 1")

	_, _, err = client.ExecuteCommand(context.Background(), channel3.Id, "/leave")
	require.Error(t, err)

	cdata, _, err := client.GetChannelsForTeamForUser(context.Background(), th.BasicTeam.Id, th.BasicUser.Id, false, "")
	require.NoError(t, err)

	found := false
	for _, c := range cdata {
		if c.Id == channel1.Id || c.Id == channel2.Id {
			found = true
		}
	}
	require.False(t, found, "did not leave right channels")

	for _, c := range cdata {
		if c.Name == model.DefaultChannelName {
			_, err := client.RemoveUserFromChannel(context.Background(), c.Id, th.BasicUser.Id)
			require.Error(t, err, "should have errored on leaving default channel")
			break
		}
	}
}

func TestLogoutTestCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/logout")
	require.NoError(t, err)
}

func TestMeCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	testString := "/me hello"

	r1, _, err := client.ExecuteCommand(context.Background(), channel.Id, testString)
	require.NoError(t, err)
	require.NotNil(t, r1, "Command failed to execute")

	time.Sleep(time.Second)

	p1, _, err := client.GetPostsForChannel(context.Background(), channel.Id, 0, 2, "", false, false)
	require.NoError(t, err)
	require.Len(t, p1.Order, 2, "Command failed to send")

	pt := p1.Posts[p1.Order[0]].Type
	require.Equal(t, model.PostTypeMe, pt, "invalid post type")

	msg := p1.Posts[p1.Order[0]].Message
	want := "*hello*"
	require.Equal(t, want, msg, "invalid me response")
}

func TestMsgCommands(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	th.LinkUserToTeam(user3, team)

	_, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user2.Id)
	require.NoError(t, err)
	_, _, err = client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user3.Id)
	require.NoError(t, err)

	rs1, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg "+user2.Username)
	require.NoError(t, err)
	require.Condition(t, func() bool {
		return strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) ||
			strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id)
	}, "failed to create direct channel")

	rs2, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg "+user3.Username+" foobar")
	require.NoError(t, err)
	require.Condition(t, func() bool {
		return strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user3.Id) ||
			strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+user3.Id+"__"+user1.Id)
	}, "failed to create second direct channel")

	result, _, err := client.SearchPosts(context.Background(), th.BasicTeam.Id, "foobar", false)
	require.NoError(t, err)
	require.NotEqual(t, 0, len(result.Order), "post did not get sent to direct message")

	rs3, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg "+user2.Username)
	require.NoError(t, err)
	require.Condition(t, func() bool {
		return strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user1.Id+"__"+user2.Id) ||
			strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+user2.Id+"__"+user1.Id)
	}, "failed to go back to existing direct channel")

	_, _, err = client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg "+th.BasicUser.Username+" foobar")
	require.NoError(t, err)
	_, _, err = client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg junk foobar")
	require.NoError(t, err)
}

func TestOpenCommands(t *testing.T) {
	testJoinCommands(t, "open")
}

func TestSearchCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/search")
	require.NoError(t, err)
}

func TestSettingsCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/settings")
	require.NoError(t, err)
}

func TestShortcutsCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/shortcuts")
	require.NoError(t, err)
}

func TestShrugCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	testString := "/shrug"

	r1, _, err := client.ExecuteCommand(context.Background(), channel.Id, testString)
	require.NoError(t, err)
	require.NotNil(t, r1, "Command failed to execute")

	time.Sleep(time.Second)
	p1, _, err := client.GetPostsForChannel(context.Background(), channel.Id, 0, 2, "", false, false)
	require.NoError(t, err)
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
	client := th.Client
	channel := th.BasicChannel
	user := th.BasicUser

	r1, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/"+status)
	require.NoError(t, err)
	require.NotEqual(t, "Command failed to execute", r1)

	time.Sleep(2 * time.Second)
	rstatus, _, err := client.GetUserStatus(context.Background(), user.Id, "")
	require.NoError(t, err)
	require.Equal(t, status, rstatus.Status, "Error setting status")
}
