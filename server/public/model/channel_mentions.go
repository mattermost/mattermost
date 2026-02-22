// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

// ChannelMentionsFromAttachments extracts channel mentions from attachment fields.
// It scans pretext, text, and field values (but not titles, as titles are labels).
func ChannelMentionsFromAttachments(attachments []*SlackAttachment) []string {
	alreadyMentioned := make(map[string]bool)
	var names []string

	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}

		// Scan pretext
		for _, match := range channelMentionRegexp.FindAllString(attachment.Pretext, -1) {
			name := match[1:]
			if !alreadyMentioned[name] {
				names = append(names, name)
				alreadyMentioned[name] = true
			}
		}

		// Scan text
		for _, match := range channelMentionRegexp.FindAllString(attachment.Text, -1) {
			name := match[1:]
			if !alreadyMentioned[name] {
				names = append(names, name)
				alreadyMentioned[name] = true
			}
		}

		// Scan field values (not titles - titles are labels)
		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}

			// Field value can be any type, convert to string
			var valueStr string
			switch v := field.Value.(type) {
			case string:
				valueStr = v
			default:
				// For non-string values, we don't scan for mentions
				continue
			}

			for _, match := range channelMentionRegexp.FindAllString(valueStr, -1) {
				name := match[1:]
				if !alreadyMentioned[name] {
					names = append(names, name)
					alreadyMentioned[name] = true
				}
			}
		}
	}

	return names
}
