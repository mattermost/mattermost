// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScheduledPostBaseIsValid(t *testing.T) {
	t.Run("missing id", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.scheduled_post.is_valid.id.app_error", err.Id)
	})

	t.Run("empty message and no file ids", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.scheduled_post.is_valid.empty_post.app_error", err.Id)
	})

	t.Run("scheduled_at in the past", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() - 10000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.scheduled_post.is_valid.scheduled_at.app_error", err.Id)
	})

	t.Run("negative processed_at", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
			ProcessedAt: -1,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.scheduled_post.is_valid.processed_at.app_error", err.Id)
	})

	t.Run("valid with message", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.Nil(t, err)
	})

	t.Run("valid with file ids and no message", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				FileIds:   StringArray{NewId()},
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.Nil(t, err)
	})

	t.Run("draft base validation fails with missing update_at", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.draft.is_valid.update_at.app_error", err.Id)
	})

	t.Run("draft base validation fails with invalid user_id", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    "invalid",
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.draft.is_valid.user_id.app_error", err.Id)
	})

	t.Run("draft base validation fails with invalid channel_id", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: "invalid",
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.draft.is_valid.channel_id.app_error", err.Id)
	})

	t.Run("draft base validation fails with missing create_at", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.BaseIsValid()
		require.NotNil(t, err)
		assert.Equal(t, "model.draft.is_valid.create_at.app_error", err.Id)
	})
}

func TestScheduledPostIsValid(t *testing.T) {
	maxMessageSize := 10000

	t.Run("draft validation fails for message too long", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   strings.Repeat("a", maxMessageSize+1),
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.IsValid(maxMessageSize)
		require.NotNil(t, err)
		assert.Equal(t, "model.draft.is_valid.message_length.app_error", err.Id)
	})

	t.Run("base validation fails for missing id", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.IsValid(maxMessageSize)
		require.NotNil(t, err)
		assert.Equal(t, "model.scheduled_post.is_valid.id.app_error", err.Id)
	})

	t.Run("valid scheduled post", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
			},
			Id:          NewId(),
			ScheduledAt: GetMillis() + 100000,
		}
		err := s.IsValid(maxMessageSize)
		require.Nil(t, err)
	})
}

func TestScheduledPostPreSave(t *testing.T) {
	t.Run("generates id when empty", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
			},
		}
		s.PreSave()
		assert.NotEmpty(t, s.Id)
		assert.True(t, IsValidId(s.Id))
	})

	t.Run("preserves existing id", func(t *testing.T) {
		existingId := NewId()
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
			},
			Id: existingId,
		}
		s.PreSave()
		assert.Equal(t, existingId, s.Id)
	})

	t.Run("resets processed_at and error_code", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
			},
			ProcessedAt: GetMillis(),
			ErrorCode:   ScheduledPostErrorUnknownError,
		}
		s.PreSave()
		assert.Equal(t, int64(0), s.ProcessedAt)
		assert.Empty(t, s.ErrorCode)
	})

	t.Run("calls draft pre save", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
			},
		}
		s.PreSave()
		assert.NotEqual(t, int64(0), s.CreateAt)
		assert.NotEqual(t, int64(0), s.UpdateAt)
		assert.NotNil(t, s.GetProps())
		assert.NotNil(t, s.FileIds)
	})
}

func TestScheduledPostPreUpdate(t *testing.T) {
	t.Run("sets update_at to current time", func(t *testing.T) {
		createAt := GetMillis() - 10000
		s := ScheduledPost{
			Draft: Draft{
				Message:  "test",
				CreateAt: createAt,
			},
		}
		before := GetMillis()
		s.PreUpdate()

		assert.GreaterOrEqual(t, s.UpdateAt, before)
		assert.Equal(t, createAt, s.CreateAt)
	})

	t.Run("initializes props and file ids via PreCommit", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
			},
		}
		s.PreUpdate()

		assert.NotNil(t, s.GetProps())
		assert.NotNil(t, s.FileIds)
	})
}

