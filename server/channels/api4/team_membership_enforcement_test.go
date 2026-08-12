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

// teamID returns a team's ID, tolerating nil entries so directory slices that
// may carry gaps don't panic the membership lookups.
func teamID(t *model.Team) string {
	if t == nil {
		return ""
	}
	return t.Id
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
		require.False(t, containsByID(teams, team.Id, teamID), "a non-qualifying non-member must not see the governed team in the directory")
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
		require.False(t, containsByID(teams, team.Id, teamID), "search must not surface the governed team to a non-qualifying user")
	})

	t.Run("qualifying regular user sees the governed team", func(t *testing.T) {
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		teams, _, err := th.Client.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.True(t, containsByID(teams, team.Id, teamID), "a qualifying user must see the governed team")
	})

	t.Run("system admin is exempt from directory hiding (visibility, not access)", func(t *testing.T) {
		m := setMockACS(t)
		// Decision intentionally not stubbed: the ManageSystem exemption must skip
		// the filter entirely, so no PDP call happens for the admin's browse.

		teams, _, err := th.SystemAdminClient.GetAllTeams(context.Background(), "", 0, 200)
		require.NoError(t, err)
		require.True(t, containsByID(teams, team.Id, teamID), "the System Console list must stay complete for admins")
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
		require.False(t, containsByID(teams, privateTeam.Id, teamID), "an ungoverned private team must never appear in a regular user's directory")
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
		require.True(t, containsByID(teams, publicTeam.Id, teamID), "a public governed team must remain visible regardless of qualification")
	})
}

// TestTeamSelfJoinABACAttributeGating pins that on an ABAC-governed team, a user's
// self-join is authorized by attribute match (the JoinUserToTeam gate), not by the
// join_private_teams role: a qualifying regular user can self-join a private
// governed team even without that role. Non-governed private teams keep the role
// gate exactly as on master, and the bypass is strictly conditional on team ABAC
// being enabled (license + feature flag + config).
func TestTeamSelfJoinABACAttributeGating(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	defer th.App.Srv().SetLicense(nil)

	// Log in as BasicUser (a regular user without join_private_teams) so
	// AddTeamMember(self) is a real self-join.
	th.LoginBasic(t)
	require.False(t, th.App.SessionHasPermissionTo(model.Session{Roles: model.SystemUserRoleId}, model.PermissionJoinPrivateTeams),
		"the base system_user role must not hold join_private_teams, or this test is meaningless")

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

	// Admin-owned so BasicUser is a non-member.
	newPrivateTeam := func(t *testing.T, governed bool) *model.Team {
		t.Helper()
		team := th.CreateTeamWithClient(t, th.SystemAdminClient)
		require.False(t, team.AllowOpenInvite, "fixture must be a private/strict team")
		if governed {
			saveTeamPolicy(t, team.Id)
		}
		return team
	}

	setMockACS := func(t *testing.T) *mocks.AccessControlServiceInterface {
		t.Helper()
		m := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = m
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = nil })
		return m
	}

	t.Run("ABAC strict: qualifying regular user self-joins without join_private_teams", func(t *testing.T) {
		team := newPrivateTeam(t, true)
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		_, resp, err := th.Client.AddTeamMember(context.Background(), team.Id, th.BasicUser.Id)
		require.NoError(t, err, "a qualifying regular user must be admitted by attribute match")
		CheckCreatedStatus(t, resp)

		_, appErr := th.App.GetTeamMember(th.Context, team.Id, th.BasicUser.Id)
		require.Nil(t, appErr, "the user must actually be a member after a successful self-join")
	})

	t.Run("ABAC strict: non-qualifying regular user is denied by the policy", func(t *testing.T) {
		team := newPrivateTeam(t, true)
		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		_, resp, err := th.Client.AddTeamMember(context.Background(), team.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("ABAC strict: admin with join_private_teams who fails the policy is still denied (no role bypass)", func(t *testing.T) {
		team := newPrivateTeam(t, true)
		// Creator is auto-joined; remove first so the gate runs on a real join.
		_, err := th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.NoError(t, err)

		m := setMockACS(t)
		m.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-ABAC private team: regular user still blocked by join_private_teams (master behavior)", func(t *testing.T) {
		team := newPrivateTeam(t, false)

		_, resp, err := th.Client.AddTeamMember(context.Background(), team.Id, th.BasicUser.Id)
		require.Error(t, err, "a non-governed private team must still require the role")
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-ABAC private team: admin self-join still succeeds (master behavior)", func(t *testing.T) {
		team := newPrivateTeam(t, false)
		// The admin is auto-joined as creator; remove then re-add to exercise the gate.
		_, err := th.SystemAdminClient.RemoveTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.NoError(t, err)

		_, resp, err := th.SystemAdminClient.AddTeamMember(context.Background(), team.Id, th.SystemAdminUser.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("governed team but ABAC disabled (no license): role gate applies, bypass is strictly gated", func(t *testing.T) {
		team := newPrivateTeam(t, true)

		// Feature off: the stored policy must not loosen the role gate.
		th.App.Srv().SetLicense(nil)
		defer func() {
			require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
		}()

		_, resp, err := th.Client.AddTeamMember(context.Background(), team.Id, th.BasicUser.Id)
		require.Error(t, err, "with team ABAC disabled the join_private_teams role must be required again")
		CheckForbiddenStatus(t, resp)
	})

	t.Run("public governed team (advisory): regular user joins via join_public_teams, PDP not consulted by the gate", func(t *testing.T) {
		team := th.CreateTeamWithClient(t, th.SystemAdminClient)
		allowOpen := true
		_, appErr := th.App.PatchTeam(team.Id, &model.TeamPatch{AllowOpenInvite: &allowOpen})
		require.Nil(t, appErr)
		saveTeamPolicy(t, team.Id)

		m := setMockACS(t)

		_, resp, err := th.Client.AddTeamMember(context.Background(), team.Id, th.BasicUser.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		m.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}
