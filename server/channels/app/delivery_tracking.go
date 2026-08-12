// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) deliveryTrackingEnabled() bool {
	cfg := a.Config()
	return cfg.FeatureFlags != nil && cfg.FeatureFlags.PostDeliveryTracking &&
		model.SafeDereference(cfg.DeliveryTrackingSettings.Enable)
}

func shouldTrackPost(post *model.Post) bool {
	return post != nil && post.Id != "" && !post.IsSystemMessage() && post.Type != model.PostTypeBurnOnRead && post.Type != model.PostTypeEphemeral
}

func (a *App) shouldTrackChannel(rctx request.CTX, channelID string) bool {
	if channelID == "" {
		return false
	}

	deliveryTracking := a.Srv().Store().DeliveryTracking()

	// An explicit allow-list is validated DM/GM-free when it is saved, so membership alone
	// settles eligibility and no channel has to be resolved.
	if !model.SafeDereference(a.Config().DeliveryTrackingSettings.EnableForAllChannels) {
		tracked, err := deliveryTracking.IsChannelTracked(rctx, channelID)
		if err != nil {
			rctx.Logger().Warn("Failed to read tracked channel for post delivery tracking", mlog.String("channel_id", channelID), mlog.Err(err))
			return false
		}
		return tracked
	}

	trackable, err := deliveryTracking.IsChannelTrackable(rctx, channelID)
	if err != nil {
		rctx.Logger().Warn("Failed to read channel eligibility for post delivery tracking", mlog.String("channel_id", channelID), mlog.Err(err))
		return false
	}
	return trackable
}

// emitDeliveryRecord writes one postDelivered record. actorUserID is the recipient, and is empty
// for plugin and outgoing webhook deliveries, which have no human recipient.
func (a *App) emitDeliveryRecord(actorUserID string, meta map[string]any) {
	if a.Srv() == nil || a.Srv().Audit == nil {
		return
	}

	a.Srv().Audit.LogRecord(mlog.LvlAuditDelivery, model.AuditRecord{
		EventName: model.AuditEventPostDelivered,
		Status:    model.AuditStatusSuccess,
		Actor:     model.AuditEventActor{UserId: actorUserID},
		Meta:      meta,
	})
}

func deliveryMeta(post *model.Post, mechanism string) map[string]any {
	return map[string]any{
		model.PostDeliveryKeyPostID:    post.Id,
		model.PostDeliveryKeyChannelID: post.ChannelId,
		model.PostDeliveryKeyMechanism: mechanism,
	}
}

func (a *App) emitPluginDeliveryRecord(pluginID string, post *model.Post) {
	meta := deliveryMeta(post, model.DeliveryMechanismPlugin)
	meta[model.PostDeliveryKeyPluginID] = pluginID
	a.emitDeliveryRecord("", meta)
}

func (a *App) recordPostDelivery(rctx request.CTX, userID string, post *model.Post, mechanism string) {
	if userID == "" || !shouldTrackPost(post) || post.UserId == userID || !a.shouldTrackChannel(rctx, post.ChannelId) {
		return
	}

	a.emitDeliveryRecord(userID, deliveryMeta(post, mechanism))
}

func (a *App) recordPostDeliveryToPlugin(rctx request.CTX, pluginID string, post *model.Post) {
	if !shouldTrackPost(post) || !a.shouldTrackChannel(rctx, post.ChannelId) {
		return
	}

	a.emitPluginDeliveryRecord(pluginID, post)
}

func (a *App) RecordPostDelivery(rctx request.CTX, userID string, post *model.Post, mechanism string) {
	if !a.deliveryTrackingEnabled() {
		return
	}

	a.recordPostDelivery(rctx, userID, post, mechanism)
}

func (a *App) RecordPostsDelivery(rctx request.CTX, userID string, posts []*model.Post, mechanism string) {
	if !a.deliveryTrackingEnabled() || userID == "" {
		return
	}

	for _, post := range posts {
		a.recordPostDelivery(rctx, userID, post, mechanism)
	}
}

func (a *App) RecordPostListDelivery(rctx request.CTX, userID string, list *model.PostList, mechanism string) {
	if !a.deliveryTrackingEnabled() || userID == "" || list == nil {
		return
	}

	for _, post := range list.Posts {
		a.recordPostDelivery(rctx, userID, post, mechanism)
	}
}

