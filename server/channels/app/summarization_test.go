// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestIsValidPermalinkURL(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	t.Run("valid permalink URL", func(t *testing.T) {
		url := "https://mattermost.example.com/myteam/pl/abcdefghijklmnopqrstuvwxyz"
		assert.True(t, isValidPermalinkURL(url, siteURL))
	})

	t.Run("valid permalink URL with hyphenated team name", func(t *testing.T) {
		url := "https://mattermost.example.com/my-team-name/pl/abcdefghijklmnopqrstuvwxyz"
		assert.True(t, isValidPermalinkURL(url, siteURL))
	})

	t.Run("javascript URI scheme", func(t *testing.T) {
		assert.False(t, isValidPermalinkURL("javascript:alert(document.cookie)", siteURL))
	})

	t.Run("data URI scheme", func(t *testing.T) {
		assert.False(t, isValidPermalinkURL("data:text/html,<script>alert(1)</script>", siteURL))
	})

	t.Run("vbscript URI scheme", func(t *testing.T) {
		assert.False(t, isValidPermalinkURL("vbscript:MsgBox(\"XSS\")", siteURL))
	})

	t.Run("different domain", func(t *testing.T) {
		url := "https://evil.com/myteam/pl/abcdefghijklmnopqrstuvwxyz"
		assert.False(t, isValidPermalinkURL(url, siteURL))
	})

	t.Run("wrong path format - missing pl segment", func(t *testing.T) {
		url := "https://mattermost.example.com/myteam/channels/town-square"
		assert.False(t, isValidPermalinkURL(url, siteURL))
	})

	t.Run("wrong path format - invalid post ID length", func(t *testing.T) {
		url := "https://mattermost.example.com/myteam/pl/short"
		assert.False(t, isValidPermalinkURL(url, siteURL))
	})

	t.Run("extra path segments after post ID", func(t *testing.T) {
		url := "https://mattermost.example.com/myteam/pl/abcdefghijklmnopqrstuvwxyz/extra"
		assert.False(t, isValidPermalinkURL(url, siteURL))
	})

	t.Run("empty URL", func(t *testing.T) {
		assert.False(t, isValidPermalinkURL("", siteURL))
	})

	t.Run("site URL prefix attack - longer domain", func(t *testing.T) {
		url := "https://mattermost.example.com.evil.com/myteam/pl/abcdefghijklmnopqrstuvwxyz"
		assert.False(t, isValidPermalinkURL(url, siteURL))
	})
}

func TestSanitizePermalinks(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	t.Run("keeps valid permalinks", func(t *testing.T) {
		items := []string{
			"Team decided on microservices [PERMALINK:https://mattermost.example.com/myteam/pl/abcdefghijklmnopqrstuvwxyz]",
		}
		result := sanitizePermalinks(items, siteURL)
		assert.Equal(t, items, result)
	})

	t.Run("strips javascript permalink", func(t *testing.T) {
		items := []string{
			"Malicious item [PERMALINK:javascript:alert(1)]",
		}
		result := sanitizePermalinks(items, siteURL)
		assert.Equal(t, []string{"Malicious item "}, result)
	})

	t.Run("strips data URI permalink", func(t *testing.T) {
		items := []string{
			"Data URI item [PERMALINK:data:text/html,<script>alert(1)</script>]",
		}
		result := sanitizePermalinks(items, siteURL)
		assert.Equal(t, []string{"Data URI item "}, result)
	})

	t.Run("strips permalink with wrong domain", func(t *testing.T) {
		items := []string{
			"Wrong domain [PERMALINK:https://evil.com/team/pl/abcdefghijklmnopqrstuvwxyz]",
		}
		result := sanitizePermalinks(items, siteURL)
		assert.Equal(t, []string{"Wrong domain "}, result)
	})

	t.Run("handles items without permalinks", func(t *testing.T) {
		items := []string{
			"No permalink here",
			"Just a regular item",
		}
		result := sanitizePermalinks(items, siteURL)
		assert.Equal(t, items, result)
	})

	t.Run("handles nil input", func(t *testing.T) {
		result := sanitizePermalinks(nil, siteURL)
		assert.Nil(t, result)
	})

	t.Run("handles empty input", func(t *testing.T) {
		result := sanitizePermalinks([]string{}, siteURL)
		assert.Equal(t, []string{}, result)
	})

	t.Run("mixed valid and invalid permalinks", func(t *testing.T) {
		items := []string{
			"Valid item [PERMALINK:https://mattermost.example.com/myteam/pl/abcdefghijklmnopqrstuvwxyz]",
			"Invalid item [PERMALINK:javascript:alert(1)]",
			"No permalink item",
		}
		result := sanitizePermalinks(items, siteURL)
		assert.Equal(t, items[0], result[0])
		assert.Equal(t, "Invalid item ", result[1])
		assert.Equal(t, "No permalink item", result[2])
	})
}

func TestBuildConversationText(t *testing.T) {
	t.Run("build conversation with posts", func(t *testing.T) {
		posts := []*model.Post{
			{
				Id:       model.NewId(),
				Message:  "Hello world",
				UserId:   "user1",
				CreateAt: 1234567890000,
				Props: model.StringInterface{
					"username": "john_doe",
				},
			},
			{
				Id:       model.NewId(),
				Message:  "How are you?",
				UserId:   "user2",
				CreateAt: 1234567895000,
				Props: model.StringInterface{
					"username": "jane_smith",
				},
			},
		}

		result, _ := buildConversationTextWithIDs(posts)
		assert.Contains(t, result, "john_doe")
		assert.Contains(t, result, "jane_smith")
		assert.Contains(t, result, "Hello world")
		assert.Contains(t, result, "How are you?")
	})

	t.Run("build conversation with posts without username", func(t *testing.T) {
		posts := []*model.Post{
			{
				Id:       model.NewId(),
				Message:  "Test message",
				UserId:   "user123",
				CreateAt: 1234567890000,
				Props:    model.StringInterface{},
			},
		}

		result, _ := buildConversationTextWithIDs(posts)
		// Should fallback to user ID when no username prop
		assert.Contains(t, result, "user123")
		assert.Contains(t, result, "Test message")
	})

	t.Run("build conversation with empty posts", func(t *testing.T) {
		posts := []*model.Post{}
		result, _ := buildConversationTextWithIDs(posts)
		assert.Equal(t, "", result)
	})
}
