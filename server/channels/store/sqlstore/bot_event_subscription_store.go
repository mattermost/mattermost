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

const botEventSubscriptionTable = "BotEventSubscriptions"

var botEventSubscriptionColumns = []string{
	"BotUserId", "Mode", "CallbackURL", "Secret", "IgnoreBotAuthors", "Enabled", "DisabledReason",
	"AckCursorCreateAt", "AckCursorId", "TruncatedCursorCreateAt", "TruncatedCursorId",
	"ConsecutiveFailures", "FirstFailureAt", "NextAttemptAt", "LeaseNode", "LeaseExpiresAt",
	"CreateAt", "UpdateAt", "LastDeliveredAt",
}

type SqlBotEventSubscriptionStore struct {
	*SqlStore
}

func newSqlBotEventSubscriptionStore(sqlStore *SqlStore) store.BotEventSubscriptionStore {
	return &SqlBotEventSubscriptionStore{SqlStore: sqlStore}
}

func (s *SqlBotEventSubscriptionStore) Save(rctx request.CTX, sub *model.BotEventSubscription) (*model.BotEventSubscription, error) {
	sub.PreSave()
	if appErr := sub.IsValid(); appErr != nil {
		return nil, appErr
	}

	query := s.getQueryBuilder().
		Insert(botEventSubscriptionTable).
		Columns(botEventSubscriptionColumns...).
		Values(
			sub.BotUserId, sub.Mode, sub.CallbackURL, sub.Secret, sub.IgnoreBotAuthors, sub.Enabled, sub.DisabledReason,
			sub.AckCursorCreateAt, sub.AckCursorId, sub.TruncatedCursorCreateAt, sub.TruncatedCursorId,
			sub.ConsecutiveFailures, sub.FirstFailureAt, sub.NextAttemptAt, sub.LeaseNode, sub.LeaseExpiresAt,
			sub.CreateAt, sub.UpdateAt, sub.LastDeliveredAt,
		)

	if _, err := s.execBuilder(rctx, s.GetMaster(), query); err != nil {
		if IsUniqueConstraintError(err, []string{"PRIMARY", "boteventsubscriptions_pkey"}) {
			return nil, store.NewErrConflict("BotEventSubscription", err, "bot_user_id="+sub.BotUserId)
		}
		return nil, errors.Wrapf(err, "failed to save BotEventSubscription with bot_user_id=%s", sub.BotUserId)
	}

	return sub, nil
}

func (s *SqlBotEventSubscriptionStore) Get(rctx request.CTX, botUserID string) (*model.BotEventSubscription, error) {
	query := s.getQueryBuilder().
		Select(botEventSubscriptionColumns...).
		From(botEventSubscriptionTable).
		Where(sq.Eq{"BotUserId": botUserID})

	var subs []*model.BotEventSubscription
	if err := s.DBXFromContext(rctx.Context()).SelectBuilderCtx(rctx.Context(), &subs, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get BotEventSubscription with bot_user_id=%s", botUserID)
	}
	if len(subs) == 0 {
		return nil, store.NewErrNotFound("BotEventSubscription", botUserID)
	}
	return subs[0], nil
}

func (s *SqlBotEventSubscriptionStore) GetForBots(rctx request.CTX, botUserIDs []string) ([]*model.BotEventSubscription, error) {
	unique := dedupeStrings(botUserIDs)
	if len(unique) == 0 {
		return []*model.BotEventSubscription{}, nil
	}

	query := s.getQueryBuilder().
		Select("BotUserId", "Mode", "IgnoreBotAuthors", "Enabled", "DisabledReason").
		From(botEventSubscriptionTable).
		Where(sq.Eq{"BotUserId": unique})

	subs := []*model.BotEventSubscription{}
	if err := s.GetReplica().SelectBuilderCtx(rctx.Context(), &subs, query); err != nil {
		return nil, errors.Wrap(err, "failed to get BotEventSubscriptions for bots")
	}
	return subs, nil
}

func (s *SqlBotEventSubscriptionStore) GetPage(rctx request.CTX, afterBotUserID string, limit int) ([]*model.BotEventSubscription, error) {
	query := s.getQueryBuilder().
		Select("BotUserId", "AckCursorCreateAt", "AckCursorId", "TruncatedCursorCreateAt", "TruncatedCursorId").
		From(botEventSubscriptionTable).
		Where(sq.Gt{"BotUserId": afterBotUserID}).
		OrderBy("BotUserId").
		Limit(uint64(limit))

	subs := []*model.BotEventSubscription{}
	if err := s.GetReplica().SelectBuilderCtx(rctx.Context(), &subs, query); err != nil {
		return nil, errors.Wrap(err, "failed to get a page of BotEventSubscriptions")
	}
	return subs, nil
}

