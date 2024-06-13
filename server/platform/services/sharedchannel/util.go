// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// fixMention replaces any mentions in a post for the user with the user's real username.
func fixMention(post *model.Post, mentionMap model.UserMentionMap, user *model.User) {
	if post == nil || len(mentionMap) == 0 {
		return
	}

	realUsername, ok := user.GetProp(KeyRemoteUsername)
	if !ok {
		return
	}

	// there may be more than one mention for each user so we have to walk the whole map.
	for mention, id := range mentionMap {
		if id == user.Id && strings.Contains(mention, ":") {
			post.Message = strings.ReplaceAll(post.Message, "@"+mention, "@"+realUsername)
		}
	}
}

func sanitizeUserForSync(user *model.User) *model.User {
	user.Password = model.NewId()
	user.AuthData = nil
	user.AuthService = ""
	user.Roles = "system_user"
	user.AllowMarketing = false
	user.NotifyProps = model.StringMap{}
	user.LastPasswordUpdate = 0
	user.LastPictureUpdate = 0
	user.FailedAttempts = 0
	user.MfaActive = false
	user.MfaSecret = ""

	return user
}

const MungUsernameSeparator = "-"

// mungUsername creates a new username by combining username and remote cluster name, plus
// a suffix to create uniqueness. If the resulting username exceeds the max length then
// it is truncated and ellipses added.
func mungUsername(username string, remotename string, suffix string, maxLen int) string {
	if suffix != "" {
		suffix = MungUsernameSeparator + suffix
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

func isConflictError(err error) (string, bool) {
	if err == nil {
		return "", false
	}

	var errConflict *store.ErrConflict
	if errors.As(err, &errConflict) {
		return strings.ToLower(errConflict.Resource), true
	}

	var errInput *store.ErrInvalidInput
	if errors.As(err, &errInput) {
		_, field, _ := errInput.InvalidInputInfo()
		return strings.ToLower(field), true
	}
	return "", false
}

func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	var errNotFound *store.ErrNotFound
	return errors.As(err, &errNotFound)
}

func postsSliceToMap(posts []*model.Post) map[string]*model.Post {
	m := make(map[string]*model.Post, len(posts))
	for _, p := range posts {
		m[p.Id] = p
	}
	return m
}

func reducePostsSliceInCache(posts []*model.Post, cache map[string]*model.Post) []*model.Post {
	reduced := make([]*model.Post, 0, len(posts))
	for _, p := range posts {
		if _, ok := cache[p.Id]; !ok {
			reduced = append(reduced, p)
		}
	}
	return reduced
}
