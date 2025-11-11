// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func getExplicitMentionsFromPage(post *model.Post, keywords MentionKeywords) *MentionResults {
	parser := makeTipTapMentionParser(keywords)
	parser.ProcessText(post.Message)
	return parser.Results()
}
