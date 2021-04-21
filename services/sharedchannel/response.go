// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

type SyncResponse struct {
	LastSyncAt int64    `json:"last_sync_at"`
	PostErrors []string `json:"post_errors"`
	UsersSyncd []string `json:"users_syncd"`
}
