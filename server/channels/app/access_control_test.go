// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func celSafeName() string {
	return "f_" + model.NewId()
}

func TestPopulateAccessControlPolicyChildCounts(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("nil policy is a no-op", func(t *testing.T) {
		// Must not panic on a nil policy.
		th.App.PopulateAccessControlPolicyChildCounts(th.Context, nil)
	})

	t.Run("non-parent policy is left untouched", func(t *testing.T) {
		policy := &model.AccessControlPolicy{ID: model.NewId(), Type: model.AccessControlPolicyTypeTeam}
		th.App.PopulateAccessControlPolicyChildCounts(th.Context, policy)
		assert.Nil(t, policy.Props, "child counts must only be stamped on parent policies")
	})

	t.Run("parent policy with no children gets zeroed counts and empty child_ids", func(t *testing.T) {
		policy := &model.AccessControlPolicy{ID: model.NewId(), Type: model.AccessControlPolicyTypeParent}
		th.App.PopulateAccessControlPolicyChildCounts(th.Context, policy)
		require.NotNil(t, policy.Props)
		assert.Equal(t, 0, policy.Props["channel_count"])
		assert.Equal(t, 0, policy.Props["team_count"])
		assert.Equal(t, []string{}, policy.Props["child_ids"])
	})
}

func storeMockWithMaskingOff(tb testing.TB) *TestHelper {
	tb.Helper()
	th := SetupWithStoreMock(tb)
	// Mutate in place — UpdateConfig persists config and triggers
	// listeners that call Store.Post(), which the mock store lacks.
	th.App.Config().FeatureFlags.AttributeValueMasking = false
	return th
}

func TestCreateOrUpdateAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
	}).InitBasic(t)

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil

		policy := &model.AccessControlPolicy{
			Type: model.AccessControlPolicyTypeParent,
			Name: "test-policy",
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}
		result, err := th.App.CreateOrUpdateAccessControlPolicy(th.Context, policy)
		require.NotNil(t, err)
		require.Nil(t, result)
	})

	t.Run("Wildcard actions rewritten to membership and version set to v0.3", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		policy := &model.AccessControlPolicy{
			Type: model.AccessControlPolicyTypeParent,
			Name: "wildcard-rewrite",
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "user.attributes.team == \"eng\""},
			},
		}

		mockAccessControl.On("SavePolicy", th.Context, mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Version == model.AccessControlPolicyVersionV0_3 &&
				len(p.Rules) == 1 &&
				len(p.Rules[0].Actions) == 1 &&
				p.Rules[0].Actions[0] == model.AccessControlPolicyActionMembership
		})).Return(policy, nil).Once()

		result, err := th.App.CreateOrUpdateAccessControlPolicy(th.Context, policy)
		require.Nil(t, err)
		require.NotNil(t, result)
		mockAccessControl.AssertExpectations(t)
	})

	t.Run("Multiple rules with mixed actions", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		policy := &model.AccessControlPolicy{
			Type: model.AccessControlPolicyTypeParent,
			Name: "mixed-actions",
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "expr1"},
				{Actions: []string{model.AccessControlPolicyActionUploadFileAttachment}, Expression: "expr2"},
			},
		}

		mockAccessControl.On("SavePolicy", th.Context, mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Rules[0].Actions[0] == model.AccessControlPolicyActionMembership &&
				p.Rules[1].Actions[0] == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(policy, nil).Once()

		result, err := th.App.CreateOrUpdateAccessControlPolicy(th.Context, policy)
		require.Nil(t, err)
		require.NotNil(t, result)
		mockAccessControl.AssertExpectations(t)
	})

	t.Run("Generates ID when empty", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		policy := &model.AccessControlPolicy{
			Type: model.AccessControlPolicyTypeParent,
			Name: "no-id",
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}

		mockAccessControl.On("SavePolicy", th.Context, mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.ID != "" && model.IsValidId(p.ID)
		})).Return(policy, nil).Once()

		result, err := th.App.CreateOrUpdateAccessControlPolicy(th.Context, policy)
		require.Nil(t, err)
		require.NotNil(t, result)
		mockAccessControl.AssertExpectations(t)
	})

	t.Run("Channel-type policy broadcasts policy enforced update", func(t *testing.T) {
		thMock := storeMockWithMaskingOff(t)

		channelID := model.NewId()
		channelPolicy := &model.AccessControlPolicy{
			ID:   channelID,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		// publishChannelPolicyEnforcedUpdate is expected to invalidate the
		// channel cache and reload the channel for the WS payload.
		mockChannelStore.On("InvalidateChannel", channelID).Once()
		// Channel().Get is now hit twice during a successful save:
		//   1. ValidateChannelEligibilityForAccessControl loads the channel
		//      to enforce the default / DM / GM / group-constrained / shared
		//      eligibility rules before SavePolicy.
		//   2. publishChannelPolicyEnforcedUpdate reloads it after save to
		//      build the WS payload.
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Twice()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("SavePolicy", thMock.Context, mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.ID == channelID && p.Type == model.AccessControlPolicyTypeChannel
		})).Return(channelPolicy, nil).Once()

		result, err := thMock.App.CreateOrUpdateAccessControlPolicy(thMock.Context, channelPolicy)
		require.Nil(t, err)
		require.NotNil(t, result)

		mockAccessControl.AssertExpectations(t)
		mockChannelStore.AssertCalled(t, "InvalidateChannel", channelID)
		mockChannelStore.AssertCalled(t, "Get", channelID, true)
		mockChannelStore.AssertExpectations(t)
	})

	t.Run("Parent-type policy does not broadcast channel-only update", func(t *testing.T) {
		thMock := storeMockWithMaskingOff(t)

		parentID := model.NewId()
		parentPolicy := &model.AccessControlPolicy{
			ID:   parentID,
			Type: model.AccessControlPolicyTypeParent,
			Name: "parent-no-broadcast",
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore).Maybe()

		// A parent save fans out to both its channel and team children;
		// with no children of either kind, neither search yields a broadcast.
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("SearchPolicies", thMock.Context, mock.MatchedBy(func(s model.AccessControlPolicySearch) bool {
			return s.Type == model.AccessControlPolicyTypeChannel && s.ParentID == parentID
		})).Return([]*model.AccessControlPolicy{}, int64(0), nil)
		mockACPStore.On("SearchPolicies", thMock.Context, mock.MatchedBy(func(s model.AccessControlPolicySearch) bool {
			return s.Type == model.AccessControlPolicyTypeTeam && s.ParentID == parentID
		})).Return([]*model.AccessControlPolicy{}, int64(0), nil)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("SavePolicy", thMock.Context, mock.Anything).Return(parentPolicy, nil).Once()

		result, err := thMock.App.CreateOrUpdateAccessControlPolicy(thMock.Context, parentPolicy)
		require.Nil(t, err)
		require.NotNil(t, result)

		mockChannelStore.AssertNotCalled(t, "InvalidateChannel", mock.Anything)
		mockChannelStore.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
	})
}

func TestDeleteAccessControlPolicy(t *testing.T) {
	t.Run("Feature not enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().ch.AccessControl = nil

		appErr := th.App.DeleteAccessControlPolicy(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("GetPolicy error is propagated", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		policyID := model.NewId()
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		expectedErr := model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "boom", http.StatusInternalServerError)
		mockAccessControl.On("GetPolicy", th.Context, policyID).Return(nil, expectedErr).Once()

		appErr := th.App.DeleteAccessControlPolicy(th.Context, policyID)
		require.NotNil(t, appErr)
		require.Equal(t, expectedErr.Id, appErr.Id)
		mockAccessControl.AssertNotCalled(t, "DeletePolicy", mock.Anything, mock.Anything)
	})

	t.Run("Channel-type policy invalidates cache and broadcasts update", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)

		channelID := model.NewId()
		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_3,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		// publishChannelPolicyEnforcedUpdate must invalidate the channel
		// cache and reload the channel for the WS payload.
		mockChannelStore.On("InvalidateChannel", channelID).Once()
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Once()

		// channel-type policies must NOT trigger a parent fan-out search.
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", thMock.Context, channelID).Return(channelPolicy, nil).Once()
		mockAccessControl.On("DeletePolicy", thMock.Context, channelID).Return(nil).Once()

		appErr := thMock.App.DeleteAccessControlPolicy(thMock.Context, channelID)
		require.Nil(t, appErr)

		mockAccessControl.AssertExpectations(t)
		mockChannelStore.AssertCalled(t, "InvalidateChannel", channelID)
		mockChannelStore.AssertCalled(t, "Get", channelID, true)
		mockACPStore.AssertNotCalled(t, "SearchPolicies", mock.Anything, mock.Anything)
	})

	t.Run("Parent-type policy fans out to all child channels", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)

		parentID := model.NewId()
		childChannelID := model.NewId()

		parentPolicy := &model.AccessControlPolicy{
			ID:      parentID,
			Type:    model.AccessControlPolicyTypeParent,
			Name:    "parent-broadcast",
			Version: model.AccessControlPolicyVersionV0_3,
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		// One affected child channel must have its cache invalidated and be reloaded.
		mockChannelStore.On("InvalidateChannel", childChannelID).Once()
		mockChannelStore.On("Get", childChannelID, true).Return(&model.Channel{Id: childChannelID, Type: model.ChannelTypePrivate}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		// channelPolicyIDsWithImport (called pre-delete) returns one child.
		mockACPStore.On("SearchPolicies", thMock.Context, mock.MatchedBy(func(s model.AccessControlPolicySearch) bool {
			return s.Type == model.AccessControlPolicyTypeChannel && s.ParentID == parentID
		})).Return([]*model.AccessControlPolicy{{ID: childChannelID, Type: model.AccessControlPolicyTypeChannel}}, int64(1), nil).Once()
		// teamPolicyIDsWithImport is also called for parent-type deletes; no team children here.
		mockACPStore.On("SearchPolicies", thMock.Context, mock.MatchedBy(func(s model.AccessControlPolicySearch) bool {
			return s.Type == model.AccessControlPolicyTypeTeam && s.ParentID == parentID
		})).Return([]*model.AccessControlPolicy{}, int64(0), nil).Once()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", thMock.Context, parentID).Return(parentPolicy, nil).Once()
		mockAccessControl.On("DeletePolicy", thMock.Context, parentID).Return(nil).Once()

		appErr := thMock.App.DeleteAccessControlPolicy(thMock.Context, parentID)
		require.Nil(t, appErr)

		mockAccessControl.AssertExpectations(t)
		mockChannelStore.AssertCalled(t, "InvalidateChannel", childChannelID)
		mockChannelStore.AssertCalled(t, "Get", childChannelID, true)
	})

	t.Run("Channel-type policy: DeletePolicy error short-circuits broadcast", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)

		channelID := model.NewId()
		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_3,
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore).Maybe()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", thMock.Context, channelID).Return(channelPolicy, nil).Once()
		expectedErr := model.NewAppError("DeletePolicy", "app.pap.delete.app_error", nil, "delete failed", http.StatusInternalServerError)
		mockAccessControl.On("DeletePolicy", thMock.Context, channelID).Return(expectedErr).Once()

		appErr := thMock.App.DeleteAccessControlPolicy(thMock.Context, channelID)
		require.NotNil(t, appErr)
		require.Equal(t, expectedErr.Id, appErr.Id)

		// Broadcast must not happen if deletion failed.
		mockChannelStore.AssertNotCalled(t, "InvalidateChannel", mock.Anything)
		mockChannelStore.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
	})

	t.Run("Caller with masked values is blocked from deleting (403)", func(t *testing.T) {
		// When AttributeValueMasking is on and the caller cannot see all values in the
		// policy, the delete must be refused with the masked_values 403. This closes
		// the gap where a delegated admin could remove a policy whose conditions they
		// could not audit. The canonical walker's HasMaskedValuesForCaller is mocked
		// to return true, simulating a hidden-value field without requiring a full
		// CPA setup for the test.
		th := Setup(t).InitBasic(t)

		callerID := model.NewId()
		th.Context = th.Context.WithSession(&model.Session{UserId: callerID, Id: model.NewId()}).(*request.Context)

		policyID := model.NewId()
		sensitivePolicy := &model.AccessControlPolicy{
			ID:      policyID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_3,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.f_unknown_field == "Secret"`},
			},
		}

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, policyID).Return(sensitivePolicy, nil).Once()
		// Canonical walker: unknown field fails closed → HasMaskedValuesForCaller returns true.
		mockAccessControl.On("HasMaskedValuesForCaller", mock.Anything, mock.Anything, mock.Anything).Return(true, nil).Once()

		appErr := th.App.DeleteAccessControlPolicy(th.Context, policyID)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.Equal(t, "app.pap.delete_policy.masked_values", appErr.Id)

		mockAccessControl.AssertNotCalled(t, "DeletePolicy", mock.Anything, mock.Anything)
		mockAccessControl.AssertExpectations(t)
	})

	t.Run("Masking flag off: delete proceeds for callers that would otherwise be blocked", func(t *testing.T) {
		// Belt-and-braces: with AttributeValueMasking off, the masking guard must not
		// fire — the policy deletes normally even if the caller wouldn't have seen all
		// values. Guards against accidentally inverting the flag condition.
		thMock := storeMockWithMaskingOff(t)

		thMock.Context = thMock.Context.WithSession(&model.Session{UserId: model.NewId(), Id: model.NewId()}).(*request.Context)

		channelID := model.NewId()
		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_3,
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("InvalidateChannel", channelID).Once()
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Once()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", thMock.Context, channelID).Return(channelPolicy, nil).Once()
		mockAccessControl.On("DeletePolicy", thMock.Context, channelID).Return(nil).Once()

		appErr := thMock.App.DeleteAccessControlPolicy(thMock.Context, channelID)
		require.Nil(t, appErr)
		mockAccessControl.AssertExpectations(t)
		mockChannelStore.AssertExpectations(t)
	})
}

// TestCheckSelfInclusion verifies the self-exclusion guard: non-admin callers must
// satisfy their own policy after saving, or the save is refused with 403
// self_exclusion. Sysadmins are exempt at the call site
// (CreateOrUpdateAccessControlPolicy), not inside checkSelfInclusion itself — this
// test exercises the function directly.
func TestCheckSelfInclusion(t *testing.T) {
	t.Run("caller who satisfies the policy passes", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		callerID := th.BasicUser.Id

		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.team == "ops"`},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		// QueryUsersForExpression returns the caller → matches → no error.
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return([]*model.User{{Id: callerID}}, int64(1), nil).Once()

		appErr := th.App.checkSelfInclusion(th.Context, policy, callerID, false)
		require.Nil(t, appErr)
		mockACS.AssertExpectations(t)
	})

	t.Run("caller who does not satisfy the policy is rejected with specific self_exclusion error when no hidden values were merged", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		callerID := th.BasicUser.Id

		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.team == "ops"`},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		// No users returned → caller does not satisfy → expect specific self_exclusion error.
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return([]*model.User{}, int64(0), nil).Once()

		appErr := th.App.checkSelfInclusion(th.Context, policy, callerID, false)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.Equal(t, "app.pap.save_policy.self_exclusion", appErr.Id)
		mockACS.AssertExpectations(t)
	})

	t.Run("caller who does not satisfy the policy gets opaque 403 when hidden values were merged", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		callerID := th.BasicUser.Id

		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.clearance == "TopSecret"`},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		// No users returned → caller does not satisfy → mergedHidden=true returns generic forbidden.
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return([]*model.User{}, int64(0), nil).Once()

		appErr := th.App.checkSelfInclusion(th.Context, policy, callerID, true)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.Equal(t, "app.pap.save_policy.forbidden", appErr.Id)
		mockACS.AssertExpectations(t)
	})

	t.Run("trivial rules (empty / 'true') are skipped without querying", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		callerID := th.BasicUser.Id

		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: ""},
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		// No query should fire for trivial expressions — if it does, the mock will fail
		// the test by returning the default zero-value response.

		appErr := th.App.checkSelfInclusion(th.Context, policy, callerID, false)
		require.Nil(t, appErr)
		mockACS.AssertNotCalled(t, "QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything)
	})
}

func TestValidateExpressionAgainstRequesterExcludesNativeAttributes(t *testing.T) {
	th := Setup(t).InitBasic(t)
	requesterID := th.BasicUser.Id

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS

	// The requester query must scope to the requester AND request native-attribute
	// stripping so only the CPA parts are validated against the saving admin.
	mockACS.On("QueryUsersForExpression", mock.Anything, `user.isbot == false && user.attributes.team == "ops"`,
		mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.SubjectID == requesterID && opts.ExcludeNativeAttributes
		})).Return([]*model.User{{Id: requesterID}}, int64(1), nil).Once()

	matches, appErr := th.App.ValidateExpressionAgainstRequester(th.Context, `user.isbot == false && user.attributes.team == "ops"`, requesterID)
	require.Nil(t, appErr)
	require.True(t, matches)
	mockACS.AssertExpectations(t)
}

func TestGetChannelsForPolicy(t *testing.T) {
	th := Setup(t).InitBasic(t)

	policyID := "policyID"
	cursor := model.AccessControlPolicyCursor{}
	limit := 10

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil

		channels, total, err := th.App.GetChannelsForPolicy(th.Context, policyID, cursor, limit)
		require.NotNil(t, err)
		assert.Nil(t, channels)
		assert.Equal(t, int64(0), total)
	})

	t.Run("Invalid policy type", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), policyID).Return(&model.AccessControlPolicy{Type: "invalid"}, nil)

		channels, total, err := th.App.GetChannelsForPolicy(th.Context, policyID, cursor, limit)
		require.NotNil(t, err)
		require.Nil(t, channels)
		require.Equal(t, int64(0), total)
	})

	t.Run("Valid policy type - no channels", func(t *testing.T) {
		pID := model.NewId()
		parentPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeParent,
			ID:       pID,
			Name:     "parentPolicy",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"membership"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, pID).Return(parentPolicy, nil)

		channels, total, err := th.App.GetChannelsForPolicy(th.Context, pID, cursor, limit)
		require.Nil(t, err)
		require.NotNil(t, channels)
		require.Equal(t, int64(0), total)
	})

	t.Run("Valid policy type - with channels", func(t *testing.T) {
		pID := model.NewId()
		parentPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeParent,
			ID:       pID,
			Name:     "parentPolicy",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"membership"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		ch := th.CreatePrivateChannel(t, th.BasicTeam)

		childPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			ID:       ch.Id,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
		}

		appErr := childPolicy.Inherit(parentPolicy)
		require.Nil(t, appErr)

		var err error
		childPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, childPolicy)
		require.NoError(t, err)
		require.NotNil(t, childPolicy)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, pID).Return(parentPolicy, nil)

		channels, total, appErr := th.App.GetChannelsForPolicy(th.Context, pID, cursor, limit)
		require.Nil(t, appErr)
		require.NotNil(t, channels)
		require.Equal(t, int64(1), total)
		assert.Equal(t, ch.Id, channels[0].Id)

		mockAccessControl.On("GetPolicy", th.Context, ch.Id).Return(childPolicy, nil)
		channels, total, appErr = th.App.GetChannelsForPolicy(th.Context, ch.Id, cursor, limit)
		require.Nil(t, appErr)
		require.NotNil(t, channels)
		require.Equal(t, int64(1), total)
		assert.Equal(t, ch.Id, channels[0].Id)
	})
}

func TestSearchAccessControlPolicies(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("Feature not enabled", func(t *testing.T) {
		policies, total, err := th.App.SearchAccessControlPolicies(th.Context, model.AccessControlPolicySearch{})
		require.NotNil(t, err)
		require.Empty(t, policies)
		require.Equal(t, int64(0), total)
	})

	t.Run("Empty search result", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		policies, total, err := th.App.SearchAccessControlPolicies(th.Context, model.AccessControlPolicySearch{})
		require.Nil(t, err)
		require.Empty(t, policies)
		require.Equal(t, int64(0), total)
	})

	t.Run("Single search result", func(t *testing.T) {
		pID := model.NewId()
		parentPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeParent,
			ID:       pID,
			Name:     "parentPolicy",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"membership"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		var err error
		parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
		require.NoError(t, err)
		require.NotNil(t, parentPolicy)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, parentPolicy.ID)
			require.NoError(t, dErr)
		}()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("NormalizePolicy", th.Context, parentPolicy).Return(parentPolicy, nil)

		t.Run("With no term", func(t *testing.T) {
			policies, total, err := th.App.SearchAccessControlPolicies(th.Context, model.AccessControlPolicySearch{})
			require.Nil(t, err)
			require.NotNil(t, policies)
			require.Equal(t, int64(1), total)
			require.Equal(t, parentPolicy.ID, policies[0].ID)
		})

		t.Run("With term", func(t *testing.T) {
			policies, total, err := th.App.SearchAccessControlPolicies(th.Context, model.AccessControlPolicySearch{
				Term: "parent",
			})
			require.Nil(t, err)
			require.NotNil(t, policies)
			require.Equal(t, int64(1), total)
			require.Equal(t, parentPolicy.ID, policies[0].ID)
		})

		t.Run("With term and no results", func(t *testing.T) {
			policies, total, err := th.App.SearchAccessControlPolicies(th.Context, model.AccessControlPolicySearch{
				Term: "something else",
			})
			require.Nil(t, err)
			require.Empty(t, policies)
			require.Equal(t, int64(0), total)
		})
	})
}

