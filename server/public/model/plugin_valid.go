// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"regexp"
	"unicode/utf8"
)

const (
	MinIdLength  = 3
	MaxIdLength  = 190
	ValidIdRegex = `^[a-zA-Z0-9-_\.]+$`
)

// ValidId constrains the set of valid plugin identifiers:
//
//	^[a-zA-Z0-9-_\.]+
var validId *regexp.Regexp

func init() {
	validId = regexp.MustCompile(ValidIdRegex)
}

// IsValidPluginId verifies that the plugin id has a minimum length of 3, maximum length of 190, and
// contains only alphanumeric characters, dashes, underscores and periods.
//
// These constraints are necessary since the plugin id is used as part of a filesystem path.
func IsValidPluginId(id string) bool {
	if utf8.RuneCountInString(id) < MinIdLength {
		return false
	}

	if utf8.RuneCountInString(id) > MaxIdLength {
		return false
	}

	return validId.MatchString(id)
}
