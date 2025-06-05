// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestLookupInteractiveDialog(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
	})

	t.Run("successful lookup with items", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var request model.SubmitDialogRequest
			err := json.NewDecoder(r.Body).Decode(&request)
			require.NoError(t, err)

			// Verify request fields
			assert.Equal(t, "dialog_lookup", request.Type)
			assert.Equal(t, th.BasicUser.Id, request.UserId)
			assert.Equal(t, th.BasicChannel.Id, request.ChannelId)
			assert.Equal(t, th.BasicTeam.Id, request.TeamId)
			assert.Equal(t, "test_query", request.Submission["query"])
			assert.Equal(t, "test_field", request.Submission["selected_field"])

			response := model.LookupDialogResponse{
				Items: []model.DialogSelectOption{
					{Text: "Option 1", Value: "opt1"},
					{Text: "Option 2", Value: "opt2"},
				},
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			CallbackId: "callback123",
			State:      "somestate",
			Submission: map[string]any{
				"query":          "test_query",
				"selected_field": "test_field",
			},
		}

		resp, err := th.App.LookupInteractiveDialog(request.EmptyContext(th.Context.Logger()), lookup)
		require.Nil(t, err)
		require.NotNil(t, resp)
		assert.Len(t, resp.Items, 2)
		assert.Equal(t, "Option 1", resp.Items[0].Text)
		assert.Equal(t, "opt1", resp.Items[0].Value)
	})

	t.Run("empty response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := model.LookupDialogResponse{
				Items: []model.DialogSelectOption{},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{},
		}

		resp, err := th.App.LookupInteractiveDialog(request.EmptyContext(th.Context.Logger()), lookup)
		require.Nil(t, err)
		require.NotNil(t, resp)
		assert.Len(t, resp.Items, 0)
	})

	t.Run("error response", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error": "Bad request"}`))
		}))
		defer ts.Close()

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{},
		}

		resp, err := th.App.LookupInteractiveDialog(request.EmptyContext(th.Context.Logger()), lookup)
		require.NotNil(t, err)
		require.Nil(t, resp)
		assert.Equal(t, http.StatusBadRequest, err.StatusCode)
	})

	t.Run("invalid URL", func(t *testing.T) {
		lookup := model.SubmitDialogRequest{
			URL:        "invalid-url",
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{},
		}

		resp, err := th.App.LookupInteractiveDialog(request.EmptyContext(th.Context.Logger()), lookup)
		require.NotNil(t, err)
		require.Nil(t, resp)
		assert.Contains(t, err.Error(), "missing protocol scheme")
	})

	t.Run("timeout", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Sleep longer than the timeout
			time.Sleep(2 * time.Second)
			response := model.LookupDialogResponse{
				Items: []model.DialogSelectOption{},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer ts.Close()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = model.NewPointer(int64(1))
		})

		lookup := model.SubmitDialogRequest{
			URL:        ts.URL,
			UserId:     th.BasicUser.Id,
			ChannelId:  th.BasicChannel.Id,
			TeamId:     th.BasicTeam.Id,
			Submission: map[string]any{},
		}

		resp, err := th.App.LookupInteractiveDialog(request.EmptyContext(th.Context.Logger()), lookup)
		require.NotNil(t, err)
		require.Nil(t, resp)
		assert.Contains(t, err.Error(), "context deadline exceeded")
	})
}
