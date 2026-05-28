// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"
	"time"

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

func TestCardAPIChecksChannelAccessBeforeType(t *testing.T) {
	// Channel ACL must be enforced before the card-type check; otherwise a
	// caller without access can distinguish "exists and is a card" from
	// "exists and is a regular post" by the response (403 vs. 400).
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Private channel that BasicUser2 is NOT a member of. BasicUser is added
	// to BasicPrivateChannel2 via CreatePrivateChannel (creator). BasicUser2
	// is not added by InitBasic.
	privateChannel := th.BasicPrivateChannel2

	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: privateChannel.Id,
		Message:   "card in private",
		Type:      model.PostTypeCard,
	}, privateChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	regularPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: privateChannel.Id,
		Message:   "regular in private",
	}, privateChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	th.LoginBasic2(t)

	// Each endpoint must return the same status (403) for both posts so the
	// response can't be used to fingerprint the post type.
	t.Run("delete: card vs regular both 403", func(t *testing.T) {
		respCard, errCard := th.Client.DeleteCard(context.Background(), cardPost.Id)
		require.Error(t, errCard)
		CheckForbiddenStatus(t, respCard)

		respRegular, errRegular := th.Client.DeleteCard(context.Background(), regularPost.Id)
		require.Error(t, errRegular)
		CheckForbiddenStatus(t, respRegular)
	})

	t.Run("update: card vs regular both 403", func(t *testing.T) {
		updatedCard := cardPost.Clone()
		updatedCard.Message = "x"
		_, respCard, errCard := th.Client.UpdateCard(context.Background(), cardPost.Id, updatedCard)
		require.Error(t, errCard)
		CheckForbiddenStatus(t, respCard)

		updatedRegular := regularPost.Clone()
		updatedRegular.Message = "x"
		_, respRegular, errRegular := th.Client.UpdateCard(context.Background(), regularPost.Id, updatedRegular)
		require.Error(t, errRegular)
		CheckForbiddenStatus(t, respRegular)
	})

	t.Run("patch: card vs regular both 403", func(t *testing.T) {
		patch := &model.PostPatch{Message: model.NewPointer("x")}
		_, respCard, errCard := th.Client.PatchCard(context.Background(), cardPost.Id, patch)
		require.Error(t, errCard)
		CheckForbiddenStatus(t, respCard)

		_, respRegular, errRegular := th.Client.PatchCard(context.Background(), regularPost.Id, patch)
		require.Error(t, errRegular)
		CheckForbiddenStatus(t, respRegular)
	})

	t.Run("edit history: card vs regular both 403", func(t *testing.T) {
		_, respCard, errCard := th.Client.GetCardEditHistoryForPost(context.Background(), cardPost.Id)
		require.Error(t, errCard)
		CheckForbiddenStatus(t, respCard)

		_, respRegular, errRegular := th.Client.GetCardEditHistoryForPost(context.Background(), regularPost.Id)
		require.Error(t, errRegular)
		CheckForbiddenStatus(t, respRegular)
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

func TestCardAPIPreservesCardTypeOnMutations(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "card post",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	t.Run("update with different type in body keeps card type", func(t *testing.T) {
		updated := cardPost.Clone()
		updated.Message = "updated"
		updated.Type = model.PostTypeDefault
		rpost, _, err := th.Client.UpdateCard(context.Background(), cardPost.Id, updated)
		require.NoError(t, err)
		assert.Equal(t, model.PostTypeCard, rpost.Type)

		fetched, _, err := th.Client.GetPost(context.Background(), cardPost.Id, "")
		require.NoError(t, err)
		assert.Equal(t, model.PostTypeCard, fetched.Type)
	})

	t.Run("patch ignores type field in body (PostPatch has no Type)", func(t *testing.T) {
		patch := &model.PostPatch{Message: model.NewPointer("patched")}
		rpost, _, err := th.Client.PatchCard(context.Background(), cardPost.Id, patch)
		require.NoError(t, err)
		assert.Equal(t, model.PostTypeCard, rpost.Type)
	})
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
}

func TestPermanentDeleteCard(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	enableAPIPostDeletion := *th.App.Config().ServiceSettings.EnableAPIPostDeletion
	defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableAPIPostDeletion = &enableAPIPostDeletion })

	createCard := func(t *testing.T) *model.Post {
		card, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "card to permanently delete",
			Type:      model.PostTypeCard,
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		return card
	}

	t.Run("501 when EnableAPIPostDeletion is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIPostDeletion = false })
		card := createCard(t)

		resp, err := th.SystemAdminClient.PermanentDeleteCard(context.Background(), card.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("403 for non-admin user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIPostDeletion = true })
		card := createCard(t)

		resp, err := th.Client.PermanentDeleteCard(context.Background(), card.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("200 for system admin and post is gone", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableAPIPostDeletion = true })
		card := createCard(t)

		_, err := th.SystemAdminClient.PermanentDeleteCard(context.Background(), card.Id)
		require.NoError(t, err)

		// Even with includeDeleted=true the post should be gone from the store.
		_, appErr := th.App.GetSinglePost(th.Context, card.Id, true)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestGetCardEditHistoryForPost(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "original card history",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	client := th.Client
	time.Sleep(1 * time.Millisecond)

	_, _, err := client.PatchCard(context.Background(), cardPost.Id, &model.PostPatch{
		Message: model.NewPointer("edited once"),
	})
	require.NoError(t, err)
	_, _, err = client.PatchCard(context.Background(), cardPost.Id, &model.PostPatch{
		Message: model.NewPointer("edited twice"),
	})
	require.NoError(t, err)

	history, resp, err := client.GetCardEditHistoryForPost(context.Background(), cardPost.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Len(t, history, 2)
	assert.Equal(t, "edited once", history[0].Message)
	assert.Equal(t, "original card history", history[1].Message)
}
