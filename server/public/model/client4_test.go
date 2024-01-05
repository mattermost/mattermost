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
			"attachments": []*model.SlackAttachment{
				{
					Actions: []*model.PostAction{
						{
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
