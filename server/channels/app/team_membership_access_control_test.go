// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestHydrateTeamPolicyActions(t *testing.T) {
	t.Run("Team without an enforced policy is a no-op (no store call, PolicyActions stays nil)", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		team := &model.Team{Id: model.NewId(), PolicyEnforced: false}
		appErr := thMock.App.HydrateTeamPolicyActions(thMock.Context, team)
		require.Nil(t, appErr)
		require.Nil(t, team.PolicyActions, "non-enforced teams must not have an empty map injected")
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicy", mock.Anything, mock.Anything)
	})

	t.Run("Nil team pointer is a defensive no-op", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		appErr := thMock.App.HydrateTeamPolicyActions(thMock.Context, nil)
		require.Nil(t, appErr)
	})

	t.Run("Membership-only policy hydrates PolicyActions with membership key", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		teamID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, teamID).
			Return(map[string]bool{model.AccessControlPolicyActionMembership: true}, nil).Once()

		team := &model.Team{Id: teamID, PolicyEnforced: true}
		appErr := thMock.App.HydrateTeamPolicyActions(thMock.Context, team)
		require.Nil(t, appErr)
		require.True(t, team.HasMembershipPolicyAction())
		mockACPStore.AssertExpectations(t)
	})

	t.Run("Permission-only policy hydrates without the membership key", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		teamID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, teamID).
			Return(map[string]bool{model.AccessControlPolicyActionUploadFileAttachment: true}, nil).Once()

		team := &model.Team{Id: teamID, PolicyEnforced: true}
		appErr := thMock.App.HydrateTeamPolicyActions(thMock.Context, team)
		require.Nil(t, appErr)
		require.False(t, team.HasMembershipPolicyAction(), "permission-only policy must NOT report membership")
	})

	t.Run("Policy missing in store returns nil and sets empty map", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		teamID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, teamID).
			Return(nil, store.NewErrNotFound("AccessControlPolicy", teamID)).Once()

		team := &model.Team{Id: teamID, PolicyEnforced: true}
		appErr := thMock.App.HydrateTeamPolicyActions(thMock.Context, team)
		require.Nil(t, appErr, "ErrNotFound must be swallowed")
		require.NotNil(t, team.PolicyActions)
		require.Empty(t, team.PolicyActions)
	})

	t.Run("Unexpected store error is surfaced and PolicyActions stays nil", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		teamID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, teamID).
			Return(nil, errors.New("boom")).Once()

		team := &model.Team{Id: teamID, PolicyEnforced: true}
		appErr := thMock.App.HydrateTeamPolicyActions(thMock.Context, team)
		require.NotNil(t, appErr, "non-not-found store errors must propagate so callers can fail-closed")
		require.Equal(t, "app.pap.hydrate_actions.app_error", appErr.Id)
		require.Nil(t, team.PolicyActions)
	})
}

