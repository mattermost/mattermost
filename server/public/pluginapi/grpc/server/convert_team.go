// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Team Conversions (pb <-> model)
// =============================================================================

// teamTypeToProto converts a model team type string to pb.TeamType.
func teamTypeToProto(t string) pb.TeamType {
	switch t {
	case model.TeamOpen:
		return pb.TeamType_TEAM_TYPE_OPEN
	case model.TeamInvite:
		return pb.TeamType_TEAM_TYPE_INVITE
	default:
		return pb.TeamType_TEAM_TYPE_UNSPECIFIED
	}
}

// teamTypeFromProto converts a pb.TeamType to a model team type string.
func teamTypeFromProto(t pb.TeamType) string {
	switch t {
	case pb.TeamType_TEAM_TYPE_OPEN:
		return model.TeamOpen
	case pb.TeamType_TEAM_TYPE_INVITE:
		return model.TeamInvite
	default:
		return ""
	}
}

// teamToProto converts a model.Team to a pb.Team.
// Returns nil if the input is nil.
func teamToProto(t *model.Team) *pb.Team {
	if t == nil {
		return nil
	}

	pbTeam := &pb.Team{
		Id:                  t.Id,
		CreateAt:            t.CreateAt,
		UpdateAt:            t.UpdateAt,
		DeleteAt:            t.DeleteAt,
		DisplayName:         t.DisplayName,
		Name:                t.Name,
		Description:         t.Description,
		Email:               t.Email,
		Type:                teamTypeToProto(t.Type),
		CompanyName:         t.CompanyName,
		AllowedDomains:      t.AllowedDomains,
		InviteId:            t.InviteId,
		AllowOpenInvite:     t.AllowOpenInvite,
		LastTeamIconUpdate:  t.LastTeamIconUpdate,
		CloudLimitsArchived: t.CloudLimitsArchived,
	}

	// Handle optional pointer fields
	if t.SchemeId != nil {
		pbTeam.SchemeId = t.SchemeId
	}
	if t.GroupConstrained != nil {
		pbTeam.GroupConstrained = t.GroupConstrained
	}
	if t.PolicyID != nil {
		pbTeam.PolicyId = t.PolicyID
	}

	return pbTeam
}

// teamFromProto converts a pb.Team to a model.Team.
// Returns nil if the input is nil.
func teamFromProto(t *pb.Team) *model.Team {
	if t == nil {
		return nil
	}

	modelTeam := &model.Team{
		Id:                  t.Id,
		CreateAt:            t.CreateAt,
		UpdateAt:            t.UpdateAt,
		DeleteAt:            t.DeleteAt,
		DisplayName:         t.DisplayName,
		Name:                t.Name,
		Description:         t.Description,
		Email:               t.Email,
		Type:                teamTypeFromProto(t.Type),
		CompanyName:         t.CompanyName,
		AllowedDomains:      t.AllowedDomains,
		InviteId:            t.InviteId,
		AllowOpenInvite:     t.AllowOpenInvite,
		LastTeamIconUpdate:  t.LastTeamIconUpdate,
		CloudLimitsArchived: t.CloudLimitsArchived,
	}

	// Handle optional pointer fields
	if t.SchemeId != nil {
		modelTeam.SchemeId = t.SchemeId
	}
	if t.GroupConstrained != nil {
		modelTeam.GroupConstrained = t.GroupConstrained
	}
	if t.PolicyId != nil {
		modelTeam.PolicyID = t.PolicyId
	}

	return modelTeam
}

// teamsToProto converts a slice of model.Team to a slice of pb.Team.
func teamsToProto(teams []*model.Team) []*pb.Team {
	if teams == nil {
		return nil
	}
	result := make([]*pb.Team, len(teams))
	for i, t := range teams {
		result[i] = teamToProto(t)
	}
	return result
}

// =============================================================================
// TeamMember Conversions
// =============================================================================

