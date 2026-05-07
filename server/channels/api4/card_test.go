// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCardAPIRequiresCardPost(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	regularPost := th.CreatePost(t)

	t.Run("delete non-card via cards API", func(t *testing.T) {
		resp, err := th.Client.DeleteCard(context.Background(), regularPost.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch non-card via cards API", func(t *testing.T) {
		patch := &model.PostPatch{Message: model.NewPointer("nope")}
		_, resp, err := th.Client.PatchCard(context.Background(), regularPost.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update non-card via cards API", func(t *testing.T) {
		updated := regularPost.Clone()
		updated.Message = "nope"
		_, resp, err := th.Client.UpdateCard(context.Background(), regularPost.Id, updated)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("edit history non-card via cards API", func(t *testing.T) {
		_, resp, err := th.Client.GetCardEditHistoryForPost(context.Background(), regularPost.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestCardAPIRequiresIntegratedBoardsFeature(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = false
	}).InitBasic(t)

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "card via API",
	}
	_, resp, err := th.Client.CreateCard(context.Background(), post)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestCreateCardSucceedsWhenIntegratedBoardsEnabled(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "card post",
	}
	rpost, resp, err := th.Client.CreateCard(context.Background(), post)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.NotNil(t, rpost)
	assert.Equal(t, model.PostTypeCard, rpost.Type)
	assert.Equal(t, "card post", rpost.Message)
}

func TestCardAPIUpdateByNonOwner(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "original card message",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	th.LoginBasic2(t)
	updatedPost := cardPost.Clone()
	updatedPost.Message = "updated by user2"
	rpost, _, err := th.Client.UpdateCard(context.Background(), cardPost.Id, updatedPost)
	require.NoError(t, err)
	assert.Equal(t, "updated by user2", rpost.Message)
}

func TestCardAPIDeleteByNonOwner(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "card to delete",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	th.LoginBasic2(t)
	_, err := th.Client.DeleteCard(context.Background(), cardPost.Id)
	require.NoError(t, err)

	_, resp, err := th.Client.GetPost(context.Background(), cardPost.Id, "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestCardAPIPatchByNonOwner(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "original card for patching",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	th.LoginBasic2(t)
	patch := &model.PostPatch{
		Message: model.NewPointer("patched by user2"),
	}
	rpost, _, err := th.Client.PatchCard(context.Background(), cardPost.Id, patch)
	require.NoError(t, err)
	assert.Equal(t, "patched by user2", rpost.Message)

	t.Run("user not in channel cannot patch card", func(t *testing.T) {
		user := th.CreateUser(t)
		cli := th.CreateClient()
		_, _, err := cli.Login(context.Background(), user.Email, user.Password)
		require.NoError(t, err)

		badPatch := &model.PostPatch{
			Message: model.NewPointer("should fail"),
		}
		_, resp, err := cli.PatchCard(context.Background(), cardPost.Id, badPatch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