func TestHydrateTeamsPolicyActions(t *testing.T) {
	t.Run("Empty slice is a no-op", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		appErr := thMock.App.HydrateTeamsPolicyActions(thMock.Context, nil)
		require.Nil(t, appErr)
		appErr = thMock.App.HydrateTeamsPolicyActions(thMock.Context, []*model.Team{})
		require.Nil(t, appErr)
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicies", mock.Anything, mock.Anything)
	})

	t.Run("Slice with only non-enforced teams skips the store entirely", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		teams := []*model.Team{
			{Id: model.NewId(), PolicyEnforced: false},
			{Id: model.NewId(), PolicyEnforced: false},
		}
		appErr := thMock.App.HydrateTeamsPolicyActions(thMock.Context, teams)
		require.Nil(t, appErr)
		for _, team := range teams {
			require.Nil(t, team.PolicyActions)
		}
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicies", mock.Anything, mock.Anything)
	})

	t.Run("Mixed slice issues a single batched call for enforced teams only", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		enforced1 := model.NewId()
		enforced2 := model.NewId()
		teams := []*model.Team{
			{Id: enforced1, PolicyEnforced: true},
			{Id: model.NewId(), PolicyEnforced: false},
			{Id: enforced2, PolicyEnforced: true},
		}

		// The whole point of the batch hydrator: exactly one grouped store
		// call carrying only the enforced IDs, never one call per team.
		mockACPStore.On("GetActionsForPolicies", thMock.Context, mock.MatchedBy(func(ids []string) bool {
			if len(ids) != 2 {
				return false
			}
			have := map[string]bool{}
			for _, id := range ids {
				have[id] = true
			}
			return have[enforced1] && have[enforced2]
		})).Return(map[string]map[string]bool{
			enforced1: {model.AccessControlPolicyActionMembership: true},
			enforced2: {model.AccessControlPolicyActionUploadFileAttachment: true},
		}, nil).Once()

		appErr := thMock.App.HydrateTeamsPolicyActions(thMock.Context, teams)
		require.Nil(t, appErr)
		require.True(t, teams[0].HasMembershipPolicyAction())
		require.Nil(t, teams[1].PolicyActions, "non-enforced teams must remain untouched")
		require.False(t, teams[2].HasMembershipPolicyAction(), "permission-only team must NOT report membership")
		mockACPStore.AssertExpectations(t)
		mockACPStore.AssertNumberOfCalls(t, "GetActionsForPolicies", 1)
	})

	t.Run("Enforced team missing from batch result gets an empty map", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		enforced := model.NewId()
		teams := []*model.Team{{Id: enforced, PolicyEnforced: true}}
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{enforced}).
			Return(map[string]map[string]bool{}, nil).Once()

		appErr := thMock.App.HydrateTeamsPolicyActions(thMock.Context, teams)
		require.Nil(t, appErr)
		require.NotNil(t, teams[0].PolicyActions)
		require.Empty(t, teams[0].PolicyActions)
	})

	t.Run("Underlying batch error is surfaced and teams are left untouched", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		teams := []*model.Team{{Id: model.NewId(), PolicyEnforced: true}}
		mockACPStore.On("GetActionsForPolicies", thMock.Context, mock.Anything).
			Return(nil, errors.New("boom")).Once()

		appErr := thMock.App.HydrateTeamsPolicyActions(thMock.Context, teams)
		require.NotNil(t, appErr)
		require.Equal(t, "app.pap.hydrate_actions.app_error", appErr.Id)
		require.Nil(t, teams[0].PolicyActions)
	})
}

// saveTestTeamPolicy persists an active team-type policy whose ID matches the
// team, so the store's EXISTS subquery reports the team as policy-enforced.
func saveTestTeamPolicy(t *testing.T, th *TestHelper, teamID string, actions ...string) {
	t.Helper()
	policy := &model.AccessControlPolicy{
		ID:       teamID,
		Type:     model.AccessControlPolicyTypeTeam,
		Name:     "policy-" + teamID,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Imports:  []string{},
		Rules: []model.AccessControlPolicyRule{
			{Actions: actions, Expression: "true"},
		},
	}
	_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, teamID)
	})
}

func TestTeamAccessControlled(t *testing.T) {
	// The feature flag must be set at setup time: the config store treats the
	// FeatureFlags section as read-only, so a later UpdateConfig of it is a
	// no-op. EnableAttributeBasedAccessControl and the license are runtime-
	// mutable and toggled per subtest below.
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	}).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)

	saveTeamPolicy := func(t *testing.T, teamID string, actions ...string) {
		t.Helper()
		policy := &model.AccessControlPolicy{
			ID:       teamID,
			Type:     model.AccessControlPolicyTypeTeam,
			Name:     "policy-" + teamID,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_3,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{Actions: actions, Expression: "true"},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, teamID)
		})
	}

	t.Run("team with no policy is not controlled", func(t *testing.T) {
		team := th.CreateTeam(t)
		controlled, appErr := th.App.TeamAccessControlled(th.Context, team.Id)
		require.Nil(t, appErr)
		require.False(t, controlled)
	})

	t.Run("team with a membership policy is controlled", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id, model.AccessControlPolicyActionMembership)

		controlled, appErr := th.App.TeamAccessControlled(th.Context, team.Id)
		require.Nil(t, appErr)
		require.True(t, controlled, "membership policy must make TeamAccessControlled return true")
	})

	t.Run("team with only a permission-type policy is not controlled", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id, model.AccessControlPolicyActionUploadFileAttachment)

		controlled, appErr := th.App.TeamAccessControlled(th.Context, team.Id)
		require.Nil(t, appErr)
		require.False(t, controlled, "a non-membership action must not gate team membership")
	})

	t.Run("config off short-circuits", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id, model.AccessControlPolicyActionMembership)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})

		controlled, appErr := th.App.TeamAccessControlled(th.Context, team.Id)
		require.Nil(t, appErr)
		require.False(t, controlled)
	})

	t.Run("license missing short-circuits", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id, model.AccessControlPolicyActionMembership)

		th.App.Srv().SetLicense(nil)
		defer th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		controlled, appErr := th.App.TeamAccessControlled(th.Context, team.Id)
		require.Nil(t, appErr)
		require.False(t, controlled)
	})
}

