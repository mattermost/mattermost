// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"io"
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

func TestCreateCardRequestValidation(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	client := th.Client

	t.Run("invalid JSON body", func(t *testing.T) {
		r, err := client.DoAPIPost(context.Background(), "/cards", "not-json")
		require.NoError(t, err)
		defer r.Body.Close()
		_, _ = io.Copy(io.Discard, r.Body)
		require.Equal(t, http.StatusBadRequest, r.StatusCode)
	})

	t.Run("unknown channel", func(t *testing.T) {
		post := &model.Post{
			ChannelId: model.NewId(),
			Message:   "orphan card",
		}
		_, resp, err := client.CreateCard(context.Background(), post)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("hardened mode rejects integrations-reserved props", func(t *testing.T) {
		orig := *th.App.Config().ServiceSettings.ExperimentalEnableHardenedMode
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = true
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.ExperimentalEnableHardenedMode = orig
			})
		})

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "card with bad props",
			Props:     model.StringInterface{model.PostPropsFromWebhook: "true"},
		}
		_, resp, err := client.CreateCard(context.Background(), post)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid set_online query still creates card", func(t *testing.T) {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "card with bad set_online query",
		}
		r, err := client.DoAPIPostJSON(context.Background(), "/cards?set_online=not-a-bool", post)
		require.NoError(t, err)
		defer r.Body.Close()
		_, _ = io.Copy(io.Discard, r.Body)
		require.Equal(t, http.StatusCreated, r.StatusCode)
	})
}

func TestUpdateCardRequestValidation(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "card for update validation",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	client := th.Client

	t.Run("payload id does not match URL", func(t *testing.T) {
		updated := cardPost.Clone()
		updated.Id = model.NewId()
		updated.Message = "mismatch"
		_, resp, err := client.UpdateCard(context.Background(), cardPost.Id, updated)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid JSON body", func(t *testing.T) {
		r, err := client.DoAPIPut(context.Background(), "/cards/"+cardPost.Id, "{")
		require.NoError(t, err)
		defer r.Body.Close()
		_, _ = io.Copy(io.Discard, r.Body)
		require.Equal(t, http.StatusBadRequest, r.StatusCode)
	})

	t.Run("user not in private channel cannot update card", func(t *testing.T) {
		privateCh := th.CreatePrivateChannel(t)
		privCard, _, appErr2 := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: privateCh.Id,
			Message:   "private card",
			Type:      model.PostTypeCard,
		}, privateCh, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr2)

		th.LoginBasic2(t)
		updated := privCard.Clone()
		updated.Message = "nope"
		_, resp, cErr := th.Client.UpdateCard(context.Background(), privCard.Id, updated)
		require.Error(t, cErr)
		CheckForbiddenStatus(t, resp)
		th.LoginBasic(t)
	})

	t.Run("post too old for message change", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostEditTimeLimit = 1
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.PostEditTimeLimit = -1
			})
		})

		oldCard, _, appErr2 := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: channel.Id,
			Message:   "stale card",
			Type:      model.PostTypeCard,
			CreateAt:  model.GetMillis() - 5000,
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr2)

		up := oldCard.Clone()
		up.Message = "too late"
		_, resp, cErr := client.UpdateCard(context.Background(), oldCard.Id, up)
		require.Error(t, cErr)
		CheckBadRequestStatus(t, resp)
		appErr := cErr.(*model.AppError)
		require.Equal(t, "api.post.update_post.permissions_time_limit.app_error", appErr.Id)
	})
}

