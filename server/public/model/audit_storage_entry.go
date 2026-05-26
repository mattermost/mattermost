// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type AuditStorageEntry struct {
	UserID    string `json:"user_id"`
	PostID    string `json:"post_id"`
	Mechanism int16  `json:"mechanism"`
	CreatedAt int64  `json:"created_at"`
}

// Mechanism identifiers map to entries in the Confluence doc
// "Mechanisms of Viewing Post Contents". Stored as SMALLINT for compactness.
// Gaps in the numbering (3, 4, 10, 13, 14) intentionally match the doc's
// numbering so cross-referencing is direct.
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