func TestAssignAccessControlPolicyToChannels(t *testing.T) {
	th := Setup(t).InitBasic(t)

	parentID := model.NewId()

	parentPolicy := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeParent,
		ID:       parentID,
		Name:     "parentPolicy",
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_2,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"membership"},
				Expression: "user.attributes.program == \"non-existent-program\"",
			},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)
	t.Cleanup(func() {
		dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, parentPolicy.ID)
		require.NoError(t, dErr)
	})

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Equal(t, "app.pap.assign_access_control_policy_to_channels.app_error", err.Id)
	})

	t.Run("Error saving policy", func(t *testing.T) {
		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, ch)
			require.Nil(t, appErr)
		})

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		// Clear the mock before the channel cleanup runs (LIFO: this
		// cleanup is registered after the channel cleanup so it runs
		// first), so PermanentDeleteChannel's cleanupChannelAccessControlPolicy
		// is a no-op and doesn't hit an unmocked DeletePolicy.
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("GetPolicy", th.Context, ch.Id).Return(parentPolicy, nil)
		mockAccessControl.On("SavePolicy", th.Context, mock.Anything).Return(nil, model.NewAppError("SavePolicy", "error", nil, "save error", http.StatusInternalServerError))

		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{ch.Id})
		require.NotNil(t, err)
		require.Empty(t, policies)
	})

	t.Run("Parent policy not found", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(nil, model.NewAppError("GetPolicy", "error", nil, "not found", http.StatusNotFound))

		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{})
		require.NotNil(t, err)
		assert.Nil(t, policies)
	})

	t.Run("Policy is not of type parent", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeChannel}, nil)

		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Equal(t, "app.pap.assign_access_control_policy_to_channels.app_error", err.Id)
	})

	t.Run("Default channel is not supported", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeParent}, nil)

		townSquare, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr)

		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{townSquare.Id})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Equal(t, "app.pap.access_control.channel_default", err.Id)
	})

	t.Run("Channel is shared", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, privateChannel)
			require.Nil(t, appErr)
		})

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeParent}, nil)

		privateChannel.Shared = new(true)
		_, err := th.App.Srv().Store().Channel().Update(th.Context, privateChannel)
		require.NoError(t, err)

		policies, appErr := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{privateChannel.Id})
		require.NotNil(t, appErr)
		assert.Nil(t, policies)
		assert.Contains(t, appErr.Error(), "Channel is shared")
	})

	t.Run("Successful assignment", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, ch1)
			require.Nil(t, appErr)
		})
		ch2 := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, ch2)
			require.Nil(t, appErr)
		})

		childP1 := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			ID:       ch1.Id,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
		}
		childP2 := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			ID:       ch2.Id,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
		}

		appErr := childP1.Inherit(parentPolicy)
		require.Nil(t, appErr)
		appErr = childP2.Inherit(parentPolicy)
		require.Nil(t, appErr)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(nil, nil)
		mockAccessControl.On("GetPolicy", th.Context, ch2.Id).Return(nil, nil)
		mockAccessControl.On("SavePolicy", th.Context, mock.MatchedBy(func(p *model.AccessControlPolicy) bool { return p.ID == ch1.Id })).Return(childP1, nil)
		mockAccessControl.On("SavePolicy", th.Context, mock.MatchedBy(func(p *model.AccessControlPolicy) bool { return p.ID == ch2.Id })).Return(childP2, nil)

		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{ch1.Id, ch2.Id})
		require.Nil(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 2)
		assert.ElementsMatch(t, []string{ch1.Id, ch2.Id}, []string{policies[0].ID, policies[1].ID})
		mockAccessControl.AssertCalled(t, "SavePolicy", th.Context, mock.AnythingOfType("*model.AccessControlPolicy"))
	})
}

func TestChannelDeleteCleansUpAccessControlPolicy(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Wire up a mock ACS whose DeletePolicy writes through to the store, so the
	// cleanup path exercised by DeleteChannel/PermanentDeleteChannel actually
	// removes the row. Without this, cleanupChannelAccessControlPolicy is a
	// no-op when the enterprise service is not registered.
	mockACS := &mocks.AccessControlServiceInterface{}
	originalACS := th.App.Srv().ch.AccessControl
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() {
		th.App.Srv().ch.AccessControl = originalACS
	})
	mockACS.On("DeletePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
		Return(func(rctx request.CTX, id string) *model.AppError {
			if err := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, id); err != nil {
				return model.NewAppError("DeletePolicy", "test.delete", nil, err.Error(), http.StatusInternalServerError)
			}
			return nil
		}).Maybe()

	saveChildPolicy := func(t *testing.T, channelID string) {
		t.Helper()
		policy := &model.AccessControlPolicy{
			ID:       channelID,
			Type:     model.AccessControlPolicyTypeChannel,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Active:   true,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}
		saved, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		require.NotNil(t, saved)
	}

	t.Run("Archiving a channel deletes its channel-scope policy", func(t *testing.T) {
		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		saveChildPolicy(t, ch.Id)

		// Sanity: policy exists before archive.
		fetched, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, ch.Id)
		require.NoError(t, err)
		require.NotNil(t, fetched)

		// Reload via GetChannel without invalidating the cache. The channel
		// was created before the policy was saved directly to the store, so
		// the cached channel still reports PolicyEnforced=false. Cleanup must
		// still remove the orphan policy — it no longer trusts the stale
		// cached flag.
		reloaded, appErr := th.App.GetChannel(th.Context, ch.Id)
		require.Nil(t, appErr)

		appErr = th.App.DeleteChannel(th.Context, reloaded, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, err = th.App.Srv().Store().AccessControlPolicy().Get(th.Context, ch.Id)
		require.Error(t, err, "channel-scope policy should be removed when the channel is archived")
	})

	t.Run("Permanently deleting a channel deletes its channel-scope policy", func(t *testing.T) {
		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		saveChildPolicy(t, ch.Id)

		reloaded, appErr := th.App.GetChannel(th.Context, ch.Id)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteChannel(th.Context, reloaded)
		require.Nil(t, appErr)

		_, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, ch.Id)
		require.Error(t, err, "channel-scope policy should be removed when the channel is permanently deleted")
	})

	t.Run("Archiving a channel with no policy still succeeds", func(t *testing.T) {
		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			_ = th.App.PermanentDeleteChannel(th.Context, ch)
		})

		reloaded, appErr := th.App.GetChannel(th.Context, ch.Id)
		require.Nil(t, appErr)

		// cleanupChannelAccessControlPolicy intentionally calls DeletePolicy
		// unconditionally when acs is non-nil — DeletePolicy itself is
		// expected to be a no-op when no matching row exists.
		appErr = th.App.DeleteChannel(th.Context, reloaded, th.BasicUser.Id)
		require.Nil(t, appErr)
	})

	t.Run("Falls back to direct store delete when acs is nil", func(t *testing.T) {
		// Swap in a nil acs for the duration of this subtest so the cleanup
		// must take the store-level fallback path (e.g. running on Team
		// Edition where the enterprise ABAC service is not registered).
		th.App.Srv().ch.AccessControl = nil
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = mockACS })

		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		saveChildPolicy(t, ch.Id)

		reloaded, appErr := th.App.GetChannel(th.Context, ch.Id)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteChannel(th.Context, reloaded)
		require.Nil(t, appErr)

		_, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, ch.Id)
		require.Error(t, err, "policy should be removed via the store-level fallback when acs is nil")
	})

	t.Run("Falls back to direct store delete when acs reports NotImplemented", func(t *testing.T) {
		// Replace mockACS with one that always reports the operation as
		// unimplemented (e.g. license-gated build of the enterprise layer);
		// cleanup must still drop the orphan row through the store fallback.
		notImplementedACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = notImplementedACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = mockACS })
		notImplementedACS.On("DeletePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
			Return(model.NewAppError("DeletePolicy", "app.pap.not_initialized", nil, "PAP not initialized", http.StatusNotImplemented)).Once()

		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		saveChildPolicy(t, ch.Id)

		reloaded, appErr := th.App.GetChannel(th.Context, ch.Id)
		require.Nil(t, appErr)

		appErr = th.App.PermanentDeleteChannel(th.Context, reloaded)
		require.Nil(t, appErr)

		notImplementedACS.AssertCalled(t, "DeletePolicy", mock.AnythingOfType("*request.Context"), ch.Id)
		notImplementedACS.AssertExpectations(t)

		_, err := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, ch.Id)
		require.Error(t, err, "policy should be removed via the store-level fallback when acs reports NotImplemented")
	})
}

func TestUpdateChannelBlocksTypeConversionWhenPolicyEnforced(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// ABAC + license required for ChannelAccessControlled to report `enforced=true`.
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok, "SetLicense should return true")
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	mockACS := &mocks.AccessControlServiceInterface{}
	originalACS := th.App.Srv().ch.AccessControl
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = originalACS })
	mockACS.On("DeletePolicy", mock.Anything, mock.AnythingOfType("string")).Return((*model.AppError)(nil)).Maybe()

	stampPolicy := func(t *testing.T, channelID string) {
		t.Helper()
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
			ID:       channelID,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Active:   true,
			Rules:    []model.AccessControlPolicyRule{{Actions: []string{"membership"}, Expression: "true"}},
		})
		require.NoError(t, err)
		// Channel().Get is cached; PolicyEnforced is computed at fetch time
		// from the AccessControlPolicies table, so an existing cached entry
		// would still report `false`. Invalidate so the next Get re-computes.
		th.App.Srv().Store().Channel().InvalidateChannel(channelID)
	}

	t.Run("private → public is rejected when ABAC policy is attached", func(t *testing.T) {
		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() { _ = th.App.PermanentDeleteChannel(th.Context, ch) })
		stampPolicy(t, ch.Id)

		patch := *ch
		patch.Type = model.ChannelTypeOpen
		_, appErr := th.App.UpdateChannel(th.Context, &patch)
		require.NotNil(t, appErr, "type conversion must be blocked while a policy is attached")
		require.Equal(t, "api.channel.update_channel.policy_enforced_type_conversion.app_error", appErr.Id)
	})

	t.Run("public → private is rejected when ABAC policy is attached", func(t *testing.T) {
		ch := th.CreateChannel(t, th.BasicTeam)
		t.Cleanup(func() { _ = th.App.PermanentDeleteChannel(th.Context, ch) })
		stampPolicy(t, ch.Id)

		patch := *ch
		patch.Type = model.ChannelTypePrivate
		_, appErr := th.App.UpdateChannel(th.Context, &patch)
		require.NotNil(t, appErr, "type conversion must be blocked in either direction")
		require.Equal(t, "api.channel.update_channel.policy_enforced_type_conversion.app_error", appErr.Id)
	})

	t.Run("non-type updates still succeed on policy-enforced channels", func(t *testing.T) {
		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() { _ = th.App.PermanentDeleteChannel(th.Context, ch) })
		stampPolicy(t, ch.Id)

		patch := *ch
		patch.Header = "updated header"
		_, appErr := th.App.UpdateChannel(th.Context, &patch)
		require.Nil(t, appErr, "non-type updates should pass through; the gate is type-conversion only")
	})
}

func TestUnassignPoliciesFromChannels(t *testing.T) {
	th := Setup(t).InitBasic(t)

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Name:     "parent-for-unassign-tests",
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_2,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{"membership"}, Expression: "true"},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)
	t.Cleanup(func() {
		_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, parentPolicy.ID)
	})

	ch1 := th.CreatePrivateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		sErr := th.App.PermanentDeleteChannel(th.Context, ch1)
		require.Nil(t, sErr)
	})
	ch2 := th.CreatePrivateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		sErr := th.App.PermanentDeleteChannel(th.Context, ch2)
		require.Nil(t, sErr)
	})

	// Clear any lingering AccessControl mock before per-channel cleanups run,
	// so PermanentDeleteChannel's cleanupChannelAccessControlPolicy uses the
	// store fallback (or no-ops) during teardown and doesn't call into a
	// subtest mock whose Once() expectations may already be exhausted.
	// Registered last at the parent level so it runs first (t.Cleanup is LIFO).
	t.Cleanup(func() {
		th.App.Srv().ch.AccessControl = nil
	})

	// saveChildPolicy provisions a fresh child policy for the given channel,
	// linked to parentPolicy, and registers a t.Cleanup that removes the row
	// at the end of the calling subtest. Save is idempotent (it moves any
	// existing row to history and inserts a new revision), so repeated calls
	// across subtests are safe even when a previous subtest deleted the row.
	saveChildPolicy := func(t *testing.T, channelID string) *model.AccessControlPolicy {
		t.Helper()
		child := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			ID:       channelID,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
		}
		require.Nil(t, child.Inherit(parentPolicy))
		saved, sErr := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
		require.NoError(t, sErr)
		require.NotNil(t, saved)
		t.Cleanup(func() {
			// Idempotent: store Delete is a no-op when no row exists, which
			// is exactly the case when the subtest's UnassignPoliciesFromChannels
			// successfully removed it.
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, saved.ID)
		})
		return saved
	}

	// bindStoreDelete wires the mock's DeletePolicy to delegate to the real
	// store. This way successful mock invocations actually drop the underlying
	// row and the subtest can verify deletion at the store level — not just
	// at the mock-assertion level.
	bindStoreDelete := func(m *mocks.AccessControlServiceInterface) {
		m.On("DeletePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
			Return(func(rctx request.CTX, id string) *model.AppError {
				if err := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, id); err != nil {
					return model.NewAppError("DeletePolicy", "test.delete", nil, err.Error(), http.StatusInternalServerError)
				}
				return nil
			}).Maybe()
	}

	t.Run("Feature not enabled", func(t *testing.T) {
		childPolicy1 := saveChildPolicy(t, ch1.Id)
		childPolicy2 := saveChildPolicy(t, ch2.Id)

		th.App.Srv().ch.AccessControl = nil

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.unassign_access_control_policy_from_channels.app_error", appErr.Id)

		// No mock available — skip mock assertions. Always verify store state:
		// the function bailed before touching anything, so both rows must remain.
		_, sErr := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy1.ID)
		require.NoError(t, sErr, "child policy for ch1 should remain in store when feature is disabled")
		_, sErr = th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy2.ID)
		require.NoError(t, sErr, "child policy for ch2 should remain in store when feature is disabled")
	})

	t.Run("Error deleting policy from AccessControlService", func(t *testing.T) {
		childPolicy1 := saveChildPolicy(t, ch1.Id)
		childPolicy2 := saveChildPolicy(t, ch2.Id)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(childPolicy1, nil).Once()

		expectedErr := model.NewAppError("DeletePolicy", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, "failed to delete from acs", http.StatusInternalServerError)
		mockAccessControl.On("DeletePolicy", th.Context, ch1.Id).Return(expectedErr).Once()

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, expectedErr.Id, appErr.Id)
		assert.Equal(t, expectedErr.Message, appErr.Message)

		// Mock assertions: service IS available so we can assert which methods
		// were dispatched. The function bails on the first DeletePolicy error,
		// so ch2 must NOT have been processed.
		mockAccessControl.AssertCalled(t, "DeletePolicy", th.Context, ch1.Id)
		mockAccessControl.AssertNotCalled(t, "DeletePolicy", th.Context, ch2.Id)

		// Always verify store state regardless of the mock outcome: the
		// mock returned an error so the row for ch1 must still exist, and
		// ch2 was never reached.
		_, sErr := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy1.ID)
		require.NoError(t, sErr, "child policy for ch1 should remain when DeletePolicy fails")
		_, sErr = th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy2.ID)
		require.NoError(t, sErr, "child policy for ch2 should remain when iteration short-circuits")
	})

	t.Run("Channel not actually a child policy", func(t *testing.T) {
		childPolicy1 := saveChildPolicy(t, ch1.Id)
		childPolicy2 := saveChildPolicy(t, ch2.Id)

		ch3 := th.CreatePrivateChannel(t, th.BasicTeam) // Not a child of parentPolicy
		t.Cleanup(func() { _ = th.App.PermanentDeleteChannel(th.Context, ch3) })

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		// Clear the mock before ch3 cleanup runs (LIFO: registered after the
		// channel cleanup so it runs first), so cleanupChannelAccessControlPolicy
		// during teardown takes the store fallback path.
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(childPolicy1, nil).Once()
		mockAccessControl.On("GetPolicy", th.Context, ch2.Id).Return(childPolicy2, nil).Once()
		bindStoreDelete(mockAccessControl)

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id, ch3.Id})
		require.Nil(t, appErr)

		// Mock assertions: ch1 and ch2 are parent's children → DeletePolicy invoked;
		// ch3 is not → must be skipped without ever calling DeletePolicy.
		mockAccessControl.AssertCalled(t, "DeletePolicy", th.Context, ch1.Id)
		mockAccessControl.AssertCalled(t, "DeletePolicy", th.Context, ch2.Id)
		mockAccessControl.AssertNotCalled(t, "DeletePolicy", th.Context, ch3.Id)

		// Always verify store state — the mocked DeletePolicy delegates to the
		// real store, so the rows for ch1 and ch2 must be gone.
		_, sErr := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy1.ID)
		require.Error(t, sErr, "child policy for ch1 should be removed from store")
		_, sErr = th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy2.ID)
		require.Error(t, sErr, "child policy for ch2 should be removed from store")
	})

	t.Run("Successful unassignment", func(t *testing.T) {
		childPolicy1 := saveChildPolicy(t, ch1.Id)
		childPolicy2 := saveChildPolicy(t, ch2.Id)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(childPolicy1, nil).Once()
		mockAccessControl.On("GetPolicy", th.Context, ch2.Id).Return(childPolicy2, nil).Once()
		bindStoreDelete(mockAccessControl)

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.Nil(t, appErr)

		// Mock assertions: service available, both targets must have been
		// dispatched through DeletePolicy.
		mockAccessControl.AssertCalled(t, "DeletePolicy", th.Context, ch1.Id)
		mockAccessControl.AssertCalled(t, "DeletePolicy", th.Context, ch2.Id)

		// Always verify store-level deletion regardless of mock state.
		_, sErr := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy1.ID)
		require.Error(t, sErr, "child policy for ch1 should be removed from store")
		_, sErr = th.App.Srv().Store().AccessControlPolicy().Get(th.Context, childPolicy2.ID)
		require.Error(t, sErr, "child policy for ch2 should be removed from store")
	})

	t.Run("Invalidate channel cache", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)

		channelID := model.NewId()
		parentPolicyID := model.NewId()

		// Create a child policy for the channel that only has the parent policy as an import (no rules)
		childPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			ID:       channelID,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{parentPolicyID},
			Rules:    []model.AccessControlPolicyRule{},
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		mockAccessControlPolicyStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockAccessControlPolicyStore)
		// Mock SearchPolicies to return the child policy as a child of the parent
		mockAccessControlPolicyStore.On("SearchPolicies", thMock.Context, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: parentPolicyID,
			Limit:    1000,
		}).Return([]*model.AccessControlPolicy{childPolicy}, int64(1), nil)

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		// Expect InvalidateChannel to be called
		mockChannelStore.On("InvalidateChannel", channelID).Once()
		// publishChannelPolicyEnforcedUpdate calls Channel().Get(...) to load
		// the fresh channel (with PolicyEnforced computed) for the WS payload.
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Once()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockAccessControl

		// Mock GetPolicy to return the child policy
		mockAccessControl.On("GetPolicy", thMock.Context, channelID).Return(childPolicy, nil).Once()

		// Mock DeletePolicy to return nil (successful deletion)
		mockAccessControl.On("DeletePolicy", thMock.Context, channelID).Return(nil).Once()

		appErr := thMock.App.UnassignPoliciesFromChannels(thMock.Context, parentPolicyID, []string{channelID})
		require.Nil(t, appErr)

		mockChannelStore.AssertCalled(t, "InvalidateChannel", channelID)
	})
}

func TestValidateChannelAccessControlPermission(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

	// Create a private channel
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, privateChannel)
		require.Nil(t, appErr)
	})

	// Create a public channel
	publicChannel := th.CreateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, publicChannel)
		require.Nil(t, appErr)
	})

	// Create a user and make them channel admin
	channelAdmin := th.CreateUser(t)
	th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
	th.AddUserToChannel(t, channelAdmin, privateChannel)

	// Make user channel admin using the proper APP method
	_, appErr := th.App.UpdateChannelMemberRoles(th.Context, privateChannel.Id, channelAdmin.Id, "channel_user channel_admin")
	require.Nil(t, appErr)

	t.Run("Valid channel admin user", func(t *testing.T) {
		appErr := th.App.ValidateChannelAccessControlPermission(th.Context, channelAdmin.Id, privateChannel.Id)
		require.Nil(t, appErr)
	})

	t.Run("User who is not channel admin", func(t *testing.T) {
		regularUser := th.CreateUser(t)
		th.LinkUserToTeam(t, regularUser, th.BasicTeam)
		th.AddUserToChannel(t, regularUser, privateChannel)

		appErr := th.App.ValidateChannelAccessControlPermission(th.Context, regularUser.Id, privateChannel.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_channel_permissions", appErr.Id)
	})

	t.Run("Non-existent channel", func(t *testing.T) {
		nonExistentChannelId := model.NewId()
		appErr := th.App.ValidateChannelAccessControlPermission(th.Context, channelAdmin.Id, nonExistentChannelId)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.get.existing.app_error", appErr.Id)
	})

	t.Run("Public channel should succeed", func(t *testing.T) {
		th.AddUserToChannel(t, channelAdmin, publicChannel)

		// Make user channel admin for public channel
		_, appErr2 := th.App.UpdateChannelMemberRoles(th.Context, publicChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr2)

		appErr2 = th.App.ValidateChannelAccessControlPermission(th.Context, channelAdmin.Id, publicChannel.Id)
		require.Nil(t, appErr2)
	})

	t.Run("Shared channel should fail", func(t *testing.T) {
		sharedChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, sharedChannel)
			require.Nil(t, appErr)
		})

		// Mark channel as shared
		sharedChannel.Shared = new(true)
		_, err := th.App.Srv().Store().Channel().Update(th.Context, sharedChannel)
		require.NoError(t, err)

		th.AddUserToChannel(t, channelAdmin, sharedChannel)

		// Make user channel admin for shared channel
		_, appErr3 := th.App.UpdateChannelMemberRoles(th.Context, sharedChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr3)

		appErr3 = th.App.ValidateChannelAccessControlPermission(th.Context, channelAdmin.Id, sharedChannel.Id)
		require.NotNil(t, appErr3)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr3.Id)
	})

	t.Run("Default channel should fail", func(t *testing.T) {
		townSquare, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr)

		th.AddUserToChannel(t, channelAdmin, townSquare)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, townSquare.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr)

		appErr = th.App.ValidateChannelAccessControlPermission(th.Context, channelAdmin.Id, townSquare.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_default", appErr.Id)
	})
}

