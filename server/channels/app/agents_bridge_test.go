// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type bridgeCompleteCall struct {
	sessionUserID string
	agentID       string
	serviceID     string
	request       BridgeCompletionRequest
}

type testAgentsBridge struct {
	statusAvailable bool
	statusReason    string
	statusFn        func(rctx request.CTX) (bool, string)
	getAgentsFn     func(sessionUserID, userID string) ([]model.BridgeAgentInfo, error)
	getServicesFn   func(sessionUserID, userID string) ([]model.BridgeServiceInfo, error)
	completeFn      func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error)
	completeSvcFn   func(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error)

	completeCalls []bridgeCompleteCall
}

func (b *testAgentsBridge) Status(rctx request.CTX) (bool, string) {
	if b.statusFn != nil {
		return b.statusFn(rctx)
	}

	return b.statusAvailable, b.statusReason
}

func (b *testAgentsBridge) GetAgents(sessionUserID, userID string) ([]model.BridgeAgentInfo, error) {
	if b.getAgentsFn != nil {
		return b.getAgentsFn(sessionUserID, userID)
	}

	return []model.BridgeAgentInfo{}, nil
}

func (b *testAgentsBridge) GetServices(sessionUserID, userID string) ([]model.BridgeServiceInfo, error) {
	if b.getServicesFn != nil {
		return b.getServicesFn(sessionUserID, userID)
	}

	return []model.BridgeServiceInfo{}, nil
}

func (b *testAgentsBridge) AgentCompletion(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
	b.completeCalls = append(b.completeCalls, bridgeCompleteCall{
		sessionUserID: sessionUserID,
		agentID:       agentID,
		request:       req,
	})

	if b.completeFn != nil {
		return b.completeFn(sessionUserID, agentID, req)
	}

	return "", nil
}

func (b *testAgentsBridge) ServiceCompletion(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error) {
	b.completeCalls = append(b.completeCalls, bridgeCompleteCall{
		sessionUserID: sessionUserID,
		serviceID:     serviceID,
		request:       req,
	})

	if b.completeSvcFn != nil {
		return b.completeSvcFn(sessionUserID, serviceID, req)
	}

	return "", nil
}

func TestServiceCompletionUsesAgentsBridge(t *testing.T) {
	bridge := &testAgentsBridge{
		completeSvcFn: func(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error) {
			return "translated", nil
		},
	}

	th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)

	completion, err := th.App.ServiceCompletion("", "service-id", BridgeCompletionRequest{
		Operation:        BridgeOperationAutoTranslate,
		ClientOperation:  string(BridgeOperationAutoTranslate),
		OperationSubType: "translate",
		Messages: []BridgeMessage{
			{Role: "user", Message: "hola"},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "translated", completion)
	require.Len(t, bridge.completeCalls, 1)
	assert.Equal(t, "service-id", bridge.completeCalls[0].serviceID)
	assert.Equal(t, BridgeOperationAutoTranslate, bridge.completeCalls[0].request.Operation)
	assert.Equal(t, "translate", bridge.completeCalls[0].request.OperationSubType)
}

func TestSetAIBridgeTestHelperSwapsBridge(t *testing.T) {
	th := Setup(t).InitBasic(t)

	recordRequests := true
	config := &model.AIBridgeTestHelperConfig{
		Status: &model.AIBridgeTestHelperStatus{Available: true},
		Agents: []model.BridgeAgentInfo{{
			ID: "agent-1", DisplayName: "Test Agent", Username: "test.agent",
			ServiceID: "svc-1", ServiceType: "openai", IsDefault: true,
		}},
		Services: []model.BridgeServiceInfo{{
			ID: "svc-1", Name: "Test Service", Type: "openai",
		}},
		AgentCompletions: map[string][]model.AIBridgeTestHelperCompletion{
			string(BridgeOperationRewrite): {{Completion: "rewritten"}},
		},
		RecordRequests: &recordRequests,
	}

	appErr := th.App.SetAIBridgeTestHelperConfig(config)
	require.Nil(t, appErr)

	_, ok := th.App.Channels().agentsBridge.(*e2eAgentsBridge)
	assert.True(t, ok, "bridge should be e2eAgentsBridge after SetAIBridgeTestHelperConfig")

	rctx := request.EmptyContext(th.App.Srv().Log())
	available, _ := th.App.Channels().agentsBridge.Status(rctx)
	assert.True(t, available)

	agents, err := th.App.Channels().agentsBridge.GetAgents("", "")
	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, "agent-1", agents[0].ID)

	services, err := th.App.Channels().agentsBridge.GetServices("", "")
	require.NoError(t, err)
	require.Len(t, services, 1)
	assert.Equal(t, "svc-1", services[0].ID)

	completion, err := th.App.Channels().agentsBridge.AgentCompletion("", "agent-1", BridgeCompletionRequest{
		Operation: BridgeOperationRewrite,
	})
	require.NoError(t, err)
	assert.Equal(t, "rewritten", completion)

	state := th.App.GetAIBridgeTestHelperState()
	require.Len(t, state.RecordedRequests, 1)
	assert.Equal(t, string(BridgeOperationRewrite), state.RecordedRequests[0].Operation)
	assert.Equal(t, "agent-1", state.RecordedRequests[0].AgentID)
}

func TestResetAIBridgeTestHelperRestoresLiveBridge(t *testing.T) {
	th := Setup(t).InitBasic(t)

	config := &model.AIBridgeTestHelperConfig{
		Status: &model.AIBridgeTestHelperStatus{Available: true},
	}

	appErr := th.App.SetAIBridgeTestHelperConfig(config)
	require.Nil(t, appErr)

	_, ok := th.App.Channels().agentsBridge.(*e2eAgentsBridge)
	require.True(t, ok)

	th.App.ResetAIBridgeTestHelper()

	_, ok = th.App.Channels().agentsBridge.(*e2eAgentsBridge)
	assert.False(t, ok, "bridge should be restored to live after reset")

	state := th.App.GetAIBridgeTestHelperState()
	assert.Nil(t, state.Status)
	assert.Empty(t, state.Agents)
	assert.Empty(t, state.RecordedRequests)
}

var _ AgentsBridge = (*testAgentsBridge)(nil)
