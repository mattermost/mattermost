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
		Columns("Id", "Token", "UserId", "Description", "IsActive").
		Values(token.Id, token.Token, token.UserId, token.Description, token.IsActive).
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
	transaction, err := s.GetMaster().Beginx()
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
	query := ""
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"
	} else if s.DriverName() == model.DatabaseDriverMysql {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = ?"
	}

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
	transaction, err := s.GetMaster().Beginx()
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
	query := ""
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = ?"
	} else if s.DriverName() == model.DatabaseDriverMysql {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.UserId = ?"
	}

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
	transaction, err := s.GetMaster().Beginx()
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

func (s SqlUserAccessTokenStore) deleteSessionsAndDisableToken(transaction *sqlxTxWrapper, tokenId string) error {
	query := ""
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = ?"
	} else if s.DriverName() == model.DatabaseDriverMysql {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = ?"
	}

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
