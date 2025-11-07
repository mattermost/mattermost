// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "errors"

type TemporaryPost struct {
	ID       string      `json:"id"`
	Type     string      `json:"type"`
	ExpireAt int64       `json:"expire_at"`
	Message  string      `json:"message"`
	FileIDs  StringArray `json:"file_ids"`
}

func (o *TemporaryPost) PreSave() error {
	if o.ID == "" {
		return errors.New("id is required")
	}

	return nil
}

func CreateTemporaryPost(post *Post, expireAt int64) (*TemporaryPost, *Post, error) {
	temporaryPost := &TemporaryPost{
		ID:       NewId(),
		Type:     post.Type,
		ExpireAt: expireAt,
		Message:  post.Message,
		FileIDs:  post.FileIds,
	}

	post.Message = ""
	post.FileIds = []string{}

	return temporaryPost, post, nil
}
