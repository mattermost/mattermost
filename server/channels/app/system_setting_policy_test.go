// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestExpressionReferencesResourceRoot(t *testing.T) {
	cases := []struct {
		name string
		expr string
		want bool
	}{
		{name: "direct resource attributes", expr: `resource.attributes.region == "us"`, want: true},
		{name: "whitespace around dot", expr: `user.attributes.dept == "eng" && resource . attributes.region == "us"`, want: true},
		{name: "string literal double quotes", expr: `user.attributes.dept == "resource.attributes.region"`, want: false},
		{name: "string literal single quotes", expr: `user.attributes.dept == 'resource.attributes.region'`, want: false},
		{name: "escaped quote inside literal", expr: `user.attributes.dept == "foo\"resource.attributes"`, want: false},
		{name: "field named resource under user", expr: `user.attributes.resource.name == "x"`, want: false},
		{name: "identifier prefix resource_type", expr: `user.session.resource_type == "mobile"`, want: false},
		{name: "normal user and session expression", expr: `user.attributes.dept == "finance" && user.session.vpn_active == "true"`, want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, expressionReferencesResourceRoot(tc.expr))
		})
	}
}

func policiesOfType(policies []*model.AccessControlPolicy, policyType string) []*model.AccessControlPolicy {
	var result []*model.AccessControlPolicy
	for _, p := range policies {
		if p.Type == policyType {
			result = append(result, p)
		}
	}
	return result
}

type staticPolicyStore struct {
	store.AccessControlPolicyStore

	mu       sync.Mutex
	policies []*model.AccessControlPolicy
}

func (s *staticPolicyStore) set(policies ...*model.AccessControlPolicy) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.policies = policies
}

func (s *staticPolicyStore) GetByType(_ request.CTX, policyType string, _ model.AccessControlPolicyCursor, _ int) ([]*model.AccessControlPolicy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return policiesOfType(s.policies, policyType), nil
}

// system_setting policies read without pinning the master come from replica,
// which SearchPolicies always reads.
type replicaLagPolicyStore struct {
	store.AccessControlPolicyStore
	replica []*model.AccessControlPolicy
}

func (s *replicaLagPolicyStore) GetByType(rctx request.CTX, policyType string, cursor model.AccessControlPolicyCursor, limit int) ([]*model.AccessControlPolicy, error) {
	if store.HasMaster(rctx.Context()) {
		return s.AccessControlPolicyStore.GetByType(rctx, policyType, cursor, limit)
	}
	return policiesOfType(s.replica, policyType), nil
}

func (s *replicaLagPolicyStore) SearchPolicies(rctx request.CTX, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, error) {
	if opts.Type != model.AccessControlPolicyTypeSystemSetting {
		return s.AccessControlPolicyStore.SearchPolicies(rctx, opts)
	}
	policies := policiesOfType(s.replica, opts.Type)
	return policies, int64(len(policies)), nil
}

func TestSystemSettingPolicyCache(t *testing.T) {
	rctx := request.TestContext(t)
	policy := func(id, value string) *model.AccessControlPolicy {
		return &model.AccessControlPolicy{
			ID:    id,
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      value,
			}},
		}
	}
	values := func(policies []cachedSystemSettingPolicy) []string {
		result := make([]string, 0, len(policies))
		for _, p := range policies {
			for _, rule := range p.Rules {
				result = append(result, p.ID+"="+rule.Value)
			}
		}
		return result
	}

	t.Run("reloads from the master after an invalidation", func(t *testing.T) {
		id := model.NewId()
		saved := policy(id, "true")
		primary := &staticPolicyStore{policies: []*model.AccessControlPolicy{saved}}
		policyStore := &replicaLagPolicyStore{AccessControlPolicyStore: primary, replica: []*model.AccessControlPolicy{saved}}
		cache := newSystemSettingPolicyCache()
		policies, err := cache.Get(rctx, policyStore)
		require.NoError(t, err)
		require.Equal(t, []string{id + "=true"}, values(policies))

		primary.set(policy(id, "false"))
		cache.Invalidate()

		policies, err = cache.Get(rctx, policyStore)
		require.NoError(t, err)
		assert.Equal(t, []string{id + "=false"}, values(policies))
	})

	t.Run("ignores policies stored by a load from before the latest invalidation", func(t *testing.T) {
		id := model.NewId()
		primary := &staticPolicyStore{policies: []*model.AccessControlPolicy{policy(id, "true")}}
		cache := newSystemSettingPolicyCache()
		_, err := cache.Get(rctx, primary)
		require.NoError(t, err)

		stale := cache.entries.Load()
		primary.set(policy(id, "false"))
		cache.Invalidate()
		cache.entries.Store(stale)

		policies, err := cache.Get(rctx, primary)
		require.NoError(t, err)
		assert.Equal(t, []string{id + "=false"}, values(policies))
	})
}

