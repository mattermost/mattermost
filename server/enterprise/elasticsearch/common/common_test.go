// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestElasticsearchBuildPostIndexName(t *testing.T) {
	now := time.Date(2017, 8, 14, 15, 16, 17, 123, time.Local)

	sixDaysAgo := time.Date(2017, 8, 9, 12, 11, 10, 987, time.Local)
	sevenDaysAgo := time.Date(2017, 8, 8, 11, 10, 9, 876, time.Local)
	eightDaysAgo := time.Date(2017, 8, 7, 6, 5, 4, 321, time.Local)

	sixMillis := sixDaysAgo.UnixNano() / int64(time.Millisecond)
	sevenMillis := sevenDaysAgo.UnixNano() / int64(time.Millisecond)
	eightMillis := eightDaysAgo.UnixNano() / int64(time.Millisecond)

	aggregationCutoff := 7 // Aggregate monthly after 7 days.

	sixName := BuildPostIndexName(aggregationCutoff, IndexBasePosts, IndexBasePosts_MONTH, now, sixMillis)
	sevenName := BuildPostIndexName(aggregationCutoff, IndexBasePosts, IndexBasePosts_MONTH, now, sevenMillis)
	eightName := BuildPostIndexName(aggregationCutoff, IndexBasePosts, IndexBasePosts_MONTH, now, eightMillis)

	assert.Equal(t, sixName, "posts_2017_08_09")
	assert.Equal(t, sevenName, "posts_2017_08_08")
	assert.Equal(t, eightName, "postsmonth_2017_08")
}

func TestESPostFromPostForIndexing(t *testing.T) {
	t.Run("any form with text only", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId:         model.NewId(),
			ParentCreateAt: nil,
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "message",
				Type:      "",
				Hashtags:  "",
				Props: map[string]any{
					model.PostPropsAttachments: []any{
						map[string]any{
							"text": "text 1",
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Equal(t, post.Id, espost.Id)
		assert.Equal(t, post.TeamId, espost.TeamId)
		assert.Equal(t, post.ChannelId, espost.ChannelId)
		assert.Equal(t, post.UserId, espost.UserId)
		assert.Equal(t, post.CreateAt, espost.CreateAt)
		assert.Equal(t, post.Message, espost.Message)
		assert.Equal(t, "default", espost.Type)
		assert.Empty(t, espost.Hashtags)
		assert.Equal(t, "text 1", espost.Attachments)
	})

	t.Run("MessageAttachment form with text only", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId:         model.NewId(),
			ParentCreateAt: nil,
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "message",
				Type:      "slack_attachment",
				Hashtags:  "#buh #boh",
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "text 2",
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Equal(t, post.Id, espost.Id)
		assert.Equal(t, post.TeamId, espost.TeamId)
		assert.Equal(t, post.ChannelId, espost.ChannelId)
		assert.Equal(t, post.UserId, espost.UserId)
		assert.Equal(t, post.CreateAt, espost.CreateAt)
		assert.Equal(t, post.Message, espost.Message)
		assert.Equal(t, "slack_attachment", espost.Type)
		assert.Len(t, espost.Hashtags, 2)
		assert.Equal(t, "text 2", espost.Attachments)
	})

	t.Run("any form indexes title, pretext, fallback, and fields", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []any{
						map[string]any{
							"title":    "Build Failed",
							"pretext":  "CI notification",
							"fallback": "Build Failed on main",
							"text":     "Details here",
							"fields": []any{
								map[string]any{
									"title": "Branch",
									"value": "main",
								},
								map[string]any{
									"title": "Status",
									"value": "failed",
								},
							},
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "Details here")
		assert.Contains(t, espost.Attachments, "Build Failed")
		assert.Contains(t, espost.Attachments, "CI notification")
		assert.Contains(t, espost.Attachments, "Build Failed on main")
		assert.Contains(t, espost.Attachments, "Branch")
		assert.Contains(t, espost.Attachments, "main")
		assert.Contains(t, espost.Attachments, "Status")
		assert.Contains(t, espost.Attachments, "failed")
	})

	t.Run("MessageAttachment form indexes title, pretext, fallback, and fields", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Title:    "Build Failed",
							Pretext:  "CI notification",
							Fallback: "Build Failed on main",
							Text:     "Details here",
							Fields: []*model.MessageAttachmentField{
								{Title: "Branch", Value: "main"},
								{Title: "Status", Value: "failed"},
							},
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "Details here")
		assert.Contains(t, espost.Attachments, "Build Failed")
		assert.Contains(t, espost.Attachments, "CI notification")
		assert.Contains(t, espost.Attachments, "Build Failed on main")
		assert.Contains(t, espost.Attachments, "Branch")
		assert.Contains(t, espost.Attachments, "main")
		assert.Contains(t, espost.Attachments, "Status")
		assert.Contains(t, espost.Attachments, "failed")
	})

	t.Run("empty fields are excluded", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Title: "Only Title",
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Equal(t, "Only Title", espost.Attachments)
	})

	t.Run("nil fields and attachments are handled", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						nil,
						{
							Text: "valid",
							Fields: []*model.MessageAttachmentField{
								nil,
								{Title: "field title", Value: "field value"},
							},
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "valid")
		assert.Contains(t, espost.Attachments, "field title")
		assert.Contains(t, espost.Attachments, "field value")
	})

	t.Run("non-string field values are indexed", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []any{
						map[string]any{
							"text": "metrics",
							"fields": []any{
								map[string]any{
									"title": "Count",
									"value": 42,
								},
								map[string]any{
									"title": "Rate",
									"value": 99.5,
								},
							},
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "metrics")
		assert.Contains(t, espost.Attachments, "Count")
		assert.Contains(t, espost.Attachments, "42")
		assert.Contains(t, espost.Attachments, "Rate")
		assert.Contains(t, espost.Attachments, "99.5")
	})

	t.Run("non-string field values in MessageAttachment form are indexed", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text: "metrics",
							Fields: []*model.MessageAttachmentField{
								{Title: "Count", Value: 42},
								{Title: "Rate", Value: 99.5},
							},
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "metrics")
		assert.Contains(t, espost.Attachments, "Count")
		assert.Contains(t, espost.Attachments, "42")
		assert.Contains(t, espost.Attachments, "Rate")
		assert.Contains(t, espost.Attachments, "99.5")
	})

	t.Run("any form indexes footer and author_name", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []any{
						map[string]any{
							"text":        "body text",
							"footer":      "Opportunity #OPP-000035341 • United States",
							"author_name": "Salesforce",
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "body text")
		assert.Contains(t, espost.Attachments, "Opportunity #OPP-000035341 • United States")
		assert.Contains(t, espost.Attachments, "Salesforce")
	})

	t.Run("MessageAttachment form indexes footer and author_name", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []*model.MessageAttachment{
						{
							Text:       "body text",
							Footer:     "Opportunity #OPP-000035341 • United States",
							AuthorName: "Salesforce",
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "body text")
		assert.Contains(t, espost.Attachments, "Opportunity #OPP-000035341 • United States")
		assert.Contains(t, espost.Attachments, "Salesforce")
	})

	t.Run("multiple attachments are combined", func(t *testing.T) {
		post := model.PostForIndexing{
			TeamId: model.NewId(),
			Post: model.Post{
				Id:        model.NewId(),
				ChannelId: model.NewId(),
				UserId:    model.NewId(),
				CreateAt:  model.GetMillis(),
				Message:   "",
				Type:      "slack_attachment",
				Props: map[string]any{
					model.PostPropsAttachments: []any{
						map[string]any{
							"title": "First",
							"text":  "one",
						},
						map[string]any{
							"title": "Second",
							"text":  "two",
						},
					},
				},
			},
		}

		espost := ESPostFromPostForIndexing(&post)

		assert.Contains(t, espost.Attachments, "First")
		assert.Contains(t, espost.Attachments, "one")
		assert.Contains(t, espost.Attachments, "Second")
		assert.Contains(t, espost.Attachments, "two")
	})
}

