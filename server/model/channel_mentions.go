// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"regexp"
	"strings"
)

var channelMentionRegexp = regexp.MustCompile(`\B~[a-zA-Z0-9\-_]+`)
var channelMentionAcrossTeamsRegexp = regexp.MustCompile(`\B~[a-zA-Z0-9\-_]+\(+[a-zA-Z0-9\-_]+\)+`)
var channelMentionTeamRegexp = regexp.MustCompile(`\([a-zA-Z0-9\-_]+`)

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

func ChannelMentionsAcrossTeams(message string) map[string][]string {
	names := map[string][]string{}

	if strings.Contains(message, "~") {
		alreadyMentioned := make(map[string]bool)
		for _, match := range channelMentionAcrossTeamsRegexp.FindAllString(message, -1) {
			channelString := channelMentionRegexp.FindString(match)
			teamString := channelMentionTeamRegexp.FindString(match)
			name := channelString[1:]
			team := teamString[1:]
			if !alreadyMentioned[match] {
				names[team] = append(names[team], name)
				alreadyMentioned[match] = true
			}
		}
	}
	return names
}
