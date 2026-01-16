// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Team API Handlers
// =============================================================================

// CreateTeam creates a new team.
func (s *APIServer) CreateTeam(ctx context.Context, req *pb.CreateTeamRequest) (*pb.CreateTeamResponse, error) {
	team, appErr := s.impl.CreateTeam(teamFromProto(req.GetTeam()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateTeamResponse{Team: teamToProto(team)}, nil
}

// DeleteTeam deletes a team.
func (s *APIServer) DeleteTeam(ctx context.Context, req *pb.DeleteTeamRequest) (*pb.DeleteTeamResponse, error) {
	appErr := s.impl.DeleteTeam(req.GetTeamId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteTeamResponse{}, nil
}

// GetTeams returns all teams.
func (s *APIServer) GetTeams(ctx context.Context, req *pb.GetTeamsRequest) (*pb.GetTeamsResponse, error) {
	teams, appErr := s.impl.GetTeams()
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamsResponse{Teams: teamsToProto(teams)}, nil
}

// GetTeam returns a team by ID.
func (s *APIServer) GetTeam(ctx context.Context, req *pb.GetTeamRequest) (*pb.GetTeamResponse, error) {
	team, appErr := s.impl.GetTeam(req.GetTeamId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamResponse{Team: teamToProto(team)}, nil
}

// GetTeamByName returns a team by name.
func (s *APIServer) GetTeamByName(ctx context.Context, req *pb.GetTeamByNameRequest) (*pb.GetTeamByNameResponse, error) {
	team, appErr := s.impl.GetTeamByName(req.GetName())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamByNameResponse{Team: teamToProto(team)}, nil
}

// GetTeamsUnreadForUser returns unread counts for teams for a user.
func (s *APIServer) GetTeamsUnreadForUser(ctx context.Context, req *pb.GetTeamsUnreadForUserRequest) (*pb.GetTeamsUnreadForUserResponse, error) {
	unreads, appErr := s.impl.GetTeamsUnreadForUser(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamsUnreadForUserResponse{TeamUnreads: teamUnreadsToProto(unreads)}, nil
}

// UpdateTeam updates a team.
func (s *APIServer) UpdateTeam(ctx context.Context, req *pb.UpdateTeamRequest) (*pb.UpdateTeamResponse, error) {
	team, appErr := s.impl.UpdateTeam(teamFromProto(req.GetTeam()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateTeamResponse{Team: teamToProto(team)}, nil
}

// SearchTeams searches for teams.
func (s *APIServer) SearchTeams(ctx context.Context, req *pb.SearchTeamsRequest) (*pb.SearchTeamsResponse, error) {
	teams, appErr := s.impl.SearchTeams(req.GetTerm())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SearchTeamsResponse{Teams: teamsToProto(teams)}, nil
}

// GetTeamsForUser returns teams for a user.
func (s *APIServer) GetTeamsForUser(ctx context.Context, req *pb.GetTeamsForUserRequest) (*pb.GetTeamsForUserResponse, error) {
	teams, appErr := s.impl.GetTeamsForUser(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamsForUserResponse{Teams: teamsToProto(teams)}, nil
}

// CreateTeamMember adds a user to a team.
func (s *APIServer) CreateTeamMember(ctx context.Context, req *pb.CreateTeamMemberRequest) (*pb.CreateTeamMemberResponse, error) {
	member, appErr := s.impl.CreateTeamMember(req.GetTeamId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateTeamMemberResponse{TeamMember: teamMemberToProto(member)}, nil
}

// CreateTeamMembers adds multiple users to a team.
func (s *APIServer) CreateTeamMembers(ctx context.Context, req *pb.CreateTeamMembersRequest) (*pb.CreateTeamMembersResponse, error) {
	members, appErr := s.impl.CreateTeamMembers(req.GetTeamId(), req.GetUserIds(), req.GetRequestorId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateTeamMembersResponse{TeamMembers: teamMembersToProto(members)}, nil
}

// CreateTeamMembersGracefully adds multiple users to a team, returning individual errors.
func (s *APIServer) CreateTeamMembersGracefully(ctx context.Context, req *pb.CreateTeamMembersGracefullyRequest) (*pb.CreateTeamMembersGracefullyResponse, error) {
	members, appErr := s.impl.CreateTeamMembersGracefully(req.GetTeamId(), req.GetUserIds(), req.GetRequestorId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateTeamMembersGracefullyResponse{TeamMembers: teamMembersWithErrorToProto(members)}, nil
}

// DeleteTeamMember removes a user from a team.
func (s *APIServer) DeleteTeamMember(ctx context.Context, req *pb.DeleteTeamMemberRequest) (*pb.DeleteTeamMemberResponse, error) {
	appErr := s.impl.DeleteTeamMember(req.GetTeamId(), req.GetUserId(), req.GetRequestorId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteTeamMemberResponse{}, nil
}

// GetTeamMembers returns members of a team.
func (s *APIServer) GetTeamMembers(ctx context.Context, req *pb.GetTeamMembersRequest) (*pb.GetTeamMembersResponse, error) {
	members, appErr := s.impl.GetTeamMembers(req.GetTeamId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamMembersResponse{TeamMembers: teamMembersToProto(members)}, nil
}

// GetTeamMember returns a team member.
func (s *APIServer) GetTeamMember(ctx context.Context, req *pb.GetTeamMemberRequest) (*pb.GetTeamMemberResponse, error) {
	member, appErr := s.impl.GetTeamMember(req.GetTeamId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamMemberResponse{TeamMember: teamMemberToProto(member)}, nil
}

// GetTeamMembersForUser returns team memberships for a user.
func (s *APIServer) GetTeamMembersForUser(ctx context.Context, req *pb.GetTeamMembersForUserRequest) (*pb.GetTeamMembersForUserResponse, error) {
	members, appErr := s.impl.GetTeamMembersForUser(req.GetUserId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamMembersForUserResponse{TeamMembers: teamMembersToProto(members)}, nil
}

// UpdateTeamMemberRoles updates a team member's roles.
func (s *APIServer) UpdateTeamMemberRoles(ctx context.Context, req *pb.UpdateTeamMemberRolesRequest) (*pb.UpdateTeamMemberRolesResponse, error) {
	member, appErr := s.impl.UpdateTeamMemberRoles(req.GetTeamId(), req.GetUserId(), req.GetNewRoles())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateTeamMemberRolesResponse{TeamMember: teamMemberToProto(member)}, nil
}

// GetTeamIcon returns a team's icon.
func (s *APIServer) GetTeamIcon(ctx context.Context, req *pb.GetTeamIconRequest) (*pb.GetTeamIconResponse, error) {
	icon, appErr := s.impl.GetTeamIcon(req.GetTeamId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamIconResponse{Icon: icon}, nil
}

// SetTeamIcon sets a team's icon.
func (s *APIServer) SetTeamIcon(ctx context.Context, req *pb.SetTeamIconRequest) (*pb.SetTeamIconResponse, error) {
	appErr := s.impl.SetTeamIcon(req.GetTeamId(), req.GetData())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SetTeamIconResponse{}, nil
}

// RemoveTeamIcon removes a team's icon.
func (s *APIServer) RemoveTeamIcon(ctx context.Context, req *pb.RemoveTeamIconRequest) (*pb.RemoveTeamIconResponse, error) {
	appErr := s.impl.RemoveTeamIcon(req.GetTeamId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.RemoveTeamIconResponse{}, nil
}

// GetTeamStats returns team statistics.
func (s *APIServer) GetTeamStats(ctx context.Context, req *pb.GetTeamStatsRequest) (*pb.GetTeamStatsResponse, error) {
	stats, appErr := s.impl.GetTeamStats(req.GetTeamId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetTeamStatsResponse{TeamStats: teamStatsToProto(stats)}, nil
}
