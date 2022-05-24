// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostsUsage struct {
	Count int64 `json:"count"`
}

type TeamsUsage struct {
	Active int64 `json:"active"`
}
