// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// User Conversions (pb <-> model)
// =============================================================================

// userToProto converts a model.User to a pb.User.
// Returns nil if the input is nil.
func userToProto(u *model.User) *pb.User {
	if u == nil {
		return nil
	}

	pbUser := &pb.User{
		Id:                     u.Id,
		CreateAt:               u.CreateAt,
		UpdateAt:               u.UpdateAt,
		DeleteAt:               u.DeleteAt,
		Username:               u.Username,
		Password:               u.Password,
		AuthService:            u.AuthService,
		Email:                  u.Email,
		EmailVerified:          u.EmailVerified,
		Nickname:               u.Nickname,
		FirstName:              u.FirstName,
		LastName:               u.LastName,
		Position:               u.Position,
		Roles:                  u.Roles,
		AllowMarketing:         u.AllowMarketing,
		Props:                  u.Props,
		NotifyProps:            u.NotifyProps,
		LastPasswordUpdate:     u.LastPasswordUpdate,
		LastPictureUpdate:      u.LastPictureUpdate,
		FailedAttempts:         int32(u.FailedAttempts),
		Locale:                 u.Locale,
		Timezone:               u.Timezone,
		MfaActive:              u.MfaActive,
		MfaSecret:              u.MfaSecret,
		LastActivityAt:         u.LastActivityAt,
		IsBot:                  u.IsBot,
		BotDescription:         u.BotDescription,
		BotLastIconUpdate:      u.BotLastIconUpdate,
		TermsOfServiceId:       u.TermsOfServiceId,
		TermsOfServiceCreateAt: u.TermsOfServiceCreateAt,
		DisableWelcomeEmail:    u.DisableWelcomeEmail,
		LastLogin:              u.LastLogin,
	}

	// Handle optional pointer fields
	if u.AuthData != nil {
		pbUser.AuthData = u.AuthData
	}
	if u.RemoteId != nil {
		pbUser.RemoteId = u.RemoteId
	}

	return pbUser
}

// userFromProto converts a pb.User to a model.User.
// Returns nil if the input is nil.
func userFromProto(u *pb.User) *model.User {
	if u == nil {
		return nil
	}

	modelUser := &model.User{
		Id:                     u.Id,
		CreateAt:               u.CreateAt,
		UpdateAt:               u.UpdateAt,
		DeleteAt:               u.DeleteAt,
		Username:               u.Username,
		Password:               u.Password,
		AuthService:            u.AuthService,
		Email:                  u.Email,
		EmailVerified:          u.EmailVerified,
		Nickname:               u.Nickname,
		FirstName:              u.FirstName,
		LastName:               u.LastName,
		Position:               u.Position,
		Roles:                  u.Roles,
		AllowMarketing:         u.AllowMarketing,
		Props:                  u.Props,
		NotifyProps:            u.NotifyProps,
		LastPasswordUpdate:     u.LastPasswordUpdate,
		LastPictureUpdate:      u.LastPictureUpdate,
		FailedAttempts:         int(u.FailedAttempts),
		Locale:                 u.Locale,
		Timezone:               u.Timezone,
		MfaActive:              u.MfaActive,
		MfaSecret:              u.MfaSecret,
		LastActivityAt:         u.LastActivityAt,
		IsBot:                  u.IsBot,
		BotDescription:         u.BotDescription,
		BotLastIconUpdate:      u.BotLastIconUpdate,
		TermsOfServiceId:       u.TermsOfServiceId,
		TermsOfServiceCreateAt: u.TermsOfServiceCreateAt,
		DisableWelcomeEmail:    u.DisableWelcomeEmail,
		LastLogin:              u.LastLogin,
	}

	// Handle optional pointer fields
	if u.AuthData != nil {
		modelUser.AuthData = u.AuthData
	}
	if u.RemoteId != nil {
		modelUser.RemoteId = u.RemoteId
	}

	return modelUser
}

// usersToProto converts a slice of model.User to a slice of pb.User.
func usersToProto(users []*model.User) []*pb.User {
	if users == nil {
		return nil
	}
	result := make([]*pb.User, len(users))
	for i, u := range users {
		result[i] = userToProto(u)
	}
	return result
}

// =============================================================================
// Status Conversions
// =============================================================================

