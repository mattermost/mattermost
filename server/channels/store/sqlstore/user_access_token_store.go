// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"

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
		return nil, fmt.Errorf("UserAccessToken_tosql: %w", err)
	}
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return nil, fmt.Errorf("failed to save UserAccessToken: %w", err)
	}
	return token, nil
}

func (s SqlUserAccessTokenStore) Delete(tokenId string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return fmt.Errorf("begin_transaction: %w", err)
	}

	defer finalizeTransactionX(transaction, &err)

	if err := s.deleteSessionsAndTokensById(transaction, tokenId); err == nil {
		if err := transaction.Commit(); err != nil {
			// don't need to rollback here since the transaction is already closed
			return fmt.Errorf("commit_transaction: %w", err)
		}
	}

	return nil
}

func (s SqlUserAccessTokenStore) deleteSessionsAndTokensById(transaction *sqlxTxWrapper, tokenId string) error {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"

	if _, err := transaction.Exec(query, tokenId); err != nil {
		return fmt.Errorf("failed to delete Sessions with UserAccessToken id=%s: %w", tokenId, err)
	}

	return s.deleteTokensById(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) deleteTokensById(transaction *sqlxTxWrapper, tokenId string) error {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE Id = ?", tokenId); err != nil {
		return fmt.Errorf("failed to delete UserAccessToken id=%s: %w", tokenId, err)
	}

	return nil
}

func (s SqlUserAccessTokenStore) DeleteAllForUser(userId string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return fmt.Errorf("begin_transaction: %w", err)
	}
	defer finalizeTransactionX(transaction, &err)
	if err := s.deleteSessionsandTokensByUser(transaction, userId); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return fmt.Errorf("commit_transaction: %w", err)
	}
	return nil
}

func (s SqlUserAccessTokenStore) deleteSessionsandTokensByUser(transaction *sqlxTxWrapper, userId string) error {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = ?"

	if _, err := transaction.Exec(query, userId); err != nil {
		return fmt.Errorf("failed to delete Sessions with UserAccessToken userId=%s: %w", userId, err)
	}

	return s.deleteTokensByUser(transaction, userId)
}

func (s SqlUserAccessTokenStore) deleteTokensByUser(transaction *sqlxTxWrapper, userId string) error {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE UserId = ?", userId); err != nil {
		return fmt.Errorf("failed to delete UserAccessToken userId=%s: %w", userId, err)
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
		return nil, fmt.Errorf("failed to get UserAccessToken with id=%s: %w", tokenId, err)
	}

	return &token, nil
}

func (s SqlUserAccessTokenStore) GetAll(offset, limit int) ([]*model.UserAccessToken, error) {
	tokens := []*model.UserAccessToken{}

	query := s.userAccessTokensSelectQuery.
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if err := s.GetReplica().SelectBuilder(&tokens, query); err != nil {
		return nil, fmt.Errorf("failed to find UserAccessTokens: %w", err)
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
		return nil, fmt.Errorf("failed to get UserAccessToken with token=%s: %w", tokenString, err)
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
		return nil, fmt.Errorf("failed to find UserAccessTokens with userId=%s: %w", userId, err)
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
		return nil, fmt.Errorf("failed to find UserAccessTokens by term with value '%s': %w", term, err)
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) UpdateTokenEnable(tokenId string) error {
	if _, err := s.GetMaster().Exec("UPDATE UserAccessTokens SET IsActive = TRUE WHERE Id = ?", tokenId); err != nil {
		return fmt.Errorf("failed to update UserAccessTokens with id=%s: %w", tokenId, err)
	}
	return nil
}

func (s SqlUserAccessTokenStore) UpdateTokenDisable(tokenId string) (err error) {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return fmt.Errorf("begin_transaction: %w", err)
	}
	defer finalizeTransactionX(transaction, &err)

	if err := s.deleteSessionsAndDisableToken(transaction, tokenId); err != nil {
		return err
	}
	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return fmt.Errorf("commit_transaction: %w", err)
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
		return nil, fmt.Errorf("failed to find expired UserAccessTokens: %w", err)
	}

	return tokens, nil
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
		err = fmt.Errorf("begin_transaction: %w", beginErr)
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
		err = fmt.Errorf("UserAccessToken_tosql: %w", sqErr)
		return
	}
	if _, sErr := transaction.Exec("DELETE FROM Sessions WHERE Token IN ("+subSQL+")", subArgs...); sErr != nil {
		err = fmt.Errorf("failed to delete Sessions for UserAccessTokens: %w", sErr)
		return
	}

	tokenSQL, tokenArgs, sqErr := s.getQueryBuilder().
		Delete("UserAccessTokens").
		Where(sq.Eq{"Id": tokenIDs}).
		ToSql()
	if sqErr != nil {
		err = fmt.Errorf("UserAccessToken_tosql: %w", sqErr)
		return
	}
	res, execErr := transaction.Exec(tokenSQL, tokenArgs...)
	if execErr != nil {
		err = fmt.Errorf("failed to delete UserAccessTokens: %w", execErr)
		return
	}

	rowCount, rErr := res.RowsAffected()
	if rErr != nil {
		err = fmt.Errorf("failed to read RowsAffected for UserAccessTokens delete: %w", rErr)
		return
	}

	if cErr := transaction.Commit(); cErr != nil {
		err = fmt.Errorf("commit_transaction: %w", cErr)
		return
	}

	deleted = rowCount
	return
}

func (s SqlUserAccessTokenStore) deleteSessionsAndDisableToken(transaction *sqlxTxWrapper, tokenId string) error {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"

	if _, err := transaction.Exec(query, tokenId); err != nil {
		return fmt.Errorf("failed to delete Sessions with UserAccessToken id=%s: %w", tokenId, err)
	}

	return s.updateTokenDisable(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) updateTokenDisable(transaction *sqlxTxWrapper, tokenId string) error {
	if _, err := transaction.Exec("UPDATE UserAccessTokens SET IsActive = FALSE WHERE Id = ?", tokenId); err != nil {
		return fmt.Errorf("failed to update UserAccessToken with id=%s: %w", tokenId, err)
	}

	return nil
}
