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

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

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
					Actions:    []string{"*"},
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
					Actions:    []string{"*"},
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
					Actions:    []string{"*"},
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
				Actions:    []string{"*"},
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

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(parentPolicy, nil)
		mockAccessControl.On("GetPolicy", th.Context, ch.Id).Return(parentPolicy, nil)
		mockAccessControl.On("SavePolicy", th.Context, mock.Anything).Return(nil, model.NewAppError("SavePolicy", "error", nil, "save error", http.StatusInternalServerError))

		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, ch)
			require.Nil(t, appErr)
		})

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

	t.Run("Channel is not private", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeParent}, nil)
		// Create a public channel
		publicChannel := th.CreateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, publicChannel)
			require.Nil(t, appErr)
		})

		policies, err := th.App.AssignAccessControlPolicyToChannels(th.Context, parentID, []string{publicChannel.Id})
		require.NotNil(t, err)
		assert.Nil(t, policies)
		assert.Contains(t, err.Error(), "Channel is not of type private")
	})

	t.Run("Channel is shared", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl
		mockAccessControl.On("GetPolicy", th.Context, parentID).Return(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypeParent}, nil)

		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, privateChannel)
			require.Nil(t, appErr)
		})
		privateChannel.Shared = model.NewPointer(true)
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

func TestUnassignPoliciesFromChannels(t *testing.T) {
	th := Setup(t).InitBasic(t)

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
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)
	require.NotNil(t, parentPolicy)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, parentPolicy.ID)
		require.NoError(t, sErr)
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

	childPolicy1 := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeChannel,
		ID:       ch1.Id,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_2,
	}

	appErrInherit1 := childPolicy1.Inherit(parentPolicy)
	require.Nil(t, appErrInherit1)
	childPolicy1, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, childPolicy1)
	require.NoError(t, err)
	require.NotNil(t, childPolicy1)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, childPolicy1.ID)
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
	childPolicy2, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, childPolicy2)
	require.NoError(t, err)
	require.NotNil(t, childPolicy2)
	t.Cleanup(func() {
		sErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, childPolicy2.ID)
		require.NoError(t, sErr)
	})

	t.Run("Feature not enabled", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.unassign_access_control_policy_from_channels.app_error", appErr.Id)
	})

	t.Run("Error deleting policy from AccessControlService", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("SearchPolicies", th.Context, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: parentPolicy.ID,
			Limit:    1000,
		}).Return([]*model.AccessControlPolicy{childPolicy1}, mock.Anything, nil).Once()
		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(childPolicy1, nil).Once()

		expectedErr := model.NewAppError("DeletePolicy", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, "failed to delete from acs", http.StatusInternalServerError)
		mockAccessControl.On("DeletePolicy", th.Context, ch1.Id).Return(expectedErr).Once()

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.NotNil(t, appErr)
		assert.Equal(t, expectedErr.Id, appErr.Id)
		assert.Equal(t, expectedErr.Message, appErr.Message)

		mockAccessControl.AssertCalled(t, "DeletePolicy", th.Context, ch1.Id)
		mockAccessControl.AssertNotCalled(t, "DeletePolicy", th.Context, ch2.Id)
	})

	t.Run("Channel not actually a child policy", func(t *testing.T) {
		ch3 := th.CreatePrivateChannel(t, th.BasicTeam) // Not a child of parentPolicy
		t.Cleanup(func() { _ = th.App.PermanentDeleteChannel(th.Context, ch3) })

		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(childPolicy1, nil).Once()
		mockAccessControl.On("GetPolicy", th.Context, ch2.Id).Return(childPolicy2, nil).Once()
		mockAccessControl.On("DeletePolicy", th.Context, ch1.Id).Return(nil).Once()
		mockAccessControl.On("DeletePolicy", th.Context, ch2.Id).Return(nil).Once()

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id, ch3.Id})
		require.Nil(t, appErr)
	})

	t.Run("Successful unassignment", func(t *testing.T) {
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		mockAccessControl.On("DeletePolicy", th.Context, ch1.Id).Return(nil).Once()
		mockAccessControl.On("DeletePolicy", th.Context, ch2.Id).Return(nil).Once()
		mockAccessControl.On("GetPolicy", th.Context, ch1.Id).Return(childPolicy1, nil).Once()
		mockAccessControl.On("GetPolicy", th.Context, ch2.Id).Return(childPolicy2, nil).Once()

		appErr := th.App.UnassignPoliciesFromChannels(th.Context, parentPolicy.ID, []string{ch1.Id, ch2.Id})
		require.Nil(t, appErr)
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

	t.Run("Public channel should fail", func(t *testing.T) {
		th.AddUserToChannel(t, channelAdmin, publicChannel)

		// Make user channel admin for public channel
		_, appErr2 := th.App.UpdateChannelMemberRoles(th.Context, publicChannel.Id, channelAdmin.Id, "channel_user channel_admin")
		require.Nil(t, appErr2)

		appErr2 = th.App.ValidateChannelAccessControlPermission(th.Context, channelAdmin.Id, publicChannel.Id)
		require.NotNil(t, appErr2)
		assert.Equal(t, "app.pap.access_control.channel_not_private", appErr2.Id)
	})

	t.Run("Shared channel should fail", func(t *testing.T) {
		sharedChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, sharedChannel)
			require.Nil(t, appErr)
		})

		// Mark channel as shared
		sharedChannel.Shared = model.NewPointer(true)
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
			{Actions: []string{"*"}, Expression: "true"},
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
			{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr := th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.insufficient_permissions", appErr.Id)
	})

	t.Run("Creating policy for public channel should fail", func(t *testing.T) {
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
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr4 = th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr4)
		assert.Equal(t, "app.pap.access_control.channel_not_private", appErr4.Id)
	})

	t.Run("Creating policy for shared channel should fail", func(t *testing.T) {
		sharedChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		t.Cleanup(func() {
			appErr := th.App.PermanentDeleteChannel(th.Context, sharedChannel)
			require.Nil(t, appErr)
		})

		// Mark channel as shared
		sharedChannel.Shared = model.NewPointer(true)
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
				{Actions: []string{"*"}, Expression: "true"},
			},
		}

		appErr5 = th.App.ValidateChannelAccessControlPolicyCreation(th.Context, channelAdmin.Id, policy)
		require.NotNil(t, appErr5)
		assert.Equal(t, "app.pap.access_control.channel_shared", appErr5.Id)
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
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: th.BasicUser.Id, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1},
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
			model.SubjectSearchOptions{SubjectID: requesterID, Limit: 1},
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
				{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
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
				{Actions: []string{"*"}, Expression: "true"},
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
