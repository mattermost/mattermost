// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"regexp"
)

// Based off the mobile app's emoji parsing from https://github.com/mattermost/commonmark.js

var (
	emojiRegex = regexp.MustCompile(`^:([a-z0-9_\-+]+):\B`)
)

// parseEmoji attempts to parse a named emoji (eg. :taco:) starting at the current parser position. If an emoji is
// found, it adds that to p.inlines and returns true. Otherwise, it returns false.
func (p *inlineParser) parseEmoji() bool {
	// Only allow emojis after non-word characters
	if p.position > 1 {
		prevChar := p.raw[p.position-1]

		if isWordByte(prevChar) {
			return false
		}
	}

	remaining := p.raw[p.position:]

	loc := emojiRegex.FindStringIndex(remaining)
	if loc == nil {
		return false
	}

	// Note that there may not be a system or custom emoji that exists with this name
	p.inlines = append(p.inlines, &Emoji{
		Name: remaining[loc[0]+1 : loc[1]-1],
	})
	p.position += loc[1] - loc[0]

	return true
}