func TestValidateAccessControlPolicyPermission(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

	// Create a private channel and channel admin
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, privateChannel)
		require.Nil(t, appErr)
	})

	channelAdmin := th.CreateUser(t)
	th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
	th.AddUserToChannel(t, channelAdmin, privateChannel)

	// Make user channel admin using the proper APP method
	_, appErr := th.App.UpdateChannelMemberRoles(th.Context, privateChannel.Id, channelAdmin.Id, "channel_user channel_admin")
	require.Nil(t, appErr)

	// Create channel policy
	channelPolicy := &model.AccessControlPolicy{
		ID:       privateChannel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{"membership"}, Expression: "true"},
		},
	}
	var err2 error
	channelPolicy, err2 = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, channelPolicy)
	require.NoError(t, err2)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, channelPolicy.ID)
		require.NoError(t, sErr)
	})

	// Create parent policy
	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "parentPolicy",
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{"membership"}, Expression: "true"},
		},
	}
	parentPolicy, err2 = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err2)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, parentPolicy.ID)
		require.NoError(t, sErr)
	})

	// Set up mock Access Control service
	mockAccessControl := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockAccessControl
	// Clear the mock before per-channel cleanups run (LIFO: registered after
	// channel/policy cleanups so it runs first), so PermanentDeleteChannel's
	// cleanupChannelAccessControlPolicy is a no-op during teardown.
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

	mockAccessControl.On("GetPolicy", th.Context, channelPolicy.ID).Return(channelPolicy, nil)
	mockAccessControl.On("GetPolicy", th.Context, parentPolicy.ID).Return(parentPolicy, nil)
	mockAccessControl.On("GetPolicy", th.Context, mock.AnythingOfType("string")).Return(nil, model.NewAppError("GetPolicy", "app.access_control_policy.get.app_error", nil, "not found", http.StatusNotFound))

	t.Run("System admin accessing any policy should succeed", func(t *testing.T) {
		appErr := th.App.ValidateAccessControlPolicyPermission(th.Context, th.SystemAdminUser.Id, channelPolicy.ID)
		require.Nil(t, appErr)

		appErr = th.App.ValidateAccessControlPolicyPermission(th.Context, th.SystemAdminUser.Id, parentPolicy.ID)
		require.Nil(t, appErr)
	})

	t.Run("Channel admin accessing their channel's policy should succeed", func(t *testing.T) {
		appErr := th.App.ValidateAccessControlPolicyPermission(th.Context, channelAdmin.Id, channelPolicy.ID)
		require.Nil(t, appErr)
	})

	t.Run("Channel admin accessing parent policy should fail", func(t *testing.T) {
		appErr := th.App.ValidateAccessControlPolicyPermission(th.Context, channelAdmin.Id, parentPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Regular user accessing any policy should fail", func(t *testing.T) {
		regularUser := th.CreateUser(t)

		appErr := th.App.ValidateAccessControlPolicyPermission(th.Context, regularUser.Id, channelPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_channel_permissions", appErr.Id)

		appErr = th.App.ValidateAccessControlPolicyPermission(th.Context, regularUser.Id, parentPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Non-existent policy should fail", func(t *testing.T) {
		nonExistentPolicyId := model.NewId()
		appErr := th.App.ValidateAccessControlPolicyPermission(th.Context, channelAdmin.Id, nonExistentPolicyId)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control_policy.get.app_error", appErr.Id)
	})
}

func TestValidateChannelAccessControlPolicyCreation(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Create a private channel and channel admin
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, privateChannel)
		require.Nil(t, appErr)
	})

	anotherChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(th.Context, anotherChannel)
		require.Nil(t, appErr)
	})

	channelAdmin := th.CreateUser(t)
	th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
	th.AddUserToChannel(t, channelAdmin, privateChannel)

	// Make user channel admin using the proper APP method
	_, appErr := th.App.UpdateChannelMemberRoles(th.Context, privateChannel.Id, channelAdmin.Id, "channel_user channel_admin")
	require.Nil(t, appErr)

	t.Run("Channel admin creating policy for their channel should succeed", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       privateChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.Nil(t, appErr)
	})

	t.Run("Channel admin creating policy for another channel should fail", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       anotherChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_channel_permissions", appErr.Id)
	})

	t.Run("Creating parent-type policy as channel admin should fail", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Creating policy for public channel should succeed", func(t *testing.T) {
		publicChannel := th.CreateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, publicChannel)
			require.Nil(t, appErr)
		})

		th.AddUserToChannel(t, channelAdmin, publicChannel)

		// Make user channel admin for public channel
		_, appErr4 := th.App.UpdateChannelMemberRoles(th.Context, publicChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr4)

		policy := &model.AccessControlPolicy{
			ID:       publicChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		appErr4 = th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.Nil(t, appErr4)
	})

	t.Run("Creating policy for shared channel should fail", func(t *testing.T) {
		sharedChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, sharedChannel)
			require.Nil(t, appErr)
		})

		// Mark channel as shared
		sharedChannel.Shared = new(true)
		_, err := th.App.Srv().Store().Channel().Update(th.Context, sharedChannel)
		require.NoError(t, err)

		th.AddUserToChannel(t, channelAdmin, sharedChannel)

		// Make user channel admin for shared channel
		_, appErr5 := th.App.UpdateChannelMemberRoles(th.Context, sharedChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr5)

		policy := &model.AccessControlPolicy{
			ID:       sharedChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		appErr5 = th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr5)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr5.Id)
	})

	t.Run("Creating policy for default channel should fail", func(t *testing.T) {
		townSquare, appErr := th.App.GetChannelByName(th.Context, model.DefaultChannelName, th.BasicTeam.Id, false)
		require.Nil(t, appErr)

		th.AddUserToChannel(t, channelAdmin, townSquare)

		_, appErr = th.App.UpdateChannelMemberRoles(th.Context, townSquare.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr)

		policy := &model.AccessControlPolicy{
			ID:       townSquare.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		}

		appErr = th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.channel_default", appErr.Id)
	})
}

func TestTestExpressionWithChannelContext(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Create test session with user
	session := model.Session{
		UserId: th.BasicUser.Id,
		Id:     model.NewId(),
	}

	// Setup test context with session
	th.Context = th.Context.WithSession(&session).(*request.Context)

	t.Run("should allow channel admin to test expression they match", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "user.attributes.department == 'engineering'"
		opts := model.SubjectSearchOptions{Limit: 50}

		// Mock that admin matches the expression (for validation)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{th.BasicUser}, int64(1), nil) // Admin matches

		// Mock the actual search results
		expectedUsers := []*model.User{th.BasicUser, th.BasicUser2}
		expectedCount := int64(2)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			opts,
		).Return(expectedUsers, expectedCount, nil)

		// Call the function
		users, count, appErr := th.App.TestExpressionWithChannelContext(th.Context, expression, opts)

		require.Nil(t, appErr)
		require.Equal(t, expectedUsers, users)
		require.Equal(t, expectedCount, count)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should deny channel admin testing expression they don't match", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "user.attributes.department == 'sales'"
		opts := model.SubjectSearchOptions{Limit: 50}

		// Mock that admin does NOT match the expression (for validation)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{}, int64(0), nil) // Admin doesn't match

		// Call the function
		users, count, appErr := th.App.TestExpressionWithChannelContext(th.Context, expression, opts)

		require.Nil(t, appErr)
		require.Empty(t, users) // Should return empty results
		require.Equal(t, int64(0), count)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should handle complex expression with multiple attributes", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		// Complex expression with multiple conditions
		expression := "user.attributes.department == 'engineering' && user.attributes.team == 'backend'"
		opts := model.SubjectSearchOptions{Limit: 50}

		// Mock that admin matches the expression (for validation)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{th.BasicUser}, int64(1), nil) // Admin matches

		// Mock the actual search results
		expectedUsers := []*model.User{th.BasicUser, th.BasicUser2}
		expectedCount := int64(2)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			opts,
		).Return(expectedUsers, expectedCount, nil)

		// Call the function
		users, count, appErr := th.App.TestExpressionWithChannelContext(th.Context, expression, opts)

		require.Nil(t, appErr)
		require.Equal(t, expectedUsers, users)
		require.Equal(t, expectedCount, count)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should deny when admin partially matches expression", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		// Expression that admin only partially matches (has department but not team)
		expression := "user.attributes.department == 'engineering' && user.attributes.team == 'frontend'"
		opts := model.SubjectSearchOptions{Limit: 50}

		// Mock that admin does NOT match the full expression (for validation)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{}, int64(0), nil) // Admin doesn't match full expression

		// Call the function
		users, count, appErr := th.App.TestExpressionWithChannelContext(th.Context, expression, opts)

		require.Nil(t, appErr)
		require.Empty(t, users) // Should return empty results
		require.Equal(t, int64(0), count)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should allow expressions with different operators", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		// Expression with != operator
		expression := "user.attributes.department != 'sales'"
		opts := model.SubjectSearchOptions{Limit: 50}

		// Mock that admin matches the expression (admin has department='engineering')
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{th.BasicUser}, int64(1), nil) // Admin matches

		// Mock the actual search results
		expectedUsers := []*model.User{th.BasicUser, th.BasicUser2}
		expectedCount := int64(2)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			opts,
		).Return(expectedUsers, expectedCount, nil)

		// Call the function
		users, count, appErr := th.App.TestExpressionWithChannelContext(th.Context, expression, opts)

		require.Nil(t, appErr)
		require.Equal(t, expectedUsers, users)
		require.Equal(t, expectedCount, count)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should handle error in validation step", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "user.attributes.department == 'engineering'"
		opts := model.SubjectSearchOptions{Limit: 50}

		// Mock that validation step fails
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{}, int64(0), model.NewAppError("TestExpressionWithChannelContext", "app.access_control.query.app_error", nil, "validation error", http.StatusInternalServerError))

		// Call the function
		_, _, appErr := th.App.TestExpressionWithChannelContext(th.Context, expression, opts)

		require.NotNil(t, appErr)
		require.Equal(t, "TestExpressionWithChannelContext", appErr.Where)
		mockAccessControlService.AssertExpectations(t)
	})
}

func TestValidateExpressionAgainstRequester(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("should return true when requester matches expression", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "user.attributes.team == 'engineering'"
		requesterID := th.BasicUser.Id

		// Mock that the requester is found in the results (optimized query)
		mockUsers := []*model.User{th.BasicUser}
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1, ExcludeNativeAttributes: true},
		).Return(mockUsers, int64(1), nil)

		// Call the function
		matches, appErr := th.App.ValidateExpressionAgainstRequester(th.Context, expression, requesterID)

		require.Nil(t, appErr)
		require.True(t, matches)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should return false when requester does not match expression", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "user.attributes.team == 'engineering'"
		requesterID := th.BasicUser.Id

		// Mock that the requester is NOT found in the results (optimized query)
		mockUsers := []*model.User{} // Empty results - requester doesn't match
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1, ExcludeNativeAttributes: true},
		).Return(mockUsers, int64(0), nil)

		// Call the function
		matches, appErr := th.App.ValidateExpressionAgainstRequester(th.Context, expression, requesterID)

		require.Nil(t, appErr)
		require.False(t, matches)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should return false when no users match expression", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "user.attributes.team == 'nonexistent'"
		requesterID := th.BasicUser.Id

		// Mock that no users match the expression (optimized query)
		mockUsers := []*model.User{}
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1, ExcludeNativeAttributes: true},
		).Return(mockUsers, int64(0), nil)

		// Call the function
		matches, appErr := th.App.ValidateExpressionAgainstRequester(th.Context, expression, requesterID)

		require.Nil(t, appErr)
		require.False(t, matches)
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should handle access control service error", func(t *testing.T) {
		// Setup mock access control service
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControlService

		expression := "invalid expression"
		requesterID := th.BasicUser.Id

		// Mock that the service returns an error (optimized query)
		mockAccessControlService.On(
			"QueryUsersForExpression",
			th.Context,
			expression,
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1, ExcludeNativeAttributes: true},
		).Return([]*model.User{}, int64(0), model.NewAppError("ValidateExpressionAgainstRequester", "app.access_control.validate_requester.app_error", nil, "expression parsing error", http.StatusInternalServerError))

		// Call the function
		matches, appErr := th.App.ValidateExpressionAgainstRequester(th.Context, expression, requesterID)

		require.NotNil(t, appErr)
		require.False(t, matches)
		require.Equal(t, "ValidateExpressionAgainstRequester", appErr.Where)
		require.Contains(t, appErr.DetailedError, "expression parsing error")
		mockAccessControlService.AssertExpectations(t)
	})

	t.Run("should handle missing access control service", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil

		matches, appErr := th.App.ValidateExpressionAgainstRequester(th.Context, "true", th.BasicUser.Id)

		require.NotNil(t, appErr)
		require.False(t, matches)
		require.Equal(t, "ValidateExpressionAgainstRequester", appErr.Where)
		require.Contains(t, appErr.Message, "Could not check expression")
	})
}

func TestIsSystemPolicyAppliedToChannel(t *testing.T) {
	th := Setup(t).InitBasic(t)

	channelID := model.NewId()
	systemPolicyID := model.NewId()
	t.Run("should return false when channel has no policy", func(t *testing.T) {
		// Mock access control service to return error (no policy)
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(nil, model.NewAppError("GetPolicy", "not.found", nil, "", http.StatusNotFound))

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.False(t, result)
	})

	t.Run("should return false when channel policy has no imports", func(t *testing.T) {
		// Mock access control service to return policy without imports
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
			Imports: nil, // No imports
		}

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(channelPolicy, nil)

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.False(t, result)
	})

	t.Run("should return false when channel policy has empty imports", func(t *testing.T) {
		// Mock access control service to return policy with empty imports
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
			Imports: []string{}, // Empty imports
		}

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(channelPolicy, nil)

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.False(t, result)
	})

	t.Run("should return false when system policy is not in imports", func(t *testing.T) {
		// Mock access control service to return policy with different imports
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		otherPolicyID := model.NewId()
		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
			Imports: []string{otherPolicyID}, // Different policy ID
		}

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(channelPolicy, nil)

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.False(t, result)
	})

	t.Run("should return true when system policy is in imports", func(t *testing.T) {
		// Mock access control service to return policy with the system policy in imports
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
			Imports: []string{systemPolicyID}, // Contains the system policy
		}

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(channelPolicy, nil)

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.True(t, result)
	})

	t.Run("should return true when system policy is one of multiple imports", func(t *testing.T) {
		// Mock access control service to return policy with multiple imports including our system policy
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		otherPolicyID1 := model.NewId()
		otherPolicyID2 := model.NewId()
		channelPolicy := &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
			Imports: []string{otherPolicyID1, systemPolicyID, otherPolicyID2}, // Contains the system policy among others
		}

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(channelPolicy, nil)

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.True(t, result)
	})

	t.Run("should return false on service error", func(t *testing.T) {
		// Mock access control service to return an error
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelID).Return(nil, model.NewAppError("GetPolicy", "service.error", nil, "", http.StatusInternalServerError))

		result := th.App.isSystemPolicyAppliedToChannel(th.Context, systemPolicyID, channelID)
		assert.False(t, result)
	})
}

func TestHasPermissionToFileAction(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("should allow when access control service is nil", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		result := th.App.HasPermissionToFileAction(th.Context, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id, model.AccessControlPolicyActionDownloadFileAttachment)
		assert.True(t, result)
	})

	t.Run("should allow when ABAC is disabled", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		th.ConfigStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(false)
			cfg.FeatureFlags.PermissionPolicies = true
		})

		result := th.App.HasPermissionToFileAction(th.Context, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id, model.AccessControlPolicyActionDownloadFileAttachment)
		assert.True(t, result)
	})

	t.Run("should allow when PermissionPolicies feature flag is disabled", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		th.ConfigStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
			cfg.FeatureFlags.PermissionPolicies = false
		})

		result := th.App.HasPermissionToFileAction(th.Context, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id, model.AccessControlPolicyActionDownloadFileAttachment)
		assert.True(t, result)
	})
}

func TestResolveSystemRole(t *testing.T) {
	t.Run("system_admin highest precedence", func(t *testing.T) {
		assert.Equal(t, model.SystemAdminRoleId, ResolveSystemRole("system_user system_admin"))
	})
	t.Run("system_guest before system_user", func(t *testing.T) {
		assert.Equal(t, model.SystemGuestRoleId, ResolveSystemRole("system_user system_guest"))
	})
	t.Run("system_user", func(t *testing.T) {
		assert.Equal(t, model.SystemUserRoleId, ResolveSystemRole("system_user"))
	})
	t.Run("falls back to system_user when no recognised base role", func(t *testing.T) {
		assert.Equal(t, model.SystemUserRoleId, ResolveSystemRole("custom_role"))
	})
	t.Run("empty string defaults to system_user", func(t *testing.T) {
		assert.Equal(t, model.SystemUserRoleId, ResolveSystemRole(""))
	})
}

func TestGetSubjectChannelRole(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("returns channel_admin for channel creator (SchemeAdmin)", func(t *testing.T) {
		// BasicUser is the creator of BasicChannel and is auto-promoted to
		// channel admin via SchemeAdmin.
		role, appErr := th.App.GetSubjectChannelRole(th.Context, th.BasicUser.Id, th.BasicChannel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelAdminRoleId, role)
	})

	// Non-members have no channel-scoped role to report. The function's
	// contract — documented in the docstring — is to return ("", nil)
	// and let the caller decide; previously it synthesised a guess from
	// the caller-supplied systemRoles (channel_user for system_user,
	// channel_guest for system_guest), which leaked channel-scope data
	// from the user's system membership. Callers (attachChannelScopedRole,
	// simulator subject builders) now gate on the empty string and skip
	// the channel scope.
	t.Run("returns empty role for non-member", func(t *testing.T) {
		// Cover the real existence path (not the unknown-user path):
		// create an actual user who is deliberately NOT added to
		// BasicChannel so the store lookup hits ErrNotFound on the
		// ChannelMember row rather than ErrNotFound on the User row.
		// GetSubjectChannelRole must report no channel-scoped role
		// for them — never fabricate one from system roles.
		nonMember := th.CreateUser(t)
		role, appErr := th.App.GetSubjectChannelRole(th.Context, nonMember.Id, th.BasicChannel.Id)
		require.Nil(t, appErr)
		assert.Equal(t, "", role)
	})
}

func TestBuildAccessControlSubjectScopedRoles(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("populates system scope only when channelID empty", func(t *testing.T) {
		subject, appErr := th.App.BuildAccessControlSubject(th.Context, th.BasicUser.Id, th.BasicUser.Roles, "")
		require.Nil(t, appErr)
		require.NotNil(t, subject)
		require.Len(t, subject.ScopedRoles, 1)
		assert.Equal(t, model.AccessControlSubjectScopeSystem, subject.ScopedRoles[0].Scope)
		assert.Equal(t, model.SystemUserRoleId, subject.ScopedRoles[0].Role)
		// Legacy field retained for backward compat
		assert.Equal(t, th.BasicUser.Roles, subject.Role)
	})

	t.Run("populates both scopes when channelID provided", func(t *testing.T) {
		subject, appErr := th.App.BuildAccessControlSubject(th.Context, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id)
		require.Nil(t, appErr)
		require.NotNil(t, subject)

		systemRole := subject.RoleForScope(model.AccessControlSubjectScopeSystem)
		channelRole := subject.RoleForScope(model.AccessControlSubjectScopeChannel)

		assert.Equal(t, model.SystemUserRoleId, systemRole)
		// BasicUser is the channel creator → channel_admin via SchemeAdmin.
		assert.Equal(t, model.ChannelAdminRoleId, channelRole)
	})
}

