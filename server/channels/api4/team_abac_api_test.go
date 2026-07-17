// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// enableTeamABAC turns on the license + config the team ABAC paths require and
// injects a mock PDP, returning it for per-test stubbing. Feature flags are
// read-only by default in tests, so unlock them first — otherwise the
// TeamMembershipAccessControl toggle below is silently dropped.
func enableTeamABAC(t *testing.T, th *TestHelper) *mocks.AccessControlServiceInterface {
	t.Helper()
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	})
	m := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = m
	t.Cleanup(func() {
		th.App.Srv().Channels().AccessControl = nil
		th.App.Srv().SetLicense(nil)
	})
	return m
}

// saveTeamMembershipPolicy persists an active team-type policy for teamID so
// PolicyEnforced/HasMembershipPolicyAction resolve true through the store.
func saveTeamMembershipPolicy(t *testing.T, th *TestHelper, teamID string) *model.AccessControlPolicy {
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
	return policy
}

// assignBody is the additive request shape for the assign/unassign handlers.
type assignBody struct {
	ChannelIds []string `json:"channel_ids,omitempty"`
	TeamID     string   `json:"team_id,omitempty"`
	TeamIds    []string `json:"team_ids,omitempty"`
}

// doAssign/doUnassign return the HTTP status. The raw client helpers surface an
// error for any status >= 300, so we read the code off the response rather than
// asserting on err.
func doAssign(t *testing.T, client *model.Client4, policyID string, body assignBody) int {
	t.Helper()
	resp, _ := client.DoAPIPostJSON(context.Background(), "/access_control_policies/"+policyID+"/assign", body)
	require.NotNil(t, resp)
	defer resp.Body.Close()
	return resp.StatusCode
}

func doUnassign(t *testing.T, client *model.Client4, policyID string, body assignBody) int {
	t.Helper()
	resp, _ := client.DoAPIDeleteJSON(context.Background(), "/access_control_policies/"+policyID+"/unassign", body)
	require.NotNil(t, resp)
	defer resp.Body.Close()
	return resp.StatusCode
}

func TestAssignAccessPolicyTeamIds(t *testing.T) {
	th := Setup(t).InitBasic(t)

	parent := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Expression: "true", Actions: []string{model.AccessControlPolicyActionMembership}},
		},
	}

	t.Run("non-sysadmin sending team_ids is forbidden", func(t *testing.T) {
		enableTeamABAC(t, th)
		status := doAssign(t, th.Client, parent.ID, assignBody{TeamIds: []string{th.BasicTeam.Id}})
		require.Equal(t, http.StatusForbidden, status)
	})

	t.Run("all-invalid team_ids returns 400 (not 404)", func(t *testing.T) {
		enableTeamABAC(t, th)
		status := doAssign(t, th.SystemAdminClient, parent.ID, assignBody{TeamIds: []string{model.NewId(), model.NewId()}})
		require.Equal(t, http.StatusBadRequest, status)
	})

	t.Run("one invalid id among valid ones returns 400", func(t *testing.T) {
		enableTeamABAC(t, th)
		status := doAssign(t, th.SystemAdminClient, parent.ID, assignBody{TeamIds: []string{th.BasicTeam.Id, model.NewId()}})
		require.Equal(t, http.StatusBadRequest, status)
	})

	t.Run("sysadmin team_ids assigns the policy", func(t *testing.T) {
		m := enableTeamABAC(t, th)
		notFound := model.NewAppError("GetPolicy", "app.access_control.not_found.app_error", nil, "", http.StatusNotFound)
		child := &model.AccessControlPolicy{
			ID:      th.BasicTeam.Id,
			Type:    model.AccessControlPolicyTypeTeam,
			Version: model.AccessControlPolicyVersionV0_3,
			Imports: []string{parent.ID},
			Props:   map[string]any{},
		}
		m.On("GetPolicy", mock.AnythingOfType("*request.Context"), parent.ID).Return(parent, nil).Once()
		m.On("GetPolicy", mock.AnythingOfType("*request.Context"), th.BasicTeam.Id).Return(nil, notFound).Once()
		m.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(child, nil).Once()

		status := doAssign(t, th.SystemAdminClient, parent.ID, assignBody{TeamIds: []string{th.BasicTeam.Id}})
		require.Equal(t, http.StatusOK, status)
		m.AssertExpectations(t)
	})

	t.Run("team_ids is rejected with 501 when team membership ABAC is disabled", func(t *testing.T) {
		enableTeamABAC(t, th)
		// Dark-launch guard: even a sysadmin cannot create team child policy rows
		// while the sub-flag is off, so they can't go live on a later flag flip.
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.TeamMembershipAccessControl = false })
		status := doAssign(t, th.SystemAdminClient, parent.ID, assignBody{TeamIds: []string{th.BasicTeam.Id}})
		require.Equal(t, http.StatusNotImplemented, status)
	})
}

