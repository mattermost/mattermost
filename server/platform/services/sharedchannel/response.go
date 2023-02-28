// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

type SyncResponse struct {
	UsersLastUpdateAt int64    `json:"users_last_update_at"`
	UserErrors        []string `json:"user_errors"`
	UsersSyncd        []string `json:"users_syncd"`

	PostsLastUpdateAt int64    `json:"posts_last_update_at"`
	PostErrors        []string `json:"post_errors"`

	ReactionsLastUpdateAt int64    `json:"reactions_last_update_at"`
	ReactionErrors        []string `json:"reaction_errors"`
}
