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
			Version:  model.AccessControlPolicyVersionV0_2,
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
			Version:  model.AccessControlPolicyVersionV0_2,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.program == \"non-existent-program\"",
				},
			},
		}

		ch := th.CreatePrivateChannel(rctx, th.BasicTeam)

		childPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			ID:       ch.Id,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
		}

		appErr := childPolicy.Inherit(parentPolicy)
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
		Version:  model.AccessControlPolicyVersionV0_2,
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
		ch := th.CreatePrivateChannel(rctx, th.BasicTeam)

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("GetPolicy", rctx, ch.Id).Return(parentPolicy, nil)
		mockAccessControl.On("SavePolicy", rctx, mock.Anything).Return(nil, model.NewAppError("SavePolicy", "error", nil, "save error", http.StatusInternalServerError))

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
		mockAccessControl.On("GetPolicy", rctx, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("GetPolicy", rctx, ch1.Id).Return(nil, nil)
		mockAccessControl.On("GetPolicy", rctx, ch2.Id).Return(nil, nil)
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

func TestUnassignPoliciesFromChannels(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Name:     "parent-for-unassign-tests",
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_2,
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

	childPolicy1 := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeChannel,
		ID:       ch1.Id,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_2,
	}

	appErrInherit1 := childPolicy1.Inherit(parentPolicy)
	require.Nil(t, appErrInherit1)
	childPolicy1, err = th.App.Srv().Store().AccessControlPolicy().Save(rctx, childPolicy1)
	require.NoError(t, err)
	require.NotNil(t, childPolicy1)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, childPolicy1.ID)
		require.NoError(t, sErr)
	})

	childPolicy2 := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeChannel,
		ID:       ch2.Id,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_2,
	}

	appErrInherit2 := childPolicy2.Inherit(parentPolicy)
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
		appErr := th.App.UnassignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.unassign_access_control_policy_from_channels.app_error", appErr.Id)
	})

	t.Run("Error deleting policy from AccessControlService", func(t *testing.T) {
		t.Skip("MM-64541")
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		expectedErr := model.NewAppError("DeletePolicy", "mock.delete.error", nil, "failed to delete from acs", http.StatusInternalServerError)
		mockAccessControl.On("DeletePolicy", rctx, ch1.Id).Return(expectedErr).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch2.Id).Return(nil).Maybe()

		appErr := th.App.UnassignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id})
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

		mockAccessControl.On("GetPolicy", rctx, ch1.Id).Return(childPolicy1, nil).Once()
		mockAccessControl.On("GetPolicy", rctx, ch2.Id).Return(childPolicy2, nil).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch1.Id).Return(nil).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch2.Id).Return(nil).Once()

		appErr := th.App.UnassignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id, ch3.Id})
		require.Nil(t, appErr)
	})

	t.Run("Successful unassignment", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("DeletePolicy", rctx, ch1.Id).Return(nil).Once()
		mockAccessControl.On("DeletePolicy", rctx, ch2.Id).Return(nil).Once()
		mockAccessControl.On("GetPolicy", rctx, ch1.Id).Return(childPolicy1, nil).Once()
		mockAccessControl.On("GetPolicy", rctx, ch2.Id).Return(childPolicy2, nil).Once()

		appErr := th.App.UnassignPoliciesFromChannels(rctx, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.Nil(t, appErr)
	})
}