func TestUnassignAccessPolicyTeamIds(t *testing.T) {
	th := Setup(t).InitBasic(t)

	policyID := model.NewId()

	t.Run("non-sysadmin sending team_ids is forbidden", func(t *testing.T) {
		enableTeamABAC(t, th)
		status := doUnassign(t, th.Client, policyID, assignBody{TeamIds: []string{th.BasicTeam.Id}})
		require.Equal(t, http.StatusForbidden, status)
	})

	t.Run("unknown team_ids returns 400", func(t *testing.T) {
		enableTeamABAC(t, th)
		status := doUnassign(t, th.SystemAdminClient, policyID, assignBody{TeamIds: []string{model.NewId()}})
		require.Equal(t, http.StatusBadRequest, status)
	})

	t.Run("sysadmin team_ids with no assigned child is a no-op", func(t *testing.T) {
		enableTeamABAC(t, th)
		// No child policy exists for the team, so UnassignPoliciesFromTeams skips it
		// (warn + continue) and returns success.
		status := doUnassign(t, th.SystemAdminClient, policyID, assignBody{TeamIds: []string{th.BasicTeam.Id}})
		require.Equal(t, http.StatusOK, status)
	})

	t.Run("team_ids is rejected with 501 when team membership ABAC is disabled", func(t *testing.T) {
		enableTeamABAC(t, th)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.TeamMembershipAccessControl = false })
		status := doUnassign(t, th.SystemAdminClient, policyID, assignBody{TeamIds: []string{th.BasicTeam.Id}})
		require.Equal(t, http.StatusNotImplemented, status)
	})
}

func TestGetTeamAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	}).InitBasic(t)

	getPolicy := func(t *testing.T, client *model.Client4, teamID string) (*http.Response, error) {
		t.Helper()
		return client.DoAPIGet(context.Background(), "/teams/"+teamID+"/access_control/policy", "")
	}

	t.Run("regular member without permission is forbidden", func(t *testing.T) {
		enableTeamABAC(t, th)
		resp, _ := getPolicy(t, th.Client, th.BasicTeam.Id)
		require.NotNil(t, resp)
		defer resp.Body.Close()
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("sysadmin sees enforced=false when no policy is assigned", func(t *testing.T) {
		m := enableTeamABAC(t, th)
		notFound := model.NewAppError("GetPolicy", "app.access_control.not_found.app_error", nil, "", http.StatusNotFound)
		m.On("GetPolicy", mock.AnythingOfType("*request.Context"), th.BasicTeam.Id).Return(nil, notFound)

		resp, err := getPolicy(t, th.SystemAdminClient, th.BasicTeam.Id)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body struct {
			Policy   *model.AccessControlPolicy `json:"policy"`
			Enforced bool                       `json:"enforced"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		require.Nil(t, body.Policy)
		require.False(t, body.Enforced)
	})

	t.Run("sysadmin sees enforced=true with the policy when assigned", func(t *testing.T) {
		m := enableTeamABAC(t, th)
		policy := saveTeamMembershipPolicy(t, th, th.BasicTeam.Id)
		m.On("GetPolicy", mock.AnythingOfType("*request.Context"), th.BasicTeam.Id).Return(policy, nil)

		resp, err := getPolicy(t, th.SystemAdminClient, th.BasicTeam.Id)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body struct {
			Policy   *model.AccessControlPolicy `json:"policy"`
			Enforced bool                       `json:"enforced"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		require.NotNil(t, body.Policy)
		require.Equal(t, th.BasicTeam.Id, body.Policy.ID)
		require.True(t, body.Enforced)
	})

	t.Run("team admin of the team is allowed", func(t *testing.T) {
		m := enableTeamABAC(t, th)
		notFound := model.NewAppError("GetPolicy", "app.access_control.not_found.app_error", nil, "", http.StatusNotFound)
		m.On("GetPolicy", mock.AnythingOfType("*request.Context"), th.BasicTeam.Id).Return(nil, notFound)

		th.AddPermissionToRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)
		defer th.RemovePermissionFromRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)
		th.LinkUserToTeam(t, th.TeamAdminUser, th.BasicTeam)
		th.UpdateUserToTeamAdmin(t, th.TeamAdminUser, th.BasicTeam)
		th.LoginTeamAdmin(t)
		defer th.LoginBasic(t)

		resp, err := getPolicy(t, th.Client, th.BasicTeam.Id)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("disabled flag hides a policy row created while dark", func(t *testing.T) {
		enableTeamABAC(t, th)
		// A child policy persisted while the feature was on must not leak through
		// this endpoint once the sub-flag is turned off again (dark-launch/rollback).
		saveTeamMembershipPolicy(t, th, th.BasicTeam.Id)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.TeamMembershipAccessControl = false })

		resp, err := getPolicy(t, th.SystemAdminClient, th.BasicTeam.Id)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var body struct {
			Policy   *model.AccessControlPolicy `json:"policy"`
			Enforced bool                       `json:"enforced"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		require.Nil(t, body.Policy)
		require.False(t, body.Enforced)
	})
}

func TestGetUsersNotInTeamAbacMatchOnly(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	}).InitBasic(t)

	t.Run("without abac_match_only the listing is unchanged", func(t *testing.T) {
		users, resp, err := th.SystemAdminClient.GetUsersNotInTeam(context.Background(), th.BasicTeam.Id, 0, 200, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		// BasicUser/BasicUser2 are team members, so they must not appear.
		require.NotContains(t, pluckIDs(users, func(u *model.User) string { return u.Id }), th.BasicUser.Id)
	})

	t.Run("abac_match_only=true routes to the policy-matched candidates", func(t *testing.T) {
		m := enableTeamABAC(t, th)
		saveTeamMembershipPolicy(t, th, th.BasicTeam.Id)

		qualifying := th.CreateUser(t)
		m.On("QueryUsersForResource", mock.AnythingOfType("*request.Context"), th.BasicTeam.Id, model.AccessControlPolicyActionMembership, mock.Anything).
			Return([]*model.User{qualifying}, int64(1), (*model.AppError)(nil))

		resp, err := th.SystemAdminClient.DoAPIGet(context.Background(), "/users?not_in_team="+th.BasicTeam.Id+"&abac_match_only=true&per_page=200", "")
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var users []*model.User
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&users))
		require.Equal(t, []string{qualifying.Id}, pluckIDs(users, func(u *model.User) string { return u.Id }))
		m.AssertExpectations(t)
	})

	t.Run("caller without view_team permission is forbidden", func(t *testing.T) {
		// Owned by the admin so BasicUser is a genuine non-member without ViewTeam.
		otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		_, resp, err := th.Client.GetUsersNotInTeam(context.Background(), otherTeam.Id, 0, 60, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

// TestAddTeamMembersGracefulABACError pins P1-21: a per-user ABAC denial in the
// batch add surfaces as that user's Error in graceful mode without aborting the
// batch; qualifying users in the same batch are still added.
func TestAddTeamMembersGracefulABACError(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.TeamMembershipAccessControl = true
	}).InitBasic(t)

	m := enableTeamABAC(t, th)
	team := th.CreateTeam(t)
	saveTeamMembershipPolicy(t, th, team.Id)

	admitted := th.CreateUser(t)
	denied := th.CreateUser(t)

	m.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Subject.ID == admitted.Id
	})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
	m.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Subject.ID == denied.Id
	})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

	result, resp, err := th.SystemAdminClient.AddTeamMembersGracefully(context.Background(), team.Id, []string{admitted.Id, denied.Id})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	var admittedOK, deniedErr bool
	for _, r := range result {
		switch r.UserId {
		case admitted.Id:
			admittedOK = r.Error == nil && r.Member != nil
		case denied.Id:
			deniedErr = r.Error != nil
		}
	}
	require.True(t, admittedOK, "qualifying user must be added")
	require.True(t, deniedErr, "non-qualifying user must carry an error without aborting the batch")
}
