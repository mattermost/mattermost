// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"regexp"
)

// URL pattern: /:team/wiki/:channelId/:wikiId/:pageId
var pageUrlPattern = regexp.MustCompile(`^/([^/]+)/wiki/([^/]+)/([^/]+)/([^/]+)$`)

// ParsePageUrl extracts teamName, channelId, wikiId, and pageId from a page URL
func ParsePageUrl(url string) (teamName, channelId, wikiId, pageId string, ok bool) {
	matches := pageUrlPattern.FindStringSubmatch(url)
	if len(matches) != 5 {
		return "", "", "", "", false
	}
	return matches[1], matches[2], matches[3], matches[4], true
}

// IsPageUrl checks if a URL is an internal page URL
func IsPageUrl(url string) bool {
	return pageUrlPattern.MatchString(url)
}

// BuildPageUrl constructs a page URL from components
func BuildPageUrl(teamName, channelId, wikiId, pageId string) string {
	return fmt.Sprintf("/%s/wiki/%s/%s/%s", teamName, channelId, wikiId, pageId)
}

// BuildWikiUrl constructs a wiki root URL from components
func BuildWikiUrl(teamName, channelId, wikiId string) string {
	return fmt.Sprintf("/%s/wiki/%s/%s", teamName, channelId, wikiId)
}
