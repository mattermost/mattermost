// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2 = "migration_advanced_permissions_phase_2"
)

type AsyncMigrationStatus string

const (
	MigrationStatusUnknown  AsyncMigrationStatus = ""
	MigrationStatusRun      AsyncMigrationStatus = "run"      // migration should be run
	MigrationStatusSkip     AsyncMigrationStatus = "skip"     // migration should be skipped (not sure if needed?)
	MigrationStatusComplete AsyncMigrationStatus = "complete" // migration was already executed
	MigrationStatusFailed   AsyncMigrationStatus = "failed"   // migration has failed
)
