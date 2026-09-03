// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlUserAccessTokenStore struct {
	*SqlStore

	userAccessTokensSelectQuery sq.SelectBuilder
}

func newSqlUserAccessTokenStore(sqlStore *SqlStore) store.UserAccessTokenStore {
	s := &SqlUserAccessTokenStore{
		SqlStore: sqlStore,
	}

	s.userAccessTokensSelectQuery = s.getQueryBuilder().
		Select(
			"UserAccessTokens.Id",
			"UserAccessTokens.Token",
			"UserAccessTokens.UserId",
			"UserAccessTokens.Description",
			"UserAccessTokens.IsActive",
			"UserAccessTokens.ExpiresAt",
			"UserAccessTokens.LastNotifiedAt",
		).
		From("UserAccessTokens")

	return s
}

func (s SqlUserAccessTokenStore) Save(token *model.UserAccessToken) (*model.UserAccessToken, error) {
	token.PreSave()

	if err := token.IsValid(); err != nil {
		return nil, err
	}

	query, args, err := s.getQueryBuilder().Insert("UserAccessTokens").
		Columns("Id", "Token", "UserId", "Description", "IsActive", "ExpiresAt").
		Values(token.Id, token.Token, token.UserId, token.Description, token.IsActive, token.ExpiresAt).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "UserAccessToken_tosql")
	}
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save UserAccessToken")
	}
	return token, nil
}

func (s SqlUserAccessTokenStore) Delete(tokenId string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}

	defer finalizeTransactionX(transaction, &err)

	if err := s.deleteSessionsAndTokensById(transaction, tokenId); err == nil {
		if err := transaction.Commit(); err != nil {
			// don't need to rollback here since the transaction is already closed
			return errors.Wrap(err, "commit_transaction")
		}
	}

	return nil
}

func (s SqlUserAccessTokenStore) deleteSessionsAndTokensById(transaction *sqlxTxWrapper, tokenId string) error {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"

	if _, err := transaction.Exec(query, tokenId); err != nil {
		return errors.Wrapf(err, "failed to delete Sessions with UserAccessToken id=%s", tokenId)
	}

	return s.deleteTokensById(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) deleteTokensById(transaction *sqlxTxWrapper, tokenId string) error {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE Id = ?", tokenId); err != nil {
		return errors.Wrapf(err, "failed to delete UserAccessToken id=%s", tokenId)
	}

	return nil
}

func (s SqlUserAccessTokenStore) DeleteAllForUser(userId string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)
	if err := s.deleteSessionsandTokensByUser(transaction, userId); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (s SqlUserAccessTokenStore) deleteSessionsandTokensByUser(transaction *sqlxTxWrapper, userId string) error {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = ?"

	if _, err := transaction.Exec(query, userId); err != nil {
		return errors.Wrapf(err, "failed to delete Sessions with UserAccessToken userId=%s", userId)
	}

	return s.deleteTokensByUser(transaction, userId)
}

func (s SqlUserAccessTokenStore) deleteTokensByUser(transaction *sqlxTxWrapper, userId string) error {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE UserId = ?", userId); err != nil {
		return errors.Wrapf(err, "failed to delete UserAccessToken userId=%s", userId)
	}

	return nil
}

func (s SqlUserAccessTokenStore) Get(tokenId string) (*model.UserAccessToken, error) {
	var token model.UserAccessToken

	query := s.userAccessTokensSelectQuery.Where(sq.Eq{"Id": tokenId})

	if err := s.GetReplica().GetBuilder(&token, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("UserAccessToken", tokenId)
		}
		return nil, errors.Wrapf(err, "failed to get UserAccessToken with id=%s", tokenId)
	}

	return &token, nil
}

func (s SqlUserAccessTokenStore) GetAll(offset, limit int) ([]*model.UserAccessToken, error) {
	tokens := []*model.UserAccessToken{}

	query := s.userAccessTokensSelectQuery.
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if err := s.GetReplica().SelectBuilder(&tokens, query); err != nil {
		return nil, errors.Wrap(err, "failed to find UserAccessTokens")
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) GetByToken(tokenString string) (*model.UserAccessToken, error) {
	var token model.UserAccessToken

	query := s.userAccessTokensSelectQuery.Where(sq.Eq{"Token": tokenString})

	if err := s.GetReplica().GetBuilder(&token, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("UserAccessToken", fmt.Sprintf("token=%s", tokenString))
		}
		return nil, errors.Wrapf(err, "failed to get UserAccessToken with token=%s", tokenString)
	}

	return &token, nil
}

