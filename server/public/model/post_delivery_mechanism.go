// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Post delivery mechanisms — values for the "mechanism" parameter on the
// AuditEventPostDelivered audit record. Numbering matches the Confluence
// doc "Mechanisms of Viewing Post Contents". Gaps (3, 4, 10, 13, 14)
// intentionally match the doc's numbering so cross-referencing is direct.
const (
	AuditMechChannelView        = "channel_view"        // mech 1
	AuditMechThreadView         = "thread_view"         // mech 2
	AuditMechEmailNotif         = "email_notif"         // mech 5
	AuditMechPushFull           = "push_full"           // mech 6
	AuditMechPushIDOnly         = "push_id_only"        // mech 7
	AuditMechPermalinkPreview   = "permalink_preview"   // mech 8
	AuditMechAPIDirect          = "api_direct"          // mech 9
	AuditMechOutgoingWebhook    = "outgoing_webhook"    // mech 11
	AuditMechPluginHook         = "plugin_hook"         // mech 12
	AuditMechSearchResult       = "search_result"       // mech 15
	AuditMechWebsocketBroadcast = "websocket_broadcast" // mech 16
)
