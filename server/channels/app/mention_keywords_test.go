package app

func mapToUserKeywords(m map[string][]string) MentionKeywords {
	keywords := make(MentionKeywords, len(m))
	for key, ids := range m {
		keywords[key] = make([]MentionableID, len(ids))
		for i, id := range ids {
			keywords[key][i] = MentionableUserID(id)
		}
	}
	return keywords
}
