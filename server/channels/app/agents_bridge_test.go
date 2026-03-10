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

func (b *testAgentsBridge) Complete(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
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

func (b *testAgentsBridge) CompleteService(sessionUserID, serviceID string, req BridgeCompletionRequest) (string, error) {
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

var _ AgentsBridge = (*testAgentsBridge)(nil)