// TestESPostFromPost_CreatePostJSONRoundTrip simulates the exact flow that happens
// in production: App.CreatePost converts []*MessageAttachment to []any via JSON
// marshal/unmarshal (Post.Attachments in post.go), then the search layer calls
// ESPostFromPost which does ShallowCopy → ESPostFromPostForIndexing.
func TestESPostFromPost_CreatePostJSONRoundTrip(t *testing.T) {
	// Step 1: Start with typed MessageAttachment (as a plugin/webhook would create)
	original := &model.Post{
		Id:        model.NewId(),
		ChannelId: model.NewId(),
		UserId:    model.NewId(),
		CreateAt:  model.GetMillis(),
		Message:   "#closedwon #renewal",
		Type:      "slack_attachment",
	}
	original.AddProp(model.PostPropsAttachments, []*model.MessageAttachment{
		{
			Title:      "Account: Acme Corp / Widget Industries, LLC",
			Text:       "Renewal ARR: $49,140.00",
			Pretext:    "#closedwon #renewal",
			Footer:     "Opportunity #OPP-000035341 • United States",
			AuthorName: "CRM Bot",
			Fields: []*model.MessageAttachmentField{
				{Title: "Sales Rep", Value: "Jane Smith"},
				{Title: "Account Manager", Value: "John Doe"},
				{Title: "Opportunity", Value: "Acme Corp / Widget Industries, LLC - Enterprise - 350 Seats - '26 Renewal"},
				{Title: "Seats", Value: 350.0},
			},
		},
	})

	// Step 2: Simulate CreatePost JSON round-trip (post.go:305-315)
	if attachments, ok := original.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment); ok {
		jsonAttachments, err := json.Marshal(attachments)
		require.NoError(t, err)
		attachmentsInterface := []any{}
		err = json.Unmarshal(jsonAttachments, &attachmentsInterface)
		require.NoError(t, err)
		original.AddProp(model.PostPropsAttachments, attachmentsInterface)
	} else {
		require.Fail(t, "expected []*MessageAttachment type assertion to succeed")
	}

	// Step 3: Simulate ESPostFromPost (what the search layer calls)
	teamId := model.NewId()
	esPost, err := ESPostFromPost(original, teamId, "O")
	require.NoError(t, err)

	// Step 4: Verify all attachment fields are indexed
	assert.Contains(t, esPost.Attachments, "Account: Acme Corp / Widget Industries, LLC", "title should be indexed")
	assert.Contains(t, esPost.Attachments, "Renewal ARR: $49,140.00", "text should be indexed")
	assert.Contains(t, esPost.Attachments, "#closedwon #renewal", "pretext should be indexed")

	// Field titles and values
	assert.Contains(t, esPost.Attachments, "Sales Rep", "field title should be indexed")
	assert.Contains(t, esPost.Attachments, "Jane Smith", "field value should be indexed")
	assert.Contains(t, esPost.Attachments, "Account Manager", "field title should be indexed")
	assert.Contains(t, esPost.Attachments, "John Doe", "field value should be indexed")
	assert.Contains(t, esPost.Attachments, "Opportunity", "field title should be indexed")
	assert.Contains(t, esPost.Attachments, "Acme Corp / Widget Industries, LLC - Enterprise - 350 Seats - '26 Renewal", "field value should be indexed")
	assert.Contains(t, esPost.Attachments, "350", "numeric field value should be indexed")

	// Footer and AuthorName
	assert.Contains(t, esPost.Attachments, "Opportunity #OPP-000035341 • United States", "footer should be indexed")
	assert.Contains(t, esPost.Attachments, "CRM Bot", "author_name should be indexed")

	t.Logf("Attachments field content: %s", esPost.Attachments)
}

