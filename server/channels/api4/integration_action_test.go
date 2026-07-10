// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

type testHandler struct {
	t *testing.T
}

func (th *testHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	bb, err := io.ReadAll(r.Body)
	assert.NoError(th.t, err)
	assert.NotEmpty(th.t, string(bb))
	var poir model.PostActionIntegrationRequest
	jsonErr := json.Unmarshal(bb, &poir)
	assert.NoError(th.t, jsonErr)
	assert.NotEmpty(th.t, poir.UserId)
	assert.NotEmpty(th.t, poir.UserName)
	assert.NotEmpty(th.t, poir.ChannelId)
	assert.NotEmpty(th.t, poir.ChannelName)
	assert.NotEmpty(th.t, poir.TeamId)
	assert.NotEmpty(th.t, poir.TeamName)
	assert.NotEmpty(th.t, poir.PostId)
	assert.NotEmpty(th.t, poir.TriggerId)
	assert.Equal(th.t, model.PostActionTypeButton, poir.Type)
	assert.Equal(th.t, "test-value", poir.Context["test-key"])
	_, err = w.Write([]byte("{}"))
	require.NoError(th.t, err)
	w.WriteHeader(200)
}

func TestPostActionCookies(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	handler := &testHandler{t}
	server := httptest.NewServer(handler)

	for name, test := range map[string]struct {
		Action             model.PostAction
		ExpectedSuccess    bool
		ExpectedStatusCode int
	}{
		"32 character ID": {
			Action: model.PostAction{
				Id:   model.NewId(),
				Name: "Test-action",
				Type: model.PostActionTypeButton,
				Integration: &model.PostActionIntegration{
					URL: server.URL,
					Context: map[string]any{
						"test-key": "test-value",
					},
				},
			},
			ExpectedSuccess:    true,
			ExpectedStatusCode: http.StatusOK,
		},
		"6 character ID": {
			Action: model.PostAction{
				Id:   "someID",
				Name: "Test-action",
				Type: model.PostActionTypeButton,
				Integration: &model.PostActionIntegration{
					URL: server.URL,
					Context: map[string]any{
						"test-key": "test-value",
					},
				},
			},
			ExpectedSuccess:    true,
			ExpectedStatusCode: http.StatusOK,
		},
		"hyphen and underscore in action ID": {
			Action: model.PostAction{
				Id:   "e2e_mm-blocks_primary",
				Name: "Test-action",
				Type: model.PostActionTypeButton,
				Integration: &model.PostActionIntegration{
					URL: server.URL,
					Context: map[string]any{
						"test-key": "test-value",
					},
				},
			},
			ExpectedSuccess:    true,
			ExpectedStatusCode: http.StatusOK,
		},
		"Empty ID": {
			Action: model.PostAction{
				Id:   "",
				Name: "Test-action",
				Type: model.PostActionTypeButton,
				Integration: &model.PostActionIntegration{
					URL: server.URL,
					Context: map[string]any{
						"test-key": "test-value",
					},
				},
			},
			ExpectedSuccess:    false,
			ExpectedStatusCode: http.StatusNotFound,
		},
	} {
		t.Run(name, func(t *testing.T) {
			post := &model.Post{
				Id:        model.NewId(),
				Type:      model.PostTypeEphemeral,
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				CreateAt:  model.GetMillis(),
				UpdateAt:  model.GetMillis(),
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Title:     "some-title",
							TitleLink: "https://some-url.com",
							Text:      "some-text",
							ImageURL:  "https://some-other-url.com",
							Actions:   []*model.PostAction{&test.Action},
						},
					},
				},
			}

			assert.Equal(t, 32, len(th.App.PostActionCookieSecret()))
			post = model.AddPostActionCookies(post, th.App.PostActionCookieSecret())

			resp, err := client.DoPostActionWithCookie(context.Background(), post.Id, test.Action.Id, "", test.Action.Cookie, nil, "")
			require.NotNil(t, resp)
			if test.ExpectedSuccess {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
			assert.Equal(t, test.ExpectedStatusCode, resp.StatusCode)
			assert.NotNil(t, resp.RequestId)
			assert.NotNil(t, resp.ServerVersion)
		})
	}
}