func TestBuildAccessControlSubjectNativeAttributes(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("populates native attributes from the user", func(t *testing.T) {
		subject, appErr := th.App.BuildAccessControlSubject(th.Context, th.BasicUser.Id, th.BasicUser.Roles, "")
		require.Nil(t, appErr)
		require.NotNil(t, subject)
		assert.Equal(t, th.BasicUser.Email, subject.Email)
		assert.Equal(t, th.BasicUser.EmailVerified, subject.EmailVerified)
		assert.Equal(t, th.BasicUser.CreateAt, subject.CreateAt)
		assert.False(t, subject.IsBot)
	})

	t.Run("IsBot true for a bot user", func(t *testing.T) {
		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "nativeattrbot",
			Description: "phase2 native attr bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		t.Cleanup(func() { _ = th.App.PermanentDeleteBot(th.Context, bot.UserId) })

		subject, appErr := th.App.BuildAccessControlSubject(th.Context, bot.UserId, model.SystemUserRoleId, "")
		require.Nil(t, appErr)
		require.NotNil(t, subject)
		assert.True(t, subject.IsBot)
		assert.Equal(t, bot.UserId, subject.ID)
	})

	t.Run("fails closed when the user read fails", func(t *testing.T) {
		// A non-existent user ID takes the GetSubject not-found fallback and
		// then fails the a.GetUser native-attribute read. The build must fail
		// closed: return a nil subject and the AppError so callers treat it as
		// a denial rather than evaluating against zero-valued native attributes.
		subject, appErr := th.App.BuildAccessControlSubject(th.Context, model.NewId(), model.SystemUserRoleId, "")
		require.NotNil(t, appErr)
		require.Nil(t, subject)
	})
}

func TestGetRecommendedPublicChannelsForUser(t *testing.T) {
	th := Setup(t).InitBasic(t)

	originalACS := th.App.Srv().ch.AccessControl
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = originalACS })

	t.Run("returns empty when license is missing", func(t *testing.T) {
		// No enterprise license set on the test server: the license short-circuit
		// at the top of the function must keep the response empty without ever
		// calling the access control service.
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		channels, appErr := th.App.GetRecommendedPublicChannelsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, appErr)
		assert.Empty(t, channels)
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("returns empty when access control service is nil", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		th.App.Srv().ch.AccessControl = nil

		channels, appErr := th.App.GetRecommendedPublicChannelsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, appErr)
		assert.Empty(t, channels)
	})

	t.Run("returns only channels the policy allows; tolerates per-channel eval errors", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		// PermanentDeleteChannel calls cleanupChannelAccessControlPolicy → DeletePolicy
		// during the test cleanup phase. Allow it as a no-op so cleanups don't fail
		// the test on unexpected mock calls.
		mockACS.On("DeletePolicy", mock.Anything, mock.AnythingOfType("string")).
			Return((*model.AppError)(nil)).Maybe()

		// Three policy-enforced public channels covering allow / deny / eval-error,
		// plus one bare public channel without a policy. The bare channel must
		// never reach the AccessEvaluation loop because SearchAllChannels filters
		// it out via AccessControlPolicyEnforced=true.
		allow := th.CreateChannel(t, th.BasicTeam)
		deny := th.CreateChannel(t, th.BasicTeam)
		evalErr := th.CreateChannel(t, th.BasicTeam)
		bare := th.CreateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			for _, ch := range []*model.Channel{allow, deny, evalErr, bare} {
				_ = th.App.PermanentDeleteChannel(th.Context, ch)
			}
		})

		policyEnforced := func(channelID string) {
			policy := &model.AccessControlPolicy{
				ID:       channelID,
				Type:     model.AccessControlPolicyTypeChannel,
				Revision: 1,
				Version:  model.AccessControlPolicyVersionV0_2,
				Active:   true,
				Rules: []model.AccessControlPolicyRule{
					{Actions: []string{"membership"}, Expression: "true"},
				},
			}
			_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
			require.NoError(t, err)
			t.Cleanup(func() {
				_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, channelID)
			})
		}
		policyEnforced(allow.Id)
		policyEnforced(deny.Id)
		policyEnforced(evalErr.Id)

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == allow.Id && req.Action == "membership"
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == deny.Id
		})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))
		// Per-channel evaluation errors must NOT abort the whole request — the
		// channel is dropped from the recommendation list and the loop moves on.
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == evalErr.Id
		})).Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "test.eval.error", nil, "boom", http.StatusInternalServerError))

		channels, appErr := th.App.GetRecommendedPublicChannelsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, appErr)

		ids := make([]string, 0, len(channels))
		for _, ch := range channels {
			ids = append(ids, ch.Id)
		}
		assert.ElementsMatch(t, []string{allow.Id}, ids,
			"only the channel whose policy allows the subject should be returned (deny/eval-error excluded)")
		assert.NotContains(t, ids, bare.Id, "channel without a policy should never enter the candidate set")

		mockACS.AssertExpectations(t)
	})
}

func TestBuildAccessControlSubjectForSession(t *testing.T) {
	t.Run("returns subject without session attributes when none are cached", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		subject, appErr := th.App.BuildAccessControlSubjectForSession(rctx, "")
		require.Nil(t, appErr)
		require.NotNil(t, subject)
		assert.Equal(t, th.BasicUser.Id, subject.ID)
		assert.Empty(t, subject.Session)
	})

	t.Run("populates session attributes from the cache", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		require.NoError(t, th.App.Srv().Store().SessionAttribute().Refresh(session.Id, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress:            "192.0.2.10",
			model.SessionAttributesPropertyFieldUserAgentBrowserName: "Chrome",
		}, model.GetMillis()))

		subject, appErr := th.App.BuildAccessControlSubjectForSession(rctx, "")
		require.Nil(t, appErr)
		require.NotNil(t, subject)
		assert.Equal(t, "192.0.2.10", subject.Session[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Chrome", subject.Session[model.SessionAttributesPropertyFieldUserAgentBrowserName])
	})
}

// TestFilterResponseToEditingRuleScope locks down the post-processing
// that turns a full-stack simulator response into a "this rule only"
// view. Upper-scoped blame entries (system_permission, peer_policy,
// inherited channel_policy) and sibling_rule entries are dropped;
// denies that have no remaining editing-rule-side blame surface as a
// neutral no_applicable_rule chip — the older flip-to-plain-allow
// behavior read as "this rule alone would have allowed this user"
// which is wrong for a permission rule whose filter didn't grant.
// The simulator already restricts contributions, so this filter is
// the defensive backstop.
func TestFilterResponseToEditingRuleScope(t *testing.T) {
	t.Run("deny attributed only to upper-scoped policy converts to no_applicable_rule", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u1"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceSystemPermission, PolicyName: "Org IL5"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision, "deny solely from upper-scoped blame must normalize to a vacuous allow")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, dec.Blame[0].Source,
			"the editing rule is silent on this user — must surface as no_applicable_rule, not a plain allow")
		// Outcome stays empty (matches the no_applicable_policy
		// convention) so the chip's hasBlame() helper — which filters
		// informational outcome=allow entries — picks this marker up.
		assert.Empty(t, dec.Blame[0].Outcome)
	})

	t.Run("deny with both this_rule and upper-scoped blame stays a deny but loses the upper entry", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u2"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"download_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "rule1"},
							{Source: model.PolicySimulationBlameSourceSystemPermission, PolicyName: "Org IL5"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["download_file_attachment"]
		assert.False(t, dec.Decision, "deny that the draft itself produces must remain a deny")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceThisRule, dec.Blame[0].Source)
	})

	t.Run("allow with sibling_saved alone gains a no_applicable_rule marker so the chip reads 'doesn't apply'", func(t *testing.T) {
		// At the "this rule only" scope, the sibling that saved the
		// user is by definition out of scope, so "Allowed · another
		// rule" is misleading — the chip should read "this rule
		// doesn't apply" instead. The sibling_saved entry stays in
		// the blame list so the Decision Details modal can still
		// build a trace from any expression attached to it.
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u3"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: true,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceSiblingSaved, RuleName: "rule1"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision)
		require.Len(t, dec.Blame, 2, "the synthetic marker is appended; sibling_saved stays for trace rendering")

		sources := []string{dec.Blame[0].Source, dec.Blame[1].Source}
		assert.Contains(t, sources, model.PolicySimulationBlameSourceSiblingSaved)
		assert.Contains(t, sources, model.PolicySimulationBlameSourceNoApplicableRule)
	})

	t.Run("allow with this_rule allow + sibling_saved keeps the chip allowed (no marker injected)", func(t *testing.T) {
		// When the editing rule itself granted the user (this_rule
		// outcome=allow), a sibling_saved entry alongside is just
		// supplementary "another rule also allowed" context. The
		// rule DID contribute, so we must NOT inject the
		// no_applicable_rule marker — the chip stays a plain
		// "Allowed".
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u3a"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: true,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "rule1", Outcome: model.PolicySimulationBlameOutcomeAllow},
							{Source: model.PolicySimulationBlameSourceSiblingSaved, RuleName: "rule1"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision)
		require.Len(t, dec.Blame, 2)
		for _, b := range dec.Blame {
			assert.NotEqual(t, model.PolicySimulationBlameSourceNoApplicableRule, b.Source,
				"this_rule allow means the rule did apply — must not inject no_applicable_rule")
		}
	})

	t.Run("bare allow with empty blame (role mismatch) gains no_applicable_rule marker", func(t *testing.T) {
		// The user-reported regression: when the editing rule
		// targets channel_user and the picker drops in a guest
		// (channel_guest), the simulator returns
		// `{decision: true}` with NO blame at all — it's a vacuous
		// allow because the rule doesn't apply to the candidate's
		// role. The old default branch left this untouched and the
		// chip rendered a misleading plain "Allowed". The filter
		// must inject the no_applicable_rule marker so the picker
		// shows "this rule doesn't apply" instead.
		//
		// User.Roles is set to a non-sysadmin role to lock down
		// that the sysadmin carve-out introduced in a sibling test
		// doesn't accidentally widen and skip the marker for
		// regular users.
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u3b", Roles: model.SystemGuestRoleId},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: true,
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision, "vacuous allow stays an allow — the chip handles the 'doesn't apply' rendering")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, dec.Blame[0].Source)
	})

	t.Run("system admin allow with empty blame stays a plain allow (no marker injected via role fallback)", func(t *testing.T) {
		// Sysadmins inherit every channel-level role implicitly, so
		// the simulator returns {decision: true} for them without a
		// this_rule blame — same shape as the "role doesn't apply"
		// vacuous allow used for guests. Without a sysadmin
		// carve-out the picker would mis-label the sysadmin row as
		// "this rule doesn't apply" when in fact the rule does
		// apply via role fallback. Verifies the User.IsSystemAdmin
		// check on the result row is wired correctly.
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "uadmin", Roles: model.SystemAdminRoleId + " " + model.SystemUserRoleId},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: true,
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision)
		assert.Empty(t, dec.Blame, "sysadmin candidates must not get the no_applicable_rule marker — the rule applies to them via role fallback")
	})

	t.Run("system admin allow with sibling_saved blame still skips the marker (role fallback wins)", func(t *testing.T) {
		// Same reasoning as the bare-allow sysadmin case: even if
		// the simulator surfaces a sibling_saved blame for a
		// sysadmin (rare; sysadmins normally bypass the OR-bucket
		// machinery), the marker must NOT be injected — the rule
		// still applies via role fallback regardless of which
		// sibling carried the verdict.
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "uadmin2", Roles: model.SystemAdminRoleId},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: true,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceSiblingSaved, RuleName: "rule1"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision)
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceSiblingSaved, dec.Blame[0].Source,
			"sibling_saved survives, but no_applicable_rule is NOT appended for sysadmins")
	})

	t.Run("allow already attributed to no_applicable_policy is NOT shadowed by no_applicable_rule", func(t *testing.T) {
		// When the simulator already explained "the whole policy
		// doesn't apply to this user" via no_applicable_policy, the
		// rule-scoped marker is strictly less informative — we
		// deliberately don't append it so the chip continues to
		// render the wider "policy doesn't apply" label.
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u3c"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: true,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceNoApplicablePolicy},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision)
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicablePolicy, dec.Blame[0].Source,
			"the wider policy-level marker must survive untouched; no_applicable_rule must not shadow it")
	})

	t.Run("inherited channel_policy blame converts to no_applicable_rule", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u4"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceChannelPolicy, PolicyName: "Parent"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision, "channel_policy blame is upper-scoped, so the deny must normalize to vacuous allow")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, dec.Blame[0].Source)
	})

	t.Run("per-session decisions are filtered alongside the user-level ones", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u5"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceSystemPermission},
						},
					},
				},
				Sessions: []model.PolicySimulationSession{{
					ID:     "s1",
					Device: "Macbook",
					Decisions: map[string]model.PolicySimulationActionDecision{
						"upload_file_attachment": {
							Decision: false,
							Blame: []model.PolicySimulationBlame{
								{Source: model.PolicySimulationBlameSourceSystemPermission},
							},
						},
					},
				}, {
					ID:     "s2",
					Device: "iPhone",
					Decisions: map[string]model.PolicySimulationActionDecision{
						"upload_file_attachment": {
							Decision: false,
							Blame: []model.PolicySimulationBlame{
								{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "rule1"},
								{Source: model.PolicySimulationBlameSourceSystemPermission},
							},
						},
					},
				}},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		userDec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, userDec.Decision, "user-level deny solely from upper-scoped normalizes to vacuous allow")
		require.Len(t, userDec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, userDec.Blame[0].Source)

		sess1Dec := resp.Results[0].Sessions[0].Decisions["upload_file_attachment"]
		assert.True(t, sess1Dec.Decision, "session-level deny solely from upper-scoped normalizes to vacuous allow")
		require.Len(t, sess1Dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, sess1Dec.Blame[0].Source)

		sess2Dec := resp.Results[0].Sessions[1].Decisions["upload_file_attachment"]
		assert.False(t, sess2Dec.Decision, "session-level deny with this_rule blame stays a deny")
		require.Len(t, sess2Dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceThisRule, sess2Dec.Blame[0].Source)
	})

	t.Run("peer_policy blame is dropped in this_rule mode (peers are not the editing rule)", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u6"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourcePeerPolicy, PolicyName: "IL5 Block", RuleName: "r1", Expression: "user.attributes.clearance == \"il5\""},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision, "deny coming from a peer policy is irrelevant in this rule mode and must normalize to vacuous allow")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, dec.Blame[0].Source)
	})

	// This is the regression that motivated the toggle rename: when
	// editing rule "channel_users" and the policy ALSO has a sibling
	// "channel_admins" rule that allowed the candidate, the picker
	// previously surfaced the sibling allow under "this policy only".
	// In "this rule only" mode that sibling_rule blame must be dropped.
	t.Run("sibling_rule blame is dropped in this_rule mode (only the editing rule counts)", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u7"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceSiblingRule, RuleName: "channel_admins"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "channel_users")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.True(t, dec.Decision, "sibling-rule deny must normalize to vacuous allow when scoped to a specific editing rule")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceNoApplicableRule, dec.Blame[0].Source)
	})

	// When two different rules both emit this_rule blame on the same
	// decision (theoretically possible if the simulator's contribution
	// restriction misfires) the filter keeps only the entry whose
	// rule_name matches the editing rule. Belt-and-suspenders defence
	// behind the simulator's contribution gate.
	t.Run("this_rule blame is filtered to the editing rule by name", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u8"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "channel_admins"},
							{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "channel_users"},
						},
					},
				},
			}},
		}

		filterResponseToEditingRuleScope(resp, "channel_users")

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		assert.False(t, dec.Decision, "deny from the editing rule survives")
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, "channel_users", dec.Blame[0].RuleName,
			"only the editing rule's blame is kept; the other this_rule entry is dropped")
	})
}

// TestEnrichBlameForDraftScope locks down the post-processing that
// turns the simulator's raw response into the picker-friendly view: it
// (a) injects expression text on draft-side blame entries, (b)
// reclassifies system_permission blame whose blamed policy lives at
// the same scope as the draft (same Type + same Imports) into
// peer_policy and copies its expression in too, (c) leaves truly
// upper-scoped sources expression-less so the UI cannot leak them.
func TestEnrichBlameForDraftScope(t *testing.T) {
	t.Helper()

	t.Run("draft-side blame (this_rule / sibling_rule / sibling_saved) gains the expression from params.Policy.Rules", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		draft := &model.AccessControlPolicy{
			ID:   "draft1",
			Type: model.AccessControlPolicyTypePermission,
			Rules: []model.AccessControlPolicyRule{
				{Name: "r1", Expression: "user.attributes.region == \"us\""},
				{Name: "r2", Expression: "user.attributes.department == \"engineering\""},
			},
		}
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u1"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "r1"},
						},
					},
					"download_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{
							{Source: model.PolicySimulationBlameSourceSiblingRule, RuleName: "r2"},
						},
					},
				},
			}},
		}

		enrichBlameForDraftScope(request.EmptyContext(nil), mockACS, draft, resp)

		uploadBlame := resp.Results[0].Decisions["upload_file_attachment"].Blame[0]
		assert.Equal(t, "user.attributes.region == \"us\"", uploadBlame.Expression, "this_rule blame must receive the rule's expression")

		downloadBlame := resp.Results[0].Decisions["download_file_attachment"].Blame[0]
		assert.Equal(t, "user.attributes.department == \"engineering\"", downloadBlame.Expression, "sibling_rule blame must receive the rule's expression")

		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	})

	t.Run("system_permission blame whose blamed policy shares scope with the draft is reclassified to peer_policy and gains its expression", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		draft := &model.AccessControlPolicy{
			ID:      "draft1",
			Type:    model.AccessControlPolicyTypePermission,
			Imports: []string{},
			Rules: []model.AccessControlPolicyRule{
				{Name: "rd", Expression: "true"},
			},
		}
		peer := &model.AccessControlPolicy{
			ID:      "peer1",
			Name:    "IL5 Block",
			Type:    model.AccessControlPolicyTypePermission,
			Imports: []string{},
			Rules: []model.AccessControlPolicyRule{
				{Name: "p1", Expression: "user.attributes.clearance == \"il5\""},
			},
		}
		mockACS.On("GetPolicy", mock.Anything, "peer1").Return(peer, (*model.AppError)(nil))

		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u2"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{{
							Source:     model.PolicySimulationBlameSourceSystemPermission,
							PolicyID:   "peer1",
							PolicyName: "IL5 Block",
							RuleName:   "p1",
						}},
					},
				},
			}},
		}

		enrichBlameForDraftScope(request.EmptyContext(nil), mockACS, draft, resp)

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourcePeerPolicy, dec.Blame[0].Source, "same-scope blame must be reclassified to peer_policy")
		assert.Equal(t, "user.attributes.clearance == \"il5\"", dec.Blame[0].Expression, "the failing rule's expression must be injected from the peer policy")
		assert.Equal(t, "IL5 Block", dec.Blame[0].PolicyName)

		mockACS.AssertExpectations(t)
	})

	t.Run("system_permission blame whose blamed policy lives at a different scope stays opaque and gets no expression", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		draft := &model.AccessControlPolicy{
			ID:      "draft1",
			Type:    model.AccessControlPolicyTypePermission,
			Imports: []string{}, // top-level (system console) draft.
		}
		upperScoped := &model.AccessControlPolicy{
			ID:      "upper1",
			Name:    "Org Wide Lockdown",
			Type:    model.AccessControlPolicyTypePermission,
			Imports: []string{"some-parent-id"}, // a child of some other parent — different scope.
			Rules: []model.AccessControlPolicyRule{
				{Name: "u1", Expression: "user.attributes.region == \"sandbox\""},
			},
		}
		mockACS.On("GetPolicy", mock.Anything, "upper1").Return(upperScoped, (*model.AppError)(nil))

		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u3"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{{
							Source:     model.PolicySimulationBlameSourceSystemPermission,
							PolicyID:   "upper1",
							PolicyName: "Org Wide Lockdown",
							RuleName:   "u1",
						}},
					},
				},
			}},
		}

		enrichBlameForDraftScope(request.EmptyContext(nil), mockACS, draft, resp)

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceSystemPermission, dec.Blame[0].Source, "different-scope blame must stay system_permission")
		assert.Empty(t, dec.Blame[0].Expression, "upper-scoped blame must NEVER carry the expression — that would leak content of a policy outside the editing scope")
	})

	t.Run("channel_policy blame is never reclassified or enriched", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		draft := &model.AccessControlPolicy{
			ID:   "draft1",
			Type: model.AccessControlPolicyTypePermission,
		}

		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u4"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{{
							Source:     model.PolicySimulationBlameSourceChannelPolicy,
							PolicyID:   "channel-policy-1",
							PolicyName: "Parent",
							RuleName:   "r1",
						}},
					},
				},
			}},
		}

		enrichBlameForDraftScope(request.EmptyContext(nil), mockACS, draft, resp)

		dec := resp.Results[0].Decisions["upload_file_attachment"]
		require.Len(t, dec.Blame, 1)
		assert.Equal(t, model.PolicySimulationBlameSourceChannelPolicy, dec.Blame[0].Source, "channel_policy blame must never be reclassified")
		assert.Empty(t, dec.Blame[0].Expression)
		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	})

	t.Run("session-level decisions are enriched alongside the user-level ones, and GetPolicy is cached per policy_id", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		draft := &model.AccessControlPolicy{
			ID:      "draft1",
			Type:    model.AccessControlPolicyTypePermission,
			Imports: []string{},
		}
		peer := &model.AccessControlPolicy{
			ID:      "peer1",
			Name:    "IL5 Block",
			Type:    model.AccessControlPolicyTypePermission,
			Imports: []string{},
			Rules: []model.AccessControlPolicyRule{
				{Name: "p1", Expression: "user.attributes.clearance == \"il5\""},
			},
		}

		// Set up GetPolicy with .Once() so the assertion below proves
		// caching: even though peer1 appears in three blame entries
		// across the response, the helper must only resolve it once
		// for the request.
		mockACS.On("GetPolicy", mock.Anything, "peer1").Return(peer, (*model.AppError)(nil)).Once()

		makeBlame := func() []model.PolicySimulationBlame {
			return []model.PolicySimulationBlame{{
				Source:     model.PolicySimulationBlameSourceSystemPermission,
				PolicyID:   "peer1",
				PolicyName: "IL5 Block",
				RuleName:   "p1",
			}}
		}

		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u5"},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {Decision: false, Blame: makeBlame()},
				},
				Sessions: []model.PolicySimulationSession{
					{ID: "s1", Decisions: map[string]model.PolicySimulationActionDecision{
						"upload_file_attachment": {Decision: false, Blame: makeBlame()},
					}},
					{ID: "s2", Decisions: map[string]model.PolicySimulationActionDecision{
						"upload_file_attachment": {Decision: false, Blame: makeBlame()},
					}},
				},
			}},
		}

		enrichBlameForDraftScope(request.EmptyContext(nil), mockACS, draft, resp)

		assert.Equal(t, model.PolicySimulationBlameSourcePeerPolicy, resp.Results[0].Decisions["upload_file_attachment"].Blame[0].Source)
		assert.Equal(t, model.PolicySimulationBlameSourcePeerPolicy, resp.Results[0].Sessions[0].Decisions["upload_file_attachment"].Blame[0].Source)
		assert.Equal(t, model.PolicySimulationBlameSourcePeerPolicy, resp.Results[0].Sessions[1].Decisions["upload_file_attachment"].Blame[0].Source)
		mockACS.AssertExpectations(t)
	})
}

