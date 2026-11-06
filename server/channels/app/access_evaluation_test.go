// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// The registry is process-wide, so these tests register permissions that
// nothing else evaluates through AccessEvaluation and must not run in
// parallel with each other.
const (
	testDelegableAction  = "run_test_delegable"
	testRestrictedAction = "run_test_restricted"
	testChannelAction    = "run_test_channel_action"
)

var (
	testDelegablePermission  = model.PermissionSysconsoleReadExperimentalBleve
	testRestrictedPermission = model.PermissionSysconsoleReadExperimentalFeatureFlags
	testChannelPermission    = model.PermissionUseChannelMentions
)

func registerTestActions(t *testing.T) {
	t.Helper()
	model.RegisterActionsForTesting(t,
		model.ActionEntry{Name: testDelegableAction, ResourceType: model.AccessControlPolicyTypeSystem, Grantable: true, Permissions: []string{testDelegablePermission.Id}},
		model.ActionEntry{Name: testRestrictedAction, ResourceType: model.AccessControlPolicyTypeSystem, Permissions: []string{testRestrictedPermission.Id}},
		model.ActionEntry{Name: testChannelAction, ResourceType: model.AccessControlPolicyTypeChannel, Grantable: true, Permissions: []string{testChannelPermission.Id}},
	)
}

// setABACActive makes AttributeBasedAccessControlActive true with acs as the
// access-control service, restoring the previous service when the test ends.
func setABACActive(t *testing.T, th *TestHelper, acs *mocks.AccessControlServiceInterface) {
	t.Helper()
	original := th.App.Srv().ch.AccessControl
	th.App.Srv().ch.AccessControl = acs
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = original })

	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		cfg.FeatureFlags.PermissionPolicies = true
	})
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	require.True(t, th.App.AttributeBasedAccessControlActive())
}

func setABACInactive(t *testing.T, th *TestHelper) {
	t.Helper()
	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(false)
	})
	require.False(t, th.App.AttributeBasedAccessControlActive())
}

func savePermissionPolicy(t *testing.T, th *TestHelper, action string) {
	t.Helper()
	policy, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "test policy " + action,
		Type:     model.AccessControlPolicyTypePermission,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Roles:    []string{model.SystemUserRoleId},
		Rules:    []model.AccessControlPolicyRule{{Actions: []string{action}, Expression: "true"}},
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID))
	})
}

func sessionContext(th *TestHelper, user *model.User) request.CTX {
	return th.Context.
		WithSession(&model.Session{Id: model.NewId(), UserId: user.Id, Roles: user.Roles}).
		WithSubject(&model.Subject{ID: user.Id, Type: "user"})
}

func systemRequest(permission *model.Permission) model.AccessRequest {
	return model.AccessRequest{Action: permission.Id}
}

type policySearchFailureStore struct {
	store.Store
}

func (s *policySearchFailureStore) AccessControlPolicy() store.AccessControlPolicyStore {
	return &policySearchFailurePolicyStore{AccessControlPolicyStore: s.Store.AccessControlPolicy()}
}

type policySearchFailurePolicyStore struct {
	store.AccessControlPolicyStore
}

func (s *policySearchFailurePolicyStore) SearchPolicies(request.CTX, model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, error) {
	return nil, 0, errors.New("search failed")
}

func TestAttributeBasedAccessControlActive(t *testing.T) {
	th := Setup(t)

	acs := &mocks.AccessControlServiceInterface{}
	setABACActive(t, th, acs)

	t.Run("requires an Enterprise Advanced license", func(t *testing.T) {
		require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)))
		t.Cleanup(func() { th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)) })
		assert.False(t, th.App.AttributeBasedAccessControlActive())
		assert.True(t, th.App.attributeBasedAccessControlEnabled(), "the toggle check stays license-free")
	})

	t.Run("requires the access-control service", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = acs })
		assert.False(t, th.App.AttributeBasedAccessControlActive())
	})

	t.Run("requires the permission policies flag", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PermissionPolicies = false })
		t.Cleanup(func() { th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PermissionPolicies = true }) })
		assert.False(t, th.App.AttributeBasedAccessControlActive())
	})
}

