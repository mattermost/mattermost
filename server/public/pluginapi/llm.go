package pluginapi

import (
	"github.com/mattermost/mattermost-plugin-ai/llm"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// LLMService exposes methods to interact with LLM agents and services via the mattermost-ai plugin.
type LLMService struct {
	api plugin.API
}

// Agent makes a streaming request to an LLM agent via the mattermost-ai plugin.
//
// Minimum server version: 11.3
func (l *LLMService) Agent(agent string, request plugin.CompletionRequest) (*llm.TextStreamResult, error) {
	result, err := l.api.Agent(agent, request)
	return result, err
}

// AgentNoStream makes a non-streaming request to an LLM agent via the mattermost-ai plugin.
//
// Minimum server version: 11.3
func (l *LLMService) AgentNoStream(agent string, request plugin.CompletionRequest) (string, error) {
	result, err := l.api.AgentNoStream(agent, request)
	return result, err
}

// LLMService makes a streaming request to an LLM service via the mattermost-ai plugin.
//
// Minimum server version: 11.3
func (l *LLMService) LLMService(service string, request plugin.CompletionRequest) (*llm.TextStreamResult, error) {
	result, err := l.api.LLMService(service, request)
	return result, err
}

// LLMServiceNoStream makes a non-streaming request to an LLM service via the mattermost-ai plugin.
//
// Minimum server version: 11.3
func (l *LLMService) LLMServiceNoStream(service string, request plugin.CompletionRequest) (string, error) {
	result, err := l.api.LLMServiceNoStream(service, request)
	return result, err
}
