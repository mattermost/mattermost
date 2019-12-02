// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// https://github.com/mattermost/mattermost-server/v5/issues/8205
func TestClient4CreatePost(t *testing.T) {
	post := &Post{
		Props: map[string]interface{}{
			"attachments": []*SlackAttachment{
				{
					Actions: []*PostAction{
						{
							Integration: &PostActionIntegration{
								Context: map[string]interface{}{
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
		attachments := PostFromJson(r.Body).Attachments()
		assert.Equal(t, []*SlackAttachment{
			{
				Actions: []*PostAction{
					{
						Integration: &PostActionIntegration{
							Context: map[string]interface{}{
								"foo": "bar",
							},
							URL: "http://foo.com",
						},
						Name: "Foo",
					},
				},
			},
		}, attachments)
	}))

	client := NewAPIv4Client(server.URL)
	_, resp := client.CreatePost(post)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestClient4SetToken(t *testing.T) {
	expected := NewId()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get(HEADER_AUTH)

		token := strings.Split(authHeader, HEADER_BEARER)

		if len(token) < 2 {
			t.Errorf("wrong authorization header format, got %s, expected: %s %s", authHeader, HEADER_BEARER, expected)
		}

		assert.Equal(t, expected, strings.TrimSpace(token[1]))
	}))

	client := NewAPIv4Client(server.URL)
	client.SetToken(expected)

	_, resp := client.GetMe("")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestClient4MockSession(t *testing.T) {
	expected := NewId()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get(HEADER_AUTH)

		token := strings.Split(authHeader, HEADER_BEARER)

		if len(token) < 2 {
			t.Errorf("wrong authorization header format, got %s, expected: %s %s", authHeader, HEADER_BEARER, expected)
		}

		assert.Equal(t, expected, strings.TrimSpace(token[1]))
	}))

	client := NewAPIv4Client(server.URL)
	client.MockSession(expected)

	_, resp := client.GetMe("")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
