// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const FlaggedPostReportVersion = "1.0"

type FlaggedPostReportContext struct {
	Post        *Post
	Channel     *Channel
	Team        *Team
	Author      *User
	EditHistory []*Post
}

// FlaggedPostReportPost is the on-disk shape for post.yaml. It
// embeds *Post to reuse common fields; the wire format is fixed by the
// MarshalYAML method below so the report layout does not depend on Post's
// own field tags.
type FlaggedPostReportPost struct {
	*Post

	AuthorName         string
	AuthorEmail        string
	ChannelDisplayName string
	TeamID             string
	TeamDisplayName    string
	ReplyCountPtr      *int64
	EditHistoryOrder   []string
}

func (f FlaggedPostReportPost) MarshalYAML() (any, error) {
	out := map[string]any{
		"author_name":          f.AuthorName,
		"author_email":         f.AuthorEmail,
		"channel_display_name": f.ChannelDisplayName,
		"team_id":              f.TeamID,
		"team_display_name":    f.TeamDisplayName,
	}
	if f.Post != nil {
		out["id"] = f.Post.Id
		out["author_id"] = f.Post.UserId
		out["message"] = f.Post.Message
		out["channel_id"] = f.Post.ChannelId
		out["create_at"] = f.Post.CreateAt
		out["update_at"] = f.Post.UpdateAt
		out["is_pinned"] = f.Post.IsPinned
		out["root_id"] = f.Post.RootId
		if props := f.Post.GetProps(); len(props) > 0 {
			out["props"] = props
		}
		if f.Post.Metadata != nil {
			out["metadata"] = f.Post.Metadata
		}
	}
	if f.ReplyCountPtr != nil {
		out["reply_count"] = *f.ReplyCountPtr
	}
	if len(f.EditHistoryOrder) > 0 {
		out["edit_history_order"] = f.EditHistoryOrder
	}
	return out, nil
}

// FlaggedPostReportContentReview is the on-disk shape for content_review.yaml.
type FlaggedPostReportContentReview struct {
	ReporterUserID   string `yaml:"reporter_user_id"`
	ReporterUsername string `yaml:"reporter_username"`
	ReporterReason   string `yaml:"reporter_reason"`
	ReporterComment  string `yaml:"reporter_comment"`
	ReportTimestamp  int64  `yaml:"report_timestamp"`
	Hidden           bool   `yaml:"hidden"`
	ReviewerUserID   string `yaml:"reviewer_user_id,omitempty"`
	ReviewerUsername string `yaml:"reviewer_username,omitempty"`
	ReviewerComment  string `yaml:"reviewer_comment,omitempty"`
	ActionTime       int64  `yaml:"action_time,omitempty"`
	ActorDecision    string `yaml:"actor_decision,omitempty"`
	ActorUserId      string `yaml:"actor_user_id,omitempty"`
	ActorUsername    string `yaml:"actor_username,omitempty"`
}

// FlaggedPostReportMetadata is the on-disk shape for report_metadata.yaml.
type FlaggedPostReportMetadata struct {
	GeneratedByUserID   string `yaml:"generated_by_user_id"`
	GeneratedByUsername string `yaml:"generated_by_username"`
	Timestamp           int64  `yaml:"timestamp"`
	ReportVersion       string `yaml:"report_version"`
}
