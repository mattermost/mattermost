// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
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

	t.Run("SlackAttachment form with text only", func(t *testing.T) {
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
					model.PostPropsAttachments: []*model.SlackAttachment{
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

	t.Run("SlackAttachment form indexes title, pretext, fallback, and fields", func(t *testing.T) {
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
					model.PostPropsAttachments: []*model.SlackAttachment{
						{
							Title:    "Build Failed",
							Pretext:  "CI notification",
							Fallback: "Build Failed on main",
							Text:     "Details here",
							Fields: []*model.SlackAttachmentField{
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
					model.PostPropsAttachments: []*model.SlackAttachment{
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
					model.PostPropsAttachments: []*model.SlackAttachment{
						nil,
						{
							Text: "valid",
							Fields: []*model.SlackAttachmentField{
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

	t.Run("non-string field values in SlackAttachment form are indexed", func(t *testing.T) {
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
					model.PostPropsAttachments: []*model.SlackAttachment{
						{
							Text: "metrics",
							Fields: []*model.SlackAttachmentField{
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
