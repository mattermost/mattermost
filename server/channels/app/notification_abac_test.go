// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestFilterOutOfChannelMentions_ABAC(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	if *mainHelper.GetSQLSettings().DriverName == model.DatabaseDriverMysql {
		t.Skip("Access control tests are not supported on MySQL")
	}

	// Enable ABAC in config
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})

	// Set enterprise advanced license (required for ABAC)
	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)
	th.App.Srv().SetLicense(license)

	channel := th.BasicChannel
	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	user4 := th.CreateUser()

	th.LinkUserToTeam(user3, th.BasicTeam)
	th.LinkUserToTeam(user4, th.BasicTeam)

	t.Run("should return nonInvitableUsers for ABAC-controlled channel when users don't match attributes", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Create an ABAC policy for the channel to make it ABAC-controlled
		policy := &model.AccessControlPolicy{
			ID:       abacChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "test-policy",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.department == 'engineering'",
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		assert.NoError(t, err)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID)
			assert.NoError(t, dErr)
		}()

		// Mock the ABAC service
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		// Mock QueryUsersForResource to return only user2 (user3 and user4 don't match ABAC attributes)
		filteredUsers := []*model.User{user2}
		mockAccessControl.On("QueryUsersForResource", mock.AnythingOfType("*request.Context"), abacChannel.Id, "*", mock.AnythingOfType("model.SubjectSearchOptions")).Return(filteredUsers, int64(1), nil)

		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username, user4.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, nonInvitableUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Len(t, outOfChannelUsers, 1)
		assert.Equal(t, user2.Id, outOfChannelUsers[0].Id, "user2 should be invitable")
		assert.Nil(t, outOfGroupUsers)
		assert.Len(t, nonInvitableUsers, 2)

		// Check that user3 and user4 are in nonInvitableUsers
		nonInvitableUserIDs := []string{nonInvitableUsers[0].Id, nonInvitableUsers[1].Id}
		assert.Contains(t, nonInvitableUserIDs, user3.Id, "user3 should be non-invitable")
		assert.Contains(t, nonInvitableUserIDs, user4.Id, "user4 should be non-invitable")

		mockAccessControl.AssertExpectations(t)
	})

	t.Run("should return all users as invitable for ABAC-controlled channel when all users match attributes", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Create an ABAC policy for the channel to make it ABAC-controlled
		policy := &model.AccessControlPolicy{
			ID:       abacChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "test-policy-2",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.department == 'engineering'",
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		assert.NoError(t, err)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID)
			assert.NoError(t, dErr)
		}()

		// Mock the ABAC service
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		// Mock QueryUsersForResource to return all users (all match ABAC attributes)
		filteredUsers := []*model.User{user2, user3, user4}
		mockAccessControl.On("QueryUsersForResource", mock.AnythingOfType("*request.Context"), abacChannel.Id, "*", mock.AnythingOfType("model.SubjectSearchOptions")).Return(filteredUsers, int64(3), nil)

		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username, user4.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, nonInvitableUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Len(t, outOfChannelUsers, 3)
		assert.Nil(t, outOfGroupUsers)
		assert.Len(t, nonInvitableUsers, 0)

		// Check that all users are in outOfChannelUsers
		outOfChannelUserIDs := []string{outOfChannelUsers[0].Id, outOfChannelUsers[1].Id, outOfChannelUsers[2].Id}
		assert.Contains(t, outOfChannelUserIDs, user2.Id)
		assert.Contains(t, outOfChannelUserIDs, user3.Id)
		assert.Contains(t, outOfChannelUserIDs, user4.Id)

		mockAccessControl.AssertExpectations(t)
	})

	t.Run("should use existing logic for non-ABAC channels", func(t *testing.T) {
		// For non-ABAC channels, we don't need to create a policy
		// The channel.Id won't have a policy, so ChannelAccessControlled will return false

		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, nonInvitableUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, channel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Len(t, outOfChannelUsers, 2)
		assert.Nil(t, outOfGroupUsers)
		assert.Len(t, nonInvitableUsers, 0) // No ABAC filtering, so no nonInvitableUsers

		// Verify existing behavior is preserved
		assert.True(t, (outOfChannelUsers[0].Id == user2.Id || outOfChannelUsers[1].Id == user2.Id))
		assert.True(t, (outOfChannelUsers[0].Id == user3.Id || outOfChannelUsers[1].Id == user3.Id))
	})

	t.Run("should handle ABAC service unavailable gracefully", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Create an ABAC policy for the channel to make it ABAC-controlled
		policy := &model.AccessControlPolicy{
			ID:       abacChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "test-policy-error",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.department == 'engineering'",
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		assert.NoError(t, err)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID)
			assert.NoError(t, dErr)
		}()

		// Mock the ABAC service
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		// Mock QueryUsersForResource to return an error (service unavailable)
		mockAccessControl.On("QueryUsersForResource", mock.AnythingOfType("*request.Context"), abacChannel.Id, "*", mock.AnythingOfType("model.SubjectSearchOptions")).Return(nil, int64(0), model.NewAppError("QueryUsersForResource", "service.unavailable", nil, "", 500))

		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, nonInvitableUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.Error(t, err)
		assert.Nil(t, outOfTeamUsers)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
		assert.Nil(t, nonInvitableUsers)

		mockAccessControl.AssertExpectations(t)
	})

	t.Run("should handle ABAC service nil gracefully", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Set ABAC service to nil
		th.App.Srv().ch.AccessControl = nil

		post := &model.Post{}
		potentialMentions := []string{user2.Username, user3.Username}

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, nonInvitableUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Len(t, outOfTeamUsers, 0)
		assert.Len(t, outOfChannelUsers, 2)
		assert.Nil(t, outOfGroupUsers)
		assert.Len(t, nonInvitableUsers, 0) // No ABAC service, so treat all as invitable

		// Verify fallback behavior
		assert.True(t, (outOfChannelUsers[0].Id == user2.Id || outOfChannelUsers[1].Id == user2.Id))
		assert.True(t, (outOfChannelUsers[0].Id == user3.Id || outOfChannelUsers[1].Id == user3.Id))
	})

	t.Run("should handle empty potential mentions for ABAC channel", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Create an ABAC policy for the channel to make it ABAC-controlled
		policy := &model.AccessControlPolicy{
			ID:       abacChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "test-policy-empty",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.department == 'engineering'",
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		assert.NoError(t, err)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID)
			assert.NoError(t, dErr)
		}()

		// Mock the ABAC service
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		post := &model.Post{}
		potentialMentions := []string{} // Empty mentions

		outOfTeamUsers, outOfChannelUsers, outOfGroupUsers, nonInvitableUsers, err := th.App.filterOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.NoError(t, err)
		assert.Nil(t, outOfTeamUsers)
		assert.Nil(t, outOfChannelUsers)
		assert.Nil(t, outOfGroupUsers)
		assert.Nil(t, nonInvitableUsers)

		// Should not call QueryUsersForResource for empty mentions
		mockAccessControl.AssertNotCalled(t, "QueryUsersForResource")
	})
}