func TestScheduledPostToPost(t *testing.T) {
	t.Run("without priority", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "hello",
				FileIds:   StringArray{NewId()},
				RootId:    NewId(),
				Type:      "custom_type",
			},
			Id: NewId(),
		}
		s.SetProps(StringInterface{"key": "value"})

		post, err := s.ToPost()
		require.NoError(t, err)
		assert.Equal(t, s.UserId, post.UserId)
		assert.Equal(t, s.ChannelId, post.ChannelId)
		assert.Equal(t, s.Message, post.Message)
		assert.Equal(t, s.FileIds, post.FileIds)
		assert.Equal(t, s.RootId, post.RootId)
		assert.Equal(t, s.Type, post.Type)
		assert.Equal(t, "value", post.GetProp("key"))
		assert.Nil(t, post.Metadata)
	})

	t.Run("with metadata but no priority preserves metadata", func(t *testing.T) {
		embeds := []*PostEmbed{{Type: PostEmbedImage, URL: "http://example.com/img.png"}}
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
				Metadata:  &PostMetadata{Embeds: embeds},
			},
			Id: NewId(),
		}

		post, err := s.ToPost()
		require.NoError(t, err)
		require.NotNil(t, post.Metadata)
		assert.Nil(t, post.Metadata.Priority)
		assert.Equal(t, embeds, post.Metadata.Embeds)
	})

	t.Run("with valid priority", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "urgent",
				Priority: StringInterface{
					"priority":                 "urgent",
					"requested_ack":            true,
					"persistent_notifications": false,
				},
			},
			Id: NewId(),
		}

		post, err := s.ToPost()
		require.NoError(t, err)
		require.NotNil(t, post.Metadata)
		require.NotNil(t, post.Metadata.Priority)
		require.NotNil(t, post.Metadata.Priority.Priority)
		require.NotNil(t, post.Metadata.Priority.RequestedAck)
		require.NotNil(t, post.Metadata.Priority.PersistentNotifications)
		assert.Equal(t, "urgent", *post.Metadata.Priority.Priority)
		assert.True(t, *post.Metadata.Priority.RequestedAck)
		assert.False(t, *post.Metadata.Priority.PersistentNotifications)
	})

	t.Run("with valid priority and existing metadata", func(t *testing.T) {
		embeds := []*PostEmbed{{Type: PostEmbedLink, URL: "http://example.com"}}
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
				Metadata:  &PostMetadata{Embeds: embeds},
				Priority: StringInterface{
					"priority":                 "important",
					"requested_ack":            false,
					"persistent_notifications": false,
				},
			},
			Id: NewId(),
		}

		post, err := s.ToPost()
		require.NoError(t, err)
		require.NotNil(t, post.Metadata)
		require.NotNil(t, post.Metadata.Priority)
		require.NotNil(t, post.Metadata.Priority.Priority)
		assert.Equal(t, "important", *post.Metadata.Priority.Priority)
		assert.Equal(t, embeds, post.Metadata.Embeds)
	})

	t.Run("error when priority is not a string", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
				Priority: StringInterface{
					"priority":                 123,
					"requested_ack":            true,
					"persistent_notifications": false,
				},
			},
			Id: NewId(),
		}

		post, err := s.ToPost()
		require.Nil(t, post)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "priority is not a string")
	})

	t.Run("error when requested_ack is not a bool", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
				Priority: StringInterface{
					"priority":                 "urgent",
					"requested_ack":            "yes",
					"persistent_notifications": false,
				},
			},
			Id: NewId(),
		}

		post, err := s.ToPost()
		require.Nil(t, post)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "requested_ack is not a bool")
	})

	t.Run("error when persistent_notifications is not a bool", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				UserId:    NewId(),
				ChannelId: NewId(),
				Message:   "test",
				Priority: StringInterface{
					"priority":                 "urgent",
					"requested_ack":            true,
					"persistent_notifications": "no",
				},
			},
			Id: NewId(),
		}

		post, err := s.ToPost()
		require.Nil(t, post)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "persistent_notifications is not a bool")
	})
}

