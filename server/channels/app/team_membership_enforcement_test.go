// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// setupTeamABACEnforcement returns a TestHelper with the team ABAC kill switch,
// license, and config all enabled — the only state under which the JoinUserToTeam
// gate engages. The feature flag must be set at setup time because the config
// store treats the FeatureFlags section as read-only at runtime.
func setupTeamABACEnforcement(t *testing.T) *TestHelper {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	}).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	t.Cleanup(func() { th.App.Srv().SetLicense(nil) })
	return th
}

func setMockACS(t *testing.T, th *TestHelper) *mocks.AccessControlServiceInterface {
	t.Helper()
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
	return mockACS
}

func TestJoinUserToTeamAccessControlEnforcement(t *testing.T) {
	th := setupTeamABACEnforcement(t)

	// newEnforcedTeam creates a team governed by an active membership policy.
	newEnforcedTeam := func(t *testing.T) *model.Team {
		t.Helper()
		team := th.CreateTeam(t)
		saveTestTeamPolicy(t, th, team.Id, model.AccessControlPolicyActionMembership)
		return team
	}

	t.Run("qualifying user is admitted", func(t *testing.T) {
		team := newEnforcedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.Nil(t, appErr)
		acs.AssertExpectations(t)
	})

	t.Run("non-qualifying user is denied with a generic 403 carrying no policy detail", func(t *testing.T) {
		team := newEnforcedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.NotNil(t, appErr)
		require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		// No-enumeration: the denial must carry no resource- or policy-specific
		// detail that could be used to probe attributes.
		require.Empty(t, appErr.DetailedError)
	})

	t.Run("two distinct failing policies produce byte-identical denials (no enumeration)", func(t *testing.T) {
		teamA := newEnforcedTeam(t)
		teamB := newEnforcedTeam(t)
		userA := th.CreateUser(t)
		userB := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		_, _, errA := th.App.AddUserToTeam(th.Context, teamA.Id, userA.Id, "")
		_, _, errB := th.App.AddUserToTeam(th.Context, teamB.Id, userB.Id, "")
		require.NotNil(t, errA)
		require.NotNil(t, errB)
		require.Equal(t, errA.Id, errB.Id)
		require.Equal(t, errA.Message, errB.Message)
		require.Equal(t, errA.DetailedError, errB.DetailedError)
		require.Equal(t, errA.StatusCode, errB.StatusCode)
	})

	t.Run("PDP evaluation error is propagated (fail-closed, never open)", func(t *testing.T) {
		team := newEnforcedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		evalErr := model.NewAppError("AccessEvaluation", "pdp.boom", nil, "", http.StatusInternalServerError)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{}, evalErr)

		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.NotNil(t, appErr, "an eval error must deny the join, not admit it")

		// The user must not have been added.
		_, memberErr := th.App.GetTeamMember(th.Context, team.Id, user.Id)
		require.NotNil(t, memberErr)
	})

	t.Run("unavailable PDP denies a governed join (no silent allow)", func(t *testing.T) {
		team := newEnforcedTeam(t)
		user := th.CreateUser(t)
		// No AccessControl service wired, yet license/config/flag and a policy
		// are all present: the team is governed but unevaluable → deny.
		th.App.Srv().ch.AccessControl = nil

		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.NotNil(t, appErr)
		require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	t.Run("system admin who fails the policy is denied (no role bypass)", func(t *testing.T) {
		team := newEnforcedTeam(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, th.SystemAdminUser.Id, "")
		require.NotNil(t, appErr)
		require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
	})

	t.Run("every programmatic add entry point funnels through the gate", func(t *testing.T) {
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		t.Run("AddUserToTeam", func(t *testing.T) {
			team := newEnforcedTeam(t)
			user := th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
			require.NotNil(t, appErr)
			require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
		})

		t.Run("AddUserToTeamByTeamId", func(t *testing.T) {
			team := newEnforcedTeam(t)
			user := th.CreateUser(t)
			appErr := th.App.AddUserToTeamByTeamId(th.Context, team.Id, user)
			require.NotNil(t, appErr)
			require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
		})

		t.Run("AddUserToTeamByToken", func(t *testing.T) {
			team := newEnforcedTeam(t)
			user := th.CreateUser(t)
			token := model.NewToken(
				model.TokenTypeTeamInvitation,
				model.MapToJSON(map[string]string{"teamId": team.Id}),
			)
			require.NoError(t, th.App.Srv().Store().Token().Save(token))
			defer func() { _ = th.App.DeleteToken(token) }()

			_, _, appErr := th.App.AddUserToTeamByToken(th.Context, user.Id, token.Token)
			require.NotNil(t, appErr)
			require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
		})

		t.Run("AddUserToTeamByInviteId", func(t *testing.T) {
			team := newEnforcedTeam(t)
			user := th.CreateUser(t)
			_, _, appErr := th.App.AddUserToTeamByInviteId(th.Context, team.InviteId, user.Id)
			require.NotNil(t, appErr)
			require.Equal(t, "api.team.add_user.to.team.rejected", appErr.Id)
		})
	})

	t.Run("batch add surfaces ABAC denial per-user without aborting the batch (graceful)", func(t *testing.T) {
		team := newEnforcedTeam(t)
		denied := th.CreateUser(t)
		admitted := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == admitted.Id
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
		acs.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == denied.Id
		})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		results, appErr := th.App.AddTeamMembers(th.Context, team.Id, []string{denied.Id, admitted.Id}, "", true)
		require.Nil(t, appErr, "graceful batch must not abort on a per-user denial")

		byUser := map[string]*model.TeamMemberWithError{}
		for _, r := range results {
			byUser[r.UserId] = r
		}
		require.NotNil(t, byUser[denied.Id].Error, "denied user must carry an error entry")
		require.Equal(t, "api.team.add_user.to.team.rejected", byUser[denied.Id].Error.Id)
		require.Nil(t, byUser[admitted.Id].Error, "qualifying user must be added")
	})

	t.Run("join to a non-ABAC team is unaffected (no PDP call)", func(t *testing.T) {
		team := th.CreateTeam(t) // no policy assigned
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		// AccessEvaluation intentionally not stubbed: it must never be called.

		_, _, appErr := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.Nil(t, appErr)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("public governed team admits any user without consulting the PDP (advisory mode)", func(t *testing.T) {
		team := th.CreateTeam(t)
		team.AllowOpenInvite = true // public → advisory: the policy must not gate join
		team, appErr := th.App.UpdateTeam(team)
		require.Nil(t, appErr)
		saveTestTeamPolicy(t, th, team.Id, model.AccessControlPolicyActionMembership)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		// AccessEvaluation intentionally not stubbed: advisory mode must never call it.

		_, _, appErr = th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.Nil(t, appErr)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}

func TestFilterNonQualifyingTeamsForUser(t *testing.T) {
	th := setupTeamABACEnforcement(t)

	governedTeam := func(t *testing.T) *model.Team {
		t.Helper()
		team := th.CreateTeam(t)
		saveTestTeamPolicy(t, th, team.Id, model.AccessControlPolicyActionMembership)
		reloaded, err := th.App.Srv().Store().Team().Get(team.Id)
		require.NoError(t, err)
		require.True(t, reloaded.PolicyEnforced, "store must report the team as policy-enforced")
		return reloaded
	}

	t.Run("feature flag off is a no-op pass-through", func(t *testing.T) {
		thOff := Setup(t).InitBasic(t) // flag defaults off
		team := thOff.CreateTeam(t)
		user := thOff.CreateUser(t)
		out, dropped, appErr := thOff.App.FilterNonQualifyingTeamsForUser(thOff.Context, []*model.Team{team}, user.Id)
		require.Nil(t, appErr)
		require.Zero(t, dropped)
		require.Len(t, out, 1)
	})

	t.Run("non-governed teams are always returned", func(t *testing.T) {
		team := th.CreateTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.Nil(t, appErr)
		require.Zero(t, dropped)
		require.Len(t, out, 1)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("qualifying non-member sees a governed team", func(t *testing.T) {
		team := governedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.Nil(t, appErr)
		require.Zero(t, dropped)
		require.Len(t, out, 1)
	})

	t.Run("non-qualifying non-member has the governed team hidden", func(t *testing.T) {
		team := governedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.Nil(t, appErr)
		require.Equal(t, 1, dropped)
		require.Empty(t, out)
	})

	t.Run("existing member keeps visibility even when they no longer qualify", func(t *testing.T) {
		team := governedTeam(t)
		user := th.CreateUser(t)
		// Add the user directly through the store to bypass the join gate.
		_, err := th.App.Srv().Store().Team().SaveMember(th.Context, &model.TeamMember{TeamId: team.Id, UserId: user.Id}, *th.App.Config().TeamSettings.MaxUsersPerTeam)
		require.NoError(t, err)

		acs := setMockACS(t, th)
		// Decision intentionally not stubbed for this team: members short-circuit
		// before any PDP call.

		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.Nil(t, appErr)
		require.Zero(t, dropped)
		require.Len(t, out, 1)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("PDP error hides the team (fail-secure)", func(t *testing.T) {
		team := governedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.Nil(t, appErr, "a PDP error must not fail the whole listing")
		require.Equal(t, 1, dropped)
		require.Empty(t, out)
	})

	t.Run("public governed team stays visible to a non-qualifying non-member (advisory mode)", func(t *testing.T) {
		team := th.CreateTeam(t)
		team.AllowOpenInvite = true // public → advisory: the team is never hidden
		updated, appErr := th.App.UpdateTeam(team)
		require.Nil(t, appErr)
		saveTestTeamPolicy(t, th, updated.Id, model.AccessControlPolicyActionMembership)
		reloaded, err := th.App.Srv().Store().Team().Get(updated.Id)
		require.NoError(t, err)
		require.True(t, reloaded.PolicyEnforced)
		require.True(t, reloaded.AllowOpenInvite)

		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		// Decision intentionally not stubbed: a public team is never evaluated for hiding.

		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{reloaded}, user.Id)
		require.Nil(t, appErr)
		require.Zero(t, dropped)
		require.Len(t, out, 1)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("decisions are memoised per request (one eval for a repeated governed team)", func(t *testing.T) {
		team := governedTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		out, dropped, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{team, team, team}, user.Id)
		require.Nil(t, appErr)
		require.Zero(t, dropped)
		require.Len(t, out, 3)
		acs.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})
}

func TestFilterNonQualifyingTeamsForUserErrorIsNotSwallowed(t *testing.T) {
	// A subject-build/membership-lookup failure that is not a PDP error must
	// surface so the handler fails the request rather than silently returning a
	// partial list.
	th := setupTeamABACEnforcement(t)
	team := th.CreateTeam(t)
	saveTestTeamPolicy(t, th, team.Id, model.AccessControlPolicyActionMembership)
	reloaded, err := th.App.Srv().Store().Team().Get(team.Id)
	require.NoError(t, err)

	acs := setMockACS(t, th)
	acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

	// A non-existent requesting user makes GetUser fail; that error must bubble.
	_, _, appErr := th.App.FilterNonQualifyingTeamsForUser(th.Context, []*model.Team{reloaded}, model.NewId())
	require.NotNil(t, appErr)
}

func TestAnnotateRecommendedTeamsForUser(t *testing.T) {
	th := setupTeamABACEnforcement(t)

	publicGoverned := func(t *testing.T) *model.Team {
		t.Helper()
		team := th.CreateTeam(t)
		team.AllowOpenInvite = true // public → advisory: eligible for the recommended tag
		updated, appErr := th.App.UpdateTeam(team)
		require.Nil(t, appErr)
		saveTestTeamPolicy(t, th, updated.Id, model.AccessControlPolicyActionMembership)
		reloaded, err := th.App.Srv().Store().Team().Get(updated.Id)
		require.NoError(t, err)
		require.True(t, reloaded.PolicyEnforced)
		require.True(t, reloaded.AllowOpenInvite)
		return reloaded
	}

	privateGoverned := func(t *testing.T) *model.Team {
		t.Helper()
		team := th.CreateTeam(t) // AllowOpenInvite defaults false → private/strict
		saveTestTeamPolicy(t, th, team.Id, model.AccessControlPolicyActionMembership)
		reloaded, err := th.App.Srv().Store().Team().Get(team.Id)
		require.NoError(t, err)
		require.True(t, reloaded.PolicyEnforced)
		require.False(t, reloaded.AllowOpenInvite)
		return reloaded
	}

	t.Run("feature flag off is a no-op", func(t *testing.T) {
		thOff := Setup(t).InitBasic(t)
		team := thOff.CreateTeam(t)
		user := thOff.CreateUser(t)
		thOff.App.AnnotateRecommendedTeamsForUser(thOff.Context, []*model.Team{team}, user.Id)
		require.False(t, team.Recommended)
	})

	t.Run("non-governed team is never recommended and never evaluated", func(t *testing.T) {
		team := th.CreateTeam(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		th.App.AnnotateRecommendedTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.False(t, team.Recommended)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("private governed team is never recommended and never evaluated", func(t *testing.T) {
		team := privateGoverned(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		th.App.AnnotateRecommendedTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.False(t, team.Recommended)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("public governed team is recommended to a qualifying non-member", func(t *testing.T) {
		team := publicGoverned(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		th.App.AnnotateRecommendedTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.True(t, team.Recommended)
	})

	t.Run("public governed team is not recommended to a non-qualifying non-member", func(t *testing.T) {
		team := publicGoverned(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		th.App.AnnotateRecommendedTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.False(t, team.Recommended)
	})

	t.Run("PDP error leaves the team not recommended (fail-secure)", func(t *testing.T) {
		team := publicGoverned(t)
		user := th.CreateUser(t)
		acs := setMockACS(t, th)
		acs.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		th.App.AnnotateRecommendedTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.False(t, team.Recommended)
	})

	t.Run("existing member is not recommended and is never evaluated", func(t *testing.T) {
		team := publicGoverned(t)
		user := th.CreateUser(t)
		_, err := th.App.Srv().Store().Team().SaveMember(th.Context, &model.TeamMember{TeamId: team.Id, UserId: user.Id}, *th.App.Config().TeamSettings.MaxUsersPerTeam)
		require.NoError(t, err)

		acs := setMockACS(t, th)
		th.App.AnnotateRecommendedTeamsForUser(th.Context, []*model.Team{team}, user.Id)
		require.False(t, team.Recommended)
		acs.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}
