// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	_ "github.com/mattermost/mattermost/server/v8/channels/app/slashcommands"
	"github.com/mattermost/mattermost/server/v8/channels/store"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestEchoCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(t)
	user4 := th.CreateUser(t)
	user5 := th.CreateUser(t)
	user6 := th.CreateUser(t)
	user7 := th.CreateUser(t)
	user8 := th.CreateUser(t)
	user9 := th.CreateUser(t)
	th.LinkUserToTeam(t, user3, team)
	th.LinkUserToTeam(t, user4, team)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
	th := Setup(t).InitBasic(t)

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
	mainHelper.Parallel(t)
	testJoinCommands(t, "join")
}

func TestLoadTestHelpCommands(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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

	rs, _, err = client.ExecuteCommand(context.Background(), channel.Id, "/test  help")
	require.NoError(t, err)
	require.True(t, strings.Contains(rs.Text, "Mattermost testing commands to help"), rs.Text)
}

func TestLoadTestSetupCommands(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.SystemAdminClient
	channel := th.BasicChannel
	th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(t, th.SystemAdminUser, channel)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.SystemAdminClient
	channel := th.BasicChannel
	th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(t, th.SystemAdminUser, channel)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.SystemAdminClient
	channel := th.BasicChannel
	th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(t, th.SystemAdminUser, channel)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.SystemAdminClient
	channel := th.BasicChannel
	th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
	th.AddUserToChannel(t, th.SystemAdminUser, channel)

	enableTesting := *th.App.Config().ServiceSettings.EnableTesting
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enableTesting })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })

	rs, _, err := client.ExecuteCommand(context.Background(), channel.Id, "/test posts fuzz 2 3 2")
	require.NoError(t, err)
	require.Equal(t, "Added posts", rs.Text, rs.Text)
}

func TestTestingModeUserManagementPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.LoginSystemManager(t)

	for _, user := range []*model.User{th.SystemAdminUser, th.SystemManagerUser} {
		th.LinkUserToTeam(t, user, th.BasicTeam)
		th.AddUserToChannel(t, user, th.BasicChannel)
	}

	setEnableTesting := func(t *testing.T, enabled bool) {
		t.Helper()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = enabled })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = false })
		})
	}

	newUserInChannel := func(t *testing.T, roles string) *model.User {
		t.Helper()
		user := th.CreateUser(t)
		if roles != "" {
			_, appErr := th.App.UpdateUserRoles(th.Context, user.Id, roles, false)
			require.Nil(t, appErr)
		}
		th.LinkUserToTeam(t, user, th.BasicTeam)
		th.AddUserToChannel(t, user, th.BasicChannel)
		return user
	}

	isActive := func(t *testing.T, userID string) bool {
		t.Helper()
		user, appErr := th.App.GetUser(userID)
		require.Nil(t, appErr)
		return user.DeleteAt == 0
	}

	runCommand := func(t *testing.T, client *model.Client4, command string) {
		t.Helper()
		resp, _, err := client.ExecuteCommand(context.Background(), th.BasicChannel.Id, command)
		if resp != nil {
			t.Logf("%q response: %q", command, resp.Text)
		}
		if err != nil {
			t.Logf("%q returned error: %v", command, err)
		}
	}

	t.Run("system manager cannot enable testing mode", func(t *testing.T) {
		setEnableTesting(t, false)

		patch := &model.Config{ServiceSettings: model.ServiceSettings{EnableTesting: new(true)}}
		returnedCfg, resp, err := th.SystemManagerClient.PatchConfig(context.Background(), patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.False(t, *returnedCfg.ServiceSettings.EnableTesting, "returned config should keep EnableTesting disabled")
		require.False(t, *th.App.Config().ServiceSettings.EnableTesting, "stored config should keep EnableTesting disabled")
	})

	t.Run("system manager cannot enable testing mode with a full config update", func(t *testing.T) {
		setEnableTesting(t, false)

		cfg, _, err := th.SystemManagerClient.GetConfig(context.Background())
		require.NoError(t, err)
		*cfg.ServiceSettings.EnableTesting = true

		returnedCfg, resp, err := th.SystemManagerClient.UpdateConfig(context.Background(), cfg)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.False(t, *returnedCfg.ServiceSettings.EnableTesting, "returned config should keep EnableTesting disabled")
		require.False(t, *th.App.Config().ServiceSettings.EnableTesting, "stored config should keep EnableTesting disabled")
	})

	t.Run("system manager can still change EnableDeveloper", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = false })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = false })
		})

		patch := &model.Config{ServiceSettings: model.ServiceSettings{EnableDeveloper: new(true)}}
		_, resp, err := th.SystemManagerClient.PatchConfig(context.Background(), patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.True(t, *th.App.Config().ServiceSettings.EnableDeveloper)
	})

	t.Run("system admin can enable testing mode", func(t *testing.T) {
		setEnableTesting(t, false)

		patch := &model.Config{ServiceSettings: model.ServiceSettings{EnableTesting: new(true)}}
		returnedCfg, resp, err := th.SystemAdminClient.PatchConfig(context.Background(), patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.True(t, *returnedCfg.ServiceSettings.EnableTesting)
		require.True(t, *th.App.Config().ServiceSettings.EnableTesting)
	})

	t.Run("system manager cannot deactivate a system admin via the test command", func(t *testing.T) {
		setEnableTesting(t, true)
		target := newUserInChannel(t, model.SystemUserRoleId+" "+model.SystemAdminRoleId)

		runCommand(t, th.SystemManagerClient, "/test deactivate_user "+target.Id)

		require.True(t, isActive(t, target.Id), "system admin should remain active")
	})

	t.Run("regular member cannot deactivate another user via the test command", func(t *testing.T) {
		setEnableTesting(t, true)
		target := newUserInChannel(t, "")

		runCommand(t, th.Client, "/test deactivate_user "+target.Id)

		require.True(t, isActive(t, target.Id), "user should remain active")
	})

	t.Run("regular member cannot activate a deactivated user via the test command", func(t *testing.T) {
		setEnableTesting(t, true)
		target := newUserInChannel(t, "")
		_, appErr := th.App.UpdateActive(th.Context, target, false)
		require.Nil(t, appErr)
		require.False(t, isActive(t, target.Id))

		runCommand(t, th.Client, "/test activate_user "+target.Id)

		require.False(t, isActive(t, target.Id), "user should remain deactivated")
	})

	t.Run("regular member cannot post as another user via test dms", func(t *testing.T) {
		setEnableTesting(t, true)
		target := newUserInChannel(t, "")

		runCommand(t, th.Client, "/test dms u=@"+target.Username+" range=2")

		dm, err := th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(th.BasicUser.Id, target.Id), false)
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			// No DM channel means no posts were created in it.
			return
		}
		require.NoError(t, err)
		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: dm.Id, Page: 0, PerPage: 100})
		require.Nil(t, appErr)
		for _, post := range posts.Posts {
			require.NotEqual(t, target.Id, post.UserId, "no post should be authored by the other user: %q", post.Message)
		}
	})

	t.Run("system admin can deactivate and activate users via the test command", func(t *testing.T) {
		setEnableTesting(t, true)
		target := newUserInChannel(t, "")

		runCommand(t, th.SystemAdminClient, "/test deactivate_user "+target.Id)
		require.False(t, isActive(t, target.Id), "user should be deactivated")

		runCommand(t, th.SystemAdminClient, "/test activate_user "+target.Id)
		require.True(t, isActive(t, target.Id), "user should be reactivated")
	})
}

