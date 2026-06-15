// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Audit-storage mechanism identifiers map to entries in the Confluence doc
// "Mechanisms of Viewing Post Contents". Stored in the audit_storage
// table's mechanism column (SMALLINT). Gaps (3, 4, 10, 13, 14) intentionally
// match the doc's numbering so cross-referencing is direct.
const (
	AuditMechUnknown            int16 = 0
	AuditMechChannelView        int16 = 1
	AuditMechThreadView         int16 = 2
	AuditMechEmailNotif         int16 = 5
	AuditMechPushFull           int16 = 6
	AuditMechPushIDOnly         int16 = 7
	AuditMechPermalinkPreview   int16 = 8
	AuditMechAPIDirect          int16 = 9
	AuditMechOutgoingWebhook    int16 = 11
	AuditMechPluginHook         int16 = 12
	AuditMechSearchResult       int16 = 15
	AuditMechWebsocketBroadcast int16 = 16
)
