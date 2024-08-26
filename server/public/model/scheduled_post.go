// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

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
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.draft.app_error", nil, "", http.StatusBadRequest).Wrap(draftAppErr)
	}

	if s.Id == "" {
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.id.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if len(s.Message) == 0 && len(s.FileIds) == 0 {
		return NewAppError("ScheduledPost.IsValid", "model.scheduled_post.is_valid.empty_post.app_error", nil, "id="+s.Id, http.StatusBadRequest)
	}

	if s.ScheduledAt < GetMillis() {
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

func (s *ScheduledPost) ToPost() *Post {
	post := &Post{
		UserId:    s.UserId,
		ChannelId: s.ChannelId,
		Message:   s.Message,
		FileIds:   s.FileIds,
		RootId:    s.RootId,
		Metadata:  s.Metadata,

		// TODO add post prioroty stuff.
	}

	for key, value := range s.GetProps() {
		post.AddProp(key, value)
	}
}
