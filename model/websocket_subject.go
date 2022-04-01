// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "regexp"

// WebsocketSubjectID represents the identifier that associates subjects (websockets messages) with observers (websocket connections).
// An example of which is "insights", however, this could support more complex strings like "channels/wds7jxtetjgjue9yca5i5r1cjc".
type WebsocketSubjectID string

var subjectIDPatterns []*regexp.Regexp

func init() {
	subjectIDPatterns = []*regexp.Regexp{
		regexp.MustCompile(`^activity_feed$`),
		regexp.MustCompile(`channels/[a-z,0-9]{26}/typing`),
	}
}

func (si WebsocketSubjectID) IsValid() bool {
	if si == "" {
		return false
	}
	for _, r := range subjectIDPatterns {
		if r.MatchString(string(si)) {
			return true
		}
	}
	return false
}