func TestPatchCardRequestValidation(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "card for patch validation",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	client := th.Client

	t.Run("invalid JSON body", func(t *testing.T) {
		r, err := client.DoAPIPut(context.Background(), "/cards/"+cardPost.Id+"/patch", "not-json")
		require.NoError(t, err)
		defer r.Body.Close()
		_, _ = io.Copy(io.Discard, r.Body)
		require.Equal(t, http.StatusBadRequest, r.StatusCode)
	})

	t.Run("hardened mode rejects props patch", func(t *testing.T) {
		orig := *th.App.Config().ServiceSettings.ExperimentalEnableHardenedMode
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableHardenedMode = true
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.ExperimentalEnableHardenedMode = orig
			})
		})

		patch := &model.PostPatch{
			Props: &model.StringInterface{model.PostPropsFromWebhook: "true"},
		}
		_, resp, err := client.PatchCard(context.Background(), cardPost.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("post too old for non-empty patch", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.PostEditTimeLimit = 1
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.PostEditTimeLimit = -1
			})
		})

		oldCard, _, appErr2 := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: channel.Id,
			Message:   "old patch card",
			Type:      model.PostTypeCard,
			CreateAt:  model.GetMillis() - 5000,
		}, channel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr2)

		patch := &model.PostPatch{Message: model.NewPointer("nope")}
		_, resp, cErr := client.PatchCard(context.Background(), oldCard.Id, patch)
		require.Error(t, cErr)
		CheckBadRequestStatus(t, resp)
	})
}

func TestDeleteCardPermanentAndStranger(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "card for delete rules",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	origEnable := *th.App.Config().ServiceSettings.EnableAPIPostDeletion
	t.Cleanup(func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableAPIPostDeletion = &origEnable
		})
	})

	t.Run("permanent delete disabled returns not implemented", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableAPIPostDeletion = false
		})
		resp, err := th.SystemAdminClient.PermanentDeleteCard(context.Background(), cardPost.Id)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("non-system-admin cannot permanent delete even when API enabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableAPIPostDeletion = true
		})
		resp, err := th.Client.PermanentDeleteCard(context.Background(), cardPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("stranger not on team cannot delete card", func(t *testing.T) {
		stranger := th.CreateUser(t)
		cli := th.CreateClient()
		_, _, err := cli.Login(context.Background(), stranger.Email, stranger.Password)
		require.NoError(t, err)

		resp, err := cli.DeleteCard(context.Background(), cardPost.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
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

	t.Run("no edits yet returns not found", func(t *testing.T) {
		_, resp, err := client.GetCardEditHistoryForPost(context.Background(), cardPost.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	time.Sleep(1 * time.Millisecond)

	patch := &model.PostPatch{Message: model.NewPointer("edited once")}
	_, resp, err := client.PatchCard(context.Background(), cardPost.Id, patch)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	patch2 := &model.PostPatch{Message: model.NewPointer("edited twice")}
	_, resp, err = client.PatchCard(context.Background(), cardPost.Id, patch2)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	t.Run("returns ordered edit history", func(t *testing.T) {
		history, resp, err := client.GetCardEditHistoryForPost(context.Background(), cardPost.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, history, 2)
		require.Equal(t, "edited once", history[0].Message)
		require.Equal(t, "original card history", history[1].Message)
	})

	t.Run("user not in private channel cannot read edit history", func(t *testing.T) {
		privateCh := th.CreatePrivateChannel(t)
		privCard, _, appErr2 := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: privateCh.Id,
			Message:   "private history",
			Type:      model.PostTypeCard,
		}, privateCh, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr2)

		_, _, pErr := client.PatchCard(context.Background(), privCard.Id, &model.PostPatch{
			Message: model.NewPointer("edited private"),
		})
		require.NoError(t, pErr)

		th.LoginBasic2(t)
		_, resp, hErr := th.Client.GetCardEditHistoryForPost(context.Background(), privCard.Id)
		require.Error(t, hErr)
		CheckForbiddenStatus(t, resp)
		th.LoginBasic(t)
	})
}

func TestSystemAdminPermanentDeleteCard(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	origEnable := *th.App.Config().ServiceSettings.EnableAPIPostDeletion
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableAPIPostDeletion = true
	})
	t.Cleanup(func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.EnableAPIPostDeletion = &origEnable
		})
	})

	channel := th.BasicChannel
	cardPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: channel.Id,
		Message:   "card to purge",
		Type:      model.PostTypeCard,
	}, channel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	resp, err := th.SystemAdminClient.PermanentDeleteCard(context.Background(), cardPost.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
}