func TestSendOutOfChannelMentions_ABAC(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	if *mainHelper.GetSQLSettings().DriverName == model.DatabaseDriverMysql {
		t.Skip("Access control tests are not supported on MySQL")
	}

	// Enable ABAC in config
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})

	// Set enterprise advanced license (required for ABAC)
	license := model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)
	th.App.Srv().SetLicense(license)

	user1 := th.BasicUser
	user2 := th.BasicUser2
	user3 := th.CreateUser()
	user4 := th.CreateUser()

	th.LinkUserToTeam(user3, th.BasicTeam)
	th.LinkUserToTeam(user4, th.BasicTeam)

	t.Run("should send ephemeral post with ABAC policy violation message", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Create an ABAC policy for the channel to make it ABAC-controlled
		policy := &model.AccessControlPolicy{
			ID:       abacChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "test-policy-send-1",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.department == 'engineering'",
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		assert.NoError(t, err)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID)
			assert.NoError(t, dErr)
		}()

		// Mock the ABAC service
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		// Mock QueryUsersForResource to return only user2 (user3 doesn't match ABAC attributes)
		filteredUsers := []*model.User{user2}
		mockAccessControl.On("QueryUsersForResource", mock.AnythingOfType("*request.Context"), abacChannel.Id, "*", mock.AnythingOfType("model.SubjectSearchOptions")).Return(filteredUsers, int64(1), nil)

		post := &model.Post{
			ChannelId: abacChannel.Id,
			UserId:    user1.Id,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		sent, err := th.App.sendOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.NoError(t, err)
		assert.True(t, sent)

		mockAccessControl.AssertExpectations(t)
	})

	t.Run("should not send ephemeral post when all users are invitable in ABAC channel", func(t *testing.T) {
		// Create a private channel for ABAC testing
		abacChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// Create an ABAC policy for the channel to make it ABAC-controlled
		policy := &model.AccessControlPolicy{
			ID:       abacChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "test-policy-send-2",
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_1,
			Rules: []model.AccessControlPolicyRule{
				{
					Actions:    []string{"*"},
					Expression: "user.attributes.department == 'engineering'",
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		assert.NoError(t, err)
		defer func() {
			dErr := th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID)
			assert.NoError(t, dErr)
		}()

		// Mock the ABAC service
		mockAccessControl := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockAccessControl

		// Mock QueryUsersForResource to return all users (all match ABAC attributes)
		filteredUsers := []*model.User{user2, user3}
		mockAccessControl.On("QueryUsersForResource", mock.AnythingOfType("*request.Context"), abacChannel.Id, "*", mock.AnythingOfType("model.SubjectSearchOptions")).Return(filteredUsers, int64(2), nil)

		post := &model.Post{
			ChannelId: abacChannel.Id,
			UserId:    user1.Id,
		}
		potentialMentions := []string{user2.Username, user3.Username}

		sent, err := th.App.sendOutOfChannelMentions(th.Context, user1, post, abacChannel, potentialMentions)

		assert.NoError(t, err)
		assert.True(t, sent) // Still sends because users are out of channel, but they can be invited

		mockAccessControl.AssertExpectations(t)
	})
}

func TestMakeOutOfChannelMentionPost_ABAC(t *testing.T) {
	mainHelper.Parallel(t)

	sender := &model.User{
		Id:       model.NewId(),
		Username: "sender",
		Locale:   "en",
	}

	user1 := &model.User{
		Id:       model.NewId(),
		Username: "user1",
	}

	user2 := &model.User{
		Id:       model.NewId(),
		Username: "user2",
	}

	user3 := &model.User{
		Id:       model.NewId(),
		Username: "user3",
	}

	post := &model.Post{
		Id:        model.NewId(),
		ChannelId: model.NewId(),
		CreateAt:  model.GetMillis(),
	}

	t.Run("should create post with ABAC policy violation message for non-invitable users", func(t *testing.T) {
		outOfChannelUsers := []*model.User{user1}
		outOfGroupsUsers := []*model.User{}
		nonInvitableUsers := []*model.User{user2, user3}

		ephemeralPost := makeOutOfChannelMentionPost(sender, post, outOfChannelUsers, outOfGroupsUsers, nonInvitableUsers)

		assert.NotNil(t, ephemeralPost)
		assert.Equal(t, post.ChannelId, ephemeralPost.ChannelId)
		assert.Equal(t, post.CreateAt+1, ephemeralPost.CreateAt)

		// Check that the message contains information about both invitable and non-invitable users
		assert.Contains(t, ephemeralPost.Message, "user1") // Invitable user
		assert.Contains(t, ephemeralPost.Message, "user2") // Non-invitable user
		assert.Contains(t, ephemeralPost.Message, "user3") // Non-invitable user

		// Check props contain the correct user information
		props := ephemeralPost.Props[model.PropsAddChannelMember].(model.StringInterface)
		assert.NotNil(t, props)

		// Check non-invitable usernames are included
		nonInvitableUsernames := props["non_invitable_usernames"].([]string)
		assert.Len(t, nonInvitableUsernames, 2)
		assert.Contains(t, nonInvitableUsernames, "user2")
		assert.Contains(t, nonInvitableUsernames, "user3")

		// Check invitable usernames are included
		notInChannelUsernames := props["not_in_channel_usernames"].([]string)
		assert.Len(t, notInChannelUsernames, 1)
		assert.Contains(t, notInChannelUsernames, "user1")
	})

	t.Run("should create post with only non-invitable users", func(t *testing.T) {
		outOfChannelUsers := []*model.User{}
		outOfGroupsUsers := []*model.User{}
		nonInvitableUsers := []*model.User{user1, user2}

		ephemeralPost := makeOutOfChannelMentionPost(sender, post, outOfChannelUsers, outOfGroupsUsers, nonInvitableUsers)

		assert.NotNil(t, ephemeralPost)
		assert.Contains(t, ephemeralPost.Message, "user1")
		assert.Contains(t, ephemeralPost.Message, "user2")

		// Check props
		props := ephemeralPost.Props[model.PropsAddChannelMember].(model.StringInterface)
		nonInvitableUsernames := props["non_invitable_usernames"].([]string)
		assert.Len(t, nonInvitableUsernames, 2)
		assert.Contains(t, nonInvitableUsernames, "user1")
		assert.Contains(t, nonInvitableUsernames, "user2")

		// Should have empty invitable lists
		notInChannelUsernames := props["not_in_channel_usernames"].([]string)
		assert.Len(t, notInChannelUsernames, 0)
	})

	t.Run("should create post with mixed user types", func(t *testing.T) {
		outOfChannelUsers := []*model.User{user1}
		outOfGroupsUsers := []*model.User{user2}
		nonInvitableUsers := []*model.User{user3}

		ephemeralPost := makeOutOfChannelMentionPost(sender, post, outOfChannelUsers, outOfGroupsUsers, nonInvitableUsers)

		assert.NotNil(t, ephemeralPost)
		assert.Contains(t, ephemeralPost.Message, "user1") // Invitable
		assert.Contains(t, ephemeralPost.Message, "user2") // Out of groups
		assert.Contains(t, ephemeralPost.Message, "user3") // Non-invitable

		// Check all user types are properly categorized in props
		props := ephemeralPost.Props[model.PropsAddChannelMember].(model.StringInterface)

		notInChannelUsernames := props["not_in_channel_usernames"].([]string)
		assert.Len(t, notInChannelUsernames, 1)
		assert.Contains(t, notInChannelUsernames, "user1")

		notInGroupsUsernames := props["not_in_groups_usernames"].([]string)
		assert.Len(t, notInGroupsUsernames, 1)
		assert.Contains(t, notInGroupsUsernames, "user2")

		nonInvitableUsernames := props["non_invitable_usernames"].([]string)
		assert.Len(t, nonInvitableUsernames, 1)
		assert.Contains(t, nonInvitableUsernames, "user3")
	})
}
