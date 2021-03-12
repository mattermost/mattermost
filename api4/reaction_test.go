// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestSaveReaction(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	postId := th.BasicPost.Id

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	reaction := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "smile",
	}

	t.Run("successful-reaction", func(t *testing.T) {
		rr, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)
		require.Equal(t, reaction.UserId, rr.UserId, "UserId did not match")
		require.Equal(t, reaction.PostId, rr.PostId, "PostId did not match")
		require.Equal(t, reaction.EmojiName, rr.EmojiName, "EmojiName did not match")
		require.NotEqual(t, 0, rr.CreateAt, "CreateAt should exist")

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "didn't save reaction correctly")
	})

	t.Run("duplicated-reaction", func(t *testing.T) {
		_, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)
		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have not save duplicated reaction")
	})

	t.Run("save-second-reaction", func(t *testing.T) {
		reaction.EmojiName = "sad"

		rr, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)
		require.Equal(t, rr.EmojiName, reaction.EmojiName, "EmojiName did not match")

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err, "error saving multiple reactions")
		require.Equal(t, len(reactions), 2, "should have save multiple reactions")
	})

	t.Run("saving-special-case", func(t *testing.T) {
		reaction.EmojiName = "+1"

		rr, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)
		require.Equal(t, reaction.EmojiName, rr.EmojiName, "EmojiName did not match")

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 3, len(reactions), "should have save multiple reactions")
	})

	t.Run("react-to-not-existing-post-id", func(t *testing.T) {
		reaction.PostId = GenerateTestId()

		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("react-to-not-valid-post-id", func(t *testing.T) {
		reaction.PostId = "junk"

		_, resp := Client.SaveReaction(reaction)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-not-existing-user-id", func(t *testing.T) {
		reaction.PostId = postId
		reaction.UserId = GenerateTestId()

		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("react-as-not-valid-user-id", func(t *testing.T) {
		reaction.UserId = "junk"

		_, resp := Client.SaveReaction(reaction)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-empty-emoji-name", func(t *testing.T) {
		reaction.UserId = userId
		reaction.EmojiName = ""

		_, resp := Client.SaveReaction(reaction)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-not-valid-emoji-name", func(t *testing.T) {
		reaction.EmojiName = strings.Repeat("a", 65)

		_, resp := Client.SaveReaction(reaction)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-other-user", func(t *testing.T) {
		reaction.EmojiName = "smile"
		otherUser := th.CreateUser()
		Client.Logout()
		Client.Login(otherUser.Email, otherUser.Password)

		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("react-being-not-logged-in", func(t *testing.T) {
		Client.Logout()
		_, resp := Client.SaveReaction(reaction)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("react-as-other-user-being-system-admin", func(t *testing.T) {
		_, resp := th.SystemAdminClient.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unable-to-create-reaction-without-permissions", func(t *testing.T) {
		th.LoginBasic()

		th.RemovePermissionFromRole(model.PERMISSION_ADD_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 3, len(reactions), "should have not created a reactions")
		th.AddPermissionToRole(model.PERMISSION_ADD_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
	})

	t.Run("unable-to-react-in-read-only-town-square", func(t *testing.T) {
		th.LoginBasic()

		channel, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, true)
		assert.Nil(t, err)
		post := th.CreatePostWithClient(th.Client, channel)

		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })

		reaction := &model.Reaction{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)

		reactions, err := th.App.GetReactionsForPost(post.Id)
		require.Nil(t, err)
		require.Equal(t, 0, len(reactions), "should have not created a reaction")

		th.App.Srv().RemoveLicense()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = false })
	})

	t.Run("unable-to-react-in-an-archived-channel", func(t *testing.T) {
		th.LoginBasic()

		channel := th.CreatePublicChannel()
		post := th.CreatePostWithClient(th.Client, channel)

		reaction := &model.Reaction{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		err := th.App.DeleteChannel(channel, userId)
		assert.Nil(t, err)

		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)

		reactions, err := th.App.GetReactionsForPost(post.Id)
		require.Nil(t, err)
		require.Equal(t, 0, len(reactions), "should have not created a reaction")
	})
}

func TestGetReactions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id
	postId := th.BasicPost.Id

	userReactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    postId,
			EmojiName: "sad",
		},
		{
			UserId:    user2Id,
			PostId:    postId,
			EmojiName: "smile",
		},
		{
			UserId:    user2Id,
			PostId:    postId,
			EmojiName: "sad",
		},
	}

	var reactions []*model.Reaction

	for _, userReaction := range userReactions {
		reaction, err := th.App.Srv().Store.Reaction().Save(userReaction)
		require.NoError(t, err)
		reactions = append(reactions, reaction)
	}

	t.Run("get-reactions", func(t *testing.T) {
		rr, resp := Client.GetReactions(postId)
		CheckNoError(t, resp)

		assert.Len(t, rr, 5)
		for _, r := range reactions {
			assert.Contains(t, reactions, r)
		}
	})

	t.Run("get-reactions-of-invalid-post-id", func(t *testing.T) {
		rr, resp := Client.GetReactions("junk")
		CheckBadRequestStatus(t, resp)

		assert.Empty(t, rr)
	})

	t.Run("get-reactions-of-not-existing-post-id", func(t *testing.T) {
		_, resp := Client.GetReactions(GenerateTestId())
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get-reactions-as-anonymous-user", func(t *testing.T) {
		Client.Logout()

		_, resp := Client.GetReactions(postId)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("get-reactions-as-system-admin", func(t *testing.T) {
		_, resp := th.SystemAdminClient.GetReactions(postId)
		CheckNoError(t, resp)
	})
}

func TestDeleteReaction(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id
	postId := th.BasicPost.Id

	r1 := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "smile",
	}

	r2 := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "smile-",
	}

	r3 := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: "+1",
	}

	r4 := &model.Reaction{
		UserId:    user2Id,
		PostId:    postId,
		EmojiName: "smile_",
	}

	// Check the appropriate permissions are enforced.
	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	t.Run("delete-reaction", func(t *testing.T) {
		th.App.SaveReactionForPost(r1)
		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "didn't save reaction correctly")

		ok, resp := Client.DeleteReaction(r1)
		CheckNoError(t, resp)

		require.True(t, ok, "should have returned true")

		reactions, err = th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 0, len(reactions), "should have deleted reaction")
	})

	t.Run("delete-reaction-when-post-has-multiple-reactions", func(t *testing.T) {
		th.App.SaveReactionForPost(r1)
		th.App.SaveReactionForPost(r2)
		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, len(reactions), 2, "didn't save reactions correctly")

		_, resp := Client.DeleteReaction(r2)
		CheckNoError(t, resp)

		reactions, err = th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have deleted only 1 reaction")
		require.Equal(t, *r1, *reactions[0], "should have deleted 1 reaction only")
	})

	t.Run("delete-reaction-when-plus-one-reaction-name", func(t *testing.T) {
		th.App.SaveReactionForPost(r3)
		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 2, len(reactions), "didn't save reactions correctly")

		_, resp := Client.DeleteReaction(r3)
		CheckNoError(t, resp)

		reactions, err = th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have deleted 1 reaction only")
		require.Equal(t, *r1, *reactions[0], "should have deleted 1 reaction only")
	})

	t.Run("delete-reaction-made-by-another-user", func(t *testing.T) {
		th.LoginBasic2()
		th.App.SaveReactionForPost(r4)
		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 2, len(reactions), "didn't save reaction correctly")

		th.LoginBasic()

		ok, resp := Client.DeleteReaction(r4)
		CheckForbiddenStatus(t, resp)

		require.False(t, ok, "should have returned false")

		reactions, err = th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 2, len(reactions), "should have not deleted a reaction")
	})

	t.Run("delete-reaction-from-not-existing-post-id", func(t *testing.T) {
		r1.PostId = GenerateTestId()
		_, resp := Client.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete-reaction-from-not-valid-post-id", func(t *testing.T) {
		r1.PostId = "junk"

		_, resp := Client.DeleteReaction(r1)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete-reaction-from-not-existing-user-id", func(t *testing.T) {
		r1.PostId = postId
		r1.UserId = GenerateTestId()

		_, resp := Client.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete-reaction-from-not-valid-user-id", func(t *testing.T) {
		r1.UserId = "junk"

		_, resp := Client.DeleteReaction(r1)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete-reaction-with-empty-name", func(t *testing.T) {
		r1.UserId = userId
		r1.EmojiName = ""

		_, resp := Client.DeleteReaction(r1)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("delete-reaction-with-not-existing-name", func(t *testing.T) {
		r1.EmojiName = strings.Repeat("a", 65)

		_, resp := Client.DeleteReaction(r1)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete-reaction-as-anonymous-user", func(t *testing.T) {
		Client.Logout()
		r1.EmojiName = "smile"

		_, resp := Client.DeleteReaction(r1)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("delete-reaction-as-system-admin", func(t *testing.T) {
		_, resp := th.SystemAdminClient.DeleteReaction(r1)
		CheckNoError(t, resp)

		_, resp = th.SystemAdminClient.DeleteReaction(r4)
		CheckNoError(t, resp)

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 0, len(reactions), "should have deleted both reactions")
	})

	t.Run("unable-to-delete-reaction-without-permissions", func(t *testing.T) {
		th.LoginBasic()

		th.RemovePermissionFromRole(model.PERMISSION_REMOVE_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
		th.App.SaveReactionForPost(r1)

		_, resp := Client.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have not deleted a reactions")
		th.AddPermissionToRole(model.PERMISSION_REMOVE_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
	})

	t.Run("unable-to-delete-others-reactions-without-permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id, model.SYSTEM_ADMIN_ROLE_ID)
		th.App.SaveReactionForPost(r1)

		_, resp := th.SystemAdminClient.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have not deleted a reactions")
		th.AddPermissionToRole(model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id, model.SYSTEM_ADMIN_ROLE_ID)
	})

	t.Run("unable-to-delete-reactions-in-read-only-town-square", func(t *testing.T) {
		th.LoginBasic()

		channel, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, true)
		assert.Nil(t, err)
		post := th.CreatePostWithClient(th.Client, channel)

		th.App.Srv().SetLicense(model.NewTestLicense())

		reaction := &model.Reaction{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		r1, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have created a reaction")

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })

		_, resp = th.SystemAdminClient.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)

		reactions, err = th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have not deleted a reaction")

		th.App.Srv().RemoveLicense()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = false })
	})

	t.Run("unable-to-delete-reactions-in-an-archived-channel", func(t *testing.T) {
		th.LoginBasic()

		channel := th.CreatePublicChannel()
		post := th.CreatePostWithClient(th.Client, channel)

		reaction := &model.Reaction{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		r1, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)

		reactions, err := th.App.GetReactionsForPost(postId)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have created a reaction")

		err = th.App.DeleteChannel(channel, userId)
		assert.Nil(t, err)

		_, resp = Client.SaveReaction(r1)
		CheckForbiddenStatus(t, resp)

		reactions, err = th.App.GetReactionsForPost(post.Id)
		require.Nil(t, err)
		require.Equal(t, 1, len(reactions), "should have not deleted a reaction")
	})
}

