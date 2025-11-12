// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// getBridgeClient returns a bridge client for making requests to the plugin bridge API
func (a *App) getBridgeClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// GetAgents retrieves all available agents from the bridge API
func (a *App) GetAgents(rctx request.CTX, userID string) ([]agentclient.BridgeAgentInfo, *model.AppError) {
	// Create bridge client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getBridgeClient(sessionUserID)

	agents, err := client.GetAgents(userID)
	if err != nil {
		rctx.Logger().Error("Failed to get agents from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetAgents", "app.agents.get_agents.bridge_call_failed", nil, err.Error(), 500)
	}

	return agents, nil
}

// GetLLMServices retrieves all available LLM services from the bridge API
func (a *App) GetLLMServices(rctx request.CTX, userID string) ([]agentclient.BridgeServiceInfo, *model.AppError) {
	// Create bridge client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.getBridgeClient(sessionUserID)

	services, err := client.GetServices(userID)
	if err != nil {
		rctx.Logger().Error("Failed to get LLM services from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetLLMServices", "app.agents.get_services.bridge_call_failed", nil, err.Error(), 500)
	}

	return services, nil
}
