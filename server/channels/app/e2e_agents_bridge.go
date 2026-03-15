// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"maps"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type e2eAgentsBridge struct {
	mut sync.Mutex

	status           *model.AIBridgeTestHelperStatus
	agents           *[]model.BridgeAgentInfo
	services         *[]model.BridgeServiceInfo
	agentCompletions map[string][]model.AIBridgeTestHelperCompletion
	recordRequests   bool
	recordedRequests []model.AIBridgeTestHelperRecordedRequest
}

func newE2EAgentsBridge(config *model.AIBridgeTestHelperConfig) (*e2eAgentsBridge, error) {
	b := &e2eAgentsBridge{
		agentCompletions: make(map[string][]model.AIBridgeTestHelperCompletion),
		recordedRequests: []model.AIBridgeTestHelperRecordedRequest{},
	}
	if err := b.setConfig(config); err != nil {
		return nil, err
	}
	return b, nil
}

func (b *e2eAgentsBridge) setConfig(config *model.AIBridgeTestHelperConfig) error {
	if config == nil {
		return fmt.Errorf("config cannot be nil")
	}

	normalizedCompletions := make(map[string][]model.AIBridgeTestHelperCompletion, len(config.AgentCompletions))
	for operation, completions := range config.AgentCompletions {
		if operation == "" {
			return fmt.Errorf("agent completion operation key cannot be empty")
		}

		normalizedCompletions[operation] = make([]model.AIBridgeTestHelperCompletion, 0, len(completions))
		for idx, completion := range completions {
			hasCompletion := completion.Completion != ""
			hasError := completion.Error != ""
			if hasCompletion == hasError {
				return fmt.Errorf("agent completion %q at index %d must set exactly one of completion or error", operation, idx)
			}
			if hasError && completion.StatusCode == 0 {
				completion.StatusCode = http.StatusInternalServerError
			}
			normalizedCompletions[operation] = append(normalizedCompletions[operation], completion)
		}
	}

	for idx, agent := range config.Agents {
		if agent.ID == "" {
			return fmt.Errorf("agent at index %d is missing id", idx)
		}
		if agent.Username == "" {
			return fmt.Errorf("agent %q is missing username", agent.ID)
		}
	}

	for idx, service := range config.Services {
		if service.ID == "" {
			return fmt.Errorf("service at index %d is missing id", idx)
		}
		if service.Name == "" {
			return fmt.Errorf("service %q is missing name", service.ID)
		}
	}

	b.mut.Lock()
	defer b.mut.Unlock()

	b.status = cloneAIBridgeStatus(config.Status)
	b.agents = cloneBridgeAgentsPtr(config.Agents)
	b.services = cloneBridgeServicesPtr(config.Services)
	b.agentCompletions = normalizedCompletions
	b.recordRequests = config.RecordRequests != nil && *config.RecordRequests
	b.recordedRequests = []model.AIBridgeTestHelperRecordedRequest{}

	return nil
}

func (b *e2eAgentsBridge) GetState() *model.AIBridgeTestHelperState {
	b.mut.Lock()
	defer b.mut.Unlock()

	return &model.AIBridgeTestHelperState{
		Status:           cloneAIBridgeStatus(b.status),
		Agents:           cloneBridgeAgentsValue(b.agents),
		Services:         cloneBridgeServicesValue(b.services),
		AgentCompletions: cloneAIBridgeCompletions(b.agentCompletions),
		RecordRequests:   b.recordRequests,
		RecordedRequests: cloneRecordedRequests(b.recordedRequests),
	}
}

func (b *e2eAgentsBridge) Status(_ request.CTX) (bool, string) {
	b.mut.Lock()
	defer b.mut.Unlock()

	if b.status == nil {
		return true, ""
	}

	return b.status.Available, b.status.Reason
}

func (b *e2eAgentsBridge) GetAgents(_, _ string) ([]model.BridgeAgentInfo, error) {
	b.mut.Lock()
	defer b.mut.Unlock()

	if b.agents == nil {
		return []model.BridgeAgentInfo{}, nil
	}

	return append([]model.BridgeAgentInfo(nil), (*b.agents)...), nil
}

func (b *e2eAgentsBridge) GetServices(_, _ string) ([]model.BridgeServiceInfo, error) {
	b.mut.Lock()
	defer b.mut.Unlock()

	if b.services == nil {
		return []model.BridgeServiceInfo{}, nil
	}

	return append([]model.BridgeServiceInfo(nil), (*b.services)...), nil
}

func (b *e2eAgentsBridge) AgentCompletion(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
	b.mut.Lock()
	defer b.mut.Unlock()

	b.recordRequestLocked(sessionUserID, agentID, "", req)
	return b.getCompletionLocked(string(req.Operation))
}

