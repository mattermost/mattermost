// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	app "github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAIBridgeTestHelperAdminPUTGETDELETE(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableTesting = true
	}).InitBasic(t)

	recordRequests := true
	agentID := model.NewId()
	serviceID := model.NewId()
	config := &model.AIBridgeTestHelperConfig{
		Status: &model.AIBridgeTestHelperStatus{
			Available: true,
		},
		FeatureFlags: &model.AIBridgeTestHelperFeatureFlags{
			EnableAIPluginBridge: model.NewPointer(true),
			EnableAIRecaps:       model.NewPointer(true),
		},
		Agents: []model.BridgeAgentInfo{{
			ID:          agentID,
			DisplayName: "Claude",
			Username:    "claude.bot",
			ServiceID:   serviceID,
			ServiceType: "anthropic",
			IsDefault:   true,
		}},
		Services: []model.BridgeServiceInfo{{
			ID:   serviceID,
			Name: "Anthropic",
			Type: "anthropic",
		}},
		AgentCompletions: map[string][]model.AIBridgeTestHelperCompletion{
			string(app.BridgeOperationRewrite): {{
				Completion: `{"rewritten_text":"Rewritten text"}`,
			}},
		},
		RecordRequests: &recordRequests,
	}

	state, resp, err := th.SystemAdminClient.SetAIBridgeTestHelper(context.Background(), config)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.NotNil(t, state)
	assert.True(t, state.RecordRequests)
	require.Len(t, state.Agents, 1)
	assert.Equal(t, agentID, state.Agents[0].ID)
	require.NotNil(t, state.FeatureFlags)
	require.NotNil(t, state.FeatureFlags.EnableAIPluginBridge)
	require.NotNil(t, state.FeatureFlags.EnableAIRecaps)
	assert.True(t, *state.FeatureFlags.EnableAIPluginBridge)
	assert.True(t, *state.FeatureFlags.EnableAIRecaps)

	state, resp, err = th.SystemAdminClient.GetAIBridgeTestHelper(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.NotNil(t, state)
	assert.True(t, state.Status.Available)
	require.Len(t, state.Services, 1)
	assert.Equal(t, serviceID, state.Services[0].ID)
	require.NotNil(t, state.FeatureFlags)
	assert.True(t, *state.FeatureFlags.EnableAIPluginBridge)
	assert.True(t, *state.FeatureFlags.EnableAIRecaps)

	resp, err = th.SystemAdminClient.DeleteAIBridgeTestHelper(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	state, resp, err = th.SystemAdminClient.GetAIBridgeTestHelper(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.NotNil(t, state)
	assert.Nil(t, state.Status)
	assert.Empty(t, state.Agents)
	assert.Empty(t, state.Services)
	assert.Empty(t, state.AgentCompletions)
	assert.Empty(t, state.RecordedRequests)
	assert.False(t, state.RecordRequests)
	require.NotNil(t, state.FeatureFlags)
	assert.True(t, *state.FeatureFlags.EnableAIPluginBridge)
	assert.True(t, *state.FeatureFlags.EnableAIRecaps)
}

func TestAIBridgeTestHelperRejectsNonAdmin(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableTesting = true
	}).InitBasic(t)

	_, resp, err := th.Client.SetAIBridgeTestHelper(context.Background(), &model.AIBridgeTestHelperConfig{
		Status: &model.AIBridgeTestHelperStatus{Available: true},
	})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestAIBridgeTestHelperDisabledWithoutEnableTesting(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	_, resp, err := th.SystemAdminClient.SetAIBridgeTestHelper(context.Background(), &model.AIBridgeTestHelperConfig{
		Status: &model.AIBridgeTestHelperStatus{Available: true},
	})
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestAIBridgeTestHelperMocksRealEndpoints(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableTesting = true
	}).InitBasic(t)

	recordRequests := true
	agentID := model.NewId()
	serviceID := model.NewId()
	_, resp, err := th.SystemAdminClient.SetAIBridgeTestHelper(context.Background(), &model.AIBridgeTestHelperConfig{
		Status: &model.AIBridgeTestHelperStatus{
			Available: true,
		},
		FeatureFlags: &model.AIBridgeTestHelperFeatureFlags{
			EnableAIPluginBridge: model.NewPointer(true),
			EnableAIRecaps:       model.NewPointer(true),
		},
		Agents: []model.BridgeAgentInfo{{
			ID:          agentID,
			DisplayName: "Claude",
			Username:    "claude.bot",
			ServiceID:   serviceID,
			ServiceType: "anthropic",
			IsDefault:   true,
		}},
		Services: []model.BridgeServiceInfo{{
			ID:   serviceID,
			Name: "Anthropic",
			Type: "anthropic",
		}},
		AgentCompletions: map[string][]model.AIBridgeTestHelperCompletion{
			string(app.BridgeOperationRewrite): {{
				Completion: `{"rewritten_text":"Polished text"}`,
			}},
		},
		RecordRequests: &recordRequests,
	})
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.True(t, th.App.Config().FeatureFlags.EnableAIPluginBridge)
	assert.True(t, th.App.Config().FeatureFlags.EnableAIRecaps)

	statusResp, httpResp, err := getAPIResponse[model.AgentsIntegrityResponse](t, th.Client, "/agents/status")
	require.NoError(t, err)
	CheckOKStatus(t, httpResp)
	assert.True(t, statusResp.Available)

	agentsResp, httpResp, err := getAPIResponse[[]model.BridgeAgentInfo](t, th.Client, "/agents")
	require.NoError(t, err)
	CheckOKStatus(t, httpResp)
	require.Len(t, agentsResp, 1)
	assert.Equal(t, agentID, agentsResp[0].ID)

	servicesResp, httpResp, err := getAPIResponse[[]model.BridgeServiceInfo](t, th.Client, "/llmservices")
	require.NoError(t, err)
	CheckOKStatus(t, httpResp)
	require.Len(t, servicesResp, 1)
	assert.Equal(t, serviceID, servicesResp[0].ID)

	rewriteReq := &model.RewriteRequest{
		AgentID: agentID,
		Message: "the status update",
		Action:  model.RewriteActionFixSpelling,
	}

	rewriteHTTPResp, err := th.Client.DoAPIPostJSON(context.Background(), "/posts/rewrite", rewriteReq)
	require.NoError(t, err)
	defer rewriteHTTPResp.Body.Close()

	rewriteResp, rewriteModelResp, err := model.DecodeJSONFromResponse[model.RewriteResponse](rewriteHTTPResp)
	require.NoError(t, err)
	CheckOKStatus(t, rewriteModelResp)
	assert.Equal(t, "Polished text", rewriteResp.RewrittenText)

	state, helperResp, err := th.SystemAdminClient.GetAIBridgeTestHelper(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, helperResp)
	require.Len(t, state.RecordedRequests, 1)
	assert.Equal(t, string(app.BridgeOperationRewrite), state.RecordedRequests[0].Operation)
	assert.Equal(t, agentID, state.RecordedRequests[0].AgentID)
}

func getAPIResponse[T any](tb testing.TB, client *model.Client4, route string) (T, *model.Response, error) {
	tb.Helper()

	httpResp, err := client.DoAPIGet(context.Background(), route, "")
	if err != nil {
		var zero T
		return zero, model.BuildResponse(httpResp), err
	}
	defer httpResp.Body.Close()

	return model.DecodeJSONFromResponse[T](httpResp)
}
