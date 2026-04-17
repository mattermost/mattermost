// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// InitialLoad is the legacy initial load response. Kept for backwards compatibility.
type InitialLoad struct {
	User        *User             `json:"user"`
	TeamMembers []*TeamMember     `json:"team_members"`
	Teams       []*Team           `json:"teams"`
	Preferences Preferences       `json:"preferences"`
	ClientCfg   map[string]string `json:"client_cfg"`
	LicenseCfg  map[string]string `json:"license_cfg"`
	NoAccounts  bool              `json:"no_accounts"`
}

// InitialLoadResponse is the aggregate response for GET /api/v4/users/me/initial_load.
// It replaces multiple sequential REST calls with a single round-trip, scoped to the
// user's active team. Non-active teams are returned as lightweight InitialLoadTeam objects.
//
// Delta mode: when the ?since= query parameter is provided, each pointer/slice field is:
//   - nil / empty: no change since the cursor — client should use its cached value
//   - non-nil: changed data (plus removed ID lists for deletions where applicable)
type InitialLoadResponse struct {
	// Current user profile. nil if unchanged in delta mode.
	Me *InitialLoadUser `json:"me"`

	// Compact summary for teams the user belongs to that have changed or have
	// active badge data (mentions, unreads). In delta mode this is a partial list —
	// teams with no changes and no badge data are omitted.
	Teams []*InitialLoadTeam `json:"teams"`

	// Team memberships scoped to teams present in this response (plus the active
	// team and any tombstoned teams). In delta mode this is a partial list.
	// Tombstoned memberships are surfaced via RemovedTeamIds.
	TeamMembers *InitialLoadTeamMemberList `json:"team_members"`

	// Full data for the active team only.
	ActiveTeam *InitialLoadActiveTeam `json:"active_team"`

	// Pre-aggregated unread counts for DMs and GMs (cross-team).
	// These are not tied to any team and are used to seed the home icon badge
	// for direct/group message unreads. nil when all counts are zero.
	DirectChannelCounts *InitialLoadDirectCounts `json:"direct_channel_counts,omitempty"`

	// Profiles of DM/GM participants visible to the user.
	// Excludes the requesting user. Deduplicated across channels.
	// In delta mode: includes profiles where UpdateAt > since OR DeleteAt > since.
	// Deleted users are included so the client can mark them as deactivated.
	DirectProfiles []*InitialLoadUser `json:"direct_profiles,omitempty"`

	// All roles needed for the client to compute permissions locally.
	// Derived from Me.Roles + all TeamMember.Roles + active team's ChannelMember.Roles.
	// In delta mode: includes roles whose UpdateAt > since.
	Roles []*RoleLoadItem `json:"roles"`

	// Preferences filtered to client-relevant categories only.
	// In delta mode: only changed preferences.
	Preferences Preferences `json:"preferences,omitempty"`

	// PreferenceTombstones lists preferences that were deleted since the cursor.
	// Populated once the PreferenceDeletions table is added (M2); always empty for now.
	PreferenceTombstones []PreferenceTombstone `json:"preference_tombstones,omitempty"`

	// Server time (milliseconds) when this snapshot was taken.
	// Client stores this as the cursor for the next ?since= call.
	Timestamp int64 `json:"timestamp"`

	// Hints for the client about which data to prioritize on first render.
	PriorityHints *InitialLoadPriorityHints `json:"priority_hints,omitempty"`
}

// InitialLoadUser is the compact user representation for the logged-in user.
// Only fields needed by the client home screen and notification logic are included.
type InitialLoadUser struct {
	Id                     string    `json:"id"`
	CreateAt               int64     `json:"create_at,omitempty"`
	UpdateAt               int64     `json:"update_at,omitempty"`
	DeleteAt               int64     `json:"delete_at"`
	Username               string    `json:"username"`
	AuthService            string    `json:"auth_service"`
	Email                  string    `json:"email"`
	Nickname               string    `json:"nickname"`
	FirstName              string    `json:"first_name"`
	LastName               string    `json:"last_name"`
	Position               string    `json:"position"`
	Roles                  string    `json:"roles"`
	Props                  StringMap `json:"props,omitempty"`
	NotifyProps            StringMap `json:"notify_props,omitempty"`
	LastPictureUpdate      int64     `json:"last_picture_update,omitempty"`
	Locale                 string    `json:"locale"`
	Timezone               StringMap `json:"timezone"`
	TermsOfServiceId       string    `json:"terms_of_service_id,omitempty"`
	TermsOfServiceCreateAt int64     `json:"terms_of_service_create_at,omitempty"`
}

