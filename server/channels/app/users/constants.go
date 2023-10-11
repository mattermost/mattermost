// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

const (
	TokenTypePasswordRecovery = "password_recovery"
	TokenTypeVerifyEmail      = "verify_email"
	TokenTypeTeamInvitation   = "team_invitation"
	TokenTypeGuestInvitation  = "guest_invitation"
	InvitationExpiryTime      = 1000 * 60 * 60 * 48 // 48 hours
)
