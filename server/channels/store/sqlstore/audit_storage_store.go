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

// SqlAuditStorage writes user-post read events to an independent
// Postgres pool. The backing table is UNLOGGED — no WAL, no replication,
// truncated on crash — and has no unique index, so duplicates are allowed.
// Callers dedupe on read.
type SqlAuditStorage struct {
	*SqlStore
}

// noopAuditStorage is returned when AuditStorageSettings.Enable=false,
// so callers don't have to nil-check the store before calling Mark/MarkBulk.
type noopAuditStorage struct{}

func (noopAuditStorage) Mark(context.Context, string, string, int16) error {
	return nil
}
func (noopAuditStorage) MarkBulk(context.Context, []model.AuditStorageEntry) error {
	return nil
}
func (noopAuditStorage) HasRead(context.Context, string, string) (bool, error) {
	return false, nil
}

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

// Mark appends a single user-post read event tagged with the delivery
// mechanism (see model.AuditMech* constants).
func (s *SqlAuditStorage) Mark(ctx context.Context, userID, postID string, mechanism int16) error {
	_, err := s.auditStorageX.ExecContext(ctx,
		`INSERT INTO `+auditStorageTableName+` (user_id, post_id, mechanism, created_at) VALUES ($1, $2, $3, $4)`,
		userID, postID, mechanism, model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to mark user-post read")
	}
	return nil
}

// MarkBulk appends a batch of read events using Postgres' binary COPY
// protocol (lib/pq's pq.CopyIn). Orders of magnitude faster than batched
// multi-VALUES INSERT for large batches.
func (s *SqlAuditStorage) MarkBulk(ctx context.Context, pairs []model.AuditStorageEntry) error {
	if len(pairs) == 0 {
		return nil
	}

	tx, err := s.auditStorageX.DB().BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to begin tx for bulk mark")
	}

	stmt, err := tx.PrepareContext(ctx, pq.CopyIn(auditStorageTableName, "user_id", "post_id", "mechanism", "created_at"))
	if err != nil {
		_ = tx.Rollback()
		return errors.Wrap(err, "failed to prepare COPY")
	}

	now := model.GetMillis()
	for _, p := range pairs {
		ts := p.CreatedAt
		if ts == 0 {
			ts = now
		}
		if _, err = stmt.ExecContext(ctx, p.UserID, p.PostID, p.Mechanism, ts); err != nil {
			_ = stmt.Close()
			_ = tx.Rollback()
			return errors.Wrap(err, "failed to append row to COPY")
		}
	}

	// Flush — required by pq.CopyIn semantics before Close.
	if _, err = stmt.ExecContext(ctx); err != nil {
		_ = stmt.Close()
		_ = tx.Rollback()
		return errors.Wrap(err, "failed to flush COPY")
	}
	if err = stmt.Close(); err != nil {
		_ = tx.Rollback()
		return errors.Wrap(err, "failed to close COPY statement")
	}
	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit bulk mark")
	}
	return nil
}

// HasRead returns true if at least one read event exists for the pair.
// Duplicates are ignored — EXISTS short-circuits on the first match.
func (s *SqlAuditStorage) HasRead(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	err := s.auditStorageX.DB().GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM `+auditStorageTableName+` WHERE user_id=$1 AND post_id=$2 LIMIT 1)`,
		userID, postID)
	if err != nil {
		return false, errors.Wrap(err, "failed to query read state")
	}
	return exists, nil
}
