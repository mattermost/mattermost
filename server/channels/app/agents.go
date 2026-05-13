// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// GetBridgeClient remains as a compatibility helper for downstream enterprise code.
// New server code should use a.ch.agentsBridge instead of relying on the concrete bridge client.
func (a *App) GetBridgeClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// ServiceCompletion remains as a compatibility helper for downstream enterprise
// code that needs service-based bridge completions while using the shared
// AgentsBridge abstraction.
func (a *App) ServiceCompletion(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error) {
	return a.ch.agentsBridge.ServiceCompletion(sessionUserID, serviceID, req)
}

// GetAIPluginBridgeStatus checks if the mattermost-ai plugin is active and supports the bridge API (v1.5.0+)
// It returns a boolean indicating availability, and a reason string (translation ID) if unavailable.
func (a *App) GetAIPluginBridgeStatus(rctx request.CTX) (bool, string) {
	return a.ch.agentsBridge.Status(rctx)
}

// GetAgents retrieves all available agents from the bridge API
func (a *App) GetAgents(rctx request.CTX, userID string) ([]model.BridgeAgentInfo, *model.AppError) {
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}

	agents, err := a.ch.agentsBridge.GetAgents(sessionUserID, userID)
	if err != nil {
		rctx.Logger().Error("Failed to get agents from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetAgents", "app.agents.get_agents.bridge_call_failed", nil, err.Error(), http.StatusInternalServerError)
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
func (a *App) GetLLMServices(rctx request.CTX, userID string) ([]model.BridgeServiceInfo, *model.AppError) {
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}

	services, err := a.ch.agentsBridge.GetServices(sessionUserID, userID)
	if err != nil {
		rctx.Logger().Error("Failed to get LLM services from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetLLMServices", "app.agents.get_services.bridge_call_failed", nil, err.Error(), http.StatusInternalServerError)
	}

	return services, nil
}