// statusToProto converts a model.Status to a pb.Status.
func statusToProto(s *model.Status) *pb.Status {
	if s == nil {
		return nil
	}
	return &pb.Status{
		UserId:         s.UserId,
		Status:         s.Status,
		Manual:         s.Manual,
		LastActivityAt: s.LastActivityAt,
		DndEndTime:     s.DNDEndTime,
	}
}

// statusesFromProto converts a slice of pb.Status to a slice of model.Status.
func statusesToProto(statuses []*model.Status) []*pb.Status {
	if statuses == nil {
		return nil
	}
	result := make([]*pb.Status, len(statuses))
	for i, s := range statuses {
		result[i] = statusToProto(s)
	}
	return result
}

// =============================================================================
// CustomStatus Conversions
// =============================================================================

// customStatusFromProto converts a pb.CustomStatus to a model.CustomStatus.
func customStatusFromProto(cs *pb.CustomStatus) *model.CustomStatus {
	if cs == nil {
		return nil
	}
	return &model.CustomStatus{
		Emoji:     cs.Emoji,
		Text:      cs.Text,
		Duration:  cs.Duration,
		ExpiresAt: time.UnixMilli(cs.ExpiresAt),
	}
}

// =============================================================================
// UserGetOptions Conversions
// =============================================================================

// userGetOptionsFromProto converts a pb.GetUsersRequest to model.UserGetOptions.
func userGetOptionsFromProto(req *pb.GetUsersRequest) *model.UserGetOptions {
	if req == nil {
		return nil
	}

	opts := &model.UserGetOptions{
		InTeamId:         req.InTeamId,
		NotInTeamId:      req.NotInTeamId,
		InChannelId:      req.InChannelId,
		NotInChannelId:   req.NotInChannelId,
		InGroupId:        req.InGroupId,
		NotInGroupId:     req.NotInGroupId,
		GroupConstrained: req.GroupConstrained,
		WithoutTeam:      req.WithoutTeam,
		Inactive:         req.Inactive,
		Active:           req.Active,
		Role:             req.Role,
		Roles:            req.Roles,
		ChannelRoles:     req.ChannelRoles,
		TeamRoles:        req.TeamRoles,
		Sort:             req.Sort,
		Page:             int(req.Page),
		PerPage:          int(req.PerPage),
	}

	if req.ViewRestrictions != nil {
		opts.ViewRestrictions = &model.ViewUsersRestrictions{
			Teams:    req.ViewRestrictions.Teams,
			Channels: req.ViewRestrictions.Channels,
		}
	}

	return opts
}

// =============================================================================
// UserSearch Conversions
// =============================================================================

// userSearchFromProto converts a pb.SearchUsersRequest to model.UserSearch.
func userSearchFromProto(req *pb.SearchUsersRequest) *model.UserSearch {
	if req == nil {
		return nil
	}
	return &model.UserSearch{
		Term:             req.Term,
		TeamId:           req.TeamId,
		NotInTeamId:      req.NotInTeamId,
		InChannelId:      req.InChannelId,
		NotInChannelId:   req.NotInChannelId,
		InGroupId:        req.InGroupId,
		NotInGroupId:     req.NotInGroupId,
		GroupConstrained: req.GroupConstrained,
		AllowInactive:    req.AllowInactive,
		WithoutTeam:      req.WithoutTeam,
		Limit:            int(req.Limit),
		Role:             req.Role,
		Roles:            req.Roles,
		ChannelRoles:     req.ChannelRoles,
		TeamRoles:        req.TeamRoles,
	}
}

// =============================================================================
// UserAuth Conversions
// =============================================================================

// userAuthToProto converts a model.UserAuth to a pb.UserAuth.
func userAuthToProto(ua *model.UserAuth) *pb.UserAuth {
	if ua == nil {
		return nil
	}
	result := &pb.UserAuth{
		AuthService: ua.AuthService,
	}
	if ua.AuthData != nil {
		result.AuthData = ua.AuthData
	}
	return result
}

// userAuthFromProto converts a pb.UserAuth to a model.UserAuth.
func userAuthFromProto(ua *pb.UserAuth) *model.UserAuth {
	if ua == nil {
		return nil
	}
	result := &model.UserAuth{
		AuthService: ua.AuthService,
	}
	if ua.AuthData != nil {
		result.AuthData = ua.AuthData
	}
	return result
}

