// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"regexp"
	"strings"
)

var channelMentionRegexp = regexp.MustCompile(`\B~[a-zA-Z0-9\-_]+`)

func ChannelMentions(message string) []string {
	var names []string

	if strings.Contains(message, "~") {
		alreadyMentioned := make(map[string]bool)
		for _, match := range channelMentionRegexp.FindAllString(message, -1) {
			name := match[1:]
			if !alreadyMentioned[name] {
				names = append(names, name)
				alreadyMentioned[name] = true
			}
		}
	}

	return names
}
