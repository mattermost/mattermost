// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
)

const (
	ScheduledPostErrorUnknownError            = "unknown"
	ScheduledPostErrorCodeChannelArchived     = "channel_archived"
	ScheduledPostErrorCodeChannelNotFound     = "channel_not_found"
	ScheduledPostErrorCodeUserDoesNotExist    = "user_missing"
	ScheduledPostErrorCodeUserDeleted         = "user_deleted"
	ScheduledPostErrorCodeNoChannelPermission = "no_channel_permission"
	ScheduledPostErrorNoChannelMember         = "no_channel_member"
	ScheduledPostErrorThreadDeleted           = "thread_deleted"
	ScheduledPostErrorUnableToSend            = "unable_to_send"
	ScheduledPostErrorInvalidPost             = "invalid_post"
)

// allow scheduled posts to be created up to
// this much time in the past. While this ir primarily added for reliable test cases,
// it also helps with flaky and slow network connection between the client and the server,
const scheduledPostMaxTimeGap = -5000

type ScheduledPost struct {
	Draft
	Id          string `json:"id"`
	ScheduledAt int64  `json:"scheduled_at"`
	ProcessedAt int64  `json:"processed_at"`
	ErrorCode   string `json:"error_code"`
}

func (s *ScheduledPost) IsValid(maxMessageSize int) *AppError {
	draftAppErr := s.Draft.IsValid(maxMessageSize)
	if draftAppErr != nil {
		return draftAppErr
	}

	return s.BaseIsValid()
}

func (s *ScheduledPost) BaseIsValid() *AppError {
	if draftAppErr := s.Draft.BaseIsValid(); draftAppErr != nil {
		return draftAppErr
	}

	if s.Id == "" {
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.id.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if len(s.Message) == 0 && len(s.FileIds) == 0 {
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.empty_post.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if (s.ScheduledAt - GetMillis()) < scheduledPostMaxTimeGap {
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.scheduled_at.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if s.ProcessedAt < 0 {
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.processed_at.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	return nil
}

func (s *ScheduledPost) PreSave() {
	if s.Id == "" {
		s.Id = NewId()
	}

	s.ProcessedAt = 0
	s.ErrorCode = ""

	s.Draft.PreSave()
}

func (s *ScheduledPost) PreUpdate() {
	s.Draft.UpdateAt = GetMillis()
	s.Draft.PreCommit()
}

// ToPost converts a scheduled post toa  regular, mattermost post object.
func (s *ScheduledPost) ToPost() (*Post, error) {
	post := &Post{
		UserId:    s.UserId,
		ChannelId: s.ChannelId,
		Message:   s.Message,
		FileIds:   s.FileIds,
		RootId:    s.RootId,
		Metadata:  s.Metadata,
	}

	for key, value := range s.GetProps() {
		post.AddProp(key, value)
	}

	if len(s.Priority) > 0 {
		priority, ok := s.Priority["priority"].(string)
		if !ok {
			return nil, fmt.Errorf(`ScheduledPost.ToPost: priority is not a string. ScheduledPost.Priority: %v`, s.Priority)
		}

		requestedAck, ok := s.Priority["requested_ack"].(bool)
		if !ok {
			return nil, fmt.Errorf(`ScheduledPost.ToPost: requested_ack is not a bool. ScheduledPost.Priority: %v`, s.Priority)
		}

		persistentNotifications, ok := s.Priority["persistent_notifications"].(bool)
		if !ok {
			return nil, fmt.Errorf(`ScheduledPost.ToPost: persistent_notifications is not a bool. ScheduledPost.Priority: %v`, s.Priority)
		}

		if post.Metadata == nil {
			post.Metadata = &PostMetadata{}
		}

		post.Metadata.Priority = &PostPriority{
			Priority:                NewPointer(priority),
			RequestedAck:            NewPointer(requestedAck),
			PersistentNotifications: NewPointer(persistentNotifications),
		}
	}

	return post, nil
}

func (s *ScheduledPost) Auditable() map[string]interface{} {
	var metaData map[string]any
	if s.Metadata != nil {
		metaData = s.Metadata.Auditable()
	}

	return map[string]interface{}{
		"id":         s.Id,
		"create_at":  s.CreateAt,
		"update_at":  s.UpdateAt,
		"user_id":    s.UserId,
		"channel_id": s.ChannelId,
		"root_id":    s.RootId,
		"props":      s.GetProps(),
		"file_ids":   s.FileIds,
		"metadata":   metaData,
	}
}

func (s *ScheduledPost) RestoreNonUpdatableFields(originalScheduledPost *ScheduledPost) {
	s.Id = originalScheduledPost.Id
	s.CreateAt = originalScheduledPost.CreateAt
	s.UserId = originalScheduledPost.UserId
	s.ChannelId = originalScheduledPost.ChannelId
	s.RootId = originalScheduledPost.RootId
}

func (s *ScheduledPost) SanitizeInput() {
	s.CreateAt = 0

	if s.Metadata != nil {
		s.Metadata.Embeds = nil
	}
}

func (s *ScheduledPost) GetPriority() *PostPriority {
	if s.Metadata == nil {
		return nil
	}
	return s.Metadata.Priority
}
