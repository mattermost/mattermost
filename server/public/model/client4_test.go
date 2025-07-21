// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model_test

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

// https://github.com/mattermost/mattermost-plugin-starter-template/issues/115
func TestClient4TrimTrailingSlash(t *testing.T) {
	slashes := []int{0, 1, 5}
	baseURL := "https://foo.com:1234"

	for _, s := range slashes {
		testURL := baseURL + strings.Repeat("/", s)
		client := model.NewAPIv4Client(testURL)
		assert.Equal(t, baseURL, client.URL)
		assert.Equal(t, baseURL+model.APIURLSuffix, client.APIURL)
	}
}

// https://github.com/mattermost/mattermost/server/v8/channels/issues/8205
func TestClient4CreatePost(t *testing.T) {
	post := &model.Post{
		Props: map[string]any{
			model.PostPropsAttachments: []*model.SlackAttachment{
				{
					Actions: []*model.PostAction{
						{
							Type: model.PostActionTypeButton,
							Integration: &model.PostActionIntegration{
								Context: map[string]any{
									"foo": "bar",
								},
								URL: "http://foo.com",
							},
							Name: "Foo",
						},
					},
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var post model.Post
		err := json.NewDecoder(r.Body).Decode(&post)
		assert.NoError(t, err)
		attachments := post.Attachments()
		assert.Equal(t, []*model.SlackAttachment{
			{
				Actions: []*model.PostAction{
					{
						Type: model.PostActionTypeButton,
						Integration: &model.PostActionIntegration{
							Context: map[string]any{
								"foo": "bar",
							},
							URL: "http://foo.com",
						},
						Name: "Foo",
					},
				},
			},
		}, attachments)
		err = json.NewEncoder(w).Encode(&post)
		assert.NoError(t, err)
	}))

	client := model.NewAPIv4Client(server.URL)
	_, resp, err := client.CreatePost(context.Background(), post)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestClient4SetToken(t *testing.T) {
	expected := model.NewId()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get(model.HeaderAuth)

		token := strings.Split(authHeader, model.HeaderBearer)

		if len(token) < 2 {
			t.Errorf("wrong authorization header format, got %s, expected: %s %s", authHeader, model.HeaderBearer, expected)
		}

		assert.Equal(t, expected, strings.TrimSpace(token[1]))

		var user model.User
		err := json.NewEncoder(w).Encode(&user)
		assert.NoError(t, err)
	}))

	client := model.NewAPIv4Client(server.URL)
	client.SetToken(expected)

	_, resp, err := client.GetMe(context.Background(), "")
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestClient4RequestCancellation(t *testing.T) {
	t.Run("cancel before making the reqeust", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("request should not hit the server")
		}))

		client := model.NewAPIv4Client(server.URL)

		ctx, cancel := context.WithCancel(context.Background())

		cancel()

		_, resp, err := client.GetMe(ctx, "")
		assert.Error(t, err)
		assert.ErrorIs(t, err, context.Canceled)
		assert.Nil(t, resp)
	})

	t.Run("cancel after making the reqeust", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(100 * time.Millisecond)
			t.Fatal("request should not hit the server")
		}))

		client := model.NewAPIv4Client(server.URL)

		ctx, cancel := context.WithCancel(context.Background())

		done := make(chan struct{})
		go func() {
			_, resp, err := client.GetMe(ctx, "")
			assert.Error(t, err)
			assert.ErrorIs(t, err, context.Canceled)
			assert.Nil(t, resp)

			done <- struct{}{}
		}()
		cancel()

		<-done
	})
}

