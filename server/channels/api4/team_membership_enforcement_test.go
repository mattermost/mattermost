// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// containsTeam reports whether teamID appears in the slice.
func containsTeam(teams []*model.Team, teamID string) bool {
	for _, tm := range teams {
		if tm != nil && tm.Id == teamID {
			return true
		}
	}
	return false
}

// TestTeamDirectoryABACVisibility pins the P1-17 security boundary at the HTTP
// layer: governed teams are hidden from non-qualifying regular users on every
// reachable directory surface, System Admins remain exempt from directory hiding
// (visibility != access), yet the join gate still denies a System Admin who fails
// the policy (no role bypass).
func TestTeamDirectoryABACVisibility(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	defer th.App.Srv().SetLicense(nil)

	// Governed, open-invite team owned by the System Admin so the regular user is
	// a non-member who can still browse it absent the policy (ListPublicTeams).
	team := th.CreateTeamWithClient(t, th.SystemAdminClient)
	allowOpen := true
	_, appErr := th.App.PatchTeam(team.Id, &model.TeamPatch{AllowOpenInvite: &allowOpen})
	require.Nil(t, appErr)

	policy := &model.AccessControlPolicy{
		ID:       team.Id,
		Type:     model.AccessControlPolicyTypeTeam,
		Name:     "policy-" + team.Id,
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
	t.Cleanup(func() { _ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, team.Id) })

	setMockACS := func(t *testing.T) *mocks.AccessControlServiceInterface {
		t.Helper()
		m := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = m
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = nil })
		return m
	}

	t.Run("non-qualifying regular user: governed team hidden from GET /teams", func(t *testing.T) {
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		teams, _, err := th.Client.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.False(t, containsTeam(teams, team.Id), "a non-qualifying non-member must not see the governed team in the directory")
		// Response carries no policy metadata: PolicyEnforced is the only ABAC-derived
		// field on the wire and it never names the policy/rules/attributes.
		for _, tm := range teams {
			require.Empty(t, tm.PolicyActions, "directory payload must not leak hydrated policy actions")
		}
	})

	t.Run("non-qualifying regular user: governed team hidden from POST /teams/search", func(t *testing.T) {
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		teams, _, err := th.Client.SearchTeams(context.Background(), &model.TeamSearch{Term: team.Name})
		require.NoError(t, err)
		require.False(t, containsTeam(teams, team.Id), "search must not surface the governed team to a non-qualifying user")
	})

	t.Run("qualifying regular user sees the governed team", func(t *testing.T) {
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		teams, _, err := th.Client.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.True(t, containsTeam(teams, team.Id), "a qualifying user must see the governed team")
	})

	t.Run("system admin is exempt from directory hiding (visibility, not access)", func(t *testing.T) {
		m := setMockACS(t)
		// Decision intentionally not stubbed: the ManageSystem exemption must skip
		// the filter entirely, so no PDP call happens for the admin's browse.

		teams, _, err := th.SystemAdminClient.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.True(t, containsTeam(teams, team.Id), "the System Console list must stay complete for admins")
		m.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("system admin who fails the policy is still denied the join (no role bypass)", func(t *testing.T) {
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.Error(t, err, "directory visibility must not translate into join access for an admin")
		CheckForbiddenStatus(t, resp)
	})
}