// TestRedactSimulationAttributesForCaller covers the CPA-visibility
// + access-mode post-processor that strips attribute values from a
// simulator response for non-system-admin callers. The simulator
// surfaces per-user (and per-session) attribute snapshots so the
// Decision Details panel can read a deny like an evaluation trace —
// channel and team admins must not see values for fields configured
// as `visibility: hidden`, source_only, or shared_only because each
// of those tiers is hidden from them on the user profile page
// itself. The redactor also walks every blame entry's evaluation
// tree and blanks `ActualValue` on every leaf whose `Attribute`
// references a protected field; the top-level Attributes snapshot
// is not the only leak surface.
func TestRedactSimulationAttributesForCaller(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	require.True(t, ok, "SetLicense should return true")
	defer th.App.Srv().SetLicense(nil)

	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	// Two CPA fields: one hidden (the realistic non-plugin path) and
	// one visible. Source_only and shared_only access modes are
	// covered by TestCPAFieldIsProtectedForChannelAdmin below because
	// they require `protected: true` (and therefore a plugin caller)
	// to create through the normal app path.
	createdHidden, hAppErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityHidden},
	}, false, "")
	require.Nil(t, hAppErr)

	createdVisible, vAppErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityWhenSet},
	}, false, "")
	require.Nil(t, vAppErr)

	hiddenName := createdHidden.Name
	visibleName := createdVisible.Name

	// makeResp builds a fresh response that exercises every leak
	// surface in one shot: top-level user attributes, top-level
	// session attributes, the deny blame's evaluation tree (root +
	// per-attribute leaf), and a per-merged-rule evaluation tree.
	// Each tier carries a value for BOTH CPA fields so the test can
	// assert "protected: blanked" and "visible: preserved" on every
	// surface in the same pass.
	mkLeaf := func(name, value string) model.PolicySimulationEvaluationNode {
		return model.PolicySimulationEvaluationNode{
			Kind:        model.PolicySimulationEvaluationKindCompare,
			Attribute:   userAttributesPathPrefix + name,
			ActualValue: value,
			Outcome:     model.PolicySimulationEvaluationOutcomeFalse,
		}
	}
	mkResp := func() *model.PolicySimulationResponse {
		topLevelTree := &model.PolicySimulationEvaluationNode{
			Kind:    model.PolicySimulationEvaluationKindAnd,
			Outcome: model.PolicySimulationEvaluationOutcomeFalse,
			Children: []model.PolicySimulationEvaluationNode{
				mkLeaf(hiddenName, "il5"),
				mkLeaf(visibleName, "us"),
			},
		}
		mergedRuleTree := &model.PolicySimulationEvaluationNode{
			Kind:        model.PolicySimulationEvaluationKindCompare,
			Attribute:   userAttributesPathPrefix + hiddenName,
			ActualValue: "il5",
			Outcome:     model.PolicySimulationEvaluationOutcomeFalse,
		}
		return &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: model.NewId()},
				Attributes: map[string]string{
					hiddenName:  "il5",
					visibleName: "us",
				},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{{
							Source:         model.PolicySimulationBlameSourceThisRule,
							RuleName:       "rule1",
							EvaluationTree: topLevelTree,
							MergedRules: []model.PolicySimulationMergedRule{{
								Name:           "rule1",
								EvaluationTree: mergedRuleTree,
							}},
						}},
					},
				},
				Sessions: []model.PolicySimulationSession{{
					ID: "s1",
					Attributes: map[string]string{
						hiddenName:  "il5",
						visibleName: "us",
					},
				}},
			}},
		}
	}

	t.Run("system admins see every attribute value on every surface", func(t *testing.T) {
		resp := mkResp()
		th.App.RedactSimulationAttributesForCaller(rctx, resp, true)

		// Top-level snapshot (user + session): every field passes through.
		for _, name := range []string{hiddenName, visibleName} {
			assert.NotEmpty(t, resp.Results[0].Attributes[name], "system admin must see %q in user-level attributes", name)
			assert.NotEmpty(t, resp.Results[0].Sessions[0].Attributes[name], "system admin must see %q in session attributes", name)
		}

		// Evaluation tree leaves keep their ActualValue.
		blame := resp.Results[0].Decisions["upload_file_attachment"].Blame[0]
		for _, child := range blame.EvaluationTree.Children {
			assert.NotEmpty(t, child.ActualValue, "system admin must see ActualValue on every leaf, including %q", child.Attribute)
		}
		assert.NotEmpty(t, blame.MergedRules[0].EvaluationTree.ActualValue, "merged-rule tree ActualValue preserved for system admin")
	})

	t.Run("non-system-admin callers do not see hidden values on any surface", func(t *testing.T) {
		resp := mkResp()
		th.App.RedactSimulationAttributesForCaller(rctx, resp, false)

		// Top-level snapshot redactions: hidden field removed from the
		// user-level and session Attributes maps; the visible field
		// passes through.
		_, presentUser := resp.Results[0].Attributes[hiddenName]
		_, presentSession := resp.Results[0].Sessions[0].Attributes[hiddenName]
		assert.False(t, presentUser, "hidden user attribute must be stripped for non-system-admin caller")
		assert.False(t, presentSession, "hidden session attribute must be stripped for non-system-admin caller")
		assert.Equal(t, "us", resp.Results[0].Attributes[visibleName])
		assert.Equal(t, "us", resp.Results[0].Sessions[0].Attributes[visibleName])

		// Evaluation tree redactions: leaf whose Attribute references
		// the hidden field has ActualValue blanked; the visible
		// field's leaf keeps its value — that's the value the channel
		// admin would see on the user profile page itself.
		blame := resp.Results[0].Decisions["upload_file_attachment"].Blame[0]
		require.Len(t, blame.EvaluationTree.Children, 2)
		leafByAttribute := map[string]model.PolicySimulationEvaluationNode{}
		for _, child := range blame.EvaluationTree.Children {
			leafByAttribute[child.Attribute] = child
		}
		assert.Empty(t, leafByAttribute[userAttributesPathPrefix+hiddenName].ActualValue,
			"hidden leaf must have ActualValue blanked")
		assert.Equal(t, "us", leafByAttribute[userAttributesPathPrefix+visibleName].ActualValue,
			"visible leaf must keep ActualValue")

		// Merged-rule subtree gets the same treatment — that's the
		// per-rule view the picker renders alongside the merged tree.
		assert.Empty(t, blame.MergedRules[0].EvaluationTree.ActualValue,
			"merged-rule leaf for the hidden field must have ActualValue blanked")
	})

	t.Run("nil response is a safe no-op", func(t *testing.T) {
		require.NotPanics(t, func() {
			th.App.RedactSimulationAttributesForCaller(rctx, nil, false)
		})
	})

	t.Run("response with no attribute surfaces short-circuits before CPA lookup", func(t *testing.T) {
		// Most common shape: a deny chip alone, no Decision Details
		// panel ever opened. Both the top-level Attributes map and
		// every blame's evaluation tree are nil. The redactor must
		// return immediately without paying for SearchPropertyFields.
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: model.NewId()},
				Decisions: map[string]model.PolicySimulationActionDecision{
					"upload_file_attachment": {
						Decision: false,
						Blame: []model.PolicySimulationBlame{{
							Source:   model.PolicySimulationBlameSourceThisRule,
							RuleName: "rule1",
						}},
					},
				},
			}},
		}
		require.NotPanics(t, func() {
			th.App.RedactSimulationAttributesForCaller(rctx, resp, false)
		})
		assert.Nil(t, resp.Results[0].Attributes)
	})
}

// TestCPAFieldIsProtectedForChannelAdmin covers the per-field
// predicate used to build the protected-name set. Source_only and
// shared_only access modes require `protected: true` and a
// source_plugin_id, which only a plugin caller can set through the
// app — so this is a pure unit test against directly-constructed
// CPAField values rather than going through the app's create path.
func TestCPAFieldIsProtectedForChannelAdmin(t *testing.T) {
	mainHelper.Parallel(t)

	tests := []struct {
		name  string
		field *model.CPAField
		want  bool
	}{
		{
			name: "visibility=hidden is protected",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{Visibility: model.CustomProfileAttributesVisibilityHidden},
			},
			want: true,
		},
		{
			name: "access_mode=source_only is protected",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{
					Visibility: model.CustomProfileAttributesVisibilityWhenSet,
					AccessMode: model.PropertyAccessModeSourceOnly,
				},
			},
			want: true,
		},
		{
			name: "access_mode=shared_only is protected",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{
					Visibility: model.CustomProfileAttributesVisibilityWhenSet,
					AccessMode: model.PropertyAccessModeSharedOnly,
				},
			},
			want: true,
		},
		{
			name: "visibility=when_set + public access mode is NOT protected",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{
					Visibility: model.CustomProfileAttributesVisibilityWhenSet,
					AccessMode: model.PropertyAccessModePublic,
				},
			},
			want: false,
		},
		{
			name: "visibility=always + public access mode is NOT protected",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{
					Visibility: model.CustomProfileAttributesVisibilityAlways,
					AccessMode: model.PropertyAccessModePublic,
				},
			},
			want: false,
		},
		{
			name: "empty access mode defaults to public and is NOT protected",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{
					Visibility: model.CustomProfileAttributesVisibilityWhenSet,
					AccessMode: "",
				},
			},
			want: false,
		},
		{
			name: "visibility=hidden wins over public access mode (still protected)",
			field: &model.CPAField{
				Attrs: model.CPAAttrs{
					Visibility: model.CustomProfileAttributesVisibilityHidden,
					AccessMode: model.PropertyAccessModePublic,
				},
			},
			want: true,
		},
		{
			name:  "nil field is not protected (caller short-circuits but the predicate is defensive)",
			field: nil,
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cpaFieldIsProtectedForChannelAdmin(tt.field)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestRedactProtectedActualValuesInTree is a focused unit test for
// the tree walker. Exercises:
//   - protected leaves at the root level get ActualValue blanked
//   - protected leaves nested under compound nodes get ActualValue
//     blanked
//   - unprotected leaves are untouched
//   - non-user-attribute leaves (e.g. function call results, raw
//     expressions) are untouched
//   - nil node is a safe no-op
func TestRedactProtectedActualValuesInTree(t *testing.T) {
	mainHelper.Parallel(t)

	protected := map[string]struct{}{
		"Clearance":   {},
		"NetworkZone": {},
	}

	t.Run("redacts ActualValue on protected leaves at every depth", func(t *testing.T) {
		tree := &model.PolicySimulationEvaluationNode{
			Kind:    model.PolicySimulationEvaluationKindAnd,
			Outcome: model.PolicySimulationEvaluationOutcomeFalse,
			Children: []model.PolicySimulationEvaluationNode{
				{
					Kind:        model.PolicySimulationEvaluationKindCompare,
					Attribute:   "user.attributes.Clearance",
					ActualValue: "il5",
				},
				{
					Kind:    model.PolicySimulationEvaluationKindOr,
					Outcome: model.PolicySimulationEvaluationOutcomeFalse,
					Children: []model.PolicySimulationEvaluationNode{
						{
							Kind:        model.PolicySimulationEvaluationKindCompare,
							Attribute:   "user.attributes.NetworkZone",
							ActualValue: "vpn",
						},
						{
							Kind:        model.PolicySimulationEvaluationKindCompare,
							Attribute:   "user.attributes.Region",
							ActualValue: "us",
						},
					},
				},
				{
					Kind: model.PolicySimulationEvaluationKindFunction,

					// Function leaf with no attribute path (e.g. a
					// constant comparison or receiver-style call
					// where we couldn't infer the attribute) must
					// be left alone — there's no protected user
					// data to leak.
					Attribute:   "",
					ActualValue: "some-internal-value",
				},
			},
		}

		redactProtectedActualValuesInTree(tree, protected)

		// Root-level Clearance leaf: blanked.
		assert.Empty(t, tree.Children[0].ActualValue, "Clearance leaf must be blanked")

		// Nested NetworkZone (protected) blanked; nested Region
		// (public) preserved.
		assert.Empty(t, tree.Children[1].Children[0].ActualValue, "NetworkZone leaf must be blanked")
		assert.Equal(t, "us", tree.Children[1].Children[1].ActualValue, "Region leaf must be preserved")

		// Function leaf with no attribute path is left alone.
		assert.Equal(t, "some-internal-value", tree.Children[2].ActualValue, "non-user-attribute leaf must be preserved")
	})

	t.Run("nil node is a safe no-op", func(t *testing.T) {
		require.NotPanics(t, func() {
			redactProtectedActualValuesInTree(nil, protected)
		})
	})

	t.Run("empty protected set is a safe no-op", func(t *testing.T) {
		tree := &model.PolicySimulationEvaluationNode{
			Kind:        model.PolicySimulationEvaluationKindCompare,
			Attribute:   "user.attributes.Clearance",
			ActualValue: "il5",
		}
		redactProtectedActualValuesInTree(tree, nil)

		// Helper itself is unconditional but the public entry point
		// short-circuits before calling it with an empty set —
		// either way, an empty set must not zap anything.
		assert.Equal(t, "il5", tree.ActualValue)
	})
}

// TestIsProtectedAttributePath pins the path-prefix matcher used by
// the tree walker. Covers the canonical CEL prefix, mis-prefixed
// paths, empty paths, and empty protected sets.
func TestIsProtectedAttributePath(t *testing.T) {
	mainHelper.Parallel(t)
	protected := map[string]struct{}{"Clearance": {}}

	t.Run("returns true for the canonical user.attributes.<name> form", func(t *testing.T) {
		assert.True(t, isProtectedAttributePath("user.attributes.Clearance", protected))
	})

	t.Run("returns false for non-user-attribute paths", func(t *testing.T) {
		// Resource / session / channel paths must not collide with
		// the user-attributes namespace — only `user.attributes.*`
		// is in scope for the CPA visibility filter.
		assert.False(t, isProtectedAttributePath("session.network_status", protected))
		assert.False(t, isProtectedAttributePath("resource.id", protected))
		assert.False(t, isProtectedAttributePath("channel.member_count", protected))
	})

	t.Run("returns false for paths whose suffix is not in the protected set", func(t *testing.T) {
		assert.False(t, isProtectedAttributePath("user.attributes.Region", protected))
	})

	t.Run("returns false for empty inputs", func(t *testing.T) {
		assert.False(t, isProtectedAttributePath("", protected))
		assert.False(t, isProtectedAttributePath("user.attributes.Clearance", nil))
		assert.False(t, isProtectedAttributePath("user.attributes.", protected),
			"empty suffix must not match — that's a malformed path, not a protected reference")
	})
}

// TestStripProtectedAttributes is a focused unit test for the
// top-level attribute-map pruner. Exercises both vertical levels
// (user + session) and the no-op edge cases (empty protected set,
// nil response).
func TestStripProtectedAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("removes protected keys from user and session attribute maps", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				User: &model.User{Id: "u1"},
				Attributes: map[string]string{
					"Clearance": "il5",
					"Region":    "us",
				},
				Sessions: []model.PolicySimulationSession{{
					Attributes: map[string]string{
						"Clearance":   "il5",
						"NetworkZone": "vpn",
					},
				}},
			}},
		}
		stripProtectedAttributes(resp, map[string]struct{}{
			"Clearance": {}, "NetworkZone": {},
		})

		_, c1 := resp.Results[0].Attributes["Clearance"]
		assert.False(t, c1, "Clearance must be stripped from user-level attributes")
		assert.Equal(t, "us", resp.Results[0].Attributes["Region"], "Region must survive")

		_, c2 := resp.Results[0].Sessions[0].Attributes["Clearance"]
		assert.False(t, c2, "Clearance must be stripped from session attributes")
		_, n := resp.Results[0].Sessions[0].Attributes["NetworkZone"]
		assert.False(t, n, "NetworkZone must be stripped from session attributes")
	})

	t.Run("empty protected set is a no-op", func(t *testing.T) {
		resp := &model.PolicySimulationResponse{
			Results: []model.PolicySimulationUserResult{{
				Attributes: map[string]string{"Region": "us"},
			}},
		}
		stripProtectedAttributes(resp, nil)
		assert.Equal(t, "us", resp.Results[0].Attributes["Region"])
	})

	t.Run("nil response is a safe no-op", func(t *testing.T) {
		require.NotPanics(t, func() {
			stripProtectedAttributes(nil, map[string]struct{}{"Anything": {}})
		})
	})
}

// TestClearAllSimulationAttributesAndTrees pins the fail-closed
// default used by RedactSimulationAttributesForCaller when the CPA
// lookup itself errors. Every attribute map (user + session) AND
// every evaluation tree's ActualValue (top-level + per-merged-rule)
// must be wiped so a transient store failure cannot leak protected
// values through the simulator.
func TestClearAllSimulationAttributesAndTrees(t *testing.T) {
	mainHelper.Parallel(t)

	resp := &model.PolicySimulationResponse{
		Results: []model.PolicySimulationUserResult{{
			User:       &model.User{Id: "u1"},
			Attributes: map[string]string{"Region": "us", "Clearance": "il5"},
			Decisions: map[string]model.PolicySimulationActionDecision{
				"upload_file_attachment": {
					Decision: false,
					Blame: []model.PolicySimulationBlame{{
						Source: model.PolicySimulationBlameSourceThisRule,
						EvaluationTree: &model.PolicySimulationEvaluationNode{
							Kind: model.PolicySimulationEvaluationKindAnd,
							Children: []model.PolicySimulationEvaluationNode{{
								Attribute:   "user.attributes.Clearance",
								ActualValue: "il5",
							}, {
								Attribute:   "user.attributes.Region",
								ActualValue: "us",
							}},
						},
						MergedRules: []model.PolicySimulationMergedRule{{
							Name: "rule1",
							EvaluationTree: &model.PolicySimulationEvaluationNode{
								Attribute:   "user.attributes.Clearance",
								ActualValue: "il5",
							},
						}},
					}},
				},
			},
			Sessions: []model.PolicySimulationSession{{
				Attributes: map[string]string{"NetworkZone": "vpn"},
			}},
		}, {
			User:       &model.User{Id: "u2"},
			Attributes: map[string]string{"Region": "eu"},
		}},
	}

	clearAllSimulationAttributes(resp)
	clearAllEvaluationTreeActualValues(resp)

	// Every Attributes map cleared (user + session) on both rows.
	for _, r := range resp.Results {
		assert.Nil(t, r.Attributes, "user-level attributes must be cleared")
		for _, s := range r.Sessions {
			assert.Nil(t, s.Attributes, "session-level attributes must be cleared")
		}
	}

	// Every tree leaf's ActualValue cleared — including nested
	// children and the merged-rule subtree.
	blame := resp.Results[0].Decisions["upload_file_attachment"].Blame[0]
	for _, child := range blame.EvaluationTree.Children {
		assert.Empty(t, child.ActualValue, "leaf %q ActualValue must be cleared", child.Attribute)
	}
	assert.Empty(t, blame.MergedRules[0].EvaluationTree.ActualValue, "merged-rule leaf ActualValue must be cleared")
}

