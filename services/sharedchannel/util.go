// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// mungUsername creates a new username by combining username and remote cluster name, plus
// a suffix to create uniqueness. If the resulting username exceeds the max length then
// it is truncated and ellipses added.
func mungUsername(username string, remotename string, suffix string, maxLen int) string {
	if suffix != "" {
		suffix = "~" + suffix
	}

	// If the username already contains a colon then another server already munged it.
	// In that case we can split on the colon and use the existing remote name.
	// We still need to re-mung with suffix in case of collision.
	comps := strings.Split(username, ":")
	if len(comps) >= 2 {
		username = comps[0]
		remotename = strings.Join(comps[1:], "")
	}

	var userEllipses string
	var remoteEllipses string

	// The remotename is allowed to use up to half the maxLen, and the username gets the remaining space.
	// Username might have a suffix to account for, and remotename always has a preceding colon.
	half := maxLen / 2

	// If the remotename is less than half the maxLen, then the left over space can be given to
	// the username.
	extra := half - (len(remotename) + 1)
	if extra < 0 {
		extra = 0
	}

	truncUser := (len(username) + len(suffix)) - (half + extra)
	if truncUser > 0 {
		username = username[:len(username)-truncUser-3]
		userEllipses = "..."
	}

	truncRemote := (len(remotename) + 1) - (maxLen - (len(username) + len(userEllipses) + len(suffix)))
	if truncRemote > 0 {
		remotename = remotename[:len(remotename)-truncRemote-3]
		remoteEllipses = "..."
	}

	return fmt.Sprintf("%s%s%s:%s%s", username, suffix, userEllipses, remotename, remoteEllipses)
}

// mungEmail creates a unique email address using a UID and remote name.
func mungEmail(remotename string, maxLen int) string {
	s := fmt.Sprintf("%s@%s", model.NewId(), remotename)
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	return s
}
