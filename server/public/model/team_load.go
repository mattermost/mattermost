// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// TeamLoadResponse is the aggregate response for GET /api/v4/users/me/teams/{team_id}/load.
// It replaces the three parallel round trips that the mobile client makes when switching
// teams (channels, channel members, sidebar categories) with a single round trip.
//
// Delta mode: when the ?since= query parameter is provided, each field contains only
// changed data since that cursor. Tombstone IDs are always returned when since > 0.
type TeamLoadResponse struct {
	// Channels the user is a member of in this team (excludes DMs/GMs).
	// Archived channels are included with DeleteAt > 0; the client derives archive state from that field.
	// In delta mode: only channels with UpdateAt > since.
	Channels []*ChannelLoadItem `json:"channels"`

	// Channel memberships with unread counts, scoped to this team.
	// In delta mode: only members with LastUpdateAt > since, plus removed IDs.
	ChannelMembers ChannelMemberLoadList `json:"channel_members"`

	// Sidebar categories with channel assignments.
	// Omitted (nil) when the client's sidebar_version matches the server's current version.
	SidebarCategories *OrderedSidebarCategories `json:"sidebar_categories,omitempty"`

	// SidebarVersion is the current per-team sidebar version counter.
	// Stored as category="sidebar_settings", name="sidebar_version_{teamId}".
	SidebarVersion int64 `json:"sidebar_version"`

	// Roles needed for client-side permission computation.
	// Derived from the unique role names across all channel members returned.
	// In delta mode: only roles with UpdateAt > since.
	Roles []*RoleLoadItem `json:"roles,omitempty"`

	// Server time (milliseconds) when this snapshot was taken.
	// Client stores this as the cursor for the next ?since= call.
	Timestamp int64 `json:"timestamp"`
}
