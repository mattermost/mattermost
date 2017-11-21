package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
)

func TestHeaderProviderDoCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	hp := HeaderProvider{}
	args := &model.CommandArgs{
		T:         func(s string, args ...interface{}) string { return s },
		ChannelId: th.BasicChannel.Id,
		Session:   model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	for msg, expected := range map[string]string{
		"":      "api.command_channel_header.message.app_error",
		"hello": "",
	} {
		actual := hp.DoCommand(th.App, args, msg).Text
		assert.Equal(t, expected, actual)
	}
}
