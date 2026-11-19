// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"

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

		return mockACS
	}

	t.Run("GET /config/client/overrides requires authentication", func(t *testing.T) {
		unauthClient := th.CreateClient()
		_, resp, err := unauthClient.GetClientConfigOverrides(context.Background())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("feature flag gating on create and search", func(t *testing.T) {
		_ = setupMocks(t)
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

		_, resp, err := th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), policy)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		_, resp, err = th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Limit: 10,
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
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

	t.Run("CRUD and overrides endpoint with X-MM-Session-Attributes", func(t *testing.T) {
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

		overrides1, resp, err := th.Client.GetClientConfigOverrides(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides1)

		overrides2, resp, err := client2.GetClientConfigOverrides(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Empty(t, overrides2)

		const desktopUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36"
		headerBytes, err := json.Marshal(map[string]any{model.SessionAttributesPropertyFieldHardwareID: "mdm-device-1"})
		require.NoError(t, err)
		client2.HTTPHeader = map[string]string{
			"User-Agent": desktopUserAgent,
			model.SessionAttributeHeaderClientAttributes: base64.StdEncoding.EncodeToString(headerBytes),
		}
		overrides2WithAttr, resp, err := client2.GetClientConfigOverrides(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides2WithAttr)

		resp, err = th.SystemAdminClient.DeleteAccessControlPolicy(context.Background(), created.ID)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		overridesAfterDelete, resp, err := th.Client.GetClientConfigOverrides(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.Empty(t, overridesAfterDelete)
	})
}
