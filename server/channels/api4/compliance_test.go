// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestCompliancePermissionsOfRunComplianceExport(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ComplianceSettings.Enable = model.NewPointer(true)
	})
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))

	// Without the enterprise compliance implementation an allowed request that
	// gets past the permission check fails with 501, never 403.
	requests := []struct {
		name          string
		do            func(client *model.Client4) *model.Response
		allowedStatus int
	}{
		{"create a report", func(client *model.Client4) *model.Response {
			_, resp, _ := client.CreateComplianceReport(context.Background(), &model.Compliance{Desc: "test", StartAt: 1, EndAt: 2})
			return resp
		}, http.StatusNotImplemented},
		{"list reports", func(client *model.Client4) *model.Response {
			_, resp, _ := client.GetComplianceReports(context.Background(), 0, 10)
			return resp
		}, http.StatusOK},
		{"get a report", func(client *model.Client4) *model.Response {
			_, resp, _ := client.GetComplianceReport(context.Background(), model.NewId())
			return resp
		}, http.StatusNotImplemented},
		{"download a report", func(client *model.Client4) *model.Response {
			_, resp, _ := client.DownloadComplianceReport(context.Background(), model.NewId())
			return resp
		}, http.StatusNotImplemented},
	}
	requireStatus := func(t *testing.T, client *model.Client4, allowed bool) {
		t.Helper()
		for _, r := range requests {
			want := http.StatusForbidden
			if allowed {
				want = r.allowedStatus
			}
			require.Equal(t, want, r.do(client).StatusCode, r.name)
		}
	}

	t.Run("with ABAC inactive, roles decide", func(t *testing.T) {
		requireStatus(t, th.Client, false)
		requireStatus(t, th.SystemAdminClient, true)
	})

	t.Run("with ABAC inactive, a stored policy denies everyone", func(t *testing.T) {
		policy, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
			ID:       model.NewId(),
			Name:     "delegate compliance export",
			Type:     model.AccessControlPolicyTypePermission,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Roles:    []string{model.SystemUserRoleId},
			Rules:    []model.AccessControlPolicyRule{{Actions: []string{"run_compliance_export"}, Expression: "true"}},
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID))
		})

		requireStatus(t, th.Client, false)
		requireStatus(t, th.SystemAdminClient, false)
	})

	t.Run("with ABAC active, one policy on the action governs every operation", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		th.ConfigStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
			cfg.FeatureFlags.PermissionPolicies = true
		})
		t.Cleanup(func() {
			th.App.Srv().Channels().AccessControl = original
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(false)
			})
		})

		// The policy matches the basic user only.
		expectPDP := func(appErr *model.AppError) {
			mockACS.ExpectedCalls = nil
			mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
				return req.Action == "run_compliance_export"
			})).Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
				return model.AccessDecision{Decision: appErr == nil && req.Subject.ID == th.BasicUser.Id}
			}, appErr)
		}

		t.Run("a delegate without the role is allowed", func(t *testing.T) {
			expectPDP(nil)
			requireStatus(t, th.Client, true)

			_, resp, err := th.Client.GetJobsByType(context.Background(), model.JobTypeMessageExport, 0, 10)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})

		t.Run("a system admin the policy does not match is denied", func(t *testing.T) {
			expectPDP(nil)
			requireStatus(t, th.SystemAdminClient, false)

			_, resp, err := th.SystemAdminClient.GetJobsByType(context.Background(), model.JobTypeMessageExport, 0, 10)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("an evaluation error is reported, not a permission error", func(t *testing.T) {
			expectPDP(model.NewAppError("test", "pdp.failed", nil, "", http.StatusInternalServerError))
			_, resp, err := th.Client.GetComplianceReports(context.Background(), 0, 10)
			require.Error(t, err)
			CheckInternalErrorStatus(t, resp)
		})
	})
}