func TestValidateChannelAccessControlPermission(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)

	th.AddPermissionToRole(model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

	// Create a private channel
	privateChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(rctx, privateChannel)
		require.Nil(t, appErr)
	})

	// Create a public channel
	publicChannel := th.CreateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(rctx, publicChannel)
		require.Nil(t, appErr)
	})

	// Create a user and make them channel admin
	channelAdmin := th.CreateUser()
	th.LinkUserToTeam(channelAdmin, th.BasicTeam)
	th.AddUserToChannel(channelAdmin, privateChannel)

	// Make user channel admin using the proper APP method
	_, appErr := th.App.UpdateChannelMemberRoles(rctx, privateChannel.Id, channelAdmin.Id, "channel_user channel_admin")
	require.Nil(t, appErr)

	t.Run("Valid channel admin user", func(t *testing.T) {
		appErr := th.App.ValidateChannelAccessControlPermission(rctx, channelAdmin.Id, privateChannel.Id)
		require.Nil(t, appErr)
	})

	t.Run("User who is not channel admin", func(t *testing.T) {
		regularUser := th.CreateUser()
		th.LinkUserToTeam(regularUser, th.BasicTeam)
		th.AddUserToChannel(regularUser, privateChannel)

		appErr := th.App.ValidateChannelAccessControlPermission(rctx, regularUser.Id, privateChannel.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_channel_permissions", appErr.Id)
	})

	t.Run("Non-existent channel", func(t *testing.T) {
		nonExistentChannelId := model.NewId()
		appErr := th.App.ValidateChannelAccessControlPermission(rctx, channelAdmin.Id, nonExistentChannelId)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.channel.get.existing.app_error", appErr.Id)
	})

	t.Run("Public channel should fail", func(t *testing.T) {
		th.AddUserToChannel(channelAdmin, publicChannel)

		// Make user channel admin for public channel
		_, appErr2 := th.App.UpdateChannelMemberRoles(rctx, publicChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr2)

		appErr2 = th.App.ValidateChannelAccessControlPermission(rctx, channelAdmin.Id, publicChannel.Id)
		require.NotNil(t, appErr2)
		assert.Equal(t, "app.pap.access_control.channel_not_private", appErr2.Id)
	})

	t.Run("Shared channel should fail", func(t *testing.T) {
		sharedChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, sharedChannel)
			require.Nil(t, appErr)
		})

		// Mark channel as shared
		sharedChannel.Shared = model.NewPointer(true)
		_, err := th.App.Srv().Store().Channel().Update(rctx, sharedChannel)
		require.NoError(t, err)

		th.AddUserToChannel(channelAdmin, sharedChannel)

		// Make user channel admin for shared channel
		_, appErr3 := th.App.UpdateChannelMemberRoles(rctx, sharedChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr3)

		appErr3 = th.App.ValidateChannelAccessControlPermission(rctx, channelAdmin.Id, sharedChannel.Id)
		require.NotNil(t, appErr3)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr3.Id)
	})
}

