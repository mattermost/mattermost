// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// AuditEventPostDelivery is the EventName carried by every post-delivery audit
// record. The user_post_delivery_db target extracts rows from the Meta map, not
// this field, but it pins the event name for any other consumer of
// LvlAuditPostDelivery.
const AuditEventPostDelivery = "post_delivered"

// deliveryChunkSize caps how many ids a single audit record carries. logr drains
// its queue on one goroutine, so the cost that matters is the NUMBER of
// LogRecord calls, not the row count: a wide fan-out (one post to N targets) is
// emitted as one record per chunk instead of one per target. Chunking also
// bounds per-record memory and the target's per-record routing time.
const deliveryChunkSize = 5000

func (a *App) deliveryTrackingEnabled() bool {
	return a.Config().PostDeliveryTrackingEnabled()
}

// shouldTrackDelivery reports whether deliveries of post in channel should be
// recorded: tracking enabled, not a DM/GM channel, and not a system message.
// Bot- and webhook-authored posts ARE tracked. Used by the notification paths
// (websocket, push, email, plugin) where the channel is already in hand; read
// paths spanning channels record without the DM/GM check.
func (a *App) shouldTrackDelivery(channel *model.Channel, post *model.Post) bool {
	return a.deliveryTrackingEnabled() &&
		channel != nil && !channel.IsGroupOrDirect() &&
		post != nil && !post.IsSystemMessage()
}

// emitDeliveryRecord enqueues one delivery audit record at LvlAuditPostDelivery.
// meta must already match the user_post_delivery_db target's contract (a single
// row, a target_ids fan-out, or a post_ids fan-in). We bypass MakeAuditRecord
// because it needs a request.CTX and pre-fills API/cluster metadata meaningless
// here; created_at is omitted on purpose (the store stamps it at flush time).
func (a *App) emitDeliveryRecord(meta map[string]any) {
	a.Srv().Audit.LogRecord(mlog.LvlAuditPostDelivery, model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta:      meta,
	})
}

// deliveryMeta builds the base Meta map shared by every shape. target_type is
// only written when it is not the default ("user"), since the target defaults an
// absent target_type to user — keeping the map a field smaller on the hot path.
func deliveryMeta(targetType string, mechanism int16) map[string]any {
	meta := map[string]any{"mechanism": mechanism}
	if targetType != "" && targetType != model.DeliveryTargetUser {
		meta["target_type"] = targetType
	}
	return meta
}

// RecordPostDelivery records one post delivered to one target. Use for
// single-recipient paths (push, email, outgoing webhook, permalink preview,
// single-post GET).
func (a *App) RecordPostDelivery(targetID, postID, targetType string, mechanism int16) {
	if !a.deliveryTrackingEnabled() || targetID == "" || postID == "" {
		return
	}
	meta := deliveryMeta(targetType, mechanism)
	meta["post_id"] = postID
	meta["target_id"] = targetID
	a.emitDeliveryRecord(meta)
}

// RecordPostDeliveryFanIn records many posts delivered to one target (a read:
// channel open, thread open, search). The post ids are compacted and chunked,
// so a page of N posts costs ceil(N/deliveryChunkSize) records instead of N.
func (a *App) RecordPostDeliveryFanIn(targetID string, postIDs []string, targetType string, mechanism int16) {
	if !a.deliveryTrackingEnabled() || targetID == "" || len(postIDs) == 0 {
		return
	}
	for _, chunk := range chunkDeliveryIDs(postIDs, deliveryChunkSize) {
		meta := deliveryMeta(targetType, mechanism)
		meta["target_id"] = targetID
		meta["post_ids"] = chunk
		a.emitDeliveryRecord(meta)
	}
}

// RecordPostDeliveryFanOut records one post delivered to many targets (websocket
// broadcast, plugin fan-out). The target ids are compacted and chunked.
//
// The caller MUST pass a slice the audit record can own: the logr target reads
// it asynchronously, so a reused/scratch slice would be corrupted by the next
// caller. chunkDeliveryIDs sub-slices it without copying when there are no empty
// ids, so ownership of the backing array transfers to the record.
func (a *App) RecordPostDeliveryFanOut(postID string, targetIDs []string, targetType string, mechanism int16) {
	if !a.deliveryTrackingEnabled() || postID == "" || len(targetIDs) == 0 {
		return
	}
	for _, chunk := range chunkDeliveryIDs(targetIDs, deliveryChunkSize) {
		meta := deliveryMeta(targetType, mechanism)
		meta["post_id"] = postID
		meta["target_ids"] = chunk
		a.emitDeliveryRecord(meta)
	}
}

// RecordPostListDelivery records an in-product read of a PostList by a user as a
// single fan-in record carrying the non-system post ids. System messages are
// skipped (they are not tracked content).
func (a *App) RecordPostListDelivery(userID string, list *model.PostList, mechanism int16) {
	if !a.deliveryTrackingEnabled() || userID == "" || list == nil || len(list.Order) == 0 {
		return
	}
	postIDs := make([]string, 0, len(list.Order))
	for _, id := range list.Order {
		if p := list.Posts[id]; p == nil || p.IsSystemMessage() {
			continue
		}
		postIDs = append(postIDs, id)
	}
	if len(postIDs) == 0 {
		return
	}
	// postIDs is freshly allocated and empty-free, so RecordPostDeliveryFanIn's
	// chunker hands it straight to the record with no further copy.
	a.RecordPostDeliveryFanIn(userID, postIDs, model.DeliveryTargetUser, mechanism)
}

// RecordPostsDelivery is the []*model.Post variant of RecordPostListDelivery,
// for read paths that return a post slice rather than a PostList. System
// messages are skipped.
func (a *App) RecordPostsDelivery(userID string, posts []*model.Post, mechanism int16) {
	if !a.deliveryTrackingEnabled() || userID == "" || len(posts) == 0 {
		return
	}
	postIDs := make([]string, 0, len(posts))
	for _, p := range posts {
		if p == nil || p.Id == "" || p.IsSystemMessage() {
			continue
		}
		postIDs = append(postIDs, p.Id)
	}
	if len(postIDs) == 0 {
		return
	}
	a.RecordPostDeliveryFanIn(userID, postIDs, model.DeliveryTargetUser, mechanism)
}

// chunkDeliveryIDs splits ids into chunks of at most size, dropping empty ids.
// When no ids are empty (the common case) it sub-slices the input rather than
// copying, so the caller's backing array is reused — callers that pass a
// reusable buffer must therefore treat it as owned by the returned chunks.
// Returns nil when no non-empty ids remain.
func chunkDeliveryIDs(ids []string, size int) [][]string {
	src := ids
	if slices.Contains(ids, "") {
		// Compact into a fresh backing array, dropping empties.
		src = make([]string, 0, len(ids))
		for _, v := range ids {
			if v != "" {
				src = append(src, v)
			}
		}
	}
	if len(src) == 0 {
		return nil
	}
	if len(src) <= size {
		return [][]string{src}
	}
	chunks := make([][]string, 0, (len(src)+size-1)/size)
	for i := 0; i < len(src); i += size {
		chunks = append(chunks, src[i:min(i+size, len(src))])
	}
	return chunks
}
