// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
)

type Recap struct {
	Id                string          `json:"id"`
	UserId            string          `json:"user_id"`
	Title             string          `json:"title"`
	CreateAt          int64           `json:"create_at"`
	UpdateAt          int64           `json:"update_at"`
	DeleteAt          int64           `json:"delete_at"`
	ReadAt            int64           `json:"read_at"`
	TotalMessageCount int             `json:"total_message_count"`
	Status            string          `json:"status"`
	Channels          []*RecapChannel `json:"channels,omitempty"`
}

type RecapChannel struct {
	Id            string   `json:"id"`
	RecapId       string   `json:"recap_id"`
	ChannelId     string   `json:"channel_id"`
	ChannelName   string   `json:"channel_name"`
	Highlights    []string `json:"highlights"`
	ActionItems   []string `json:"action_items"`
	SourcePostIds []string `json:"source_post_ids"`
	CreateAt      int64    `json:"create_at"`
}

type CreateRecapRequest struct {
	Title      string   `json:"title"`
	ChannelIds []string `json:"channel_ids"`
}

type AISummaryResponse struct {
	Highlights  []string `json:"highlights"`
	ActionItems []string `json:"action_items"`
}

const (
	RecapStatusPending    = "pending"
	RecapStatusProcessing = "processing"
	RecapStatusCompleted  = "completed"
	RecapStatusFailed     = "failed"
)

func (r *Recap) ToJSON() (string, error) {
	b, err := json.Marshal(r)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (rc *RecapChannel) ToJSON() (string, error) {
	b, err := json.Marshal(rc)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