// makeSimulationResponseForRedactionTest builds a simulator response
// shaped like the real picker output: top-level user/session
// attribute snapshots AND a deny blame whose evaluation tree carries
// per-leaf `ActualValue`s (including a per-merged-rule subtree). One
// leaf references `protected` and one references `public`; callers
// can vary which CPA field names are protected to drive the
// assertions in each redaction scenario.
func makeSimulationResponseForRedactionTest(protectedName, publicName, protectedValue, publicValue string) *model.PolicySimulationResponse {
	mkLeaf := func(name, value string) model.PolicySimulationEvaluationNode {
		return model.PolicySimulationEvaluationNode{
			Kind:        model.PolicySimulationEvaluationKindCompare,
			Attribute:   userAttributesPathPrefix + name,
			ActualValue: value,
			Outcome:     model.PolicySimulationEvaluationOutcomeFalse,
		}
	}
	topLevelTree := &model.PolicySimulationEvaluationNode{
		Kind:    model.PolicySimulationEvaluationKindAnd,
		Outcome: model.PolicySimulationEvaluationOutcomeFalse,
		Children: []model.PolicySimulationEvaluationNode{
			mkLeaf(protectedName, protectedValue),
			mkLeaf(publicName, publicValue),
		},
	}
	mergedRuleTree := &model.PolicySimulationEvaluationNode{
		Kind:        model.PolicySimulationEvaluationKindCompare,
		Attribute:   userAttributesPathPrefix + protectedName,
		ActualValue: protectedValue,
		Outcome:     model.PolicySimulationEvaluationOutcomeFalse,
	}
	return &model.PolicySimulationResponse{
		Results: []model.PolicySimulationUserResult{{
			User: &model.User{Id: model.NewId()},
			Attributes: map[string]string{
				protectedName: protectedValue,
				publicName:    publicValue,
			},
			Decisions: map[string]model.PolicySimulationActionDecision{
				"upload_file_attachment": {
					Decision: false,
					Blame: []model.PolicySimulationBlame{{
						Source:         model.PolicySimulationBlameSourceThisRule,
						RuleName:       "rule1",
						EvaluationTree: topLevelTree,
						MergedRules: []model.PolicySimulationMergedRule{{
							Name:           "rule1",
							EvaluationTree: mergedRuleTree,
						}},
					}},
				},
			},
			Sessions: []model.PolicySimulationSession{{
				ID: "s1",
				Attributes: map[string]string{
					protectedName: protectedValue,
					publicName:    publicValue,
				},
			}},
		}},
	}
}

// TestRedactSimulationAttributesForCallerAccessModes exercises the
// non-public access-mode branches of cpaFieldIsProtectedForChannelAdmin
// end to end through RedactSimulationAttributesForCaller. Source_only
// and shared_only fields require `protected: true` (and a source
// plugin ID), so we bypass the App-level CreatePropertyField path —
// which would reject a non-plugin caller — and insert the fields
// directly into the store. This proves the full pipeline (predicate +
// protected-set + top-level pruner + tree walker) treats these
// access modes the same as `visibility: hidden`.
func TestRedactSimulationAttributesForCallerAccessModes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	require.True(t, ok, "SetLicense should return true")
	defer th.App.Srv().SetLicense(nil)

	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	createProtectedField := func(t *testing.T, accessMode string) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    cpaGroup.ID,
			Name:       celSafeName(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsAccessMode:     accessMode,
				model.PropertyAttrsSourcePluginID: "com.mattermost.uas-plugin",
			},
		}
		created, err := th.Store.PropertyField().Create(field)
		require.NoError(t, err,
			"protected %s fields must be insertable directly via the store (the app's CreatePropertyField hook rejects non-plugin callers, which is unrelated to what this test exercises)",
			accessMode)
		return created
	}

	publicField := &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityWhenSet},
	}
	createdPublic, vAppErr := th.App.CreatePropertyField(rctx, publicField, false, "")
	require.Nil(t, vAppErr)
	publicName := createdPublic.Name

	assertRedactedAgainst := func(t *testing.T, protectedName string) {
		t.Helper()
		resp := makeSimulationResponseForRedactionTest(protectedName, publicName, "il5", "us")
		th.App.RedactSimulationAttributesForCaller(rctx, resp, false)

		// Top-level user + session snapshots: protected field removed,
		// public field preserved on both surfaces.
		_, presentUser := resp.Results[0].Attributes[protectedName]
		assert.False(t, presentUser, "protected user attribute must be stripped for channel admin")
		assert.Equal(t, "us", resp.Results[0].Attributes[publicName], "public user attribute must be preserved")

		_, presentSession := resp.Results[0].Sessions[0].Attributes[protectedName]
		assert.False(t, presentSession, "protected session attribute must be stripped for channel admin")
		assert.Equal(t, "us", resp.Results[0].Sessions[0].Attributes[publicName], "public session attribute must be preserved")

		// Top-level evaluation tree: protected leaf has ActualValue
		// blanked, public leaf preserved. Iterate by attribute to
		// avoid relying on child ordering.
		blame := resp.Results[0].Decisions["upload_file_attachment"].Blame[0]
		require.Len(t, blame.EvaluationTree.Children, 2)
		leafByAttribute := map[string]model.PolicySimulationEvaluationNode{}
		for _, child := range blame.EvaluationTree.Children {
			leafByAttribute[child.Attribute] = child
		}
		assert.Empty(t, leafByAttribute[userAttributesPathPrefix+protectedName].ActualValue,
			"protected leaf must have ActualValue blanked")
		assert.Equal(t, "us", leafByAttribute[userAttributesPathPrefix+publicName].ActualValue,
			"public leaf must keep ActualValue")

		// Per-merged-rule subtree must receive the same treatment as
		// the top-level tree — the picker renders the merged-rule
		// tree alongside it, so a leak on either path is equally bad.
		assert.Empty(t, blame.MergedRules[0].EvaluationTree.ActualValue,
			"merged-rule leaf for the protected field must have ActualValue blanked")
	}

	t.Run("source_only access mode is redacted on every surface", func(t *testing.T) {
		field := createProtectedField(t, model.PropertyAccessModeSourceOnly)
		assertRedactedAgainst(t, field.Name)
	})

	t.Run("shared_only access mode is redacted on every surface", func(t *testing.T) {
		field := createProtectedField(t, model.PropertyAccessModeSharedOnly)
		assertRedactedAgainst(t, field.Name)
	})
}

// TestRedactSimulationAttributesForCallerFailClosed exercises the
// branch that runs when protectedCPAFieldNamesForCaller returns an
// error (a transient property-store failure during the CPA lookup).
// The contract is "fail closed": every attribute snapshot AND every
// evaluation-tree leaf's ActualValue must be wiped so the channel
// admin can't see a single protected value just because the CPA
// lookup happened to fail mid-request. We force the error by
// swapping the server's propertyService with one whose
// PropertyGroupStore is mocked to return a synthetic store failure
// for the access-control group lookup.
func TestRedactSimulationAttributesForCallerFailClosed(t *testing.T) {
	mainHelper.Parallel(t)
	thMock := SetupWithStoreMock(t)
	rctx := thMock.emptyContextWithCallerID(anonymousCallerId)

	// Build a fresh property service wired to mocked stores: the
	// group store fails on the AccessControl group lookup, which is
	// the very first call protectedCPAFieldNamesForCaller makes.
	// PropertyField / PropertyValue stores stay attached but never
	// fire because we error before getting that far.
	mockGroupStore := &storemocks.PropertyGroupStore{}
	mockFieldStore := &storemocks.PropertyFieldStore{}
	mockValueStore := &storemocks.PropertyValueStore{}
	mockGroupStore.
		On("Get", model.AccessControlPropertyGroupName).
		Return((*model.PropertyGroup)(nil), errors.New("simulated store failure"))

	ps, err := properties.New(properties.ServiceConfig{
		PropertyGroupStore: mockGroupStore,
		PropertyFieldStore: mockFieldStore,
		PropertyValueStore: mockValueStore,
		CallerIDExtractor:  func(rctx request.CTX) string { return "" },
	})
	require.NoError(t, err)

	originalPS := thMock.App.Srv().propertyService
	thMock.App.Srv().propertyService = ps
	defer func() { thMock.App.Srv().propertyService = originalPS }()

	resp := makeSimulationResponseForRedactionTest("Clearance", "Region", "il5", "us")
	thMock.App.RedactSimulationAttributesForCaller(rctx, resp, false)

	// Every Attributes map (user + session) cleared — we can't tell
	// which fields are protected, so we redact unconditionally.
	r := resp.Results[0]
	assert.Nil(t, r.Attributes, "fail-closed: user-level attributes must be cleared")
	require.Len(t, r.Sessions, 1)
	assert.Nil(t, r.Sessions[0].Attributes, "fail-closed: session attributes must be cleared")

	// Every evaluation-tree leaf — top-level + per-merged-rule —
	// has ActualValue cleared. The public field's leaf is no
	// exception in the fail-closed path: we don't know which fields
	// are protected, so we wipe them all.
	blame := r.Decisions["upload_file_attachment"].Blame[0]
	require.NotNil(t, blame.EvaluationTree)
	for _, child := range blame.EvaluationTree.Children {
		assert.Empty(t, child.ActualValue, "fail-closed: leaf %q ActualValue must be cleared", child.Attribute)
	}
	require.Len(t, blame.MergedRules, 1)
	assert.Empty(t, blame.MergedRules[0].EvaluationTree.ActualValue,
		"fail-closed: merged-rule leaf ActualValue must be cleared")

	mockGroupStore.AssertExpectations(t)
}

// TestRedactSimulationAttributesForCallerSystemAdminBypass pins the
// privacy-escape hatch for system admins: they always see every
// attribute the simulator recorded, regardless of CPA visibility or
// access_mode. The function must early-return BEFORE talking to the
// property service so a broken store/property service can't degrade
// the sysadmin's view. We assert that by mocking the property
// service with no expectations — any call to it would crash the
// test.
func TestRedactSimulationAttributesForCallerSystemAdminBypass(t *testing.T) {
	mainHelper.Parallel(t)
	thMock := SetupWithStoreMock(t)
	rctx := thMock.emptyContextWithCallerID(anonymousCallerId)

	// Property service is wired to mocks with NO expectations — if
	// the sysadmin bypass leaks into the CPA lookup path, the mock
	// will panic with "no return value specified" and fail the test
	// with a clear signal.
	mockGroupStore := &storemocks.PropertyGroupStore{}
	mockFieldStore := &storemocks.PropertyFieldStore{}
	mockValueStore := &storemocks.PropertyValueStore{}
	ps, err := properties.New(properties.ServiceConfig{
		PropertyGroupStore: mockGroupStore,
		PropertyFieldStore: mockFieldStore,
		PropertyValueStore: mockValueStore,
		CallerIDExtractor:  func(rctx request.CTX) string { return "" },
	})
	require.NoError(t, err)

	originalPS := thMock.App.Srv().propertyService
	thMock.App.Srv().propertyService = ps
	defer func() { thMock.App.Srv().propertyService = originalPS }()

	resp := makeSimulationResponseForRedactionTest("Clearance", "Region", "il5", "us")
	thMock.App.RedactSimulationAttributesForCaller(rctx, resp, true)

	// Top-level snapshots preserved verbatim.
	r := resp.Results[0]
	assert.Equal(t, "il5", r.Attributes["Clearance"], "system admin must see protected user attribute")
	assert.Equal(t, "us", r.Attributes["Region"], "system admin must see public user attribute")
	require.Len(t, r.Sessions, 1)
	assert.Equal(t, "il5", r.Sessions[0].Attributes["Clearance"], "system admin must see protected session attribute")
	assert.Equal(t, "us", r.Sessions[0].Attributes["Region"], "system admin must see public session attribute")

	// Every leaf's ActualValue preserved on every tree.
	blame := r.Decisions["upload_file_attachment"].Blame[0]
	require.NotNil(t, blame.EvaluationTree)
	leafByAttribute := map[string]model.PolicySimulationEvaluationNode{}
	for _, child := range blame.EvaluationTree.Children {
		leafByAttribute[child.Attribute] = child
	}
	assert.Equal(t, "il5", leafByAttribute[userAttributesPathPrefix+"Clearance"].ActualValue,
		"sysadmin must see ActualValue on protected leaf in evaluation tree")
	assert.Equal(t, "us", leafByAttribute[userAttributesPathPrefix+"Region"].ActualValue,
		"sysadmin must see ActualValue on public leaf in evaluation tree")
	require.Len(t, blame.MergedRules, 1)
	assert.Equal(t, "il5", blame.MergedRules[0].EvaluationTree.ActualValue,
		"sysadmin must see ActualValue on merged-rule leaf in evaluation tree")

	// Sanity check: the property service must not have been called.
	mockGroupStore.AssertNotCalled(t, "Get", mock.Anything)
	mockFieldStore.AssertExpectations(t)
	mockValueStore.AssertExpectations(t)
}

// TestValidatePolicySimulationUsersInScopeChannel covers the channel-
// scope branch of the delegated-simulate input validator. The
// channel-scope branch is reached when a non-system-admin author
// runs the simulator from the channel-settings policy editor; the
// validator must refuse to look outside that channel. We pin:
//   - non-member user → 403 users_out_of_scope (the deny-by-default
//     bound the api4 handler relies on to short-circuit before the
//     simulator ever runs)
//   - empty / malformed user_id → 400 invalid_param so the picker
//     surfaces a usable validation error
//   - invalid channel_id → 400 invalid_param (mismatched ID type)
//   - a channel member passes through (negative control for the 403 path)
func TestValidatePolicySimulationUsersInScopeChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	rctx := th.Context

	// BasicChannel is created in InitBasic but BasicUser/BasicUser2
	// are NOT auto-joined to it; add BasicUser explicitly so we have
	// a "member" baseline.
	th.AddUserToChannel(t, th.BasicUser, th.BasicChannel)

	// outsider is added to the team (so the team-membership path
	// doesn't accidentally trip) but never added to BasicChannel.
	outsider := th.CreateUser(t)
	th.LinkUserToTeam(t, outsider, th.BasicTeam)

	t.Run("channel member passes the check", func(t *testing.T) {
		err := th.App.ValidatePolicySimulationUsersInScope(rctx, "", th.BasicChannel.Id, []model.PolicySimulationUserOverride{{UserID: th.BasicUser.Id}})
		require.Nil(t, err, "channel member must pass the scope check")
	})

	t.Run("user not a member of the channel returns 403 users_out_of_scope", func(t *testing.T) {
		err := th.App.ValidatePolicySimulationUsersInScope(rctx, "", th.BasicChannel.Id, []model.PolicySimulationUserOverride{{UserID: outsider.Id}})
		require.NotNil(t, err, "outsider must be rejected")
		assert.Equal(t, http.StatusForbidden, err.StatusCode,
			"the contract with the api4 handler is a 403 so the delegated path can short-circuit before invoking the simulator")
		assert.Equal(t, "api.access_control_policy.simulate.users_out_of_scope.app_error", err.Id)
	})

	t.Run("empty user_id returns 400 invalid_param", func(t *testing.T) {
		err := th.App.ValidatePolicySimulationUsersInScope(rctx, "", th.BasicChannel.Id, []model.PolicySimulationUserOverride{{UserID: ""}})
		require.NotNil(t, err)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Equal(t, "api.context.invalid_param.app_error", err.Id)
	})

	t.Run("malformed user_id returns 400 invalid_param", func(t *testing.T) {
		// 25 hex chars is not a valid 26-char model ID; the
		// model.IsValidId pre-check must reject before the store
		// would be hit (which would otherwise raise a 500).
		err := th.App.ValidatePolicySimulationUsersInScope(rctx, "", th.BasicChannel.Id, []model.PolicySimulationUserOverride{{UserID: "not-a-valid-id"}})
		require.NotNil(t, err)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Equal(t, "api.context.invalid_param.app_error", err.Id)
	})

	t.Run("malformed channel_id returns 400 invalid_param", func(t *testing.T) {
		err := th.App.ValidatePolicySimulationUsersInScope(rctx, "", "not-a-valid-id", []model.PolicySimulationUserOverride{{UserID: th.BasicUser.Id}})
		require.NotNil(t, err)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
		assert.Equal(t, "api.context.invalid_param.app_error", err.Id)
	})

	t.Run("first failure short-circuits the rest of the user list", func(t *testing.T) {
		// Mixed list: outsider first, member second. The validator
		// is a strict gate — one bad apple makes the whole call
		// fail. Pins the early-exit ordering the api4 handler
		// depends on for the audit trail.
		err := th.App.ValidatePolicySimulationUsersInScope(rctx, "", th.BasicChannel.Id, []model.PolicySimulationUserOverride{
			{UserID: outsider.Id},
			{UserID: th.BasicUser.Id},
		})
		require.NotNil(t, err)
		assert.Equal(t, http.StatusForbidden, err.StatusCode)
	})
}

func TestHydrateChannelPolicyActions(t *testing.T) {
	t.Run("Channel without an enforced policy is a no-op (no store call, PolicyActions stays nil)", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		// We register the AccessControlPolicy() accessor in case any other
		// path touches it, but `GetActionsForPolicy` MUST NOT be called
		// when PolicyEnforced is false — that's the whole point of the
		// lazy-fetch design.
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		ch := &model.Channel{Id: model.NewId(), PolicyEnforced: false}
		appErr := thMock.App.HydrateChannelPolicyActions(thMock.Context, ch)
		require.Nil(t, appErr)
		require.Nil(t, ch.PolicyActions, "non-enforced channels must not have an empty map injected")
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicy", mock.Anything, mock.Anything)
	})

	t.Run("Nil channel pointer is a defensive no-op", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		appErr := thMock.App.HydrateChannelPolicyActions(thMock.Context, nil)
		require.Nil(t, appErr)
	})

	t.Run("Membership-only policy hydrates PolicyActions with membership key", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		channelID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, channelID).
			Return(map[string]bool{model.AccessControlPolicyActionMembership: true}, nil).Once()

		ch := &model.Channel{Id: channelID, PolicyEnforced: true}
		appErr := thMock.App.HydrateChannelPolicyActions(thMock.Context, ch)
		require.Nil(t, appErr)
		require.Equal(t, map[string]bool{model.AccessControlPolicyActionMembership: true}, ch.PolicyActions)
		require.True(t, ch.HasMembershipPolicyAction(), "convenience helper must agree with the map")
		mockACPStore.AssertExpectations(t)
	})

	t.Run("Permission-only policy hydrates with the permission key only (no membership)", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		channelID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, channelID).
			Return(map[string]bool{model.AccessControlPolicyActionUploadFileAttachment: true}, nil).Once()

		ch := &model.Channel{Id: channelID, PolicyEnforced: true}
		appErr := thMock.App.HydrateChannelPolicyActions(thMock.Context, ch)
		require.Nil(t, appErr)
		require.False(t, ch.HasMembershipPolicyAction(), "permission-only policy must NOT report membership — this is the core bug fix invariant")
		require.True(t, ch.HasPolicyAction(model.AccessControlPolicyActionUploadFileAttachment))
	})

	t.Run("Policy missing in store (deleted between reads) returns nil and sets empty map", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		channelID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, channelID).
			Return(nil, store.NewErrNotFound("AccessControlPolicy", channelID)).Once()

		ch := &model.Channel{Id: channelID, PolicyEnforced: true}
		appErr := thMock.App.HydrateChannelPolicyActions(thMock.Context, ch)
		require.Nil(t, appErr, "ErrNotFound from store must be swallowed — channel row will reconcile on next write")
		require.NotNil(t, ch.PolicyActions, "ErrNotFound path must set an empty map so HasPolicyAction returns false")
		require.Empty(t, ch.PolicyActions)
	})

	t.Run("Unexpected store error is surfaced and PolicyActions stays nil", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		channelID := model.NewId()
		mockACPStore.On("GetActionsForPolicy", thMock.Context, channelID).
			Return(nil, errors.New("boom")).Once()

		ch := &model.Channel{Id: channelID, PolicyEnforced: true}
		appErr := thMock.App.HydrateChannelPolicyActions(thMock.Context, ch)
		require.NotNil(t, appErr, "non-not-found store errors must propagate so callers can fail-closed")
		require.Equal(t, "app.pap.hydrate_actions.app_error", appErr.Id)
		require.Nil(t, ch.PolicyActions, "error path must leave PolicyActions untouched (caller decides fallback)")
	})
}

func TestHydrateChannelsPolicyActions(t *testing.T) {
	t.Run("Empty slice is a no-op", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		appErr := thMock.App.HydrateChannelsPolicyActions(thMock.Context, nil)
		require.Nil(t, appErr)
		appErr = thMock.App.HydrateChannelsPolicyActions(thMock.Context, []*model.Channel{})
		require.Nil(t, appErr)
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicies", mock.Anything, mock.Anything)
	})

	t.Run("Slice with only non-enforced channels skips the store entirely", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		channels := []*model.Channel{
			{Id: model.NewId(), PolicyEnforced: false},
			{Id: model.NewId(), PolicyEnforced: false},
		}
		appErr := thMock.App.HydrateChannelsPolicyActions(thMock.Context, channels)
		require.Nil(t, appErr)
		for _, ch := range channels {
			require.Nil(t, ch.PolicyActions)
		}
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicies", mock.Anything, mock.Anything)
	})

	t.Run("Mixed slice issues a single batched call for enforced channels only", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		enforced1 := model.NewId()
		enforced2 := model.NewId()
		channels := []*model.Channel{
			{Id: enforced1, PolicyEnforced: true},
			{Id: model.NewId(), PolicyEnforced: false},
			{Id: enforced2, PolicyEnforced: true},
		}

		mockACPStore.On("GetActionsForPolicies", thMock.Context, mock.MatchedBy(func(ids []string) bool {
			// We don't depend on slice order — order is incidental — but
			// the contents must be exactly the two enforced IDs and never
			// the non-enforced one.
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

		appErr := thMock.App.HydrateChannelsPolicyActions(thMock.Context, channels)
		require.Nil(t, appErr)
		require.True(t, channels[0].HasMembershipPolicyAction())
		require.Nil(t, channels[1].PolicyActions, "non-enforced channels must remain untouched")
		require.False(t, channels[2].HasMembershipPolicyAction(), "permission-only channel must NOT report membership")
		require.True(t, channels[2].HasPolicyAction(model.AccessControlPolicyActionUploadFileAttachment))
		mockACPStore.AssertExpectations(t)
	})

	t.Run("Enforced channel missing from batch result gets an empty map (fail-closed for membership)", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		enforced := model.NewId()
		channels := []*model.Channel{
			{Id: enforced, PolicyEnforced: true},
		}
		// Simulate the policy row being deleted between channel read and
		// batch fetch — the result map is empty, but the call succeeded.
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{enforced}).
			Return(map[string]map[string]bool{}, nil).Once()

		appErr := thMock.App.HydrateChannelsPolicyActions(thMock.Context, channels)
		require.Nil(t, appErr)
		require.NotNil(t, channels[0].PolicyActions, "missing-from-batch must default to empty map, not nil")
		require.Empty(t, channels[0].PolicyActions)
		require.False(t, channels[0].HasMembershipPolicyAction())
	})

	t.Run("Underlying batch error is surfaced and channels are left untouched", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)

		channels := []*model.Channel{{Id: model.NewId(), PolicyEnforced: true}}
		mockACPStore.On("GetActionsForPolicies", thMock.Context, mock.Anything).
			Return(nil, errors.New("boom")).Once()

		appErr := thMock.App.HydrateChannelsPolicyActions(thMock.Context, channels)
		require.NotNil(t, appErr)
		require.Equal(t, "app.pap.hydrate_actions.app_error", appErr.Id)
		require.Nil(t, channels[0].PolicyActions, "error path must leave the slice untouched")
	})
}