// teamMemberToProto converts a model.TeamMember to a pb.TeamMember.
func teamMemberToProto(tm *model.TeamMember) *pb.TeamMember {
	if tm == nil {
		return nil
	}
	return &pb.TeamMember{
		TeamId:      tm.TeamId,
		UserId:      tm.UserId,
		Roles:       tm.Roles,
		DeleteAt:    tm.DeleteAt,
		SchemeGuest: tm.SchemeGuest,
		SchemeUser:  tm.SchemeUser,
		SchemeAdmin: tm.SchemeAdmin,
		CreateAt:    tm.CreateAt,
	}
}

// teamMemberFromProto converts a pb.TeamMember to a model.TeamMember.
func teamMemberFromProto(tm *pb.TeamMember) *model.TeamMember {
	if tm == nil {
		return nil
	}
	return &model.TeamMember{
		TeamId:      tm.TeamId,
		UserId:      tm.UserId,
		Roles:       tm.Roles,
		DeleteAt:    tm.DeleteAt,
		SchemeGuest: tm.SchemeGuest,
		SchemeUser:  tm.SchemeUser,
		SchemeAdmin: tm.SchemeAdmin,
		CreateAt:    tm.CreateAt,
	}
}

// teamMembersToProto converts a slice of model.TeamMember to a slice of pb.TeamMember.
func teamMembersToProto(members []*model.TeamMember) []*pb.TeamMember {
	if members == nil {
		return nil
	}
	result := make([]*pb.TeamMember, len(members))
	for i, tm := range members {
		result[i] = teamMemberToProto(tm)
	}
	return result
}

// =============================================================================
// TeamMemberWithError Conversions
// =============================================================================

// teamMemberWithErrorToProto converts a model.TeamMemberWithError to a pb.TeamMemberWithError.
func teamMemberWithErrorToProto(tme *model.TeamMemberWithError) *pb.TeamMemberWithError {
	if tme == nil {
		return nil
	}

	result := &pb.TeamMemberWithError{
		UserId: tme.UserId,
		Member: teamMemberToProto(tme.Member),
	}

	if tme.Error != nil {
		result.Error = appErrorToProto(tme.Error)
	}

	return result
}

// teamMembersWithErrorToProto converts a slice of model.TeamMemberWithError to a slice of pb.TeamMemberWithError.
func teamMembersWithErrorToProto(members []*model.TeamMemberWithError) []*pb.TeamMemberWithError {
	if members == nil {
		return nil
	}
	result := make([]*pb.TeamMemberWithError, len(members))
	for i, tme := range members {
		result[i] = teamMemberWithErrorToProto(tme)
	}
	return result
}

// =============================================================================
// TeamUnread Conversions
// =============================================================================

// teamUnreadToProto converts a model.TeamUnread to a pb.TeamUnread.
func teamUnreadToProto(tu *model.TeamUnread) *pb.TeamUnread {
	if tu == nil {
		return nil
	}
	return &pb.TeamUnread{
		TeamId:             tu.TeamId,
		MsgCount:           tu.MsgCount,
		MentionCount:       tu.MentionCount,
		MentionCountRoot:   tu.MentionCountRoot,
		MsgCountRoot:       tu.MsgCountRoot,
		ThreadCount:        tu.ThreadCount,
		ThreadMentionCount: tu.ThreadMentionCount,
	}
}

// teamUnreadsToProto converts a slice of model.TeamUnread to a slice of pb.TeamUnread.
func teamUnreadsToProto(unreads []*model.TeamUnread) []*pb.TeamUnread {
	if unreads == nil {
		return nil
	}
	result := make([]*pb.TeamUnread, len(unreads))
	for i, tu := range unreads {
		result[i] = teamUnreadToProto(tu)
	}
	return result
}

// =============================================================================
// TeamStats Conversions
// =============================================================================

// teamStatsToProto converts a model.TeamStats to a pb.TeamStats.
func teamStatsToProto(ts *model.TeamStats) *pb.TeamStats {
	if ts == nil {
		return nil
	}
	return &pb.TeamStats{
		TeamId:            ts.TeamId,
		TotalMemberCount:  ts.TotalMemberCount,
		ActiveMemberCount: ts.ActiveMemberCount,
	}
}