func TestDoPostActionCookieHandling(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	handler := &testHandler{t}
	server := httptest.NewServer(handler)
	defer server.Close()

	secret := th.App.PostActionCookieSecret()
	actionID := model.NewId()

	buildLegacyCookiePost := func(channelID, userID string) (*model.Post, string) {
		t.Helper()
		post := &model.Post{
			Id:        model.NewId(),
			Type:      model.PostTypeEphemeral,
			UserId:    userID,
			ChannelId: channelID,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id:   actionID,
								Name: "action",
								Type: model.PostActionTypeButton,
								Integration: &model.PostActionIntegration{
									URL: server.URL,
									Context: map[string]any{
										"test-key": "test-value",
									},
								},
							},
						},
					},
				},
			},
		}
		post = model.AddPostActionCookies(post, secret)
		attachments, ok := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		require.Len(t, attachments, 1)
		require.Len(t, attachments[0].Actions, 1)
		return post, attachments[0].Actions[0].Cookie
	}

	t.Run("invalid encrypted cookie returns bad request", func(t *testing.T) {
		post, _ := buildLegacyCookiePost(th.BasicChannel.Id, th.BasicUser.Id)
		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, actionID, "", "not-a-valid-cookie", nil, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("malformed cookie payload returns bad request", func(t *testing.T) {
		post, _ := buildLegacyCookiePost(th.BasicChannel.Id, th.BasicUser.Id)
		enc, encErr := model.EncryptPostActionCookie("not-json", secret)
		require.NoError(t, encErr)
		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, actionID, "", enc, nil, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("legacy cookie with nonexistent channel returns not found", func(t *testing.T) {
		post, _ := buildLegacyCookiePost(th.BasicChannel.Id, th.BasicUser.Id)
		enc, encErr := model.EncryptPostActionCookie(mustJSON(t, &model.PostActionCookie{
			PostId:    post.Id,
			ChannelId: model.NewId(),
			Type:      model.PostActionTypeButton,
			Integration: &model.PostActionIntegration{
				URL: server.URL,
			},
		}), secret)
		require.NoError(t, encErr)
		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, actionID, "", enc, nil, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("legacy cookie without channel read permission returns forbidden", func(t *testing.T) {
		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		privateChannel := th.CreateChannelWithClient(t, client2, model.ChannelTypePrivate)

		post, cookie := buildLegacyCookiePost(privateChannel.Id, th.BasicUser2.Id)
		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, actionID, "", cookie, nil, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("mm_blocks cookie without channel read permission returns forbidden", func(t *testing.T) {
		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		privateChannel := th.CreateChannelWithClient(t, client2, model.ChannelTypePrivate)
		mmActionID := "mm_blocks_act"

		post := &model.Post{
			Id:        model.NewId(),
			Type:      model.PostTypeEphemeral,
			UserId:    th.BasicUser2.Id,
			ChannelId: privateChannel.Id,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PostPropsMmBlocksActions: map[string]any{
					mmActionID: map[string]any{
						"type": model.MmBlocksActionTypeExternal,
						"url":  server.URL,
					},
				},
			},
		}
		post = model.AddPostActionCookies(post, secret)
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, mmActionID, "", cookie, nil, model.PostActionIntegrationFormatMmBlock)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("mm_blocks cookie rejected when feature flag is disabled", func(t *testing.T) {
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.MmBlocksEnabled = true })

		mmActionID := "mm_blocks_act"
		post := &model.Post{
			Id:        model.NewId(),
			Type:      model.PostTypeEphemeral,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PostPropsMmBlocks: []any{
					map[string]any{"type": "button", "text": "Go", "action_id": mmActionID},
				},
				model.PostPropsMmBlocksActions: map[string]any{
					mmActionID: map[string]any{
						"type": model.MmBlocksActionTypeExternal,
						"url":  server.URL,
					},
				},
			},
		}
		model.AddMmBlocksActionCookies(post, secret)
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, mmActionID, "", cookie, nil, model.PostActionIntegrationFormatMmBlock)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("mm_blocks cookie allows action when user can read channel", func(t *testing.T) {
		mmActionID := "mm_blocks_act"
		post := &model.Post{
			Id:        model.NewId(),
			Type:      model.PostTypeEphemeral,
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			CreateAt:  model.GetMillis(),
			UpdateAt:  model.GetMillis(),
			Props: map[string]any{
				model.PostPropsMmBlocksActions: map[string]any{
					mmActionID: map[string]any{
						"type": model.MmBlocksActionTypeExternal,
						"url":  server.URL,
						"context": map[string]any{
							"test-key": "test-value",
						},
					},
				},
			},
		}
		post = model.AddPostActionCookies(post, secret)
		cookie, ok := post.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		require.NotEmpty(t, cookie)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, mmActionID, "", cookie, nil, model.PostActionIntegrationFormatMmBlock)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("without cookie requires read post permission", func(t *testing.T) {
		client2 := th.CreateClient()
		th.LoginBasic2WithClient(t, client2)
		privateChannel := th.CreateChannelWithClient(t, client2, model.ChannelTypePrivate)

		post, _, err := client2.CreatePost(context.Background(), &model.Post{
			ChannelId: privateChannel.Id,
			Message:   "interactive",
			Props: map[string]any{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id:   actionID,
								Name: "action",
								Type: model.PostActionTypeButton,
								Integration: &model.PostActionIntegration{
									URL: server.URL,
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, actionID, "", "", nil, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("without cookie allows action when user can read post", func(t *testing.T) {
		post, _, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "interactive",
			Props: map[string]any{
				model.PostPropsAttachments: []*model.MessageAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id:   actionID,
								Name: "action",
								Type: model.PostActionTypeButton,
								Integration: &model.PostActionIntegration{
									URL: server.URL,
									Context: map[string]any{
										"test-key": "test-value",
									},
								},
							},
						},
					},
				},
			},
		})
		require.NoError(t, err)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), post.Id, actionID, "", "", nil, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return string(b)
}

func TestOpenDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	_, triggerId, appErr := model.GenerateTriggerId(th.BasicUser.Id, th.App.AsymmetricSigningKey())
	require.Nil(t, appErr)

	request := model.OpenDialogRequest{
		TriggerId: triggerId,
		URL:       "http://localhost:8065",
		Dialog: model.Dialog{
			CallbackId: "callbackid",
			Title:      "Some Title",
			Elements: []model.DialogElement{
				{
					DisplayName: "Element Name",
					Name:        "element_name",
					Type:        "text",
					Placeholder: "Enter a value",
				},
			},
			SubmitLabel:    "Submit",
			NotifyOnCancel: false,
			State:          "somestate",
		},
	}

	t.Run("Should pass with valid request", func(t *testing.T) {
		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)
	})

	t.Run("Should fail on bad trigger ID", func(t *testing.T) {
		request.TriggerId = "junk"
		resp, err := client.OpenInteractiveDialog(context.Background(), request)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("URL is required", func(t *testing.T) {
		request.TriggerId = triggerId
		request.URL = ""
		resp, err := client.OpenInteractiveDialog(context.Background(), request)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("Should pass with markdown formatted introduction text", func(t *testing.T) {
		request.URL = "http://localhost:8065"
		request.Dialog.IntroductionText = "**Some** _introduction text"
		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)
	})

	t.Run("Should pass with empty introduction text", func(t *testing.T) {
		request.Dialog.IntroductionText = ""
		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)
	})

	t.Run("Should pass with too long display name of elements", func(t *testing.T) {
		request.Dialog.Elements = []model.DialogElement{
			{
				DisplayName: "Very very long Element Name",
				Name:        "element_name",
				Type:        "text",
				Placeholder: "Enter a value",
			},
		}

		buffer := &mlog.Buffer{}
		err := mlog.AddWriterTarget(th.TestLogger, buffer, true, mlog.StdAll...)
		require.NoError(t, err)

		_, err = client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, buffer, mlog.LvlWarn.Name, "Interactive dialog is invalid")
	})

	t.Run("Should pass with same elements", func(t *testing.T) {
		request.Dialog.Elements = []model.DialogElement{
			{
				DisplayName: "Element Name",
				Name:        "element_name",
				Type:        "text",
				Placeholder: "Enter a value",
			},
			{
				DisplayName: "Element Name",
				Name:        "element_name",
				Type:        "text",
				Placeholder: "Enter a value",
			},
		}
		buffer := &mlog.Buffer{}
		err := mlog.AddWriterTarget(th.TestLogger, buffer, true, mlog.StdAll...)
		require.NoError(t, err)

		_, err = client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)

		require.NoError(t, th.TestLogger.Flush())
		testlib.AssertLog(t, buffer, mlog.LvlWarn.Name, "Interactive dialog is invalid")
	})

	t.Run("Should pass with nil elements slice", func(t *testing.T) {
		request.Dialog.Elements = nil
		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)
	})

	t.Run("Should pass with empty elements slice", func(t *testing.T) {
		request.Dialog.Elements = []model.DialogElement{}
		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.NoError(t, err)
	})

	t.Run("Should fail if trigger timeout is extended", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = new(int64(1))
		})

		time.Sleep(2 * time.Second)

		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Trigger ID for interactive dialog is expired.")
	})
}

func TestSubmitDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	submit := model.SubmitDialogRequest{
		CallbackId: "callbackid",
		State:      "somestate",
		UserId:     th.BasicUser.Id,
		ChannelId:  th.BasicChannel.Id,
		TeamId:     th.BasicTeam.Id,
		Submission: map[string]any{"somename": "somevalue"},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request model.SubmitDialogRequest
		err := json.NewDecoder(r.Body).Decode(&request)
		require.NoError(t, err)

		assert.Equal(t, request.URL, "")
		assert.Equal(t, request.UserId, submit.UserId)
		assert.Equal(t, request.ChannelId, th.BasicChannel.Id)
		// The handler overwrites the client-supplied TeamId with channel.TeamId,
		// so the forwarded value is always the channel's authoritative team.
		assert.Equal(t, th.BasicTeam.Id, request.TeamId)
		assert.Equal(t, request.CallbackId, submit.CallbackId)
		assert.Equal(t, request.State, submit.State)
		val, ok := request.Submission["somename"].(string)
		require.True(t, ok)
		assert.Equal(t, "somevalue", val)
	}))
	defer ts.Close()

	submit.URL = ts.URL

	submitResp, _, err := client.SubmitInteractiveDialog(context.Background(), submit)
	require.NoError(t, err)
	assert.NotNil(t, submitResp)

	submit.URL = ""
	submitResp, resp, err := client.SubmitInteractiveDialog(context.Background(), submit)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	assert.Nil(t, submitResp)

	submit.URL = ts.URL
	submit.ChannelId = model.NewId()
	submitResp, resp, err = client.SubmitInteractiveDialog(context.Background(), submit)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	assert.Nil(t, submitResp)

	// The handler derives the team from channel.TeamId (server-loaded), not from
	// the client-supplied TeamId. A bogus client TeamId is ignored — the request
	// succeeds because BasicUser is a member of BasicTeam where BasicChannel lives.
	submit.URL = ts.URL
	submit.ChannelId = th.BasicChannel.Id
	submit.TeamId = model.NewId()
	submitResp, _, err = client.SubmitInteractiveDialog(context.Background(), submit)
	require.NoError(t, err)
	assert.NotNil(t, submitResp)

	t.Run("outgoing payload carries channel's real TeamId even when client sent bogus TeamId", func(t *testing.T) {
		// The handler overwrites submit.TeamId with channel.TeamId before calling
		// SubmitInteractiveDialog. This test captures the SubmitDialogRequest body
		// forwarded to the integration and asserts that the TeamId reflects the
		// channel's real team, not the bogus value supplied by the client.
		var capturedTeamId string
		captureServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var forwarded model.SubmitDialogRequest
			err := json.NewDecoder(r.Body).Decode(&forwarded)
			require.NoError(t, err)
			capturedTeamId = forwarded.TeamId
			w.WriteHeader(http.StatusOK)
		}))
		defer captureServer.Close()

		bogusSubmit := model.SubmitDialogRequest{
			URL:        captureServer.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     model.NewId(), // bogus — handler must ignore this
			Submission: map[string]any{"somename": "somevalue"},
		}

		submitResp, _, err := client.SubmitInteractiveDialog(context.Background(), bogusSubmit)
		require.NoError(t, err)
		assert.NotNil(t, submitResp)
		assert.Equal(t, th.BasicTeam.Id, capturedTeamId,
			"forwarded TeamId must be channel's real team, not the bogus client-supplied value")
	})

	t.Run("user lacking PermissionViewTeam on the channel's real team gets 403", func(t *testing.T) {
		// Removing view_team from the team-user role means BasicUser loses the
		// permission on BasicTeam. The handler checks PermissionViewTeam using the
		// server-loaded channel.TeamId, so the request must be rejected with 403.
		th.RemovePermissionFromRole(t, model.PermissionViewTeam.Id, model.TeamUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionViewTeam.Id, model.TeamUserRoleId)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		noViewTeamSubmit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"somename": "somevalue"},
		}

		submitResp, resp, err := client.SubmitInteractiveDialog(context.Background(), noViewTeamSubmit)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, submitResp)
	})

	t.Run("empty TeamId succeeds — regression test for DM/GM channels not returning 403", func(t *testing.T) {
		user1 := th.CreateUser(t)
		dmChannel, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user1.Id)
		require.NoError(t, err)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		dmSubmit := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  dmChannel.Id,
			TeamId:     "",
			Submission: map[string]any{"somename": "somevalue"},
		}

		submitResp, _, err := client.SubmitInteractiveDialog(context.Background(), dmSubmit)
		require.NoError(t, err)
		assert.NotNil(t, submitResp)
	})
}

func TestLookupDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("should handle successful lookup request", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var request model.SubmitDialogRequest
			err := json.NewDecoder(r.Body).Decode(&request)
			require.NoError(t, err)

			assert.Equal(t, "dialog_lookup", request.Type)
			assert.Equal(t, th.BasicUser.Id, request.UserId)
			assert.Equal(t, th.BasicChannel.Id, request.ChannelId)
			assert.Equal(t, th.BasicTeam.Id, request.TeamId)
			assert.Equal(t, "callbackid", request.CallbackId)
			assert.Equal(t, "somestate", request.State)

			// Check for query and selected_field in submission
			query, ok := request.Submission["query"].(string)
			require.True(t, ok)
			assert.Equal(t, "test query", query)

			selectedField, ok := request.Submission["selected_field"].(string)
			require.True(t, ok)
			assert.Equal(t, "dynamic_field", selectedField)

			// Return mock lookup response
			response := model.LookupDialogResponse{
				Items: []model.DialogSelectOption{
					{Text: "Option 1", Value: "value1"},
					{Text: "Option 2", Value: "value2"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{
				"query":          "test query",
				"selected_field": "dynamic_field",
			},
		}

		lookupResp, _, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.NoError(t, err)
		assert.NotNil(t, lookupResp)
		assert.Len(t, lookupResp.Items, 2)
		assert.Equal(t, "Option 1", lookupResp.Items[0].Text)
		assert.Equal(t, "value1", lookupResp.Items[0].Value)
	})

	t.Run("should fail on empty URL", func(t *testing.T) {
		lookup := model.SubmitDialogRequest{
			URL:        "",
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, resp, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		assert.Nil(t, lookupResp)
	})

	t.Run("should fail on invalid URL", func(t *testing.T) {
		lookup := model.SubmitDialogRequest{
			URL:        "http://invalid-url-not-allowed",
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, resp, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		assert.Nil(t, lookupResp)
	})

	t.Run("should fail on invalid channel ID", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  model.NewId(),
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, resp, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, lookupResp)
	})

	// The handler derives the team from channel.TeamId (server-loaded), not from
	// the client-supplied TeamId. A bogus client TeamId is ignored — the request
	// succeeds because BasicUser is a member of BasicTeam where BasicChannel lives.
	t.Run("client-supplied invalid team ID is ignored — succeeds via server-loaded channel.TeamId", func(t *testing.T) {
		var capturedTeamId string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var forwarded model.SubmitDialogRequest
			err := json.NewDecoder(r.Body).Decode(&forwarded)
			require.NoError(t, err)
			capturedTeamId = forwarded.TeamId
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("{}"))
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     model.NewId(), // bogus — handler must ignore this
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, _, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.NoError(t, err)
		assert.NotNil(t, lookupResp)
		assert.Equal(t, th.BasicTeam.Id, capturedTeamId,
			"forwarded TeamId must be channel's real team, not the bogus client-supplied value")
	})

	t.Run("user lacking PermissionViewTeam on the channel's real team gets 403", func(t *testing.T) {
		// Removing view_team from the team-user role means BasicUser loses the
		// permission on BasicTeam. The handler checks PermissionViewTeam using the
		// server-loaded channel.TeamId, so the request must be rejected with 403.
		th.RemovePermissionFromRole(t, model.PermissionViewTeam.Id, model.TeamUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionViewTeam.Id, model.TeamUserRoleId)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("{}"))
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, resp, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, lookupResp)
	})

	t.Run("should handle plugin URL", func(t *testing.T) {
		lookup := model.SubmitDialogRequest{
			URL:        "/plugins/myplugin/lookup",
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		// Should fail because plugin doesn't exist, but URL validation should pass
		lookupResp, resp, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.Error(t, err)
		// Should not be a bad request (URL validation error), but a different error
		assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode)
		assert.Nil(t, lookupResp)
	})

	t.Run("should handle empty response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// Return empty JSON object for valid JSON response
			_, _ = w.Write([]byte("{}"))
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, _, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.NoError(t, err)
		assert.NotNil(t, lookupResp)
		assert.Empty(t, lookupResp.Items)
	})

	t.Run("empty TeamId succeeds — regression test for DM/GM channels not returning 403", func(t *testing.T) {
		user1 := th.CreateUser(t)
		dmChannel, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user1.Id)
		require.NoError(t, err)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("{}"))
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			ChannelId:  dmChannel.Id,
			TeamId:     "",
			Submission: map[string]any{"query": "test"},
		}

		lookupResp, _, err := client.LookupInteractiveDialog(context.Background(), lookup)
		require.NoError(t, err)
		assert.NotNil(t, lookupResp)
	})
}