// =============================================================================
// Session Conversions
// =============================================================================

// sessionToProto converts a model.Session to a pb.Session.
func sessionToProto(s *model.Session) *pb.Session {
	if s == nil {
		return nil
	}

	result := &pb.Session{
		Id:             s.Id,
		Token:          s.Token,
		CreateAt:       s.CreateAt,
		ExpiresAt:      s.ExpiresAt,
		LastActivityAt: s.LastActivityAt,
		UserId:         s.UserId,
		DeviceId:       s.DeviceId,
		Roles:          s.Roles,
		IsOauth:        s.IsOAuth,
		ExpiredNotify:  s.ExpiredNotify,
		Props:          s.Props,
		Local:          s.Local,
	}

	if s.TeamMembers != nil {
		result.TeamMembers = make([]*pb.TeamMember, len(s.TeamMembers))
		for i, tm := range s.TeamMembers {
			result.TeamMembers[i] = teamMemberToProto(tm)
		}
	}

	return result
}

// sessionFromProto converts a pb.Session to a model.Session.
func sessionFromProto(s *pb.Session) *model.Session {
	if s == nil {
		return nil
	}

	result := &model.Session{
		Id:             s.Id,
		Token:          s.Token,
		CreateAt:       s.CreateAt,
		ExpiresAt:      s.ExpiresAt,
		LastActivityAt: s.LastActivityAt,
		UserId:         s.UserId,
		DeviceId:       s.DeviceId,
		Roles:          s.Roles,
		IsOAuth:        s.IsOauth,
		ExpiredNotify:  s.ExpiredNotify,
		Props:          s.Props,
		Local:          s.Local,
	}

	if s.TeamMembers != nil {
		result.TeamMembers = make([]*model.TeamMember, len(s.TeamMembers))
		for i, tm := range s.TeamMembers {
			result.TeamMembers[i] = teamMemberFromProto(tm)
		}
	}

	return result
}

// =============================================================================
// UserAccessToken Conversions
// =============================================================================

// userAccessTokenToProto converts a model.UserAccessToken to a pb.UserAccessToken.
func userAccessTokenToProto(t *model.UserAccessToken) *pb.UserAccessToken {
	if t == nil {
		return nil
	}
	return &pb.UserAccessToken{
		Id:          t.Id,
		Token:       t.Token,
		UserId:      t.UserId,
		Description: t.Description,
		IsActive:    t.IsActive,
	}
}

// userAccessTokenFromProto converts a pb.UserAccessToken to a model.UserAccessToken.
func userAccessTokenFromProto(t *pb.UserAccessToken) *model.UserAccessToken {
	if t == nil {
		return nil
	}
	return &model.UserAccessToken{
		Id:          t.Id,
		Token:       t.Token,
		UserId:      t.UserId,
		Description: t.Description,
		IsActive:    t.IsActive,
	}
}

// =============================================================================
// Preference Conversions
// =============================================================================

// preferenceToProto converts a model.Preference to a pb.Preference.
func preferenceToProto(p model.Preference) *pb.Preference {
	return &pb.Preference{
		UserId:   p.UserId,
		Category: p.Category,
		Name:     p.Name,
		Value:    p.Value,
	}
}

// preferenceFromProto converts a pb.Preference to a model.Preference.
func preferenceFromProto(p *pb.Preference) model.Preference {
	if p == nil {
		return model.Preference{}
	}
	return model.Preference{
		UserId:   p.UserId,
		Category: p.Category,
		Name:     p.Name,
		Value:    p.Value,
	}
}

// preferencesToProto converts a slice of model.Preference to a slice of pb.Preference.
func preferencesToProto(prefs []model.Preference) []*pb.Preference {
	if prefs == nil {
		return nil
	}
	result := make([]*pb.Preference, len(prefs))
	for i, p := range prefs {
		result[i] = preferenceToProto(p)
	}
	return result
}

// preferencesFromProto converts a slice of pb.Preference to a slice of model.Preference.
func preferencesFromProto(prefs []*pb.Preference) []model.Preference {
	if prefs == nil {
		return nil
	}
	result := make([]model.Preference, len(prefs))
	for i, p := range prefs {
		result[i] = preferenceFromProto(p)
	}
	return result
}
