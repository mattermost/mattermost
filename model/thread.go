// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Thread tracks the metadata associated with a root post and its reply posts.
//
// Note that Thread metadata does not exist until the first reply to a root post.
type Thread struct {
	// PostId is the root post of the thread.
	PostId string `json:"id"`

	// ChannelId is the channel in which the thread was posted.
	ChannelId string `json:"channel_id"`

	// ReplyCount is the number of replies to the thread (excluding deleted posts).
	ReplyCount int64 `json:"reply_count"`

	// LastReplyAt is the timestamp of the most recent post to the thread.
	LastReplyAt int64 `json:"last_reply_at"`

	// Participants is a list of user ids that have replied to the thread, sorted by the oldest
	// to newest. Note that the root post author is not included in this list until they reply.
	Participants StringArray `json:"participants"`

	// DeleteAt is a denormalized copy of the root posts's DeleteAt. In the database, it's
	// named ThreadDeleteAt to avoid introducing a query conflict with older server versions.
	DeleteAt int64 `json:"delete_at"`

	// TeamId is a denormalized copy of the Channel's teamId. In the database, it's
	// named ThreadTeamId to avoid introducing a query conflict with older server versions.
	TeamId string `json:"team_id"`
}

type ThreadResponse struct {
	PostId         string  `json:"id"`
	ReplyCount     int64   `json:"reply_count"`
	LastReplyAt    int64   `json:"last_reply_at"`
	LastViewedAt   int64   `json:"last_viewed_at"`
	Participants   []*User `json:"participants"`
	Post           *Post   `json:"post"`
	UnreadReplies  int64   `json:"unread_replies"`
	UnreadMentions int64   `json:"unread_mentions"`
	IsUrgent       bool    `json:"is_urgent"`
	DeleteAt       int64   `json:"delete_at"`
}

type Threads struct {
	Total                     int64             `json:"total"`
	TotalUnreadThreads        int64             `json:"total_unread_threads"`
	TotalUnreadMentions       int64             `json:"total_unread_mentions"`
	TotalUnreadUrgentMentions int64             `json:"total_unread_urgent_mentions"`
	Threads                   []*ThreadResponse `json:"threads"`
}

type GetUserThreadsOpts struct {
	// PageSize specifies the size of the returned chunk of results. Default = 30
	PageSize uint64

	// Extended will enrich the response with participant details. Default = false
	Extended bool

	// Deleted will specify that even deleted threads should be returned (For mobile sync). Default = false
	Deleted bool

	// Since filters the threads based on their LastUpdateAt timestamp.
	Since uint64

	// Before specifies thread id as a cursor for pagination and will return `PageSize` threads before the cursor
	Before string

	// After specifies thread id as a cursor for pagination and will return `PageSize` threads after the cursor
	After string

	// Unread will make sure that only threads with unread replies are returned
	Unread bool

	// TotalsOnly will not fetch any threads and just fetch the total counts
	TotalsOnly bool

	// ThreadsOnly will fetch threads but not calculate totals and will return 0
	ThreadsOnly bool

	// TeamOnly will only fetch threads and unreads for the specified team and excludes DMs/GMs
	TeamOnly bool
}

func (o *Thread) Etag() string {
	return Etag(o.PostId, o.LastReplyAt)
}

// ThreadMembership models the relationship between a user and a thread of posts, with a similar
// data structure as ChannelMembership.
type ThreadMembership struct {
	// PostId is the root post id of the thread in question.
	PostId string `json:"post_id"`

	// UserId is the user whose membership in the thread is being tracked.
	UserId string `json:"user_id"`

	// Following tracks whether the user is following the given thread. This defaults to true
	// when a ThreadMembership record is created (a record doesn't exist until the user first
	// starts following the thread), but the user can stop following or resume following at
	// will.
	Following bool `json:"following"`

	// LastUpdated is either the creation time of the membership record, or the last time the
	// membership record was changed (e.g. started/stopped following, viewed thread, mention
	// count change).
	//
	// This field is used to constrain queries of thread memberships to those updated after
	// a given timestamp (e.g. on websocket reconnect). It's also used as the time column for
	// deletion decisions during any configured retention policy.
	LastUpdated int64 `json:"last_update_at"`

	// LastViewed is the last time the user viewed this thread. It is the thread analogue to
	// the ChannelMembership's LastViewedAt and is used to decide when there are new replies
	// for the user and where the user should start reading.
	LastViewed int64 `json:"last_view_at"`

	// UnreadMentions is the number of unseen at-mentions for the user in the given thread. It
	// is the thread analogue to the ChannelMembership's MentionCount, and is used to highlight
	// threads with the mention count.
	UnreadMentions int64 `json:"unread_mentions"`
}