func TestAccessEvaluation(t *testing.T) {
	th := Setup(t).InitBasic(t)
	registerTestActions(t)
	th.AddPermissionToRole(t, testDelegablePermission.Id, model.SystemAdminRoleId)
	th.AddPermissionToRole(t, testRestrictedPermission.Id, model.SystemAdminRoleId)

	admin := sessionContext(th, th.SystemAdminUser)
	user := sessionContext(th, th.BasicUser)

	t.Run("with ABAC active", func(t *testing.T) {
		acs := &mocks.AccessControlServiceInterface{}
		setABACActive(t, th, acs)

		expectPDP := func(t *testing.T, decision model.AccessDecision, appErr *model.AppError) {
			t.Helper()
			acs.ExpectedCalls = nil
			acs.Calls = nil
			acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(decision, appErr).Once()
		}
		expectNoPDP := func(t *testing.T) {
			t.Helper()
			acs.ExpectedCalls = nil
			acs.Calls = nil
			t.Cleanup(func() { acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything) })
		}

		for _, tc := range []struct {
			name        string
			rctx        request.CTX
			permission  *model.Permission
			pdp         *model.AccessDecision
			pdpErr      *model.AppError
			allowed     bool
			wantErrorID string
		}{
			{name: "RBAC allow and ABAC no policy allows", rctx: admin, permission: testDelegablePermission, pdp: new(model.NewNoPolicyAccessDecision()), allowed: true},
			{name: "RBAC allow and ABAC allow allows", rctx: admin, permission: testDelegablePermission, pdp: &model.AccessDecision{Decision: true}, allowed: true},
			{name: "RBAC allow and ABAC deny denies, restricting a system admin", rctx: admin, permission: testDelegablePermission, pdp: &model.AccessDecision{Decision: false}},
			{name: "RBAC allow and ABAC error denies with the error", rctx: admin, permission: testDelegablePermission, pdpErr: model.NewAppError("test", "pdp.failed", nil, "", http.StatusInternalServerError), wantErrorID: "pdp.failed"},
			{name: "RBAC no opinion and ABAC allow allows, delegating to a user", rctx: user, permission: testDelegablePermission, pdp: &model.AccessDecision{Decision: true}, allowed: true},
			{name: "RBAC no opinion and ABAC no policy denies", rctx: user, permission: testDelegablePermission, pdp: new(model.NewNoPolicyAccessDecision())},
			{name: "RBAC no opinion and ABAC deny denies", rctx: user, permission: testDelegablePermission, pdp: &model.AccessDecision{Decision: false}},
			{name: "RBAC deny on a non-grantable action denies without asking ABAC", rctx: user, permission: testRestrictedPermission},
			{name: "a non-grantable action granted by RBAC is still restricted by ABAC", rctx: admin, permission: testRestrictedPermission, pdp: &model.AccessDecision{Decision: false}},
			{name: "an unregistered permission is decided by RBAC alone (allow)", rctx: admin, permission: model.PermissionManageSystem, allowed: true},
			{name: "an unregistered permission is decided by RBAC alone (deny)", rctx: user, permission: model.PermissionManageSystem},
		} {
			t.Run(tc.name, func(t *testing.T) {
				if tc.pdp != nil || tc.pdpErr != nil {
					var d model.AccessDecision
					if tc.pdp != nil {
						d = *tc.pdp
					}
					expectPDP(t, d, tc.pdpErr)
				} else {
					expectNoPDP(t)
				}

				decision, appErr := th.App.AccessEvaluation(tc.rctx, systemRequest(tc.permission))
				assert.Equal(t, tc.allowed, decision.Decision)
				if tc.wantErrorID != "" {
					require.NotNil(t, appErr)
					assert.Equal(t, tc.wantErrorID, appErr.Id)
					assert.True(t, decision.IsError())
				} else {
					require.Nil(t, appErr)
				}
				acs.AssertExpectations(t)
			})
		}

		t.Run("the PDP gets the action name, the system resource and the request subject", func(t *testing.T) {
			acs.ExpectedCalls = nil
			acs.Calls = nil
			subject := &model.Subject{ID: th.BasicUser.Id, Type: "user", Attributes: map[string]any{"department": "legal"}}
			rctx := user.WithSubject(subject)

			acs.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
				return req.Action == testDelegableAction &&
					req.Resource == model.Resource{Type: model.AccessControlPolicyTypeSystem} &&
					req.Subject.ID == th.BasicUser.Id &&
					req.Subject.Attributes["department"] == "legal"
			})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil)).Once()

			decision, appErr := th.App.AccessEvaluation(rctx, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.True(t, decision.Decision)
			acs.AssertExpectations(t)
		})

		t.Run("a missing request subject denies with an error", func(t *testing.T) {
			expectNoPDP(t)
			rctx := th.Context.WithSession(&model.Session{Id: model.NewId(), UserId: th.BasicUser.Id, Roles: th.BasicUser.Roles})

			decision, appErr := th.App.AccessEvaluation(rctx, systemRequest(testDelegablePermission))
			require.NotNil(t, appErr)
			assert.Equal(t, "app.access_control.missing_subject.app_error", appErr.Id)
			assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
			assert.False(t, decision.Decision)
			assert.True(t, decision.IsError())
		})

		t.Run("a subject for another user is not used", func(t *testing.T) {
			expectNoPDP(t)
			rctx := th.Context.
				WithSession(&model.Session{Id: model.NewId(), UserId: th.BasicUser.Id, Roles: th.BasicUser.Roles}).
				WithSubject(&model.Subject{ID: th.BasicUser2.Id, Type: "user"})

			_, appErr := th.App.AccessEvaluation(rctx, systemRequest(testDelegablePermission))
			require.NotNil(t, appErr)
			assert.Equal(t, "app.access_control.missing_subject.app_error", appErr.Id)
		})

		t.Run("checking another user's access denies", func(t *testing.T) {
			expectNoPDP(t)
			req := systemRequest(model.PermissionManageSystem)
			req.Subject = model.Subject{ID: th.BasicUser.Id}

			decision, appErr := th.App.AccessEvaluation(admin, req)
			require.Nil(t, appErr)
			assert.False(t, decision.Decision)
		})

		t.Run("an RBAC error denies with the error without asking ABAC", func(t *testing.T) {
			expectNoPDP(t)
			useRBACFailureStore(t, th, true, false)

			decision, appErr := th.App.AccessEvaluation(admin, systemRequest(testDelegablePermission))
			require.NotNil(t, appErr)
			assert.False(t, decision.Decision)
			assert.True(t, decision.IsError())
		})

		t.Run("a resource type other than the action's is an error", func(t *testing.T) {
			expectNoPDP(t)
			req := systemRequest(testDelegablePermission)
			req.Resource = model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: th.BasicTeam.Id}

			decision, appErr := th.App.AccessEvaluation(admin, req)
			require.NotNil(t, appErr)
			assert.Equal(t, "app.access_control.access_evaluation.resource_type_mismatch.app_error", appErr.Id)
			assert.False(t, decision.Decision)
		})

		t.Run("channel membership is reported from whichever engine decides", func(t *testing.T) {
			req := model.AccessRequest{
				Action:   testChannelPermission.Id,
				Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id},
			}

			expectPDP(t, model.NewNoPolicyAccessDecision(), nil)
			decision, appErr := th.App.AccessEvaluation(user, req)
			require.Nil(t, appErr)
			assert.True(t, decision.Decision)
			isMember, ok := decision.IsMember()
			assert.True(t, ok)
			assert.True(t, isMember)

			expectPDP(t, model.AccessDecision{Decision: false}, nil)
			decision, appErr = th.App.AccessEvaluation(user, req)
			require.Nil(t, appErr)
			assert.False(t, decision.Decision)
			isMember, ok = decision.IsMember()
			assert.True(t, ok)
			assert.True(t, isMember)

			expectPDP(t, model.AccessDecision{Decision: true}, nil)
			nonMember := th.CreateUser(t)
			decision, appErr = th.App.AccessEvaluation(sessionContext(th, nonMember), model.AccessRequest{
				Action:   testChannelPermission.Id,
				Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id},
			})
			require.Nil(t, appErr)
			assert.True(t, decision.Decision, "a policy grants the action to a non-member")
			isMember, ok = decision.IsMember()
			assert.True(t, ok)
			assert.False(t, isMember)
		})
	})

	t.Run("with ABAC inactive", func(t *testing.T) {
		setABACInactive(t, th)

		t.Run("without a stored policy, RBAC decides", func(t *testing.T) {
			decision, appErr := th.App.AccessEvaluation(admin, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.True(t, decision.Decision)

			decision, appErr = th.App.AccessEvaluation(user, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.False(t, decision.Decision, "RBAC no opinion denies")
		})

		t.Run("a stored policy on the action denies everyone", func(t *testing.T) {
			savePermissionPolicy(t, th, testDelegableAction)

			decision, appErr := th.App.AccessEvaluation(admin, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.False(t, decision.Decision)

			decision, appErr = th.App.AccessEvaluation(user, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.False(t, decision.Decision)

			decision, appErr = th.App.AccessEvaluation(admin, systemRequest(testRestrictedPermission))
			require.Nil(t, appErr)
			assert.True(t, decision.Decision, "a policy on another action does not govern this one")
		})

		t.Run("a stored-policy lookup error denies with the error", func(t *testing.T) {
			original := th.App.Srv().Store()
			th.App.Srv().SetStore(&policySearchFailureStore{Store: original})
			t.Cleanup(func() { th.App.Srv().SetStore(original) })

			decision, appErr := th.App.AccessEvaluation(admin, systemRequest(testDelegablePermission))
			require.NotNil(t, appErr)
			assert.Equal(t, "app.access_control.has_stored_policy.app_error", appErr.Id)
			assert.True(t, decision.IsError())
		})

		t.Run("an unlicensed server with ABAC enabled uses the stored-policy check", func(t *testing.T) {
			setABACActive(t, th, &mocks.AccessControlServiceInterface{})
			require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise)))
			t.Cleanup(func() { setABACInactive(t, th) })
			savePermissionPolicy(t, th, testDelegableAction)

			decision, appErr := th.App.AccessEvaluation(admin, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.False(t, decision.Decision)
		})

		t.Run("ABAC enabled without the access-control service does not panic", func(t *testing.T) {
			original := th.App.Srv().ch.AccessControl
			th.App.Srv().ch.AccessControl = nil
			t.Cleanup(func() { th.App.Srv().ch.AccessControl = original })
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
				cfg.FeatureFlags.PermissionPolicies = true
			})
			t.Cleanup(func() { setABACInactive(t, th) })

			decision, appErr := th.App.AccessEvaluation(admin, systemRequest(testDelegablePermission))
			require.Nil(t, appErr)
			assert.True(t, decision.Decision)
		})
	})

	t.Run("local mode bypasses both engines", func(t *testing.T) {
		acs := &mocks.AccessControlServiceInterface{}
		setABACActive(t, th, acs)
		local := th.Context.WithSession(&model.Session{Local: true})

		decision, appErr := th.App.AccessEvaluation(local, systemRequest(testRestrictedPermission))
		require.Nil(t, appErr)
		assert.True(t, decision.Decision)

		setABACInactive(t, th)
		savePermissionPolicy(t, th, testDelegableAction)
		decision, appErr = th.App.AccessEvaluation(local, systemRequest(testDelegablePermission))
		require.Nil(t, appErr)
		assert.True(t, decision.Decision, "a stored policy does not restrict local mode")

		_, appErr = th.App.AccessEvaluation(local, model.AccessRequest{
			Action:   testChannelPermission.Id,
			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel},
		})
		require.NotNil(t, appErr, "local mode still rejects a missing channel ID")

		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}