// TestTeamAccessControlledFeatureFlagOff exercises the kill switch. The
// FeatureFlags section is read-only at runtime, so the off state is the
// default (no SetupConfig override) — license and config are on, yet an
// assigned membership policy must not engage the gate.
func TestTeamAccessControlledFeatureFlagOff(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)

	team := th.CreateTeam(t)
	saveTestTeamPolicy(t, th, team.Id, model.AccessControlPolicyActionMembership)

	controlled, appErr := th.App.TeamAccessControlled(th.Context, team.Id)
	require.Nil(t, appErr)
	require.False(t, controlled, "the kill switch must disable team ABAC regardless of an assigned policy")
}

func TestValidateTeamEligibilityForAccessControl(t *testing.T) {
	th := Setup(t)

	t.Run("eligible team passes", func(t *testing.T) {
		appErr := th.App.ValidateTeamEligibilityForAccessControl(th.Context, &model.Team{Id: model.NewId()})
		require.Nil(t, appErr)
	})

	t.Run("group-constrained team is rejected", func(t *testing.T) {
		gc := true
		appErr := th.App.ValidateTeamEligibilityForAccessControl(th.Context, &model.Team{Id: model.NewId(), GroupConstrained: &gc})
		require.NotNil(t, appErr)
		require.Equal(t, "api.access_control.assign.team_group_constrained", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestPatchTeamGroupConstrainedPolicyGuard(t *testing.T) {
	th := Setup(t).InitBasic(t)

	saveTeamPolicy := func(t *testing.T, teamID string) {
		t.Helper()
		policy := &model.AccessControlPolicy{
			ID:       teamID,
			Type:     model.AccessControlPolicyTypeTeam,
			Name:     "policy-" + teamID,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_3,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, teamID)
		})
	}

	t.Run("enabling group sync on an ABAC team is rejected", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id)

		gc := true
		_, appErr := th.App.PatchTeam(team.Id, &model.TeamPatch{GroupConstrained: &gc})
		require.NotNil(t, appErr)
		require.Equal(t, "api.team.update.group_constrained.policy_exists", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("enabling group sync on a team without a policy is allowed", func(t *testing.T) {
		team := th.CreateTeam(t)

		gc := true
		patched, appErr := th.App.PatchTeam(team.Id, &model.TeamPatch{GroupConstrained: &gc})
		require.Nil(t, appErr)
		require.True(t, patched.IsGroupConstrained())
	})
}

func TestAssignAccessControlPolicyToTeams(t *testing.T) {
	th := Setup(t).InitBasic(t)

	parentID := model.NewId()
	parentPolicy := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeParent,
		ID:       parentID,
		Name:     "parentPolicy",
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
		},
	}

	t.Run("feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		policies, appErr := th.App.AssignAccessControlPolicyToTeams(th.Context, parentID, []string{})
		require.NotNil(t, appErr)
		require.Nil(t, policies)
		require.Equal(t, "app.pap.assign_access_control_policy_to_teams.app_error", appErr.Id)
	})

	t.Run("policy is not of type parent", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
		mockACS.On("GetPolicy", th.Context, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeTeam}, nil)

		policies, appErr := th.App.AssignAccessControlPolicyToTeams(th.Context, parentID, []string{})
		require.NotNil(t, appErr)
		require.Nil(t, policies)
		require.Equal(t, "app.pap.assign_access_control_policy_to_teams.app_error", appErr.Id)
	})

	t.Run("group-constrained team is rejected", func(t *testing.T) {
		team := th.CreateTeam(t)
		gc := true
		_, appErr := th.App.PatchTeam(team.Id, &model.TeamPatch{GroupConstrained: &gc})
		require.Nil(t, appErr)

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
		mockACS.On("GetPolicy", th.Context, parentID).Return(parentPolicy, nil)

		policies, appErr := th.App.AssignAccessControlPolicyToTeams(th.Context, parentID, []string{team.Id})
		require.NotNil(t, appErr)
		require.Nil(t, policies)
		require.Equal(t, "api.access_control.assign.team_group_constrained", appErr.Id)
	})

	t.Run("successful assignment creates a team-type child that inherits the parent", func(t *testing.T) {
		team := th.CreateTeam(t)

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockACS.On("GetPolicy", th.Context, parentID).Return(parentPolicy, nil)
		mockACS.On("GetPolicy", th.Context, team.Id).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("GetPolicy", "not_found", nil, "", http.StatusNotFound))

		var saved *model.AccessControlPolicy
		mockACS.On("SavePolicy", th.Context, mock.AnythingOfType("*model.AccessControlPolicy")).
			Run(func(args mock.Arguments) { saved = args.Get(1).(*model.AccessControlPolicy) }).
			Return(&model.AccessControlPolicy{ID: team.Id, Type: model.AccessControlPolicyTypeTeam, Imports: []string{parentID}}, nil)

		policies, appErr := th.App.AssignAccessControlPolicyToTeams(th.Context, parentID, []string{team.Id})
		require.Nil(t, appErr)
		require.Len(t, policies, 1)
		require.Equal(t, team.Id, saved.ID)
		require.Equal(t, model.AccessControlPolicyTypeTeam, saved.Type)
		require.Contains(t, saved.Imports, parentID, "Inherit must set Imports to the parent ID")
		mockACS.AssertExpectations(t)
	})

	// Auto-add is the team-child's Active flag. Assigning a policy must not turn
	// it on by itself — the child inherits the parent's Active, so an inactive
	// parent leaves auto-add off (the sync still enforces removal regardless).
	for _, tc := range []struct {
		name         string
		parentActive bool
	}{
		{"inactive parent leaves auto-add off", false},
		{"active parent carries through", true},
	} {
		t.Run("team-child Active mirrors the parent: "+tc.name, func(t *testing.T) {
			team := th.CreateTeam(t)

			activeParent := &model.AccessControlPolicy{
				Type:     model.AccessControlPolicyTypeParent,
				ID:       parentID,
				Name:     "parentPolicy",
				Revision: 1,
				Version:  model.AccessControlPolicyVersionV0_3,
				Active:   tc.parentActive,
				Rules: []model.AccessControlPolicyRule{
					{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
				},
			}

			mockACS := &mocks.AccessControlServiceInterface{}
			th.App.Srv().ch.AccessControl = mockACS
			t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

			mockACS.On("GetPolicy", th.Context, parentID).Return(activeParent, nil)
			mockACS.On("GetPolicy", th.Context, team.Id).
				Return((*model.AccessControlPolicy)(nil), model.NewAppError("GetPolicy", "not_found", nil, "", http.StatusNotFound))

			var saved *model.AccessControlPolicy
			mockACS.On("SavePolicy", th.Context, mock.AnythingOfType("*model.AccessControlPolicy")).
				Run(func(args mock.Arguments) { saved = args.Get(1).(*model.AccessControlPolicy) }).
				Return(&model.AccessControlPolicy{ID: team.Id, Type: model.AccessControlPolicyTypeTeam}, nil)

			_, appErr := th.App.AssignAccessControlPolicyToTeams(th.Context, parentID, []string{team.Id})
			require.Nil(t, appErr)
			require.Equal(t, tc.parentActive, saved.Active, "team-child Active must equal the parent's, never be force-enabled")
		})
	}
}

