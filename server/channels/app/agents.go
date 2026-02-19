// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/blang/semver/v4"

	agentclient "github.com/mattermost/mattermost-plugin-ai/public/bridgeclient"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	aiPluginID                  = "mattermost-ai"
	minAIPluginVersionForBridge = "1.5.0"
)

// GetBridgeClient returns a bridge client for making requests to the plugin bridge API
func (a *App) GetBridgeClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// GetAIPluginBridgeStatus checks if the mattermost-ai plugin is active and supports the bridge API (v1.5.0+)
// It returns a boolean indicating availability, and a reason string (translation ID) if unavailable.
func (a *App) GetAIPluginBridgeStatus(rctx request.CTX) (bool, string) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		rctx.Logger().Debug("AI plugin bridge not available - plugin environment not initialized")
		return false, "app.agents.bridge.not_available.plugin_env_not_initialized"
	}

	// Check if plugin is active
	if !pluginsEnvironment.IsActive(aiPluginID) {
		rctx.Logger().Debug("AI plugin bridge not available - plugin is not active or not installed",
			mlog.String("plugin_id", aiPluginID),
		)
		return false, "app.agents.bridge.not_available.plugin_not_active"
	}

	// Get the plugin's manifest to check version
	plugins := pluginsEnvironment.Active()
	for _, plugin := range plugins {
		if plugin.Manifest != nil && plugin.Manifest.Id == aiPluginID {
			pluginVersion, err := semver.Parse(plugin.Manifest.Version)
			if err != nil {
				rctx.Logger().Debug("AI plugin bridge not available - failed to parse plugin version",
					mlog.String("plugin_id", aiPluginID),
					mlog.String("version", plugin.Manifest.Version),
					mlog.Err(err),
				)
				return false, "app.agents.bridge.not_available.plugin_version_parse_failed"
			}

			minVersion, err := semver.Parse(minAIPluginVersionForBridge)
			if err != nil {
				return false, "app.agents.bridge.not_available.min_version_parse_failed"
			}

			if pluginVersion.LT(minVersion) {
				rctx.Logger().Debug("AI plugin bridge not available - plugin version is too old",
					mlog.String("plugin_id", aiPluginID),
					mlog.String("current_version", plugin.Manifest.Version),
					mlog.String("minimum_version", minAIPluginVersionForBridge),
				)
				return false, "app.agents.bridge.not_available.plugin_version_too_old"
			}

			return true, ""
		}
	}

	return false, "app.agents.bridge.not_available.plugin_not_registered"
}

// GetAgents retrieves all available agents from the bridge API
func (a *App) GetAgents(rctx request.CTX, userID string) ([]agentclient.BridgeAgentInfo, *model.AppError) {
	// Check if the AI plugin is active and supports the bridge API (v1.5.0+)
	if available, _ := a.GetAIPluginBridgeStatus(rctx); !available {
		return []agentclient.BridgeAgentInfo{}, nil
	}

	// Create bridge client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.GetBridgeClient(sessionUserID)

	agents, err := client.GetAgents(userID)
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
func (a *App) GetLLMServices(rctx request.CTX, userID string) ([]agentclient.BridgeServiceInfo, *model.AppError) {
	// Check if the AI plugin is active and supports the bridge API (v1.5.0+)
	if available, _ := a.GetAIPluginBridgeStatus(rctx); !available {
		return []agentclient.BridgeServiceInfo{}, nil
	}

	// Create bridge client
	sessionUserID := ""
	if session := rctx.Session(); session != nil {
		sessionUserID = session.UserId
	}
	client := a.GetBridgeClient(sessionUserID)

	services, err := client.GetServices(userID)
	if err != nil {
		rctx.Logger().Error("Failed to get LLM services from bridge",
			mlog.Err(err),
			mlog.String("user_id", userID),
		)
		return nil, model.NewAppError("GetLLMServices", "app.agents.get_services.bridge_call_failed", nil, err.Error(), http.StatusInternalServerError)
	}

	return services, nil
}