// InitialLoadTeam is the compact team representation.
// Pre-aggregated unread counts are included for non-active teams so the client
// can seed team icon badges without fetching all channel members for every team.
// For the active team, per-channel member rows in InitialLoadActiveTeam are the
// source of truth for badge computation.
type InitialLoadTeam struct {
	Id                 string `json:"id"`
	CreateAt           int64  `json:"create_at,omitempty"`
	UpdateAt           int64  `json:"update_at,omitempty"`
	DeleteAt           int64  `json:"delete_at,omitempty"`
	DisplayName        string `json:"display_name"`
	Name               string `json:"name"`
	Type               string `json:"type"`
	InviteId           string `json:"invite_id,omitempty"`
	GroupConstrained   *bool  `json:"group_constrained"`
	LastTeamIconUpdate int64  `json:"last_team_icon_update,omitempty"`

	// Pre-aggregated channel unread counts for this team (excludes DMs/GMs).
	MentionCount       int64 `json:"mention_count"`
	MentionCountRoot   int64 `json:"mention_count_root,omitempty"`   // CRT only
	UrgentMentionCount int64 `json:"urgent_mention_count,omitempty"` // for hasUrgent badge state
	HasUnreads         bool  `json:"has_unreads"`

	// Pre-aggregated thread unread counts for this team (maps to
	// state.entities.threads.countsIncludingDirect[teamId] on the client).
	ThreadMentionCount       int64 `json:"thread_mention_count,omitempty"`
	ThreadUrgentMentionCount int64 `json:"thread_urgent_mention_count,omitempty"`
	ThreadHasUnreads         bool  `json:"thread_has_unreads,omitempty"`
}

// InitialLoadDirectCounts holds pre-aggregated unread counts for DMs and GMs.
// These are cross-team and not included in any InitialLoadTeam's counts.
// Clients may keep this in memory only (no need to persist).
type InitialLoadDirectCounts struct {
	MentionCount             int64 `json:"mention_count"`
	MentionCountRoot         int64 `json:"mention_count_root,omitempty"`   // CRT only
	UrgentMentionCount       int64 `json:"urgent_mention_count,omitempty"` // for hasUrgent badge state
	HasUnreads               bool  `json:"has_unreads"`
	ThreadMentionCount       int64 `json:"thread_mention_count,omitempty"`
	ThreadUrgentMentionCount int64 `json:"thread_urgent_mention_count,omitempty"`
	ThreadHasUnreads         bool  `json:"thread_has_unreads,omitempty"`
}

// InitialLoadTeamMemberList pairs current team memberships with IDs of teams
// the user left or was removed from since the cursor.
type InitialLoadTeamMemberList struct {
	Members []*InitialLoadTeamMember `json:"members"`
	// RemovedTeamIds: team IDs the user left or was removed from since the cursor.
	RemovedTeamIds []string `json:"removed_team_ids,omitempty"`
}

// InitialLoadTeamMember is the compact team membership representation.
type InitialLoadTeamMember struct {
	TeamId      string `json:"team_id"`
	UserId      string `json:"user_id"`
	Roles       string `json:"roles"`
	DeleteAt    int64  `json:"delete_at"`
	SchemeGuest bool   `json:"scheme_guest"`
	SchemeUser  bool   `json:"scheme_user"`
	SchemeAdmin bool   `json:"scheme_admin"`
}

// InitialLoadActiveTeam contains full data for the user's currently active team.
type InitialLoadActiveTeam struct {
	// Compact team object for the active team.
	Team *InitialLoadTeam `json:"team"`

	// All channels the user is a member of in this team, including DMs and GMs.
	// Archived channels are included with DeleteAt > 0; the client derives archive state from that field.
	Channels []*ChannelLoadItem `json:"channels"`

	// Channel memberships with unread counts.
	// In delta mode: includes IDs of channels the user left.
	ChannelMembers ChannelMemberLoadList `json:"channel_members"`

	// Sidebar categories with channel assignments.
	// Full state always sent when SidebarVersion differs from the client's stored value.
	// nil = no change (versions match).
	SidebarCategories *OrderedSidebarCategories `json:"sidebar_categories,omitempty"`

	// SidebarVersion is a monotonically increasing counter (stored in Preferences as
	// category="sidebar_settings", name="sidebar_version_{teamId}"). Incremented on
	// every sidebar mutation. Client compares this to its stored value to detect changes.
	SidebarVersion int64 `json:"sidebar_version"`
}

// NOTE: Thread counts (mentions, urgent mentions, has_unreads) for each team are
// embedded in InitialLoadTeam and InitialLoadDirectCounts — sufficient for badge
// rendering. Full thread data is fetched lazily when the user opens the Threads view.
//
// The compact channel, member, and role types (ChannelLoadItem, ChannelMemberLoadItem,
// RoleLoadItem and their list wrappers) are defined in channel_load.go and shared
// with TeamLoadResponse.

// PreferenceTombstone represents a preference that was deleted (used in delta mode).
// Populated once the PreferenceDeletions table is added in M2.
type PreferenceTombstone struct {
	UserId   string `json:"user_id"`
	Category string `json:"category"`
	Name     string `json:"name"`
	DeleteAt int64  `json:"delete_at"`
}

// InitialLoadPriorityHints tells the client which data to render first,
// enabling progressive display before the full response is processed.
type InitialLoadPriorityHints struct {
	// ActiveTeamID is the team resolved as the user's active team.
	ActiveTeamID string `json:"active_team_id"`
	// ActiveChannelID is the last channel the user viewed in the active team.
	ActiveChannelID string `json:"active_channel_id,omitempty"`
	// UrgentChannels: channel IDs with urgent_mention_count > 0.
	UrgentChannels []string `json:"urgent_channels,omitempty"`
	// StaleChannels: channel IDs where server last_post_at > client's cached value.
	StaleChannels []string `json:"stale_channels,omitempty"`
}
