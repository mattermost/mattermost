// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"net/http"
	"strings"
)

// ExpectsJSON reports whether the request Accept header includes application/json.
func ExpectsJSON(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	if accept == "" {
		return false
	}

	for part := range strings.SplitSeq(accept, ",") {
		mediaType := strings.TrimSpace(strings.Split(part, ";")[0])
		if strings.EqualFold(mediaType, "application/json") {
			return true
		}
	}

	return false
}
