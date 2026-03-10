// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type bridgeCompleteCall struct {
	sessionUserID string
	agentID       string
	request       BridgeCompletionRequest
}

type testAgentsBridge struct {
	statusAvailable bool
	statusReason    string
	statusFn        func(rctx request.CTX) (bool, string)
	getAgentsFn     func(sessionUserID, userID string) ([]model.BridgeAgentInfo, error)
	getServicesFn   func(sessionUserID, userID string) ([]model.BridgeServiceInfo, error)
	completeFn      func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error)

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

var _ AgentsBridge = (*testAgentsBridge)(nil)
