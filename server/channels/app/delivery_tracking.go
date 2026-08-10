// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) deliveryTrackingEnabled() bool {
	cfg := a.Config()
	return cfg.FeatureFlags != nil && cfg.FeatureFlags.PostDeliveryTracking &&
		model.SafeDereference(cfg.DeliveryTrackingSettings.Enable)
}

// trackedPost reports whether a post carries content whose delivery is worth recording.
// Ephemeral posts are excluded by not instrumenting the paths that carry them.
func trackedPost(post *model.Post) bool {
	return post != nil && post.Id != "" && !post.IsSystemMessage() && post.Type != model.PostTypeBurnOnRead
}

// trackedChannel reports whether deliveries of posts belonging to channelID are recorded.
// DMs and GMs are never tracked, matching the content flagging feature.
func (a *App) trackedChannel(rctx request.CTX, channelID string) bool {
	if channelID == "" {
		return false
	}

	channel, appErr := a.Srv().getChannel(rctx, channelID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to resolve channel for post delivery tracking",
			mlog.String("channel_id", channelID), mlog.Err(appErr))
		return false
	}

	if channel.IsGroupOrDirect() {
		return false
	}

	if model.SafeDereference(a.Config().DeliveryTrackingSettings.EnableForAllChannels) {
		return true
	}

	channelIDs, err := a.Srv().Store().DeliveryTracking().GetTrackedChannelIDs(rctx)
	if err != nil {
		rctx.Logger().Warn("Failed to read tracked channels for post delivery tracking", mlog.Err(err))
		return false
	}

	return slices.Contains(channelIDs, channelID)
}

// deliveryChannelFilter memoizes trackedChannel for the duration of one delivery, so a page
// of posts from a single channel costs one channel resolution rather than one per post.
type deliveryChannelFilter struct {
	app     *App
	rctx    request.CTX
	results map[string]bool
}

func (a *App) newDeliveryChannelFilter(rctx request.CTX) *deliveryChannelFilter {
	return &deliveryChannelFilter{app: a, rctx: rctx, results: make(map[string]bool)}
}

func (f *deliveryChannelFilter) tracked(channelID string) bool {
	if tracked, ok := f.results[channelID]; ok {
		return tracked
	}

	tracked := f.app.trackedChannel(f.rctx, channelID)
	f.results[channelID] = tracked
	return tracked
}

// emitDeliveryRecord writes one postDelivered record. actorUserID is the recipient, and is
// empty for plugin and outgoing webhook deliveries, which have no human recipient.
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

// deliverableToUser reports whether post's content reaching userID is a recordable delivery.
// A user receiving their own post is not.
func deliverableToUser(userID string, post *model.Post) bool {
	return userID != "" && trackedPost(post) && post.UserId != userID
}

// RecordPostDelivery records that a post's content was delivered to a user.
func (a *App) RecordPostDelivery(rctx request.CTX, userID string, post *model.Post, mechanism string) {
	if !a.deliveryTrackingEnabled() || !deliverableToUser(userID, post) || !a.trackedChannel(rctx, post.ChannelId) {
		return
	}

	a.emitDeliveryRecord(userID, deliveryMeta(post, mechanism))
}

// RecordPostsDelivery records one delivery per post. Posts may span channels, so each
// distinct channel is resolved once.
func (a *App) RecordPostsDelivery(rctx request.CTX, userID string, posts []*model.Post, mechanism string) {
	if !a.deliveryTrackingEnabled() || userID == "" || len(posts) == 0 {
		return
	}

	filter := a.newDeliveryChannelFilter(rctx)
	for _, post := range posts {
		if !deliverableToUser(userID, post) || !filter.tracked(post.ChannelId) {
			continue
		}
		a.emitDeliveryRecord(userID, deliveryMeta(post, mechanism))
	}
}

// RecordPostListDelivery records one delivery per post in a post list.
func (a *App) RecordPostListDelivery(rctx request.CTX, userID string, list *model.PostList, mechanism string) {
	if !a.deliveryTrackingEnabled() || userID == "" || list == nil || len(list.Order) == 0 {
		return
	}

	a.RecordPostsDelivery(rctx, userID, list.ToSlice(), mechanism)
}

