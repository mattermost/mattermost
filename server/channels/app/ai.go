// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
)

// getAIClient returns an AI client for making requests to the AI plugin
func (a *App) getAIClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// Placeholder - NewClientFromApp needs to be called to initialize the AI client in order to ensure everything lines up from a build perspective, and getAIClient can't be uncalled because of linter
// TODO: Remove once a proper feature actually uses the AI Client
func (a *App) AIClient() error {
	aiClient := a.getAIClient("")
	if aiClient == nil {
		return errors.New("failed to get AI client")
	}
	return nil
}
