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
	// Create one with attachments in 'any' form.

	post1 := model.PostForIndexing{
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
				"attachments": []any{
					map[string]any{
						"text": "text 1",
					},
				},
			},
		},
	}

	espost1 := ESPostFromPostForIndexing(&post1)

	assert.Equal(t, post1.Id, espost1.Id)
	assert.Equal(t, post1.TeamId, espost1.TeamId)
	assert.Equal(t, post1.ChannelId, espost1.ChannelId)
	assert.Equal(t, post1.UserId, espost1.UserId)
	assert.Equal(t, post1.CreateAt, espost1.CreateAt)
	assert.Equal(t, post1.Message, espost1.Message)
	assert.Equal(t, "default", espost1.Type)
	assert.Empty(t, espost1.Hashtags)
	assert.Equal(t, "text 1", espost1.Attachments)

	// Create one with attachments in model.SlackAttachment form.

	post2 := model.PostForIndexing{
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
				"attachments": []*model.SlackAttachment{
					{
						Text: "text 2",
					},
				},
			},
		},
	}

	espost2 := ESPostFromPostForIndexing(&post2)

	assert.Equal(t, post2.Id, espost2.Id)
	assert.Equal(t, post2.TeamId, espost2.TeamId)
	assert.Equal(t, post2.ChannelId, espost2.ChannelId)
	assert.Equal(t, post2.UserId, espost2.UserId)
	assert.Equal(t, post2.CreateAt, espost2.CreateAt)
	assert.Equal(t, post2.Message, espost2.Message)
	assert.Equal(t, "slack_attachment", espost2.Type)
	assert.Len(t, espost2.Hashtags, 2)
	assert.Equal(t, "text 2", espost2.Attachments)
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
