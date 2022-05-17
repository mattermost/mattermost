// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostsUsage struct {
	Count int64 `json:"count"`
}

type StorageUsage struct {
	Bytes int64 `json:"bytes"`
}
