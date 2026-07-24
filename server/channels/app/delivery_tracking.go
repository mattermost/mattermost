// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	AuditEventPostDelivery = "post_delivered"
	deliveryChunkSize      = 5000
)

func (a *App) deliveryTrackingEnabled() bool {
	return a.Config().PostDeliveryTrackingEnabled()
}

func (a *App) shouldTrackDelivery(channel *model.Channel, post *model.Post) bool {
	return a.deliveryTrackingEnabled() &&
		channel != nil &&
		post != nil && !post.IsSystemMessage()
}

func (a *App) shouldTrackPushDelivery(msg *model.PushNotification) bool {
	// Only track when the push actually carries the message body. generic,
	// generic_no_channel, and id_loaded pushes don't deliver the post content.
	if msg.Type != model.PushTypeMessage || msg.PostId == "" ||
		*a.Config().EmailSettings.PushNotificationContents != model.FullNotification {
		return false
	}
	return a.shouldTrackDelivery(
		&model.Channel{Type: msg.ChannelType},
		&model.Post{Type: msg.PostType},
	)
}

func (a *App) emitDeliveryRecord(meta map[string]any) {
	a.Srv().DeliveryAudit.LogRecord(mlog.LvlAuditPostDelivery, model.AuditRecord{
		EventName: AuditEventPostDelivery,
		Status:    model.AuditStatusSuccess,
		Meta:      meta,
	})
}

func deliveryMeta(targetType string, mechanism int16) map[string]any {
	meta := map[string]any{"mechanism": mechanism}
	if targetType != "" && targetType != model.DeliveryTargetUser {
		meta["target_type"] = targetType
	}
	return meta
}

func (a *App) RecordPostDelivery(targetID, postID, targetType string, mechanism int16) {
	if !a.deliveryTrackingEnabled() || targetID == "" || postID == "" {
		return
	}
	meta := deliveryMeta(targetType, mechanism)
	meta["post_id"] = postID
	meta["target_id"] = targetID
	a.emitDeliveryRecord(meta)
}

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

func (a *App) RecordPostListDelivery(userID string, list *model.PostList, mechanism int16) {
	a.recordPostListDelivery(userID, list, model.DeliveryTargetUser, mechanism)
}

func (a *App) RecordPostsDelivery(userID string, posts []*model.Post, mechanism int16) {
	a.recordPostsDelivery(userID, posts, model.DeliveryTargetUser, mechanism)
}

func (a *App) RecordPostListDeliveryToPlugin(pluginID string, list *model.PostList) {
	a.recordPostListDelivery(pluginID, list, model.DeliveryTargetPlugin, model.DeliveryMechanismPlugin)
}

func (a *App) RecordPostsDeliveryToPlugin(pluginID string, posts []*model.Post) {
	a.recordPostsDelivery(pluginID, posts, model.DeliveryTargetPlugin, model.DeliveryMechanismPlugin)
}

func (a *App) recordPostListDelivery(targetID string, list *model.PostList, targetType string, mechanism int16) {
	if !a.deliveryTrackingEnabled() || targetID == "" || list == nil || len(list.Order) == 0 {
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
	a.RecordPostDeliveryFanIn(targetID, postIDs, targetType, mechanism)
}

func (a *App) recordPostsDelivery(targetID string, posts []*model.Post, targetType string, mechanism int16) {
	if !a.deliveryTrackingEnabled() || targetID == "" || len(posts) == 0 {
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
	a.RecordPostDeliveryFanIn(targetID, postIDs, targetType, mechanism)
}

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
