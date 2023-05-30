// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func TestSaveReaction(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
		rr, _, err := client.SaveReaction(context.Background(), reaction)
		require.NoError(t, err)
		require.Equal(t, reaction.UserId, rr.UserId, "UserId did not match")
		require.Equal(t, reaction.PostId, rr.PostId, "PostId did not match")
		require.Equal(t, reaction.EmojiName, rr.EmojiName, "EmojiName did not match")
		require.NotEqual(t, 0, rr.CreateAt, "CreateAt should exist")

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "didn't save reaction correctly")
	})

	t.Run("duplicated-reaction", func(t *testing.T) {
		_, _, err := client.SaveReaction(context.Background(), reaction)
		require.NoError(t, err)
		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have not save duplicated reaction")
	})

	t.Run("save-second-reaction", func(t *testing.T) {
		reaction.EmojiName = "sad"

		rr, _, err := client.SaveReaction(context.Background(), reaction)
		require.NoError(t, err)
		require.Equal(t, rr.EmojiName, reaction.EmojiName, "EmojiName did not match")

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr, "error saving multiple reactions")
		require.Equal(t, len(reactions), 2, "should have save multiple reactions")
	})

	t.Run("saving-special-case", func(t *testing.T) {
		reaction.EmojiName = "+1"

		rr, _, err := client.SaveReaction(context.Background(), reaction)
		require.NoError(t, err)
		require.Equal(t, reaction.EmojiName, rr.EmojiName, "EmojiName did not match")

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 3, len(reactions), "should have save multiple reactions")
	})

	t.Run("react-to-not-existing-post-id", func(t *testing.T) {
		reaction.PostId = GenerateTestId()

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("react-to-not-valid-post-id", func(t *testing.T) {
		reaction.PostId = "junk"

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-not-existing-user-id", func(t *testing.T) {
		reaction.PostId = postId
		reaction.UserId = GenerateTestId()

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("react-as-not-valid-user-id", func(t *testing.T) {
		reaction.UserId = "junk"

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-empty-emoji-name", func(t *testing.T) {
		reaction.UserId = userId
		reaction.EmojiName = ""

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-not-valid-emoji-name", func(t *testing.T) {
		reaction.EmojiName = strings.Repeat("a", 65)

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("react-as-other-user", func(t *testing.T) {
		reaction.EmojiName = "smile"
		otherUser := th.CreateUser()
		client.Logout(context.Background())
		client.Login(context.Background(), otherUser.Email, otherUser.Password)

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("react-being-not-logged-in", func(t *testing.T) {
		client.Logout(context.Background())
		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("react-as-other-user-being-system-admin", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unable-to-create-reaction-without-permissions", func(t *testing.T) {
		th.LoginBasic()

		th.RemovePermissionFromRole(model.PermissionAddReaction.Id, model.ChannelUserRoleId)
		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 3, len(reactions), "should have not created a reactions")
		th.AddPermissionToRole(model.PermissionAddReaction.Id, model.ChannelUserRoleId)
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

		appErr := th.App.DeleteChannel(th.Context, channel, userId)
		assert.Nil(t, appErr)

		_, resp, err := client.SaveReaction(context.Background(), reaction)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		reactions, appErr := th.App.GetReactionsForPost(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(reactions), "should have not created a reaction")
	})
}

func TestGetReactions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
		reaction, err := th.App.Srv().Store().Reaction().Save(userReaction)
		require.NoError(t, err)
		reactions = append(reactions, reaction)
	}

	t.Run("get-reactions", func(t *testing.T) {
		rr, _, err := client.GetReactions(context.Background(), postId)
		require.NoError(t, err)

		assert.Len(t, rr, 5)
		for _, r := range reactions {
			assert.Contains(t, reactions, r)
		}
	})

	t.Run("get-reactions-of-invalid-post-id", func(t *testing.T) {
		rr, resp, err := client.GetReactions(context.Background(), "junk")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		assert.Empty(t, rr)
	})

	t.Run("get-reactions-of-not-existing-post-id", func(t *testing.T) {
		_, resp, err := client.GetReactions(context.Background(), GenerateTestId())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get-reactions-as-anonymous-user", func(t *testing.T) {
		client.Logout(context.Background())

		_, resp, err := client.GetReactions(context.Background(), postId)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("get-reactions-as-system-admin", func(t *testing.T) {
		_, _, err := th.SystemAdminClient.GetReactions(context.Background(), postId)
		require.NoError(t, err)
	})
}

func TestDeleteReaction(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
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
		th.App.SaveReactionForPost(th.Context, r1)
		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "didn't save reaction correctly")

		_, err := client.DeleteReaction(context.Background(), r1)
		require.NoError(t, err)

		reactions, appErr = th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(reactions), "should have deleted reaction")
	})

	t.Run("delete-reaction-when-post-has-multiple-reactions", func(t *testing.T) {
		th.App.SaveReactionForPost(th.Context, r1)
		th.App.SaveReactionForPost(th.Context, r2)
		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, len(reactions), 2, "didn't save reactions correctly")

		_, err := client.DeleteReaction(context.Background(), r2)
		require.NoError(t, err)

		reactions, appErr = th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have deleted only 1 reaction")
		require.Equal(t, *r1, *reactions[0], "should have deleted 1 reaction only")
	})

	t.Run("delete-reaction-when-plus-one-reaction-name", func(t *testing.T) {
		th.App.SaveReactionForPost(th.Context, r3)
		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(reactions), "didn't save reactions correctly")

		_, err := client.DeleteReaction(context.Background(), r3)
		require.NoError(t, err)

		reactions, appErr = th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have deleted 1 reaction only")
		require.Equal(t, *r1, *reactions[0], "should have deleted 1 reaction only")
	})

	t.Run("delete-reaction-made-by-another-user", func(t *testing.T) {
		th.LoginBasic2()
		th.App.SaveReactionForPost(th.Context, r4)
		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(reactions), "didn't save reaction correctly")

		th.LoginBasic()

		resp, err := client.DeleteReaction(context.Background(), r4)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		reactions, appErr = th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 2, len(reactions), "should have not deleted a reaction")
	})

	t.Run("delete-reaction-from-not-existing-post-id", func(t *testing.T) {
		r1.PostId = GenerateTestId()
		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete-reaction-from-not-valid-post-id", func(t *testing.T) {
		r1.PostId = "junk"

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete-reaction-from-not-existing-user-id", func(t *testing.T) {
		r1.PostId = postId
		r1.UserId = GenerateTestId()

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete-reaction-from-not-valid-user-id", func(t *testing.T) {
		r1.UserId = "junk"

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete-reaction-with-empty-name", func(t *testing.T) {
		r1.UserId = userId
		r1.EmojiName = ""

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("delete-reaction-with-not-existing-name", func(t *testing.T) {
		r1.EmojiName = strings.Repeat("a", 65)

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete-reaction-as-anonymous-user", func(t *testing.T) {
		client.Logout(context.Background())
		r1.EmojiName = "smile"

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("delete-reaction-as-system-admin", func(t *testing.T) {
		_, err := th.SystemAdminClient.DeleteReaction(context.Background(), r1)
		require.NoError(t, err)

		_, err = th.SystemAdminClient.DeleteReaction(context.Background(), r4)
		require.NoError(t, err)

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 0, len(reactions), "should have deleted both reactions")
	})

	t.Run("unable-to-delete-reaction-without-permissions", func(t *testing.T) {
		th.LoginBasic()

		th.RemovePermissionFromRole(model.PermissionRemoveReaction.Id, model.ChannelUserRoleId)
		th.App.SaveReactionForPost(th.Context, r1)

		resp, err := client.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have not deleted a reactions")
		th.AddPermissionToRole(model.PermissionRemoveReaction.Id, model.ChannelUserRoleId)
	})

	t.Run("unable-to-delete-others-reactions-without-permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PermissionRemoveOthersReactions.Id, model.SystemAdminRoleId)
		th.App.SaveReactionForPost(th.Context, r1)

		resp, err := th.SystemAdminClient.DeleteReaction(context.Background(), r1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have not deleted a reactions")
		th.AddPermissionToRole(model.PermissionRemoveOthersReactions.Id, model.SystemAdminRoleId)
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

		r1, _, err := client.SaveReaction(context.Background(), reaction)
		require.NoError(t, err)

		reactions, appErr := th.App.GetReactionsForPost(postId)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have created a reaction")

		appErr = th.App.DeleteChannel(th.Context, channel, userId)
		assert.Nil(t, appErr)

		_, resp, err := client.SaveReaction(context.Background(), r1)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		reactions, appErr = th.App.GetReactionsForPost(post.Id)
		require.Nil(t, appErr)
		require.Equal(t, 1, len(reactions), "should have not deleted a reaction")
	})
}

func TestGetBulkReactions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	userId := th.BasicUser.Id
	user2Id := th.BasicUser2.Id
	post1 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post2 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post3 := &model.Post{UserId: userId, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}

	post4 := &model.Post{UserId: user2Id, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}
	post5 := &model.Post{UserId: user2Id, ChannelId: th.BasicChannel.Id, Message: "zz" + model.NewId() + "a"}

	post1, _, _ = client.CreatePost(context.Background(), post1)
	post2, _, _ = client.CreatePost(context.Background(), post2)
	post3, _, _ = client.CreatePost(context.Background(), post3)
	post4, _, _ = client.CreatePost(context.Background(), post4)
	post5, _, _ = client.CreatePost(context.Background(), post5)

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
		reaction, err := th.App.Srv().Store().Reaction().Save(userReaction)
		require.NoError(t, err)
		reactions = append(reactions, reaction)
		expectedPostIdsReactionsMap[userReaction.PostId] = reactions
	}

	postIds := []string{post1.Id, post2.Id, post3.Id, post4.Id, post5.Id}

	t.Run("get-reactions", func(t *testing.T) {
		postIdsReactionsMap, _, err := client.GetBulkReactions(context.Background(), postIds)
		require.NoError(t, err)

		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post1.Id], postIdsReactionsMap[post1.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post2.Id], postIdsReactionsMap[post2.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post3.Id], postIdsReactionsMap[post3.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post4.Id], postIdsReactionsMap[post4.Id])
		assert.ElementsMatch(t, expectedPostIdsReactionsMap[post5.Id], postIdsReactionsMap[post5.Id])
		assert.Equal(t, expectedPostIdsReactionsMap, postIdsReactionsMap)

	})

	t.Run("get-reactions-as-anonymous-user", func(t *testing.T) {
		client.Logout(context.Background())

		_, resp, err := client.GetBulkReactions(context.Background(), postIds)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
