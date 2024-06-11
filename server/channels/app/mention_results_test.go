// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestAddMention(t *testing.T) {
	t.Run("should initialize Mentions and store new mentions", func(t *testing.T) {
		m := &MentionResults{}

		userID1 := model.NewId()
		userID2 := model.NewId()

		m.addMention(userID1, KeywordMention)
		m.addMention(userID2, CommentMention)

		assert.Equal(t, map[string]MentionType{
			userID1: KeywordMention,
			userID2: CommentMention,
		}, m.Mentions)
	})

	t.Run("should replace existing mentions with higher priority ones", func(t *testing.T) {
		m := &MentionResults{}

		userID1 := model.NewId()
		userID2 := model.NewId()

		m.addMention(userID1, ThreadMention)
		m.addMention(userID2, DMMention)

		m.addMention(userID1, ChannelMention)
		m.addMention(userID2, KeywordMention)

		assert.Equal(t, map[string]MentionType{
			userID1: ChannelMention,
			userID2: KeywordMention,
		}, m.Mentions)
	})

	t.Run("should not replace high priority mentions with low priority ones", func(t *testing.T) {
		m := &MentionResults{}

		userID1 := model.NewId()
		userID2 := model.NewId()

		m.addMention(userID1, KeywordMention)
		m.addMention(userID2, CommentMention)

		m.addMention(userID1, DMMention)
		m.addMention(userID2, ThreadMention)

		assert.Equal(t, map[string]MentionType{
			userID1: KeywordMention,
			userID2: CommentMention,
		}, m.Mentions)
	})
}