// RecordPermalinkPreviewDelivery records that a previewed post's content reached a user
// inside containingPost. The previewed post's channel governs: the delivery is recorded even
// when the containing post lives in a channel that is not tracked, otherwise a tracked post
// could be read by permalinking it into any other channel.
func (a *App) RecordPermalinkPreviewDelivery(rctx request.CTX, userID string, previewedPost, containingPost *model.Post) {
	if !a.deliveryTrackingEnabled() || !deliverableToUser(userID, previewedPost) ||
		!a.trackedChannel(rctx, previewedPost.ChannelId) {
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
// user. The marker is attached only to events whose post and channel already passed the
// tracking checks, so nothing is resolved here — this runs on the hub's goroutine.
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

// markPostDeliveryForBroadcast attaches a delivery marker to a websocket event so that every
// cluster node records the post's delivery to its own connections.
func (a *App) markPostDeliveryForBroadcast(rctx request.CTX, message *model.WebSocketEvent, post *model.Post) {
	if !a.deliveryTrackingEnabled() || !trackedPost(post) || !a.trackedChannel(rctx, post.ChannelId) {
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
// content, and the fetch an id-loaded push triggers is recorded by the REST path instead.
func (a *App) RecordPushDelivery(rctx request.CTX, userID string, msg *model.PushNotification) {
	if !a.deliveryTrackingEnabled() || msg == nil || msg.Type != model.PushTypeMessage ||
		msg.PostId == "" || *a.Config().EmailSettings.PushNotificationContents != model.FullNotification {
		return
	}

	a.RecordPostDelivery(rctx, userID, &model.Post{
		Id:        msg.PostId,
		ChannelId: msg.ChannelId,
		UserId:    msg.SenderId,
		Type:      msg.PostType,
	}, model.DeliveryMechanismPush)
}

// RecordPostDeliveryToPlugin records that a post's content was handed to a plugin.
func (a *App) RecordPostDeliveryToPlugin(rctx request.CTX, pluginID string, post *model.Post) {
	if !a.deliveryTrackingEnabled() || pluginID == "" || !trackedPost(post) ||
		!a.trackedChannel(rctx, post.ChannelId) {
		return
	}

	meta := deliveryMeta(post, model.DeliveryMechanismPlugin)
	meta[model.PostDeliveryKeyPluginID] = pluginID
	a.emitDeliveryRecord("", meta)
}

// RecordPostDeliveryToPlugins records one delivery per plugin that received a post, used by
// the post hook fan-outs.
func (a *App) RecordPostDeliveryToPlugins(rctx request.CTX, pluginIDs []string, post *model.Post) {
	if !a.deliveryTrackingEnabled() || len(pluginIDs) == 0 || !trackedPost(post) ||
		!a.trackedChannel(rctx, post.ChannelId) {
		return
	}

	for _, pluginID := range pluginIDs {
		if pluginID == "" {
			continue
		}
		meta := deliveryMeta(post, model.DeliveryMechanismPlugin)
		meta[model.PostDeliveryKeyPluginID] = pluginID
		a.emitDeliveryRecord("", meta)
	}
}

// RecordPostsDeliveryToPlugin records one delivery per post handed to a plugin.
func (a *App) RecordPostsDeliveryToPlugin(rctx request.CTX, pluginID string, posts []*model.Post) {
	if !a.deliveryTrackingEnabled() || pluginID == "" || len(posts) == 0 {
		return
	}

	filter := a.newDeliveryChannelFilter(rctx)
	for _, post := range posts {
		if !trackedPost(post) || !filter.tracked(post.ChannelId) {
			continue
		}
		meta := deliveryMeta(post, model.DeliveryMechanismPlugin)
		meta[model.PostDeliveryKeyPluginID] = pluginID
		a.emitDeliveryRecord("", meta)
	}
}

// RecordPostListDeliveryToPlugin records one delivery per post in a list handed to a plugin.
func (a *App) RecordPostListDeliveryToPlugin(rctx request.CTX, pluginID string, list *model.PostList) {
	if !a.deliveryTrackingEnabled() || pluginID == "" || list == nil || len(list.Order) == 0 {
		return
	}

	a.RecordPostsDeliveryToPlugin(rctx, pluginID, list.ToSlice())
}

// RecordPostDeliveryToWebhook records that a post's content was sent to an outgoing webhook.
func (a *App) RecordPostDeliveryToWebhook(rctx request.CTX, webhookID string, post *model.Post) {
	if !a.deliveryTrackingEnabled() || webhookID == "" || !trackedPost(post) ||
		!a.trackedChannel(rctx, post.ChannelId) {
		return
	}

	meta := deliveryMeta(post, model.DeliveryMechanismOutgoingWebhook)
	meta[model.PostDeliveryKeyWebhookID] = webhookID
	a.emitDeliveryRecord("", meta)
}