func TestUnassignPoliciesFromTeams(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("child with no remaining imports or rules is deleted", func(t *testing.T) {
		team := th.CreateTeam(t)
		parentID := model.NewId()

		child := &model.AccessControlPolicy{
			ID:       team.Id,
			Type:     model.AccessControlPolicyTypeTeam,
			Name:     "child-" + team.Id,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_3,
			Imports:  []string{parentID},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
		require.NoError(t, err)
		t.Cleanup(func() { _ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, team.Id) })

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockACS.On("GetPolicy", th.Context, team.Id).Return(&model.AccessControlPolicy{
			ID:      team.Id,
			Type:    model.AccessControlPolicyTypeTeam,
			Imports: []string{parentID},
		}, nil)
		deleted := false
		mockACS.On("DeletePolicy", th.Context, team.Id).
			Run(func(mock.Arguments) { deleted = true }).Return((*model.AppError)(nil))

		appErr := th.App.UnassignPoliciesFromTeams(th.Context, parentID, []string{team.Id})
		require.Nil(t, appErr)
		require.True(t, deleted, "a child left with no imports and no rules must be deleted")
		mockACS.AssertExpectations(t)
	})

	t.Run("child with custom rules is kept after the import is stripped", func(t *testing.T) {
		team := th.CreateTeam(t)
		parentID := model.NewId()

		child := &model.AccessControlPolicy{
			ID:       team.Id,
			Type:     model.AccessControlPolicyTypeTeam,
			Name:     "child-" + team.Id,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_3,
			Imports:  []string{parentID},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
		require.NoError(t, err)
		t.Cleanup(func() { _ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, team.Id) })

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockACS.On("GetPolicy", th.Context, team.Id).Return(&model.AccessControlPolicy{
			ID:      team.Id,
			Type:    model.AccessControlPolicyTypeTeam,
			Imports: []string{parentID},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}, nil)

		var saved *model.AccessControlPolicy
		mockACS.On("SavePolicy", th.Context, mock.AnythingOfType("*model.AccessControlPolicy")).
			Run(func(args mock.Arguments) { saved = args.Get(1).(*model.AccessControlPolicy) }).
			Return(&model.AccessControlPolicy{ID: team.Id, Type: model.AccessControlPolicyTypeTeam}, nil)

		appErr := th.App.UnassignPoliciesFromTeams(th.Context, parentID, []string{team.Id})
		require.Nil(t, appErr)
		require.NotNil(t, saved)
		require.NotContains(t, saved.Imports, parentID, "the parent import must be stripped")
		require.Len(t, saved.Rules, 1, "the team admin's custom rules must survive the unassign")
		mockACS.AssertNotCalled(t, "DeletePolicy", mock.Anything, mock.Anything)
	})
}

