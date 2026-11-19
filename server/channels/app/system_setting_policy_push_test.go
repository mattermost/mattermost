// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func mockStoredSystemSettingPolicies(th *TestHelper, mockACS *mocks.AccessControlServiceInterface) {
	policyStore := th.App.Srv().Store().AccessControlPolicy()

	mockACS.On("SavePolicy", mock.Anything, mock.AnythingOfType("*model.AccessControlPolicy")).
		Return(func(rctx request.CTX, p *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError) {
			saved, err := policyStore.Save(rctx, p)
			if err != nil {
				return nil, model.NewAppError("SavePolicy", "app.pap.save_policy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return saved, nil
		}).Maybe()

	mockACS.On("GetPolicy", mock.Anything, mock.AnythingOfType("string")).
		Return(func(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError) {
			p, err := policyStore.Get(rctx, id)
			if err != nil {
				return nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusNotFound).Wrap(err)
			}
			return p, nil
		}).Maybe()

	mockACS.On("DeletePolicy", mock.Anything, mock.AnythingOfType("string")).
		Return(func(rctx request.CTX, id string) *model.AppError {
			if err := policyStore.Delete(rctx, id); err != nil {
				return model.NewAppError("DeletePolicy", "app.pap.delete_policy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return nil
		}).Maybe()
}

// systemSettingPolicyEngine evaluates the stored version of a policy, matching
// each rule expression against the user or session IDs registered for it.
type systemSettingPolicyEngine struct {
	th *TestHelper

	mu                 sync.Mutex
	matches            map[string]map[string]bool
	failing            map[string]map[string]bool
	evaluations        map[string]int
	versionEvaluations map[systemSettingEvaluation]int
}

type systemSettingEvaluation struct {
	sessionID, expression, value string
}

func (e *systemSettingPolicyEngine) evaluate(rctx request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
	policy, err := e.th.App.Srv().Store().AccessControlPolicy().Get(rctx, req.Resource.ID)
	if err != nil {
		return model.AccessDecision{}, nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	e.evaluations[req.Resource.ID]++
	sessionID := rctx.Session().Id
	for _, rule := range policy.Rules {
		if rule.Actions[0] != req.Action {
			continue
		}
		e.versionEvaluations[systemSettingEvaluation{sessionID, rule.Expression, rule.Value}]++
		if e.failing[rule.Expression][sessionID] {
			return model.AccessDecision{}, model.NewAppError("AccessEvaluation", "app.pap.access_evaluation.app_error", nil, "", http.StatusInternalServerError)
		}
		matched := e.matches[rule.Expression]
		return model.AccessDecision{Decision: matched[req.Subject.ID] || matched[sessionID]}, nil
	}
	return model.AccessDecision{}, nil
}

func enableSystemSettingPolicyEngine(t *testing.T, th *TestHelper) (*systemSettingPolicyEngine, request.CTX) {
	t.Helper()
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
		cfg.FeatureFlags.SystemSettingPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	engine := &systemSettingPolicyEngine{
		th:                 th,
		matches:            map[string]map[string]bool{},
		failing:            map[string]map[string]bool{},
		evaluations:        map[string]int{},
		versionEvaluations: map[systemSettingEvaluation]int{},
	}
	mockACS := &mocks.AccessControlServiceInterface{}
	mockStoredSystemSettingPolicies(th, mockACS)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(engine.evaluate).Maybe()
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() {
		th.App.Srv().Channels().AccessControl = nil
		th.App.invalidateSystemSettingPolicyCache()
	})

	adminCtx := request.EmptyContext(th.Server.Log()).WithSession(&model.Session{
		Id:     model.NewId(),
		UserId: th.SystemAdminUser.Id,
		Roles:  th.SystemAdminUser.GetRawRoles(),
	})
	return engine, adminCtx
}

func biometricsPolicy(expression string) *model.AccessControlPolicy {
	return &model.AccessControlPolicy{
		Name:  "Biometrics " + model.NewId(),
		Type:  model.AccessControlPolicyTypeSystemSetting,
		Roles: []string{model.SystemUserRoleId},
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
			Expression: expression,
			Value:      "true",
		}},
	}
}

type replicaLagPoliciesStore struct {
	store.Store
	policies *replicaLagPolicyStore
}

func (s *replicaLagPoliciesStore) AccessControlPolicy() store.AccessControlPolicyStore {
	return s.policies
}
