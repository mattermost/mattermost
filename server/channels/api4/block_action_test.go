// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestDoBlockActionAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		var req model.PostActionIntegrationRequest
		require.NoError(t, json.Unmarshal(body, &req))
		assert.NotEmpty(t, req.UserId)
		assert.NotEmpty(t, req.PostId)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"type":"ok"}`))
	}))
	defer ts.Close()

	created, actionID := newMmBlocksActionPostInChannel(t, th, th.BasicChannel.Id, th.BasicUser.Id, ts.URL)

	t.Run("execute success", func(t *testing.T) {
		resp, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          actionID,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.NoError(t, err)
		CheckOKStatus(t, apiResp)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
		assert.NotEmpty(t, resp.TriggerId)
	})

	t.Run("missing post_id returns bad request", func(t *testing.T) {
		_, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			ActionId: actionID,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, apiResp)
	})

	t.Run("empty post_id with dialog-scoped cookie succeeds", func(t *testing.T) {
		dialogServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req model.PostActionIntegrationRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			assert.Empty(t, req.PostId)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok"}`))
		}))
		defer dialogServer.Close()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				model.PostPropsMmBlocksActions: map[string]any{
					"dialog_act": map[string]any{
						"type": model.MmBlocksActionTypeExternal,
						"url":  dialogServer.URL,
					},
				},
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)

		resp, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "dialog_act",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.NoError(t, err)
		CheckOKStatus(t, apiResp)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
	})

	t.Run("cookie without channel_id succeeds", func(t *testing.T) {
		dialogServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req model.PostActionIntegrationRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			assert.Empty(t, req.ChannelId)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok"}`))
		}))
		defer dialogServer.Close()

		// Mint a dialog-scoped cookie with no channel binding.
		post := &model.Post{
			Props: map[string]any{
				model.PostPropsMmBlocksActions: map[string]any{
					"no_channel_act": map[string]any{
						"type": model.MmBlocksActionTypeExternal,
						"url":  dialogServer.URL,
					},
				},
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)

		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		var parsed model.MmBlocksActionCookie
		require.NoError(t, json.Unmarshal([]byte(cookieStr), &parsed))
		assert.Empty(t, parsed.ChannelId)

		resp, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "no_channel_act",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.NoError(t, err)
		CheckOKStatus(t, apiResp)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
	})

	t.Run("missing action_id returns bad request", func(t *testing.T) {
		_, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId: created.Id,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, apiResp)
	})

	t.Run("without cookie requires read post permission", func(t *testing.T) {
		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		privateChannel := th.CreatePrivateChannel(t)
		privatePost, privateActionID := newMmBlocksActionPostInChannel(t, th, privateChannel.Id, th.BasicUser.Id, ts.URL)

		_, apiResp, err := client2.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            privatePost.Id,
			ActionId:          privateActionID,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, apiResp)
	})

	t.Run("cookie path allows action when user can read channel", func(t *testing.T) {
		cookie, ok := created.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)

		resp, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          actionID,
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.NoError(t, err)
		CheckOKStatus(t, apiResp)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
	})

	t.Run("lookup subtype returns items", func(t *testing.T) {
		lookupServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req model.PostActionIntegrationRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			assert.Equal(t, "dialog_lookup", req.Type)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"items":[{"text":"One","value":"1"}]}`))
		}))
		defer lookupServer.Close()

		lookupPost, lookupActionID := newMmBlocksActionPostInChannel(t, th, th.BasicChannel.Id, th.BasicUser.Id, lookupServer.URL)

		resp, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			Subtype:           model.BlockActionSubtypeLookup,
			PostId:            lookupPost.Id,
			ActionId:          lookupActionID,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.NoError(t, err)
		CheckOKStatus(t, apiResp)
		require.NotNil(t, resp)
		require.Len(t, resp.Items, 1)
		assert.Equal(t, "One", resp.Items[0].Text)
		assert.Empty(t, resp.TriggerId)
	})

	t.Run("mm_block rejected when feature flag is disabled", func(t *testing.T) {
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = true })

		_, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          actionID,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, apiResp)
	})

	t.Run("mm_blocks cookie rejected when feature flag is disabled", func(t *testing.T) {
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = true })

		// Use a non-existent post id so resolution falls through to the cookie path.
		missingPostID := model.NewId()
		enc, encErr := model.EncryptMmBlocksActionsCookie(
			map[string]any{
				actionID: map[string]any{
					"type": model.MmBlocksActionTypeExternal,
					"url":  ts.URL,
				},
			},
			missingPostID,
			missingPostID,
			th.BasicChannel.Id,
			map[string]any{},
			nil,
			th.App.PostActionCookieSecret(),
		)
		require.NoError(t, encErr)
		require.NotEmpty(t, enc)

		_, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            missingPostID,
			ActionId:          actionID,
			Cookie:            enc,
			IntegrationFormat: model.PostActionIntegrationFormatAttachment,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, apiResp)
	})

	t.Run("attachment format succeeds when feature flag is disabled", func(t *testing.T) {
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = true })

		attachmentPost, attachmentActionID := newAttachmentActionPost(t, th, ts.URL)

		resp, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            attachmentPost.Id,
			ActionId:          attachmentActionID,
			IntegrationFormat: model.PostActionIntegrationFormatAttachment,
		})
		require.NoError(t, err)
		CheckOKStatus(t, apiResp)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
	})

	t.Run("cookie without channel read permission returns forbidden", func(t *testing.T) {
		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		privateChannel := th.CreateChannelWithClient(t, client2, model.ChannelTypePrivate)
		privatePost, privateActionID := newMmBlocksActionPostInChannel(t, th, privateChannel.Id, th.BasicUser2.Id, ts.URL)
		cookie, ok := privatePost.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)

		_, apiResp, err := th.Client.DoBlockAction(context.Background(), model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            privatePost.Id,
			ActionId:          privateActionID,
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, apiResp)
	})
}
