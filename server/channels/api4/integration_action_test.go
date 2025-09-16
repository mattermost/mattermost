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
	th := Setup(t).InitBasic()
	defer th.TearDown()
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
					model.PostPropsAttachments: []*model.SlackAttachment{
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

			resp, err := client.DoPostActionWithCookie(context.Background(), post.Id, test.Action.Id, "", test.Action.Cookie)
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

func TestOpenDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()
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
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = model.NewPointer(int64(1))
		})

		time.Sleep(2 * time.Second)

		_, err := client.OpenInteractiveDialog(context.Background(), request)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "Trigger ID for interactive dialog is expired.")
	})
}

func TestSubmitDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()
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
		assert.Equal(t, request.ChannelId, submit.ChannelId)
		assert.Equal(t, request.TeamId, submit.TeamId)
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

	submit.URL = ts.URL
	submit.ChannelId = th.BasicChannel.Id
	submit.TeamId = model.NewId()
	submitResp, resp, err = client.SubmitInteractiveDialog(context.Background(), submit)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	assert.Nil(t, submitResp)
}

func TestLookupDialog(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()
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

	t.Run("should fail on invalid team ID", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			CallbackId: "callbackid",
			State:      "somestate",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     model.NewId(),
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
}