func TestEvaluateRBAC(t *testing.T) {
	th := Setup(t).InitBasic(t)
	registerTestActions(t)

	user := sessionContext(th, th.BasicUser)

	t.Run("a grant allows", func(t *testing.T) {
		d, appErr := th.App.evaluateRBAC(user, systemRequest(model.PermissionCreateTeam))
		require.Nil(t, appErr)
		assert.True(t, d.Decision)
		assert.False(t, d.IsNoPolicy())
	})

	t.Run("a missing grant on a grantable action has no opinion", func(t *testing.T) {
		d, appErr := th.App.evaluateRBAC(user, systemRequest(testDelegablePermission))
		require.Nil(t, appErr)
		assert.True(t, d.IsNoPolicy())
	})

	t.Run("a missing grant on a non-grantable action denies", func(t *testing.T) {
		d, appErr := th.App.evaluateRBAC(user, systemRequest(testRestrictedPermission))
		require.Nil(t, appErr)
		assert.False(t, d.Decision)
		assert.False(t, d.IsNoPolicy())
	})

	t.Run("team resources use team roles", func(t *testing.T) {
		d, appErr := th.App.evaluateRBAC(user, model.AccessRequest{
			Action:   model.PermissionViewTeam.Id,
			Resource: model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: th.BasicTeam.Id},
		})
		require.Nil(t, appErr)
		assert.False(t, d.Decision, "the session holds no team membership")

		member := th.Context.WithSession(&model.Session{
			Id:          model.NewId(),
			UserId:      th.BasicUser.Id,
			Roles:       th.BasicUser.Roles,
			TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, UserId: th.BasicUser.Id, Roles: model.TeamUserRoleId}},
		})
		d, appErr = th.App.evaluateRBAC(member, model.AccessRequest{
			Action:   model.PermissionViewTeam.Id,
			Resource: model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: th.BasicTeam.Id},
		})
		require.Nil(t, appErr)
		assert.True(t, d.Decision)

		_, appErr = th.App.evaluateRBAC(user, model.AccessRequest{
			Action:   model.PermissionViewTeam.Id,
			Resource: model.Resource{Type: model.AccessControlPolicyTypeTeam},
		})
		require.NotNil(t, appErr)
	})

	t.Run("channel resources report membership", func(t *testing.T) {
		d, appErr := th.App.evaluateRBAC(user, model.AccessRequest{
			Action:   model.PermissionReadChannel.Id,
			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id},
		})
		require.Nil(t, appErr)
		assert.True(t, d.Decision)
		isMember, ok := d.IsMember()
		assert.True(t, ok)
		assert.True(t, isMember)
	})

	t.Run("a channel lookup error keeps the membership found", func(t *testing.T) {
		useRBACFailureStore(t, th, true, false)

		d, appErr := th.App.evaluateRBAC(user, model.AccessRequest{
			Action:   model.PermissionReadChannel.Id,
			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id},
		})
		require.NotNil(t, appErr)
		assert.True(t, d.IsError())
		assert.False(t, d.Decision)
		_, ok := d.IsMember()
		assert.True(t, ok)
	})
}
