// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestGetPreviouslyNotifiedMentions(t *testing.T) {
	// Pages no longer carry a Props blob; getPreviouslyNotifiedMentions always
	// returns an empty slice regardless of input.
	t.Run("empty page returns empty slice", func(t *testing.T) {
		page := &model.Page{}
		result := getPreviouslyNotifiedMentions(page)
		assert.Empty(t, result)
	})

	t.Run("page always returns empty slice (no Props on Page)", func(t *testing.T) {
		page := &model.Page{Id: model.NewId()}
		result := getPreviouslyNotifiedMentions(page)
		assert.Empty(t, result)
	})
}

func TestSetNotifiedMentions(t *testing.T) {
	// setNotifiedMentions is a no-op for Pages (no Props blob); calling it does not panic.
	t.Run("does not panic on empty page", func(t *testing.T) {
		page := &model.Page{}
		setNotifiedMentions(page, []string{"user1", "user2"})
		// no assertion needed: function is a no-op, test guards against panic
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