func (s SqlUserAccessTokenStore) GetByUser(userId string, offset, limit int) ([]*model.UserAccessToken, error) {
	tokens := []*model.UserAccessToken{}

	query := s.userAccessTokensSelectQuery.
		Where(sq.Eq{"UserId": userId}).
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if err := s.GetReplica().SelectBuilder(&tokens, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find UserAccessTokens with userId=%s", userId)
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) Search(term string) ([]*model.UserAccessToken, error) {
	term = sanitizeSearchTerm(term, "\\")
	tokens := []*model.UserAccessToken{}

	query := s.userAccessTokensSelectQuery.
		InnerJoin("Users ON UserAccessTokens.UserId = Users.Id").
		Where(sq.Or{
			sq.Like{"UserAccessTokens.Id": term},
			sq.Like{"UserAccessTokens.UserId": term},
			sq.Like{"Users.Username": term},
		})

	if err := s.GetReplica().SelectBuilder(&tokens, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find UserAccessTokens by term with value '%s'", term)
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) UpdateTokenEnable(tokenId string) error {
	if _, err := s.GetMaster().Exec("UPDATE UserAccessTokens SET IsActive = TRUE WHERE Id = ?", tokenId); err != nil {
		return errors.Wrapf(err, "failed to update UserAccessTokens with id=%s", tokenId)
	}
	return nil
}

func (s SqlUserAccessTokenStore) UpdateTokenDisable(tokenId string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	if err := s.deleteSessionsAndDisableToken(transaction, tokenId); err != nil {
		return err
	}
	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

// GetExpiredBefore returns active tokens whose non-zero ExpiresAt is less than
// or equal to the provided cutoff (Unix milliseconds), up to the given limit.
// The secret Token column is intentionally NOT selected — callers use the
// returned rows for metadata (audit logging, deletion) only.
//
// A non-positive limit returns an empty slice without hitting the DB rather
// than relying on the int -> uint64 cast (which would otherwise wrap a
// negative value into an enormous unsigned limit and effectively disable the
// bound).
func (s SqlUserAccessTokenStore) GetExpiredBefore(cutoff int64, limit int) ([]*model.UserAccessToken, error) {
	tokens := []*model.UserAccessToken{}

	if limit <= 0 {
		return tokens, nil
	}

	query := s.getQueryBuilder().
		Select(
			"UserAccessTokens.Id",
			"UserAccessTokens.UserId",
			"UserAccessTokens.Description",
			"UserAccessTokens.IsActive",
			"UserAccessTokens.ExpiresAt",
		).
		From("UserAccessTokens").
		Where(sq.Gt{"UserAccessTokens.ExpiresAt": 0}).
		Where(sq.LtOrEq{"UserAccessTokens.ExpiresAt": cutoff}).
		Where(sq.Eq{"UserAccessTokens.IsActive": true}).
		OrderBy("UserAccessTokens.ExpiresAt ASC").
		Limit(uint64(limit))

	if err := s.GetReplica().SelectBuilder(&tokens, query); err != nil {
		return nil, errors.Wrap(err, "failed to find expired UserAccessTokens")
	}

	return tokens, nil
}

// GetExpiringTokens returns active, non-bot tokens belonging to non-deactivated
// users that need a pre-expiry warning for one of the given day thresholds
// (e.g. 7/3/1), ordered most-urgent first, up to the given limit. Bot tokens are
// excluded because bot accounts are exempt from the expiry policy and have no
// human inbox to notify.
//
// Only *actionable* rows are returned: for each threshold T a token qualifies
// when it has entered the T-day bucket (ExpiresAt <= now + T days) and has not
// yet been notified at T or a more urgent bucket. "Not yet notified at T" means
// the last warning (if any) was sent while more than T days remained, i.e.
// LastNotifiedAt < ExpiresAt - T days (or LastNotifiedAt IS NULL). OR-ing this
// across every threshold yields exactly the tokens whose current (most urgent)
// bucket is still un-notified, so tokens already warned at their current bucket
// never consume a result slot — without this, a backlog of already-warned tokens
// ordered ahead of a less-urgent unnotified token could starve it past the limit
// on every run. The worker still recomputes each token's bucket and re-checks the
// last-notified time as a guard against races. The secret Token column is
// intentionally NOT selected — callers use the returned rows for metadata
// (notification, marker update) only.
//
// A non-positive limit or empty thresholds returns an empty slice without
// hitting the DB rather than relying on the int -> uint64 cast (which would
// otherwise wrap a negative value into an enormous unsigned limit and
// effectively disable the bound).
func (s SqlUserAccessTokenStore) GetExpiringTokens(now int64, thresholds []int, limit int) ([]*model.UserAccessToken, error) {
	tokens := []*model.UserAccessToken{}

	if limit <= 0 || len(thresholds) == 0 {
		return tokens, nil
	}

	actionable := sq.Or{}
	for _, t := range thresholds {
		bucketMillis := int64(t) * model.DayInMilliseconds
		actionable = append(actionable, sq.And{
			sq.LtOrEq{"UserAccessTokens.ExpiresAt": now + bucketMillis},
			sq.Or{
				sq.Eq{"UserAccessTokens.LastNotifiedAt": nil},
				sq.Expr("UserAccessTokens.LastNotifiedAt < UserAccessTokens.ExpiresAt - ?", bucketMillis),
			},
		})
	}

	query := s.getQueryBuilder().
		Select(
			"UserAccessTokens.Id",
			"UserAccessTokens.UserId",
			"UserAccessTokens.Description",
			"UserAccessTokens.IsActive",
			"UserAccessTokens.ExpiresAt",
			"UserAccessTokens.LastNotifiedAt",
		).
		From("UserAccessTokens").
		InnerJoin("Users ON Users.Id = UserAccessTokens.UserId").
		LeftJoin("Bots ON Bots.UserId = UserAccessTokens.UserId").
		Where(sq.Eq{"UserAccessTokens.IsActive": true}).
		Where(sq.Gt{"UserAccessTokens.ExpiresAt": now}).
		Where(sq.Eq{"Users.DeleteAt": 0}).
		Where(sq.Eq{"Bots.UserId": nil}).
		Where(actionable).
		OrderBy("UserAccessTokens.ExpiresAt ASC").
		Limit(uint64(limit))

	// Read from master: this dedups against LastNotifiedAt (written to master),
	// so a lagging replica could re-surface an already-warned token and send a
	// duplicate. It runs at most once per job run, so master costs nothing here.
	if err := s.GetMaster().SelectBuilder(&tokens, query); err != nil {
		return nil, errors.Wrap(err, "failed to find expiring UserAccessTokens")
	}

	return tokens, nil
}

// UpdateLastNotifiedAt records the time (Unix milliseconds) at which the token
// owner was most recently warned about the token's upcoming expiry, so the hourly
// notify_expiring_access_tokens job does not re-send the same warning on subsequent runs.
func (s SqlUserAccessTokenStore) UpdateLastNotifiedAt(tokenId string, notifiedAt int64) error {
	if _, err := s.GetMaster().Exec("UPDATE UserAccessTokens SET LastNotifiedAt = ? WHERE Id = ?", notifiedAt, tokenId); err != nil {
		return errors.Wrapf(err, "failed to update LastNotifiedAt for UserAccessToken with id=%s", tokenId)
	}
	return nil
}

// CountNonCompliantExpiry returns the number of active, non-bot tokens that
// violate the maximum lifetime policy implied by maxExpiresAt. It is used to
// preview the blast radius before revoking.
func (s SqlUserAccessTokenStore) CountNonCompliantExpiry(maxExpiresAt int64) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("UserAccessTokens").
		Where(sq.Or{
			sq.Eq{"UserAccessTokens.ExpiresAt": 0},
			sq.Gt{"UserAccessTokens.ExpiresAt": maxExpiresAt},
		}).
		Where(sq.Eq{"UserAccessTokens.IsActive": true}).
		Where(sq.Expr("UserAccessTokens.UserId NOT IN (SELECT UserId FROM Bots)"))

	var count int64
	if err := s.GetReplica().GetBuilder(&count, query); err != nil {
		return 0, errors.Wrap(err, "failed to count non-compliant UserAccessTokens")
	}

	return count, nil
}

// DeleteNonCompliantExpiry hard-deletes up to limit non-compliant tokens and
// their associated sessions in a single transaction, returning one UserId per
// deleted token row so the caller can count deletions and clear per-user
// session caches. A non-positive limit returns nil without hitting the DB.
func (s SqlUserAccessTokenStore) DeleteNonCompliantExpiry(maxExpiresAt int64, limit int) ([]string, error) {
	if limit <= 0 {
		return nil, nil
	}

	sql := `
WITH to_delete AS (
    SELECT Id, Token, UserId
    FROM UserAccessTokens
    WHERE (ExpiresAt = 0 OR ExpiresAt > $1)
      AND IsActive = true
      AND UserId NOT IN (SELECT UserId FROM Bots)
    LIMIT $2
),
deleted_sessions AS (
    DELETE FROM Sessions
    WHERE Token IN (SELECT Token FROM to_delete)
),
deleted_tokens AS (
    DELETE FROM UserAccessTokens
    WHERE Id IN (SELECT Id FROM to_delete)
    RETURNING UserId
)
SELECT UserId FROM deleted_tokens`

	var userIDs []string
	if err := s.GetMaster().Select(&userIDs, sql, maxExpiresAt, limit); err != nil {
		return nil, errors.Wrap(err, "failed to delete non-compliant UserAccessTokens")
	}

	return userIDs, nil
}

// DeleteByIds deletes the tokens identified by tokenIDs along with any sessions
// minted from those tokens, all within a single transaction. It returns the
// number of UserAccessTokens rows actually deleted.
func (s SqlUserAccessTokenStore) DeleteByIds(tokenIDs []string) (deleted int64, err error) {
	if len(tokenIDs) == 0 {
		return 0, nil
	}

	transaction, beginErr := s.GetMaster().Begin()
	if beginErr != nil {
		err = errors.Wrap(beginErr, "begin_transaction")
		return
	}
	defer finalizeTransactionX(transaction, &err)

	// Delete sessions whose Token matches any of the PAT tokens via subquery.
	subSQL, subArgs, sqErr := s.getQueryBuilder().
		Select("Token").
		From("UserAccessTokens").
		Where(sq.Eq{"Id": tokenIDs}).
		ToSql()
	if sqErr != nil {
		err = errors.Wrap(sqErr, "UserAccessToken_tosql")
		return
	}
	if _, sErr := transaction.Exec("DELETE FROM Sessions WHERE Token IN ("+subSQL+")", subArgs...); sErr != nil {
		err = errors.Wrap(sErr, "failed to delete Sessions for UserAccessTokens")
		return
	}

	tokenSQL, tokenArgs, sqErr := s.getQueryBuilder().
		Delete("UserAccessTokens").
		Where(sq.Eq{"Id": tokenIDs}).
		ToSql()
	if sqErr != nil {
		err = errors.Wrap(sqErr, "UserAccessToken_tosql")
		return
	}
	res, execErr := transaction.Exec(tokenSQL, tokenArgs...)
	if execErr != nil {
		err = errors.Wrap(execErr, "failed to delete UserAccessTokens")
		return
	}

	rowCount, rErr := res.RowsAffected()
	if rErr != nil {
		err = errors.Wrap(rErr, "failed to read RowsAffected for UserAccessTokens delete")
		return
	}

	if cErr := transaction.Commit(); cErr != nil {
		err = errors.Wrap(cErr, "commit_transaction")
		return
	}

	deleted = rowCount
	return
}

func (s SqlUserAccessTokenStore) deleteSessionsAndDisableToken(transaction *sqlxTxWrapper, tokenId string) error {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"

	if _, err := transaction.Exec(query, tokenId); err != nil {
		return errors.Wrapf(err, "failed to delete Sessions with UserAccessToken id=%s", tokenId)
	}

	return s.updateTokenDisable(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) updateTokenDisable(transaction *sqlxTxWrapper, tokenId string) error {
	if _, err := transaction.Exec("UPDATE UserAccessTokens SET IsActive = FALSE WHERE Id = ?", tokenId); err != nil {
		return errors.Wrapf(err, "failed to update UserAccessToken with id=%s", tokenId)
	}

	return nil
}

// UpdateTokenRotate replaces the secret and expiry on an existing token inside
// a single transaction.  Old sessions keyed to the previous secret are deleted
// first (the join reads the old Token value, so the DELETE must precede the
// UPDATE), then the token row is updated with the new secret and expiry.
func (s SqlUserAccessTokenStore) UpdateTokenRotate(tokenID, newToken string, expiresAt int64) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	deleteQuery := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"
	if _, err = transaction.Exec(deleteQuery, tokenID); err != nil {
		return errors.Wrapf(err, "failed to delete Sessions for UserAccessToken id=%s during rotate", tokenID)
	}

	if _, err = transaction.Exec(
		"UPDATE UserAccessTokens SET Token = ?, ExpiresAt = ? WHERE Id = ?",
		newToken, expiresAt, tokenID,
	); err != nil {
		return errors.Wrapf(err, "failed to rotate UserAccessToken id=%s", tokenID)
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
