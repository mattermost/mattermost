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

// auditDeliveryBatchSize caps how many IDs a single bulk audit record
// carries. Chunking bounds the worst-case multi-row INSERT size and the
// target worker's per-record blocking time, so a wide fan-out can't
// monopolize the audit queue with one huge record.
const auditDeliveryBatchSize = 1000

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

// emitDeliveryAuditMultiPost enqueues one audit record carrying an array
// of entity IDs for the same userID. The audit_delivery_db target unpacks
// the array and writes the rows in a single multi-row INSERT.
func (a *App) emitDeliveryAuditMultiPost(userID string, entityIDs []string, mechanism int16) {
	rec := model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta: map[string]any{
			"type":       model.AuditMetaTypeMultiPost,
			"user_id":    userID,
			"entity_ids": entityIDs,
			"mechanism":  mechanism,
			"created_at": model.GetMillis(),
		},
	}
	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, rec)
}

// emitDeliveryAuditMultiUser enqueues one audit record carrying an array
// of user IDs for the same entityID. The audit_delivery_db target unpacks
// the array and writes the rows in a single multi-row INSERT.
func (a *App) emitDeliveryAuditMultiUser(userIDs []string, entityID string, mechanism int16) {
	rec := model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta: map[string]any{
			"type":       model.AuditMetaTypeMultiUser,
			"user_ids":   userIDs,
			"entity_id":  entityID,
			"mechanism":  mechanism,
			"created_at": model.GetMillis(),
		},
	}
	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, rec)
}

// chunkDeliveryIDs compacts (filters empty strings) and chunks an ID slice
// for bulk audit delivery. Returns nil if no non-empty IDs remain.
func chunkDeliveryIDs(ids []string, size int) [][]string {
	compact := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != "" {
			compact = append(compact, id)
		}
	}
	if len(compact) == 0 {
		return nil
	}
	chunks := make([][]string, 0, (len(compact)+size-1)/size)
	for i := 0; i < len(compact); i += size {
		end := min(i+size, len(compact))
		chunks = append(chunks, compact[i:end])
	}
	return chunks
}

// AuditRecordBulk emits batched audit records for one user reading many
// posts. The full postIDs slice is compacted (empty IDs filtered out) and
// then chunked into records of at most auditDeliveryBatchSize, each going
// through the audit logger as a single record that the audit_delivery_db
// target drains via one MarkBulkSameUser call (one multi-row INSERT).
func (a *App) AuditRecordBulk(userID string, postIDs []string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if userID == "" || len(postIDs) == 0 {
		return
	}

	for _, chunk := range chunkDeliveryIDs(postIDs, auditDeliveryBatchSize) {
		a.emitDeliveryAuditMultiPost(userID, chunk, mechanism)
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
// online channel member. Like AuditRecordBulk, userIDs is compacted then
// chunked so each emitted record drains as one MarkBulkSamePost call.
func (a *App) AuditRecordBulkMany(userIDs []string, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if postID == "" || len(userIDs) == 0 {
		return
	}

	for _, chunk := range chunkDeliveryIDs(userIDs, auditDeliveryBatchSize) {
		a.emitDeliveryAuditMultiUser(chunk, postID, mechanism)
	}
}
