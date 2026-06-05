// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// AuditEventPostDelivery is the EventName carried by every audit record
// emitted from this file. The audit_delivery_db target keys its row
// extraction off the Meta map, not this field, but the constant pins the
// event name for any other target subscribing to LvlAuditDelivery.
const AuditEventPostDelivery = "post_delivered"

// emitDeliveryAudit builds one model.AuditRecord for a single (user, post,
// mechanism) delivery and enqueues it on the audit logger at
// LvlAuditDelivery. The audit_delivery_db target dequeues it and writes
// the row through SqlAuditStorage.
//
// We bypass MakeAuditRecord because it requires a request.CTX and pre-fills
// API-path/cluster-id metadata that's meaningless for this flow.
// LogRecord enqueues without blocking unless the target queue is full, so
// no extra goroutine is needed even on bulk fan-outs.
func (a *App) emitDeliveryAudit(userID, postID string, mechanism int16) {
	rec := model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta: map[string]any{
			"user_id":    userID,
			"entity_id":  postID,
			"mechanism":  mechanism,
			"created_at": model.GetMillis(),
		},
	}
	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, rec)
}

// AuditRecord emits one audit record for a single (user, post, mechanism)
// delivery. Use for single-event delivery paths (push notifications, email,
// outgoing webhook, permalink preview, single-post API GET).
//
// The ctx parameter is unused — the audit logger has its own queue and
// worker — but is retained to avoid call-site churn.
func (a *App) AuditRecord(ctx context.Context, userID, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if userID == "" || postID == "" {
		return
	}
	a.emitDeliveryAudit(userID, postID, mechanism)
}

// AuditRecordBulk emits one audit record per postID for the same userID.
// LogRecord is itself a non-blocking enqueue, so no goroutine wrapping is
// needed; very wide fan-outs may hit the audit queue's OnQueueFull handler
// (drop policy), which matches the pre-existing "audit-failure-is-non-fatal"
// contract.
func (a *App) AuditRecordBulk(userID string, postIDs []string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if userID == "" || len(postIDs) == 0 {
		return
	}
	for _, postID := range postIDs {
		if postID == "" {
			continue
		}
		a.emitDeliveryAudit(userID, postID, mechanism)
	}
}

// AuditRecordBulkPosts is the post-slice variant of AuditRecordBulk. Use
// when the caller has a []*model.Post (e.g. getPostsByIds, fan-out from
// the App layer) so the call site doesn't need to allocate an intermediate
// []string of IDs.
func (a *App) AuditRecordBulkPosts(userID string, posts []*model.Post, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

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
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if postID == "" || len(userIDs) == 0 {
		return
	}
	for _, userID := range userIDs {
		if userID == "" {
			continue
		}
		a.emitDeliveryAudit(userID, postID, mechanism)
	}
}
