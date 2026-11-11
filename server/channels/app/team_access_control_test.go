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
		Name:     "Test Team Policy " + model.NewId(),
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

	t.Run("public channel is eligible", func(t *testing.T) {
		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{th.BasicChannel.Id})
		require.Nil(t, appErr)
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
		channel.Shared = new(true)
		_, err := th.App.UpdateChannel(th.Context, channel)
		require.Nil(t, err)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr.Id)
	})

	t.Run("group-constrained channel returns error", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		channel.GroupConstrained = new(true)
		_, err := th.App.UpdateChannel(th.Context, channel)
		require.Nil(t, err)

		appErr := th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{channel.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_group_constrained", appErr.Id)
	})

	t.Run("default channel returns error", func(t *testing.T) {
		townSquare, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr)

		appErr = th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{townSquare.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_default", appErr.Id)
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

		townSquare, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr)

		appErr = th.App.ValidateTeamScopePolicyChannelAssignment(th.Context, th.BasicTeam.Id, []string{
			validChannel.Id,
			townSquare.Id, // default channel — invalid
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

func TestExpressionWithTeamContext(t *testing.T) {
	th := Setup(t).InitBasic(t)

	expression := "user.attributes.team == 'Engineering'"

	t.Run("requester who does not match the expression gets empty results", func(t *testing.T) {
		originalACS := th.App.Srv().ch.AccessControl
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		rctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id, Id: model.NewId()})

		// Requester self-check returns no match → guard returns empty without
		// ever querying the full user set.
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), expression, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.SubjectID == th.BasicUser.Id
		})).Return([]*model.User{}, int64(0), nil)

		users, count, appErr := th.App.TestExpressionWithTeamContext(rctx, expression, model.SubjectSearchOptions{})
		require.Nil(t, appErr)
		require.Empty(t, users)
		require.Zero(t, count)
	})

	t.Run("requester who matches sees the full result set", func(t *testing.T) {
		originalACS := th.App.Srv().ch.AccessControl
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		rctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id, Id: model.NewId()})

		// Self-check matches the requester.
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), expression, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.SubjectID == th.BasicUser.Id
		})).Return([]*model.User{th.BasicUser}, int64(1), nil)

		// Full query (TestExpression) for the unrestricted set.
		matched := []*model.User{th.BasicUser, th.BasicUser2}
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), expression, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.SubjectID == ""
		})).Return(matched, int64(2), nil)

		users, count, appErr := th.App.TestExpressionWithTeamContext(rctx, expression, model.SubjectSearchOptions{})
		require.Nil(t, appErr)
		require.Len(t, users, 2)
		require.Equal(t, int64(2), count)
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

	t.Run("omits parent saved with an empty scope when its channels are in one team", func(t *testing.T) {
		// A parent whose first save has an empty scope is omitted even when every channel is in the team.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		teamPolicy, mockACS := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil).Maybe()

		policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{TeamID: th.BasicTeam.Id})
		require.Nil(t, appErr)
		found := false
		for _, p := range policies {
			if p.ID == teamPolicy.ID {
				found = true
				break
			}
		}
		require.Equal(t, false, found, "a parent saved with an empty scope is omitted")
	})

	t.Run("filters out cross-team policies", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		crossTeamChannel := th.CreatePrivateChannel(t, otherTeam)
		crossTeamPolicy, mockACS := createTestPolicyHierarchy(t, th, []*model.Channel{crossTeamChannel})

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string"), mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil).Maybe()

		policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
		require.Nil(t, appErr)
		for _, p := range policies {
			assert.NotEqual(t, crossTeamPolicy.ID, p.ID, "cross-team policy should be filtered out")
		}
	})

	t.Run("includes channelless policy whose first save has team scope", func(t *testing.T) {
		// A parent with no channels whose first save already records this team's scope is returned.
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Name:     "Test Team Policy " + model.NewId(),
			Rules: []model.AccessControlPolicyRule{
				{Expression: "true", Actions: []string{"*"}},
			},
			Scope:   model.AccessControlPolicyScopeTeam,
			ScopeID: th.BasicTeam.Id,
		}
		var err error
		policy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
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
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil).Maybe()

		policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{TeamID: th.BasicTeam.Id})
		require.Nil(t, appErr)
		found := false
		for _, p := range policies {
			if p.ID == policy.ID {
				found = true
				break
			}
		}
		assert.True(t, found, "channelless policy whose first save has team scope should appear in search results")
	})

	t.Run("omits a parent whose scope was set on a later save", func(t *testing.T) {
		// A parent whose first save has an empty scope is omitted when a later save records team scope and its channels are in the team.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		policy, mockACS := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})
		policy.Scope = model.AccessControlPolicyScopeTeam
		policy.ScopeID = th.BasicTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil).Maybe()

		policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{TeamID: th.BasicTeam.Id})
		require.Nil(t, appErr)
		found := false
		for _, p := range policies {
			if p.ID == policy.ID {
				found = true
				break
			}
		}
		require.Equal(t, false, found, "a parent whose first save has an empty scope is omitted")
	})
}

