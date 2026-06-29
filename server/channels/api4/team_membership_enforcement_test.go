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

// TestTeamDirectoryABACVisibility pins the team-membership ABAC security boundary
// at the HTTP layer. Enforcement is mode-dependent: a private (non-open-invite)
// governed team is strict — surfaced into the directory candidate list only to be
// hidden from non-qualifying regular users and shown to qualifying ones — while a
// public (open-invite) governed team is advisory and stays visible to everyone.
// System Admins remain exempt from directory hiding (visibility != access), yet
// the join gate still denies a System Admin who fails a private team's policy (no
// role bypass).
func TestTeamDirectoryABACVisibility(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	defer th.App.Srv().SetLicense(nil)

	// Governed team owned by the System Admin so the regular user is a non-member.
	// Left non-open-invite (the CreateTeam default) so it is private/strict: a
	// regular user could not list it at all absent ABAC — the governed-team listing
	// flow surfaces it, and the directory filter then narrows by qualification.
	team := th.CreateTeamWithClient(t, th.SystemAdminClient)
	require.False(t, team.AllowOpenInvite, "the strict-mode team must not be open-invite")

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
		t.Cleanup(func() { _ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, teamID) })
	}
	saveTeamPolicy(t, team.Id)

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

		// The creator is auto-joined, and the gate only runs on a genuine join — so
		// remove the admin first to attempt a real non-member join against the policy.
		_, err := th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.NoError(t, err)

		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.Error(t, err, "directory visibility must not translate into join access for an admin")
		CheckForbiddenStatus(t, resp)
	})

	t.Run("ungoverned private team is never surfaced to a regular user (listing flow stays scoped)", func(t *testing.T) {
		// The governed-team listing must widen only to policy-enforced teams; a
		// plain private team with no policy must remain invisible to a regular user.
		privateTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		require.False(t, privateTeam.AllowOpenInvite)

		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		teams, _, err := th.Client.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.False(t, containsTeam(teams, privateTeam.Id), "an ungoverned private team must never appear in a regular user's directory")
	})

	t.Run("public governed team stays visible to a non-qualifying regular user (advisory mode)", func(t *testing.T) {
		// A public (open-invite) governed team: the policy is advisory, so the team
		// is never hidden even from a user the PDP would reject.
		publicTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		allowOpen := true
		_, appErr := th.App.PatchTeam(publicTeam.Id, &model.TeamPatch{AllowOpenInvite: &allowOpen})
		require.Nil(t, appErr)
		saveTeamPolicy(t, publicTeam.Id)

		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		teams, _, err := th.Client.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.True(t, containsTeam(teams, publicTeam.Id), "a public governed team must remain visible regardless of qualification")
	})
}
