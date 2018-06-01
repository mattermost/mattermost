// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestWebConnShouldSendEvent(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	session, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles()})
	require.Nil(t, err)

	basicUserWc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser.Id,
		T:      utils.T,
	}

	basicUserWc.SetSession(session)
	basicUserWc.SetSessionToken(session.Token)
	basicUserWc.SetSessionExpiresAt(session.ExpiresAt)

	session2, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser2.Id, Roles: th.BasicUser2.GetRawRoles()})
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

	event := &model.WebSocketEvent{Event: "some_event"}
	for _, c := range cases {
		event.Broadcast = c.Broadcast
		assert.Equal(t, c.User1Expected, basicUserWc.ShouldSendEvent(event), c.Description)
		assert.Equal(t, c.User2Expected, basicUser2Wc.ShouldSendEvent(event), c.Description)
		assert.Equal(t, c.AdminExpected, adminUserWc.ShouldSendEvent(event), c.Description)
	}
}