// TestSearchTeamAccessPolicies_SelfExclusionFiltering verifies that policies
// whose rules the admin doesn't satisfy are filtered out of search results.
func TestSearchTeamAccessPolicies_SelfExclusionFiltering(t *testing.T) {
	th := Setup(t).InitBasic(t)

	ch1 := th.CreatePrivateChannel(t, th.BasicTeam)

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Name:     "Exclusive Policy",
		Rules: []model.AccessControlPolicyRule{
			{Expression: "user.attributes.clearance == 'top-secret'", Actions: []string{"*"}},
		},
		Scope:   model.AccessControlPolicyScopeTeam,
		ScopeID: th.BasicTeam.Id,
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

	policies, total, appErr := th.App.SearchTeamAccessPolicies(th.Context, th.BasicTeam.Id, th.BasicUser.Id, model.AccessControlPolicySearch{})
	require.Nil(t, appErr)
	assert.Empty(t, policies, "policy where admin doesn't satisfy rules should be filtered out")
	assert.Equal(t, int64(0), total, "total should reflect filtered count")
}

func TestValidateTeamAdminPolicyOwnership(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("parent saved with an empty scope is not owned when its channels are in the team", func(t *testing.T) {
		// A parent whose first save has an empty scope is not owned by the team, even when every channel is in that team.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		teamPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, teamPolicy.ID)
		require.Nil(t, appErr)
		assert.Equal(t, false, owned)
	})

	t.Run("policy scoped to different team fails", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		ch1 := th.CreatePrivateChannel(t, otherTeam)
		otherTeamPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, otherTeamPolicy.ID)
		require.Nil(t, appErr)
		assert.False(t, owned)
	})

	t.Run("cross-team policy fails", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, otherTeam)
		crossPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, crossPolicy.ID)
		require.Nil(t, appErr)
		assert.False(t, owned)
	})

	t.Run("parent whose scope was set on a later save is not owned", func(t *testing.T) {
		// A parent whose first save has an empty scope is not owned when a later save records this team's scope.
		noChannelPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})
		noChannelPolicy.Scope = model.AccessControlPolicyScopeTeam
		noChannelPolicy.ScopeID = th.BasicTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, noChannelPolicy)
		require.NoError(t, err)

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, noChannelPolicy.ID)
		require.Nil(t, appErr)
		assert.Equal(t, false, owned)
	})

	t.Run("parent whose first save has team scope is owned", func(t *testing.T) {
		// A parent whose first save already records this team's scope stays owned after a later save that keeps that scope.
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Name:     "Test Team Policy " + model.NewId(),
			Rules: []model.AccessControlPolicyRule{
				{Expression: "true", Actions: []string{"*"}},
			},
			Scope:   model.AccessControlPolicyScopeTeam,
			ScopeID: th.BasicTeam.Id,
		}
		var err error
		policy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		policy.Rules = []model.AccessControlPolicyRule{
			{Expression: "false", Actions: []string{"*"}},
		}
		policy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		require.Equal(t, model.AccessControlPolicyScopeTeam, policy.Scope)
		require.Equal(t, th.BasicTeam.Id, policy.ScopeID)

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, policy.ID)
		require.Nil(t, appErr)
		assert.True(t, owned)
	})

	t.Run("parent whose later save records a different team is not owned or listed for either team", func(t *testing.T) {
		// A parent whose first save records one team and whose later save records another team is not owned by either team and is omitted from both listings.
		teamB := th.CreateTeam(t)
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Name:     "Test Team Policy " + model.NewId(),
			Rules: []model.AccessControlPolicyRule{
				{Expression: "true", Actions: []string{"*"}},
			},
			Scope:   model.AccessControlPolicyScopeTeam,
			ScopeID: th.BasicTeam.Id,
		}
		var err error
		policy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		policy.ScopeID = teamB.Id
		policy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		require.Greater(t, policy.Revision, 1)
		require.Equal(t, model.AccessControlPolicyScopeTeam, policy.Scope)
		require.Equal(t, teamB.Id, policy.ScopeID)

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
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string"), mock.Anything).
			Return([]*model.User{th.BasicUser}, int64(1), nil).Maybe()

		for _, teamID := range []string{th.BasicTeam.Id, teamB.Id} {
			owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, teamID, policy.ID)
			require.Nil(t, appErr)
			require.Equal(t, false, owned)

			policies, _, appErr := th.App.SearchTeamAccessPolicies(th.Context, teamID, th.BasicUser.Id, model.AccessControlPolicySearch{})
			require.Nil(t, appErr)
			found := false
			for _, p := range policies {
				if p.ID == policy.ID {
					found = true
					break
				}
			}
			require.Equal(t, false, found)
		}
	})

	t.Run("policy with no channels and no scope fails", func(t *testing.T) {
		noChannelPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, noChannelPolicy.ID)
		require.Nil(t, appErr)
		assert.False(t, owned)
	})

	t.Run("policy with scope for different team fails", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		noChannelPolicy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})
		noChannelPolicy.Scope = model.AccessControlPolicyScopeTeam
		noChannelPolicy.ScopeID = otherTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, noChannelPolicy)
		require.NoError(t, err)

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, noChannelPolicy.ID)
		require.Nil(t, appErr)
		assert.False(t, owned)
	})

	t.Run("nonexistent policy fails", func(t *testing.T) {
		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, model.NewId())
		require.Nil(t, appErr)
		assert.False(t, owned)
	})
}

