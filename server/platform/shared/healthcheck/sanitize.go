// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"regexp"
)

// maxJobErrorRunes keeps a job error short enough to read in a Support Packet; the full error is in the
// server log under the job's id.
const maxJobErrorRunes = 500

var urlCredentials = regexp.MustCompile(`([A-Za-z][A-Za-z0-9+.-]*://)[^\s/]+@`)

// MaskURLCredentials removes URL userinfo from an error. Hostnames and secrets in query strings are kept.
func MaskURLCredentials(s string) string {
	return urlCredentials.ReplaceAllString(s, "${1}****@")
}

// SanitizeJobError masks URL credentials in a job's error and truncates it to maxJobErrorRunes runes.
func SanitizeJobError(s string) string {
	s = MaskURLCredentials(s)
	runes := []rune(s)
	if len(runes) <= maxJobErrorRunes {
		return s
	}
	return string(runes[:maxJobErrorRunes]) + "…"
}
