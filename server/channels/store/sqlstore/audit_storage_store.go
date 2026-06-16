// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"

	"github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const auditStorageTableName = "audit_storage"

// SqlAuditStorage writes user-post delivery events to the audit_storage table
// on the primary Mattermost database. The table carries a UNIQUE composite
// index on (entity_id, user_id, mechanism); every write uses
// ON CONFLICT DO NOTHING so duplicate deliveries are absorbed silently.
//
// Bulk paths use Postgres' unnest() with array parameters: a single
// INSERT … SELECT statement expands an array of N values into N rows
// server-side. The client makes one ExecContext call with no per-row loop;
// the per-row work happens inside Postgres. This is faster than pq.CopyIn
// for small-to-medium batches (≲10k rows) because COPY's per-row protocol
// overhead dominates at those sizes, and it also sidesteps the pq.CopyIn
// deprecation.
type SqlAuditStorage struct {
	*SqlStore
}

func newSqlAuditStorage(s *SqlStore) store.AuditStorageStore {
	return &SqlAuditStorage{SqlStore: s}
}

// Mark appends a single user-post delivery event tagged with the mechanism.
func (s *SqlAuditStorage) Mark(ctx context.Context, userID, postID string, mechanism int16) error {
	_, err := s.GetMaster().ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at) VALUES ($1, $2, $3, $4)
				ON CONFLICT (entity_id, user_id, mechanism) DO NOTHING`,
		userID, postID, mechanism, model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to mark user-post delivery")
	}
	return nil
}

// MarkBulkSameUser records that the same user received every post in
// postIDs. One Postgres round-trip, no client-side loop.
func (s *SqlAuditStorage) MarkBulkSameUser(ctx context.Context, userID string, postIDs []string, mechanism int16) error {
	if userID == "" || len(postIDs) == 0 {
		return nil
	}
	_, err := s.GetMaster().ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at)
		 SELECT $1, entity_id, $3, $4
		 FROM unnest($2::text[]) AS entity_id
		 ON CONFLICT (entity_id, user_id, mechanism) DO NOTHING`,
		userID, pq.Array(postIDs), mechanism, model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to bulk-mark same-user")
	}
	return nil
}

// MarkBulkSamePost records that the same post fanned out to every user in
// userIDs (e.g. websocket broadcast to channel members). One round-trip.
func (s *SqlAuditStorage) MarkBulkSamePost(ctx context.Context, userIDs []string, postID string, mechanism int16) error {
	if postID == "" || len(userIDs) == 0 {
		return nil
	}
	_, err := s.GetMaster().ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at)
		 SELECT user_id, $2, $3, $4
		 FROM unnest($1::text[]) AS user_id
		 ON CONFLICT (entity_id, user_id, mechanism) DO NOTHING`,
		pq.Array(userIDs), postID, mechanism, model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to bulk-mark same-post")
	}
	return nil
}

// HasRead returns true if at least one delivery event exists for the pair.
func (s *SqlAuditStorage) HasRead(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	err := s.GetReplica().DB().GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM `+auditStorageTableName+` WHERE user_id=$1 AND entity_id=$2 LIMIT 1)`,
		userID, postID)
	if err != nil {
		return false, errors.Wrap(err, "failed to query delivery state")
	}
	return exists, nil
}
