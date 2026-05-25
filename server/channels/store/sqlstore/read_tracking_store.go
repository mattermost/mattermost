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

const readTrackingTableName = "user_post_reads"

// SqlReadTrackingStore writes user-post read events to an independent
// Postgres pool. The backing table is UNLOGGED — no WAL, no replication,
// truncated on crash — and has no unique index, so duplicates are allowed.
// Callers dedupe on read.
type SqlReadTrackingStore struct {
	*SqlStore
}

// noopReadTrackingStore is returned when ReadTrackingSettings.Enable=false,
// so callers don't have to nil-check the store before calling Mark/MarkBulk.
type noopReadTrackingStore struct{}

func (noopReadTrackingStore) Mark(context.Context, string, string) error {
	return nil
}
func (noopReadTrackingStore) MarkBulk(context.Context, []model.UserPostRead) error {
	return nil
}
func (noopReadTrackingStore) HasRead(context.Context, string, string) (bool, error) {
	return false, nil
}

func newSqlReadTrackingStore(s *SqlStore) store.ReadTrackingStore {
	if s.readTrackingX == nil {
		return noopReadTrackingStore{}
	}
	return &SqlReadTrackingStore{SqlStore: s}
}

// Mark appends a single user-post read event.
func (s *SqlReadTrackingStore) Mark(ctx context.Context, userID, postID string) error {
	_, err := s.readTrackingX.ExecContext(ctx,
		`INSERT INTO `+readTrackingTableName+` (user_id, post_id, created_at) VALUES ($1, $2, $3)`,
		userID, postID, model.GetMillis())
	if err != nil {
		return errors.Wrap(err, "failed to mark user-post read")
	}
	return nil
}

// MarkBulk appends a batch of read events using Postgres' binary COPY
// protocol (lib/pq's pq.CopyIn). Orders of magnitude faster than batched
// multi-VALUES INSERT for large batches.
func (s *SqlReadTrackingStore) MarkBulk(ctx context.Context, pairs []model.UserPostRead) error {
	if len(pairs) == 0 {
		return nil
	}

	tx, err := s.readTrackingX.DB().BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, "failed to begin tx for bulk mark")
	}

	stmt, err := tx.PrepareContext(ctx, pq.CopyIn(readTrackingTableName, "user_id", "post_id", "created_at"))
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
		if _, err = stmt.ExecContext(ctx, p.UserID, p.PostID, ts); err != nil {
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
func (s *SqlReadTrackingStore) HasRead(ctx context.Context, userID, postID string) (bool, error) {
	var exists bool
	err := s.readTrackingX.DB().GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM `+readTrackingTableName+` WHERE user_id=$1 AND post_id=$2 LIMIT 1)`,
		userID, postID)
	if err != nil {
		return false, errors.Wrap(err, "failed to query read state")
	}
	return exists, nil
}