func TestClient4LookupInteractiveDialog(t *testing.T) {
	expectedResponse := model.LookupDialogResponse{
		Items: []model.DialogSelectOption{
			{Text: "Option 1", Value: "value1"},
			{Text: "Option 2", Value: "value2"},
			{Text: "Option 3", Value: "value3"},
		},
	}

	t.Run("should successfully perform lookup request", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Verify request method and endpoint
			assert.Equal(t, "POST", r.Method)
			assert.Equal(t, "/api/v4/actions/dialogs/lookup", r.URL.Path)

			// Decode and verify request body
			var submission model.SubmitDialogRequest
			err := json.NewDecoder(r.Body).Decode(&submission)
			assert.NoError(t, err)
			assert.Equal(t, "test_callback", submission.CallbackId)
			assert.Equal(t, "https://example.com/lookup", submission.URL)
			assert.Equal(t, "test_state", submission.State)

			// Send response
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			err = json.NewEncoder(w).Encode(expectedResponse)
			assert.NoError(t, err)
		}))
		defer server.Close()

		client := model.NewAPIv4Client(server.URL)
		submission := &model.SubmitDialogRequest{
			CallbackId: "test_callback",
			URL:        "https://example.com/lookup",
			State:      "test_state",
			UserId:     "test_user_id",
			ChannelId:  "test_channel_id",
			TeamId:     "test_team_id",
			Submission: map[string]any{
				"selected_field": "dynamic_field",
				"query":          "search_term",
			},
		}

		response, resp, err := client.LookupInteractiveDialog(context.Background(), *submission)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, expectedResponse, *response)
		assert.Len(t, response.Items, 3)
		assert.Equal(t, "Option 1", response.Items[0].Text)
		assert.Equal(t, "value1", response.Items[0].Value)
	})

	t.Run("should handle empty response", func(t *testing.T) {
		emptyResponse := model.LookupDialogResponse{Items: []model.DialogSelectOption{}}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			err := json.NewEncoder(w).Encode(emptyResponse)
			assert.NoError(t, err)
		}))
		defer server.Close()

		client := model.NewAPIv4Client(server.URL)
		submission := &model.SubmitDialogRequest{
			CallbackId: "test_callback",
			URL:        "https://example.com/lookup",
		}

		response, resp, err := client.LookupInteractiveDialog(context.Background(), *submission)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, emptyResponse, *response)
		assert.Empty(t, response.Items)
	})

	t.Run("should handle server error response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			errorResponse := model.AppError{
				Id:      "api.dialog.lookup.bad_request",
				Message: "Invalid request parameters",
			}
			err := json.NewEncoder(w).Encode(errorResponse)
			assert.NoError(t, err)
		}))
		defer server.Close()

		client := model.NewAPIv4Client(server.URL)
		submission := &model.SubmitDialogRequest{
			CallbackId: "invalid_callback",
			URL:        "invalid_url",
		}

		response, resp, err := client.LookupInteractiveDialog(context.Background(), *submission)
		assert.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		assert.Nil(t, response)

		// Verify error is an AppError
		appError, ok := err.(*model.AppError)
		assert.True(t, ok)
		assert.Equal(t, "api.dialog.lookup.bad_request", appError.Id)
	})

	t.Run("should handle network connectivity issues", func(t *testing.T) {
		// Use an invalid URL to simulate network failure
		client := model.NewAPIv4Client("http://invalid-server-url:9999")
		submission := &model.SubmitDialogRequest{
			CallbackId: "test_callback",
			URL:        "https://example.com/lookup",
		}

		response, resp, err := client.LookupInteractiveDialog(context.Background(), *submission)
		assert.Error(t, err)
		assert.Nil(t, resp)
		assert.Nil(t, response)
	})

	t.Run("should handle request cancellation", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Simulate slow response
			time.Sleep(200 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		client := model.NewAPIv4Client(server.URL)
		submission := &model.SubmitDialogRequest{
			CallbackId: "test_callback",
			URL:        "https://example.com/lookup",
		}

		ctx, cancel := context.WithCancel(context.Background())

		// Cancel the request immediately
		cancel()

		response, resp, err := client.LookupInteractiveDialog(ctx, *submission)
		assert.Error(t, err)
		assert.ErrorIs(t, err, context.Canceled)
		assert.Nil(t, resp)
		assert.Nil(t, response)
	})

	t.Run("should handle invalid JSON response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// Send invalid JSON
			_, err := w.Write([]byte(`{"items": [invalid json}`))
			assert.NoError(t, err)
		}))
		defer server.Close()

		client := model.NewAPIv4Client(server.URL)
		submission := &model.SubmitDialogRequest{
			CallbackId: "test_callback",
			URL:        "https://example.com/lookup",
		}

		response, resp, err := client.LookupInteractiveDialog(context.Background(), *submission)
		assert.Error(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Nil(t, response)
	})

	t.Run("should properly set authorization header when token is provided", func(t *testing.T) {
		expectedToken := model.NewId()

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get(model.HeaderAuth)
			expectedAuthHeader := model.HeaderBearer + " " + expectedToken
			assert.Equal(t, expectedAuthHeader, authHeader)

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			err := json.NewEncoder(w).Encode(expectedResponse)
			assert.NoError(t, err)
		}))
		defer server.Close()

		client := model.NewAPIv4Client(server.URL)
		client.SetToken(expectedToken)

		submission := &model.SubmitDialogRequest{
			CallbackId: "test_callback",
			URL:        "https://example.com/lookup",
		}

		response, resp, err := client.LookupInteractiveDialog(context.Background(), *submission)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, expectedResponse, *response)
	})
}

func ExampleClient4_GetUsers() {
	client := model.NewAPIv4Client("http://localhost:8065")
	client.SetToken(os.Getenv("MM_TOKEN"))

	const perPage = 100
	var page int
	for {
		users, _, err := client.GetUsers(context.TODO(), page, perPage, "")
		if err != nil {
			log.Printf("error fetching users: %v", err)
			return
		}

		for _, u := range users {
			fmt.Printf("%s\n", u.Username)
		}

		if len(users) < perPage {
			break
		}

		page++
	}
}
