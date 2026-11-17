// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

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
			_, _ = th.App.Srv().Store().System().PermanentDeleteByName(model.SystemSystemSettingPolicyOrderKey)
			th.App.invalidateSystemSettingPolicyCache()
		})
		return mockACS
	}

	cleanupPolicy := func(t *testing.T, id string) {
		t.Helper()
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, id)
			th.App.invalidateSystemSettingPolicyCache()
		})
	}

	// recordEvaluations answers every AccessEvaluation with decide and returns
	// a function that drains the "policyID/key" calls made for a subject.
	recordEvaluations := func(mockACS *mocks.AccessControlServiceInterface, decide func(model.AccessRequest) bool) func(subjectID string) []string {
		calls := map[string][]string{}
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
				calls[req.Subject.ID] = append(calls[req.Subject.ID], req.Resource.ID+"/"+req.Action)
				return model.AccessDecision{Decision: decide(req)}
			}, nil)
		return func(subjectID string) []string {
			drained := calls[subjectID]
			delete(calls, subjectID)
			return drained
		}
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

	t.Run("evaluates every announcement banner rule in a policy", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		bannerRule := func(key, value string) model.AccessControlPolicyRule {
			return model.AccessControlPolicyRule{
				Actions:    []string{key},
				Expression: `user.attributes.dept == "finance"`,
				Value:      value,
			}
		}
		policy := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Finance Banner",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{
				bannerRule(model.ClientConfigKeyEnableBanner, "true"),
				bannerRule(model.ClientConfigKeyBannerText, "Finance close is on Friday"),
				bannerRule(model.ClientConfigKeyAllowBannerDismissal, "false"),
			},
		})

		bannerKeys := []string{
			model.ClientConfigKeyEnableBanner,
			model.ClientConfigKeyBannerText,
			model.ClientConfigKeyAllowBannerDismissal,
		}
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == policy.ID &&
				req.Resource.Type == model.AccessControlPolicyTypeSystemSetting &&
				slices.Contains(bannerKeys, req.Action) &&
				req.Subject.ID == th.BasicUser.Id
		})).Return(model.AccessDecision{Decision: true}, nil).Times(len(bannerKeys))

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == th.BasicUser2.Id
		})).Return(model.AccessDecision{Decision: false}, nil).Times(len(bannerKeys))

		overrides, appErr := th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{
			model.ClientConfigKeyEnableBanner:         "true",
			model.ClientConfigKeyBannerText:           "Finance close is on Friday",
			model.ClientConfigKeyAllowBannerDismissal: "false",
		}, overrides)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser2))
		require.Nil(t, appErr)
		assert.Empty(t, overrides)

		mockACS.AssertExpectations(t)
	})

	t.Run("allows several policies per ClientConfig key and rejects resource selectors", func(t *testing.T) {
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
		cleanupPolicy(t, savedFirst.ID)

		savedFirst.Rules[0].Value = "false"
		updatedFirst, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, savedFirst)
		require.Nil(t, appErr)
		assert.Equal(t, "false", updatedFirst.Rules[0].Value)

		second := &model.AccessControlPolicy{
			Name:  "Admin Biometrics Policy",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemAdminRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      "true",
			}},
		}
		savedSecond, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, second)
		require.Nil(t, appErr)
		cleanupPolicy(t, savedSecond.ID)

		duplicateRules := &model.AccessControlPolicy{
			Name:  "Duplicate Rules Policy",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: "a"},
				{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "false", Value: "b"},
			},
		}
		_, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, duplicateRules)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "model.access_policy.is_valid.system_setting_duplicate_key.app_error", appErr.Id)

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

	t.Run("first matching policy in priority order supplies each key", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		finance := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Finance Banner",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.ClientConfigKeyEnableBanner}, Expression: `user.attributes.dept == "finance"`, Value: "true"},
				{Actions: []string{model.ClientConfigKeyBannerText}, Expression: `user.attributes.dept == "finance"`, Value: "Finance: quarter close Monday"},
			},
		})
		generic := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Everyone Banner",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.ClientConfigKeyEnableBanner}, Expression: "true", Value: "true"},
				{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: "Company all-hands Thursday"},
				{Actions: []string{model.ClientConfigKeyAllowBannerDismissal}, Expression: "true", Value: "false"},
			},
		})

		evaluated := recordEvaluations(mockACS, func(req model.AccessRequest) bool {
			if req.Resource.ID == finance.ID {
				return req.Subject.ID == th.BasicUser.Id
			}
			return req.Resource.ID == generic.ID
		})

		_, appErr := th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{finance.ID, generic.ID}})
		require.Nil(t, appErr)

		overrides, appErr := th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{
			model.ClientConfigKeyEnableBanner:         "true",
			model.ClientConfigKeyBannerText:           "Finance: quarter close Monday",
			model.ClientConfigKeyAllowBannerDismissal: "false",
		}, overrides)
		assert.ElementsMatch(t, []string{
			finance.ID + "/" + model.ClientConfigKeyEnableBanner,
			finance.ID + "/" + model.ClientConfigKeyBannerText,
			generic.ID + "/" + model.ClientConfigKeyAllowBannerDismissal,
		}, evaluated(th.BasicUser.Id), "keys already supplied by a higher policy must not be evaluated again")

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser2))
		require.Nil(t, appErr)
		assert.Equal(t, "Company all-hands Thursday", overrides[model.ClientConfigKeyBannerText])

		_, appErr = th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{generic.ID, finance.ID}})
		require.Nil(t, appErr)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{
			model.ClientConfigKeyEnableBanner:         "true",
			model.ClientConfigKeyBannerText:           "Company all-hands Thursday",
			model.ClientConfigKeyAllowBannerDismissal: "false",
		}, overrides)
		for _, call := range evaluated(th.BasicUser.Id) {
			assert.NotContains(t, call, finance.ID, "a lower policy is never evaluated once every key it sets is supplied")
		}
	})

	t.Run("role chain filtering still applies to ordered policies", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		admins := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Admin Banner",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemAdminRoleId},
			Rules:   []model.AccessControlPolicyRule{{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: "admins"}},
		})
		members := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Member Banner",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules:   []model.AccessControlPolicyRule{{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: "members"}},
		})
		evaluated := recordEvaluations(mockACS, func(model.AccessRequest) bool { return true })

		_, appErr := th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{admins.ID, members.ID}})
		require.Nil(t, appErr)

		overrides, appErr := th.App.EvaluateClientConfigOverrides(sessionCtx(th.BasicUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyBannerText: "members"}, overrides)
		assert.Equal(t, []string{members.ID + "/" + model.ClientConfigKeyBannerText}, evaluated(th.BasicUser.Id))

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.SystemAdminUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyBannerText: "admins"}, overrides)

		_, appErr = th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{members.ID, admins.ID}})
		require.Nil(t, appErr)

		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(th.SystemAdminUser))
		require.Nil(t, appErr)
		assert.Equal(t, map[string]string{model.ClientConfigKeyBannerText: "members"}, overrides, "system_admin falls back to system_user policies in priority order")

		guest := th.CreateGuest(t)
		overrides, appErr = th.App.EvaluateClientConfigOverrides(sessionCtx(guest))
		require.Nil(t, appErr)
		assert.Empty(t, overrides)
		assert.Empty(t, evaluated(guest.Id))
	})

	t.Run("unlisted policies rank after listed ones, oldest first", func(t *testing.T) {
		_ = enableSystemSettingABAC(t)
		newPolicy := func(name string) *model.AccessControlPolicy {
			p := saveStoredPolicy(t, &model.AccessControlPolicy{
				ID:      model.NewId(),
				Name:    name,
				Type:    model.AccessControlPolicyTypeSystemSetting,
				Version: model.AccessControlPolicyVersionV0_3,
				Roles:   []string{model.SystemUserRoleId},
				Rules:   []model.AccessControlPolicyRule{{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: name}},
			})
			time.Sleep(2 * time.Millisecond)
			return p
		}
		oldest := newPolicy("Oldest")
		middle := newPolicy("Middle")
		newest := newPolicy("Newest")

		order, appErr := th.App.GetSystemSettingPolicyOrder(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, []string{oldest.ID, middle.ID, newest.ID}, order.PolicyIDs)

		require.NoError(t, th.App.Srv().Store().System().SaveOrUpdate(&model.System{
			Name:  model.SystemSystemSettingPolicyOrderKey,
			Value: strings.Join([]string{newest.ID, model.NewId()}, ","),
		}))
		th.App.invalidateSystemSettingPolicyCache()

		order, appErr = th.App.GetSystemSettingPolicyOrder(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, []string{newest.ID, oldest.ID, middle.ID}, order.PolicyIDs, "stale IDs are ignored and unlisted policies follow by CreateAt")
	})

	t.Run("saving adds new policies to the bottom and deleting removes them", func(t *testing.T) {
		mockACS := enableSystemSettingABAC(t)
		adminCtx := sessionCtx(th.SystemAdminUser)
		mockStoredSystemSettingPolicies(th, mockACS)
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).Return([]*model.User{}, int64(0), nil).Maybe()

		create := func(name string) *model.AccessControlPolicy {
			saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, &model.AccessControlPolicy{
				Name:  name,
				Type:  model.AccessControlPolicyTypeSystemSetting,
				Roles: []string{model.SystemUserRoleId},
				Rules: []model.AccessControlPolicyRule{{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: name}},
			})
			require.Nil(t, appErr)
			cleanupPolicy(t, saved.ID)
			return saved
		}
		storedOrder := func() []string {
			order, err := loadSystemSettingPolicyOrder(th.App.Srv().Store().System())
			require.NoError(t, err)
			return order
		}

		a := create("Banner A")
		b := create("Banner B")
		assert.Equal(t, []string{a.ID, b.ID}, storedOrder())

		_, appErr := th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{b.ID, a.ID}})
		require.Nil(t, appErr)

		a.Rules[0].Value = "Banner A edited"
		_, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, a)
		require.Nil(t, appErr)
		c := create("Banner C")
		assert.Equal(t, []string{b.ID, a.ID, c.ID}, storedOrder(), "edits keep their position and new policies go last")

		require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, a.ID))
		assert.Equal(t, []string{b.ID, c.ID}, storedOrder())

		order, appErr := th.App.GetSystemSettingPolicyOrder(th.Context)
		require.Nil(t, appErr)
		assert.Equal(t, []string{b.ID, c.ID}, order.PolicyIDs)
	})

	t.Run("UpdateSystemSettingPolicyOrder validates IDs and readiness", func(t *testing.T) {
		_ = enableSystemSettingABAC(t)
		settingPolicy := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Order Validation Banner",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules:   []model.AccessControlPolicyRule{{Actions: []string{model.ClientConfigKeyBannerText}, Expression: "true", Value: "x"}},
		})
		permissionPolicy := saveStoredPolicy(t, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Order Validation Permission",
			Type:    model.AccessControlPolicyTypePermission,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{model.SystemUserRoleId},
			Rules:   []model.AccessControlPolicyRule{{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"}},
		})

		_, appErr := th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{settingPolicy.ID, model.NewId()}})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.system_setting_policy_order.unknown_policy.app_error", appErr.Id)

		_, appErr = th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{permissionPolicy.ID}})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.system_setting_policy_order.unknown_policy.app_error", appErr.Id)

		_, appErr = th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{settingPolicy.ID, settingPolicy.ID}})
		require.NotNil(t, appErr)
		assert.Equal(t, "model.system_setting_policy_order.is_valid.duplicate.app_error", appErr.Id)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(false)
		})
		_, appErr = th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{PolicyIDs: []string{settingPolicy.ID}})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotAcceptable, appErr.StatusCode)
		assert.Equal(t, "app.pap.is_ready.app_error", appErr.Id)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		_, appErr = th.App.GetSystemSettingPolicyOrder(th.Context)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
		assert.Equal(t, "app.pap.init.app_error", appErr.Id)

		th.App.Srv().Channels().AccessControl = nil
		_, appErr = th.App.UpdateSystemSettingPolicyOrder(th.Context, &model.SystemSettingPolicyOrder{})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})
}

func TestSortSystemSettingPolicies(t *testing.T) {
	policies := []cachedSystemSettingPolicy{
		{ID: "unlisted_new", CreateAt: 300},
		{ID: "listed_second", CreateAt: 100},
		{ID: "unlisted_tie_b", CreateAt: 200},
		{ID: "listed_first", CreateAt: 500},
		{ID: "unlisted_tie_a", CreateAt: 200},
	}
	sortSystemSettingPolicies(policies, []string{"listed_first", "missing", "listed_second"})

	ids := make([]string, 0, len(policies))
	for _, p := range policies {
		ids = append(ids, p.ID)
	}
	assert.Equal(t, []string{"listed_first", "listed_second", "unlisted_tie_a", "unlisted_tie_b", "unlisted_new"}, ids)
}