// RecordPermalinkPreviewDelivery records that a previewed post's content reached a user inside
// containingPost. The previewed post's channel governs: the delivery is recorded even when the
// containing post lives in a channel that is not tracked, otherwise a tracked post could be read
// by permalinking it into any other channel.
func (a *App) RecordPermalinkPreviewDelivery(rctx request.CTX, userID string, previewedPost, containingPost *model.Post) {
	if !a.deliveryTrackingEnabled() || userID == "" || !shouldTrackPost(previewedPost) ||
		previewedPost.UserId == userID || !a.shouldTrackChannel(rctx, previewedPost.ChannelId) {
		return
	}

	meta := deliveryMeta(previewedPost, model.DeliveryMechanismPermalinkPreview)
	if containingPost != nil {
		meta[model.PostDeliveryKeyViaPostID] = containingPost.Id
		meta[model.PostDeliveryKeyViaChannelID] = containingPost.ChannelId
	}

	a.emitDeliveryRecord(userID, meta)
}

// RecordBroadcastDelivery records a websocket delivery of the marked post to one connection's
// user. The marker is attached only to events whose post and channel already passed the tracking
// checks, so nothing is resolved here — this runs on the hub's goroutine.
func (a *App) RecordBroadcastDelivery(marker *model.PostDeliveryMarker, userID string) {
	if marker == nil || marker.PostId == "" || userID == "" || marker.UserId == userID ||
		!a.deliveryTrackingEnabled() {
		return
	}

	a.emitDeliveryRecord(userID, map[string]any{
		model.PostDeliveryKeyPostID:    marker.PostId,
		model.PostDeliveryKeyChannelID: marker.ChannelId,
		model.PostDeliveryKeyMechanism: model.DeliveryMechanismPostBroadcast,
	})
}

func (a *App) markPostDeliveryForBroadcast(rctx request.CTX, message *model.WebSocketEvent, post *model.Post) {
	if !a.deliveryTrackingEnabled() || !shouldTrackPost(post) || !a.shouldTrackChannel(rctx, post.ChannelId) {
		return
	}

	message.GetBroadcast().RecordPostDelivery = &model.PostDeliveryMarker{
		PostId:    post.Id,
		ChannelId: post.ChannelId,
		UserId:    post.UserId,
	}
}

// RecordPushDelivery records that a post's content reached a user inside a push notification
// payload. Only full-content message pushes carry the post body: generic pushes deliver no
// content, and an id-loaded push carries only ids — that delivery is recorded by the ack handler
// the device calls to fetch the message.
func (a *App) RecordPushDelivery(rctx request.CTX, userID string, msg *model.PushNotification) {
	if !a.deliveryTrackingEnabled() || msg == nil || msg.Type != model.PushTypeMessage ||
		msg.PostId == "" || *a.Config().EmailSettings.PushNotificationContents != model.FullNotification {
		return
	}

	a.recordPostDelivery(rctx, userID, &model.Post{
		Id:        msg.PostId,
		ChannelId: msg.ChannelId,
		UserId:    msg.SenderId,
		Type:      msg.PostType,
	}, model.DeliveryMechanismPush)
}

func (a *App) RecordPostDeliveryToPlugin(rctx request.CTX, pluginID string, post *model.Post) {
	if !a.deliveryTrackingEnabled() || pluginID == "" {
		return
	}

	a.recordPostDeliveryToPlugin(rctx, pluginID, post)
}

func (a *App) RecordPostDeliveryToPlugins(rctx request.CTX, pluginIDs []string, post *model.Post) {
	if !a.deliveryTrackingEnabled() || len(pluginIDs) == 0 || !shouldTrackPost(post) ||
		!a.shouldTrackChannel(rctx, post.ChannelId) {
		return
	}

	for _, pluginID := range pluginIDs {
		if pluginID == "" {
			continue
		}
		a.emitPluginDeliveryRecord(pluginID, post)
	}
}

func (a *App) RecordPostsDeliveryToPlugin(rctx request.CTX, pluginID string, posts []*model.Post) {
	if !a.deliveryTrackingEnabled() || pluginID == "" {
		return
	}

	for _, post := range posts {
		a.recordPostDeliveryToPlugin(rctx, pluginID, post)
	}
}

func (a *App) RecordPostListDeliveryToPlugin(rctx request.CTX, pluginID string, list *model.PostList) {
	if !a.deliveryTrackingEnabled() || pluginID == "" || list == nil {
		return
	}

	for _, post := range list.Posts {
		a.recordPostDeliveryToPlugin(rctx, pluginID, post)
	}
}

func (a *App) RecordPostDeliveryToWebhook(rctx request.CTX, webhookID string, post *model.Post) {
	if !a.deliveryTrackingEnabled() || webhookID == "" || !shouldTrackPost(post) ||
		!a.shouldTrackChannel(rctx, post.ChannelId) {
		return
	}

	meta := deliveryMeta(post, model.DeliveryMechanismOutgoingWebhook)
	meta[model.PostDeliveryKeyWebhookID] = webhookID
	a.emitDeliveryRecord("", meta)
}
