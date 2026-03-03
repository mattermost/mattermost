// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// QueuePostReadStatus queues post read status entries for bulk writing to the database.
func (a *App) QueuePostReadStatus(postIDs []string, userID string) {
	a.Srv().Platform().QueuePostReadStatus(postIDs, userID)
}
