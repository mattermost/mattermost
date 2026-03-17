// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package testhelper

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSetupPopulatesAllFields verifies that Setup() returns a TestHelper with every
// field populated — containers running, admin and user authenticated, team and channel created.
func TestSetupPopulatesAllFields(t *testing.T) {
	th := Setup(t)

	assert.NotEmpty(t, th.ServerURL, "ServerURL should be set")
	assert.NotNil(t, th.AdminClient, "AdminClient should be set")
	assert.NotNil(t, th.AdminUser, "AdminUser should be set")
	assert.NotNil(t, th.Client, "Client should be set")
	assert.NotNil(t, th.User, "User should be set")
	assert.NotNil(t, th.Team, "Team should be set")
	assert.NotNil(t, th.Channel, "Channel should be set")
}

// TestAdminHasSystemAdminRole verifies the admin user created by the testhelper
// actually has system_admin privileges.
func TestAdminHasSystemAdminRole(t *testing.T) {
	th := Setup(t)

	assert.Contains(t, th.AdminUser.Roles, "system_admin",
		"admin user should have system_admin role")
}

// TestDatabaseResetIsolation verifies that each call to Setup() starts with a clean
// database. It creates a post in one setup, then calls Setup() again and verifies the
// post no longer exists.
func TestDatabaseResetIsolation(t *testing.T) {
	th1 := Setup(t)

	ctx := context.Background()

	// Create a post in the first setup's channel.
	post, _, err := th1.AdminClient.CreatePost(ctx, &model.Post{
		ChannelId: th1.Channel.Id,
		Message:   "should not survive reset",
	})
	require.NoError(t, err)

	// Setup again — this resets the database.
	th2 := Setup(t)

	// The old post should not exist. The channel it belonged to was wiped.
	_, resp, err := th2.AdminClient.GetPost(ctx, post.Id, "")
	require.Error(t, err, "post from previous setup should not exist after DB reset")
	assert.Equal(t, 404, resp.StatusCode)
}

// TestPluginDeployed verifies that Setup() deploys the plugin and it reaches Running state.
func TestPluginDeployed(t *testing.T) {
	th := Setup(t)

	ctx := context.Background()
	statuses, _, err := th.AdminClient.GetPluginStatuses(ctx)
	require.NoError(t, err)

	found := false
	for _, s := range statuses {
		if s.PluginId == PluginID() && s.State == model.PluginStateRunning {
			found = true
			break
		}
	}
	require.True(t, found, "plugin %s should be running after Setup()", PluginID())
}

// TestCreateUser verifies that CreateUser() creates a real user on the server
// that is a member of the test team.
func TestCreateUser(t *testing.T) {
	th := Setup(t)

	ctx := context.Background()
	user := th.CreateUser()

	// Verify the user exists on the server.
	fetched, _, err := th.AdminClient.GetUser(ctx, user.Id, "")
	require.NoError(t, err)
	assert.Equal(t, user.Username, fetched.Username)

	// Verify the user is a member of the test team.
	member, _, err := th.AdminClient.GetTeamMember(ctx, th.Team.Id, user.Id, "")
	require.NoError(t, err)
	assert.Equal(t, th.Team.Id, member.TeamId)
}

// TestCreateChannel verifies that CreateChannel() creates a real channel in the test team.
func TestCreateChannel(t *testing.T) {
	th := Setup(t)

	ctx := context.Background()

	open := th.CreateChannel(model.ChannelTypeOpen)
	assert.Equal(t, model.ChannelTypeOpen, open.Type)
	assert.Equal(t, th.Team.Id, open.TeamId)

	private := th.CreateChannel(model.ChannelTypePrivate)
	assert.Equal(t, model.ChannelTypePrivate, private.Type)
	assert.Equal(t, th.Team.Id, private.TeamId)

	// Verify channels exist on the server.
	fetched, _, err := th.AdminClient.GetChannel(ctx, open.Id)
	require.NoError(t, err)
	assert.Equal(t, open.Name, fetched.Name)
}

// TestPostAs verifies that PostAs() creates a post as the given user and the post
// is visible in the channel.
func TestPostAs(t *testing.T) {
	th := Setup(t)

	ctx := context.Background()
	post := th.PostAs(th.User, th.Channel.Id, "hello from integration test")

	assert.Equal(t, th.User.Id, post.UserId)
	assert.Equal(t, th.Channel.Id, post.ChannelId)
	assert.Equal(t, "hello from integration test", post.Message)

	// Verify the post is readable from the server.
	fetched, _, err := th.AdminClient.GetPost(ctx, post.Id, "")
	require.NoError(t, err)
	assert.Equal(t, post.Message, fetched.Message)
}
