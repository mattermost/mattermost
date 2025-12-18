// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

// getBridgeClient returns a bridge client for making requests to the plugin bridge API
func (a *App) getBridgeClient(userID string) *agentclient.Client {
	return agentclient.NewClientFromApp(a, userID)
}

// isAIPluginBridgeAvailable checks if the mattermost-ai plugin is active and supports the bridge API (v1.5.0+)
func (a *App) isAIPluginBridgeAvailable(rctx request.CTX) bool {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		rctx.Logger().Debug("AI plugin bridge not available - plugin environment not initialized")
		return false
	}

	// Check if plugin is active
	if !pluginsEnvironment.IsActive(aiPluginID) {
		rctx.Logger().Debug("AI plugin bridge not available - plugin is not active or not installed",
			mlog.String("plugin_id", aiPluginID),
		)
		return false
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
				return false
			}

			minVersion, err := semver.Parse(minAIPluginVersionForBridge)
			if err != nil {
				return false
			}

			if pluginVersion.LT(minVersion) {
				rctx.Logger().Debug("AI plugin bridge not available - plugin version is too old",
					mlog.String("plugin_id", aiPluginID),
					mlog.String("current_version", plugin.Manifest.Version),
					mlog.String("minimum_version", minAIPluginVersionForBridge),
				)
				return false
			}

			return true
		}
	}

	return false
}

// GetAgents retrieves all available agents from the bridge API
func (a *App) GetAgents(rctx request.CTX, userID string) ([]agentclient.BridgeAgentInfo, *model.AppError) {
	// Check if the AI plugin is active and supports the bridge API (v1.5.0+)
	if !a.isAIPluginBridgeAvailable(rctx) {
		return []agentclient.BridgeAgentInfo{}, nil
	}

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
	// Check if the AI plugin is active and supports the bridge API (v1.5.0+)
	if !a.isAIPluginBridgeAvailable(rctx) {
		return []agentclient.BridgeServiceInfo{}, nil
	}

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
