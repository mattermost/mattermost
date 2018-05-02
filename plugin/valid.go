// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"regexp"
	"unicode/utf8"
)

const (
	MinIdLength = 3
	MaxIdLength = 190
)

var ValidId *regexp.Regexp

func init() {
	ValidId = regexp.MustCompile(`^[a-zA-Z0-9-_\.]+$`)
}

func IsValidId(id string) bool {
	if utf8.RuneCountInString(id) < MinIdLength {
		return false
	}

	if utf8.RuneCountInString(id) > MaxIdLength {
		return false
	}

	return ValidId.MatchString(id)
}