func TestGetChannelHydratesPolicyActions(t *testing.T) {
	// App.GetChannel is the canonical single-channel read seam. After
	// Phase 1 it must transparently hydrate PolicyActions so consumers
	// (Phase 2 server gates and frontend) can rely on the field being
	// present whenever PolicyEnforced is true.
	t.Run("Returned channel carries PolicyActions when policy_enforced is true", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		channelID := model.NewId()
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("Get", channelID, true).
			Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate, PolicyEnforced: true}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicy", thMock.Context, channelID).
			Return(map[string]bool{model.AccessControlPolicyActionMembership: true}, nil).Once()

		channel, appErr := thMock.App.GetChannel(thMock.Context, channelID)
		require.Nil(t, appErr)
		require.NotNil(t, channel)
		require.True(t, channel.HasMembershipPolicyAction(), "GetChannel must hydrate the action map so downstream gates see the membership bit")
		mockACPStore.AssertExpectations(t)
	})

	t.Run("No-policy channel returns without touching AccessControlPolicies", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		channelID := model.NewId()
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("Get", channelID, true).
			Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate, PolicyEnforced: false}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore).Maybe()

		channel, appErr := thMock.App.GetChannel(thMock.Context, channelID)
		require.Nil(t, appErr)
		require.NotNil(t, channel)
		require.Nil(t, channel.PolicyActions)
		mockACPStore.AssertNotCalled(t, "GetActionsForPolicy", mock.Anything, mock.Anything)
	})
}

func TestGetChannelsForTeamForUserHydratesPolicyActions(t *testing.T) {
	// App.GetChannelsForTeamForUser feeds the webapp's team channel list
	// (GET /users/me/teams/{team_id}/channels), which is the source for the
	// guest-invite channel picker. The picker reads policy_actions.membership
	// and falls back to the bare policy_enforced flag when policy_actions is
	// absent, so this seam must hydrate the action map — otherwise a
	// permission-only channel is wrongly hidden from the picker.
	t.Run("Permission-only channel is hydrated so it is not mistaken for membership-gated", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		teamID := model.NewId()
		userID := model.NewId()
		permChannelID := model.NewId()
		plainChannelID := model.NewId()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("GetChannels", teamID, userID, mock.AnythingOfType("*model.ChannelSearchOpts")).
			Return(model.ChannelList{
				{Id: permChannelID, TeamId: teamID, PolicyEnforced: true},
				{Id: plainChannelID, TeamId: teamID, PolicyEnforced: false},
			}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{permChannelID}).
			Return(map[string]map[string]bool{
				permChannelID: {model.AccessControlPolicyActionUploadFileAttachment: true},
			}, nil).Once()

		channels, appErr := thMock.App.GetChannelsForTeamForUser(thMock.Context, teamID, userID, &model.ChannelSearchOpts{})
		require.Nil(t, appErr)
		require.Len(t, channels, 2)

		var permChannel, plainChannel *model.Channel
		for _, ch := range channels {
			switch ch.Id {
			case permChannelID:
				permChannel = ch
			case plainChannelID:
				plainChannel = ch
			}
		}
		require.NotNil(t, permChannel)
		require.NotNil(t, plainChannel)

		require.Equal(t, map[string]bool{model.AccessControlPolicyActionUploadFileAttachment: true}, permChannel.PolicyActions,
			"permission-only channel must carry its hydrated action map so the guest picker does not fall back to policy_enforced")
		require.False(t, permChannel.HasMembershipPolicyAction(),
			"permission-only channel must NOT report membership — this is the guest-picker bug fix invariant")
		require.Nil(t, plainChannel.PolicyActions, "channels without a policy must not be touched")
		mockACPStore.AssertExpectations(t)
	})

	t.Run("Membership-gated channel keeps reporting membership after hydration", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		teamID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("GetChannels", teamID, userID, mock.AnythingOfType("*model.ChannelSearchOpts")).
			Return(model.ChannelList{{Id: channelID, TeamId: teamID, PolicyEnforced: true}}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{channelID}).
			Return(map[string]map[string]bool{
				channelID: {model.AccessControlPolicyActionMembership: true},
			}, nil).Once()

		channels, appErr := thMock.App.GetChannelsForTeamForUser(thMock.Context, teamID, userID, &model.ChannelSearchOpts{})
		require.Nil(t, appErr)
		require.Len(t, channels, 1)
		require.True(t, channels[0].HasMembershipPolicyAction(),
			"membership-gated channels must still resolve as membership-controlled")
		mockACPStore.AssertExpectations(t)
	})

	t.Run("Hydration failure degrades to the channel list without failing the request", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		teamID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("GetChannels", teamID, userID, mock.AnythingOfType("*model.ChannelSearchOpts")).
			Return(model.ChannelList{{Id: channelID, TeamId: teamID, PolicyEnforced: true}}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{channelID}).
			Return(nil, errors.New("boom")).Once()

		channels, appErr := thMock.App.GetChannelsForTeamForUser(thMock.Context, teamID, userID, &model.ChannelSearchOpts{})
		require.Nil(t, appErr, "a hydration error must not fail the channel list; the seam degrades to legacy behavior")
		require.Len(t, channels, 1)
		require.Nil(t, channels[0].PolicyActions, "on hydration failure the channel is returned unhydrated, not partially populated")
		mockACPStore.AssertExpectations(t)
	})
}

func TestSearchChannelsHydratePolicyActions(t *testing.T) {
	// The guest-invite picker searches channels via SearchChannels /
	// SearchChannelsForUser. Search results merge into the webapp channel
	// store, so they must carry the same hydrated action map as the bootstrap
	// list; otherwise a search would overwrite a hydrated channel with an
	// unhydrated copy and re-hide a permission-only channel.
	t.Run("SearchChannels hydrates permission-only results", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		teamID := model.NewId()
		channelID := model.NewId()
		plainChannelID := model.NewId()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("SearchInTeam", teamID, "perm", true).
			Return(model.ChannelList{
				{Id: channelID, TeamId: teamID, PolicyEnforced: true},
				{Id: plainChannelID, TeamId: teamID, PolicyEnforced: false},
			}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{channelID}).
			Return(map[string]map[string]bool{
				channelID: {model.AccessControlPolicyActionUploadFileAttachment: true},
			}, nil).Once()

		channels, appErr := thMock.App.SearchChannels(thMock.Context, teamID, "perm")
		require.Nil(t, appErr)
		require.Len(t, channels, 2)

		var permChannel, plainChannel *model.Channel
		for _, ch := range channels {
			switch ch.Id {
			case channelID:
				permChannel = ch
			case plainChannelID:
				plainChannel = ch
			}
		}
		require.NotNil(t, permChannel)
		require.NotNil(t, plainChannel)
		require.False(t, permChannel.HasMembershipPolicyAction(),
			"permission-only search result must not report membership")
		require.True(t, permChannel.HasPolicyAction(model.AccessControlPolicyActionUploadFileAttachment))
		require.Nil(t, plainChannel.PolicyActions, "channels without a policy must not be touched")
		mockACPStore.AssertExpectations(t)
	})

	t.Run("SearchChannelsForUser hydrates permission-only results", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		teamID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("SearchForUserInTeam", userID, teamID, "perm", true).
			Return(model.ChannelList{{Id: channelID, TeamId: teamID, PolicyEnforced: true}}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{channelID}).
			Return(map[string]map[string]bool{
				channelID: {model.AccessControlPolicyActionUploadFileAttachment: true},
			}, nil).Once()

		channels, appErr := thMock.App.SearchChannelsForUser(thMock.Context, userID, teamID, "perm")
		require.Nil(t, appErr)
		require.Len(t, channels, 1)
		require.False(t, channels[0].HasMembershipPolicyAction(),
			"permission-only search result must not report membership")
		require.True(t, channels[0].HasPolicyAction(model.AccessControlPolicyActionUploadFileAttachment))
		mockACPStore.AssertExpectations(t)
	})

	t.Run("Hydration failure degrades to the search results without failing the request", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		mockStore := thMock.App.Srv().Store().(*storemocks.Store)

		teamID := model.NewId()
		channelID := model.NewId()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("SearchInTeam", teamID, "perm", true).
			Return(model.ChannelList{{Id: channelID, TeamId: teamID, PolicyEnforced: true}}, nil).Once()

		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("GetActionsForPolicies", thMock.Context, []string{channelID}).
			Return(nil, errors.New("boom")).Once()

		channels, appErr := thMock.App.SearchChannels(thMock.Context, teamID, "perm")
		require.Nil(t, appErr, "a hydration error must not fail the search; the seam degrades to legacy behavior")
		require.Len(t, channels, 1)
		require.Nil(t, channels[0].PolicyActions, "on hydration failure the channel is returned unhydrated, not partially populated")
		mockACPStore.AssertExpectations(t)
	})
}

func TestChannelAccessControlled(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok)
	defer th.App.Srv().SetLicense(nil)

	savePolicy := func(t *testing.T, channelID string, actions ...string) {
		t.Helper()
		policy := &model.AccessControlPolicy{
			ID:       channelID,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "policy-" + channelID,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{Actions: actions, Expression: "true"},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, channelID)
			th.App.Srv().Store().Channel().InvalidateChannel(channelID)
		})
		th.App.Srv().Store().Channel().InvalidateChannel(channelID)
	}

	t.Run("channel with no policy is not controlled", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		controlled, appErr := th.App.ChannelAccessControlled(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.False(t, controlled)
	})

	t.Run("channel with a membership policy is controlled", func(t *testing.T) {
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		savePolicy(t, channel.Id, model.AccessControlPolicyActionMembership)

		controlled, appErr := th.App.ChannelAccessControlled(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.True(t, controlled, "membership policy must make ChannelAccessControlled return true")
	})

	t.Run("channel with ONLY a permission policy is NOT controlled (bug fix)", func(t *testing.T) {
		// Bug-fix regression: HasPermissionToChannel and other callers
		// must not treat permission-only channels (e.g. file upload
		// restriction) as ABAC-membership-controlled. Before the
		// PolicyActions[membership] migration this returned true.
		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		savePolicy(t, channel.Id, model.AccessControlPolicyActionUploadFileAttachment)

		controlled, appErr := th.App.ChannelAccessControlled(th.Context, channel.Id)
		require.Nil(t, appErr)
		require.False(t, controlled, "permission-only policy must NOT make ChannelAccessControlled return true")
	})

	t.Run("non-existent channel returns false without error (existing contract)", func(t *testing.T) {
		controlled, appErr := th.App.ChannelAccessControlled(th.Context, model.NewId())
		require.Nil(t, appErr)
		require.False(t, controlled)
	})
}

func TestPublishChannelPolicyEnforcedUpdateHydratesBroadcastPayload(t *testing.T) {
	// publishChannelPolicyEnforcedUpdate must include PolicyActions in the
	// broadcast payload so connected clients can react to action-set
	// changes without a follow-up REST round-trip. The hydration happens
	// after GetChannel reloads the (now-policy-enforced) channel post-save.
	thMock := storeMockWithMaskingOff(t)

	channelID := model.NewId()
	channelPolicy := &model.AccessControlPolicy{
		ID:   channelID,
		Type: model.AccessControlPolicyTypeChannel,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionUploadFileAttachment}, Expression: "true"},
		},
	}

	mockStore := thMock.App.Srv().Store().(*storemocks.Store)
	mockChannelStore := storemocks.ChannelStore{}
	mockStore.On("Channel").Return(&mockChannelStore)
	mockChannelStore.On("InvalidateChannel", channelID).Once()
	// Channel().Get is called twice on a save flow — once by eligibility
	// validation pre-save, once by publishChannelPolicyEnforcedUpdate
	// post-save. Both calls return a PolicyEnforced=true channel so the
	// hydrator fires on the second call.
	mockChannelStore.On("Get", channelID, true).
		Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate, PolicyEnforced: true}, nil).Twice()

	mockACPStore := storemocks.AccessControlPolicyStore{}
	mockStore.On("AccessControlPolicy").Return(&mockACPStore)
	// Permission-only policy: hydrator must return an action set WITHOUT
	// the membership key. This is the bug-fix invariant the broadcast
	// must carry to the client.
	expectedActions := map[string]bool{model.AccessControlPolicyActionUploadFileAttachment: true}
	mockACPStore.On("GetActionsForPolicy", thMock.Context, channelID).Return(expectedActions, nil)

	mockAccessControl := &mocks.AccessControlServiceInterface{}
	thMock.App.Srv().ch.AccessControl = mockAccessControl
	mockAccessControl.On("SavePolicy", thMock.Context, mock.Anything).Return(channelPolicy, nil).Once()

	result, err := thMock.App.CreateOrUpdateAccessControlPolicy(thMock.Context, channelPolicy)
	require.Nil(t, err)
	require.NotNil(t, result)

	mockChannelStore.AssertCalled(t, "InvalidateChannel", channelID)
	// The critical assertion: the hydrator was invoked with the right
	// channel ID, meaning the WS payload that follows includes the
	// non-membership action set.
	mockACPStore.AssertCalled(t, "GetActionsForPolicy", thMock.Context, channelID)
	mockAccessControl.AssertExpectations(t)
}

// TestGetAccessControlPolicyAttributes_MaskedFieldsFiltered verifies that
// source_only and shared_only attribute fields are stripped from the response
// of GetAccessControlPolicyAttributes so their values are never exposed to
// regular channel members through the invite modal or members sidebar.
func TestGetAccessControlPolicyAttributes_MaskedFieldsFiltered(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)

	cpaGroup, cErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, cErr)

	permNone := model.PermissionLevelNone

	makeField := func(name, accessMode string) {
		protected := accessMode == model.PropertyAccessModeSourceOnly || accessMode == model.PropertyAccessModeSharedOnly
		f := &model.PropertyField{
			GroupID:    cpaGroup.ID,
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Protected:  protected,
			Attrs:      model.StringInterface{model.PropertyAttrsAccessMode: accessMode},
		}
		if protected {
			f.PermissionField = &permNone
			f.Attrs[model.PropertyAttrsProtected] = true
			_, err := th.App.Srv().Store().PropertyField().Create(f)
			require.NoError(t, err)
		} else {
			_, appErr := th.App.CreatePropertyField(rctx, f, false, "")
			require.Nil(t, appErr)
		}
	}

	makeField("PublicField", model.PropertyAccessModePublic)
	makeField("SourceField", model.PropertyAccessModeSourceOnly)
	makeField("SharedField", model.PropertyAccessModeSharedOnly)

	channelID := model.NewId()
	rawAttributes := map[string][]string{
		"PublicField": {"Engineering"},
		"SourceField": {"TopSecret"},
		"SharedField": {"Alpha", "Bravo"},
	}

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("GetPolicyRuleAttributes", mock.Anything, channelID, model.AccessControlPolicyActionMembership).
		Return(rawAttributes, nil).Once()

	result, appErr := th.App.GetAccessControlPolicyAttributes(th.Context, channelID, model.AccessControlPolicyActionMembership)
	require.Nil(t, appErr)

	// Only the public field should survive.
	assert.Equal(t, map[string][]string{"PublicField": {"Engineering"}}, result)
	assert.NotContains(t, result, "SourceField")
	assert.NotContains(t, result, "SharedField")
	mockACS.AssertExpectations(t)
}

// TestGetAccessControlPolicyAttributes_PublicFieldsPassThrough verifies that
// public attribute fields are returned unchanged.
func TestGetAccessControlPolicyAttributes_PublicFieldsPassThrough(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)

	cpaGroup, cErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, cErr)

	fieldName := "f_" + model.NewId()[:8]
	field := &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.PropertyAttrsAccessMode: model.PropertyAccessModePublic},
	}
	_, appErr := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, appErr)

	channelID := model.NewId()
	rawAttributes := map[string][]string{fieldName: {"Engineering", "Sales"}}

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	mockACS.On("GetPolicyRuleAttributes", mock.Anything, channelID, model.AccessControlPolicyActionMembership).
		Return(rawAttributes, nil).Once()

	result, appErr := th.App.GetAccessControlPolicyAttributes(th.Context, channelID, model.AccessControlPolicyActionMembership)
	require.Nil(t, appErr)
	assert.Equal(t, rawAttributes, result)
	mockACS.AssertExpectations(t)
}

// TestMergeStoredPolicyExpressions_ActionsLocked verifies that a caller who
// cannot see all values in a stored rule cannot change that rule's Actions.
// The attack: submit a PUT with the same masked expression but a different
// action type — the merge would restore the hidden CEL value while silently
// accepting the caller's action, removing the original access restriction.
//
// The submitted and stored rules are paired by Name (v0.4 permission rules
// always carry a unique Name) so the test models the realistic attack
// surface — a caller editing an existing Named rule swaps its Actions
// while leaving the masked Expression alone. Pair-by-Name is what makes
// the action-locking guard reachable in this scenario; an attacker who
// drops the Name (or changes it) instead falls into the masked-rule-
// deleted 403 path, which is exercised by the merge tests above.
func TestMergeStoredPolicyExpressions_ActionsLocked(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)

	// Insert a source_only field directly into the store to bypass the property
	// service hook that restricts protected-field creation to plugin callers.
	cpaGroup, cErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, cErr)

	fieldName := "f_" + model.NewId()[:8]
	permNone := model.PermissionLevelNone
	field := &model.PropertyField{
		GroupID:         cpaGroup.ID,
		Name:            fieldName,
		Type:            model.PropertyFieldTypeText,
		ObjectType:      model.PropertyFieldObjectTypeUser,
		TargetType:      string(model.PropertyFieldTargetLevelSystem),
		Protected:       true,
		PermissionField: &permNone,
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsProtected:  true,
		},
	}
	_, storeErr := th.App.Srv().Store().PropertyField().Create(field)
	require.NoError(t, storeErr)

	callerID := model.NewId()
	policyID := model.NewId()
	ruleName := "rule_" + model.NewId()[:8]

	storedExpr := `user.attributes.` + fieldName + ` == "TopSecret"`
	maskedExpr := `user.attributes.` + fieldName + ` == "--------"`

	storedPolicy := &model.AccessControlPolicy{
		ID:   policyID,
		Type: model.AccessControlPolicyTypeChannel,
		Rules: []model.AccessControlPolicyRule{
			{
				Name:       ruleName,
				Role:       model.ChannelUserRoleId,
				Actions:    []string{model.AccessControlPolicyActionUploadFileAttachment},
				Expression: storedExpr,
			},
		},
	}

	// Attacker keeps the rule's Name (so the editor still considers it
	// "the same rule") and submits the masked expression unchanged, but
	// swaps Actions from upload → download. Without the action-locking
	// guard the merge would re-inject the hidden literal and silently
	// re-purpose the gate.
	submittedPolicy := &model.AccessControlPolicy{
		ID:   policyID,
		Type: model.AccessControlPolicyTypeChannel,
		Rules: []model.AccessControlPolicyRule{
			{
				Name:       ruleName,
				Role:       model.ChannelUserRoleId,
				Actions:    []string{model.AccessControlPolicyActionDownloadFileAttachment},
				Expression: maskedExpr,
			},
		},
	}

	resolver, resolverErr := newMaskingResolver(th.App, rctx, callerID)
	require.Nil(t, resolverErr)

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS

	mockACS.On("GetPolicy", mock.Anything, policyID).Return(storedPolicy, nil).Once()
	// mergeExpressionWithMaskedValues delegates straight to the canonical merge, which
	// re-injects the hidden literal from storedExpr into the submitted (masked) expression.
	// (No separate HasMaskedValuesForCaller call: the canonical merge fast-paths internally.)
	mockACS.On("MergeExpressionWithMaskedValuesCanonical", mock.Anything, maskedExpr, storedExpr, mock.Anything).Return(storedExpr, nil).Once()

	_, mergeErr := th.App.mergeStoredPolicyExpressions(th.Context, submittedPolicy, resolver)
	require.Nil(t, mergeErr)

	require.Len(t, submittedPolicy.Rules, 1)
	// Expression must be restored to the real stored value.
	assert.Equal(t, storedExpr, submittedPolicy.Rules[0].Expression)
	// Actions must be locked to the stored value, not the attacker's.
	assert.Equal(t, []string{model.AccessControlPolicyActionUploadFileAttachment}, submittedPolicy.Rules[0].Actions)
	mockACS.AssertExpectations(t)
}

