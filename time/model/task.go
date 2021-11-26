// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type Task struct {
	ID       string
	Title    string
	Time     int
	Complete bool
	Tags     []Tag
	BlockID  string
}
