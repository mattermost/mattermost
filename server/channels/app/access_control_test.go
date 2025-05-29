// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestGetChannelsForPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)
	policyID := "policyID"
	cursor := model.AccessControlPolicyCursor{}
	limit := 10

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil

		channels, total, err := th.App.GetChannelsForPolicy(rctx, policyID, cursor, limit)
		require.NotNil(t, err)
		assert.Nil(t, channels)
		assert.Equal(t, int64(0), total)
	})

	t.Run("Invalid policy type", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", mock.AnythingOfType("*request.Context"), policyID).Return(&model.AccessControlPolicy{Type: "invalid"}, nil)

		channels, total, err := th.App.GetChannelsForPolicy(rctx, policyID, cursor, limit)
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
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, pID).Return(parentPolicy, nil)

		channels, total, err := th.App.GetChannelsForPolicy(rctx, pID, cursor, limit)
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
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		ch := th.CreatePrivateChannel(rctx, th.BasicTeam)

		childPolicy, appErr := parentPolicy.Inherit(ch.Id, model.AccessControlPolicyTypeChannel)
		require.Nil(t, appErr)

		var err error
		childPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, childPolicy)
		require.NoError(t, err)
		require.NotNil(t, childPolicy)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, pID).Return(parentPolicy, nil)

		channels, total, appErr := th.App.GetChannelsForPolicy(rctx, pID, cursor, limit)
		require.Nil(t, appErr)
		require.NotNil(t, channels)
		require.Equal(t, int64(1), total)
		assert.Equal(t, ch.Id, channels[0].Id)

		mockAccessControl.On("GetPolicy", rctx, ch.Id).Return(childPolicy, nil)
		channels, total, appErr = th.App.GetChannelsForPolicy(rctx, ch.Id, cursor, limit)
		require.Nil(t, appErr)
		require.NotNil(t, channels)
		require.Equal(t, int64(1), total)
		assert.Equal(t, ch.Id, channels[0].Id)
	})
}

func TestSearchAccessControlPolicies(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)

	t.Run("Feature not enabled", func(t *testing.T) {
		policies, total, err := th.App.SearchAccessControlPolicies(rctx, model.AccessControlPolicySearch{})
		require.NotNil(t, err)
		require.Empty(t, policies)
		require.Equal(t, int64(0), total)
	})

	t.Run("Empty search result", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		policies, total, err := th.App.SearchAccessControlPolicies(rctx, model.AccessControlPolicySearch{})
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
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		var err error
		parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, parentPolicy)
		require.NoError(t, err)
		require.NotNil(t, parentPolicy)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, parentPolicy.ID)
			require.NoError(t, dErr)
		}()

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("NormalizePolicy", rctx, parentPolicy).Return(parentPolicy, nil)

		t.Run("With no term", func(t *testing.T) {
			policies, total, err := th.App.SearchAccessControlPolicies(rctx, model.AccessControlPolicySearch{})
			require.Nil(t, err)
			require.NotNil(t, policies)
			require.Equal(t, int64(1), total)
			require.Equal(t, parentPolicy.ID, policies[0].ID)
		})

		t.Run("With term", func(t *testing.T) {
			policies, total, err := th.App.SearchAccessControlPolicies(rctx, model.AccessControlPolicySearch{
				Term: "parent",
			})
			require.Nil(t, err)
			require.NotNil(t, policies)
			require.Equal(t, int64(1), total)
			require.Equal(t, parentPolicy.ID, policies[0].ID)
		})

		t.Run("With term and no results", func(t *testing.T) {
			policies, total, err := th.App.SearchAccessControlPolicies(rctx, model.AccessControlPolicySearch{
				Term: "something else",
			})
			require.Nil(t, err)
			require.Empty(t, policies)
			require.Equal(t, int64(0), total)
		})
	})
}

func TestAssignAccessControlPolicyToChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)
	parentID := model.NewId()

	parentPolicy := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeParent,
		ID:       parentID,
		Name:     "parentPolicy",
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"*"},
				Expression: "user.attributes.program == \"non-existent-program\"",
			},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, parentPolicy)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)
	t.Cleanup(func() {
		dErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, parentPolicy.ID)
		require.NoError(t, dErr)
	})

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		policies, err := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Equal(t, "app.pap.assign_access_control_policy_to_channels.app_error", err.Id)
	})

	t.Run("Error saving policy", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("SavePolicy", rctx, mock.Anything).Return(nil, model.NewAppError("SavePolicy", "error", nil, "save error", http.StatusInternalServerError))

		ch := th.CreatePrivateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, ch)
			require.Nil(t, appErr)
		})

		policies, err := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{ch.Id})
		require.NotNil(t, err)
		require.Empty(t, policies)
	})

	t.Run("Parent policy not found", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(nil, model.NewAppError("GetPolicy", "error", nil, "not found", http.StatusNotFound))

		policies, err := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{})
		require.NotNil(t, err)
		assert.Nil(t, policies)
	})

	t.Run("Policy is not of type parent", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeChannel}, nil)

		policies, err := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Equal(t, "app.pap.assign_access_control_policy_to_channels.app_error", err.Id)
	})

	t.Run("Channel is not private", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeParent}, nil)
		// Create a public channel
		publicChannel := th.CreateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, publicChannel)
			require.Nil(t, appErr)
		})

		policies, err := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{publicChannel.Id})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Contains(t, err.Error(), "Channel is not of type private")
	})

	t.Run("Channel is shared", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeParent}, nil)

		privateChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, privateChannel)
			require.Nil(t, appErr)
		})
		privateChannel.Shared = model.NewPointer(true)
		_, err := th.App.Srv().Store().Channel().Update(rctx, privateChannel)
		require.NoError(t, err)

		policies, appErr := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{privateChannel.Id})
		require.NotNil(t, appErr)
		assert.Nil(t, policies)
		assert.Contains(t, appErr.Error(), "Channel is shared")
	})

	t.Run("Successful assignment", func(t *testing.T) {
		ch1 := th.CreatePrivateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, ch1)
			require.Nil(t, appErr)
		})
		ch2 := th.CreatePrivateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, ch2)
			require.Nil(t, appErr)
		})

		childP1, appErr := parentPolicy.Inherit(ch1.Id, model.AccessControlPolicyTypeChannel)
		require.Nil(t, appErr)
		childP2, appErr := parentPolicy.Inherit(ch2.Id, model.AccessControlPolicyTypeChannel)
		require.Nil(t, appErr)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("SavePolicy", rctx, mock.MatchedBy(func(p *model.AccessControlPolicy) bool { return p.ID == ch1.Id })).Return(childP1, nil)
		mockAccessControl.On("SavePolicy", rctx, mock.MatchedBy(func(p *model.AccessControlPolicy) bool { return p.ID == ch2.Id })).Return(childP2, nil)

		policies, err := th.App.AssignAccessControlPolicyToChannels(rctx, parentID, []string{ch1.Id, ch2.Id})
		require.Nil(t, err)
		require.NotNil(t, policies)
		require.Len(t, policies, 2)
		assert.ElementsMatch(t, []string{ch1.Id, ch2.Id}, []string{policies[0].ID, policies[1].ID})
		mockAccessControl.AssertCalled(t, "SavePolicy", rctx, mock.AnythingOfType("*model.AccessControlPolicy"))
	})
}

func TestUnAssignPoliciesFromChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Name:     "parent-for-unassign-tests",
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{"*"}, Expression: "true"},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, parentPolicy)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, parentPolicy.ID)
		require.NoError(t, sErr)
	})

	ch1 := th.CreatePrivateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		sErr := th.App.PermanentDeleteChannel(rctx, ch1)
		require.Nil(t, sErr)
	})
	ch2 := th.CreatePrivateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		sErr := th.App.PermanentDeleteChannel(rctx, ch2)
		require.Nil(t, sErr)
	})

	childPolicy1, appErrInherit1 := parentPolicy.Inherit(ch1.Id, model.AccessControlPolicyTypeChannel)
	require.Nil(t, appErrInherit1)
	childPolicy1, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, childPolicy1)
	require.NoError(t, err)
	require.NotNil(t, childPolicy1)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, childPolicy1.ID)
		require.NoError(t, sErr)
	})

	childPolicy2, appErrInherit2 := parentPolicy.Inherit(ch2.Id, model.AccessControlPolicyTypeChannel)
	require.Nil(t, appErrInherit2)
	childPolicy2, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, childPolicy2)
	require.NoError(t, err)
	require.NotNil(t, childPolicy2)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, childPolicy2.ID)
		require.NoError(t, sErr)
	})

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		appErr := th.App.UnAssignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.unassign_access_control_policy_from_channels.app_error", appErr.Id)
	})

	t.Run("Error deleting policy from AccessControlService", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		expectedErr := model.NewAppError("DeletePolicy", "mock.delete.error", nil, "failed to delete from acs", http.StatusInternalServerError)
		mockAccessControl.On("DeletePolicy", rctx, ch1.Id).Return(expectedErr).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch2.Id).Return(nil).Maybe()

		appErr := th.App.UnAssignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, expectedErr.Id, appErr.Id)
		assert.Equal(t, expectedErr.Message, appErr.Message)

		mockAccessControl.AssertCalled(t, "DeletePolicy", rctx, ch1.Id)
		mockAccessControl.AssertNotCalled(t, "DeletePolicy", rctx, ch2.Id)

		p1, storeErr := th.App.Srv().Store().AccessControlPolicy().Get(rctx, ch1.Id)
		assert.NoError(t, storeErr)
		assert.NotNil(t, p1)
		p2, storeErr := th.App.Srv().Store().AccessControlPolicy().Get(rctx, ch2.Id)
		assert.NoError(t, storeErr)
		assert.NotNil(t, p2)
	})

	t.Run("Channel not actually a child policy", func(t *testing.T) {
		ch3 := th.CreatePrivateChannel(rctx, th.BasicTeam) // Not a child of parentPolicy
		t.Cleanup(func() { _ = th.App.PermanentDeleteChannel(rctx, ch3) })

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("DeletePolicy", rctx, ch1.Id).Return(nil).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch2.Id).Return(nil).Once()

		appErr := th.App.UnAssignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id, ch3.Id})
		require.Nil(t, appErr)
	})

	t.Run("Successful unassignment", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("DeletePolicy", rctx, ch1.Id).Return(nil).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch2.Id).Return(nil).Once()

		appErr := th.App.UnAssignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.Nil(t, appErr)
	})
}
