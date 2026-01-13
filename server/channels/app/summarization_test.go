// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

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
