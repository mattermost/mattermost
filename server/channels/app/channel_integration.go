// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"os"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

var (
	integrationAdminUsername string
	integrationAdminOnce     sync.Once
)

// getIntegrationAdminUsername returns the integration admin username from environment variable
// using sync.Once to ensure it's only read once for performance.
func getIntegrationAdminUsername() string {
	integrationAdminOnce.Do(func() {
		integrationAdminUsername = os.Getenv("INTEGRATION_ADMIN_USERNAME")
	})
	return integrationAdminUsername
}

// ResetIntegrationAdminUsernameCache resets the cached integration admin username for testing purposes.
// This is primarily used by test utilities to ensure clean state between tests.
func ResetIntegrationAdminUsernameCache() {
	integrationAdminUsername = ""
	integrationAdminOnce = sync.Once{}
}

// ResetIntegrationAdminUsernameCache resets the cached integration admin username for testing purposes.
// This method allows access through App instance.
func (a *App) ResetIntegrationAdminUsernameCache() {
	ResetIntegrationAdminUsernameCache()
}

// IsOfficialChannel checks if a channel is official by comparing creator with integration admin user.
func (a *App) IsOfficialChannel(c request.CTX, channel *model.Channel) (bool, *model.AppError) {
	if channel == nil {
		return false, model.NewAppError("IsOfficialChannel", "app.channel.invalid", nil, "channel is nil", http.StatusBadRequest)
	}

	if channel.CreatorId == "" {
		return false, nil
	}

	// Get cached integration admin username
	adminUsername := getIntegrationAdminUsername()
	if adminUsername == "" {
		// Return false (not official) instead of error when INTEGRATION_ADMIN_USERNAME is not configured
		// This allows the system to function normally without official channel features
		return false, nil
	}

	creatorUser, err := a.GetUser(channel.CreatorId)
	if err != nil {
		if err.Id == MissingAccountError {
			// If creator user doesn't exist, channel is not official
			return false, nil
		}
		return false, err
	}

	return creatorUser.Username == adminUsername, nil
}
