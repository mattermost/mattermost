package app

import "github.com/mattermost/mattermost/server/public/model"

func mapsToMentionKeywords(userKeywords map[string][]string, groups map[string]*model.Group) MentionKeywords {
	keywords := make(MentionKeywords, len(userKeywords)+len(groups))

	for keyword, ids := range userKeywords {
		for _, id := range ids {
			keywords[keyword] = append(keywords[keyword], MentionableUserID(id))
		}
	}

	for _, group := range groups {
		keyword := "@" + *group.Name
		keywords[keyword] = append(keywords[keyword], MentionableGroupID(group.Id))
	}

	return keywords
}
