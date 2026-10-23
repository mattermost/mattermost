// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const botEventSubscriptionTable = "BotEventSubscriptions"

var botEventSubscriptionColumns = []string{
	"BotUserId", "Mode", "CallbackURL", "Secret", "IgnoreBotAuthors", "Enabled", "DisabledReason",
	"AckCursorCreateAt", "AckCursorId",
	"ConsecutiveFailures", "FirstFailureAt", "NextAttemptAt", "LeaseNode", "LeaseExpiresAt",
	"CreateAt", "UpdateAt", "LastDeliveredAt",
}

// A deactivated bot must not keep pushing its backlog.
var activeBotUserExists = sq.Expr("EXISTS (SELECT 1 FROM Users u WHERE u.Id = BotEventSubscriptions.BotUserId AND u.DeleteAt = 0)")

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
			sub.AckCursorCreateAt, sub.AckCursorId,
			sub.ConsecutiveFailures, sub.FirstFailureAt, sub.NextAttemptAt, sub.LeaseNode, sub.LeaseExpiresAt,
			sub.CreateAt, sub.UpdateAt, sub.LastDeliveredAt,
		)

	if _, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query); err != nil {
		if IsUniqueConstraintError(err, []string{"boteventsubscriptions_pkey"}) {
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

	var sub model.BotEventSubscription
	if err := s.DBXFromContext(rctx.Context()).GetBuilder(&sub, query); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, store.NewErrNotFound("BotEventSubscription", botUserID)
		}
		return nil, errors.Wrapf(err, "failed to get BotEventSubscription with bot_user_id=%s", botUserID)
	}
	return &sub, nil
}

func (s *SqlBotEventSubscriptionStore) GetForBots(rctx request.CTX, botUserIDs []string) ([]*model.BotEventSubscription, error) {
	if len(botUserIDs) == 0 {
		return []*model.BotEventSubscription{}, nil
	}

	query := s.getQueryBuilder().
		Select("BotUserId", "Mode", "IgnoreBotAuthors", "Enabled", "DisabledReason").
		From(botEventSubscriptionTable).
		Where(sq.Eq{"BotUserId": botUserIDs})

	subs := []*model.BotEventSubscription{}
	if err := s.GetReplica().SelectBuilderCtx(rctx.Context(), &subs, query); err != nil {
		return nil, errors.Wrap(err, "failed to get BotEventSubscriptions for bots")
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

	// A new endpoint gets a fresh failure window. SET expressions read the old row.
	for _, column := range []string{"ConsecutiveFailures", "FirstFailureAt", "NextAttemptAt"} {
		query = query.Set(column, sq.Expr(fmt.Sprintf("CASE WHEN CallbackURL <> ? OR Mode <> ? THEN 0 ELSE %s END", column), sub.CallbackURL, sub.Mode))
	}

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

	result, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query)
	if err != nil {
		return false, errors.Wrapf(err, "failed to advance ack cursor for bot_user_id=%s", botUserID)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrapf(err, "failed to count advanced ack cursors for bot_user_id=%s", botUserID)
	}
	return rows == 1, nil
}

// ClaimForDelivery acquires or renews the push lease on the database clock, so node clock
// skew cannot let two nodes hold it. Under READ COMMITTED a concurrent claim waits for the
// row lock and then re-checks the WHERE clause, so exactly one caller wins.
func (s *SqlBotEventSubscriptionStore) ClaimForDelivery(rctx request.CTX, botUserID, node string, leaseMillis, now int64) (*model.BotEventSubscription, error) {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("LeaseNode", node).
		Set("LeaseExpiresAt", sq.Expr(dbWriteMillis+" + ?", leaseMillis)).
		Where(sq.Eq{"BotUserId": botUserID, "Mode": model.BotEventSubscriptionModePush, "Enabled": true}).
		Where(sq.LtOrEq{"NextAttemptAt": now}).
		Where(sq.Expr("(LeaseNode = ? OR LeaseExpiresAt < "+dbWriteMillis+")", node)).
		Where(activeBotUserExists).
		Suffix("RETURNING " + strings.Join(botEventSubscriptionColumns, ", "))

	var subs []*model.BotEventSubscription
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &subs, query); err != nil {
		return nil, errors.Wrapf(err, "failed to claim BotEventSubscription for bot_user_id=%s", botUserID)
	}
	if len(subs) == 0 {
		return nil, nil
	}
	return subs[0], nil
}

func (s *SqlBotEventSubscriptionStore) ReleaseLease(rctx request.CTX, botUserID, node string) error {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("LeaseNode", "").
		Set("LeaseExpiresAt", 0).
		Where(sq.Eq{"BotUserId": botUserID, "LeaseNode": node})

	if _, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query); err != nil {
		return errors.Wrapf(err, "failed to release lease for bot_user_id=%s", botUserID)
	}
	return nil
}

