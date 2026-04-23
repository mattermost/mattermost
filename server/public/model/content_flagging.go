// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"slices"
	"unicode/utf8"
)

const (
	ContentFlaggingGroupName   = "content_flagging"
	ContentFlaggingPostType    = PostCustomTypePrefix + "spillage_report"
	ContentFlaggingBotUsername = "content-review"

	commentMaxRunes = 1000

	AsContentReviewerParam = "as_content_reviewer"
)

const (
	ContentFlaggingStatusPending  = "Pending"
	ContentFlaggingStatusAssigned = "Assigned"
	ContentFlaggingStatusRemoved  = "Removed"
	ContentFlaggingStatusRetained = "Retained"
)

// Reviewer action types for the action history log.
const (
	ContentFlaggingActionPostFlagged      = "post flagged"
	ContentFlaggingActionReviewerAssigned = "reviewer assigned"
	ContentFlaggingActionPostRemoved      = "post removed"
	ContentFlaggingActionPostRetained     = "post retained"
	ContentFlaggingActionReportGenerated  = "report generated"
)

const DataSpillageReportVersion = "1"

// DataSpillageReportPost represents the post data written to post.yaml in the report ZIP.
type DataSpillageReportPost struct {
	ID                 string         `yaml:"id"`
	AuthorUserID       string         `yaml:"author_user_id"`
	AuthorUsername     string         `yaml:"author_username"`
	AuthorEmail        string         `yaml:"author_email"`
	Message            string         `yaml:"message"`
	ChannelID          string         `yaml:"channel_id"`
	ChannelDisplayName string         `yaml:"channel_display_name"`
	TeamID             string         `yaml:"team_id"`
	TeamDisplayName    string         `yaml:"team_display_name"`
	CreateAt           int64          `yaml:"create_at"`
	UpdateAt           int64          `yaml:"update_at"`
	EditAt             int64          `yaml:"edit_at"`
	DeleteAt           int64          `yaml:"delete_at"`
	IsPinned           bool           `yaml:"is_pinned"`
	RootID             string         `yaml:"root_id,omitempty"`
	Props              map[string]any `yaml:"props,omitempty"`
	ReplyCount         int64          `yaml:"reply_count"`
	Type               string         `yaml:"type"`
	FileIDs            []string       `yaml:"file_ids,omitempty"`
	Metadata           map[string]any `yaml:"metadata,omitempty"`
	EditHistoryOrder   []string       `yaml:"edit_history_order,omitempty"`
}

// DataSpillageContentReview represents the content review metadata written to content_review.yaml.
type DataSpillageContentReview struct {
	ReporterUserID   string                       `yaml:"reporter_user_id"`
	ReporterUsername string                       `yaml:"reporter_username"`
	ReportingReason  string                       `yaml:"reporting_reason"`
	ReportingComment string                       `yaml:"reporting_comment,omitempty"`
	ReportedAt       int64                        `yaml:"reported_at"`
	Hidden           bool                         `yaml:"hidden"`
	ReviewerUserID   string                       `yaml:"reviewer_user_id,omitempty"`
	ReviewerUsername string                       `yaml:"reviewer_username,omitempty"`
	ReviewerComment  string                       `yaml:"reviewer_comment,omitempty"`
	ReviewerActions  []DataSpillageReviewerAction `yaml:"reviewer_actions,omitempty"`
}

// DataSpillageReviewerAction represents a single reviewer action in the action history.
type DataSpillageReviewerAction struct {
	Action                   string `yaml:"action" json:"action"`
	ActorUserID              string `yaml:"actor_user_id" json:"actor_user_id"`
	ActorUsername             string `yaml:"actor_username" json:"actor_username"`
	AssignedReviewerID       string `yaml:"assigned_reviewer_id,omitempty" json:"assigned_reviewer_id,omitempty"`
	AssignedReviewerUsername string `yaml:"assigned_reviewer_username,omitempty" json:"assigned_reviewer_username,omitempty"`
	Comment                  string `yaml:"comment,omitempty" json:"comment,omitempty"`
	Timestamp                int64  `yaml:"timestamp" json:"timestamp"`
}

// DataSpillageReportMetadata represents the report metadata written to report_metadata.yaml.
type DataSpillageReportMetadata struct {
	GeneratedByUserID  string `yaml:"generated_by_user_id"`
	GeneratedByUsername string `yaml:"generated_by_username"`
	GeneratedAt        int64  `yaml:"generated_at"`
	ReportVersion      string `yaml:"report_version"`
}

type FlagContentRequest struct {
	Reason  string `json:"reason"`
	Comment string `json:"comment,omitempty"`
}

func (f *FlagContentRequest) IsValid(commentRequired bool, validReasons []string) *AppError {
	if f.Reason == "" {
		return NewAppError("FlagContentRequest.IsValid", "api.data_spillage.error.reason_required", nil, "", http.StatusBadRequest)
	}

	if !slices.Contains(validReasons, f.Reason) {
		return NewAppError("FlagContentRequest.IsValid", "api.data_spillage.error.reason_invalid", nil, "", http.StatusBadRequest)
	}

	if commentRequired && f.Comment == "" {
		return NewAppError("FlagContentRequest.IsValid", "api.data_spillage.error.comment_required", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(f.Comment) > commentMaxRunes {
		return NewAppError("FlagContentRequest.IsValid", "api.data_spillage.error.comment_too_long", map[string]any{"MaxLength": commentMaxRunes}, "", http.StatusBadRequest)
	}

	return nil
}

type FlagContentActionRequest struct {
	Comment string `json:"comment,omitempty"`
}

func (f *FlagContentActionRequest) IsValid(commentRequired bool) *AppError {
	if commentRequired && f.Comment == "" {
		return NewAppError("FlagContentActionRequest.IsValid", "api.data_spillage.error.comment_required", nil, "", http.StatusBadRequest)
	}

	if utf8.RuneCountInString(f.Comment) > commentMaxRunes {
		return NewAppError("FlagContentActionRequest.IsValid", "api.data_spillage.error.comment_too_long", map[string]any{"MaxLength": commentMaxRunes}, "", http.StatusBadRequest)
	}

	return nil
}
