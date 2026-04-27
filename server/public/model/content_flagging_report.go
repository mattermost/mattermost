// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const FlaggedPostReportVersion = "1.0"

// FlaggedPostReportPost is the on-disk shape for post/post.yaml and
// edit_history/<id>/post.yaml inside a flagged post report archive.
type FlaggedPostReportPost struct {
	ID                 string          `yaml:"id"`
	AuthorID           string          `yaml:"author_id"`
	AuthorName         string          `yaml:"author_name"`
	AuthorEmail        string          `yaml:"author_email"`
	Message            string          `yaml:"message"`
	ChannelID          string          `yaml:"channel_id"`
	ChannelDisplayName string          `yaml:"channel_display_name"`
	TeamID             string          `yaml:"team_id"`
	TeamDisplayName    string          `yaml:"team_display_name"`
	CreateAt           int64           `yaml:"create_at"`
	UpdateAt           int64           `yaml:"update_at"`
	IsPinned           bool            `yaml:"is_pinned"`
	RootID             string          `yaml:"root_id"`
	Props              StringInterface `yaml:"props,omitempty"`
	ReplyCount         *int64          `yaml:"reply_count,omitempty"`
	Metadata           *PostMetadata   `yaml:"metadata,omitempty"`
	EditHistoryOrder   []string        `yaml:"edit_history_order,omitempty"`
}

// FlaggedPostReportContentReview is the on-disk shape for content_review.yaml.
type FlaggedPostReportContentReview struct {
	ReporterUserID   string `yaml:"reporter_user_id"`
	ReporterUsername string `yaml:"reporter_username"`
	ReporterReason   string `yaml:"reporter_reason"`
	ReporterComment  string `yaml:"reporter_comment"`
	ReportTimestamp  string `yaml:"report_timestamp"`
	Hidden           bool   `yaml:"hidden"`
	ReviewerUserID   string `yaml:"reviewer_user_id,omitempty"`
	ReviewerUsername string `yaml:"reviewer_username,omitempty"`
	ReviewerComment  string `yaml:"reviewer_comment,omitempty"`
	ActionTime       string `yaml:"action_time,omitempty"`
}

// FlaggedPostReportMetadata is the on-disk shape for report_metadata.yaml.
type FlaggedPostReportMetadata struct {
	GeneratedByUserID   string `yaml:"generated_by_user_id"`
	GeneratedByUsername string `yaml:"generated_by_username"`
	Timestamp           int64  `yaml:"timestamp"`
	ReportVersion       string `yaml:"report_version"`
}
