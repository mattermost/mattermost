// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const mattermostAIPluginID = "mattermost-ai"

// AgentRequest makes a streaming request to an LLM agent via the mattermost-ai plugin.
func (a *App) AgentRequest(rctx request.CTX, agent string, request plugin.CompletionRequest) (*llm.TextStreamResult, error) {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), mattermostAIPluginID)
	if err != nil {
		return nil, fmt.Errorf("cannot call AgentRequest on plugin %s: %w", mattermostAIPluginID, err)
	}

	pluginContext := pluginContext(rctx)
	return pluginHooks.AgentRequest(pluginContext, agent, request)
}

// AgentRequestNoStream makes a non-streaming request to an LLM agent via the mattermost-ai plugin.
func (a *App) AgentRequestNoStream(rctx request.CTX, agent string, request plugin.CompletionRequest) (string, error) {
	fmt.Println("AgentNoStream called app/llm.go")
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), mattermostAIPluginID)
	if err != nil {
		fmt.Println("Error getting plugin hooks:", err)
		return "", fmt.Errorf("cannot call AgentRequestNoStream on plugin %s: %w", mattermostAIPluginID, err)
	}

	fmt.Println("Got plugin hooks:", pluginHooks)
	fmt.Println("Error is nil right:", err)

	pluginContext := pluginContext(rctx)
	fmt.Println(pluginHooks.Implemented())
	return pluginHooks.AgentRequestNoStream(pluginContext, agent, request)
}

// LLMServiceRequest makes a streaming request to an LLM service via the mattermost-ai plugin.
func (a *App) LLMServiceRequest(rctx request.CTX, service string, request plugin.CompletionRequest) (*llm.TextStreamResult, error) {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), mattermostAIPluginID)
	if err != nil {
		return nil, fmt.Errorf("cannot call LLMServiceRequest on plugin %s: %w", mattermostAIPluginID, err)
	}

	pluginContext := pluginContext(rctx)
	return pluginHooks.LLMServiceRequest(pluginContext, service, request)
}

// LLMServiceRequestNoStream makes a non-streaming request to an LLM service via the mattermost-ai plugin.
func (a *App) LLMServiceRequestNoStream(rctx request.CTX, service string, request plugin.CompletionRequest) (string, error) {
	pluginHooks, err := getPluginHooks(a.GetPluginsEnvironment(), mattermostAIPluginID)
	if err != nil {
		return "", fmt.Errorf("cannot call LLMServiceRequestNoStream on plugin %s: %w", mattermostAIPluginID, err)
	}

	pluginContext := pluginContext(rctx)
	return pluginHooks.LLMServiceRequestNoStream(pluginContext, service, request)
}
