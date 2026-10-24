// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// ExperienceUser is the compact user representation returned by the experience endpoints.
type ExperienceUser struct {
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

// ExperienceTeam is the compact team metadata representation.
type ExperienceTeam struct {
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
}

// ExperienceTeamMember is the compact team membership representation.
type ExperienceTeamMember struct {
	TeamId      string `json:"team_id"`
	UserId      string `json:"user_id"`
	Roles       string `json:"roles"`
	DeleteAt    int64  `json:"delete_at"`
	SchemeGuest bool   `json:"scheme_guest"`
	SchemeUser  bool   `json:"scheme_user"`
	SchemeAdmin bool   `json:"scheme_admin"`
}

// ExperienceTeamMemberList pairs current team memberships with IDs of teams
// the user left or was removed from since the cursor.
type ExperienceTeamMemberList struct {
	Members        []*ExperienceTeamMember `json:"members"`
	RemovedTeamIds []string                `json:"removed_team_ids,omitempty"`
}

// ExperienceUnreads holds unread badge counts for a team or for DMs/GMs.
// When TeamID is empty the counts refer to direct/group-message channels (cross-team).
type ExperienceUnreads struct {
	TeamID                   string `json:"team_id,omitempty"`
	MentionCount             int64  `json:"mention_count"`
	MentionCountRoot         int64  `json:"mention_count_root,omitempty"`
	UrgentMentionCount       int64  `json:"urgent_mention_count,omitempty"`
	HasUnreads               bool   `json:"has_unreads"`
	ThreadMentionCount       int64  `json:"thread_mention_count,omitempty"`
	ThreadUrgentMentionCount int64  `json:"thread_urgent_mention_count,omitempty"`
	ThreadHasUnreads         bool   `json:"thread_has_unreads,omitempty"`
}

// ExperienceGroupMembership is the compact group membership representation.
type ExperienceGroupMembership struct {
	GroupId  string `json:"group_id"`
	UserId   string `json:"user_id"`
	CreateAt int64  `json:"create_at"`
}

// ExperienceGroupMembershipList pairs active group memberships with IDs of
// groups the user was removed from since the cursor.
type ExperienceGroupMembershipList struct {
	Members         []*ExperienceGroupMembership `json:"members"`
	RemovedGroupIds []string                     `json:"removed_group_ids,omitempty"`
}

// ExperienceChannelMemberList pairs channel members with IDs of channels the user
// left or was removed from since the cursor (sourced from ChannelMemberHistory).
type ExperienceChannelMemberList struct {
	Members           []*ExperienceChannelMember `json:"members"`
	RemovedChannelIds []string                   `json:"removed_channel_ids,omitempty"`
}

// ExperienceChannel is the compact channel representation.
// Other non relevant fields (Header, Purpose, BannerInfo) are omitted — fetched lazily on channel open or browse.
type ExperienceChannel struct {
	Id                string      `json:"id"`
	CreateAt          int64       `json:"create_at,omitempty"`
	UpdateAt          int64       `json:"update_at,omitempty"`
	DeleteAt          int64       `json:"delete_at,omitempty"`
	TeamId            string      `json:"team_id"`
	Type              ChannelType `json:"type"`
	DisplayName       string      `json:"display_name"`
	Name              string      `json:"name"`
	LastPostAt        int64       `json:"last_post_at"`
	TotalMsgCount     int64       `json:"total_msg_count"`
	CreatorId         string      `json:"creator_id,omitempty"`
	GroupConstrained  *bool       `json:"group_constrained"`
	Shared            *bool       `json:"shared"`
	TotalMsgCountRoot int64       `json:"total_msg_count_root,omitempty"`
	LastRootPostAt    int64       `json:"last_root_post_at,omitempty"`
	PolicyEnforced    bool        `json:"policy_enforced,omitempty"`
	// MemberCount is populated only for GM channels so the client can display
	// the correct member badge at cold start without waiting for profile fetches.
	MemberCount int64 `json:"member_count,omitempty"`
}

// ExperienceChannelMember is the compact channel membership.
type ExperienceChannelMember struct {
	ChannelId               string    `json:"channel_id"`
	UserId                  string    `json:"user_id"`
	Roles                   string    `json:"roles"`
	LastViewedAt            int64     `json:"last_viewed_at"`
	NotifyProps             StringMap `json:"notify_props"`
	MsgCount                int64     `json:"msg_count"`
	MentionCount            int64     `json:"mention_count"`
	MentionCountRoot        int64     `json:"mention_count_root"`
	UrgentMentionCount      int64     `json:"urgent_mention_count"`
	MsgCountRoot            int64     `json:"msg_count_root"`
	LastUpdateAt            int64     `json:"last_update_at"`
	SchemeGuest             bool      `json:"scheme_guest"`
	SchemeUser              bool      `json:"scheme_user"`
	SchemeAdmin             bool      `json:"scheme_admin"`
	AutoTranslationDisabled bool      `json:"autotranslation_disabled,omitempty"`
}

// Omits the policy fields (DisplayName, Description, SchemeManaged, BuiltIn) that
// client-side permission checks don't need.
type ExperienceRole struct {
	Id          string   `json:"id"`
	Name        string   `json:"name"`
	CreateAt    int64    `json:"create_at,omitempty"`
	UpdateAt    int64    `json:"update_at,omitempty"`
	DeleteAt    int64    `json:"delete_at,omitempty"`
	Permissions []string `json:"permissions"`
}

// In delta mode (?since=), a nil or empty field means unchanged since the cursor and the
// client should keep its cached value; removals are carried in the removed-ID lists.
type InitialLoadResponse struct {
	Me          *ExperienceUser           `json:"me"`
	Teams       []*ExperienceTeam         `json:"teams"`
	TeamMembers *ExperienceTeamMemberList `json:"team_members"`
	ActiveTeam  *ExperienceActiveTeam     `json:"active_team"`

	// Always sent, even in delta, because counts change independently of metadata.
	TeamUnreads []*ExperienceUnreads `json:"team_unreads,omitempty"`

	// nil when all counts are zero.
	DirectUnreads *ExperienceUnreads `json:"direct_unreads,omitempty"`

	DirectProfiles       []*ExperienceUser     `json:"direct_profiles,omitempty"`
	Statuses             map[string]*Status    `json:"statuses,omitempty"`
	Roles                []*ExperienceRole     `json:"roles"`
	Preferences          Preferences           `json:"preferences,omitempty"`
	PreferenceTombstones []PreferenceTombstone `json:"preference_tombstones,omitempty"`
	Timestamp            int64                 `json:"timestamp"`
	// Saves the client paginating GET /teams just to decide whether to show "Join
	// Another Team". Always sent since it's cheap to compute.
	CanJoinOtherTeams bool                           `json:"can_join_other_teams"`
	GroupMemberships  *ExperienceGroupMembershipList `json:"group_memberships,omitempty"`
}

// ExperienceActiveTeam contains full data for the user's currently active team.
type ExperienceActiveTeam struct {
	Team           *ExperienceTeam             `json:"team"`
	Channels       []*ExperienceChannel        `json:"channels"`
	ChannelMembers ExperienceChannelMemberList `json:"channel_members"`
	// SidebarCategories is nil when nothing changed since the client's cursor.
	SidebarCategories *OrderedSidebarCategories `json:"sidebar_categories,omitempty"`
}

// In delta mode (?since=), fields carry only changed data; tombstone IDs are always
// returned when since > 0.
type TeamLoadResponse struct {
	Channels          []*ExperienceChannel        `json:"channels"`
	ChannelMembers    ExperienceChannelMemberList `json:"channel_members"`
	SidebarCategories *OrderedSidebarCategories   `json:"sidebar_categories,omitempty"`
	Roles             []*ExperienceRole           `json:"roles,omitempty"`
	Timestamp         int64                       `json:"timestamp"`
}

// ExperienceSyncRequest is the request body for POST /api/v4/sync.
type ExperienceSyncRequest struct {
	Since int64               `json:"since"`
	Scope ExperienceSyncScope `json:"scope"`
}

// ExperienceSyncScope defines which data a sync request should include.
type ExperienceSyncScope struct {
	TeamIDs             []string `json:"team_ids"`
	ActiveChannelID     string   `json:"active_channel_id,omitempty"`
	ActiveThreadID      string   `json:"active_thread_id,omitempty"`
	GlobalThreadsTeamID string   `json:"global_threads_team_id,omitempty"`
}

// ExperienceSyncResponse is the response for POST /api/v4/sync.
type ExperienceSyncResponse struct {
	Config  map[string]string `json:"config,omitempty"`
	License map[string]string `json:"license,omitempty"`

	Me             *ExperienceUser `json:"me,omitempty"`
	RemovedTeamIDs []string        `json:"removed_team_ids,omitempty"`

	// Covers all the user's teams, not just the scoped ones, so badges are accurate
	// for teams not yet loaded this session.
	TeamsUnreads         []*ExperienceUnreads           `json:"teams_unreads,omitempty"`
	Teams                []*ExperienceSyncTeamDelta     `json:"teams,omitempty"`
	DirectChannels       []*ExperienceChannel           `json:"direct_channels,omitempty"`
	DirectChannelMembers ExperienceChannelMemberList    `json:"direct_channel_members"`
	DirectUnreads        *ExperienceUnreads             `json:"direct_unreads,omitempty"`
	Preferences          Preferences                    `json:"preferences,omitempty"`
	PreferenceTombstones []PreferenceTombstone          `json:"preference_tombstones,omitempty"`
	GroupMemberships     *ExperienceGroupMembershipList `json:"group_memberships,omitempty"`
	Roles                []*ExperienceRole              `json:"roles,omitempty"`

	Posts   []*Post  `json:"posts,omitempty"`
	Authors []*User  `json:"authors,omitempty"`
	Groups  []*Group `json:"groups,omitempty"`

	ActiveChannel *ExperienceSyncActiveChannel `json:"active_channel,omitempty"`
	ActiveThread  *ExperienceSyncActiveThread  `json:"active_thread,omitempty"`
	ThreadsDelta  *ExperienceSyncThreadsDelta  `json:"threads_delta,omitempty"`

	Statuses  map[string]*Status `json:"statuses,omitempty"`
	Timestamp int64              `json:"timestamp"`
}

// ExperienceSyncTeamDelta contains delta data for one team in a sync response.
type ExperienceSyncTeamDelta struct {
	TeamID            string                      `json:"team_id"`
	Team              *ExperienceTeam             `json:"team,omitempty"`
	Memberships       []*ExperienceTeamMember     `json:"memberships,omitempty"`
	Channels          []*ExperienceChannel        `json:"channels,omitempty"`
	ChannelMembers    ExperienceChannelMemberList `json:"channel_members"`
	SidebarCategories *OrderedSidebarCategories   `json:"sidebar_categories,omitempty"`
}

// ExperienceSyncActiveChannel contains context data for the active channel.
type ExperienceSyncActiveChannel struct {
	ChannelID         string                         `json:"channel_id"`
	PostsOrder        []string                       `json:"posts_order,omitempty"`
	Stats             *ChannelStats                  `json:"stats,omitempty"`
	Bookmarks         []*ChannelBookmarkWithFileInfo `json:"bookmarks,omitempty"`
	ConstrainedGroups []*GroupWithSchemeAdmin        `json:"constrained_groups,omitempty"`
}

// ExperienceSyncActiveThread contains context data for the active thread.
type ExperienceSyncActiveThread struct {
	RootID     string   `json:"root_id"`
	PostsOrder []string `json:"posts_order,omitempty"`
}

// ExperienceSyncThreadsDelta contains thread list data for a team.
type ExperienceSyncThreadsDelta struct {
	TeamID              string                  `json:"team_id"`
	Threads             []*ExperienceSyncThread `json:"threads,omitempty"`
	Total               int64                   `json:"total"`
	TotalUnreadMentions int64                   `json:"total_unread_mentions"`
	TotalUnreadThreads  int64                   `json:"total_unread_threads"`
}

// ExperienceSyncThread is the compact thread representation in a sync response.
type ExperienceSyncThread struct {
	ID             string `json:"id"`
	ReplyCount     int64  `json:"reply_count"`
	LastReplyAt    int64  `json:"last_reply_at"`
	LastViewedAt   int64  `json:"last_viewed_at"`
	UnreadReplies  int64  `json:"unread_replies"`
	UnreadMentions int64  `json:"unread_mentions"`
	IsFollowing    bool   `json:"is_following"`
	DeleteAt       int64  `json:"delete_at,omitempty"`
}