func TestReconcilePolicyTeamScope(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Helper to read scope directly from the store (bypasses enterprise layer).
	getScope := func(t *testing.T, policyID string) (string, string) {
		t.Helper()
		p, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, policyID)
		require.NoError(t, err)
		return p.Scope, p.ScopeID
	}

	t.Run("single team channels leave an empty scope empty", func(t *testing.T) {
		// Reconcile leaves the scope empty when the parent was saved with an empty scope and every channel is in one team.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, th.BasicTeam)
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Equal(t, "", scope)
		assert.Equal(t, "", scopeID)
	})

	t.Run("empty scope stays empty when a channel team id is empty", func(t *testing.T) {
		// Reconcile leaves the scope empty when the parent was saved with an empty scope, one channel is in the team, and another channel has an empty team id.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		dm := th.CreateDmChannel(t, th.BasicUser2)
		require.Empty(t, dm.TeamId)
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, dm})

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Equal(t, "", scope)
		assert.Equal(t, "", scopeID)
	})

	t.Run("cross-team channels clears scope", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		ch2 := th.CreatePrivateChannel(t, otherTeam)

		// Create policy with scope already set
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1, ch2})
		policy.Scope = model.AccessControlPolicyScopeTeam
		policy.ScopeID = th.BasicTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Empty(t, scope)
		assert.Empty(t, scopeID)
	})

	t.Run("no channels preserves existing scope", func(t *testing.T) {
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})
		policy.Scope = model.AccessControlPolicyScopeTeam
		policy.ScopeID = th.BasicTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Equal(t, model.AccessControlPolicyScopeTeam, scope)
		assert.Equal(t, th.BasicTeam.Id, scopeID)
	})

	t.Run("no channels and no scope stays empty", func(t *testing.T) {
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{})

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Empty(t, scope)
		assert.Empty(t, scopeID)
	})

	t.Run("skip save when scope already correct", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		// Pre-set the correct scope
		policy.Scope = model.AccessControlPolicyScopeTeam
		policy.ScopeID = th.BasicTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		// SavePolicy should NOT be called since scope is already correct
		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		// Verify scope unchanged
		scope, scopeID := getScope(t, policy.ID)
		assert.Equal(t, model.AccessControlPolicyScopeTeam, scope)
		assert.Equal(t, th.BasicTeam.Id, scopeID)
	})

	t.Run("stale channel reference skips reconciliation", func(t *testing.T) {
		// Simulate a channel being deleted after it was assigned to a policy.
		// GetChannels returns fewer channels than channelIDs, so reconciliation
		// must be skipped to avoid stamping an incorrect scope.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		// Pre-set a scope so we can verify it is preserved after the no-op.
		policy.Scope = model.AccessControlPolicyScopeTeam
		policy.ScopeID = th.BasicTeam.Id
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)

		// Delete the channel from the DB to make the reference stale.
		err = th.App.Srv().Store().Channel().PermanentDelete(th.Context, ch1.Id)
		require.NoError(t, err)

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Equal(t, model.AccessControlPolicyScopeTeam, scope, "scope should be preserved when channel is stale")
		assert.Equal(t, th.BasicTeam.Id, scopeID)
	})

	t.Run("parent saved without a scope stays empty across reconcile and channel removal", func(t *testing.T) {
		// A parent saved with an empty scope stays empty when its channels are in one team, including after those channels are removed, and is not owned by the team.
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		policy, _ := createTestPolicyHierarchy(t, th, []*model.Channel{ch1})

		scope, _ := getScope(t, policy.ID)
		assert.Empty(t, scope)

		appErr := th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID := getScope(t, policy.ID)
		assert.Equal(t, "", scope)
		assert.Equal(t, "", scopeID)

		err := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, ch1.Id)
		require.NoError(t, err)

		appErr = th.App.ReconcilePolicyTeamScope(th.Context, policy.ID)
		require.Nil(t, appErr)

		scope, scopeID = getScope(t, policy.ID)
		assert.Equal(t, "", scope)
		assert.Equal(t, "", scopeID)

		owned, appErr := th.App.ValidateTeamAdminPolicyOwnership(th.Context, th.BasicTeam.Id, policy.ID)
		require.Nil(t, appErr)
		assert.Equal(t, false, owned)
	})
}

