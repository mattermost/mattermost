// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// User Handler Tests
// =============================================================================

func TestGetUser(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedUser := &model.User{
		Id:       "user123",
		Username: "testuser",
		Email:    "test@example.com",
	}
	h.mockAPI.On("GetUser", "user123").Return(expectedUser, nil)

	resp, err := h.client.GetUser(context.Background(), &pb.GetUserRequest{UserId: "user123"})
	require.NoError(t, err)
	assert.Equal(t, "user123", resp.GetUser().GetId())
	assert.Equal(t, "testuser", resp.GetUser().GetUsername())
	assert.Equal(t, "test@example.com", resp.GetUser().GetEmail())

	h.mockAPI.AssertExpectations(t)
}

func TestGetUser_NotFound(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	appErr := model.NewAppError("GetUser", "user.not_found", nil, "", http.StatusNotFound)
	h.mockAPI.On("GetUser", "nonexistent").Return(nil, appErr)

	_, err := h.client.GetUser(context.Background(), &pb.GetUserRequest{UserId: "nonexistent"})
	require.Error(t, err)

	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.NotFound, st.Code())

	h.mockAPI.AssertExpectations(t)
}

func TestGetUserByEmail(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedUser := &model.User{
		Id:       "user123",
		Username: "testuser",
		Email:    "test@example.com",
	}
	h.mockAPI.On("GetUserByEmail", "test@example.com").Return(expectedUser, nil)

	resp, err := h.client.GetUserByEmail(context.Background(), &pb.GetUserByEmailRequest{Email: "test@example.com"})
	require.NoError(t, err)
	assert.Equal(t, "user123", resp.GetUser().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestGetUserByUsername(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedUser := &model.User{
		Id:       "user123",
		Username: "testuser",
	}
	h.mockAPI.On("GetUserByUsername", "testuser").Return(expectedUser, nil)

	resp, err := h.client.GetUserByUsername(context.Background(), &pb.GetUserByUsernameRequest{Name: "testuser"})
	require.NoError(t, err)
	assert.Equal(t, "user123", resp.GetUser().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestCreateUser(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	createdUser := &model.User{
		Id:       "newuser123",
		Username: "newuser",
		Email:    "new@example.com",
	}
	h.mockAPI.On("CreateUser", mock.AnythingOfType("*model.User")).Return(createdUser, nil)

	resp, err := h.client.CreateUser(context.Background(), &pb.CreateUserRequest{
		User: &pb.User{
			Username: "newuser",
			Email:    "new@example.com",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "newuser123", resp.GetUser().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestDeleteUser(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeleteUser", "user123").Return(nil)

	_, err := h.client.DeleteUser(context.Background(), &pb.DeleteUserRequest{UserId: "user123"})
	require.NoError(t, err)

	h.mockAPI.AssertExpectations(t)
}

func TestHasPermissionTo(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("HasPermissionTo", "user123", mock.AnythingOfType("*model.Permission")).Return(true)

	resp, err := h.client.HasPermissionTo(context.Background(), &pb.HasPermissionToRequest{
		UserId:       "user123",
		PermissionId: "manage_system",
	})
	require.NoError(t, err)
	assert.True(t, resp.GetHasPermission())

	h.mockAPI.AssertExpectations(t)
}

func TestHasPermissionToTeam(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("HasPermissionToTeam", "user123", "team456", mock.AnythingOfType("*model.Permission")).Return(true)

	resp, err := h.client.HasPermissionToTeam(context.Background(), &pb.HasPermissionToTeamRequest{
		UserId:       "user123",
		TeamId:       "team456",
		PermissionId: "manage_team",
	})
	require.NoError(t, err)
	assert.True(t, resp.GetHasPermission())

	h.mockAPI.AssertExpectations(t)
}

func TestHasPermissionToChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("HasPermissionToChannel", "user123", "channel789", mock.AnythingOfType("*model.Permission")).Return(false)

	resp, err := h.client.HasPermissionToChannel(context.Background(), &pb.HasPermissionToChannelRequest{
		UserId:       "user123",
		ChannelId:    "channel789",
		PermissionId: "manage_channel",
	})
	require.NoError(t, err)
	assert.False(t, resp.GetHasPermission())

	h.mockAPI.AssertExpectations(t)
}

// =============================================================================
// Team Handler Tests
// =============================================================================

func TestGetTeam(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedTeam := &model.Team{
		Id:          "team123",
		Name:        "testteam",
		DisplayName: "Test Team",
		Type:        model.TeamOpen,
	}
	h.mockAPI.On("GetTeam", "team123").Return(expectedTeam, nil)

	resp, err := h.client.GetTeam(context.Background(), &pb.GetTeamRequest{TeamId: "team123"})
	require.NoError(t, err)
	assert.Equal(t, "team123", resp.GetTeam().GetId())
	assert.Equal(t, "testteam", resp.GetTeam().GetName())
	assert.Equal(t, "Test Team", resp.GetTeam().GetDisplayName())

	h.mockAPI.AssertExpectations(t)
}

func TestGetTeamByName(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedTeam := &model.Team{
		Id:   "team123",
		Name: "testteam",
	}
	h.mockAPI.On("GetTeamByName", "testteam").Return(expectedTeam, nil)

	resp, err := h.client.GetTeamByName(context.Background(), &pb.GetTeamByNameRequest{Name: "testteam"})
	require.NoError(t, err)
	assert.Equal(t, "team123", resp.GetTeam().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestCreateTeam(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	createdTeam := &model.Team{
		Id:          "newteam123",
		Name:        "newteam",
		DisplayName: "New Team",
	}
	h.mockAPI.On("CreateTeam", mock.AnythingOfType("*model.Team")).Return(createdTeam, nil)

	resp, err := h.client.CreateTeam(context.Background(), &pb.CreateTeamRequest{
		Team: &pb.Team{
			Name:        "newteam",
			DisplayName: "New Team",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "newteam123", resp.GetTeam().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestDeleteTeam(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeleteTeam", "team123").Return(nil)

	_, err := h.client.DeleteTeam(context.Background(), &pb.DeleteTeamRequest{TeamId: "team123"})
	require.NoError(t, err)

	h.mockAPI.AssertExpectations(t)
}

func TestGetTeams(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	teams := []*model.Team{
		{Id: "team1", Name: "team1"},
		{Id: "team2", Name: "team2"},
	}
	h.mockAPI.On("GetTeams").Return(teams, nil)

	resp, err := h.client.GetTeams(context.Background(), &pb.GetTeamsRequest{})
	require.NoError(t, err)
	assert.Len(t, resp.GetTeams(), 2)

	h.mockAPI.AssertExpectations(t)
}

func TestCreateTeamMember(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	member := &model.TeamMember{
		TeamId: "team123",
		UserId: "user456",
	}
	h.mockAPI.On("CreateTeamMember", "team123", "user456").Return(member, nil)

	resp, err := h.client.CreateTeamMember(context.Background(), &pb.CreateTeamMemberRequest{
		TeamId: "team123",
		UserId: "user456",
	})
	require.NoError(t, err)
	assert.Equal(t, "team123", resp.GetTeamMember().GetTeamId())
	assert.Equal(t, "user456", resp.GetTeamMember().GetUserId())

	h.mockAPI.AssertExpectations(t)
}

// =============================================================================
// Channel Handler Tests
// =============================================================================

func TestGetChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedChannel := &model.Channel{
		Id:          "channel123",
		Name:        "testchannel",
		DisplayName: "Test Channel",
		Type:        model.ChannelTypeOpen,
	}
	h.mockAPI.On("GetChannel", "channel123").Return(expectedChannel, nil)

	resp, err := h.client.GetChannel(context.Background(), &pb.GetChannelRequest{ChannelId: "channel123"})
	require.NoError(t, err)
	assert.Equal(t, "channel123", resp.GetChannel().GetId())
	assert.Equal(t, "testchannel", resp.GetChannel().GetName())
	assert.Equal(t, "Test Channel", resp.GetChannel().GetDisplayName())

	h.mockAPI.AssertExpectations(t)
}

func TestGetChannelByName(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	expectedChannel := &model.Channel{
		Id:   "channel123",
		Name: "testchannel",
	}
	h.mockAPI.On("GetChannelByName", "team123", "testchannel", false).Return(expectedChannel, nil)

	resp, err := h.client.GetChannelByName(context.Background(), &pb.GetChannelByNameRequest{
		TeamId: "team123",
		Name:   "testchannel",
	})
	require.NoError(t, err)
	assert.Equal(t, "channel123", resp.GetChannel().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestCreateChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	createdChannel := &model.Channel{
		Id:          "newchannel123",
		Name:        "newchannel",
		DisplayName: "New Channel",
	}
	h.mockAPI.On("CreateChannel", mock.AnythingOfType("*model.Channel")).Return(createdChannel, nil)

	resp, err := h.client.CreateChannel(context.Background(), &pb.CreateChannelRequest{
		Channel: &pb.Channel{
			Name:        "newchannel",
			DisplayName: "New Channel",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "newchannel123", resp.GetChannel().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestDeleteChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeleteChannel", "channel123").Return(nil)

	_, err := h.client.DeleteChannel(context.Background(), &pb.DeleteChannelRequest{ChannelId: "channel123"})
	require.NoError(t, err)

	h.mockAPI.AssertExpectations(t)
}

func TestGetDirectChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	directChannel := &model.Channel{
		Id:   "dm123",
		Type: model.ChannelTypeDirect,
	}
	h.mockAPI.On("GetDirectChannel", "user1", "user2").Return(directChannel, nil)

	resp, err := h.client.GetDirectChannel(context.Background(), &pb.GetDirectChannelRequest{
		UserId_1: "user1",
		UserId_2: "user2",
	})
	require.NoError(t, err)
	assert.Equal(t, "dm123", resp.GetChannel().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestGetGroupChannel(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	groupChannel := &model.Channel{
		Id:   "group123",
		Type: model.ChannelTypeGroup,
	}
	h.mockAPI.On("GetGroupChannel", []string{"user1", "user2", "user3"}).Return(groupChannel, nil)

	resp, err := h.client.GetGroupChannel(context.Background(), &pb.GetGroupChannelRequest{
		UserIds: []string{"user1", "user2", "user3"},
	})
	require.NoError(t, err)
	assert.Equal(t, "group123", resp.GetChannel().GetId())

	h.mockAPI.AssertExpectations(t)
}

func TestAddChannelMember(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	member := &model.ChannelMember{
		ChannelId: "channel123",
		UserId:    "user456",
	}
	h.mockAPI.On("AddChannelMember", "channel123", "user456").Return(member, nil)

	resp, err := h.client.AddChannelMember(context.Background(), &pb.AddChannelMemberRequest{
		ChannelId: "channel123",
		UserId:    "user456",
	})
	require.NoError(t, err)
	assert.Equal(t, "channel123", resp.GetChannelMember().GetChannelId())
	assert.Equal(t, "user456", resp.GetChannelMember().GetUserId())

	h.mockAPI.AssertExpectations(t)
}

func TestDeleteChannelMember(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	h.mockAPI.On("DeleteChannelMember", "channel123", "user456").Return(nil)

	_, err := h.client.DeleteChannelMember(context.Background(), &pb.DeleteChannelMemberRequest{
		ChannelId: "channel123",
		UserId:    "user456",
	})
	require.NoError(t, err)

	h.mockAPI.AssertExpectations(t)
}

func TestSearchChannels(t *testing.T) {
	h := newTestHarness(t)
	defer h.close()

	channels := []*model.Channel{
		{Id: "channel1", Name: "test-one"},
		{Id: "channel2", Name: "test-two"},
	}
	h.mockAPI.On("SearchChannels", "team123", "test").Return(channels, nil)

	resp, err := h.client.SearchChannels(context.Background(), &pb.SearchChannelsRequest{
		TeamId: "team123",
		Term:   "test",
	})
	require.NoError(t, err)
	assert.Len(t, resp.GetChannels(), 2)

	h.mockAPI.AssertExpectations(t)
}
