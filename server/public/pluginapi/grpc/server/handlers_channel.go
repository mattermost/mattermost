// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Channel API Handlers
// =============================================================================

// CreateChannel creates a new channel.
func (s *APIServer) CreateChannel(ctx context.Context, req *pb.CreateChannelRequest) (*pb.CreateChannelResponse, error) {
	channel, appErr := s.impl.CreateChannel(channelFromProto(req.GetChannel()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateChannelResponse{Channel: channelToProto(channel)}, nil
}

// DeleteChannel deletes a channel.
func (s *APIServer) DeleteChannel(ctx context.Context, req *pb.DeleteChannelRequest) (*pb.DeleteChannelResponse, error) {
	appErr := s.impl.DeleteChannel(req.GetChannelId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteChannelResponse{}, nil
}

// GetPublicChannelsForTeam returns public channels for a team.
func (s *APIServer) GetPublicChannelsForTeam(ctx context.Context, req *pb.GetPublicChannelsForTeamRequest) (*pb.GetPublicChannelsForTeamResponse, error) {
	channels, appErr := s.impl.GetPublicChannelsForTeam(req.GetTeamId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetPublicChannelsForTeamResponse{Channels: channelsToProto(channels)}, nil
}

// GetChannel returns a channel by ID.
func (s *APIServer) GetChannel(ctx context.Context, req *pb.GetChannelRequest) (*pb.GetChannelResponse, error) {
	channel, appErr := s.impl.GetChannel(req.GetChannelId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelResponse{Channel: channelToProto(channel)}, nil
}

// GetChannelByName returns a channel by name.
func (s *APIServer) GetChannelByName(ctx context.Context, req *pb.GetChannelByNameRequest) (*pb.GetChannelByNameResponse, error) {
	channel, appErr := s.impl.GetChannelByName(req.GetTeamId(), req.GetName(), req.GetIncludeDeleted())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelByNameResponse{Channel: channelToProto(channel)}, nil
}

// GetChannelByNameForTeamName returns a channel by channel name and team name.
func (s *APIServer) GetChannelByNameForTeamName(ctx context.Context, req *pb.GetChannelByNameForTeamNameRequest) (*pb.GetChannelByNameForTeamNameResponse, error) {
	channel, appErr := s.impl.GetChannelByNameForTeamName(req.GetTeamName(), req.GetChannelName(), req.GetIncludeDeleted())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelByNameForTeamNameResponse{Channel: channelToProto(channel)}, nil
}

// GetChannelsForTeamForUser returns channels for a user in a team.
func (s *APIServer) GetChannelsForTeamForUser(ctx context.Context, req *pb.GetChannelsForTeamForUserRequest) (*pb.GetChannelsForTeamForUserResponse, error) {
	channels, appErr := s.impl.GetChannelsForTeamForUser(req.GetTeamId(), req.GetUserId(), req.GetIncludeDeleted())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelsForTeamForUserResponse{Channels: channelsToProto(channels)}, nil
}

// GetChannelStats returns channel statistics.
func (s *APIServer) GetChannelStats(ctx context.Context, req *pb.GetChannelStatsRequest) (*pb.GetChannelStatsResponse, error) {
	stats, appErr := s.impl.GetChannelStats(req.GetChannelId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelStatsResponse{ChannelStats: channelStatsToProto(stats)}, nil
}

// GetDirectChannel returns or creates a direct channel between two users.
func (s *APIServer) GetDirectChannel(ctx context.Context, req *pb.GetDirectChannelRequest) (*pb.GetDirectChannelResponse, error) {
	channel, appErr := s.impl.GetDirectChannel(req.GetUserId_1(), req.GetUserId_2())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetDirectChannelResponse{Channel: channelToProto(channel)}, nil
}

// GetGroupChannel returns or creates a group channel for the given users.
func (s *APIServer) GetGroupChannel(ctx context.Context, req *pb.GetGroupChannelRequest) (*pb.GetGroupChannelResponse, error) {
	channel, appErr := s.impl.GetGroupChannel(req.GetUserIds())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetGroupChannelResponse{Channel: channelToProto(channel)}, nil
}

// UpdateChannel updates a channel.
func (s *APIServer) UpdateChannel(ctx context.Context, req *pb.UpdateChannelRequest) (*pb.UpdateChannelResponse, error) {
	channel, appErr := s.impl.UpdateChannel(channelFromProto(req.GetChannel()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateChannelResponse{Channel: channelToProto(channel)}, nil
}

// SearchChannels searches for channels.
func (s *APIServer) SearchChannels(ctx context.Context, req *pb.SearchChannelsRequest) (*pb.SearchChannelsResponse, error) {
	channels, appErr := s.impl.SearchChannels(req.GetTeamId(), req.GetTerm())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SearchChannelsResponse{Channels: channelsToProto(channels)}, nil
}

// AddChannelMember adds a user to a channel.
func (s *APIServer) AddChannelMember(ctx context.Context, req *pb.AddChannelMemberRequest) (*pb.AddChannelMemberResponse, error) {
	member, appErr := s.impl.AddChannelMember(req.GetChannelId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.AddChannelMemberResponse{ChannelMember: channelMemberToProto(member)}, nil
}

// AddUserToChannel adds a user to a channel, with optional impersonation.
func (s *APIServer) AddUserToChannel(ctx context.Context, req *pb.AddUserToChannelRequest) (*pb.AddUserToChannelResponse, error) {
	member, appErr := s.impl.AddUserToChannel(req.GetChannelId(), req.GetUserId(), req.GetAsUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.AddUserToChannelResponse{ChannelMember: channelMemberToProto(member)}, nil
}

// GetChannelMember returns a channel member.
func (s *APIServer) GetChannelMember(ctx context.Context, req *pb.GetChannelMemberRequest) (*pb.GetChannelMemberResponse, error) {
	member, appErr := s.impl.GetChannelMember(req.GetChannelId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelMemberResponse{ChannelMember: channelMemberToProto(member)}, nil
}

// GetChannelMembers returns members of a channel.
func (s *APIServer) GetChannelMembers(ctx context.Context, req *pb.GetChannelMembersRequest) (*pb.GetChannelMembersResponse, error) {
	members, appErr := s.impl.GetChannelMembers(req.GetChannelId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelMembersResponse{ChannelMembers: channelMembersToProto(members)}, nil
}

// GetChannelMembersByIds returns channel members by user IDs.
func (s *APIServer) GetChannelMembersByIds(ctx context.Context, req *pb.GetChannelMembersByIdsRequest) (*pb.GetChannelMembersByIdsResponse, error) {
	members, appErr := s.impl.GetChannelMembersByIds(req.GetChannelId(), req.GetUserIds())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	// GetChannelMembersByIds returns model.ChannelMembers, use channelMembersToProto
	return &pb.GetChannelMembersByIdsResponse{ChannelMembers: channelMembersToProto(members)}, nil
}

// GetChannelMembersForUser returns channel memberships for a user.
func (s *APIServer) GetChannelMembersForUser(ctx context.Context, req *pb.GetChannelMembersForUserRequest) (*pb.GetChannelMembersForUserResponse, error) {
	members, appErr := s.impl.GetChannelMembersForUser(req.GetTeamId(), req.GetUserId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	// GetChannelMembersForUser returns []*model.ChannelMember, use channelMemberPtrsToProto
	return &pb.GetChannelMembersForUserResponse{ChannelMembers: channelMemberPtrsToProto(members)}, nil
}

// UpdateChannelMemberRoles updates a channel member's roles.
func (s *APIServer) UpdateChannelMemberRoles(ctx context.Context, req *pb.UpdateChannelMemberRolesRequest) (*pb.UpdateChannelMemberRolesResponse, error) {
	member, appErr := s.impl.UpdateChannelMemberRoles(req.GetChannelId(), req.GetUserId(), req.GetNewRoles())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateChannelMemberRolesResponse{ChannelMember: channelMemberToProto(member)}, nil
}

// UpdateChannelMemberNotifications updates a channel member's notification settings.
func (s *APIServer) UpdateChannelMemberNotifications(ctx context.Context, req *pb.UpdateChannelMemberNotificationsRequest) (*pb.UpdateChannelMemberNotificationsResponse, error) {
	member, appErr := s.impl.UpdateChannelMemberNotifications(req.GetChannelId(), req.GetUserId(), req.GetNotifications())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateChannelMemberNotificationsResponse{ChannelMember: channelMemberToProto(member)}, nil
}

// PatchChannelMembersNotifications patches notification settings for multiple channel members.
func (s *APIServer) PatchChannelMembersNotifications(ctx context.Context, req *pb.PatchChannelMembersNotificationsRequest) (*pb.PatchChannelMembersNotificationsResponse, error) {
	identifiers := channelMemberIdentifiersFromProto(req.GetMembers())
	appErr := s.impl.PatchChannelMembersNotifications(identifiers, req.GetNotifyProps())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.PatchChannelMembersNotificationsResponse{}, nil
}

// DeleteChannelMember removes a user from a channel.
func (s *APIServer) DeleteChannelMember(ctx context.Context, req *pb.DeleteChannelMemberRequest) (*pb.DeleteChannelMemberResponse, error) {
	appErr := s.impl.DeleteChannelMember(req.GetChannelId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteChannelMemberResponse{}, nil
}

// =============================================================================
// Channel Sidebar API Handlers
// =============================================================================

// CreateChannelSidebarCategory creates a new sidebar category.
func (s *APIServer) CreateChannelSidebarCategory(ctx context.Context, req *pb.CreateChannelSidebarCategoryRequest) (*pb.CreateChannelSidebarCategoryResponse, error) {
	cat, appErr := s.impl.CreateChannelSidebarCategory(req.GetUserId(), req.GetTeamId(), sidebarCategoryWithChannelsFromProto(req.GetNewCategory()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateChannelSidebarCategoryResponse{Category: sidebarCategoryWithChannelsToProto(cat)}, nil
}

// GetChannelSidebarCategories returns sidebar categories for a user in a team.
func (s *APIServer) GetChannelSidebarCategories(ctx context.Context, req *pb.GetChannelSidebarCategoriesRequest) (*pb.GetChannelSidebarCategoriesResponse, error) {
	cats, appErr := s.impl.GetChannelSidebarCategories(req.GetUserId(), req.GetTeamId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetChannelSidebarCategoriesResponse{Categories: orderedSidebarCategoriesToProto(cats)}, nil
}

// UpdateChannelSidebarCategories updates sidebar categories.
func (s *APIServer) UpdateChannelSidebarCategories(ctx context.Context, req *pb.UpdateChannelSidebarCategoriesRequest) (*pb.UpdateChannelSidebarCategoriesResponse, error) {
	cats, appErr := s.impl.UpdateChannelSidebarCategories(req.GetUserId(), req.GetTeamId(), sidebarCategoriesWithChannelsFromProto(req.GetCategories()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateChannelSidebarCategoriesResponse{Categories: sidebarCategoriesWithChannelsToProto(cats)}, nil
}
