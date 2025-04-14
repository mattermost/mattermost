// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// fixMention replaces any mentions in a post for the user with the user's real username.
func fixMention(post *model.Post, mentionMap model.UserMentionMap, user *model.User) {
	if post == nil || len(mentionMap) == 0 {
		return
	}

	realUsername, ok := user.GetProp(model.UserPropsKeyRemoteUsername)
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

// getPostMetadataLogFields returns common log fields for a post's metadata
func getPostMetadataLogFields(post *model.Post) []mlog.Field {
	return []mlog.Field{
		mlog.Bool("has_priority", post.Metadata != nil && post.Metadata.Priority != nil),
		mlog.Bool("is_urgent", isUrgentPost(post)),
		mlog.Bool("has_requested_ack", hasRequestedAck(post)),
		mlog.Bool("has_persistent_notifications", hasPersistentNotifications(post)),
		mlog.Int("ack_count", getAckCount(post)),
	}
}

// isUrgentPost returns true if the post has the urgent priority flag set
func isUrgentPost(post *model.Post) bool {
	if post.Metadata != nil && post.Metadata.Priority != nil && post.Metadata.Priority.Priority != nil {
		return *post.Metadata.Priority.Priority == model.PostPriorityUrgent
	}
	return false
}

// hasRequestedAck returns true if the post has the requested acknowledgement flag set
func hasRequestedAck(post *model.Post) bool {
	if post.Metadata != nil && post.Metadata.Priority != nil && post.Metadata.Priority.RequestedAck != nil {
		return *post.Metadata.Priority.RequestedAck
	}
	return false
}

// hasPersistentNotifications returns true if the post has the persistent notifications flag set
func hasPersistentNotifications(post *model.Post) bool {
	if post.Metadata != nil && post.Metadata.Priority != nil && post.Metadata.Priority.PersistentNotifications != nil {
		return *post.Metadata.Priority.PersistentNotifications
	}
	return false
}

// getAckCount returns the number of acknowledgements in a post
func getAckCount(post *model.Post) int {
	if post.Metadata != nil {
		return len(post.Metadata.Acknowledgements)
	}
	return 0
}

// hasPriorityPosts checks if any post in the collection has priority metadata
func hasPriorityPosts(posts []*model.Post) bool {
	for _, p := range posts {
		if p.Metadata != nil && p.Metadata.Priority != nil {
			return true
		}
	}
	return false
}

// hasUrgentPosts checks if any post in the collection has urgent priority
func hasUrgentPosts(posts []*model.Post) bool {
	for _, p := range posts {
		if isUrgentPost(p) {
			return true
		}
	}
	return false
}

// hasRequestedAckPosts checks if any post in the collection has requested acknowledgements
func hasRequestedAckPosts(posts []*model.Post) bool {
	for _, p := range posts {
		if hasRequestedAck(p) {
			return true
		}
	}
	return false
}

// hasPersistentNotificationsPosts checks if any post in the collection has persistent notifications
func hasPersistentNotificationsPosts(posts []*model.Post) bool {
	for _, p := range posts {
		if hasPersistentNotifications(p) {
			return true
		}
	}
	return false
}

// hasAckPosts checks if any post in the collection has acknowledgements
func hasAckPosts(posts []*model.Post) bool {
	for _, p := range posts {
		if getAckCount(p) > 0 {
			return true
		}
	}
	return false
}

// shouldUpdatePostMetadata determines if a post should be updated based on metadata changes.
// Metadata fields are checked in the following order:
// 1. Priority existence
// 2. Priority value (urgent/normal)
// 3. RequestedAck value
// 4. PersistentNotifications value
// 5. Acknowledgements
func shouldUpdatePostMetadata(post, existingPost *model.Post) bool {
	// If incoming post doesn't have metadata but existing does, we should preserve it
	if post.Metadata == nil {
		return false
	}

	// Fast check - if existing post has no metadata but new one does, we need to update
	if existingPost.Metadata == nil {
		return post.Metadata.Priority != nil || len(post.Metadata.Acknowledgements) > 0
	}

	// Check if priority has changed
	if post.Metadata.Priority != nil {
		// If existing post has no priority, we need to update
		if existingPost.Metadata.Priority == nil {
			return true
		}

		// Check if priority settings have changed
		postPriority := post.Metadata.Priority
		existingPriority := existingPost.Metadata.Priority

		// Compare priority values
		if (postPriority.Priority == nil) != (existingPriority.Priority == nil) {
			return true
		}
		if postPriority.Priority != nil && existingPriority.Priority != nil && *postPriority.Priority != *existingPriority.Priority {
			return true
		}

		// Compare RequestedAck values
		if (postPriority.RequestedAck == nil) != (existingPriority.RequestedAck == nil) {
			return true
		}
		if postPriority.RequestedAck != nil && existingPriority.RequestedAck != nil && *postPriority.RequestedAck != *existingPriority.RequestedAck {
			return true
		}

		// Compare PersistentNotifications values
		if (postPriority.PersistentNotifications == nil) != (existingPriority.PersistentNotifications == nil) {
			return true
		}
		if postPriority.PersistentNotifications != nil && existingPriority.PersistentNotifications != nil &&
			*postPriority.PersistentNotifications != *existingPriority.PersistentNotifications {
			return true
		}
	}

	// Check if acknowledgements have changed
	if len(post.Metadata.Acknowledgements) > 0 {
		// If number of acknowledgements is different, we need to update
		if len(post.Metadata.Acknowledgements) != len(existingPost.Metadata.Acknowledgements) {
			return true
		}

		// Only build map and check for changes if counts are the same
		existingAcks := make(map[string]bool, len(existingPost.Metadata.Acknowledgements))
		for _, ack := range existingPost.Metadata.Acknowledgements {
			existingAcks[ack.UserId] = true
		}

		// Check if any new acknowledgements exist
		for _, ack := range post.Metadata.Acknowledgements {
			if !existingAcks[ack.UserId] {
				return true
			}
		}
	}

	return false
}
