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

// auditDeliveryChunkSize caps how many ids a single audit record carries.
// logr drains its queue on a single ordered goroutine, so the cost that
// matters is the NUMBER of LogRecord calls, not the total number of rows. A
// wide fan-out (one post to N users) is therefore emitted as one record per
// chunk instead of N records, collapsing the per-record logr overhead by up
// to this factor. Chunking (rather than one giant record) bounds per-record
// memory and the target worker's per-record routing time.
const auditDeliveryChunkSize = 5000

// emitDeliveryAudit enqueues a single (user, post, mechanism) delivery on the
// audit logger at LvlAuditDelivery. Used by the single-delivery paths (push,
// email, webhook, permalink preview, single-post GET). High-volume fan-outs
// must use the bulk array forms below instead, which emit far fewer records.
//
// We bypass MakeAuditRecord because it requires a request.CTX and pre-fills
// API-path/cluster-id metadata that's meaningless for this flow. created_at is
// omitted on purpose: the target ignores it (SqlAuditStorage stamps it at flush
// time), so computing it per record would be pure overhead.
func (a *App) emitDeliveryAudit(userID, postID string, mechanism int16) {
	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta: map[string]any{
			"user_id":   userID,
			"entity_id": postID,
			"mechanism": mechanism,
		},
	})
}

// emitDeliveryAuditMultiUser enqueues ONE record carrying many user ids for the
// same post (fan-out, e.g. websocket broadcast). The audit_delivery_db target
// expands user_ids and shards each row per user, so this single call replaces
// what used to be one LogRecord call per recipient.
func (a *App) emitDeliveryAuditMultiUser(userIDs []string, entityID string, mechanism int16) {
	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta: map[string]any{
			"user_ids":  userIDs,
			"entity_id": entityID,
			"mechanism": mechanism,
		},
	})
}

// emitDeliveryAuditMultiPost enqueues ONE record carrying many post ids for the
// same user (fan-in, e.g. a channel/thread/search read). One LogRecord call
// replaces one per post returned.
func (a *App) emitDeliveryAuditMultiPost(userID string, entityIDs []string, mechanism int16) {
	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta: map[string]any{
			"user_id":    userID,
			"entity_ids": entityIDs,
			"mechanism":  mechanism,
		},
	})
}

// AuditRecord emits one audit record for a single (user, post, mechanism)
// delivery. Use for single-event delivery paths (push notifications, email,
// outgoing webhook, permalink preview, single-post API GET).
//
// The ctx parameter is unused, the audit logger has its own queue and worker,
// but is retained to avoid call-site churn.
func (a *App) AuditRecord(ctx context.Context, userID, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if userID == "" || postID == "" {
		return
	}
	a.emitDeliveryAudit(userID, postID, mechanism)
}

// AuditRecordBulk records one user receiving many posts (fan-in). The post ids
// are compacted and chunked, and each chunk is emitted as a single array-shaped
// record, so a page of N posts costs ceil(N/auditDeliveryChunkSize) LogRecord
// calls instead of N.
func (a *App) AuditRecordBulk(userID string, postIDs []string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if userID == "" || len(postIDs) == 0 {
		return
	}
	for _, chunk := range chunkDeliveryIDs(postIDs, auditDeliveryChunkSize) {
		a.emitDeliveryAuditMultiPost(userID, chunk, mechanism)
	}
}

// AuditRecordBulkPosts is the post-slice variant of AuditRecordBulk. Use when
// the caller has a []*model.Post so the call site doesn't allocate an
// intermediate []string of ids.
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

// AuditRecordBulkMany records one post delivered to many users (fan-out, e.g. a
// websocket broadcast to every online channel member). The user ids are
// compacted and chunked, and each chunk is emitted as a single array-shaped
// record. This is the hot path: a broadcast to N users now costs
// ceil(N/auditDeliveryChunkSize) LogRecord calls instead of N, which is what
// keeps the single-threaded logr drain from becoming the bottleneck.
func (a *App) AuditRecordBulkMany(userIDs []string, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}

	if postID == "" || len(userIDs) == 0 {
		return
	}
	for _, chunk := range chunkDeliveryIDs(userIDs, auditDeliveryChunkSize) {
		a.emitDeliveryAuditMultiUser(chunk, postID, mechanism)
	}
}

// AuditRecordBulkManyFromUserMap is the map-keyed variant of
// AuditRecordBulkMany. The broadcast call site already holds the recipient set
// as map[string]*model.User; iterating it directly into chunks avoids the
// intermediate []string allocation plus the compact pass that chunkDeliveryIDs
// would otherwise do, which matters on a per-post-create hot path with a
// 50k-member channel.
func (a *App) AuditRecordBulkManyFromUserMap(userMap map[string]*model.User, postID string, mechanism int16) {
	if !model.SafeDereference(a.Config().AuditStorageSettings.Enable) {
		return
	}
	if postID == "" || len(userMap) == 0 {
		return
	}

	chunk := make([]string, 0, min(len(userMap), auditDeliveryChunkSize))
	for uid := range userMap {
		if uid == "" {
			continue
		}
		chunk = append(chunk, uid)
		if len(chunk) == auditDeliveryChunkSize {
			a.emitDeliveryAuditMultiUser(chunk, postID, mechanism)
			chunk = make([]string, 0, auditDeliveryChunkSize)
		}
	}
	if len(chunk) > 0 {
		a.emitDeliveryAuditMultiUser(chunk, postID, mechanism)
	}
}

// chunkDeliveryIDs compacts (drops empty ids) and splits a slice into chunks of
// at most size. Returns nil when no non-empty ids remain. The returned chunks
// are sub-slices of a single backing array, so chunking allocates once.
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
