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

func (o *TemporaryPost) IsValid() error {
	if o.ID == "" {
		return errors.New("id is required")
	}

	return nil
}

// CreateTemporaryPost creates a temporary post from a post object. The post is modified in place.
// It returns the temporary post and the post object with the message and file ids removed.
func CreateTemporaryPost(post *Post, expireAt int64) (*TemporaryPost, *Post, error) {
	temporaryPost := &TemporaryPost{
		ID:       post.Id,
		Type:     post.Type,
		ExpireAt: expireAt,
		Message:  post.Message,
		FileIDs:  post.FileIds,
	}

	post.FileIds = []string{}
	post.Message = ""

	return temporaryPost, post, nil
}
