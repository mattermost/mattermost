// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import "time"

// SupportPacketDatabaseDiagnostics contains database-specific diagnostics that
// are collected by the store layer and merged into
// model.SupportPacketDiagnostics.Database by the platform layer. It is an
// internal store→platform transport type and is intentionally not part of the
// public model API.
type SupportPacketDatabaseDiagnostics struct {
	MasterConnectionsInUse              int
	MasterConnectionsIdle               int
	MasterPoolWaitCount                 int64
	MasterPoolWaitDurationMs            int64
	MasterConnectionsClosedMaxIdle      int64
	MasterConnectionsClosedMaxLifetime  int64
	ReplicaConnectionsInUse             int
	ReplicaConnectionsIdle              int
	ReplicaPoolWaitCount                int64
	ReplicaPoolWaitDurationMs           int64
	ReplicaConnectionsClosedMaxIdle     int64
	ReplicaConnectionsClosedMaxLifetime int64
	CacheHitRatio                       *float64
	Deadlocks                           *int64
	TempFiles                           *int64
	TempBytesMB                         *float64
	Rollbacks                           *int64
	IdleInTransactionCount              *int64
	LongestQueryDurationSeconds         *float64
	WaitingForLockCount                 *int64
	PostsDeadTuples                     *int64
	PostsLastAutovacuum                 *time.Time
}
