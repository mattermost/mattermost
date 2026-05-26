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
// Errors are logged but never propagated — audit failures must not fail
// the user-facing request.
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

// AuditRecordBulk dispatches one async INSERT … SELECT FROM unnest($postIDs)
// for (userID, *, mechanism). The store call runs in a tracked goroutine
// via Srv().Go so the request thread returns immediately. The context is
// detached (context.Background()) on purpose — the audit write should
// outlive the originating request.
//
// Safe to call with empty inputs; the function short-circuits without
// allocating.
func (a *App) AuditRecordBulk(userID string, postIDs []string, mechanism int16) {
	if userID == "" || len(postIDs) == 0 {
		return
	}
	srv := a.Srv()
	srv.Go(func() {
		if err := srv.Store().AuditStorage().MarkBulkSameUser(context.Background(), userID, postIDs, mechanism); err != nil {
			a.Log().Warn("audit_storage MarkBulkSameUser failed",
				mlog.Int("count", len(postIDs)),
				mlog.Int("mechanism", int(mechanism)),
				mlog.Err(err))
		}
	})
}

// AuditRecordBulkPosts is the post-slice variant of AuditRecordBulk. Use
// when the caller has a []*model.Post (e.g. getPostsByIds, fan-out from
// the App layer) so the call site doesn't need to allocate an intermediate
// []string of IDs.
//
// One iteration extracts post IDs into a freshly allocated slice that is
// passed to the store; the store itself does no client-side loop.
func (a *App) AuditRecordBulkPosts(userID string, posts []*model.Post, mechanism int16) {
	if userID == "" || len(posts) == 0 {
		return
	}
	postIDs := make([]string, 0, len(posts))
	for _, p := range posts {
		if p == nil || p.Id == "" {
			continue
		}
		postIDs = append(postIDs, p.Id)
	}
	a.AuditRecordBulk(userID, postIDs, mechanism)
}

// AuditRecordBulkMany is the fan-out variant: one post, many recipients.
// Used for websocket broadcast where the same postID is delivered to every
// online channel member.
func (a *App) AuditRecordBulkMany(userIDs []string, postID string, mechanism int16) {
	if postID == "" || len(userIDs) == 0 {
		return
	}
	srv := a.Srv()
	srv.Go(func() {
		if err := srv.Store().AuditStorage().MarkBulkSamePost(context.Background(), userIDs, postID, mechanism); err != nil {
			a.Log().Warn("audit_storage MarkBulkSamePost failed",
				mlog.Int("count", len(userIDs)),
				mlog.Int("mechanism", int(mechanism)),
				mlog.Err(err))
		}
	})
}
