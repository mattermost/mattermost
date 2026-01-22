// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

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
	BotID             string          `json:"bot_id"`
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
	AgentID    string   `json:"agent_id"`
}

type AIRecapSummaryResponse struct {
	Highlights  []string `json:"highlights"`
	ActionItems []string `json:"action_items"`
}

// RecapChannelResult represents the result of processing a single channel for a recap
type RecapChannelResult struct {
	ChannelID    string
	MessageCount int
	Success      bool
}

const (
	RecapStatusPending    = "pending"
	RecapStatusProcessing = "processing"
	RecapStatusCompleted  = "completed"
	RecapStatusFailed     = "failed"
)

// Auditable returns safe-to-log fields for audit logging
func (r *Recap) Auditable() map[string]any {
	channelIDs := make([]string, 0, len(r.Channels))
	for _, channel := range r.Channels {
		channelIDs = append(channelIDs, channel.ChannelId)
	}

	return map[string]any{
		"id":                  r.Id,
		"user_id":             r.UserId,
		"title":               r.Title,
		"status":              r.Status,
		"channel_ids":         channelIDs,
		"total_message_count": r.TotalMessageCount,
		"bot_id":              r.BotID,
		"create_at":           r.CreateAt,
		"update_at":           r.UpdateAt,
		"read_at":             r.ReadAt,
	}
}
