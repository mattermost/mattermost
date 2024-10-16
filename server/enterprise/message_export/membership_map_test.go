// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestMembershipMap(t *testing.T) {
	membershipMap := make(MembershipMap)

	channelId := model.NewId()

	user1 := &MembershipMapUser{
		email:    model.NewId() + "@mattermost.com",
		username: model.NewId(),
		userId:   model.NewId(),
	}
	user2 := &MembershipMapUser{
		email:    model.NewId() + "@mattermost.com",
		username: model.NewId(),
		userId:   model.NewId(),
	}

	assert.False(t, membershipMap.IsUserInChannel(channelId, user1.email))
	membershipMap.AddUserToChannel(channelId, *user1)
	assert.True(t, membershipMap.IsUserInChannel(channelId, user1.email))

	assert.False(t, membershipMap.IsUserInChannel(channelId, user2.email))
	membershipMap.AddUserToChannel(channelId, *user2)
	assert.True(t, membershipMap.IsUserInChannel(channelId, user2.email))

	// ensure that the correct user emails are returned
	emails := membershipMap.GetUserEmailsInChannel(channelId)
	assert.Len(t, emails, 2)
	assert.Contains(t, emails, user1.email)
	assert.Contains(t, emails, user2.email)

	// ensure that the correct user objects are returned
	users := membershipMap.GetUsersInChannel(channelId)
	assert.Len(t, users, 2)
	if users[0].userId == user1.userId {
		assert.Equal(t, user1.username, users[0].username)
		assert.Equal(t, user1.email, users[0].email)
		assert.Equal(t, user2.userId, users[1].userId)
		assert.Equal(t, user2.username, users[1].username)
		assert.Equal(t, user2.email, users[1].email)
	} else if users[0].userId == user2.userId {
		assert.Equal(t, user2.username, users[0].username)
		assert.Equal(t, user2.email, users[0].email)
		assert.Equal(t, user1.userId, users[1].userId)
		assert.Equal(t, user1.username, users[1].username)
		assert.Equal(t, user1.email, users[1].email)
	} else {
		assert.Fail(t, "First returned user is not recognized")
	}

	// remove user1 from the channel
	membershipMap.RemoveUserFromChannel(channelId, user1.email)
	assert.False(t, membershipMap.IsUserInChannel(channelId, user1.email))
	assert.True(t, membershipMap.IsUserInChannel(channelId, user2.email))

	// ensure that user2's email is returned
	emails = membershipMap.GetUserEmailsInChannel(channelId)
	assert.Len(t, emails, 1)
	assert.Contains(t, emails, user2.email)

	// ensure that only user2 is returned
	users = membershipMap.GetUsersInChannel(channelId)
	assert.Len(t, users, 1)
	assert.Equal(t, user2.userId, users[0].userId)
	assert.Equal(t, user2.username, users[0].username)
	assert.Equal(t, user2.email, users[0].email)
}