func TestTestingModeCommandsRequireSystemAdmin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = true })
	t.Cleanup(func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableTesting = false })
	})

	runCommand := func(t *testing.T, client *model.Client4, channelID, command string) {
		t.Helper()
		resp, _, err := client.ExecuteCommand(context.Background(), channelID, command)
		if resp != nil {
			t.Logf("%q response: %q", command, resp.Text)
		}
		if err != nil {
			t.Logf("%q returned error: %v", command, err)
		}
	}

	teamMemberCount := func(t *testing.T) int64 {
		t.Helper()
		count, err := th.App.Srv().Store().Team().GetTotalMemberCount(th.BasicTeam.Id, nil)
		require.NoError(t, err)
		return count
	}

	channelPosts := func(t *testing.T, channelID string) []*model.Post {
		t.Helper()
		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: channelID, Page: 0, PerPage: 200})
		require.Nil(t, appErr)
		list := make([]*model.Post, 0, len(posts.Posts))
		for _, post := range posts.Posts {
			list = append(list, post)
		}
		return list
	}

	newChannel := func(t *testing.T) *model.Channel {
		t.Helper()
		channel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser, channel)
		return channel
	}

	t.Run("regular member cannot create accounts via test users", func(t *testing.T) {
		before := teamMemberCount(t)

		runCommand(t, th.Client, th.BasicChannel.Id, "/test users range=2")

		require.Equal(t, before, teamMemberCount(t), "no accounts should be added to the team")
	})

	t.Run("regular member cannot create accounts via test setup", func(t *testing.T) {
		before := teamMemberCount(t)

		runCommand(t, th.Client, th.BasicChannel.Id, "/test setup 1 1 1")

		require.Equal(t, before, teamMemberCount(t), "no accounts should be added to the team")
	})

	t.Run("regular member without create_private_channel cannot create private channels via test channels", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)
		t.Cleanup(func() {
			th.AddPermissionToRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)
		})

		_, resp, err := th.Client.CreateChannel(context.Background(), &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        GenerateTestChannelName(),
			DisplayName: "private",
			Type:        model.ChannelTypePrivate,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		before, _, err := th.SystemAdminClient.GetPrivateChannelsForTeam(context.Background(), th.BasicTeam.Id, 0, 200, "")
		require.NoError(t, err)

		runCommand(t, th.Client, th.BasicChannel.Id, "/test channels range=2 type=p")

		after, _, err := th.SystemAdminClient.GetPrivateChannelsForTeam(context.Background(), th.BasicTeam.Id, 0, 200, "")
		require.NoError(t, err)
		require.Len(t, after, len(before), "no private channels should be created")
	})

	t.Run("regular member cannot set the post create time via test posts", func(t *testing.T) {
		channel := newChannel(t)
		const createAt = int64(1000000000000)

		runCommand(t, th.Client, channel.Id, "/test posts range=2 time="+strconv.FormatInt(createAt, 10))

		for _, post := range channelPosts(t, channel.Id) {
			if post.UserId != th.BasicUser.Id {
				continue
			}
			require.Greater(t, post.CreateAt, createAt+1000, "post create time should not be set by the caller")
		}
	})

	t.Run("regular member cannot create system message posts via test json", func(t *testing.T) {
		channel := newChannel(t)
		const marker = "test-json-system-post-marker"
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"message":"` + marker + `","type":"` + model.PostTypeAddToChannel + `"}`))
		}))
		t.Cleanup(server.Close)

		runCommand(t, th.Client, channel.Id, "/test json "+server.URL+"/post.json")

		for _, post := range channelPosts(t, channel.Id) {
			if post.Message == marker {
				require.False(t, model.IsSystemMessagePostType(post.Type), "post should not have system type %q", post.Type)
			}
		}
	})

	t.Run("regular member cannot load content from a loopback address via test url", func(t *testing.T) {
		channel := newChannel(t)
		const marker = "test-url-loopback-content-marker"
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(marker))
		}))
		t.Cleanup(server.Close)

		runCommand(t, th.Client, channel.Id, "/test url "+server.URL+"/content.md")

		for _, post := range channelPosts(t, channel.Id) {
			require.NotContains(t, post.Message, marker, "loopback content should not be posted")
		}
	})

	t.Run("system admin can still run test users", func(t *testing.T) {
		th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(t, th.SystemAdminUser, th.BasicChannel)
		before := teamMemberCount(t)

		resp, _, err := th.SystemAdminClient.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/test users range=1")
		require.NoError(t, err)
		require.Equal(t, "Added users", resp.Text)

		require.Equal(t, before+1, teamMemberCount(t))
	})
}

func TestLeaveCommands(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/logout")
	require.NoError(t, err)
}

func TestMeCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	client := th.Client
	team := th.BasicTeam
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser(t)
	th.LinkUserToTeam(t, user3, team)

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
	mainHelper.Parallel(t)
	testJoinCommands(t, "open")
}

func TestSearchCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/search")
	require.NoError(t, err)
}

func TestSettingsCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/settings")
	require.NoError(t, err)
}

func TestShortcutsCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	_, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/shortcuts")
	require.NoError(t, err)
}

func TestShrugCommand(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
