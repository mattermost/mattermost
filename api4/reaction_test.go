// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestSaveReaction(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
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

		if rr.UserId != reaction.UserId {
			t.Fatal("UserId did not match")
		}

		if rr.PostId != reaction.PostId {
			t.Fatal("PostId did not match")
		}

		if rr.EmojiName != reaction.EmojiName {
			t.Fatal("EmojiName did not match")
		}

		if rr.CreateAt == 0 {
			t.Fatal("CreateAt should exist")
		}

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 1 {
			t.Fatal("didn't save reaction correctly")
		}
	})

	t.Run("duplicated-reaction", func(t *testing.T) {
		_, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 1 {
			t.Fatal("should have not save duplicated reaction")
		}
	})

	t.Run("save-second-reaction", func(t *testing.T) {
		reaction.EmojiName = "sad"

		rr, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)

		if rr.EmojiName != reaction.EmojiName {
			t.Fatal("EmojiName did not match")
		}

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 2 {
			t.Fatal("should have save multiple reactions")
		}
	})

	t.Run("saving-special-case", func(t *testing.T) {
		reaction.EmojiName = "+1"

		rr, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)

		if rr.EmojiName != reaction.EmojiName {
			t.Fatal("EmojiName did not match")
		}

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil && len(reactions) != 3 {
			t.Fatal("should have save multiple reactions")
		}
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

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 3 {
			t.Fatal("should have not created a reactions")
		}
		th.AddPermissionToRole(model.PERMISSION_ADD_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
	})

	t.Run("unable-to-react-in-read-only-town-square", func(t *testing.T) {
		th.LoginBasic()

		channel, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, true)
		assert.Nil(t, err)
		post := th.CreatePostWithClient(th.Client, channel)

		th.App.SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })

		reaction := &model.Reaction{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		_, resp := Client.SaveReaction(reaction)
		CheckForbiddenStatus(t, resp)

		if reactions, err := th.App.GetReactionsForPost(post.Id); err != nil || len(reactions) != 0 {
			t.Fatal("should have not created a reaction")
		}

		th.App.RemoveLicense()
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

		if reactions, err := th.App.GetReactionsForPost(post.Id); err != nil || len(reactions) != 0 {
			t.Fatal("should have not created a reaction")
		}
	})
}

func TestGetReactions(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
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
		if result := <-th.App.Srv.Store.Reaction().Save(userReaction); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			reactions = append(reactions, result.Data.(*model.Reaction))
		}
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
	th := Setup().InitBasic().InitSystemAdmin()
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
		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
			t.Fatal("didn't save reaction correctly")
		}

		ok, resp := Client.DeleteReaction(r1)
		CheckNoError(t, resp)

		if !ok {
			t.Fatal("should have returned true")
		}

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 0 {
			t.Fatal("should have deleted reaction")
		}
	})

	t.Run("delete-reaction-when-post-has-multiple-reactions", func(t *testing.T) {
		th.App.SaveReactionForPost(r1)
		th.App.SaveReactionForPost(r2)
		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
			t.Fatal("didn't save reactions correctly")
		}

		_, resp := Client.DeleteReaction(r2)
		CheckNoError(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 || *reactions[0] != *r1 {
			t.Fatal("should have deleted 1 reaction only")
		}
	})

	t.Run("delete-reaction-when-plus-one-reaction-name", func(t *testing.T) {
		th.App.SaveReactionForPost(r3)
		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
			t.Fatal("didn't save reactions correctly")
		}

		_, resp := Client.DeleteReaction(r3)
		CheckNoError(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 || *reactions[0] != *r1 {
			t.Fatal("should have deleted 1 reaction only")
		}
	})

	t.Run("delete-reaction-made-by-another-user", func(t *testing.T) {
		th.LoginBasic2()
		th.App.SaveReactionForPost(r4)
		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
			t.Fatal("didn't save reaction correctly")
		}

		th.LoginBasic()

		ok, resp := Client.DeleteReaction(r4)
		CheckForbiddenStatus(t, resp)

		if ok {
			t.Fatal("should have returned false")
		}

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 2 {
			t.Fatal("should have not deleted a reaction")
		}
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

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 0 {
			t.Fatal("should have deleted both reactions")
		}
	})

	t.Run("unable-to-delete-reaction-without-permissions", func(t *testing.T) {
		th.LoginBasic()

		th.RemovePermissionFromRole(model.PERMISSION_REMOVE_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
		th.App.SaveReactionForPost(r1)

		_, resp := Client.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
			t.Fatal("should have not deleted a reactions")
		}
		th.AddPermissionToRole(model.PERMISSION_REMOVE_REACTION.Id, model.CHANNEL_USER_ROLE_ID)
	})

	t.Run("unable-to-delete-others-reactions-without-permissions", func(t *testing.T) {
		th.RemovePermissionFromRole(model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id, model.SYSTEM_ADMIN_ROLE_ID)
		th.App.SaveReactionForPost(r1)

		_, resp := th.SystemAdminClient.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
			t.Fatal("should have not deleted a reactions")
		}
		th.AddPermissionToRole(model.PERMISSION_REMOVE_OTHERS_REACTIONS.Id, model.SYSTEM_ADMIN_ROLE_ID)
	})

	t.Run("unable-to-delete-reactions-in-read-only-town-square", func(t *testing.T) {
		th.LoginBasic()

		channel, err := th.App.GetChannelByName("town-square", th.BasicTeam.Id, true)
		assert.Nil(t, err)
		post := th.CreatePostWithClient(th.Client, channel)

		th.App.SetLicense(model.NewTestLicense())

		reaction := &model.Reaction{
			UserId:    userId,
			PostId:    post.Id,
			EmojiName: "smile",
		}

		r1, resp := Client.SaveReaction(reaction)
		CheckNoError(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
			t.Fatal("should have created a reaction")
		}

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })

		_, resp = th.SystemAdminClient.DeleteReaction(r1)
		CheckForbiddenStatus(t, resp)

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
			t.Fatal("should have not deleted a reaction")
		}

		th.App.RemoveLicense()
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

		if reactions, err := th.App.GetReactionsForPost(postId); err != nil || len(reactions) != 1 {
			t.Fatal("should have created a reaction")
		}

		err := th.App.DeleteChannel(channel, userId)
		assert.Nil(t, err)

		_, resp = Client.SaveReaction(r1)
		CheckForbiddenStatus(t, resp)

		if reactions, err := th.App.GetReactionsForPost(post.Id); err != nil || len(reactions) != 1 {
			t.Fatal("should have not deleted a reaction")
		}
	})
}
