// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// getAIClient returns an AI client for making requests to the AI plugin
func (a *App) getAIClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// GetAIAgents retrieves all available AI agents from the bridge API
func (a *App) GetAIAgents(rctx request.CTX, userID string) (*agentclient.AgentsResponse, *model.AppError) {
	// Create AI client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getAIClient(sessionUserID)

	agents, err := client.GetAgents(userID)
	if err != nil {
		rctx.Logger().Error("Failed to get AI agents from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetAIAgents", "app.ai.get_agents.bridge_call_failed", nil, err.Error(), 500)
	}

	return &agentclient.AgentsResponse{Agents: agents}, nil
}

// GetAIServices retrieves all available AI services from the bridge API
func (a *App) GetAIServices(rctx request.CTX, userID string) (*agentclient.ServicesResponse, *model.AppError) {
	// Create AI client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getAIClient(sessionUserID)

	services, err := client.GetServices(userID)
	if err != nil {
		rctx.Logger().Error("Failed to get AI services from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetAIServices", "app.ai.get_services.bridge_call_failed", nil, err.Error(), 500)
	}

	return &agentclient.ServicesResponse{Services: services}, nil
}