// TestCreateOrUpdateAccessControlPolicy_TeamSelfInclusion verifies that
// enforceAccessControlPolicyWriteGuards self-inclusion applies to team policy
// saves. HTTP still uses ValidateTeamAdminSelfInclusion in the api4 handler.
func TestCreateOrUpdateAccessControlPolicy_TeamSelfInclusion(t *testing.T) {
	t.Run("team admin excluded by own expression is rejected before save", func(t *testing.T) {
		// AttributeValueMasking defaults to true
		th := SetupConfig(t, func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
			cfg.FeatureFlags.AttributeValueMasking = false // keep the masking path out of scope
		}).InitBasic(t)

		callerID := th.BasicUser.Id
		rctx := th.Context.WithSession(&model.Session{
			UserId: callerID,
			Id:     model.NewId(),
			Roles:  model.SystemUserRoleId, // not a system admin
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		// Guard calls QueryUsersForExpression with the caller as subject; return
		// empty — caller does not satisfy the expression.
		mockACS.On("QueryUsersForExpression",
			mock.AnythingOfType("*request.Context"),
			"false",
			mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
				return opts.SubjectID == callerID
			}),
		).Return([]*model.User{}, int64(0), nil).Once()

		// SavePolicy must NOT be called — the guard rejects the request first.

		teamPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "false"},
			},
		}

		result, appErr := th.App.CreateOrUpdateAccessControlPolicy(rctx, teamPolicy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.save_policy.self_exclusion", appErr.Id)
		assert.Nil(t, result)
	})

	t.Run("team admin included by own expression passes the guard and saves", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
			cfg.FeatureFlags.AttributeValueMasking = false
		}).InitBasic(t)

		rctx := th.Context.WithSession(&model.Session{
			UserId: th.BasicUser.Id,
			Id:     model.NewId(),
			Roles:  model.SystemUserRoleId,
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		savedPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}
		// "true" skips checkSelfInclusion; SavePolicy is reached without a query.
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.Anything).
			Return(savedPolicy, (*model.AppError)(nil)).Once()

		teamPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		result, appErr := th.App.CreateOrUpdateAccessControlPolicy(rctx, teamPolicy)
		require.Nil(t, appErr)
		require.NotNil(t, result)
	})

	t.Run("team admin included by a non-true expression runs the shared guard and saves", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
			cfg.FeatureFlags.AttributeValueMasking = false
		}).InitBasic(t)

		callerID := th.BasicUser.Id
		rctx := th.Context.WithSession(&model.Session{
			UserId: callerID,
			Id:     model.NewId(),
			Roles:  model.SystemUserRoleId, // not a system admin
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		expression := `user.attributes.dept == "eng"`
		savedPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: expression},
			},
		}
		// Non-"true" expression must go through checkSelfInclusion.
		mockACS.On("QueryUsersForExpression",
			mock.AnythingOfType("*request.Context"),
			expression,
			mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
				return opts.SubjectID == callerID
			}),
		).Return([]*model.User{{Id: callerID}}, int64(1), nil).Once()
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.Anything).
			Return(savedPolicy, (*model.AppError)(nil)).Once()

		teamPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: expression},
			},
		}

		result, appErr := th.App.CreateOrUpdateAccessControlPolicy(rctx, teamPolicy)
		require.Nil(t, appErr)
		require.NotNil(t, result)
	})

	t.Run("system admin bypasses the team self-inclusion guard", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
			cfg.FeatureFlags.AttributeValueMasking = false
		}).InitBasic(t)

		// System admin session — HasPermissionTo(PermissionManageSystem) returns true.
		rctx := th.Context.WithSession(&model.Session{
			UserId: th.SystemAdminUser.Id,
			Id:     model.NewId(),
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() {
			th.App.Srv().ch.AccessControl = originalACS
			mockACS.AssertExpectations(t)
		})

		// QueryUsersForExpression must NOT be called — guard is skipped for system admins.

		savedPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "false"},
			},
		}
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.Anything).
			Return(savedPolicy, (*model.AppError)(nil)).Once()

		teamPolicy := &model.AccessControlPolicy{
			ID:   th.BasicTeam.Id,
			Type: model.AccessControlPolicyTypeTeam,
			Rules: []model.AccessControlPolicyRule{
				// Expression that would exclude most users — system admin saves it anyway.
				{Actions: []string{"membership"}, Expression: "false"},
			},
		}

		result, appErr := th.App.CreateOrUpdateAccessControlPolicy(rctx, teamPolicy)
		require.Nil(t, appErr)
		require.NotNil(t, result)
	})
}
