// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// Event ordering and the settle window both use the database clock so that node
// clock skew cannot reorder events in HA. Reads must use statement_timestamp(), which
// is fixed for the statement: clock_timestamp() is volatile and re-evaluated per row,
// so two rows sharing a CreateAt could straddle the cutoff and the later one be skipped.
const (
	dbWriteMillis = "(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint"
	dbReadMillis  = "(EXTRACT(EPOCH FROM statement_timestamp()) * 1000)::bigint"
)

type SqlBotEventStore struct {
	*SqlStore
}

func newSqlBotEventStore(sqlStore *SqlStore) store.BotEventStore {
	return &SqlBotEventStore{SqlStore: sqlStore}
}

func (s *SqlBotEventStore) Save(rctx request.CTX, events []*model.BotEvent) error {
	if len(events) == 0 {
		return nil
	}

	query := s.getQueryBuilder().
		Insert("BotEvents").
		Columns("Id", "BotUserId", "Type", "CreateAt", "Payload")

	for _, e := range events {
		if !model.IsValidId(e.Id) {
			return store.NewErrInvalidInput("BotEvent", "Id", e.Id)
		}

		payload := []byte(e.Payload)
		if s.IsBinaryParamEnabled() {
			payload = AppendBinaryFlag(payload)
		}

		var createAt any = e.CreateAt
		if e.CreateAt == 0 {
			createAt = sq.Expr(dbWriteMillis)
		}

		query = query.Values(e.Id, e.BotUserId, string(e.Type), createAt, payload)
	}

	if _, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query); err != nil {
		return errors.Wrap(err, "failed to save BotEvents")
	}
	return nil
}

// GetAfterCursor always reads the master: a lagging replica could show a
// later-committed event and hide an earlier one, which the settle window cannot fix.
func (s *SqlBotEventStore) GetAfterCursor(rctx request.CTX, botUserID string, after model.BotEventCursor, settleWindowMillis int64, limit int) ([]*model.BotEvent, error) {
	query := s.getQueryBuilder().
		Select("Id", "BotUserId", "Type", "CreateAt", "Payload").
		From("BotEvents").
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(CreateAt, Id) > (?, ?)", after.CreateAt, after.Id)).
		Where(sq.Expr("CreateAt <= "+dbReadMillis+" - ?", settleWindowMillis)).
		OrderBy("CreateAt", "Id").
		Limit(uint64(limit))

	var events []*model.BotEvent
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &events, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get BotEvents for bot_user_id=%s", botUserID)
	}
	return events, nil
}

func (s *SqlBotEventStore) CountAfterCursor(rctx request.CTX, botUserID string, after model.BotEventCursor) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("BotEvents").
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(CreateAt, Id) > (?, ?)", after.CreateAt, after.Id))

	var count int64
	if err := s.GetReplica().GetBuilder(&count, query); err != nil {
		return 0, errors.Wrapf(err, "failed to count BotEvents for bot_user_id=%s", botUserID)
	}
	return count, nil
}

// DeleteAcked and DeleteOlderThan select by the full primary key tuple so the primary
// key index is used; matching on Id alone would scan the table. DeleteAcked only
// considers subscriptions that acknowledged something, which keeps the planner on a
// nested loop over those few subscriptions instead of a scan of the whole table.
func (s *SqlBotEventStore) DeleteAcked(rctx request.CTX, limit int) (int64, error) {
	return s.deleteBatch(rctx, `(BotUserId, CreateAt, Id) IN (
		SELECT e.BotUserId, e.CreateAt, e.Id FROM BotEvents e
		JOIN BotEventSubscriptions s ON s.BotUserId = e.BotUserId
		WHERE s.AckCursorCreateAt > 0 AND (e.CreateAt, e.Id) <= (s.AckCursorCreateAt, s.AckCursorId)
		LIMIT ?)`, limit)
}

func (s *SqlBotEventStore) DeleteOlderThan(rctx request.CTX, createAtBefore int64, limit int) (int64, error) {
	return s.deleteBatch(rctx, "(BotUserId, CreateAt, Id) IN (SELECT BotUserId, CreateAt, Id FROM BotEvents WHERE CreateAt < ? LIMIT ?)", createAtBefore, limit)
}

func (s *SqlBotEventStore) deleteBatch(rctx request.CTX, where string, args ...any) (int64, error) {
	result, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), s.getQueryBuilder().Delete("BotEvents").Where(sq.Expr(where, args...)))
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete BotEvents")
	}
	return result.RowsAffected()
}
