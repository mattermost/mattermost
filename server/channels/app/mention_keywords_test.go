// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

func mapsToMentionKeywords(m map[string][]string) MentionKeywords {
	keywords := make(MentionKeywords, len(m))
	for key, ids := range m {
		keywords[key] = make([]MentionableID, len(ids))
		for i, id := range ids {
			keywords[key][i] = MentionableUserID(id)
		}
	}
	return keywords
}
