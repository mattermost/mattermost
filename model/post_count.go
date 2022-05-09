// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PostCountOptions struct {
	// Only include posts on a specific team. "" for any team.
	TeamId          string
	MustHaveFile    bool
	MustHaveHashtag bool
	ExcludeDeleted  bool
}
