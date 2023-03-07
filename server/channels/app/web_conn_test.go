// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/i18n"
)

func TestWebConnShouldSendEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	session, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TeamUserRoleId,
		},
	}})
	require.Nil(t, err)

	basicUserWc := &platform.WebConn{
		Platform: th.Server.Platform(),
		Suite:    th.App,
		UserId:   th.BasicUser.Id,
		T:        i18n.T,
	}

	user1ConnID := model.NewId()
	basicUserWc.SetConnectionID(user1ConnID)
	basicUserWc.SetSession(session)
	basicUserWc.SetSessionToken(session.Token)
	basicUserWc.SetSessionExpiresAt(session.ExpiresAt)

	session2, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser2.Id, Roles: th.BasicUser2.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser2.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TeamAdminRoleId,
		},
	}})
	require.Nil(t, err)

	basicUser2Wc := &platform.WebConn{
		Platform: th.Server.Platform(),
		Suite:    th.App,
		UserId:   th.BasicUser2.Id,
		T:        i18n.T,
	}

	user2ConnID := model.NewId()
	basicUser2Wc.SetConnectionID(user2ConnID)
	basicUser2Wc.SetSession(session2)
	basicUser2Wc.SetSessionToken(session2.Token)
	basicUser2Wc.SetSessionExpiresAt(session2.ExpiresAt)

	session3, err := th.App.CreateSession(&model.Session{UserId: th.SystemAdminUser.Id, Roles: th.SystemAdminUser.GetRawRoles()})
	require.Nil(t, err)

	adminUserWc := &platform.WebConn{
		Platform: th.Server.Platform(),
		Suite:    th.App,
		UserId:   th.SystemAdminUser.Id,
		T:        i18n.T,
	}

	adminConnID := model.NewId()
	adminUserWc.SetConnectionID(adminConnID)
	adminUserWc.SetSession(session3)
	adminUserWc.SetSessionToken(session3.Token)
	adminUserWc.SetSessionExpiresAt(session3.ExpiresAt)

	session4, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TeamUserRoleId,
		},
	}})
	require.Nil(t, err)

	basicUserWc2 := &platform.WebConn{
		Platform: th.Server.Platform(),
		Suite:    th.App,
		UserId:   th.BasicUser.Id,
		T:        i18n.T,
	}

	user1Conn2ID := model.NewId()
	basicUserWc2.SetConnectionID(user1Conn2ID)
	basicUserWc2.SetSession(session4)
	basicUserWc2.SetSessionToken(session4.Token)
	basicUserWc2.SetSessionExpiresAt(session4.ExpiresAt)

	// By default, only BasicUser and BasicUser2 get added to the BasicTeam.
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)

	// Create another channel with just BasicUser (implicitly) and SystemAdminUser to test channel broadcast
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(th.SystemAdminUser, channel2)

	cases := []struct {
		Description        string
		Broadcast          *model.WebsocketBroadcast
		User1Expected      bool
		User2Expected      bool
		AdminExpected      bool
		User1Conn2Expected bool
	}{
		{"should send to all", &model.WebsocketBroadcast{}, true, true, true, true},
		{"should only send to basic user", &model.WebsocketBroadcast{UserId: th.BasicUser.Id}, true, false, false, true},
		{"should only send to basic user conn 1", &model.WebsocketBroadcast{ConnectionId: user1ConnID}, true, false, false, false},
		{"should only send to basic user conn 2", &model.WebsocketBroadcast{ConnectionId: user1Conn2ID}, false, false, false, true},
		{"should omit basic user 2", &model.WebsocketBroadcast{OmitUsers: map[string]bool{th.BasicUser2.Id: true}}, true, false, true, true},
		{"should only send to admin", &model.WebsocketBroadcast{ContainsSensitiveData: true}, false, false, true, false},
		{"should only send to non-admins", &model.WebsocketBroadcast{ContainsSanitizedData: true}, true, true, false, true},
		{"should send to nobody", &model.WebsocketBroadcast{ContainsSensitiveData: true, ContainsSanitizedData: true}, false, false, false, false},
		{"should omit basic user 2 by connection id", &model.WebsocketBroadcast{OmitConnectionId: user2ConnID}, true, false, true, true},
		{"should omit basic user 2 by connection id while user is set", &model.WebsocketBroadcast{UserId: th.BasicUser2.Id, OmitConnectionId: user2ConnID}, false, false, false, false},
		// needs more cases to get full coverage
	}

	event := model.NewWebSocketEvent("some_event", "", "", "", nil, "")
	for _, c := range cases {
		t.Run(c.Description, func(t *testing.T) {
			event = event.SetBroadcast(c.Broadcast)
			if c.User1Expected {
				assert.True(t, basicUserWc.ShouldSendEvent(event), "expected user 1")
			} else {
				assert.False(t, basicUserWc.ShouldSendEvent(event), "did not expect user 1")
			}
			if c.User2Expected {
				assert.True(t, basicUser2Wc.ShouldSendEvent(event), "expected user 2")
			} else {
				assert.False(t, basicUser2Wc.ShouldSendEvent(event), "did not expect user 2")
			}
			if c.AdminExpected {
				assert.True(t, adminUserWc.ShouldSendEvent(event), "expected admin")
			} else {
				assert.False(t, adminUserWc.ShouldSendEvent(event), "did not expect admin")
			}
			if c.User1Conn2Expected {
				assert.True(t, basicUserWc2.ShouldSendEvent(event), "expected user 1 conn 2")
			} else {
				assert.False(t, basicUserWc2.ShouldSendEvent(event), "did not expect user 1 conn 2")
			}
		})
	}

	t.Run("should send to basic user in basic channel", func(t *testing.T) {
		event = event.SetBroadcast(&model.WebsocketBroadcast{ChannelId: th.BasicChannel.Id})

		assert.True(t, basicUserWc.ShouldSendEvent(event), "expected user 1")
		assert.False(t, basicUser2Wc.ShouldSendEvent(event), "did not expect user 2")
		assert.False(t, adminUserWc.ShouldSendEvent(event), "did not expect admin")
	})

	t.Run("should send to basic user and admin in channel2", func(t *testing.T) {
		event = event.SetBroadcast(&model.WebsocketBroadcast{ChannelId: channel2.Id})

		assert.True(t, basicUserWc.ShouldSendEvent(event), "expected user 1")
		assert.False(t, basicUser2Wc.ShouldSendEvent(event), "did not expect user 2")
		assert.True(t, adminUserWc.ShouldSendEvent(event), "expected admin")
	})

	t.Run("channel member cache invalidated after user added to channel", func(t *testing.T) {
		th.AddUserToChannel(th.BasicUser2, channel2)
		basicUser2Wc.InvalidateCache()

		event = event.SetBroadcast(&model.WebsocketBroadcast{ChannelId: channel2.Id})
		assert.True(t, basicUserWc.ShouldSendEvent(event), "expected user 1")
		assert.True(t, basicUser2Wc.ShouldSendEvent(event), "expected user 2")
		assert.True(t, adminUserWc.ShouldSendEvent(event), "expected admin")
	})

	event2 := model.NewWebSocketEvent(model.WebsocketEventUpdateTeam, th.BasicTeam.Id, "", "", nil, "")
	assert.True(t, basicUserWc.ShouldSendEvent(event2))
	assert.True(t, basicUser2Wc.ShouldSendEvent(event2))

	event3 := model.NewWebSocketEvent(model.WebsocketEventUpdateTeam, "wrongId", "", "", nil, "")
	assert.False(t, basicUserWc.ShouldSendEvent(event3))

}