// newAttachmentActionPost posts an attachment action pointing at upstreamURL,
// attributed to th.BasicUser so th.Client has access to call the action.
func newAttachmentActionPost(t *testing.T, th *TestHelper, upstreamURL string) (*model.Post, string) {
	t.Helper()
	basicPost := &model.Post{
		Message:   "attachment action post",
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Type: model.PostActionTypeButton,
							Name: "click",
							Integration: &model.PostActionIntegration{
								URL: upstreamURL,
							},
						},
					},
				},
			},
		},
	}
	created, _, appErr := th.App.CreatePostAsUser(th.Context, basicPost, "", true)
	require.Nil(t, appErr)

	attachments, ok := created.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	require.NotEmpty(t, attachments)
	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)
	return created, attachments[0].Actions[0].Id
}

func TestDoPostActionQuery_ValidationErrors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	created, actionID := newAttachmentActionPost(t, th, ts.URL)
	route := "/posts/" + created.Id + "/actions/" + actionID

	t.Run("too many entries returns 400 with expected error id", func(t *testing.T) {
		ctxMap := make(map[string]string, model.MaxActionQueryEntries+1)
		for i := range model.MaxActionQueryEntries + 1 {
			ctxMap[fmt.Sprintf("k%d", i)] = "v"
		}
		payload, err := json.Marshal(model.DoPostActionRequest{Query: ctxMap})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(payload))
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(resp))
		CheckErrorID(t, err, "api.post.do_action.query.app_error")
	})

	t.Run("oversized key returns 400", func(t *testing.T) {
		ctxMap := map[string]string{strings.Repeat("k", model.MaxActionQueryKeyLength+1): "v"}
		payload, err := json.Marshal(model.DoPostActionRequest{Query: ctxMap})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(payload))
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(resp))
		CheckErrorID(t, err, "api.post.do_action.query.app_error")
	})

	t.Run("oversized value returns 400", func(t *testing.T) {
		ctxMap := map[string]string{"k": strings.Repeat("v", model.MaxActionQueryValueLength+1)}
		payload, err := json.Marshal(model.DoPostActionRequest{Query: ctxMap})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(payload))
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(resp))
		CheckErrorID(t, err, "api.post.do_action.query.app_error")
	})

	t.Run("small valid context returns 200", func(t *testing.T) {
		payload, err := json.Marshal(model.DoPostActionRequest{Query: map[string]string{"tail": "214"}})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(payload))
		require.NoError(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestDoPostActionQuery_OmitempyCompat(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	created, actionID := newAttachmentActionPost(t, th, ts.URL)
	route := "/posts/" + created.Id + "/actions/" + actionID

	// Older clients do not know about query — their request body has no such
	// key. The omitempty tag should make this equivalent to sending a nil
	// map, which ValidateActionQuery accepts.
	payload := `{"selected_option":""}`
	resp, err := client.DoAPIPost(context.Background(), route, payload)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Completely empty body should also be accepted — same as older clients
	// calling DoPostActionWithCookie with no selection and no cookie.
	resp, err = client.DoAPIPost(context.Background(), route, "")
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

// TestDoPostActionMalformedBody verifies non-EOF JSON decode errors now
// return 400 instead of silently running the action with an empty request.
// A body like `{"query":{"k":1}}` (value is not a string) would otherwise
// deserialize to a zero-value Query and skip validation.
func TestDoPostActionMalformedBody(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	created, actionID := newAttachmentActionPost(t, th, ts.URL)
	route := "/posts/" + created.Id + "/actions/" + actionID

	t.Run("wrong type for query value returns 400", func(t *testing.T) {
		// query must be map[string]string; passing an int value triggers a
		// json UnmarshalTypeError which must not fall through.
		resp, err := client.DoAPIPost(context.Background(), route, `{"query":{"k":1}}`)
		require.Error(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("syntactically invalid JSON returns 400", func(t *testing.T) {
		resp, err := client.DoAPIPost(context.Background(), route, `{not json`)
		require.Error(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("trailing JSON values after the first object return 400", func(t *testing.T) {
		// json.Decoder.Decode stops after the first complete value, so a
		// body like `{"query":{}}{"cookie":"x"}` would otherwise execute
		// the action with the first object's intent and silently drop the
		// rest. The handler explicitly rejects trailing values.
		resp, err := client.DoAPIPost(context.Background(), route, `{"query":{}}{"cookie":"x"}`)
		require.Error(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

const mmBlocksChannelAuthActionID = "mm_blocks_act"

func newMmBlocksActionPostInChannel(t *testing.T, th *TestHelper, channelID, userID, upstreamURL string) (*model.Post, string) {
	t.Helper()
	channel, appErr := th.App.GetChannel(th.Context, channelID)
	require.Nil(t, appErr)

	post := &model.Post{
		Message:   "mm_blocks action post",
		ChannelId: channelID,
		UserId:    userID,
		Props: model.StringInterface{
			model.PostPropsMmBlocks: []any{
				map[string]any{"type": "button", "text": "Go", "action_id": mmBlocksChannelAuthActionID},
			},
			model.PostPropsMmBlocksActions: map[string]any{
				mmBlocksChannelAuthActionID: map[string]any{
					"type": model.MmBlocksActionTypeExternal,
					"url":  upstreamURL,
				},
			},
		},
	}
	created, _, appErr := th.App.CreatePost(th.Context, post, channel, model.CreatePostFlags{AllowMmBlocksActions: true})
	require.Nil(t, appErr)

	withCookies := model.AddPostActionCookies(created, th.App.PostActionCookieSecret())
	return withCookies, mmBlocksChannelAuthActionID
}

func newAttachmentActionPostInChannel(t *testing.T, th *TestHelper, channelID, userID, upstreamURL string) (*model.Post, string) {
	t.Helper()
	post := &model.Post{
		Message:   "attachment action post",
		ChannelId: channelID,
		UserId:    userID,
		Props: model.StringInterface{
			model.PostPropsAttachments: []*model.MessageAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Type:        model.PostActionTypeButton,
							Name:        "click",
							Integration: &model.PostActionIntegration{URL: upstreamURL},
						},
					},
				},
			},
		},
	}
	created, _, appErr := th.App.CreatePostAsUser(th.Context, post, "", true)
	require.Nil(t, appErr)

	withCookies := model.AddPostActionCookies(created, th.App.PostActionCookieSecret())
	attachments, ok := withCookies.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	require.NotEmpty(t, attachments)
	require.NotEmpty(t, attachments[0].Actions)
	action := attachments[0].Actions[0]
	require.NotEmpty(t, action.Id)
	return withCookies, action.Id
}

func TestDoPostActionCookieChannelAuthorization(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("{}"))
	}))
	defer ts.Close()

	privateChannel := th.CreatePrivateChannel(t)
	privatePost, privateActionID := newAttachmentActionPostInChannel(t, th, privateChannel.Id, th.BasicUser.Id, ts.URL)
	privateMmPost, privateMmActionID := newMmBlocksActionPostInChannel(t, th, privateChannel.Id, th.BasicUser.Id, ts.URL)

	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)
	readablePost, _ := newAttachmentActionPostInChannel(t, th, th.BasicChannel.Id, th.BasicUser.Id, ts.URL)
	readableAttachments, ok := readablePost.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	require.True(t, ok)
	readableCookie := readableAttachments[0].Actions[0].Cookie
	require.NotEmpty(t, readableCookie)

	readableMmPost, _ := newMmBlocksActionPostInChannel(t, th, th.BasicChannel.Id, th.BasicUser.Id, ts.URL)
	readableMmCookie, ok := readableMmPost.GetProp(model.PostPropsMmBlocksActions).(string)
	require.True(t, ok)
	require.NotEmpty(t, readableMmCookie)

	nonMember := th.CreateClient()
	th.LoginBasic2WithClient(t, nonMember)

	t.Run("non-member cannot act on the private post without a cookie", func(t *testing.T) {
		resp, err := nonMember.DoPostAction(context.Background(), privatePost.Id, privateActionID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-member cannot act on the private mm_blocks post without a cookie", func(t *testing.T) {
		resp, err := nonMember.DoPostActionWithCookie(context.Background(), privateMmPost.Id, privateMmActionID, "", "", nil, model.PostActionIntegrationFormatMmBlock)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("a cookie from a readable channel cannot authorize a different post", func(t *testing.T) {
		resp, err := nonMember.DoPostActionWithCookie(context.Background(), privatePost.Id, privateActionID, "", readableCookie, nil, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("an mm_blocks cookie from a readable channel cannot authorize a different post", func(t *testing.T) {
		resp, err := nonMember.DoPostActionWithCookie(context.Background(), privateMmPost.Id, privateMmActionID, "", readableMmCookie, nil, model.PostActionIntegrationFormatMmBlock)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("a member can still act using the post's own cookie", func(t *testing.T) {
		legitAttachments, ok := privatePost.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
		require.True(t, ok)
		legitCookie := legitAttachments[0].Actions[0].Cookie
		require.NotEmpty(t, legitCookie)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), privatePost.Id, privateActionID, "", legitCookie, nil, "")
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("a member can still act on mm_blocks using the post's own cookie", func(t *testing.T) {
		legitMmCookie, ok := privateMmPost.GetProp(model.PostPropsMmBlocksActions).(string)
		require.True(t, ok)
		require.NotEmpty(t, legitMmCookie)

		resp, err := th.Client.DoPostActionWithCookie(context.Background(), privateMmPost.Id, privateMmActionID, "", legitMmCookie, nil, model.PostActionIntegrationFormatMmBlock)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestExecuteDialogAction(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	const route = "/actions/dialogs/execute"

	t.Run("happy path — 200 OK with trigger_id", func(t *testing.T) {
		var received model.PostActionIntegrationRequest
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := json.NewDecoder(r.Body).Decode(&received)
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
			Context:   map[string]string{"k": "v"},
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.NoError(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var apiResp model.ExecuteDialogActionResponse
		jsonErr := json.NewDecoder(resp.Body).Decode(&apiResp)
		require.NoError(t, jsonErr)
		assert.NotEmpty(t, apiResp.TriggerId)

		assert.Equal(t, "dialog_action", received.Type)
	})

	t.Run("empty TeamId succeeds — regression test for DM/GM channels not returning 403", func(t *testing.T) {
		user1 := th.CreateUser(t)
		dmChannel, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, user1.Id)
		require.NoError(t, err)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: dmChannel.Id,
			TeamId:    "",
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.NoError(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("user without channel read permission gets 403", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		// BasicUser2 is not a member of the private channel
		otherClient := th.CreateClient()
		th.LoginBasic2WithClient(t, otherClient)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: privateChannel.Id,
			TeamId:    th.BasicTeam.Id,
		})
		require.NoError(t, err)

		resp, err := otherClient.DoAPIPost(context.Background(), route, string(body))
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(resp))
	})

	t.Run("empty URL returns 400", func(t *testing.T) {
		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       "",
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(resp))
	})

	t.Run("invalid URL returns 400", func(t *testing.T) {
		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       "not-a-valid-url",
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(resp))
	})

	t.Run("client-supplied invalid team ID is ignored — succeeds via server-loaded channel.TeamId", func(t *testing.T) {
		// The handler overwrites request.TeamId with channel.TeamId before calling
		// ExecuteDialogAction. This test captures the PostActionIntegrationRequest
		// forwarded to the integration and asserts that TeamId reflects the channel's
		// real team, not the bogus value supplied by the client.
		var capturedReq model.PostActionIntegrationRequest
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := json.NewDecoder(r.Body).Decode(&capturedReq)
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		// A bogus client-supplied TeamId must be ignored: the handler derives the
		// team from the server-loaded channel, so the request succeeds rather than
		// 403-ing on the bogus team or 500-ing on a team lookup of a non-existent id.
		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    model.NewId(), // bogus — handler must ignore this
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(resp))
		assert.Equal(t, th.BasicTeam.Id, capturedReq.TeamId,
			"forwarded TeamId must be channel's real team, not the bogus client-supplied value")
	})

	t.Run("user lacking PermissionViewTeam on the channel's real team gets 403", func(t *testing.T) {
		// Removing view_team from the team-user role means BasicUser loses the
		// permission on BasicTeam. The handler checks PermissionViewTeam using the
		// server-loaded channel.TeamId, so the request must be rejected with 403.
		th.RemovePermissionFromRole(t, model.PermissionViewTeam.Id, model.TeamUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionViewTeam.Id, model.TeamUserRoleId)

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(resp))
	})

	t.Run("integration returns 500 — DoActionRequest non-200 path returns error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}))
		defer ts.Close()

		body, err := json.Marshal(model.ExecuteDialogActionRequest{
			URL:       ts.URL,
			ChannelId: th.BasicChannel.Id,
			TeamId:    th.BasicTeam.Id,
		})
		require.NoError(t, err)

		resp, err := client.DoAPIPost(context.Background(), route, string(body))
		require.Error(t, err)
		require.NotNil(t, resp)
		// DoActionRequest returns a 400 AppError on non-200 upstream responses;
		// the handler propagates it unchanged.
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
