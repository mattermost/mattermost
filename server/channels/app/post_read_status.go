// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// QueueSinglePostReadStatus queues a single post read status entry for bulk writing to the database.
func (a *App) QueueSinglePostReadStatus(postID string, userID string) {
	a.Srv().Platform().QueueSinglePostReadStatus(postID, userID)
}

// QueuePostReadStatus queues post read status entries for bulk writing to the database.
func (a *App) QueuePostReadStatus(postIDs []string, userID string) {
	a.Srv().Platform().QueuePostReadStatus(postIDs, userID)
}
