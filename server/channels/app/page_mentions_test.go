// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestGetPreviouslyNotifiedMentions(t *testing.T) {
	th := Setup(t)

	t.Run("empty props returns empty slice", func(t *testing.T) {
		page := &model.Post{}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.Empty(t, result)
	})

	t.Run("nil props returns empty slice", func(t *testing.T) {
		page := &model.Post{Props: nil}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.Empty(t, result)
	})

	t.Run("notified_mentions not present returns empty slice", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"other_prop": "value",
			},
		}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.Empty(t, result)
	})

	t.Run("notified_mentions as []string", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"notified_mentions": []string{"user1", "user2", "user3"},
			},
		}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.ElementsMatch(t, []string{"user1", "user2", "user3"}, result)
	})

	t.Run("notified_mentions as []any", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"notified_mentions": []any{"user1", "user2"},
			},
		}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.ElementsMatch(t, []string{"user1", "user2"}, result)
	})

	t.Run("notified_mentions with mixed types filters non-strings", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"notified_mentions": []any{"user1", 123, "user2", nil},
			},
		}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.ElementsMatch(t, []string{"user1", "user2"}, result)
	})

	t.Run("notified_mentions as invalid type returns empty slice", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"notified_mentions": "invalid_type",
			},
		}
		result := th.App.GetPreviouslyNotifiedMentions(page)
		assert.Empty(t, result)
	})
}

func TestSetNotifiedMentions(t *testing.T) {
	th := Setup(t)

	t.Run("sets notified_mentions on page with nil props", func(t *testing.T) {
		page := &model.Post{Props: nil}
		th.App.SetNotifiedMentions(page, []string{"user1", "user2"})

		assert.NotNil(t, page.Props)
		assert.Equal(t, []string{"user1", "user2"}, page.Props["notified_mentions"])
	})

	t.Run("sets notified_mentions on page with existing props", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"other_prop": "value",
			},
		}
		th.App.SetNotifiedMentions(page, []string{"user1", "user2"})

		assert.Equal(t, []string{"user1", "user2"}, page.Props["notified_mentions"])
		assert.Equal(t, "value", page.Props["other_prop"])
	})

	t.Run("overwrites existing notified_mentions", func(t *testing.T) {
		page := &model.Post{
			Props: model.StringInterface{
				"notified_mentions": []string{"old_user"},
			},
		}
		th.App.SetNotifiedMentions(page, []string{"new_user1", "new_user2"})

		assert.Equal(t, []string{"new_user1", "new_user2"}, page.Props["notified_mentions"])
	})

	t.Run("sets empty slice", func(t *testing.T) {
		page := &model.Post{Props: model.StringInterface{}}
		th.App.SetNotifiedMentions(page, []string{})

		assert.Equal(t, []string{}, page.Props["notified_mentions"])
	})
}

func TestCalculateMentionDelta(t *testing.T) {
	th := Setup(t)

	t.Run("all new mentions when previously notified is empty", func(t *testing.T) {
		current := []string{"user1", "user2", "user3"}
		previous := []string{}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.ElementsMatch(t, []string{"user1", "user2", "user3"}, delta)
	})

	t.Run("some new mentions", func(t *testing.T) {
		current := []string{"user1", "user2", "user3"}
		previous := []string{"user1"}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.ElementsMatch(t, []string{"user2", "user3"}, delta)
	})

	t.Run("no new mentions when all already notified", func(t *testing.T) {
		current := []string{"user1", "user2"}
		previous := []string{"user1", "user2", "user3"}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.Empty(t, delta)
	})

	t.Run("no new mentions when exactly same", func(t *testing.T) {
		current := []string{"user1", "user2"}
		previous := []string{"user1", "user2"}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.Empty(t, delta)
	})

	t.Run("mention removed returns no new mentions", func(t *testing.T) {
		current := []string{"user1"}
		previous := []string{"user1", "user2"}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.Empty(t, delta)
	})

	t.Run("empty current returns empty delta", func(t *testing.T) {
		current := []string{}
		previous := []string{"user1", "user2"}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.Empty(t, delta)
	})

	t.Run("duplicate mentions in current are handled", func(t *testing.T) {
		current := []string{"user1", "user1", "user2"}
		previous := []string{"user1"}
		delta := th.App.CalculateMentionDelta(current, previous)
		assert.Contains(t, delta, "user2")
	})
}
