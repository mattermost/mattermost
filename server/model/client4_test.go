// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// https://github.com/mattermost/mattermost-plugin-starter-template/issues/115
func TestClient4TrimTrailingSlash(t *testing.T) {
	slashes := []int{0, 1, 5}
	baseURL := "https://foo.com:1234"

	for _, s := range slashes {
		testURL := baseURL + strings.Repeat("/", s)
		client := NewAPIv4Client(testURL)
		assert.Equal(t, baseURL, client.URL)
		assert.Equal(t, baseURL+APIURLSuffix, client.APIURL)
	}
}

// https://github.com/mattermost/mattermost-server/server/v7/channels/issues/8205
func TestClient4CreatePost(t *testing.T) {
	post := &Post{
		Props: map[string]any{
			"attachments": []*SlackAttachment{
				{
					Actions: []*PostAction{
						{
							Integration: &PostActionIntegration{
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
		var post Post
		err := json.NewDecoder(r.Body).Decode(&post)
		assert.NoError(t, err)
		attachments := post.Attachments()
		assert.Equal(t, []*SlackAttachment{
			{
				Actions: []*PostAction{
					{
						Integration: &PostActionIntegration{
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

	client := NewAPIv4Client(server.URL)
	_, resp, err := client.CreatePost(post)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestClient4SetToken(t *testing.T) {
	expected := NewId()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get(HeaderAuth)

		token := strings.Split(authHeader, HeaderBearer)

		if len(token) < 2 {
			t.Errorf("wrong authorization header format, got %s, expected: %s %s", authHeader, HeaderBearer, expected)
		}

		assert.Equal(t, expected, strings.TrimSpace(token[1]))

		var user User
		err := json.NewEncoder(w).Encode(&user)
		assert.NoError(t, err)
	}))

	client := NewAPIv4Client(server.URL)
	client.SetToken(expected)

	_, resp, err := client.GetMe("")
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
