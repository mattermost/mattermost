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

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	// Specific match for this policy
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), parentPolicy.ID).Return(parentPolicy, nil)
	// Catch-all for any other policy ID (from previous subtests) — returns error so they get skipped
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.policy_not_found", nil, "", 404)).Maybe()
	// NormalizePolicy is called by SearchAccessControlPolicies for every parent policy found in the store.
	// Returning an error is safe: the code logs it and keeps the original policy in the slice,
	// which then gets filtered by SearchTeamAccessPolicies (IsPolicyTeamScoped, self-inclusion, etc.).
	mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.normalize_skip", nil, "", 500)).Maybe()

	return parentPolicy, mockACS
}

func TestIsPolicyTeamScoped(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("returns true when all channels belong to team", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		isScoped, appErr := th.App.IsPolicyTeamScoped(th.Context, parentPolicy.ID, th.BasicTeam.Id)
		require.Nil(t, appErr)
		assert.True(t, isScoped)
	})

	t.Run("returns false when no channels", func(t *testing.T) {
		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})

		isScoped, appErr := th.App.IsPolicyTeamScoped(th.Context, parentPolicy.ID, th.BasicTeam.Id)
		require.Nil(t, appErr)
		assert.False(t, isScoped)
	})

	t.Run("returns false when channels span multiple teams", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		otherTeam := th.CreateTeam(t)
		ch2 := th.CreatePrivateChannel(t, otherTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})

		isScoped, appErr := th.App.IsPolicyTeamScoped(th.Context, parentPolicy.ID, th.BasicTeam.Id)
		require.Nil(t, appErr)
		assert.False(t, isScoped)
	})

	t.Run("returns false when checking wrong team", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		wrongTeamID := model.NewId()
		isScoped, appErr := th.App.IsPolicyTeamScoped(th.Context, parentPolicy.ID, wrongTeamID)
		require.Nil(t, appErr)
		assert.False(t, isScoped)
	})

	t.Run("returns true with multiple channels from same team", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, th.BasicTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})

		isScoped, appErr := th.App.IsPolicyTeamScoped(th.Context, parentPolicy.ID, th.BasicTeam.Id)
		require.Nil(t, appErr)
		assert.True(t, isScoped)
	})
}

func TestGetPolicyTeamScope(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("returns team ID when all channels belong to one team", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		teamID, appErr := th.App.GetPolicyTeamScope(th.Context, parentPolicy.ID)
		require.Nil(t, appErr)
		assert.Equal(t, th.BasicTeam.Id, teamID)
	})

	t.Run("returns empty string when no channels", func(t *testing.T) {
		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})

		teamID, appErr := th.App.GetPolicyTeamScope(th.Context, parentPolicy.ID)
		require.Nil(t, appErr)
		assert.Empty(t, teamID)
	})

	t.Run("returns empty string when channels span multiple teams", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		otherTeam := th.CreateTeam(t)
		ch2 := th.CreatePrivateChannel(t, otherTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})

		teamID, appErr := th.App.GetPolicyTeamScope(th.Context, parentPolicy.ID)
		require.Nil(t, appErr)
		assert.Empty(t, teamID)
	})

	t.Run("returns consistent team ID with multiple channels", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch3 := th.CreatePrivateChannel(t, th.BasicTeam)

		parentPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2, ch3})

		teamID, appErr := th.App.GetPolicyTeamScope(th.Context, parentPolicy.ID)
		require.Nil(t, appErr)
		assert.Equal(t, th.BasicTeam.Id, teamID)
	})
}

func TestValidateTeamPolicyChannelAssignment(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("empty channel list returns error", func(t *testing.T) {
		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channels_required.app_error", appErr.Id)
	})

	t.Run("nonexistent channel returns error", func(t *testing.T) {
		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{model.NewId()})
		require.NotNil(t, appErr)
	})

	t.Run("public channel returns error", func(t *testing.T) {
		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{th.BasicChannel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channel_not_private.app_error", appErr.Id)
	})

	t.Run("channel from wrong team returns error", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		otherChannel := th.CreatePrivateChannel(t, otherTeam)

		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{otherChannel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channel_wrong_team.app_error", appErr.Id)
	})

	t.Run("shared channel returns error", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		channel.Shared = model.NewPointer(true)
		_, err := th.App.UpdateChannel(th.Context, channel)
		require.Nil(t, err)

		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channel_shared.app_error", appErr.Id)
	})

	t.Run("group-constrained channel returns error", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		channel.GroupConstrained = model.NewPointer(true)
		_, err := th.App.UpdateChannel(th.Context, channel)
		require.Nil(t, err)

		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.channel_group_synced.app_error", appErr.Id)
	})

	t.Run("valid private channel in team succeeds", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.Nil(t, appErr)
	})

	t.Run("multiple valid private channels succeed", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{ch1.Id, ch2.Id})
		require.Nil(t, appErr)
	})

	t.Run("mix of valid and invalid channels returns error", func(t *testing.T) {
		validChannel := th.CreatePrivateChannel(t, th.BasicTeam)

		appErr := th.App.ValidateTeamPolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{
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
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil)

		appErr := th.App.ValidateTeamAdminSelfInclusion(th.Context, th.BasicUser.Id, "true")
		require.Nil(t, appErr)
	})

	t.Run("non-matching expression returns error", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "false", mock.Anything).
			Return([]*model.User{}, int64(0), nil)

		appErr := th.App.ValidateTeamAdminSelfInclusion(th.Context, th.BasicUser.Id, "false")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.team.access_policies.self_exclusion.app_error", appErr.Id)
	})

	t.Run("expression evaluation error wraps as validation error", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

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
		// AccessControl mock must be non-nil for SearchAccessControlPolicies to proceed
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.not_found", nil, "", 404)).Maybe()
		mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.normalize_skip", nil, "", 500)).Maybe()

		// Real store is empty -> no policies returned
		policies, total, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
		require.Nil(t, appErr)
		assert.Empty(t, policies)
		assert.Equal(t, int64(0), total)
	})

	t.Run("filters out system-scoped policies", func(t *testing.T) {
		// Create a parent policy with NO child channels -> system-scoped
		// The policy is saved in the real store; SearchAccessControlPolicies queries the store.
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

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), parentPolicy.ID).Return(parentPolicy, nil)
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.policy_not_found", nil, "", 404)).Maybe()
	mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.normalize_skip", nil, "", 500)).Maybe()
	// Admin does NOT match the restrictive expression
	mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"),
		"user.attributes.clearance == 'top-secret'", mock.Anything).
		Return([]*model.User{}, int64(0), nil)

	policies, total, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
	require.Nil(t, appErr)
	assert.Empty(t, policies, "policy where admin doesn't satisfy rules should be filtered out")
	assert.Equal(t, int64(0), total)
}
