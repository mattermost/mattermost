// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestDoBlockActionExecute(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	t.Run("execute sends form_values under context, applies update, returns trigger_id", func(t *testing.T) {
		var capturedReq model.PostActionIntegrationRequest
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, readErr := io.ReadAll(r.Body)
			require.NoError(t, readErr)
			require.NoError(t, json.Unmarshal(body, &capturedReq))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"update":{"message":"updated by block action"},"type":"ok"}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "do block action host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocks: []any{
					map[string]any{"type": "button", "text": "Submit", "action_id": "form_submit"},
				},
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp(
					"form_submit",
					ts.URL,
					map[string]any{"form": "ticket"},
				),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "form_submit",
			FormValues:        map[string]any{"title": "Bug report"},
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.NotEmpty(t, resp.TriggerId)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
		assert.Equal(t, "ticket", capturedReq.Context["form"])
		_, titleInContext := capturedReq.Context["title"]
		assert.False(t, titleInContext)
		formValues, ok := capturedReq.Context[model.PostActionContextFormValuesKey].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Bug report", formValues["title"])
		assert.NotEqual(t, "dialog_lookup", capturedReq.Type)

		updated, getErr := th.App.GetSinglePost(th.Context, created.Id, false)
		require.Nil(t, getErr)
		assert.Equal(t, "updated by block action", updated.Message)
	})

	t.Run("execute type refresh encrypts mm_blocks_actions cookie", func(t *testing.T) {
		secretURL := "https://example.com/plugins/secret/callback"
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"refresh",
				"mm_blocks":[{"type":"button","text":"Again","action_id":"again"}],
				"mm_blocks_actions":{"again":{"type":"external","url":"` + secretURL + `","context":{"k":"v"}}}
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "blocks refresh host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("refresh", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "refresh",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeRefresh, resp.Type)
		require.NotEmpty(t, resp.MmBlocks)
		require.NotEmpty(t, resp.MmBlocksActions)
		assert.NotContains(t, resp.MmBlocksActions, secretURL)

		plain, decErr := model.DecryptPostActionCookie(resp.MmBlocksActions, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		var cookie model.MmBlocksActionCookie
		require.NoError(t, json.Unmarshal([]byte(plain), &cookie))
		assert.Equal(t, model.MmBlocksActionCookieKind, cookie.Kind)
		require.Contains(t, cookie.Actions, "again")
		assert.Equal(t, secretURL, cookie.Actions["again"]["url"])
	})

	t.Run("execute type refresh rejects invalid mm_blocks_actions URL", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"refresh",
				"mm_blocks":[{"type":"button","text":"Again","action_id":"again"}],
				"mm_blocks_actions":{"again":{"type":"external","url":"javascript:alert(1)"}}
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "blocks refresh bad url host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("refresh", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "refresh",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.NotNil(t, appErr)
		assert.Nil(t, resp)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "valid integration URL")
	})

	t.Run("execute rejects form_values file IDs not owned by user", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Errorf("upstream should not be called when file ownership fails")
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		otherFile := th.CreateFileInfo(t, th.BasicUser2.Id, "", th.BasicChannel.Id)

		created, _, createErr := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "blocks form file host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("submit", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, createErr)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "submit",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
			FormValues: map[string]any{
				"attachments": []any{otherFile.Id},
			},
		}, nil)
		require.NotNil(t, appErr)
		assert.Nil(t, resp)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	t.Run("execute rejects mm_blocks_actions as encrypted string", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"refresh",
				"mm_blocks":[{"type":"text","text":"x"}],
				"mm_blocks_actions":"already-encrypted-cookie"
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "string actions host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("refresh", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "refresh",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.NotNil(t, appErr)
		assert.Nil(t, resp)
		assert.Contains(t, appErr.Error(), "mm_blocks_actions must be an object")
	})

	t.Run("execute type dialog validates and encrypts block_dialog", func(t *testing.T) {
		submitURL := "https://example.com/plugins/dialog/submit"
		cancelURL := "https://example.com/plugins/dialog/cancel"
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"dialog",
				"block_dialog":{
					"title":"Step 2",
					"submit":{"action":"dialog_submit"},
					"cancel":{"action":"dialog_cancel"},
					"blocks":[{"type":"text","text":"Next"}],
					"actions":{
						"dialog_submit":{"type":"external","url":"` + submitURL + `"},
						"dialog_cancel":{"type":"external","url":"` + cancelURL + `"}
					}
				}
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "dialog refresh host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("refresh", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "refresh",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeDialog, resp.Type)
		require.NotNil(t, resp.BlockDialog)
		assert.Equal(t, "Step 2", resp.BlockDialog.Title)
		require.NotNil(t, resp.BlockDialog.Submit)
		assert.Equal(t, "dialog_submit", resp.BlockDialog.Submit.Action)
		require.NotNil(t, resp.BlockDialog.Cancel)
		assert.Equal(t, "dialog_cancel", resp.BlockDialog.Cancel.Action)
		assert.Empty(t, resp.MmBlocks)
		assert.Empty(t, resp.MmBlocksActions)

		cookie, ok := resp.BlockDialog.Actions.(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)
		assert.NotContains(t, cookie, submitURL)

		plain, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		var mmCookie model.MmBlocksActionCookie
		require.NoError(t, json.Unmarshal([]byte(plain), &mmCookie))
		require.Contains(t, mmCookie.Actions, "dialog_submit")
		require.Contains(t, mmCookie.Actions, "dialog_cancel")
		assert.Equal(t, submitURL, mmCookie.Actions["dialog_submit"]["url"])
	})

	t.Run("execute type dialog rejects actions as encrypted string", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"dialog",
				"block_dialog":{
					"title":"Step 2",
					"blocks":[{"type":"text","text":"Next"}],
					"actions":"already-encrypted-cookie"
				}
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "dialog string actions host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("refresh", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "refresh",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.NotNil(t, appErr)
		assert.Nil(t, resp)
		assert.Contains(t, appErr.Error(), "mm_blocks_actions must be a map")
	})

	t.Run("execute type dialog with block_dialog stacks and encrypts", func(t *testing.T) {
		closeURL := "https://example.com/plugins/dialog/close"
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"dialog",
				"block_dialog":{
					"title":"More info",
					"submit":{"action":"more_info_close"},
					"blocks":[{"type":"text","text":"Help"}],
					"actions":{
						"more_info_close":{"type":"external","url":"` + closeURL + `"}
					}
				}
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "stack dialog host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("more_info", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "more_info",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeDialog, resp.Type)
		require.NotNil(t, resp.BlockDialog)
		assert.Equal(t, "More info", resp.BlockDialog.Title)
		assert.Empty(t, resp.MmBlocks)
		assert.Empty(t, resp.MmBlocksActions)

		cookie, ok := resp.BlockDialog.Actions.(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)
		assert.NotContains(t, cookie, closeURL)
	})

	t.Run("execute type dialog rejects missing chrome action", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"dialog",
				"block_dialog":{
					"title":"Step 2",
					"submit":{"action":"dialog_submit"},
					"blocks":[{"type":"text","text":"Next"}],
					"actions":{}
				}
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "dialog refresh bad",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("refresh", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "refresh",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.NotNil(t, appErr)
		assert.Nil(t, resp)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("execute via mm_blocks cookie (ephemeral path)", func(t *testing.T) {
		var gotPostID string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req model.PostActionIntegrationRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			gotPostID = req.PostId
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok"}`))
		}))
		defer ts.Close()

		postID := model.NewId()
		post := &model.Post{
			Id:        postID,
			Type:      model.PostTypeEphemeral,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("ephem_act", ts.URL, map[string]any{"via": "cookie"}),
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)

		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)
		require.NotNil(t, mmCookie)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            postID,
			ActionId:          "ephem_act",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
		assert.Equal(t, postID, gotPostID)
		assert.NotEmpty(t, resp.TriggerId)
	})

	t.Run("openURL short-circuit returns goto_location", func(t *testing.T) {
		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "open url host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: map[string]any{
					"open_act": map[string]any{
						"type": model.MmBlocksActionTypeOpenURL,
						"url":  "https://example.com/docs",
					},
				},
			},
		}, "", true)
		require.Nil(t, err)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "open_act",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, "https://example.com/docs", resp.GotoLocation)
		assert.Empty(t, resp.Type)
		assert.Empty(t, resp.TriggerId)
	})

	t.Run("missing context returns bad request", func(t *testing.T) {
		_, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			PostId:   model.NewId(),
			ActionId: "x",
		}, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("execute type refresh in dialog context encrypts block_dialog", func(t *testing.T) {
		submitURL := "https://example.com/plugins/dialog/submit"
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"type":"refresh",
				"block_dialog":{
					"title":"Step 2",
					"submit":{"action":"dialog_submit"},
					"blocks":[{"type":"text","text":"Next"}],
					"actions":{
						"dialog_submit":{"type":"external","url":"` + submitURL + `"}
					}
				}
			}`))
		}))
		defer ts.Close()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("dialog_refresh", ts.URL, nil),
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "dialog_refresh",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeRefresh, resp.Type)
		require.NotNil(t, resp.BlockDialog)
		assert.Equal(t, "Step 2", resp.BlockDialog.Title)
		assert.Empty(t, resp.MmBlocks)
		assert.Empty(t, resp.MmBlocksActions)

		encrypted, ok := resp.BlockDialog.Actions.(string)
		require.True(t, ok)
		require.NotEmpty(t, encrypted)
		assert.NotContains(t, encrypted, submitURL)
	})

	t.Run("execute type refresh in dialog context rejects missing block_dialog", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"refresh"}`))
		}))
		defer ts.Close()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("dialog_refresh_bad", ts.URL, nil),
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "dialog_refresh_bad",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.NotNil(t, appErr)
		assert.Nil(t, resp)
		assert.Contains(t, appErr.Error(), "block_dialog required for type refresh in dialog context")
	})

	t.Run("keep_dialog_open is returned only for dialog context", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok","keep_dialog_open":true}`))
		}))
		defer ts.Close()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("keep_open", ts.URL, nil),
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		dialogResp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "keep_open",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, dialogResp)
		assert.True(t, dialogResp.KeepDialogOpen)

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "keep open post host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("keep_open_post", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)

		postResp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			PostId:            created.Id,
			ActionId:          "keep_open_post",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, postResp)
		assert.False(t, postResp.KeepDialogOpen)
	})

	t.Run("missing post_id returns bad request", func(t *testing.T) {
		_, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:  model.BlockActionContextPost,
			ActionId: "x",
		}, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("empty post_id succeeds with dialog-scoped mm_blocks cookie", func(t *testing.T) {
		var gotReq model.PostActionIntegrationRequest
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, readErr := io.ReadAll(r.Body)
			require.NoError(t, readErr)
			require.NoError(t, json.Unmarshal(body, &gotReq))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok"}`))
		}))
		defer ts.Close()

		// Match OpenInteractiveDialog encryption: empty post/channel/root on the cookie.
		dialog := &model.BlockDialog{
			Title: "Dialog",
			Actions: map[string]any{
				"dialog_act": map[string]any{
					"type":    "external",
					"url":     ts.URL,
					"context": map[string]any{"via": "dialog"},
				},
			},
		}
		cookie, encErr := model.EncryptBlockDialogMmBlocksActions(dialog, th.App.PostActionCookieSecret(), th.BasicUser.Id)
		require.NoError(t, encErr)
		require.NotEmpty(t, cookie)

		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)
		require.NotNil(t, mmCookie)
		assert.Empty(t, mmCookie.PostId)
		assert.Empty(t, mmCookie.ChannelId)
		assert.Empty(t, mmCookie.RootPostId)
		assert.Equal(t, th.BasicUser.Id, mmCookie.UserId)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "dialog_act",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
			FormValues: map[string]any{
				"name": "Ada",
			},
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)

		// No channel/post/team identity is resolved or sent — only the acting user
		// and user-supplied form/action context reach the integration.
		assert.Empty(t, gotReq.PostId)
		assert.Empty(t, gotReq.ChannelId)
		assert.Empty(t, gotReq.ChannelName)
		assert.Empty(t, gotReq.TeamId)
		assert.Empty(t, gotReq.TeamName)
		assert.Equal(t, th.BasicUser.Id, gotReq.UserId)
		assert.Equal(t, th.BasicUser.Username, gotReq.UserName)
		require.NotNil(t, gotReq.Context)
		assert.Equal(t, "dialog", gotReq.Context["via"])
		formValues, ok := gotReq.Context[model.PostActionContextFormValuesKey].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, "Ada", formValues["name"])
	})

	t.Run("dialog-scoped cookie skips ephemeral_text without channel", func(t *testing.T) {
		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketEventEphemeralMessage})
		defer closeWS()

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok","ephemeral_text":"hello from dialog"}`))
		}))
		defer ts.Close()

		dialog := &model.BlockDialog{
			Title: "Dialog",
			Actions: map[string]any{
				"dialog_ephem": map[string]any{
					"type": "external",
					"url":  ts.URL,
				},
			},
		}
		cookie, encErr := model.EncryptBlockDialogMmBlocksActions(dialog, th.App.PostActionCookieSecret(), th.BasicUser.Id)
		require.NoError(t, encErr)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "dialog_ephem",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)

		select {
		case ev := <-messages:
			t.Fatalf("expected no ephemeral_message websocket event, got %v", ev.EventType())
		case <-time.After(300 * time.Millisecond):
		}
	})

	t.Run("dialog channel_id fills ephemeral but not upstream request", func(t *testing.T) {
		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketEventEphemeralMessage})
		defer closeWS()

		var gotReq model.PostActionIntegrationRequest
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, json.NewDecoder(r.Body).Decode(&gotReq))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok","ephemeral_text":"hello from dialog"}`))
		}))
		defer ts.Close()

		dialog := &model.BlockDialog{
			Title: "Dialog",
			Actions: map[string]any{
				"dialog_ephem_ch": map[string]any{
					"type": "external",
					"url":  ts.URL,
				},
			},
		}
		cookie, encErr := model.EncryptBlockDialogMmBlocksActions(dialog, th.App.PostActionCookieSecret(), th.BasicUser.Id)
		require.NoError(t, encErr)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ChannelId:         th.BasicChannel.Id,
			ActionId:          "dialog_ephem_ch",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
		assert.Empty(t, gotReq.ChannelId)
		assert.Empty(t, gotReq.ChannelName)
		assert.Empty(t, gotReq.TeamId)

		select {
		case ev := <-messages:
			require.Equal(t, model.WebsocketEventEphemeralMessage, ev.EventType())
			postData, ok := ev.GetData()["post"].(string)
			require.True(t, ok)
			var post model.Post
			require.NoError(t, json.Unmarshal([]byte(postData), &post))
			assert.Equal(t, th.BasicChannel.Id, post.ChannelId)
			assert.Equal(t, "hello from dialog", post.Message)
		case <-time.After(5 * time.Second):
			t.Fatal("timed out waiting for ephemeral_message websocket event")
		}
	})

	t.Run("empty post_id ignores update from integration", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"type":"ok","update":{"message":"should be ignored"}}`))
		}))
		defer ts.Close()

		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("dialog_update", ts.URL, nil),
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextDialog,
			PostId:            "",
			ActionId:          "dialog_update",
			Cookie:            cookie,
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, mmCookie)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, model.BlockActionResponseTypeOK, resp.Type)
	})

	t.Run("mismatched non-empty post ids still fail", func(t *testing.T) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("mismatch_act", "https://example.com/x", nil),
			},
		}
		post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		cookieStr, decErr := model.DecryptPostActionCookie(cookie, th.App.PostActionCookieSecret())
		require.NoError(t, decErr)
		_, mmCookie, parseErr := model.ParseDecryptedActionCookiePayload(cookieStr)
		require.NoError(t, parseErr)

		_, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:  model.BlockActionContextPost,
			PostId:   model.NewId(),
			ActionId: "mismatch_act",
			Cookie:   cookie,
		}, mmCookie)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.DetailedError, "postId doesn't match")
	})

	t.Run("missing action_id returns bad request", func(t *testing.T) {
		_, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context: model.BlockActionContextPost,
			PostId:  model.NewId(),
		}, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestDoBlockActionLookup(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	botUser := setupBotInChannel(t, th)
	intSeedCtx := th.Context.WithSession(&model.Session{UserId: botUser.Id, IsOAuth: true})

	t.Run("lookup returns items without applying update or ephemeral", func(t *testing.T) {
		var capturedType string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req model.PostActionIntegrationRequest
			require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
			capturedType = req.Type
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"items":[{"text":"Alpha","value":"a"},{"text":"Beta","value":"b"}],
				"update":{"message":"should not apply"},
				"ephemeral_text":"should not send"
			}`))
		}))
		defer ts.Close()

		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "lookup host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: buildMmBlocksActionsProp("lookup_act", ts.URL, nil),
			},
		}, "", true)
		require.Nil(t, err)
		originalMessage := created.Message

		resp, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			Subtype:           model.BlockActionSubtypeLookup,
			PostId:            created.Id,
			ActionId:          "lookup_act",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Equal(t, "dialog_lookup", capturedType)
		assert.Empty(t, resp.TriggerId)
		require.Len(t, resp.Items, 2)
		assert.Equal(t, "Alpha", resp.Items[0].Text)
		assert.Equal(t, "a", resp.Items[0].Value)

		updated, getErr := th.App.GetSinglePost(th.Context, created.Id, false)
		require.Nil(t, getErr)
		assert.Equal(t, originalMessage, updated.Message)
	})

	t.Run("lookup rejects invalid resolved URL", func(t *testing.T) {
		created, _, err := th.App.CreatePostAsUser(intSeedCtx, &model.Post{
			Message:       "bad lookup url host",
			ChannelId:     th.BasicChannel.Id,
			PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
			UserId:        botUser.Id,
			Props: model.StringInterface{
				model.PostPropsMmBlocksActions: map[string]any{
					"bad_lookup": map[string]any{
						"type": model.MmBlocksActionTypeExternal,
						"url":  "javascript:alert(1)",
					},
				},
			},
		}, "", true)
		require.Nil(t, err)

		_, appErr := th.App.DoBlockAction(th.Context, th.BasicUser.Id, &model.DoBlockActionRequest{
			Context:           model.BlockActionContextPost,
			Subtype:           model.BlockActionSubtypeLookup,
			PostId:            created.Id,
			ActionId:          "bad_lookup",
			IntegrationFormat: model.PostActionIntegrationFormatMmBlock,
		}, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}
