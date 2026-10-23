// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

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

type botEventRow struct {
	Id        string
	BotUserId string
	Type      string
	CreateAt  int64
	Payload   []byte
}

type botEventCursorRow struct {
	CreateAt int64
	Id       string
}

type botEventDeletedRow struct {
	BotUserId string
	CreateAt  int64
	Id        string
}

func newSqlBotEventStore(sqlStore *SqlStore) store.BotEventStore {
	return &SqlBotEventStore{SqlStore: sqlStore}
}

func (s *SqlBotEventStore) Save(rctx request.CTX, events []*model.BotEvent) ([]*model.BotEvent, error) {
	if len(events) == 0 {
		return events, nil
	}

	query := s.getQueryBuilder().
		Insert("BotEvents").
		Columns("Id", "BotUserId", "Type", "CreateAt", "Payload")

	byId := make(map[string]*model.BotEvent, len(events))
	for _, e := range events {
		if !model.IsValidId(e.Id) {
			return nil, store.NewErrInvalidInput("BotEvent", "Id", e.Id)
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
		byId[e.Id] = e
	}
	query = query.Suffix("RETURNING Id, CreateAt")

	var rows []botEventCursorRow
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &rows, query); err != nil {
		return nil, errors.Wrap(err, "failed to save BotEvents")
	}

	for _, r := range rows {
		if e, ok := byId[r.Id]; ok {
			e.CreateAt = r.CreateAt
		}
	}
	return events, nil
}

// GetAfterCursor always reads the master: a lagging replica could show a
// later-committed event and hide an earlier one, which the settle window cannot fix.
func (s *SqlBotEventStore) GetAfterCursor(rctx request.CTX, botUserID string, after model.BotEventCursor, settleWindowMillis int64, limit int) ([]*model.BotEvent, error) {
	limit = min(max(limit, 1), model.BotEventsMaxLimit)

	query := s.getQueryBuilder().
		Select("Id", "BotUserId", "Type", "CreateAt", "Payload").
		From("BotEvents").
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(CreateAt, Id) > (?, ?)", after.CreateAt, after.Id)).
		Where(sq.Expr("CreateAt <= "+dbReadMillis+" - ?", settleWindowMillis)).
		OrderBy("CreateAt", "Id").
		Limit(uint64(limit))

	var rows []botEventRow
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &rows, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get BotEvents for bot_user_id=%s", botUserID)
	}

	events := make([]*model.BotEvent, len(rows))
	for i, r := range rows {
		events[i] = &model.BotEvent{
			Id:        r.Id,
			BotUserId: r.BotUserId,
			Type:      model.BotEventType(r.Type),
			CreateAt:  r.CreateAt,
			Payload:   r.Payload,
		}
	}
	return events, nil
}

func (s *SqlBotEventStore) CountAfterCursor(rctx request.CTX, botUserID string, after model.BotEventCursor) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("BotEvents").
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(CreateAt, Id) > (?, ?)", after.CreateAt, after.Id))

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "failed to build BotEvents count query")
	}

	var count int64
	if err := s.GetReplica().QueryRowContext(rctx.Context(), sqlStr, args...).Scan(&count); err != nil {
		return 0, errors.Wrapf(err, "failed to count BotEvents for bot_user_id=%s", botUserID)
	}
	return count, nil
}

// DeleteUpToCursor and DeleteOlderThan select by the full primary key tuple so the
// primary key index is used; matching on Id alone would scan the table.
func (s *SqlBotEventStore) DeleteUpToCursor(rctx request.CTX, botUserID string, upTo model.BotEventCursor, limit int) (int64, error) {
	query := s.getQueryBuilder().
		Delete("BotEvents").
		Where(sq.Expr(
			"(BotUserId, CreateAt, Id) IN (SELECT BotUserId, CreateAt, Id FROM BotEvents WHERE BotUserId = ? AND (CreateAt, Id) <= (?, ?) ORDER BY CreateAt, Id LIMIT ?)",
			botUserID, upTo.CreateAt, upTo.Id, limit,
		))

	result, err := s.execBuilder(rctx, s.GetMaster(), query)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to delete BotEvents up to cursor for bot_user_id=%s", botUserID)
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to count deleted BotEvents")
	}
	return deleted, nil
}

func (s *SqlBotEventStore) GetBacklogCutoff(rctx request.CTX, botUserID string, keep int) (*model.BotEventCursor, error) {
	query := s.getQueryBuilder().
		Select("CreateAt", "Id").
		From("BotEvents").
		Where(sq.Eq{"BotUserId": botUserID}).
		OrderBy("CreateAt DESC", "Id DESC").
		Offset(uint64(keep)).
		Limit(1)

	var rows []botEventCursorRow
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &rows, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get BotEvents backlog cutoff for bot_user_id=%s", botUserID)
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &model.BotEventCursor{CreateAt: rows[0].CreateAt, Id: rows[0].Id}, nil
}

func (s *SqlBotEventStore) DeleteOlderThan(rctx request.CTX, createAtBefore int64, limit int) (map[string]model.BotEventCursor, int64, error) {
	query := s.getQueryBuilder().
		Delete("BotEvents").
		Where(sq.Expr(
			"(BotUserId, CreateAt, Id) IN (SELECT BotUserId, CreateAt, Id FROM BotEvents WHERE CreateAt < ? LIMIT ?)",
			createAtBefore, limit,
		)).
		Suffix("RETURNING BotUserId, CreateAt, Id")

	var rows []botEventDeletedRow
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &rows, query); err != nil {
		return nil, 0, errors.Wrap(err, "failed to delete old BotEvents")
	}

	maxCursors := make(map[string]model.BotEventCursor)
	for _, r := range rows {
		c := model.BotEventCursor{CreateAt: r.CreateAt, Id: r.Id}
		if cur, ok := maxCursors[r.BotUserId]; !ok || cur.Less(c) {
			maxCursors[r.BotUserId] = c
		}
	}
	return maxCursors, int64(len(rows)), nil
}

func (ss *SqlStore) execBuilder(rctx request.CTX, db *sqlxDBWrapper, builder Builder) (sql.Result, error) {
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}
	return db.ExecContext(rctx.Context(), query, args...)
}
