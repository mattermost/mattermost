// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package poster

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// Poster defines an entity that can post DMs and Ephemerals and update and delete those posts
type Poster interface {
	DMer

	// DMWithAttachments posts a Direct Message that contains Slack attachments.
	// Often used to include post actions.
	DMWithAttachments(mattermostUserID string, attachments ...*model.SlackAttachment) (string, error)

	// Ephemeral sends an ephemeral message to a user
	Ephemeral(mattermostUserID, channelID, format string, args ...interface{})

	// UpdatePostByID updates the post with postID with the formatted message
	UpdatePostByID(postID, format string, args ...interface{}) error

	// DeletePost deletes a single post
	DeletePost(postID string) error

	// DMUpdatePost substitute one post with another
	UpdatePost(post *model.Post) error

	// UpdatePosterID updates the Mattermost User ID of the poster
	UpdatePosterID(id string)
}

// DMer defines an entity that can send Direct Messages
type DMer interface {
	// DM posts a simple Direct Message to the specified user
	DM(mattermostUserID, format string, args ...interface{}) (string, error)
}