func TestEvaluateClientConfigOverrides(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	enableSystemSettingABAC := func(t *testing.T) *mocks.AccessControlServiceInterface {
		t.Helper()
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = false
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().Channels().AccessControl = nil
			th.App.invalidateSystemSettingPolicyCache()
		})
		return mockACS
	}

	saveStoredPolicy := func(t *testing.T, policy *model.AccessControlPolicy) *model.AccessControlPolicy {
		t.Helper()
		saved, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		th.App.invalidateSystemSettingPolicyCache()
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, saved.ID)
			th.App.invalidateSystemSettingPolicyCache()
		})
		return saved
	}

	sessionCtx := func(user *model.User) request.CTX {
		return request.EmptyContext(th.Server.Log()).WithSession(&model.Session{
			Id:     model.NewId(),
			UserId: user.Id,
			Roles:  user.GetRawRoles(),
		})
	}

	t.Run("returns empty map when unlicensed, ABAC disabled, or flag disabled", func(t *testing.T) {
		_ = enableSystemSettingABAC(t)
		saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Biometrics Policy",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      "true",
			}},
		})

		rctx := sessionCtx(th.BasicUser)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = false
		})
		overrides, appErr := th.App.EvaluateClientConfigOverrides(rctx)
		require.Nil(t, appErr)
		assert.Empty(t, overrides)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(false)
		})
		overrides, appErr = th.App.EvaluateClientConfigOverrides(rctx)
		require.Nil(t, appErr)
		assert.Empty(t, overrides)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		overrides, appErr = th.App.EvaluateClientConfigOverrides(rctx)
		require.Nil(t, appErr)
		assert.Empty(t, overrides)
	})

	t.Run("evaluates matching policy and respects role fallback", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		policy := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Biometrics for Members",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: `user.attributes.dept == "finance"`,
				Value:      "true",
			}},
		})

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == policy.ID &&
				req.Resource.Type == model.AccessControlPolicyTypeSystemSetting &&
				req.Action == model.ClientConfigKeyMobileEnableBiometrics &&
				req.Subject.ID == th.BasicUser.Id
		})).Return(model.AccessDecision{Decision: true}, nil).Once()

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == th.BasicUser2.Id
		})).Return(model.AccessDecision{Decision: false}, nil).Once()

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == th.SystemAdminUser.Id
		})).Return(model.AccessDecision{Decision: true}, nil).Once()

		overrides, appErr := th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser2))
		require.Nil(t, appErr)
		assert.Empty(t, overrides)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.SystemAdminUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides)

		guest := th.CreateGuest(t)
		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(guest))
		require.Nil(t, appErr)
		assert.Empty(t, overrides)

		mockACS.AssertExpectations(t)
	})

	t.Run("system_bot policies apply only to bots, which also receive system_user policies", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username: "settingpolicybot" + model.NewId()[:6],
			OwnerId:  th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		t.Cleanup(func() { _ = th.App.PermanentDeleteBot(th.Context, bot.UserId) })
		botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
		require.Nil(t, appErr)

		biometricsFor := func(role, value string) *model.AccessControlPolicy {
			return &model.AccessControlPolicy{
				ID:      model.NewId(),
				Name:    "Biometrics for " + role,
				Type:    model.AccessControlPolicyTypeSystemSetting,
				Version: model.AccessControlPolicyVersionV0_3,
				Roles:   []string{role},
				Rules: []model.AccessControlPolicyRule{{
					Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
					Expression: "true",
					Value:      value,
				}},
			}
		}
		evaluatedFor := func(policyID string, userIDs ...string) {
			mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
				return req.Resource.ID == policyID && slices.Contains(userIDs, req.Subject.ID)
			})).Return(model.AccessDecision{Decision: true}, nil).Times(len(userIDs))
		}

		botPolicy := saveStoredPolicy(t, biometricsFor(model.AccessControlPolicyRoleSystemBot, "false"))
		evaluatedFor(botPolicy.ID, bot.UserId)

		overrides, appErr := th.App.EvaluateClientConfigOverrides(sessionCtx(botUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "false"}, overrides)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Empty(t, overrides, "system_bot policies do not apply to users")

		require.NoError(t, th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, botPolicy.ID))
		th.App.invalidateSystemSettingPolicyCache()
		userPolicy := saveStoredPolicy(t, biometricsFor(model.SystemUserRoleId, "true"))
		evaluatedFor(userPolicy.ID, bot.UserId, th.BasicUser.Id)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(botUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides)

		mockACS.AssertExpectations(t)
	})

	t.Run("enforces global uniqueness per ClientConfig key and rejects resource selectors", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		adminCtx := sessionCtx(th.SystemAdminUser)

		first := &model.AccessControlPolicy{
			Name:  "First Biometrics Policy",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: `user.attributes.dept == "finance"`,
				Value:      "true",
			}},
		}

		mockStoredSystemSettingPolicies(th, mockACS)

		savedFirst, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, first)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, savedFirst.ID)
			th.App.invalidateSystemSettingPolicyCache()
		})

		savedFirst.Rules[0].Value = "false"
		updatedFirst, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, savedFirst)
		require.Nil(t, appErr)
		assert.Equal(t, "false", updatedFirst.Rules[0].Value)

		duplicate := &model.AccessControlPolicy{
			Name:  "Admin Biometrics Policy",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemAdminRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      "true",
			}},
		}
		_, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, duplicate)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.pap.save_policy.system_setting_key_exists.app_error", appErr.Id)

		withResource := &model.AccessControlPolicy{
			ID:    savedFirst.ID,
			Name:  savedFirst.Name,
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: `resource.attributes.classification == "secret"`,
				Value:      "true",
			}},
		}
		_, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, withResource)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.pap.save_policy.system_setting_resource_attributes", appErr.Id)
	})
}

func TestSystemSettingPolicyUniquenessReadsFromMaster(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(&replicaLagPoliciesStore{
		Store:    originalStore,
		policies: &replicaLagPolicyStore{AccessControlPolicyStore: originalStore.AccessControlPolicy()},
	})
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })
	_, adminCtx := enableSystemSettingPolicyEngine(t, th)

	first, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, biometricsPolicy(`user.attributes.dept == "a"`))
	require.Nil(t, appErr)
	t.Cleanup(func() {
		_ = originalStore.AccessControlPolicy().Delete(th.Context, first.ID)
		th.App.invalidateSystemSettingPolicyCache()
	})

	_, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, biometricsPolicy(`user.attributes.dept == "b"`))
	require.NotNil(t, appErr, "a save right after another must see it even before the replica catches up")
	assert.Equal(t, "app.pap.save_policy.system_setting_key_exists.app_error", appErr.Id)
}
