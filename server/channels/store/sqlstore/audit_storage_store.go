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
// so callers don't have to nil-check the store before calling MarkBulk.
type noopAuditStorage struct{}

func (noopAuditStorage) MarkBulk(context.Context, []model.AuditDeliveryRecord) error { return nil }

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

// MarkBulk records arbitrary mixed (user, entity, mechanism) triples in a
// single round-trip. Three parallel arrays are zipped server-side via
// unnest — one row per index. Used by the audit delivery target's batching
// worker pool to flush an accumulated batch.
func (s *SqlAuditStorage) MarkBulk(ctx context.Context, records []model.AuditDeliveryRecord) error {
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
	res, err := s.auditStorageX.ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, entity_id, mechanism, created_at)
		 SELECT u, e, m, $4
		 FROM unnest($1::text[], $2::text[], $3::smallint[]) AS t(u, e, m)
		 ON CONFLICT (user_id, entity_id, mechanism) DO NOTHING`,
		pq.Array(userIDs), pq.Array(entityIDs), pq.Array(mechanisms), model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to bulk-mark delivery records")
	}
	if s.metrics != nil {
		if n, raErr := res.RowsAffected(); raErr == nil && n > 0 {
			s.metrics.IncrementAuditStorageRecordsPersisted(int(n))
		}
	}
	return nil
}