// TestMergeStoredPolicyExpressions_FailClosedSentinelRejectedOnResubmit verifies that
// re-submitting the fail-closed sentinel (maskFailClosedSentinel) is blocked on save.
// MaskPolicyExpressions emits maskFailClosedSentinel on error; the canonical walker
// rejects it because it contains no matching property comparison for the stored hidden node.
func TestMergeStoredPolicyExpressions_FailClosedSentinelRejectedOnResubmit(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)

	callerID := model.NewId()
	policyID := model.NewId()

	storedExpr := `user.attributes.TopSecret == "Value"`

	storedPolicy := &model.AccessControlPolicy{
		ID:   policyID,
		Type: model.AccessControlPolicyTypeParent,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: storedExpr},
		},
	}

	submittedPolicy := &model.AccessControlPolicy{
		ID:   policyID,
		Type: model.AccessControlPolicyTypeParent,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: maskFailClosedSentinel},
		},
	}

	resolver, resolverErr := newMaskingResolver(th.App, rctx, callerID)
	require.Nil(t, resolverErr)

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS

	mockACS.On("GetPolicy", mock.Anything, policyID).Return(storedPolicy, nil).Once()
	// Submitting the sentinel drops the masked node — the canonical walker rejects this.
	// mergeExpressionWithMaskedValues delegates straight to the canonical merge (no separate
	// HasMaskedValuesForCaller pre-check), which fails closed because the sentinel contains no
	// matching property comparison for the stored hidden node.
	mergeBlockErr := model.NewAppError("MergeExpressionWithMaskedValuesCanonical", "app.pap.save_policy.masked_condition_deleted", nil, "masked literal deleted", http.StatusForbidden)
	mockACS.On("MergeExpressionWithMaskedValuesCanonical", mock.Anything, maskFailClosedSentinel, storedExpr, mock.Anything).Return("", mergeBlockErr).Once()

	_, mergeErr := th.App.mergeStoredPolicyExpressions(th.Context, submittedPolicy, resolver)

	require.NotNil(t, mergeErr)
	assert.Equal(t, mergeBlockErr.Id, mergeErr.Id, "error ID must match the forbidden contract")
	assert.Equal(t, mergeBlockErr.StatusCode, mergeErr.StatusCode, "status code must be 403 Forbidden")
	mockACS.AssertExpectations(t)
}

// TestMergeStoredPolicyExpressions_ActionsEditableWhenNoMasking verifies that
// a caller who holds all values in a rule can freely change its Actions.
func TestMergeStoredPolicyExpressions_ActionsEditableWhenNoMasking(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)

	// Create a public field — values are always visible, so no masking occurs.
	cpaGroup, cErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, cErr)

	fieldName := "f_" + model.NewId()[:8]
	field := &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       fieldName,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.PropertyAttrsAccessMode: model.PropertyAccessModePublic},
	}
	_, appErr := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, appErr)

	callerID := model.NewId()
	policyID := model.NewId()

	expr := `user.attributes.` + fieldName + ` == "Engineering"`

	storedPolicy := &model.AccessControlPolicy{
		ID:   policyID,
		Type: model.AccessControlPolicyTypeParent,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: expr},
		},
	}
	// Caller legitimately changes the action on a rule with no masked values.
	submittedPolicy := &model.AccessControlPolicy{
		ID:   policyID,
		Type: model.AccessControlPolicyTypeParent,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionUploadFileAttachment}, Expression: expr},
		},
	}

	resolver, resolverErr := newMaskingResolver(th.App, rctx, callerID)
	require.Nil(t, resolverErr)

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS

	mockACS.On("GetPolicy", mock.Anything, policyID).Return(storedPolicy, nil).Once()
	// Submitted rule changes its action away from membership, so it never pairs with the
	// stored membership rule and the merge is skipped. The dropped-rule guard then checks
	// the unpaired stored rule via HasMaskedValuesForCaller, which reports no hidden values.
	mockACS.On("HasMaskedValuesForCaller", mock.Anything, expr, mock.Anything).Return(false, nil).Once()

	_, appErr = th.App.mergeStoredPolicyExpressions(th.Context, submittedPolicy, resolver)
	require.Nil(t, appErr)

	require.Len(t, submittedPolicy.Rules, 1)
	// Expression unchanged (no masking, submitted passes through).
	assert.Equal(t, expr, submittedPolicy.Rules[0].Expression)
	// Actions must NOT be locked — caller's submitted value stands.
	assert.Equal(t, []string{model.AccessControlPolicyActionUploadFileAttachment}, submittedPolicy.Rules[0].Actions)
	mockACS.AssertExpectations(t)
}

// TestRejectMaskedTokens_NewPolicy verifies that a surviving masked token in a
// rule expression is rejected — merge should have replaced it with a real value.
func TestRejectMaskedTokens_NewPolicy(t *testing.T) {
	tok := maskedTokenValue

	tests := []struct {
		name    string
		rules   []model.AccessControlPolicyRule
		wantErr bool
	}{
		{
			name: "expression with token is rejected",
			rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership},
					Expression: `user.attributes.team == "` + tok + `"`},
			},
			wantErr: true,
		},
		{
			name: "token inside a list is rejected",
			rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership},
					Expression: `user.attributes.team in ["Alpha", "` + tok + `"]`},
			},
			wantErr: true,
		},
		{
			name: "clean expression passes",
			rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership},
					Expression: `user.attributes.team == "Engineering"`},
			},
			wantErr: false,
		},
		{
			name: "empty expression passes",
			rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership},
					Expression: ""},
			},
			wantErr: false,
		},
		{
			// "false" is the fail-closed sentinel's literal value, but it is also a
			// legitimate author-written deny-all expression. It must NOT be rejected
			// here — persisting deny-all is safe, and the dangerous resubmit-over-a-
			// masked-rule case is handled by the canonical merge on the update path.
			name: "bare false deny-all expression passes",
			rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership},
					Expression: maskFailClosedSentinel},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := &model.AccessControlPolicy{Rules: tt.rules}
			err := rejectMaskedTokens(policy)
			if tt.wantErr {
				require.NotNil(t, err, "expected rejectMaskedTokens to return an error")
			} else {
				require.Nil(t, err)
			}
		})
	}
}

// TestUpdateAccessControlPoliciesActive_MaskingGuard verifies deactivation follows the
// same masking rules as delete, while activation is always allowed.
func TestUpdateAccessControlPoliciesActive_MaskingGuard(t *testing.T) {
	t.Run("deactivation blocked when caller has masked values", func(t *testing.T) {
		// policyHasMaskedValuesForCaller resolves the property group from the store,
		// so this subtest uses SetupConfig + InitBasic rather than a mock store.
		th := Setup(t).InitBasic(t)

		callerID := model.NewId()
		th.Context = th.Context.WithSession(&model.Session{UserId: callerID, Id: model.NewId()}).(*request.Context)

		policyID := model.NewId()
		sensitivePolicy := &model.AccessControlPolicy{
			ID:   policyID,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.f_unknown == "Secret"`},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("GetPolicy", th.Context, policyID).Return(sensitivePolicy, nil).Once()
		// Unknown field → resolver fails closed → HasMaskedValuesForCaller returns true.
		mockACS.On("HasMaskedValuesForCaller", mock.Anything, sensitivePolicy.Rules[0].Expression, mock.Anything).Return(true, nil).Once()

		_, appErr := th.App.UpdateAccessControlPoliciesActive(th.Context, []model.AccessControlPolicyActiveUpdate{
			{ID: policyID, Active: false},
		})

		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
		require.Equal(t, "app.pap.delete_policy.masked_values", appErr.Id)
		mockACS.AssertExpectations(t)
	})

	t.Run("activation always allowed even when caller has masked values", func(t *testing.T) {
		// The guard skips Active=true updates, so no property store access is needed.
		thMock := SetupWithStoreMock(t)

		callerID := model.NewId()
		thMock.Context = thMock.Context.WithSession(&model.Session{UserId: callerID, Id: model.NewId()}).(*request.Context)

		channelID := model.NewId()
		policy := &model.AccessControlPolicy{
			ID:   channelID,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.f_unknown == "Secret"`},
			},
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("SetActiveStatusMultiple", thMock.Context, mock.Anything).Return([]*model.AccessControlPolicy{policy}, nil).Once()

		// Channel cache & WS broadcast
		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore).Maybe()
		mockChannelStore.On("InvalidateChannel", channelID).Maybe()
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Maybe()

		mockACS := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockACS

		_, appErr := thMock.App.UpdateAccessControlPoliciesActive(thMock.Context, []model.AccessControlPolicyActiveUpdate{
			{ID: channelID, Active: true},
		})

		require.Nil(t, appErr)
		mockACPStore.AssertExpectations(t)
		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	})

	t.Run("deactivation allowed when masking flag is off", func(t *testing.T) {
		thMock := storeMockWithMaskingOff(t)
		thMock.Context = thMock.Context.WithSession(&model.Session{UserId: model.NewId(), Id: model.NewId()}).(*request.Context)

		channelID := model.NewId()
		policy := &model.AccessControlPolicy{
			ID:   channelID,
			Type: model.AccessControlPolicyTypeChannel,
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("SetActiveStatusMultiple", thMock.Context, mock.Anything).Return([]*model.AccessControlPolicy{policy}, nil).Once()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore).Maybe()
		mockChannelStore.On("InvalidateChannel", channelID).Maybe()
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Maybe()

		mockACS := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockACS

		_, appErr := thMock.App.UpdateAccessControlPoliciesActive(thMock.Context, []model.AccessControlPolicyActiveUpdate{
			{ID: channelID, Active: false},
		})

		require.Nil(t, appErr)
		// GetPolicy must never be called when masking is off.
		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
		mockACPStore.AssertExpectations(t)
	})
}

// TestUpdateAccessControlPoliciesActive_BroadcastsWebsocketEvents verifies that
// activate/deactivate fires cache invalidation and WS events for channel and parent policies.
func TestUpdateAccessControlPoliciesActive_BroadcastsWebsocketEvents(t *testing.T) {
	t.Run("channel policy triggers publishChannelPolicyEnforcedUpdate", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		thMock.Context = thMock.Context.WithSession(&model.Session{UserId: model.NewId(), Id: model.NewId()}).(*request.Context)

		channelID := model.NewId()
		policy := &model.AccessControlPolicy{
			ID:   channelID,
			Type: model.AccessControlPolicyTypeChannel,
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("SetActiveStatusMultiple", thMock.Context, mock.Anything).Return([]*model.AccessControlPolicy{policy}, nil).Once()

		mockChannelStore := storemocks.ChannelStore{}
		mockStore.On("Channel").Return(&mockChannelStore)
		mockChannelStore.On("InvalidateChannel", channelID).Once()
		mockChannelStore.On("Get", channelID, true).Return(&model.Channel{Id: channelID, Type: model.ChannelTypePrivate}, nil).Once()

		mockACS := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockACS

		_, appErr := thMock.App.UpdateAccessControlPoliciesActive(thMock.Context, []model.AccessControlPolicyActiveUpdate{
			{ID: channelID, Active: true},
		})

		require.Nil(t, appErr)
		mockChannelStore.AssertExpectations(t)
	})

	t.Run("parent policy fans out to both channel and team children", func(t *testing.T) {
		thMock := SetupWithStoreMock(t)
		thMock.Context = thMock.Context.WithSession(&model.Session{UserId: model.NewId(), Id: model.NewId()}).(*request.Context)

		parentID := model.NewId()
		policy := &model.AccessControlPolicy{
			ID:   parentID,
			Type: model.AccessControlPolicyTypeParent,
		}

		mockStore := thMock.App.Srv().Store().(*storemocks.Store)
		mockACPStore := storemocks.AccessControlPolicyStore{}
		mockStore.On("AccessControlPolicy").Return(&mockACPStore)
		mockACPStore.On("SetActiveStatusMultiple", thMock.Context, mock.Anything).Return([]*model.AccessControlPolicy{policy}, nil).Once()

		// Activating a parent must fan out to BOTH its channel and team children.
		// With no children the import searches still run but broadcast nothing — the
		// team search is what was previously missing on this path.
		mockACPStore.On("SearchPolicies", thMock.Context, mock.MatchedBy(func(s model.AccessControlPolicySearch) bool {
			return s.Type == model.AccessControlPolicyTypeChannel && s.ParentID == parentID
		})).Return([]*model.AccessControlPolicy{}, int64(0), nil).Once()
		mockACPStore.On("SearchPolicies", thMock.Context, mock.MatchedBy(func(s model.AccessControlPolicySearch) bool {
			return s.Type == model.AccessControlPolicyTypeTeam && s.ParentID == parentID
		})).Return([]*model.AccessControlPolicy{}, int64(0), nil).Once()

		mockACS := &mocks.AccessControlServiceInterface{}
		thMock.App.Srv().ch.AccessControl = mockACS

		_, appErr := thMock.App.UpdateAccessControlPoliciesActive(thMock.Context, []model.AccessControlPolicyActiveUpdate{
			{ID: parentID, Active: true},
		})

		require.Nil(t, appErr)
		// The team import search proves the team fan-out is wired (previously absent).
		mockACPStore.AssertExpectations(t)
	})
}

// TestSaveForbiddenErrorHidesInternalID verifies that saveForbiddenError always returns
// app.pap.save_policy.forbidden with an empty DetailedError, regardless of the internal reason.
func TestSaveForbiddenErrorHidesInternalID(t *testing.T) {
	rctx := request.TestContext(t)

	internalReasons := []string{
		"masked_condition_deleted: detail",
		"masked_rule_deleted: detail",
		"self_exclusion: detail",
		"advanced_expression_blocked: detail",
	}

	for _, reason := range internalReasons {
		appErr := saveForbiddenError(rctx, "testWhere", reason)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.save_policy.forbidden", appErr.Id, "reason %q must not appear in error ID", reason)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Empty(t, appErr.DetailedError)
	}
}

// TestMaskPolicyExpressions_FailClosedUsesDenyAllSentinel verifies that MaskPolicyExpressions
// emits maskFailClosedSentinel ("false") on parse failure, not the open-access "true".
func TestMaskPolicyExpressions_FailClosedUsesDenyAllSentinel(t *testing.T) {
	th := SetupWithStoreMock(t)
	callerID := model.NewId()

	t.Run("MaskExpressionForCaller failure masks rule to deny-all sentinel", func(t *testing.T) {
		th2 := Setup(t).InitBasic(t)

		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.secret == "X"`},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th2.App.Srv().ch.AccessControl = mockACS
		mockACS.On("MaskExpressionForCaller", mock.Anything, mock.Anything, mock.Anything).Return("",
			false, model.NewAppError("MaskExpressionForCaller", "app_error", nil, "parse fail", http.StatusInternalServerError)).Once()

		th2.App.MaskPolicyExpressions(th2.Context, policy, callerID)

		require.Len(t, policy.Rules, 1)
		assert.Equal(t, maskFailClosedSentinel, policy.Rules[0].Expression)
		mockACS.AssertExpectations(t)
	})

	t.Run("resolver creation failure masks all non-trivial rules to deny-all sentinel", func(t *testing.T) {
		// Force newMaskingResolver to fail by making the CPA property-group lookup
		// error out. MaskPolicyExpressions must then mask every non-trivial rule
		// closed (deny-all sentinel) up front, without ever reaching the per-rule
		// MaskExpressionForCaller path. Trivial ("" / "true") rules stay untouched.
		mockGroupStore := &storemocks.PropertyGroupStore{}
		mockGroupStore.
			On("Get", model.AccessControlPropertyGroupName).
			Return((*model.PropertyGroup)(nil), errors.New("simulated store failure"))

		ps, err := properties.New(properties.ServiceConfig{
			PropertyGroupStore: mockGroupStore,
			PropertyFieldStore: &storemocks.PropertyFieldStore{},
			PropertyValueStore: &storemocks.PropertyValueStore{},
			CallerIDExtractor:  func(rctx request.CTX) string { return "" },
		})
		require.NoError(t, err)

		originalPS := th.App.Srv().propertyService
		th.App.Srv().propertyService = ps
		defer func() { th.App.Srv().propertyService = originalPS }()

		// ACS is present, but MaskExpressionForCaller must never be called: the
		// resolver-creation failure short-circuits before per-rule masking.
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.secret == "X"`},
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: ""},
			},
		}

		th.App.MaskPolicyExpressions(th.Context, policy, callerID)

		require.Len(t, policy.Rules, 3)
		assert.Equal(t, maskFailClosedSentinel, policy.Rules[0].Expression, "non-trivial rule must be masked closed")
		assert.Equal(t, "true", policy.Rules[1].Expression, "trivial \"true\" rule must stay untouched")
		assert.Equal(t, "", policy.Rules[2].Expression, "empty rule must stay untouched")
		mockACS.AssertNotCalled(t, "MaskExpressionForCaller", mock.Anything, mock.Anything, mock.Anything)
		mockGroupStore.AssertExpectations(t)
	})

	t.Run("trivial true and empty rules are untouched by fail-closed path", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: ""},
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		th.App.MaskPolicyExpressions(th.Context, policy, callerID)

		assert.Equal(t, "", policy.Rules[0].Expression, "empty expression must stay empty")
		assert.Equal(t, "true", policy.Rules[1].Expression, "open-access rule must stay \"true\"")
	})
}

func TestGetAccessControlFieldsAutocomplete_ExcludesNonUserFields(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)

	cpaGroup, cErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, cErr)

	userField, appErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	nonUserObjectTypes := []string{
		model.PropertyFieldObjectTypeTemplate,
		model.PropertyFieldObjectTypeSystem,
		model.PropertyFieldObjectTypeChannel,
	}
	for _, ot := range nonUserObjectTypes {
		f := &model.PropertyField{
			GroupID:    cpaGroup.ID,
			Name:       celSafeName(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: ot,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		_, err := th.App.Srv().Store().PropertyField().Create(f)
		require.NoError(t, err)
	}

	fields, appErr := th.App.GetAccessControlFieldsAutocomplete(rctx, strings.Repeat("0", 26), 100, th.BasicUser.Id)
	require.Nil(t, appErr)

	for _, f := range fields {
		assert.Equal(t, model.PropertyFieldObjectTypeUser, f.ObjectType,
			"autocomplete must only return user fields, got ObjectType=%q for field %s", f.ObjectType, f.ID)
	}

	fieldIDs := make([]string, len(fields))
	for i, f := range fields {
		fieldIDs[i] = f.ID
	}
	assert.Contains(t, fieldIDs, userField.ID, "user CPA field must appear in autocomplete results")
}

// Verify that the team join path (channelID="") produces a subject with no
// channel-scoped role — the user holds no channel role at team-join time, so
// attaching one would produce a misleading subject for the membership decision.
func TestBuildAccessControlSubjectTeamPath(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("no channel-scoped role when channelID is empty", func(t *testing.T) {
		subject, appErr := th.App.BuildAccessControlSubject(th.Context, th.BasicUser.Id, th.BasicUser.Roles, "")
		require.Nil(t, appErr)
		require.NotNil(t, subject)

		require.NotEmpty(t, subject.ScopedRoles)
		assert.Equal(t, model.AccessControlSubjectScopeSystem, subject.ScopedRoles[0].Scope)

		for _, sr := range subject.ScopedRoles {
			assert.NotEqual(t, model.AccessControlSubjectScopeChannel, sr.Scope)
		}
	})
}

func TestGetAccessControlFieldsAutocompleteNativeAttributes(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	defer th.App.Srv().SetLicense(nil)

	rctx := request.TestContext(t)

	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	cpaField, cErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, cErr)

	nativeNames := []string{
		model.NativeAttributePropertyFieldEmail,
		model.NativeAttributePropertyFieldVerified,
		model.NativeAttributePropertyFieldIsBot,
		model.NativeAttributePropertyFieldCreateAt,
	}

	t.Run("first page prepends native attributes", func(t *testing.T) {
		// The API maps an empty first page to a 26-zero sentinel cursor.
		fields, appErr := th.App.GetAccessControlFieldsAutocomplete(rctx, strings.Repeat("0", 26), 50, anonymousCallerId)
		require.Nil(t, appErr)

		seen := map[string]bool{}
		for _, f := range fields {
			if isNative, _ := f.Attrs[model.NativeAttributeAttrMarker].(bool); isNative {
				seen[f.Name] = true
			}
		}
		for _, name := range nativeNames {
			assert.True(t, seen[name], "expected native attribute %q on first page", name)
		}

		require.GreaterOrEqual(t, len(fields), len(nativeNames)+1)
		assert.Equal(t, true, fields[0].Attrs[model.NativeAttributeAttrMarker], "native attributes should precede CPA fields")
	})

	t.Run("subsequent pages omit native attributes", func(t *testing.T) {
		fields, appErr := th.App.GetAccessControlFieldsAutocomplete(rctx, cpaField.ID, 50, anonymousCallerId)
		require.Nil(t, appErr)
		for _, f := range fields {
			isNative, _ := f.Attrs[model.NativeAttributeAttrMarker].(bool)
			assert.False(t, isNative, "native attribute %q must not repeat on later pages", f.Name)
		}
	})
}
