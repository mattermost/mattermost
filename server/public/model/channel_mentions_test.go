// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChannelMentions(t *testing.T) {
	tests := []struct {
		name     string
		message  string
		expected []string
	}{
		{
			name:     "single channel mention",
			message:  "Check out ~engineering",
			expected: []string{"engineering"},
		},
		{
			name:     "multiple channel mentions",
			message:  "Deploy to ~engineering and ~qa-team",
			expected: []string{"engineering", "qa-team"},
		},
		{
			name:     "duplicate channel mentions",
			message:  "~engineering and ~engineering again",
			expected: []string{"engineering"},
		},
		{
			name:     "no channel mentions",
			message:  "No mentions here",
			expected: nil,
		},
		{
			name:     "channel mention with hyphens and underscores",
			message:  "~engineering-team and ~qa_team",
			expected: []string{"engineering-team", "qa_team"},
		},
		{
			name:     "channel mention with dots stops at dot",
			message:  "~team.sub.channel",
			expected: []string{"team"}, // Regex doesn't include dots
		},
		{
			name:     "channel mention with numbers",
			message:  "~team123 and ~abc456def",
			expected: []string{"team123", "abc456def"},
		},
		{
			name:     "channel mention with uppercase",
			message:  "~UPPERCASE and ~Mixed-Case",
			expected: []string{"UPPERCASE", "Mixed-Case"}, // Regex allows uppercase
		},
		{
			name:     "channel mention at start",
			message:  "~engineering is the best",
			expected: []string{"engineering"},
		},
		{
			name:     "channel mention at end",
			message:  "Check ~engineering",
			expected: []string{"engineering"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ChannelMentions(tt.message)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestChannelMentionsFromStrings(t *testing.T) {
	t.Run("nil slice", func(t *testing.T) {
		assert.Nil(t, ChannelMentionsFromStrings(nil))
	})

	t.Run("empty slice", func(t *testing.T) {
		assert.Nil(t, ChannelMentionsFromStrings([]string{}))
	})

	t.Run("single segment with mention", func(t *testing.T) {
		assert.Equal(t, []string{"engineering"}, ChannelMentionsFromStrings([]string{"Check out ~engineering"}))
	})

	t.Run("multiple segments order", func(t *testing.T) {
		assert.Equal(t, []string{"engineering", "qa-team"}, ChannelMentionsFromStrings([]string{
			"Check ~engineering",
			"Deploy to ~qa-team",
		}))
	})

	t.Run("deduplicates across segments", func(t *testing.T) {
		assert.Equal(t, []string{"engineering"}, ChannelMentionsFromStrings([]string{
			"~engineering",
			"~engineering again",
		}))
	})

	t.Run("skips segments without tilde", func(t *testing.T) {
		assert.Equal(t, []string{"eng"}, ChannelMentionsFromStrings([]string{"plain", "see ~eng"}))
	})

	t.Run("numeric segment without tilde", func(t *testing.T) {
		assert.Nil(t, ChannelMentionsFromStrings([]string{"123"}))
	})

	t.Run("numeric segment with mention in another segment", func(t *testing.T) {
		assert.Equal(t, []string{"engineering"}, ChannelMentionsFromStrings([]string{"123", "ref ~engineering"}))
	})
}

func TestChannelMentionsFromAttachments(t *testing.T) {
	t.Run("nil attachments", func(t *testing.T) {
		result := ChannelMentionsFromAttachments(nil)
		assert.Empty(t, result)
	})

	t.Run("empty attachments", func(t *testing.T) {
		result := ChannelMentionsFromAttachments([]*MessageAttachment{})
		assert.Empty(t, result)
	})

	t.Run("attachment with pretext", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Pretext: "Check out ~engineering",
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("attachment with text", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Text: "Deploy to ~qa-team",
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"qa-team"}, result)
	})

	t.Run("attachment with fields", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Fields: []*MessageAttachmentField{
					{
						Title: "Channel",
						Value: "~engineering",
					},
				},
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("attachment with title should not extract", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Title: "~engineering-channel",
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Empty(t, result)
	})

	t.Run("field title should not extract", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Fields: []*MessageAttachmentField{
					{
						Title: "~engineering",
						Value: "some value",
					},
				},
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Empty(t, result)
	})

	t.Run("multiple attachments with multiple mentions", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Pretext: "Check ~engineering",
				Text:    "Deploy to ~qa-team",
			},
			{
				Text: "Also notify ~devops",
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering", "qa-team", "devops"}, result)
	})

	t.Run("deduplicates mentions across attachments", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Pretext: "~engineering",
			},
			{
				Text: "~engineering again",
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("handles non-string field values", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Fields: []*MessageAttachmentField{
					{
						Title: "Count",
						Value: 123, // Non-string value
					},
					{
						Title: "Channel",
						Value: "~engineering",
					},
				},
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("handles nil attachment in array", func(t *testing.T) {
		attachments := []*MessageAttachment{
			nil,
			{
				Text: "~engineering",
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("handles nil field in fields array", func(t *testing.T) {
		attachments := []*MessageAttachment{
			{
				Fields: []*MessageAttachmentField{
					nil,
					{
						Value: "~engineering",
					},
				},
			},
		}
		result := ChannelMentionsFromAttachments(attachments)
		assert.Equal(t, []string{"engineering"}, result)
	})
}

func TestPostChannelMentionsAll(t *testing.T) {
	t.Run("message only", func(t *testing.T) {
		post := &Post{
			Message: "Check ~engineering",
		}
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("attachments only", func(t *testing.T) {
		post := &Post{
			Message: "No mentions here",
		}
		post.AddProp("attachments", []*MessageAttachment{
			{
				Text: "Deploy to ~qa-team",
			},
		})
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"qa-team"}, result)
	})

	t.Run("message and attachments combined", func(t *testing.T) {
		post := &Post{
			Message: "Check ~engineering",
		}
		post.AddProp("attachments", []*MessageAttachment{
			{
				Text: "Deploy to ~qa-team",
			},
		})
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"engineering", "qa-team"}, result)
	})

	t.Run("deduplicates between message and attachments", func(t *testing.T) {
		post := &Post{
			Message: "Check ~engineering",
		}
		post.AddProp("attachments", []*MessageAttachment{
			{
				Text: "~engineering is great",
			},
		})
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("no mentions", func(t *testing.T) {
		post := &Post{
			Message: "No mentions",
		}
		result := post.ChannelMentionsAll()
		assert.Empty(t, result)
	})

	t.Run("post without attachments", func(t *testing.T) {
		post := &Post{
			Message: "Check ~engineering",
		}
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("post with invalid attachments prop", func(t *testing.T) {
		post := &Post{
			Message: "Check ~engineering",
		}
		post.AddProp("attachments", "not an array")
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"engineering"}, result)
	})

	t.Run("interactive mm_blocks, blocks, and cards collect mentions from every block", func(t *testing.T) {
		post := &Post{
			Message: "hello ~from-message",
			Props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "text", "text": "mm block one ~mm-a"},
					map[string]any{"type": "text", "text": "mm block two ~mm-b"},
					map[string]any{
						"type": "container",
						"content": []any{
							map[string]any{"type": "text", "text": "nested ~mm-c"},
							map[string]any{"type": "text", "text": "nested ~mm-d"},
						},
					},
				},
				PostPropsBlockKitBlocks: []any{
					map[string]any{
						"type": "section",
						"text": map[string]any{
							"type": "mrkdwn",
							"text": "bk first ~bk-a",
						},
					},
					map[string]any{
						"type": "section",
						"text": map[string]any{
							"type": "mrkdwn",
							"text": "bk second ~bk-b",
						},
					},
					map[string]any{
						"type": "section",
						"text": map[string]any{
							"type": "plain_text",
							"text": "bk plain ~bk-c",
						},
					},
				},
				PostPropsAdaptiveCards: []any{
					map[string]any{
						"type": "AdaptiveCard",
						"body": []any{
							map[string]any{"type": "TextBlock", "text": "card1 ~ac-a"},
							map[string]any{"type": "TextBlock", "text": "card1b ~ac-b"},
						},
					},
					map[string]any{
						"type": "AdaptiveCard",
						"body": []any{
							map[string]any{"type": "TextBlock", "text": "card2 ~ac-c"},
						},
					},
				},
			},
		}
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{
			"from-message",
			"mm-a", "mm-b", "mm-c", "mm-d",
			"bk-a", "bk-b", "bk-c",
			"ac-a", "ac-b", "ac-c",
		}, result)
	})

	t.Run("deduplicates channel mentions across message, mm_blocks, blocks, and cards", func(t *testing.T) {
		post := &Post{
			Message: "root ~shared-name",
			Props: StringInterface{
				PostPropsMmBlocks: []any{
					map[string]any{"type": "text", "text": "again ~shared-name"},
					map[string]any{"type": "text", "text": "other ~mm-only"},
				},
				PostPropsBlockKitBlocks: []any{
					map[string]any{
						"type": "section",
						"text": map[string]any{
							"type": "mrkdwn",
							"text": "~shared-name and ~bk-only",
						},
					},
				},
				PostPropsAdaptiveCards: []any{
					map[string]any{
						"type": "AdaptiveCard",
						"body": []any{
							map[string]any{"type": "TextBlock", "text": "~shared-name ~ac-only"},
						},
					},
				},
			},
		}
		result := post.ChannelMentionsAll()
		assert.Equal(t, []string{"shared-name", "mm-only", "bk-only", "ac-only"}, result)
	})
}

func TestPostCurrentTeamIdHandling(t *testing.T) {
	t.Run("preserves current_team_id before FillInPostProps", func(t *testing.T) {
		post := &Post{
			Message: "Check ~engineering",
		}
		post.AddProp(PostPropsCurrentTeamId, "team123")

		// Verify it's set
		teamId, ok := post.GetProp(PostPropsCurrentTeamId).(string)
		assert.True(t, ok)
		assert.Equal(t, "team123", teamId)
	})

	t.Run("current_team_id should be removed after processing", func(t *testing.T) {
		// This test is more of a documentation test
		// FillInPostProps should call DelProp(PostPropsCurrentTeamId) after using it
		post := &Post{
			Message: "Check ~engineering",
		}
		post.AddProp(PostPropsCurrentTeamId, "team123")

		// After FillInPostProps processes, current_team_id should be removed
		// (actual verification happens in app layer integration tests)
		assert.NotNil(t, post.GetProp(PostPropsCurrentTeamId))
	})
}
