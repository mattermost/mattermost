// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// createTestPolicyHierarchy creates a parent policy and child channel policies in the real store,
// and configures the AccessControl mock to return the parent via GetPolicy.
// It returns (parentPolicy, mockACS) for further configuration.
func createTestPolicyHierarchy(
	t *testing.T,
	th *TestHelper,
	channels []*model.Channel,
) (*model.AccessControlPolicy, *mocks.AccessControlServiceInterface) {
	t.Helper()

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Name:     "Test Team Policy",
		Rules: []model.AccessControlPolicyRule{
			{Expression: "true", Actions: []string{"*"}},
		},
	}

	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)

	for _, ch := range channels {
		child := &model.AccessControlPolicy{
			ID:       ch.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
		}
		appErr := child.Inherit(parentPolicy)
		require.Nil(t, appErr)

		_, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
		require.NoError(t, err)
	}

	originalACS := th.App.Srv().ch.AccessControl
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() {
		th.App.Srv().ch.AccessControl = originalACS
		mockACS.AssertExpectations(t)
	})

	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.policy_not_found", nil, "", 404)).Maybe()
	mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.normalize_skip", nil, "", 500)).Maybe()

	return parentPolicy, mockACS
}

func TestValidateTeamScopePolicyChannelAssignment(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("empty channel list returns error", func(t *testing.T) {
		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channels_required.app_error", appErr.Id)
	})

	t.Run("nonexistent channel returns error", func(t *testing.T) {
		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{model.NewId()})
		require.NotNil(t, appErr)
	})

	t.Run("public channel returns error", func(t *testing.T) {
		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{th.BasicChannel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_not_private", appErr.Id)
	})

	t.Run("channel from wrong team returns error", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		otherChannel := th.CreatePrivateChannel(t, otherTeam)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{otherChannel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channel_wrong_team.app_error", appErr.Id)
	})

	t.Run("shared channel returns error", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		channel.Shared = model.NewPointer(true)
		_, err := th.App.UpdateChannel(th.Context, channel)
		require.Nil(t, err)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr.Id)
	})

	t.Run("group-constrained channel returns error", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		channel.GroupConstrained = model.NewPointer(true)
		_, err := th.App.UpdateChannel(th.Context, channel)
		require.Nil(t, err)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_group_constrained", appErr.Id)
	})

	t.Run("valid private channel in team succeeds", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.Nil(t, appErr)
	})

	t.Run("multiple valid private channels succeed", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{ch1.Id, ch2.Id})
		require.Nil(t, appErr)
	})

	t.Run("mix of valid and invalid channels returns error", func(t *testing.T) {
		validChannel := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{
			validChannel.Id,
			th.BasicChannel.Id, // public — invalid
		})
		require.NotNil(t, appErr)
	})
}

func TestValidateTeamAdminSelfInclusion(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("empty expression passes", func(t *testing.T) {
		appErr := th.App.ValidateTeamAdminSelfInclusion(th.Context, th.BasicUser.Id, "")
		require.Nil(t, appErr)
	})

	t.Run("matching expression passes", func(t *testing.T) {
		originalACS := th.App.Srv().ch.AccessControl
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil)

		appErr := th.App.ValidateTeamAdminSelfInclusion(th.Context, th.BasicUser.Id, "true")
		require.Nil(t, appErr)
	})

	t.Run("non-matching expression returns error", func(t *testing.T) {
		originalACS := th.App.Srv().ch.AccessControl
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "false", mock.Anything).
			Return([]*model.User{}, int64(0), nil)

		appErr := th.App.ValidateTeamAdminSelfInclusion(th.Context, th.BasicUser.Id, "false")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.self_exclusion.app_error", appErr.Id)
	})

	t.Run("expression evaluation error wraps as validation error", func(t *testing.T) {
		originalACS := th.App.Srv().ch.AccessControl
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "bad_expr", mock.Anything).
			Return(([]*model.User)(nil), int64(0), model.NewAppError("test", "test.eval_failed", nil, "", 500))

		appErr := th.App.ValidateTeamAdminSelfInclusion(th.Context, th.BasicUser.Id, "bad_expr")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.validation_error.app_error", appErr.Id)
	})
}