// TestESPostFromPost_APIJSONUnmarshal simulates a post created via the REST API
// where Props are deserialized from JSON (attachments arrive as []any directly).
func TestESPostFromPost_APIJSONUnmarshal(t *testing.T) {
	// Simulate what happens when a bot POSTs JSON to /api/v4/posts
	postJSON := `{
		"channel_id": "` + model.NewId() + `",
		"message": "",
		"props": {
			"attachments": [{
				"title": "Account: Acme Corp",
				"text": "Renewal ARR: $49,140.00",
				"footer": "Opportunity #OPP-000035341",
				"author_name": "CRM Bot",
				"fields": [
					{"title": "Sales Rep", "value": "Jane Smith"},
					{"title": "Seats", "value": 350}
				]
			}]
		}
	}`

	var post model.Post
	err := json.Unmarshal([]byte(postJSON), &post)
	require.NoError(t, err)
	post.Id = model.NewId()
	post.UserId = model.NewId()
	post.CreateAt = model.GetMillis()

	// The CreatePost conversion at post.go:305-315 would NOT trigger here
	// because the type is already []any, not []*MessageAttachment
	_, typeOk := post.GetProp(model.PostPropsAttachments).([]*model.MessageAttachment)
	assert.False(t, typeOk, "API-created post should have []any, not []*MessageAttachment")

	esPost, err := ESPostFromPost(&post, model.NewId(), "O")
	require.NoError(t, err)

	assert.Contains(t, esPost.Attachments, "Account: Acme Corp", "title should be indexed")
	assert.Contains(t, esPost.Attachments, "Renewal ARR: $49,140.00", "text should be indexed")
	assert.Contains(t, esPost.Attachments, "Sales Rep", "field title should be indexed")
	assert.Contains(t, esPost.Attachments, "Jane Smith", "field value should be indexed")
	assert.Contains(t, esPost.Attachments, "350", "numeric field value should be indexed")
	assert.Contains(t, esPost.Attachments, "Opportunity #OPP-000035341", "footer should be indexed")
	assert.Contains(t, esPost.Attachments, "CRM Bot", "author_name should be indexed")

	t.Logf("Attachments field content: %s", esPost.Attachments)
}

func TestGetMatchesForHit(t *testing.T) {
	snippets := map[string][]string{
		"message": {
			"<em>Apples</em> and oranges and <em>apple</em> and orange",
			"Johnny <em>Appleseed</em>",
			"That doesn't <em>apply</em> to me, and it doesn't <em>apply</em> to you.",
		},
		"hashtags": {
			"This is an <em>#hashtag</em>",
		},
	}
	expected := []string{
		"Apples",
		"apple",
		"Appleseed",
		"apply",
		"#hashtag",
	}

	actual, err := GetMatchesForHit(snippets)
	require.NoError(t, err)
	require.ElementsMatch(t, expected, actual)
}
