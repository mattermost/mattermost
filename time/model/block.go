// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type Block struct {
	ID            string
	StartAt       int64
	MinTime       int
	Tasks         []string
	Tags          []Tag
	ReoccurringID string
}