func (s *SqlBotEventSubscriptionStore) Update(rctx request.CTX, sub *model.BotEventSubscription) (*model.BotEventSubscription, error) {
	sub.PreUpdate()
	if appErr := sub.IsValid(); appErr != nil {
		return nil, appErr
	}

	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("Mode", sub.Mode).
		Set("CallbackURL", sub.CallbackURL).
		Set("IgnoreBotAuthors", sub.IgnoreBotAuthors).
		Set("UpdateAt", sub.UpdateAt).
		Where(sq.Eq{"BotUserId": sub.BotUserId})

	if err := s.updateExpectingRow(rctx, query, sub.BotUserId); err != nil {
		return nil, err
	}
	return sub, nil
}

func (s *SqlBotEventSubscriptionStore) UpdateSecret(rctx request.CTX, botUserID, secret string, updateAt int64) error {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("Secret", secret).
		Set("UpdateAt", updateAt).
		Where(sq.Eq{"BotUserId": botUserID})

	return s.updateExpectingRow(rctx, query, botUserID)
}

func (s *SqlBotEventSubscriptionStore) SetEnabled(rctx request.CTX, botUserID string, enabled bool, reason string, updateAt int64) error {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("Enabled", enabled).
		Set("DisabledReason", reason).
		Set("UpdateAt", updateAt).
		Where(sq.Eq{"BotUserId": botUserID})

	if enabled {
		query = query.
			Set("ConsecutiveFailures", 0).
			Set("FirstFailureAt", 0).
			Set("NextAttemptAt", 0)
	}

	return s.updateExpectingRow(rctx, query, botUserID)
}

// AdvanceAckCursor only moves the cursor forward. Under READ COMMITTED Postgres
// re-evaluates the WHERE clause on the locked row, so concurrent callers cannot
// move it backwards.
func (s *SqlBotEventSubscriptionStore) AdvanceAckCursor(rctx request.CTX, botUserID string, cursor model.BotEventCursor, deliveredAt int64) (bool, error) {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("AckCursorCreateAt", cursor.CreateAt).
		Set("AckCursorId", cursor.Id).
		Set("LastDeliveredAt", deliveredAt).
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(AckCursorCreateAt, AckCursorId) < (?, ?)", cursor.CreateAt, cursor.Id))

	return s.advanceCursor(rctx, query, botUserID)
}

func (s *SqlBotEventSubscriptionStore) AdvanceTruncatedCursor(rctx request.CTX, botUserID string, cursor model.BotEventCursor) (bool, error) {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("TruncatedCursorCreateAt", cursor.CreateAt).
		Set("TruncatedCursorId", cursor.Id).
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(TruncatedCursorCreateAt, TruncatedCursorId) < (?, ?)", cursor.CreateAt, cursor.Id))

	return s.advanceCursor(rctx, query, botUserID)
}

func (s *SqlBotEventSubscriptionStore) Delete(rctx request.CTX, botUserID string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	eventsQuery := s.getQueryBuilder().Delete("BotEvents").Where(sq.Eq{"BotUserId": botUserID})
	if _, err = transaction.ExecBuilder(eventsQuery); err != nil {
		return errors.Wrapf(err, "failed to delete BotEvents for bot_user_id=%s", botUserID)
	}

	subQuery := s.getQueryBuilder().Delete(botEventSubscriptionTable).Where(sq.Eq{"BotUserId": botUserID})
	result, err := transaction.ExecBuilder(subQuery)
	if err != nil {
		return errors.Wrapf(err, "failed to delete BotEventSubscription with bot_user_id=%s", botUserID)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to count deleted BotEventSubscriptions")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	// The events delete commits even on a miss; orphaned events are harmless.
	if rows == 0 {
		return store.NewErrNotFound("BotEventSubscription", botUserID)
	}
	return nil
}

func (s *SqlBotEventSubscriptionStore) updateExpectingRow(rctx request.CTX, query sq.UpdateBuilder, botUserID string) error {
	result, err := s.execBuilder(rctx, s.GetMaster(), query)
	if err != nil {
		return errors.Wrapf(err, "failed to update BotEventSubscription with bot_user_id=%s", botUserID)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return errors.Wrapf(err, "failed to count updated BotEventSubscriptions for bot_user_id=%s", botUserID)
	}
	if rows == 0 {
		return store.NewErrNotFound("BotEventSubscription", botUserID)
	}
	return nil
}

func (s *SqlBotEventSubscriptionStore) advanceCursor(rctx request.CTX, query sq.UpdateBuilder, botUserID string) (bool, error) {
	result, err := s.execBuilder(rctx, s.GetMaster(), query)
	if err != nil {
		return false, errors.Wrapf(err, "failed to advance cursor for bot_user_id=%s", botUserID)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrapf(err, "failed to count advanced cursors for bot_user_id=%s", botUserID)
	}
	return rows == 1, nil
}

func dedupeStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, v := range in {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}
