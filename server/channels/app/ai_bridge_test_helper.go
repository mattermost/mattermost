// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) SetAIBridgeTestHelperConfig(config *model.AIBridgeTestHelperConfig) *model.AppError {
	bridge, err := newE2EAgentsBridge(config)
	if err != nil {
		return model.NewAppError("SetAIBridgeTestHelperConfig", "app.ai_bridge_test_helper.invalid_config", nil, err.Error(), http.StatusBadRequest)
	}

	a.ch.SetAgentsBridge(bridge)

	if config.FeatureFlags != nil {
		if appErr := a.setAIBridgeTestHelperFeatureFlags(config.FeatureFlags); appErr != nil {
			return appErr
		}
	}

	return nil
}

func (a *App) GetAIBridgeTestHelperState() *model.AIBridgeTestHelperState {
	var state *model.AIBridgeTestHelperState

	if e2e, ok := a.ch.agentsBridge.(*e2eAgentsBridge); ok {
		state = e2e.GetState()
	} else {
		state = &model.AIBridgeTestHelperState{
			RecordedRequests: []model.AIBridgeTestHelperRecordedRequest{},
		}
	}

	state.FeatureFlags = &model.AIBridgeTestHelperFeatureFlags{
		EnableAIPluginBridge: model.NewPointer(a.Config().FeatureFlags.EnableAIPluginBridge),
		EnableAIRecaps:       model.NewPointer(a.Config().FeatureFlags.EnableAIRecaps),
	}

	return state
}

func (a *App) ResetAIBridgeTestHelper() {
	a.ch.SetAgentsBridge(newLiveAgentsBridge(a.ch))
}

func (a *App) setAIBridgeTestHelperFeatureFlags(featureFlags *model.AIBridgeTestHelperFeatureFlags) *model.AppError {
	configStore := a.Srv().Platform().GetConfigStore()
	configStore.SetReadOnlyFF(false)
	defer configStore.SetReadOnlyFF(true)

	a.UpdateConfig(func(cfg *model.Config) {
		if featureFlags.EnableAIPluginBridge != nil {
			cfg.FeatureFlags.EnableAIPluginBridge = *featureFlags.EnableAIPluginBridge
		}
		if featureFlags.EnableAIRecaps != nil {
			cfg.FeatureFlags.EnableAIRecaps = *featureFlags.EnableAIRecaps
		}
	})

	return nil
}