func TestValidateAccessControlPolicyPermission(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)

	th.AddPermissionToRole(model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

	// Create a private channel and channel admin
	privateChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(rctx, privateChannel)
		require.Nil(t, appErr)
	})

	channelAdmin := th.CreateUser()
	th.LinkUserToTeam(channelAdmin, th.BasicTeam)
	th.AddUserToChannel(channelAdmin, privateChannel)

	// Make user channel admin using the proper APP method
	_, appErr := th.App.UpdateChannelMemberRoles(rctx, privateChannel.Id, channelAdmin.Id, "channel_user channel_admin")
	require.Nil(t, appErr)

	// Create channel policy
	channelPolicy := &model.AccessControlPolicy{
		ID:       privateChannel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{"*"}, Expression: "true"},
		},
	}
	var err2 error
	channelPolicy, err2 = th.App.Srv().Store().AccessControlPolicy().Save(rctx, channelPolicy)
	require.NoError(t, err2)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, channelPolicy.ID)
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
			{Actions: []string{"*"}, Expression: "true"},
		},
	}
	parentPolicy, err2 = th.App.Srv().Store().AccessControlPolicy().Save(rctx, parentPolicy)
	require.NoError(t, err2)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(rctx, parentPolicy.ID)
		require.NoError(t, sErr)
	})

	// Set up mock Access Control service
	mockAccessControl := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockAccessControl
	mockAccessControl.On("GetPolicy", rctx, channelPolicy.ID).Return(channelPolicy, nil)
	mockAccessControl.On("GetPolicy", rctx, parentPolicy.ID).Return(parentPolicy, nil)
	mockAccessControl.On("GetPolicy", rctx, mock.AnythingOfType("string")).Return(nil, model.NewAppError("GetPolicy", "app.access_control_policy.get.app_error", nil, "not found", http.StatusNotFound))

	t.Run("System admin accessing any policy should succeed", func(t *testing.T) {
		appErr := th.App.ValidateAccessControlPolicyPermission(rctx, th.SystemAdminUser.Id, channelPolicy.ID)
		require.Nil(t, appErr)

		appErr = th.App.ValidateAccessControlPolicyPermission(rctx, th.SystemAdminUser.Id, parentPolicy.ID)
		require.Nil(t, appErr)
	})

	t.Run("Channel admin accessing their channel's policy should succeed", func(t *testing.T) {
		appErr := th.App.ValidateAccessControlPolicyPermission(rctx, channelAdmin.Id, channelPolicy.ID)
		require.Nil(t, appErr)
	})

	t.Run("Channel admin accessing parent policy should fail", func(t *testing.T) {
		appErr := th.App.ValidateAccessControlPolicyPermission(rctx, channelAdmin.Id, parentPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Regular user accessing any policy should fail", func(t *testing.T) {
		regularUser := th.CreateUser()

		appErr := th.App.ValidateAccessControlPolicyPermission(rctx, regularUser.Id, channelPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_channel_permissions", appErr.Id)

		appErr = th.App.ValidateAccessControlPolicyPermission(rctx, regularUser.Id, parentPolicy.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Non-existent policy should fail", func(t *testing.T) {
		nonExistentPolicyId := model.NewId()
		appErr := th.App.ValidateAccessControlPolicyPermission(rctx, channelAdmin.Id, nonExistentPolicyId)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control_policy.get.app_error", appErr.Id)
	})
}

func TestValidateChannelAccessControlPolicyCreation(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	rctx := request.TestContext(t)

	// Create a private channel and channel admin
	privateChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(rctx, privateChannel)
		require.Nil(t, appErr)
	})

	anotherChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
	t.Cleanup(func() {
		appErr := th.App.PermanentDeleteChannel(rctx, anotherChannel)
		require.Nil(t, appErr)
	})

	channelAdmin := th.CreateUser()
	th.LinkUserToTeam(channelAdmin, th.BasicTeam)
	th.AddUserToChannel(channelAdmin, privateChannel)

	// Make user channel admin using the proper APP method
	_, appErr := th.App.UpdateChannelMemberRoles(rctx, privateChannel.Id, channelAdmin.Id, "channel_user channel_admin")
	require.Nil(t, appErr)

	t.Run("Channel admin creating policy for their channel should succeed", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       privateChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(rctx, channelAdmin.Id, policy)
		require.Nil(t, appErr)
	})

	t.Run("Channel admin creating policy for another channel should fail", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			ID:       anotherChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(rctx, channelAdmin.Id, policy)
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
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(rctx, channelAdmin.Id, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Creating policy for public channel should fail", func(t *testing.T) {
		publicChannel := th.CreateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, publicChannel)
			require.Nil(t, appErr)
		})

		th.AddUserToChannel(channelAdmin, publicChannel)

		// Make user channel admin for public channel
		_, appErr4 := th.App.UpdateChannelMemberRoles(rctx, publicChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr4)

		policy := &model.AccessControlPolicy{
			ID:       publicChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr4 = th.App.ValidateChannelAccessControlPolicyCreation(rctx, channelAdmin.Id, policy)
		require.NotNil(t, appErr4)
		assert.Equal(t, "app.pap.access_control.channel_not_private", appErr4.Id)
	})

	t.Run("Creating policy for shared channel should fail", func(t *testing.T) {
		sharedChannel := th.CreatePrivateChannel(rctx, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(rctx, sharedChannel)
			require.Nil(t, appErr)
		})

		// Mark channel as shared
		sharedChannel.Shared = model.NewPointer(true)
		_, err := th.App.Srv().Store().Channel().Update(rctx, sharedChannel)
		require.NoError(t, err)

		th.AddUserToChannel(channelAdmin, sharedChannel)

		// Make user channel admin for shared channel
		_, appErr5 := th.App.UpdateChannelMemberRoles(rctx, sharedChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr5)

		policy := &model.AccessControlPolicy{
			ID:       sharedChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr5 = th.App.ValidateChannelAccessControlPolicyCreation(rctx, channelAdmin.Id, policy)
		require.NotNil(t, appErr5)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr5.Id)
	})
}
