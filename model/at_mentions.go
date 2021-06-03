// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"regexp"
	"strings"
)

var atMentionRegexp = regexp.MustCompile(`\B@[[:alnum:]][[:alnum:]\.\-_:]*`)

const usernameSpecialChars = ".-_"

// PossibleAtMentions returns all substrings in message that look like valid @
// mentions.
func PossibleAtMentions(message string) []string {
	var names []string

	if !strings.Contains(message, "@") {
		return names
	}

	alreadyMentioned := make(map[string]bool)
	for _, match := range atMentionRegexp.FindAllString(message, -1) {
		name := NormalizeUsername(match[1:])
		if !alreadyMentioned[name] && IsValidUsernameAllowRemote(name) {
			names = append(names, name)
			alreadyMentioned[name] = true
		}
	}

	return names
}

// TrimUsernameSpecialChar tries to remove the last character from word if it
// is a special character for usernames (dot, dash or underscore). If not, it
// returns the same string.
func TrimUsernameSpecialChar(word string) (string, bool) {
	len := len(word)

	if len > 0 && strings.LastIndexAny(word, usernameSpecialChars) == (len-1) {
		return word[:len-1], true
	}

	return word, false
}
