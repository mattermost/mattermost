// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Delivery mechanisms recorded in the mechanism field of a postDelivered audit record.
const (
	// DeliveryMechanismProduct covers every read of post content through the REST API:
	// channel loads, thread views, search results and direct post fetches alike.
	DeliveryMechanismProduct = "product"

	// DeliveryMechanismPostBroadcast is the websocket push of a new or edited post to
	// connected channel members.
	DeliveryMechanismPostBroadcast = "post_broadcast"

	// DeliveryMechanismPermalinkPreview is a post rendered as a permalink preview inside
	// another post.
	DeliveryMechanismPermalinkPreview = "permalink_preview"

	DeliveryMechanismEmail           = "email"
	DeliveryMechanismPush            = "push"
	DeliveryMechanismOutgoingWebhook = "outgoing_webhook"
	DeliveryMechanismPlugin          = "plugin"
)

// Keys used in the meta payload of a postDelivered audit record.
const (
	PostDeliveryKeyPostID       = "post_id"
	PostDeliveryKeyChannelID    = "channel_id"
	PostDeliveryKeyMechanism    = "mechanism"
	PostDeliveryKeyPluginID     = "plugin_id"
	PostDeliveryKeyWebhookID    = "webhook_id"
	PostDeliveryKeyViaPostID    = "via_post_id"
	PostDeliveryKeyViaChannelID = "via_channel_id"
)

// PostDeliveryMarker identifies a post whose websocket delivery should be recorded. It
// travels on WebsocketBroadcast so that each cluster node records the deliveries to its
// own connections, and is stripped before the event is serialized for clients.
//
// UserId is the post's author, carried so the hub can skip recording a delivery back to
// whoever wrote the post.
type PostDeliveryMarker struct {
	PostId    string `json:"post_id"`
	ChannelId string `json:"channel_id"`
	UserId    string `json:"user_id"`
}
