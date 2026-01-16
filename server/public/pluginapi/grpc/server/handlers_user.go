// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"context"

	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// User API Handlers
// =============================================================================

// CreateUser creates a new user.
func (s *APIServer) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.CreateUserResponse, error) {
	user, appErr := s.impl.CreateUser(userFromProto(req.GetUser()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateUserResponse{User: userToProto(user)}, nil
}

// DeleteUser deletes a user.
func (s *APIServer) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	appErr := s.impl.DeleteUser(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteUserResponse{}, nil
}

// GetUsers returns a list of users based on the provided options.
func (s *APIServer) GetUsers(ctx context.Context, req *pb.GetUsersRequest) (*pb.GetUsersResponse, error) {
	opts := userGetOptionsFromProto(req)
	users, appErr := s.impl.GetUsers(opts)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUsersResponse{Users: usersToProto(users)}, nil
}

// GetUsersByIds returns a list of users by their IDs.
func (s *APIServer) GetUsersByIds(ctx context.Context, req *pb.GetUsersByIdsRequest) (*pb.GetUsersByIdsResponse, error) {
	users, appErr := s.impl.GetUsersByIds(req.GetUserIds())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUsersByIdsResponse{Users: usersToProto(users)}, nil
}

// GetUser returns a user by ID.
func (s *APIServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
	user, appErr := s.impl.GetUser(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUserResponse{User: userToProto(user)}, nil
}

// GetUserByEmail returns a user by email address.
func (s *APIServer) GetUserByEmail(ctx context.Context, req *pb.GetUserByEmailRequest) (*pb.GetUserByEmailResponse, error) {
	user, appErr := s.impl.GetUserByEmail(req.GetEmail())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUserByEmailResponse{User: userToProto(user)}, nil
}

// GetUserByUsername returns a user by username.
func (s *APIServer) GetUserByUsername(ctx context.Context, req *pb.GetUserByUsernameRequest) (*pb.GetUserByUsernameResponse, error) {
	user, appErr := s.impl.GetUserByUsername(req.GetName())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUserByUsernameResponse{User: userToProto(user)}, nil
}

// GetUsersByUsernames returns users by their usernames.
func (s *APIServer) GetUsersByUsernames(ctx context.Context, req *pb.GetUsersByUsernamesRequest) (*pb.GetUsersByUsernamesResponse, error) {
	users, appErr := s.impl.GetUsersByUsernames(req.GetUsernames())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUsersByUsernamesResponse{Users: usersToProto(users)}, nil
}

// GetUsersInTeam returns users in a team.
func (s *APIServer) GetUsersInTeam(ctx context.Context, req *pb.GetUsersInTeamRequest) (*pb.GetUsersInTeamResponse, error) {
	users, appErr := s.impl.GetUsersInTeam(req.GetTeamId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUsersInTeamResponse{Users: usersToProto(users)}, nil
}

// UpdateUser updates a user.
func (s *APIServer) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.UpdateUserResponse, error) {
	user, appErr := s.impl.UpdateUser(userFromProto(req.GetUser()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateUserResponse{User: userToProto(user)}, nil
}

// GetUserStatus returns a user's status.
func (s *APIServer) GetUserStatus(ctx context.Context, req *pb.GetUserStatusRequest) (*pb.GetUserStatusResponse, error) {
	status, appErr := s.impl.GetUserStatus(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUserStatusResponse{Status: statusToProto(status)}, nil
}

// GetUserStatusesByIds returns multiple user statuses by user IDs.
func (s *APIServer) GetUserStatusesByIds(ctx context.Context, req *pb.GetUserStatusesByIdsRequest) (*pb.GetUserStatusesByIdsResponse, error) {
	statuses, appErr := s.impl.GetUserStatusesByIds(req.GetUserIds())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUserStatusesByIdsResponse{Statuses: statusesToProto(statuses)}, nil
}

// UpdateUserStatus updates a user's status.
func (s *APIServer) UpdateUserStatus(ctx context.Context, req *pb.UpdateUserStatusRequest) (*pb.UpdateUserStatusResponse, error) {
	status, appErr := s.impl.UpdateUserStatus(req.GetUserId(), req.GetStatus())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateUserStatusResponse{Status: statusToProto(status)}, nil
}

// SetUserStatusTimedDND sets a user's DND status with an end time.
func (s *APIServer) SetUserStatusTimedDND(ctx context.Context, req *pb.SetUserStatusTimedDNDRequest) (*pb.SetUserStatusTimedDNDResponse, error) {
	status, appErr := s.impl.SetUserStatusTimedDND(req.GetUserId(), req.GetEndTime())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SetUserStatusTimedDNDResponse{Status: statusToProto(status)}, nil
}

// UpdateUserActive enables or disables a user.
func (s *APIServer) UpdateUserActive(ctx context.Context, req *pb.UpdateUserActiveRequest) (*pb.UpdateUserActiveResponse, error) {
	appErr := s.impl.UpdateUserActive(req.GetUserId(), req.GetActive())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateUserActiveResponse{}, nil
}

// UpdateUserCustomStatus updates a user's custom status.
func (s *APIServer) UpdateUserCustomStatus(ctx context.Context, req *pb.UpdateUserCustomStatusRequest) (*pb.UpdateUserCustomStatusResponse, error) {
	appErr := s.impl.UpdateUserCustomStatus(req.GetUserId(), customStatusFromProto(req.GetCustomStatus()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateUserCustomStatusResponse{}, nil
}

// RemoveUserCustomStatus removes a user's custom status.
func (s *APIServer) RemoveUserCustomStatus(ctx context.Context, req *pb.RemoveUserCustomStatusRequest) (*pb.RemoveUserCustomStatusResponse, error) {
	appErr := s.impl.RemoveUserCustomStatus(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.RemoveUserCustomStatusResponse{}, nil
}

// GetUsersInChannel returns users in a channel.
func (s *APIServer) GetUsersInChannel(ctx context.Context, req *pb.GetUsersInChannelRequest) (*pb.GetUsersInChannelResponse, error) {
	users, appErr := s.impl.GetUsersInChannel(req.GetChannelId(), req.GetSortBy(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetUsersInChannelResponse{Users: usersToProto(users)}, nil
}

// GetLDAPUserAttributes returns LDAP attributes for a user.
func (s *APIServer) GetLDAPUserAttributes(ctx context.Context, req *pb.GetLDAPUserAttributesRequest) (*pb.GetLDAPUserAttributesResponse, error) {
	attrs, appErr := s.impl.GetLDAPUserAttributes(req.GetUserId(), req.GetAttributes())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetLDAPUserAttributesResponse{Attributes: attrs}, nil
}

// SearchUsers searches for users.
func (s *APIServer) SearchUsers(ctx context.Context, req *pb.SearchUsersRequest) (*pb.SearchUsersResponse, error) {
	search := userSearchFromProto(req)
	users, appErr := s.impl.SearchUsers(search)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SearchUsersResponse{Users: usersToProto(users)}, nil
}

// GetProfileImage returns a user's profile image.
func (s *APIServer) GetProfileImage(ctx context.Context, req *pb.GetProfileImageRequest) (*pb.GetProfileImageResponse, error) {
	data, appErr := s.impl.GetProfileImage(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetProfileImageResponse{Image: data}, nil
}

// SetProfileImage sets a user's profile image.
func (s *APIServer) SetProfileImage(ctx context.Context, req *pb.SetProfileImageRequest) (*pb.SetProfileImageResponse, error) {
	appErr := s.impl.SetProfileImage(req.GetUserId(), req.GetData())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SetProfileImageResponse{}, nil
}

// HasPermissionTo checks if a user has a global permission.
func (s *APIServer) HasPermissionTo(ctx context.Context, req *pb.HasPermissionToRequest) (*pb.HasPermissionToResponse, error) {
	perm := permissionFromId(req.GetPermissionId())
	has := s.impl.HasPermissionTo(req.GetUserId(), perm)
	return &pb.HasPermissionToResponse{HasPermission: has}, nil
}

// HasPermissionToTeam checks if a user has a permission in a team.
func (s *APIServer) HasPermissionToTeam(ctx context.Context, req *pb.HasPermissionToTeamRequest) (*pb.HasPermissionToTeamResponse, error) {
	perm := permissionFromId(req.GetPermissionId())
	has := s.impl.HasPermissionToTeam(req.GetUserId(), req.GetTeamId(), perm)
	return &pb.HasPermissionToTeamResponse{HasPermission: has}, nil
}

// HasPermissionToChannel checks if a user has a permission in a channel.
func (s *APIServer) HasPermissionToChannel(ctx context.Context, req *pb.HasPermissionToChannelRequest) (*pb.HasPermissionToChannelResponse, error) {
	perm := permissionFromId(req.GetPermissionId())
	has := s.impl.HasPermissionToChannel(req.GetUserId(), req.GetChannelId(), perm)
	return &pb.HasPermissionToChannelResponse{HasPermission: has}, nil
}

// PublishUserTyping publishes a user typing event.
func (s *APIServer) PublishUserTyping(ctx context.Context, req *pb.PublishUserTypingRequest) (*pb.PublishUserTypingResponse, error) {
	appErr := s.impl.PublishUserTyping(req.GetUserId(), req.GetChannelId(), req.GetParentId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.PublishUserTypingResponse{}, nil
}

// UpdateUserAuth updates a user's authentication data.
func (s *APIServer) UpdateUserAuth(ctx context.Context, req *pb.UpdateUserAuthRequest) (*pb.UpdateUserAuthResponse, error) {
	userAuth, appErr := s.impl.UpdateUserAuth(req.GetUserId(), userAuthFromProto(req.GetUserAuth()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateUserAuthResponse{UserAuth: userAuthToProto(userAuth)}, nil
}

// UpdateUserRoles updates a user's roles.
func (s *APIServer) UpdateUserRoles(ctx context.Context, req *pb.UpdateUserRolesRequest) (*pb.UpdateUserRolesResponse, error) {
	user, appErr := s.impl.UpdateUserRoles(req.GetUserId(), req.GetNewRoles())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdateUserRolesResponse{User: userToProto(user)}, nil
}

// =============================================================================
// Session API Handlers
// =============================================================================

// GetSession returns a session by ID.
func (s *APIServer) GetSession(ctx context.Context, req *pb.GetSessionRequest) (*pb.GetSessionResponse, error) {
	session, appErr := s.impl.GetSession(req.GetSessionId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetSessionResponse{Session: sessionToProto(session)}, nil
}

// CreateSession creates a new session.
func (s *APIServer) CreateSession(ctx context.Context, req *pb.CreateSessionRequest) (*pb.CreateSessionResponse, error) {
	session, appErr := s.impl.CreateSession(sessionFromProto(req.GetSession()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateSessionResponse{Session: sessionToProto(session)}, nil
}

// ExtendSessionExpiry extends a session's expiry time.
func (s *APIServer) ExtendSessionExpiry(ctx context.Context, req *pb.ExtendSessionExpiryRequest) (*pb.ExtendSessionExpiryResponse, error) {
	appErr := s.impl.ExtendSessionExpiry(req.GetSessionId(), req.GetNewExpiry())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.ExtendSessionExpiryResponse{}, nil
}

// RevokeSession revokes a session.
func (s *APIServer) RevokeSession(ctx context.Context, req *pb.RevokeSessionRequest) (*pb.RevokeSessionResponse, error) {
	appErr := s.impl.RevokeSession(req.GetSessionId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.RevokeSessionResponse{}, nil
}

// CreateUserAccessToken creates a new user access token.
func (s *APIServer) CreateUserAccessToken(ctx context.Context, req *pb.CreateUserAccessTokenRequest) (*pb.CreateUserAccessTokenResponse, error) {
	token, appErr := s.impl.CreateUserAccessToken(userAccessTokenFromProto(req.GetToken()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.CreateUserAccessTokenResponse{Token: userAccessTokenToProto(token)}, nil
}

// RevokeUserAccessToken revokes a user access token.
func (s *APIServer) RevokeUserAccessToken(ctx context.Context, req *pb.RevokeUserAccessTokenRequest) (*pb.RevokeUserAccessTokenResponse, error) {
	appErr := s.impl.RevokeUserAccessToken(req.GetTokenId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.RevokeUserAccessTokenResponse{}, nil
}

// =============================================================================
// Preference API Handlers
// =============================================================================

// GetPreferenceForUser returns a single preference for a user.
func (s *APIServer) GetPreferenceForUser(ctx context.Context, req *pb.GetPreferenceForUserRequest) (*pb.GetPreferenceForUserResponse, error) {
	pref, appErr := s.impl.GetPreferenceForUser(req.GetUserId(), req.GetCategory(), req.GetName())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetPreferenceForUserResponse{Preference: preferenceToProto(pref)}, nil
}

// GetPreferencesForUser returns all preferences for a user.
func (s *APIServer) GetPreferencesForUser(ctx context.Context, req *pb.GetPreferencesForUserRequest) (*pb.GetPreferencesForUserResponse, error) {
	prefs, appErr := s.impl.GetPreferencesForUser(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetPreferencesForUserResponse{Preferences: preferencesToProto(prefs)}, nil
}

// UpdatePreferencesForUser updates preferences for a user.
func (s *APIServer) UpdatePreferencesForUser(ctx context.Context, req *pb.UpdatePreferencesForUserRequest) (*pb.UpdatePreferencesForUserResponse, error) {
	prefs := preferencesFromProto(req.GetPreferences())
	appErr := s.impl.UpdatePreferencesForUser(req.GetUserId(), prefs)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpdatePreferencesForUserResponse{}, nil
}

// DeletePreferencesForUser deletes preferences for a user.
func (s *APIServer) DeletePreferencesForUser(ctx context.Context, req *pb.DeletePreferencesForUserRequest) (*pb.DeletePreferencesForUserResponse, error) {
	prefs := preferencesFromProto(req.GetPreferences())
	appErr := s.impl.DeletePreferencesForUser(req.GetUserId(), prefs)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeletePreferencesForUserResponse{}, nil
}

// permissionFromId is defined in convert_common.go
