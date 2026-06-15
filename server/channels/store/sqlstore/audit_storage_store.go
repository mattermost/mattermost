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

// SqlAuditStorage writes user-post delivery events to an independent
// Postgres pool. The backing table is a regular LOGGED table (WAL-backed,
// crash-durable, replication-friendly) with a UNIQUE(user_id, entity_id,
// mechanism) index, so duplicate writes are silently dropped via
// ON CONFLICT DO NOTHING — only the first event for a given triple is kept.
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

// noopAuditStorage is returned when AuditStorageSettings.Enable=false,
// so callers don't have to nil-check the store before calling Mark/etc.
type noopAuditStorage struct{}

func (noopAuditStorage) Mark(context.Context, string, string, int16) error { return nil }
func (noopAuditStorage) MarkBulkSameUser(context.Context, string, []string, int16) error {
	return nil
}
func (noopAuditStorage) MarkBulkSamePost(context.Context, []string, string, int16) error {
	return nil
}
func (noopAuditStorage) MarkBulk(context.Context, []store.AuditDeliveryRecord) error { return nil }
func (noopAuditStorage) HasRead(context.Context, string, string) (bool, error)       { return false, nil }

func newSqlAuditStorage(s *SqlStore) store.AuditStorageStore {
	// Pool may be open (migrations always run) while writes are gated off.
	// Treat both "no pool" and "Enable=false" as no-op so callers don't have
	// to nil-check or know about config state.
	if s.auditStorageX == nil ||
		s.asSettings == nil ||
		s.asSettings.Enable == nil ||
		!*s.asSettings.Enable {
		return noopAuditStorage{}
	}
	return &SqlAuditStorage{SqlStore: s}
}

// Mark appends a single user-post delivery event tagged with the mechanism.
func (s *SqlAuditStorage) Mark(ctx context.Context, userID, postID string, mechanism int16) error {
	_, err := s.auditStorageX.ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, entity_id, mechanism) DO NOTHING`,
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
	_, err := s.auditStorageX.ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at)
		 SELECT $1, entity_id, $3, $4
		 FROM unnest($2::text[]) AS entity_id
		 ON CONFLICT (user_id, entity_id, mechanism) DO NOTHING`,
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
	_, err := s.auditStorageX.ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at)
		 SELECT user_id, $2, $3, $4
		 FROM unnest($1::text[]) AS user_id
		 ON CONFLICT (user_id, entity_id, mechanism) DO NOTHING`,
		pq.Array(userIDs), postID, mechanism, model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to bulk-mark same-post")
	}
	return nil
}

// MarkBulk records arbitrary mixed (user, entity, mechanism) triples in a
// single round-trip. Three parallel arrays are zipped server-side via
// unnest — one row per index. Used by the audit delivery target's batching
// worker pool to flush an accumulated batch.
func (s *SqlAuditStorage) MarkBulk(ctx context.Context, records []store.AuditDeliveryRecord) error {
	if len(records) == 0 {
		return nil
	}
	userIDs := make([]string, len(records))
	entityIDs := make([]string, len(records))
	// pq.Array supports []int64; SQL casts to smallint[] for storage.
	mechanisms := make([]int64, len(records))
	for i, r := range records {
		userIDs[i] = r.UserID
		entityIDs[i] = r.EntityID
		mechanisms[i] = int64(r.Mechanism)
	}
	_, err := s.auditStorageX.ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at)
		 SELECT u, e, m, $4
		 FROM unnest($1::text[], $2::text[], $3::smallint[]) AS t(u, e, m)
		 ON CONFLICT (user_id, entity_id, mechanism) DO NOTHING`,
		pq.Array(userIDs), pq.Array(entityIDs), pq.Array(mechanisms), model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to bulk-mark delivery records")
	}
	return nil
}

// HasRead returns true if at least one delivery event exists for the pair.
// Duplicates are ignored — EXISTS short-circuits on the first match.
func (s *SqlAuditStorage) HasRead(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	err := s.auditStorageX.DB().GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM `+auditStorageTableName+` WHERE user_id=$1 AND entity_id=$2 LIMIT 1)`,
		userID, postID)
	if err != nil {
		return false, errors.Wrap(err, "failed to query delivery state")
	}
	return exists, nil
}