func TestScheduledPostAuditable(t *testing.T) {
	t.Run("with nil metadata", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				RootId:    NewId(),
				FileIds:   StringArray{NewId()},
			},
			Id: NewId(),
		}

		result := s.Auditable()
		assert.Equal(t, s.Id, result["id"])
		assert.Equal(t, s.CreateAt, result["create_at"])
		assert.Equal(t, s.UpdateAt, result["update_at"])
		assert.Equal(t, s.UserId, result["user_id"])
		assert.Equal(t, s.ChannelId, result["channel_id"])
		assert.Equal(t, s.RootId, result["root_id"])
		assert.Equal(t, s.FileIds, result["file_ids"])
		assert.Nil(t, result["metadata"])
	})

	t.Run("with non-nil metadata", func(t *testing.T) {
		metadata := &PostMetadata{
			Emojis: []*Emoji{{Name: "smile"}},
		}
		s := ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UpdateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				Metadata:  metadata,
			},
			Id: NewId(),
		}

		result := s.Auditable()
		assert.Equal(t, metadata.Auditable(), result["metadata"])
	})
}

func TestScheduledPostRestoreNonUpdatableFields(t *testing.T) {
	t.Run("restores non-updatable fields from original", func(t *testing.T) {
		original := &ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis() - 50000,
				UserId:    NewId(),
				ChannelId: NewId(),
				RootId:    NewId(),
				Type:      "custom_type",
			},
			Id: NewId(),
		}

		scheduledAt := GetMillis() + 100000
		updated := &ScheduledPost{
			Draft: Draft{
				CreateAt:  GetMillis(),
				UserId:    NewId(),
				ChannelId: NewId(),
				RootId:    NewId(),
				Message:   "updated message",
				Type:      "different_type",
			},
			Id:          NewId(),
			ScheduledAt: scheduledAt,
		}

		updated.RestoreNonUpdatableFields(original)

		assert.Equal(t, original.Id, updated.Id)
		assert.Equal(t, original.CreateAt, updated.CreateAt)
		assert.Equal(t, original.UserId, updated.UserId)
		assert.Equal(t, original.ChannelId, updated.ChannelId)
		assert.Equal(t, original.RootId, updated.RootId)
		assert.Equal(t, original.Type, updated.Type)
		// Updatable fields should remain changed
		assert.Equal(t, "updated message", updated.Message)
		assert.Equal(t, scheduledAt, updated.ScheduledAt)
	})
}

func TestScheduledPostSanitizeInput(t *testing.T) {
	t.Run("zeros create_at", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt: GetMillis(),
				Message:  "test",
			},
		}
		s.SanitizeInput()
		assert.Equal(t, int64(0), s.CreateAt)
	})

	t.Run("clears metadata embeds", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt: GetMillis(),
				Message:  "test",
				Metadata: &PostMetadata{
					Embeds: []*PostEmbed{
						{Type: PostEmbedImage, URL: "http://example.com/image.png"},
					},
				},
			},
		}
		s.SanitizeInput()
		assert.Nil(t, s.Metadata.Embeds)
	})

	t.Run("nil metadata is safe", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				CreateAt: GetMillis(),
				Message:  "test",
			},
		}
		assert.NotPanics(t, func() {
			s.SanitizeInput()
		})
	})
}

func TestScheduledPostGetPriority(t *testing.T) {
	t.Run("nil metadata returns nil", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
			},
		}
		assert.Nil(t, s.GetPriority())
	})

	t.Run("metadata without priority returns nil", func(t *testing.T) {
		s := ScheduledPost{
			Draft: Draft{
				Message:  "test",
				Metadata: &PostMetadata{},
			},
		}
		assert.Nil(t, s.GetPriority())
	})

	t.Run("metadata with priority returns priority", func(t *testing.T) {
		priority := &PostPriority{
			Priority:     NewPointer("urgent"),
			RequestedAck: NewPointer(true),
		}
		s := ScheduledPost{
			Draft: Draft{
				Message: "test",
				Metadata: &PostMetadata{
					Priority: priority,
				},
			},
		}
		result := s.GetPriority()
		require.NotNil(t, result)
		require.NotNil(t, result.Priority)
		require.NotNil(t, result.RequestedAck)
		assert.Equal(t, "urgent", *result.Priority)
		assert.True(t, *result.RequestedAck)
	})
}
