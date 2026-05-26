// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// AuditRecord writes a single (user, post, mechanism) entry synchronously
// on the calling goroutine. Use for single-event delivery paths
// (push notifications, email, outgoing webhook, permalink preview,
// single-post API GET).
//
// Errors are logged but never propagated — audit failures must not
// fail the user-facing request.
func (a *App) AuditRecord(ctx context.Context, userID, postID string, mechanism int16) {
	if userID == "" || postID == "" {
		return
	}
	if err := a.Srv().Store().AuditStorage().Mark(ctx, userID, postID, mechanism); err != nil {
		a.Log().Warn("audit_storage Mark failed",
			mlog.String("user_id", userID),
			mlog.String("post_id", postID),
			mlog.Int("mechanism", int(mechanism)),
			mlog.Err(err))
	}
}

// AuditRecordBulk dispatches one async COPY of entries for (userID, postID)
// over postIDs, all tagged with the same mechanism. The MarkBulk call runs
// in a tracked goroutine via Srv().Go so the request thread returns
// immediately. The context is detached (context.Background()) on purpose —
// the audit write should outlive the originating request.
//
// Safe to call with an empty postIDs slice or an empty userID; the function
// short-circuits without allocating.
func (a *App) AuditRecordBulk(userID string, postIDs []string, mechanism int16) {
	if userID == "" || len(postIDs) == 0 {
		return
	}
	now := model.GetMillis()
	entries := make([]model.AuditStorageEntry, len(postIDs))
	for i, pid := range postIDs {
		if pid == "" {
			continue
		}
		entries[i] = model.AuditStorageEntry{
			UserID:    userID,
			PostID:    pid,
			Mechanism: mechanism,
			CreatedAt: now,
		}
	}
	srv := a.Srv()
	srv.Go(func() {
		if err := srv.Store().AuditStorage().MarkBulk(context.Background(), entries); err != nil {
			a.Log().Warn("audit_storage MarkBulk failed",
				mlog.Int("count", len(entries)),
				mlog.Int("mechanism", int(mechanism)),
				mlog.Err(err))
		}
	})
}

// AuditRecordBulkMany is the fan-out variant: one post, many recipients.
// Used for websocket broadcast where the same postID is delivered to every
// online channel member.
func (a *App) AuditRecordBulkMany(userIDs []string, postID string, mechanism int16) {
	if postID == "" || len(userIDs) == 0 {
		return
	}
	now := model.GetMillis()
	entries := make([]model.AuditStorageEntry, 0, len(userIDs))
	for _, uid := range userIDs {
		if uid == "" {
			continue
		}
		entries = append(entries, model.AuditStorageEntry{
			UserID:    uid,
			PostID:    postID,
			Mechanism: mechanism,
			CreatedAt: now,
		})
	}
	if len(entries) == 0 {
		return
	}
	srv := a.Srv()
	srv.Go(func() {
		if err := srv.Store().AuditStorage().MarkBulk(context.Background(), entries); err != nil {
			a.Log().Warn("audit_storage MarkBulk failed",
				mlog.Int("count", len(entries)),
				mlog.Int("mechanism", int(mechanism)),
				mlog.Err(err))
		}
	})
}

// postIDsFromList returns the slice of post IDs in the order they appear in
// a PostList. Convenience for bulk recording over a fetched PostList.
func postIDsFromList(list *model.PostList) []string {
	if list == nil {
		return nil
	}
	return list.Order
}
