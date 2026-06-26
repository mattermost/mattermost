// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// IntuneInterface provides methods for Microsoft Intune MAM authentication.
// This allows mobile users to authenticate via Microsoft Entra ID (Azure AD) MSAL tokens
// and map to existing users who login via Office 365 or SAML on other clients.
type IntuneInterface interface {
	// IsConfigured checks if Intune MAM is properly configured and enabled.
	// Returns true if IntuneSettings.Enable is true and all required configuration is present.
	IsConfigured() bool

	// Login authenticates a user using a Microsoft Entra ID access_token from MSAL.
	// The token is validated against Microsoft's JWKS endpoint with proper key rollover support.
	// The access_token's audience claim is validated against the tenant-specific IntuneScope
	// to ensure proper tenant isolation.
	// The user is then matched to an existing user based on the configured AuthService
	// (either 'office365' or 'saml'), or a new user is created if allowed.
	//
	// Parameters:
	//   - rctx: Request context for logging and tracing
	//   - accessToken: The access_token from MSAL authentication
	//
	// Returns:
	//   - user: The authenticated user (matched or newly created)
	//   - appError: Error if authentication fails
	Login(rctx request.CTX, accessToken string) (*model.User, *model.AppError)
}
