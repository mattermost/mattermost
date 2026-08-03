// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"time"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

const PostExposureReportVersion = "1.0"

type PostExposureReportEntry struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	UserEmail string `json:"user_email"`

	IsGuest       bool `json:"is_guest"`
	IsRemote      bool `json:"is_remote"`
	IsDeactivated bool `json:"is_deactivated"`

	// WasChannelMember records that the user was a member of the channel between the post's
	// creation time and it being flagged, per ChannelMemberHistory.
	WasChannelMember bool `json:"was_channel_member"`

	// LikelyReceivedPost records that the user's channel read state advanced to at or past
	// the post's creation time, so the post may have been delivered to them.
	LikelyReceivedPost bool `json:"likely_received_post"`

	// LastViewedAt is nil when the user is no longer a member of the channel and so has no
	// read state at all. A non-nil zero means they are a member who never viewed the channel.
	LastViewedAt *int64 `json:"last_viewed_at,omitempty"`
}

type PostExposureReport struct {
	Version     string                     `json:"version"`
	PostID      string                     `json:"post_id"`
	ChannelID   string                     `json:"channel_id"`
	ChannelName string                     `json:"channel_name"`
	ChannelType ChannelType                `json:"channel_type"`
	TeamID      string                     `json:"team_id,omitempty"`
	WindowStart int64                      `json:"window_start"`
	WindowEnd   int64                      `json:"window_end"`
	GeneratedAt int64                      `json:"generated_at"`
	Entries     []*PostExposureReportEntry `json:"entries"`
}

func PostExposureReportCSVHeader(T i18n.TranslateFunc) []string {
	return []string{
		T("app.data_spillage.exposure.column.user_id"),
		T("app.data_spillage.exposure.column.username"),
		T("app.data_spillage.exposure.column.email"),
		T("app.data_spillage.exposure.column.is_guest"),
		T("app.data_spillage.exposure.column.is_remote"),
		T("app.data_spillage.exposure.column.is_deactivated"),
		T("app.data_spillage.exposure.column.was_channel_member"),
		T("app.data_spillage.exposure.column.likely_received_post"),
		T("app.data_spillage.exposure.column.last_viewed_at"),
	}
}

func (e *PostExposureReportEntry) ToCSVRow(T i18n.TranslateFunc) []string {
	return []string{
		e.UserID,
		e.Username,
		e.UserEmail,
		exposureBool(T, e.IsGuest),
		exposureBool(T, e.IsRemote),
		exposureBool(T, e.IsDeactivated),
		exposureBool(T, e.WasChannelMember),
		exposureBool(T, e.LikelyReceivedPost),
		e.lastViewedAtCell(T),
	}
}

func (e *PostExposureReportEntry) lastViewedAtCell(T i18n.TranslateFunc) string {
	switch {
	case e.LastViewedAt == nil:
		// The user is no longer a channel member, so no read state survives for them.
		return T("app.data_spillage.exposure.value.unknown")
	case *e.LastViewedAt <= 0:
		return T("app.data_spillage.exposure.value.never_viewed")
	default:
		return FormatExposureTime(*e.LastViewedAt)
	}
}

func exposureBool(T i18n.TranslateFunc, v bool) string {
	if v {
		return T("app.data_spillage.exposure.value.yes")
	}
	return T("app.data_spillage.exposure.value.no")
}

func FormatExposureTime(millis int64) string {
	if millis <= 0 {
		return ""
	}
	return time.UnixMilli(millis).UTC().Format(time.RFC3339)
}