func TestCleanupTeamAccessControlPolicyOnDelete(t *testing.T) {
	th := Setup(t).InitBasic(t)

	saveTeamPolicy := func(t *testing.T, teamID string) {
		t.Helper()
		policy := &model.AccessControlPolicy{
			ID:       teamID,
			Type:     model.AccessControlPolicyTypeTeam,
			Name:     "policy-" + teamID,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_3,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
	}

	// With no enterprise access control service wired, cleanup falls back to
	// deleting the policy row directly through the store.
	t.Run("archive removes the team policy row", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id)

		appErr := th.App.SoftDeleteTeam(team.Id)
		require.Nil(t, appErr)

		_, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, team.Id)
		require.Error(t, err, "archiving a team must not leave an orphan policy row")
		require.IsType(t, &store.ErrNotFound{}, err)
	})

	t.Run("permanent delete removes the team policy row", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicy(t, team.Id)

		appErr := th.App.PermanentDeleteTeam(th.Context, team)
		require.Nil(t, appErr)

		_, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, team.Id)
		require.Error(t, err, "permanently deleting a team must not leave an orphan policy row")
		require.IsType(t, &store.ErrNotFound{}, err)
	})
}

func TestGetUsersNotInAbacTeam(t *testing.T) {
	t.Run("access control service unavailable returns an error", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		thMock.App.Srv().ch.AccessControl = nil

		users, appErr := thMock.App.GetUsersNotInAbacTeam(thMock.Context, model.NewId(), "", 50, true)
		require.NotNil(t, appErr)
		require.Nil(t, users)
		require.Equal(t, "api.user.get_users_not_in_abac_team.access_control_unavailable.app_error", appErr.Id)
	})

	t.Run("qualifying users are returned via QueryUsersForResource", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		teamID := model.NewId()

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		want := []*model.User{{Id: model.NewId(), Username: model.NewUsername()}}
		mockACS.On("QueryUsersForResource", th.Context, teamID, model.AccessControlPolicyActionMembership, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.Limit == 25 && opts.Cursor.TargetID == "cursor-id"
		})).Return(want, int64(1), (*model.AppError)(nil))

		users, appErr := th.App.GetUsersNotInAbacTeam(th.Context, teamID, "cursor-id", 25, true)
		require.Nil(t, appErr)
		require.Len(t, users, 1)
		require.Equal(t, want[0].Id, users[0].Id)
		mockACS.AssertExpectations(t)
	})
}
