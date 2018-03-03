// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// https://github.com/mattermost/mattermost-server/issues/8205
func TestClient4CreatePost(t *testing.T) {
	post := &Post{
		Props: map[string]interface{}{
			"attachments": []*SlackAttachment{
				&SlackAttachment{
					Actions: []*PostAction{
						&PostAction{
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
			&SlackAttachment{
				Actions: []*PostAction{
					&PostAction{
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
