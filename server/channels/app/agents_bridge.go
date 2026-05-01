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

type BridgeOperation string

const (
	BridgeOperationAutoTranslate BridgeOperation = "auto_translate"
	BridgeOperationRecapSummary  BridgeOperation = "recap_summary"
	BridgeOperationRewrite       BridgeOperation = "rewrite"
)

type BridgeMessage struct {
	Role    string
	Message string
	FileIDs []string
}

type BridgeCompletionRequest struct {
	Operation        BridgeOperation
	ClientOperation  string
	OperationSubType string
	Messages         []BridgeMessage
	JSONOutputFormat map[string]any
	UserID           string
	ChannelID        string
}

type AgentsBridge interface {
	Status(rctx request.CTX) (bool, string)
	GetAgents(sessionUserID, userID string) ([]model.BridgeAgentInfo, error)
	GetServices(sessionUserID, userID string) ([]model.BridgeServiceInfo, error)
	AgentCompletion(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error)
	ServiceCompletion(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error)
}

type liveAgentsBridge struct {
	ch *Channels
}

func newLiveAgentsBridge(ch *Channels) AgentsBridge {
	return &liveAgentsBridge{ch: ch}
}

func (b *liveAgentsBridge) Status(rctx request.CTX) (bool, string) {
	return b.getLiveStatus(rctx)
}

func (b *liveAgentsBridge) GetAgents(sessionUserID, userID string) ([]model.BridgeAgentInfo, error) {
	if available, _ := b.getLiveStatus(request.EmptyContext(b.ch.srv.Log())); !available {
		return []model.BridgeAgentInfo{}, nil
	}

	client := agentclient.NewClientFromApp(New(ServerConnector(b.ch)), sessionUserID)
	agents, err := client.GetAgents(userID)
	if err != nil {
		return nil, err
	}

	return toModelBridgeAgents(agents), nil
}

func (b *liveAgentsBridge) GetServices(sessionUserID, userID string) ([]model.BridgeServiceInfo, error) {
	if available, _ := b.getLiveStatus(request.EmptyContext(b.ch.srv.Log())); !available {
		return []model.BridgeServiceInfo{}, nil
	}

	client := agentclient.NewClientFromApp(New(ServerConnector(b.ch)), sessionUserID)
	services, err := client.GetServices(userID)
	if err != nil {
		return nil, err
	}

	return toModelBridgeServices(services), nil
}

func (b *liveAgentsBridge) AgentCompletion(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
	client := agentclient.NewClientFromApp(New(ServerConnector(b.ch)), sessionUserID)
	return client.AgentCompletion(agentID, toClientCompletionRequest(req))
}

func (b *liveAgentsBridge) ServiceCompletion(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error) {
	client := agentclient.NewClientFromApp(New(ServerConnector(b.ch)), sessionUserID)
	return client.ServiceCompletion(serviceID, toClientCompletionRequest(req))
}

func (b *liveAgentsBridge) getLiveStatus(rctx request.CTX) (bool, string) {
	pluginsEnvironment := b.ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		rctx.Logger().Debug("AI plugin bridge not available - plugin environment not initialized")
		return false, "app.agents.bridge.not_available.plugin_env_not_initialized"
	}

	if !pluginsEnvironment.IsActive(aiPluginID) {
		rctx.Logger().Debug("AI plugin bridge not available - plugin is not active or not installed",
			mlog.String("plugin_id", aiPluginID),
		)
		return false, "app.agents.bridge.not_available.plugin_not_active"
	}

	plugins := pluginsEnvironment.Active()
	for _, plugin := range plugins {
		if plugin.Manifest == nil || plugin.Manifest.Id != aiPluginID {
			continue
		}

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

	return false, "app.agents.bridge.not_available.plugin_not_registered"
}

func toModelBridgeAgents(agents []agentclient.BridgeAgentInfo) []model.BridgeAgentInfo {
	if len(agents) == 0 {
		return []model.BridgeAgentInfo{}
	}

	converted := make([]model.BridgeAgentInfo, 0, len(agents))
	for _, agent := range agents {
		converted = append(converted, model.BridgeAgentInfo{
			ID:          agent.ID,
			DisplayName: agent.DisplayName,
			Username:    agent.Username,
			ServiceID:   agent.ServiceID,
			ServiceType: agent.ServiceType,
			IsDefault:   agent.IsDefault,
		})
	}

	return converted
}

func toModelBridgeServices(services []agentclient.BridgeServiceInfo) []model.BridgeServiceInfo {
	if len(services) == 0 {
		return []model.BridgeServiceInfo{}
	}

	converted := make([]model.BridgeServiceInfo, 0, len(services))
	for _, service := range services {
		converted = append(converted, model.BridgeServiceInfo{
			ID:   service.ID,
			Name: service.Name,
			Type: service.Type,
		})
	}

	return converted
}

func toBridgeClientPosts(messages []BridgeMessage) []agentclient.Post {
	posts := make([]agentclient.Post, 0, len(messages))
	for _, message := range messages {
		posts = append(posts, agentclient.Post{
			Role:    message.Role,
			Message: message.Message,
			FileIDs: append([]string(nil), message.FileIDs...),
		})
	}

	return posts
}

func toClientCompletionRequest(req BridgeCompletionRequest) agentclient.CompletionRequest {
	return agentclient.CompletionRequest{
		Posts:            toBridgeClientPosts(req.Messages),
		JSONOutputFormat: cloneJSONOutputFormat(req.JSONOutputFormat),
		UserID:           req.UserID,
		ChannelID:        req.ChannelID,
		Operation:        req.ClientOperation,
		OperationSubType: req.OperationSubType,
	}
}

func cloneJSONOutputFormat(jsonOutputFormat map[string]any) map[string]any {
	if jsonOutputFormat == nil {
		return nil
	}

	cloned := make(map[string]any, len(jsonOutputFormat))
	for key, value := range jsonOutputFormat {
		cloned[key] = cloneJSONValue(value)
	}

	return cloned
}

func cloneJSONValue(value any) any {
	switch v := value.(type) {
	case map[string]any:
		cloned := make(map[string]any, len(v))
		for key, child := range v {
			cloned[key] = cloneJSONValue(child)
		}
		return cloned
	case []any:
		cloned := make([]any, len(v))
		for i, child := range v {
			cloned[i] = cloneJSONValue(child)
		}
		return cloned
	case []string:
		return append([]string(nil), v...)
	default:
		return v
	}
}

var _ AgentsBridge = (*liveAgentsBridge)(nil)
