// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

func TestExpressionReferencesSessionAttributes(t *testing.T) {
	cases := []struct {
		name string
		expr string
		want bool
	}{
		{name: "session selector", expr: `user.session.vpn_active == "true"`, want: true},
		{name: "session selector combined with attributes", expr: `user.id_abc.id_def == "x" && user.session.os_platform == "ios"`, want: true},
		{name: "whitespace around dots", expr: `user . session . vpn_active == "true"`, want: true},
		{name: "attributes only", expr: `user.attributes.dept == "finance"`, want: false},
		{name: "attribute named like session", expr: `user.attributes.session == "x" || user.sessions == "y"`, want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, expressionReferencesSessionAttributes(tc.expr))
		})
	}
}

func TestCachedSystemSettingPolicyReferences(t *testing.T) {
	groupID := model.NewId()
	deptID := model.NewId()
	levelID := model.NewId()
	otherID := model.NewId()

	policyFor := func(exprs ...string) *cachedSystemSettingPolicy {
		p := &cachedSystemSettingPolicy{FieldIDs: map[string]struct{}{}, SessionAttributes: map[string]struct{}{}}
		for _, expr := range exprs {
			p.addExpressionReferences(expr)
		}
		return p
	}

	t.Run("fields named by ID across rules", func(t *testing.T) {
		p := policyFor(
			"user.id_"+groupID+".id_"+deptID+` == "finance"`,
			"_rank_gte(user.id_"+groupID+".id_"+levelID+`, "secret")`,
		)
		assert.True(t, p.referencesField([]string{otherID, deptID}))
		assert.True(t, p.referencesField([]string{levelID}))
		assert.False(t, p.referencesField([]string{otherID}))
		assert.False(t, p.referencesField(nil))
		assert.False(t, p.referencesSessionAttribute([]string{model.SessionAttributesPropertyFieldIPAddress}))
	})

	t.Run("fields named by name count as every field", func(t *testing.T) {
		p := policyFor(`user.attributes.dept == "finance"`)
		assert.True(t, p.referencesField([]string{otherID}))
		assert.False(t, p.referencesField(nil))
	})

	t.Run("session attribute selectors", func(t *testing.T) {
		p := policyFor(`user.session.vpn_active == "true" || user . session . ip_address == "192.0.2.10"`)
		assert.True(t, p.referencesSessionAttribute([]string{"os_platform", "ip_address"}))
		assert.True(t, p.referencesSessionAttribute([]string{"vpn_active"}))
		assert.False(t, p.referencesSessionAttribute([]string{"os_platform"}))
		assert.False(t, p.referencesField([]string{otherID}))
	})

	t.Run("session root without a selector counts as every session attribute", func(t *testing.T) {
		p := policyFor(`user.session.vpn_active == "true" && "ip_address" in user.session`)
		assert.True(t, p.referencesSessionAttribute([]string{"os_platform"}))
		assert.False(t, p.referencesSessionAttribute(nil))
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
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).Return([]*model.User{}, int64(0), nil).Maybe()

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
