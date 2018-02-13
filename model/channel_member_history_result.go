// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

type ChannelMemberHistoryResult struct {
	ChannelId string
	UserId    string
	JoinTime  int64
	LeaveTime *int64

	// these two fields are never set in the database - when we SELECT, we join on Users to get them
	UserEmail string `db:"Email"`
	Username  string
}
