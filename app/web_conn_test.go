// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func TestWebConnShouldSendEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	session, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TEAM_USER_ROLE_ID,
		},
	}})
	require.Nil(t, err)

	basicUserWc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser.Id,
		T:      utils.T,
	}

	basicUserWc.SetSession(session)
	basicUserWc.SetSessionToken(session.Token)
	basicUserWc.SetSessionExpiresAt(session.ExpiresAt)

	session2, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser2.Id, Roles: th.BasicUser2.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser2.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TEAM_ADMIN_ROLE_ID,
		},
	}})
	require.Nil(t, err)

	basicUser2Wc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser2.Id,
		T:      utils.T,
	}

	basicUser2Wc.SetSession(session2)
	basicUser2Wc.SetSessionToken(session2.Token)
	basicUser2Wc.SetSessionExpiresAt(session2.ExpiresAt)

	session3, err := th.App.CreateSession(&model.Session{UserId: th.SystemAdminUser.Id, Roles: th.SystemAdminUser.GetRawRoles()})
	require.Nil(t, err)

	adminUserWc := &WebConn{
		App:    th.App,
		UserId: th.SystemAdminUser.Id,
		T:      utils.T,
	}

	adminUserWc.SetSession(session3)
	adminUserWc.SetSessionToken(session3.Token)
	adminUserWc.SetSessionExpiresAt(session3.ExpiresAt)

	cases := []struct {
		Description   string
		Broadcast     *model.WebsocketBroadcast
		User1Expected bool
		User2Expected bool
		AdminExpected bool
	}{
		{"should send to all", &model.WebsocketBroadcast{}, true, true, true},
		{"should only send to basic user", &model.WebsocketBroadcast{UserId: th.BasicUser.Id}, true, false, false},
		{"should omit basic user 2", &model.WebsocketBroadcast{OmitUsers: map[string]bool{th.BasicUser2.Id: true}}, true, false, true},
		{"should only send to admin", &model.WebsocketBroadcast{ContainsSensitiveData: true}, false, false, true},
		{"should only send to non-admins", &model.WebsocketBroadcast{ContainsSanitizedData: true}, true, true, false},
		{"should send to nobody", &model.WebsocketBroadcast{ContainsSensitiveData: true, ContainsSanitizedData: true}, false, false, false},
		// needs more cases to get full coverage
	}

	event := model.NewWebSocketEvent("some_event", "", "", "", nil)
	for _, c := range cases {
		event = event.SetBroadcast(c.Broadcast)
		assert.Equal(t, c.User1Expected, basicUserWc.ShouldSendEvent(event), c.Description)
		assert.Equal(t, c.User2Expected, basicUser2Wc.ShouldSendEvent(event), c.Description)
		assert.Equal(t, c.AdminExpected, adminUserWc.ShouldSendEvent(event), c.Description)
	}

	event2 := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_UPDATE_TEAM, th.BasicTeam.Id, "", "", nil)
	assert.True(t, basicUserWc.ShouldSendEvent(event2))
	assert.True(t, basicUser2Wc.ShouldSendEvent(event2))

	event3 := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_UPDATE_TEAM, "wrongId", "", "", nil)
	assert.False(t, basicUserWc.ShouldSendEvent(event3))
}