func TestSearchTeamAccessPolicies(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("returns empty when no policies match", func(t *testing.T) {
		originalACS := th.App.Srv().ch.AccessControl
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.not_found", nil, "", 404)).Maybe()
		mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.normalize_skip", nil, "", 500)).Maybe()

		policies, total, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
		require.Nil(t, appErr)
		assert.Empty(t, policies)
		assert.Equal(t, int64(0), total)
	})

	t.Run("filters out system-scoped policies", func(t *testing.T) {
		// Create a parent policy with NO child channels -> system-scoped
		_, _ = createTestPolicyHierarchy(t, th, []*model.Channel{})

		policies, total, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
		require.Nil(t, appErr)
		assert.Empty(t, policies, "system-scoped policy should be filtered out")
		assert.Equal(t, int64(0), total)
	})

	t.Run("includes team-scoped policy", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		teamPolicy, mockACS := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		// ValidateExpressionAgainstRequester needs this mock
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil)

		policies, total, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
		require.Nil(t, appErr)
		// At least the team-scoped policy should be present
		found := false
		for _, p := range policies {
			if p.ID == teamPolicy.ID {
				found = true
				break
			}
		}
		assert.True(t, found, "team-scoped policy should be in results")
		assert.True(t, total >= 1, "at least one policy expected")
	})

	t.Run("filters out cross-team policies", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		crossTeamChannel := th.CreatePrivateChannel(t, otherTeam)
		crossTeamPolicy, mockACS := createTestPolicyHierarchy(t, th, []*model.Channel{crossTeamChannel})

		// Catch-all for QueryUsersForExpression (for any accumulated team-scoped policies)
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string"), mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil).Maybe()

		policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
		require.Nil(t, appErr)
		// The cross-team policy should NOT be in results
		for _, p := range policies {
			assert.NotEqual(t, crossTeamPolicy.ID, p.ID, "cross-team policy should be filtered out")
		}
	})
}

// TestSearchTeamAccessPolicies_SelfExclusionFiltering uses a separate test function
// for clean DB isolation to test that policies excluding the admin are filtered out.
func TestSearchTeamAccessPolicies_SelfExclusionFiltering(t *testing.T) {
	th := Setup(t).InitBasic(t)

	ch1 := th.CreatePrivateChannel(t, th.BasicTeam)

	// Create a policy with a restrictive expression
	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Name:     "Exclusive Policy",
		Rules: []model.AccessControlPolicyRule{
			{Expression: "user.attributes.clearance == 'top-secret'", Actions: []string{"*"}},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)

	child := &model.AccessControlPolicy{
		ID:       ch1.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
	}
	appErr := child.Inherit(parentPolicy)
	require.Nil(t, appErr)
	_, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
	require.NoError(t, err)

	originalACS := th.App.Srv().ch.AccessControl
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() {
		th.App.Srv().ch.AccessControl = originalACS
		mockACS.AssertExpectations(t)
	})

	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.policy_not_found", nil, "", 404)).Maybe()
	mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.normalize_skip", nil, "", 500)).Maybe()
	mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"),
		"user.attributes.clearance == 'top-secret'", mock.Anything).
		Return([]*model.User{}, int64(0), nil)

	policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
	require.Nil(t, appErr)
	assert.Empty(t, policies, "policy where admin doesn't satisfy rules should be filtered out")
}

func TestValidateTeamAdminPolicyOwnership(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("policy scoped to team passes", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		teamPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, teamPolicy.ID)
		require.Nil(t, appErr)
	})

	t.Run("policy scoped to different team fails", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		ch1 := th.CreatePrivateChannel(t, otherTeam)
		otherTeamPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, otherTeamPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.policy_not_in_team.app_error", appErr.Id)
	})

	t.Run("cross-team policy fails", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, otherTeam)
		crossPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})

		appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, crossPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.policy_not_in_team.app_error", appErr.Id)
	})

	t.Run("policy with no channels fails", func(t *testing.T) {
		noChannelPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})

		appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, noChannelPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.policy_not_in_team.app_error", appErr.Id)
	})

	t.Run("nonexistent policy fails", func(t *testing.T) {
		appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.policy_not_in_team.app_error", appErr.Id)
	})
}
