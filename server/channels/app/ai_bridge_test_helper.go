// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

type aiBridgeMockResponse struct {
	completion string
	err        error
}

type aiBridgeTestHelper struct {
	mut sync.Mutex

	status           *model.AIBridgeTestHelperStatus
	agents           *[]model.BridgeAgentInfo
	services         *[]model.BridgeServiceInfo
	agentCompletions map[string][]model.AIBridgeTestHelperCompletion
	recordRequests   bool
	recordedRequests []model.AIBridgeTestHelperRecordedRequest
}

func newAIBridgeTestHelper() *aiBridgeTestHelper {
	return &aiBridgeTestHelper{
		agentCompletions: make(map[string][]model.AIBridgeTestHelperCompletion),
		recordedRequests: []model.AIBridgeTestHelperRecordedRequest{},
	}
}

func (h *aiBridgeTestHelper) SetConfig(config *model.AIBridgeTestHelperConfig) error {
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

	h.mut.Lock()
	defer h.mut.Unlock()

	h.status = cloneAIBridgeStatus(config.Status)
	h.agents = cloneBridgeAgentsPtr(config.Agents)
	h.services = cloneBridgeServicesPtr(config.Services)
	h.agentCompletions = normalizedCompletions
	h.recordRequests = config.RecordRequests != nil && *config.RecordRequests
	h.recordedRequests = []model.AIBridgeTestHelperRecordedRequest{}

	return nil
}

func (h *aiBridgeTestHelper) Reset() {
	h.mut.Lock()
	defer h.mut.Unlock()

	h.status = nil
	h.agents = nil
	h.services = nil
	h.agentCompletions = make(map[string][]model.AIBridgeTestHelperCompletion)
	h.recordRequests = false
	h.recordedRequests = []model.AIBridgeTestHelperRecordedRequest{}
}

func (h *aiBridgeTestHelper) GetState() *model.AIBridgeTestHelperState {
	h.mut.Lock()
	defer h.mut.Unlock()

	return &model.AIBridgeTestHelperState{
		Status:           cloneAIBridgeStatus(h.status),
		Agents:           cloneBridgeAgentsValue(h.agents),
		Services:         cloneBridgeServicesValue(h.services),
		AgentCompletions: cloneAIBridgeCompletions(h.agentCompletions),
		RecordRequests:   h.recordRequests,
		RecordedRequests: cloneRecordedRequests(h.recordedRequests),
	}
}

func (h *aiBridgeTestHelper) GetStatus() (*model.AIBridgeTestHelperStatus, bool) {
	h.mut.Lock()
	defer h.mut.Unlock()

	if h.status == nil {
		return nil, false
	}

	return cloneAIBridgeStatus(h.status), true
}

func (h *aiBridgeTestHelper) GetAgents() ([]model.BridgeAgentInfo, bool) {
	h.mut.Lock()
	defer h.mut.Unlock()

	if h.agents == nil {
		return nil, false
	}

	return append([]model.BridgeAgentInfo(nil), (*h.agents)...), true
}

func (h *aiBridgeTestHelper) GetServices() ([]model.BridgeServiceInfo, bool) {
	h.mut.Lock()
	defer h.mut.Unlock()

	if h.services == nil {
		return nil, false
	}

	return append([]model.BridgeServiceInfo(nil), (*h.services)...), true
}

func (h *aiBridgeTestHelper) GetCompletion(operation string) (*aiBridgeMockResponse, bool) {
	h.mut.Lock()
	defer h.mut.Unlock()

	completions, ok := h.agentCompletions[operation]
	if !ok || len(completions) == 0 {
		return nil, false
	}

	completion := completions[0]
	h.agentCompletions[operation] = completions[1:]

	if completion.Error != "" {
		if completion.StatusCode > 0 {
			return &aiBridgeMockResponse{
				err: fmt.Errorf("request failed with status %d: %s", completion.StatusCode, completion.Error),
			}, true
		}
		return &aiBridgeMockResponse{err: fmt.Errorf("%s", completion.Error)}, true
	}

	return &aiBridgeMockResponse{completion: completion.Completion}, true
}

func (h *aiBridgeTestHelper) RecordRequest(request model.AIBridgeTestHelperRecordedRequest) {
	h.mut.Lock()
	defer h.mut.Unlock()

	if !h.recordRequests {
		return
	}

	h.recordedRequests = append(h.recordedRequests, cloneRecordedRequests([]model.AIBridgeTestHelperRecordedRequest{request})...)
}

func (a *App) SetAIBridgeTestHelperConfig(config *model.AIBridgeTestHelperConfig) *model.AppError {
	if err := a.ch.aiBridgeTestHelper.SetConfig(config); err != nil {
		return model.NewAppError("SetAIBridgeTestHelperConfig", "app.ai_bridge_test_helper.invalid_config", nil, err.Error(), http.StatusBadRequest)
	}

	return nil
}

func (a *App) GetAIBridgeTestHelperState() *model.AIBridgeTestHelperState {
	return a.ch.aiBridgeTestHelper.GetState()
}

func (a *App) ResetAIBridgeTestHelper() {
	a.ch.aiBridgeTestHelper.Reset()
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
	for _, request := range recordedRequests {
		clonedRequest := request
		clonedRequest.Messages = append([]model.AIBridgeTestHelperMessage(nil), request.Messages...)
		if request.JSONOutputFormat != nil {
			clonedRequest.JSONOutputFormat = make(map[string]any, len(request.JSONOutputFormat))
			for key, value := range request.JSONOutputFormat {
				clonedRequest.JSONOutputFormat[key] = value
			}
		}
		cloned = append(cloned, clonedRequest)
	}

	return cloned
}