func (b *e2eAgentsBridge) ServiceCompletion(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error) {
	b.mut.Lock()
	defer b.mut.Unlock()

	b.recordRequestLocked(sessionUserID, "", serviceID, req)
	return b.getCompletionLocked(string(req.Operation))
}

func (b *e2eAgentsBridge) getCompletionLocked(operation string) (string, error) {
	completions, ok := b.agentCompletions[operation]
	if !ok || len(completions) == 0 {
		return "", nil
	}

	completion := completions[0]
	b.agentCompletions[operation] = completions[1:]

	if completion.Error != "" {
		if completion.StatusCode > 0 {
			return "", fmt.Errorf("request failed with status %d: %s", completion.StatusCode, completion.Error)
		}
		return "", fmt.Errorf("%s", completion.Error)
	}

	return completion.Completion, nil
}

func (b *e2eAgentsBridge) recordRequestLocked(sessionUserID, agentID, serviceID string, req BridgeCompletionRequest) {
	if !b.recordRequests {
		return
	}

	recorded := model.AIBridgeTestHelperRecordedRequest{
		Operation:        string(req.Operation),
		ClientOperation:  req.ClientOperation,
		OperationSubType: req.OperationSubType,
		SessionUserID:    sessionUserID,
		UserID:           req.UserID,
		ChannelID:        req.ChannelID,
		AgentID:          agentID,
		ServiceID:        serviceID,
		Messages:         toE2ERecordedMessages(req.Messages),
		JSONOutputFormat: cloneJSONOutputFormat(req.JSONOutputFormat),
	}

	b.recordedRequests = append(b.recordedRequests, recorded)
}

func toE2ERecordedMessages(messages []BridgeMessage) []model.AIBridgeTestHelperMessage {
	recorded := make([]model.AIBridgeTestHelperMessage, 0, len(messages))
	for _, message := range messages {
		recorded = append(recorded, model.AIBridgeTestHelperMessage{
			Role:    message.Role,
			Message: message.Message,
			FileIDs: append([]string(nil), message.FileIDs...),
		})
	}

	return recorded
}

func cloneAIBridgeStatus(status *model.AIBridgeTestHelperStatus) *model.AIBridgeTestHelperStatus {
	if status == nil {
		return nil
	}

	cloned := *status
	return &cloned
}

func cloneBridgeAgentsPtr(agents []model.BridgeAgentInfo) *[]model.BridgeAgentInfo {
	if agents == nil {
		return nil
	}

	cloned := append([]model.BridgeAgentInfo(nil), agents...)
	return &cloned
}

func cloneBridgeServicesPtr(services []model.BridgeServiceInfo) *[]model.BridgeServiceInfo {
	if services == nil {
		return nil
	}

	cloned := append([]model.BridgeServiceInfo(nil), services...)
	return &cloned
}

func cloneBridgeAgentsValue(agents *[]model.BridgeAgentInfo) []model.BridgeAgentInfo {
	if agents == nil {
		return nil
	}

	return append([]model.BridgeAgentInfo(nil), (*agents)...)
}

func cloneBridgeServicesValue(services *[]model.BridgeServiceInfo) []model.BridgeServiceInfo {
	if services == nil {
		return nil
	}

	return append([]model.BridgeServiceInfo(nil), (*services)...)
}

func cloneAIBridgeCompletions(agentCompletions map[string][]model.AIBridgeTestHelperCompletion) map[string][]model.AIBridgeTestHelperCompletion {
	if agentCompletions == nil {
		return nil
	}

	cloned := make(map[string][]model.AIBridgeTestHelperCompletion, len(agentCompletions))
	for key, value := range agentCompletions {
		cloned[key] = append([]model.AIBridgeTestHelperCompletion(nil), value...)
	}

	return cloned
}

func cloneRecordedRequests(recordedRequests []model.AIBridgeTestHelperRecordedRequest) []model.AIBridgeTestHelperRecordedRequest {
	if recordedRequests == nil {
		return nil
	}

	cloned := make([]model.AIBridgeTestHelperRecordedRequest, 0, len(recordedRequests))
	for _, req := range recordedRequests {
		clonedReq := req
		clonedReq.Messages = append([]model.AIBridgeTestHelperMessage(nil), req.Messages...)
		if req.JSONOutputFormat != nil {
			clonedReq.JSONOutputFormat = make(map[string]any, len(req.JSONOutputFormat))
			maps.Copy(clonedReq.JSONOutputFormat, req.JSONOutputFormat)
		}
		cloned = append(cloned, clonedReq)
	}

	return cloned
}

var _ AgentsBridge = (*e2eAgentsBridge)(nil)