// RecordDeliverySuccess is monotonic but not fenced by the lease: a 2xx proves the
// receiver has the event, so its acknowledgement is never dropped.
func (s *SqlBotEventSubscriptionStore) RecordDeliverySuccess(rctx request.CTX, botUserID string, cursor model.BotEventCursor, deliveredAt int64) error {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("AckCursorCreateAt", cursor.CreateAt).
		Set("AckCursorId", cursor.Id).
		Set("LastDeliveredAt", deliveredAt).
		Set("ConsecutiveFailures", 0).
		Set("FirstFailureAt", 0).
		Set("NextAttemptAt", 0).
		Where(sq.Eq{"BotUserId": botUserID}).
		Where(sq.Expr("(AckCursorCreateAt, AckCursorId) < (?, ?)", cursor.CreateAt, cursor.Id))

	if _, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query); err != nil {
		return errors.Wrapf(err, "failed to record delivery success for bot_user_id=%s", botUserID)
	}
	return nil
}

// RecordDeliveryFailure is fenced by the lease and releases it. It reports whether the
// write applied, which is false when another node owns the subscription now.
func (s *SqlBotEventSubscriptionStore) RecordDeliveryFailure(rctx request.CTX, botUserID, node string, f model.BotEventDeliveryFailure) (bool, error) {
	query := s.getQueryBuilder().
		Update(botEventSubscriptionTable).
		Set("ConsecutiveFailures", f.ConsecutiveFailures).
		Set("FirstFailureAt", f.FirstFailureAt).
		Set("NextAttemptAt", f.NextAttemptAt).
		Set("LeaseNode", "").
		Set("LeaseExpiresAt", 0).
		Where(sq.Eq{"BotUserId": botUserID, "LeaseNode": node, "Enabled": true, "Mode": model.BotEventSubscriptionModePush})
	if f.DisabledReason != "" {
		query = query.Set("Enabled", false).Set("DisabledReason", f.DisabledReason).Set("UpdateAt", f.UpdateAt)
	}

	result, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query)
	if err != nil {
		return false, errors.Wrapf(err, "failed to record delivery failure for bot_user_id=%s", botUserID)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrapf(err, "failed to count recorded delivery failures for bot_user_id=%s", botUserID)
	}
	return rows == 1, nil
}

// GetPushDeliveryCandidates returns bots that are due, unleased and have a settled event
// past their ack cursor. It is the sweep that retries failures and covers lost wake-ups.
func (s *SqlBotEventSubscriptionStore) GetPushDeliveryCandidates(rctx request.CTX, now, settleWindowMillis int64, limit int) ([]string, error) {
	query := s.getQueryBuilder().
		Select("s.BotUserId").
		From(botEventSubscriptionTable + " s").
		Where(sq.Eq{"s.Mode": model.BotEventSubscriptionModePush, "s.Enabled": true}).
		Where(sq.LtOrEq{"s.NextAttemptAt": now}).
		Where(sq.Expr("s.LeaseExpiresAt < " + dbWriteMillis)).
		Where(sq.Expr("EXISTS (SELECT 1 FROM Users u WHERE u.Id = s.BotUserId AND u.DeleteAt = 0)")).
		Where(sq.Expr(`EXISTS (SELECT 1 FROM BotEvents e WHERE e.BotUserId = s.BotUserId
			AND (e.CreateAt, e.Id) > (s.AckCursorCreateAt, s.AckCursorId)
			AND e.CreateAt <= `+dbReadMillis+` - ?)`, settleWindowMillis)).
		OrderBy("s.NextAttemptAt", "s.BotUserId").
		Limit(uint64(limit))

	var ids []string
	if err := s.GetMaster().SelectBuilderCtx(rctx.Context(), &ids, query); err != nil {
		return nil, errors.Wrap(err, "failed to get push delivery candidates")
	}
	return ids, nil
}

// Delete removes the subscription together with its events. Deleting a missing
// subscription is not an error.
func (s *SqlBotEventSubscriptionStore) Delete(rctx request.CTX, botUserID string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	for _, table := range []string{"BotEvents", botEventSubscriptionTable} {
		if _, err = transaction.ExecBuilder(s.getQueryBuilder().Delete(table).Where(sq.Eq{"BotUserId": botUserID})); err != nil {
			return errors.Wrapf(err, "failed to delete from %s for bot_user_id=%s", table, botUserID)
		}
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (s *SqlBotEventSubscriptionStore) updateExpectingRow(rctx request.CTX, query sq.UpdateBuilder, botUserID string) error {
	result, err := s.GetMaster().ExecBuilderCtx(rctx.Context(), query)
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
