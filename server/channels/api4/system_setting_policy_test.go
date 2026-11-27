// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestSystemSettingPoliciesAPI(t *testing.T) {
	th := SetupConfig(t, maskingOffTestConfig).InitBasic(t)

	setupMocks := func(t *testing.T) *mocks.AccessControlServiceInterface {
		t.Helper()
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok)

		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.FeatureFlags.SessionAttributes = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().Channels().AccessControl = nil
			_ = th.App.Srv().InvalidateAllCaches()
		})

		mockACS.On("SavePolicy", mock.Anything, mock.AnythingOfType("*model.AccessControlPolicy")).
			Run(func(args mock.Arguments) {
				rctx := args.Get(0).(request.CTX)
				p := args.Get(1).(*model.AccessControlPolicy)
				_, err := th.App.Srv().Store().AccessControlPolicy().Save(rctx, p)
				require.NoError(t, err)
			}).
			Return(func(_ request.CTX, p *model.AccessControlPolicy) *model.AccessControlPolicy { return p }, nil).
			Maybe()

		mockACS.On("GetPolicy", mock.Anything, mock.AnythingOfType("string")).
			Return(func(rctx request.CTX, id string) *model.AccessControlPolicy {
				p, err := th.App.Srv().Store().AccessControlPolicy().Get(rctx, id)
				if err != nil {
					return nil
				}
				return p
			}, func(rctx request.CTX, id string) *model.AppError {
				_, err := th.App.Srv().Store().AccessControlPolicy().Get(rctx, id)
				if err != nil {
					return model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, err.Error(), http.StatusNotFound)
				}
				return nil
			}).
			Maybe()

		mockACS.On("DeletePolicy", mock.Anything, mock.AnythingOfType("string")).
			Return(func(rctx request.CTX, id string) *model.AppError {
				if err := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, id); err != nil {
					return model.NewAppError("DeletePolicy", "app.pap.delete_policy.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
				return nil
			}).
			Maybe()

		mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return().Maybe()
		mockACS.On("NormalizePolicy", mock.Anything, mock.AnythingOfType("*model.AccessControlPolicy")).
			Return(func(_ request.CTX, p *model.AccessControlPolicy) *model.AccessControlPolicy { return p }, nil).
			Maybe()

		return mockACS
	}

	t.Run("feature flag, license, and ABAC gating across create, get, delete, and search", func(t *testing.T) {
		_ = setupMocks(t)

		seedPolicy := &model.AccessControlPolicy{
			Name:  "Seeded Scoped Policy",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      "true",
			}},
		}
		seeded, resp, err := th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), seedPolicy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, seeded.ID)
		})

		parentPolicy, saveErr := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Seeded Parent Policy",
			Type:     model.AccessControlPolicyTypeParent,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		})
		require.NoError(t, saveErr)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, parentPolicy.ID)
		})

		assertOmittedFromUnfilteredSearch := func(t *testing.T) {
			t.Helper()
			unfiltered, searchResp, searchErr := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
				Term:  "Seeded",
				Limit: 10,
			})
			require.NoError(t, searchErr)
			CheckOKStatus(t, searchResp)
			require.EqualValues(t, 1, unfiltered.Total)
			require.Len(t, unfiltered.Policies, 1)
			assert.Equal(t, parentPolicy.ID, unfiltered.Policies[0].ID)
		}

		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = false
		})

		policy := &model.AccessControlPolicy{
			Name:  "Disabled Flag Policy",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      "true",
			}},
		}

		_, resp, err = th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), policy)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		_, resp, err = th.SystemAdminClient.GetAccessControlPolicy(context.Background(), seeded.ID)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		resp, err = th.SystemAdminClient.DeleteAccessControlPolicy(context.Background(), seeded.ID)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		_, resp, err = th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Limit: 10,
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		assertOmittedFromUnfilteredSearch(t)

		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(false)
		})

		_, resp, err = th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Limit: 10,
		})
		require.Error(t, err)
		assert.Equal(t, http.StatusNotAcceptable, resp.StatusCode)
		assertOmittedFromUnfilteredSearch(t)

		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})
		require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)))

		_, resp, err = th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Limit: 10,
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
		assertOmittedFromUnfilteredSearch(t)
	})

	t.Run("search normalizes attribute IDs and masks non-held values instead of failing closed", func(t *testing.T) {
		mockACS := setupMocks(t)
		updateTestFeatureFlags(t, th, func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = true
		})
		t.Cleanup(func() {
			updateTestFeatureFlags(t, th, func(cfg *model.Config) {
				cfg.FeatureFlags.AttributeValueMasking = false
			})
		})

		group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)
		field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "dept_" + model.NewId()[:8],
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}, false, "")
		require.Nil(t, appErr)

		rawExpr := "user.id_" + group.ID + ".id_" + field.ID + ` == "Secret"`
		normalizedExpr := "user.attributes." + field.Name + ` == "Secret"`
		maskedExpr := "user.attributes." + field.Name + ` == "********"`

		stored, saveErr := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "Masked Biometrics Policy",
			Type:     model.AccessControlPolicyTypeSystemSetting,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Roles:    []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: rawExpr,
				Value:      "true",
			}},
		})
		require.NoError(t, saveErr)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, stored.ID)
		})

		*mockACS = mocks.AccessControlServiceInterface{}
		mockACS.On("NormalizePolicy", mock.Anything, mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.ID == stored.ID && len(p.Rules) == 1 && p.Rules[0].Expression == rawExpr
		})).Return(func(_ request.CTX, p *model.AccessControlPolicy) *model.AccessControlPolicy {
			clone := *p
			clone.Rules = []model.AccessControlPolicyRule{{
				Actions:    p.Rules[0].Actions,
				Expression: normalizedExpr,
				Value:      p.Rules[0].Value,
			}}
			return &clone
		}, nil).Once()
		mockACS.On("MaskExpressionForCaller", mock.Anything, normalizedExpr, mock.Anything).
			Return(maskedExpr, true, nil).Once()

		found, resp, err := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Term:  "Masked Biometrics",
			Limit: 10,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, found.Policies, 1)
		assert.Equal(t, maskedExpr, found.Policies[0].Rules[0].Expression)
		mockACS.AssertExpectations(t)
	})

	t.Run("only system admins can create system_setting policies", func(t *testing.T) {
		_ = setupMocks(t)

		policy := &model.AccessControlPolicy{
			Name:  "Non-Admin Attempt",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: "true",
				Value:      "true",
			}},
		}

		_, resp, err := th.Client.CreateAccessControlPolicy(context.Background(), policy)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("CRUD, effective client config with X-MM-Session-Attributes, and config_changed pushes", func(t *testing.T) {
		mockACS := setupMocks(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
		require.Nil(t, appErr)
		fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		for _, f := range fields {
			if f.Name == model.SessionAttributesPropertyFieldHardwareID {
				if f.Attrs == nil {
					f.Attrs = model.StringInterface{}
				}
				f.Attrs["enabled"] = true
				_, _, updAppErr := th.App.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{f}, true, "")
				require.Nil(t, updAppErr)
				break
			}
		}

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.Type == model.AccessControlPolicyTypeSystemSetting &&
				req.Action == model.ClientConfigKeyMobileEnableBiometrics
		})).Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
			if req.Subject.ID == th.BasicUser.Id || req.Subject.Session[model.SessionAttributesPropertyFieldHardwareID] == "mdm-device-1" {
				return model.AccessDecision{Decision: true}
			}
			return model.AccessDecision{Decision: false}
		}, nil)

		client2 := th.CreateClient()
		_, _, err := client2.Login(context.Background(), th.BasicUser2.Email, th.BasicUser2.Password)
		require.NoError(t, err)

		wsUser1, err := th.CreateWebSocketClient()
		require.NoError(t, err)
		defer wsUser1.Close()
		wsUser1.Listen()

		wsUser2, err := th.CreateWebSocketClientWithClient(client2)
		require.NoError(t, err)
		defer wsUser2.Close()
		wsUser2.Listen()

		policy := &model.AccessControlPolicy{
			Name:  "Mobile Biometrics Override",
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: `user.attributes.dept == "finance"`,
				Value:      "true",
			}},
		}

		created, resp, err := th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), policy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		t.Cleanup(func() {
			_, _ = th.SystemAdminClient.DeleteAccessControlPolicy(context.Background(), created.ID)
		})

		found, resp, err := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Actions: []string{model.ClientConfigKeyMobileEnableBiometrics},
			Limit:   10,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.EqualValues(t, 1, found.Total)
		require.Len(t, found.Policies, 1)
		assert.Equal(t, created.ID, found.Policies[0].ID)
		assert.Equal(t, "true", found.Policies[0].Rules[0].Value)

		// Config saves earlier in the test also send config_changed, so wait for
		// the one carrying the expected value.
		waitForBiometrics := func(ws *model.WebSocketClient, expected string) {
			t.Helper()
			deadline := time.After(5 * time.Second)
			for {
				select {
				case ev := <-ws.EventChannel:
					require.NotEqual(t, model.WebsocketEventPermissionPolicyUpdated, ev.EventType(), "saving system_setting policy must not emit permission_policy_updated")
					if ev.EventType() != model.WebsocketEventConfigChanged {
						continue
					}
					config, ok := ev.GetData()["config"].(map[string]any)
					require.True(t, ok, "expected a config map on config_changed")
					assert.NotEmpty(t, config["SiteName"], "config_changed must carry the whole client config")
					if config[model.ClientConfigKeyMobileEnableBiometrics] == expected {
						return
					}
				case <-deadline:
					t.Fatalf("timed out waiting for config_changed with %s=%s", model.ClientConfigKeyMobileEnableBiometrics, expected)
				}
			}
		}
		biometrics := func(client *model.Client4) string {
			t.Helper()
			config, resp, err := client.GetClientConfig(context.Background(), "")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.NotEmpty(t, config["SiteName"])
			return config[model.ClientConfigKeyMobileEnableBiometrics]
		}

		waitForBiometrics(wsUser1, "true")
		waitForBiometrics(wsUser2, "false")

		assert.Equal(t, "true", biometrics(th.Client))
		assert.Equal(t, "false", biometrics(client2))
		assert.Equal(t, "false", biometrics(th.CreateClient()), "the unauthenticated config has no session to evaluate")

		const desktopUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36"
		headerBytes, err := json.Marshal(map[string]any{model.SessionAttributesPropertyFieldHardwareID: "mdm-device-1"})
		require.NoError(t, err)
		client2.HTTPHeader = map[string]string{
			"User-Agent": desktopUserAgent,
			model.SessionAttributeHeaderClientAttributes: base64.StdEncoding.EncodeToString(headerBytes),
		}
		assert.Equal(t, "true", biometrics(client2))

		resp, err = th.SystemAdminClient.DeleteAccessControlPolicy(context.Background(), created.ID)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		waitForBiometrics(wsUser1, "false")

		assert.Equal(t, "false", biometrics(th.Client))
	})
}
