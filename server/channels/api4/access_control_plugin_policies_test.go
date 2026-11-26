// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
)

const (
	testPluginPolicyType    = "com.mattermost.conflux:page"
	licenseUpgradeNeededID  = "api.license.upgrade_needed.app_error"
	policyNotFoundErrorID   = "app.pap.get_policy.app_error"
	accessControlPolicyPath = "/api/v4/access_control_policies"
)

func TestCreateAccessControlPolicyRejectsPluginType(t *testing.T) {
	th := setupMaskingOff(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.Srv().Channels().AccessControl = newMockAccessControlService()
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		_, resp, err := client.CreateAccessControlPolicy(context.Background(), &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "plugin policy",
			Type:     testPluginPolicyType,
			Version:  model.AccessControlPolicyVersionV0_5,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{"view"},
				Expression: "true",
			}},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestAccessControlPolicyRoutesHidePluginPolicies(t *testing.T) {
	th := setupMaskingOff(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	pluginPolicy, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "plugin policy",
		Type:     testPluginPolicyType,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_5,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{"view"},
			Expression: "true",
		}},
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, pluginPolicy.ID))
	})

	// A bare mock: any call that reaches the engine is recorded in Calls.
	mockACS := newMockAccessControlService()
	th.App.Srv().Channels().AccessControl = mockACS

	id := pluginPolicy.ID
	base := "/access_control_policies/" + id
	type route struct {
		name   string
		method string
		path   string
		body   string
		local  bool
	}
	routes := []route{
		{"get", http.MethodGet, base, "", true},
		{"delete", http.MethodDelete, base, "", true},
		{"activate", http.MethodGet, base + "/activate?active=true", "", false},
		{"batch activate", http.MethodPut, "/access_control_policies/activate", `{"entries":[{"id":"` + id + `","active":true}]}`, true},
		{"assign", http.MethodPost, base + "/assign", `{"channel_ids":["` + th.BasicChannel.Id + `"]}`, true},
		{"unassign", http.MethodDelete, base + "/unassign", `{"channel_ids":["` + th.BasicChannel.Id + `"]}`, true},
		{"channels", http.MethodGet, base + "/resources/channels?limit=10", "", true},
		{"channel search", http.MethodPost, base + "/resources/channels/search", `{}`, true},
	}

	run := func(t *testing.T, client *model.Client4, local bool) {
		for _, rt := range routes {
			if local && !rt.local {
				continue
			}
			t.Run(rt.name, func(t *testing.T) {
				resp, err := client.DoAPIRequestWithHeaders(context.Background(), rt.method, rt.path, rt.body, nil)
				require.Error(t, err)
				CheckNotFoundStatus(t, model.BuildResponse(resp))

				var appErr *model.AppError
				require.True(t, errors.As(err, &appErr))
				require.Equal(t, policyNotFoundErrorID, appErr.Id)
			})
		}
	}

	t.Run("system admin", func(t *testing.T) { run(t, th.SystemAdminClient, false) })
	t.Run("regular user", func(t *testing.T) { run(t, th.Client, false) })
	t.Run("local", func(t *testing.T) { run(t, th.LocalClient, true) })

	require.Empty(t, mockACS.Calls, "a plugin policy ID must never reach the access control engine from admin routes")

	t.Run("a core policy ID still reaches the engine", func(t *testing.T) {
		coreID := model.NewId()
		mockACS.On("GetPolicy", mock.Anything, coreID).
			Return(nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "stub", http.StatusInternalServerError)).
			Once()

		resp, err := th.SystemAdminClient.DoAPIRequestWithHeaders(context.Background(), http.MethodGet, "/access_control_policies/"+coreID, "", nil)
		require.Error(t, err)
		CheckInternalErrorStatus(t, model.BuildResponse(resp))
		mockACS.AssertExpectations(t)
	})
}

func TestAccessControlPolicyRoutesRequireEnterpriseAdvanced(t *testing.T) {
	th := setupMaskingOff(t).InitBasic(t)

	policyIDParam := regexp.MustCompile(`\{policy_id:[^}]*\}`)

	collect := func(t *testing.T, router *mux.Router) map[string][]string {
		t.Helper()
		// "METHOD path" per registered route under the policies prefix.
		found := map[string][]string{}
		err := router.Walk(func(route *mux.Route, _ *mux.Router, _ []*mux.Route) error {
			template, err := route.GetPathTemplate()
			if err != nil || !strings.HasPrefix(template, accessControlPolicyPath) {
				return nil
			}
			methods, err := route.GetMethods()
			if err != nil {
				// A prefix-only subrouter route, not an endpoint.
				return nil
			}
			path := policyIDParam.ReplaceAllString(strings.TrimPrefix(template, "/api/v4"), model.NewId())
			found[path] = append(found[path], methods...)
			return nil
		})
		require.NoError(t, err)
		return found
	}

	sessionRoutes := collect(t, th.Server.Router)
	localRoutes := collect(t, th.Server.LocalRouter)
	require.GreaterOrEqual(t, len(sessionRoutes), 13)
	require.GreaterOrEqual(t, len(localRoutes), 12)
	for path := range sessionRoutes {
		require.False(t, strings.HasPrefix(path, "/access_control/decisions"), path)
	}

	// Every endpoint answers the license error on its own, before touching its
	// body or permissions, so a route added without the guard cannot pass.
	check := func(t *testing.T, client *model.Client4, routes map[string][]string) {
		t.Helper()
		for path, methods := range routes {
			for _, method := range methods {
				t.Run(method+" "+path, func(t *testing.T) {
					resp, err := client.DoAPIRequestWithHeaders(context.Background(), method, path, "{}", nil)
					require.Error(t, err)
					CheckNotImplementedStatus(t, model.BuildResponse(resp))

					var appErr *model.AppError
					require.True(t, errors.As(err, &appErr))
					require.Equal(t, licenseUpgradeNeededID, appErr.Id)
				})
			}
		}
	}

	for _, sku := range []string{"", model.LicenseShortSkuProfessional, model.LicenseShortSkuEnterprise} {
		name := "sku " + sku
		if sku == "" {
			name = "no license"
			require.Nil(t, th.App.Srv().RemoveLicense())
		} else {
			th.App.Srv().SetLicense(model.NewTestLicenseSKU(sku))
		}
		t.Run(name, func(t *testing.T) {
			t.Run("session routes", func(t *testing.T) { check(t, th.SystemAdminClient, sessionRoutes) })
			t.Run("local routes", func(t *testing.T) { check(t, th.LocalClient, localRoutes) })
		})
	}

	t.Run("Enterprise Advanced passes the guard", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		for path, methods := range sessionRoutes {
			for _, method := range methods {
				resp, err := th.SystemAdminClient.DoAPIRequestWithHeaders(context.Background(), method, path, "{}", nil)
				if err == nil {
					continue
				}
				var appErr *model.AppError
				require.True(t, errors.As(err, &appErr), "%s %s status %d", method, path, resp.StatusCode)
				require.NotEqual(t, licenseUpgradeNeededID, appErr.Id, "%s %s", method, path)
			}
		}
	})
}
