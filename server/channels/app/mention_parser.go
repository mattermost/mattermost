// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

type MentionParser interface {
	ProcessText(text string)
	Results() *MentionResults
}
