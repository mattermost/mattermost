package app

import (
	"testing"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestGroupMsgUsernames(t *testing.T) {
	assert := assert.New(t)

	users, parsedMessage := groupMsgUsernames("")
	assert.Len(users, 0)
	assert.Equal(parsedMessage, "", "error parsing empty message")

	users, parsedMessage = groupMsgUsernames("test")
	assert.Len(users, 1)
	assert.Equal(parsedMessage, "", "error parsing simple user")

	users, parsedMessage = groupMsgUsernames("test1, test2, test3 , test4")
	assert.Len(users, 4)
	assert.Equal(parsedMessage, "", "error parsing various users")

	users, parsedMessage = groupMsgUsernames("test1, test2 message with spaces")
	assert.Len(users, 2)
	assert.Equal(parsedMessage, "message with spaces", "error parsing message")

	users, parsedMessage = groupMsgUsernames("test1, test2 message with, comma")
	assert.Len(users, 2)
	assert.Equal(parsedMessage, "message with, comma", "error parsing messages with comma")

	users, parsedMessage = groupMsgUsernames("test1,,,test2")
	assert.Len(users, 2)
	assert.Equal(parsedMessage, "", "error parsing multiple commas in username")

	users, parsedMessage = groupMsgUsernames("    test1,       test2     other message         ")
	assert.Len(users, 2)
	assert.Equal(parsedMessage, "other message", "error parsing strange usage of spaces")

	users, _ = groupMsgUsernames("    test1,       test2,,123,@321,+123")
	assert.Len(users, 5)
	assert.Equal(users[0], "test1")
	assert.Equal(users[1], "test2")
	assert.Equal(users[2], "123")
	assert.Equal(users[3], "321")
	assert.Equal(users[4], "+123")
	assert.Equal(parsedMessage, "other message", "error parsing strange usage of spaces")
}

func TestGroupMsgProvider(t *testing.T) {
	th := Setup(t).InitBasic()
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
