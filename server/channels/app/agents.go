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

// GetUsersForAgents retrieves the User objects for all available agents
func (a *App) GetUsersForAgents(rctx request.CTX, userID string) ([]*model.User, *model.AppError) {
	agents, appErr := a.GetAgents(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}

	if len(agents) == 0 {
		return []*model.User{}, nil
	}

	users := make([]*model.User, 0, len(agents))
	for _, agent := range agents {
		// Agents have a username field that corresponds to the bot user's username
		user, err := a.Srv().Store().User().GetByUsername(agent.Username)
		if err != nil {
			rctx.Logger().Warn("Failed to get user for agent",
				mlog.Err(err),
				mlog.String("agent_id", agent.ID),
				mlog.String("username", agent.Username),
			)
			continue
		}
		users = append(users, user)
	}

	return users, nil
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
