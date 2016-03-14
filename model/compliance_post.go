// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"time"
)

type CompliancePost struct {

	// From Team
	TeamName        string
	TeamDisplayName string

	// From Channel
	ChannelName        string
	ChannelDisplayName string

	// From User
	UserUsername string
	UserEmail    string
	UserNickname string

	// From Post
	PostId         string
	PostCreateAt   int64
	PostUpdateAt   int64
	PostDeleteAt   int64
	PostRootId     string
	PostParentId   string
	PostOriginalId string
	PostMessage    string
	PostType       string
	PostProps      string
	PostHashtags   string
	PostFilenames  string
}

func CompliancePostHeader() []string {
	return []string{
		"TeamName",
		"TeamDisplayName",

		"ChannelName",
		"ChannelDisplayName",

		"UserUsername",
		"UserEmail",
		"UserNickname",

		"PostId",
		"PostCreateAt",
		"PostUpdateAt",
		"PostDeleteAt",
		"PostRootId",
		"PostParentId",
		"PostOriginalId",
		"PostMessage",
		"PostType",
		"PostProps",
		"PostHashtags",
		"PostFilenames",
	}
}

func (me *CompliancePost) Row() []string {

	postDeleteAt := ""
	if me.PostDeleteAt > 0 {
		postDeleteAt = time.Unix(0, me.PostDeleteAt*int64(1000*1000)).Format(time.RFC3339)
	}

	postUpdateAt := ""
	if me.PostUpdateAt != me.PostCreateAt {
		postUpdateAt = time.Unix(0, me.PostUpdateAt*int64(1000*1000)).Format(time.RFC3339)
	}

	return []string{
		me.TeamName,
		me.TeamDisplayName,

		me.ChannelName,
		me.ChannelDisplayName,

		me.UserUsername,
		me.UserEmail,
		me.UserNickname,

		me.PostId,
		time.Unix(0, me.PostCreateAt*int64(1000*1000)).Format(time.RFC3339),
		postUpdateAt,
		postDeleteAt,

		me.PostRootId,
		me.PostParentId,
		me.PostOriginalId,
		me.PostMessage,
		me.PostType,
		me.PostProps,
		me.PostHashtags,
		me.PostFilenames,
	}
}