func TestGetBulkReactions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id
	post1 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post2 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post3 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}

	post4 := &model.Post{UserId: user2Id, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post5 := &model.Post{UserId: user2Id, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}

	post1, _ = Client.CreatePost(post1)
	post2, _ = Client.CreatePost(post2)
	post3, _ = Client.CreatePost(post3)
	post4, _ = Client.CreatePost(post4)
	post5, _ = Client.CreatePost(post5)

	expectedPostIdsReactionsMap := make(map[string][]*model.Reaction)
	expectedPostIdsReactionsMap[post1.Id] = []*model.Reaction{}
	expectedPostIdsReactionsMap[post2.Id] = []*model.Reaction{}
	expectedPostIdsReactionsMap[post3.Id] = []*model.Reaction{}
	expectedPostIdsReactionsMap[post5.Id] = []*model.Reaction{}

	userReactions := []*model.Reaction{
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "happy",
		},
		{
			UserId:    userId,
			PostId:    post1.Id,
			EmojiName: "sad",
		},
		{
			UserId:    userId,
			PostId:    post2.Id,
			EmojiName: "smile",
		},
		{
			UserId:    user2Id,
			PostId:    post4.Id,
			EmojiName: "smile",
		},
	}

	for _, userReaction := range userReactions {
		reactions := expectedPostIdsReactionsMap[userReaction.PostId]
		reaction, err := th.App.Srv().Store.Reaction().Save(userReaction)
		require.NoError(t, err)
		reactions = append(reactions, reaction)
		expectedPostIdsReactionsMap[userReaction.PostId] = reactions
	}

	postIds := []string{post1.Id, post2.Id, post3.Id, post4.Id, post5.Id}

	t.Run("get-reactions", func(t *testing.T) {
		postIdsReactionsMap, resp := Client.GetBulkReactions(postIds)
		CheckNoError(t, resp)

		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post1.Id], postIdsReactionsMap[post1.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post2.Id], postIdsReactionsMap[post2.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post3.Id], postIdsReactionsMap[post3.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post4.Id], postIdsReactionsMap[post4.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post5.Id], postIdsReactionsMap[post5.Id])
		assert.Equal(t, expectedPostIdsReactionsMap, postIdsReactionsMap)

	})

	t.Run("get-reactions-as-anonymous-user", func(t *testing.T) {
		Client.Logout()

		_, resp := Client.GetBulkReactions(postIds)
		CheckUnauthorizedStatus(t, resp)
	})
}
