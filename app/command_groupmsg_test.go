package app

import (
	"testing"

	"github.com/nicksnyder/go-i18n/i18n"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestGroupMsgUsernames(t *testing.T) {
	if users, parsedMessage := groupMsgUsernames(""); len(users) != 0 || parsedMessage != "" {
		t.Fatal("error parsing empty message")
	}
	if users, parsedMessage := groupMsgUsernames("test"); len(users) != 1 || parsedMessage != "" {
		t.Fatal("error parsing simple user")
	}
	if users, parsedMessage := groupMsgUsernames("test1, test2, test3 , test4"); len(users) != 4 || parsedMessage != "" {
		t.Fatal("error parsing various users")
	}

	if users, parsedMessage := groupMsgUsernames("test1, test2 message with spaces"); len(users) != 2 || parsedMessage != "message with spaces" {
		t.Fatal("error parsing message")
	}

	if users, parsedMessage := groupMsgUsernames("test1, test2 message with, comma"); len(users) != 2 || parsedMessage != "message with, comma" {
		t.Fatal("error parsing messages with comma")
	}

	if users, parsedMessage := groupMsgUsernames("test1,,,test2"); len(users) != 2 || parsedMessage != "" {
		t.Fatal("error parsing multiple commas in username ")
	}

	if users, parsedMessage := groupMsgUsernames("    test1,       test2     other message         "); len(users) != 2 || parsedMessage != "other message" {
		t.Fatal("error parsing strange usage of spaces")
	}

	if users, _ := groupMsgUsernames("    test1,       test2,,123,@321,+123"); len(users) != 5 || users[0] != "test1" || users[1] != "test2" || users[2] != "123" || users[3] != "321" || users[4] != "+123" {
		t.Fatal("error parsing different types of users")
	}
}

func TestGroupMsgProvider(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	user3 := th.CreateUser()
	targetUsers := "@" + th.BasicUser2.Username + ",@" + user3.Username + " "

	team := th.CreateTeam()
	th.LinkUserToTeam(th.BasicUser, team)
	cmd := &groupmsgProvider{}

	// Check without permission to create a GM channel.
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  team.Id,
		UserId:  th.BasicUser.Id,
		Session: model.Session{
			Roles: "",
		},
	}, targetUsers+"hello")

	channelName := model.GetGroupNameFromUserIds([]string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
	assert.Equal(t, "api.command_groupmsg.permission.app_error", resp.Text)
	assert.Equal(t, "", resp.GotoLocation)

	// Check with permission to create a GM channel.
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  team.Id,
		UserId:  th.BasicUser.Id,
		Session: model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
		},
	}, targetUsers+"hello")

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+team.Name+"/channels/"+channelName, resp.GotoLocation)

	// Check without permission to post to an existing GM channel.
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  team.Id,
		UserId:  th.BasicUser.Id,
		Session: model.Session{
			Roles: "",
		},
	}, targetUsers+"hello")

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+team.Name+"/channels/"+channelName, resp.GotoLocation)
}
