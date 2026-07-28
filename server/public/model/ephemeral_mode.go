// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// CleanupReport describes the outcome of a client-side ephemeral mode cleanup run.
type CleanupReport struct {
	PostsDeleted        *int64 `json:"posts_deleted"`
	PlaybookRunsDeleted *int64 `json:"playbook_runs_deleted"`
	CleanupAt           *int64 `json:"cleanup_at"`
}

// OfflinePurgeReport describes the outcome of a client-side ephemeral mode offline purge.
type OfflinePurgeReport struct {
	OfflineTimeMinutes *int64 `json:"offline_time_minutes"`
	PurgeAt            *int64 `json:"purge_at"`
}

// SessionWipeReport confirms a client-side ephemeral mode wipe triggered by a session revocation.
// It is self-reported because the session it refers to is already revoked by the time it is sent.
type SessionWipeReport struct {
	UserId    string `json:"user_id"`
	SessionId string `json:"session_id"`
	WipeAt    *int64 `json:"wipe_at"`
}
