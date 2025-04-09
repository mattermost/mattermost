// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlTokenStore struct {
	*SqlStore

	tokenSelectQuery sq.SelectBuilder
}

func newSqlTokenStore(sqlStore *SqlStore) store.TokenStore {
	s := SqlTokenStore{
		SqlStore: sqlStore,
	}

	s.tokenSelectQuery = s.getQueryBuilder().
		Select("Token", "CreateAt", "Type", "Extra").
		From("Tokens")

	return &s
}

func (s SqlTokenStore) Save(token *model.Token) error {
	if err := token.IsValid(); err != nil {
		return err
	}
	query, args, err := s.getQueryBuilder().
		Insert("Tokens").
		Columns("Token", "CreateAt", "Type", "Extra").
		Values(token.Token, token.CreateAt, token.Type, token.Extra).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "token_tosql")
	}
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to save Token")
	}
	return nil
}

func (s SqlTokenStore) Delete(token string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Token = ?", token); err != nil {
		return errors.Wrapf(err, "failed to delete Token with value %s", token)
	}
	return nil
}

func (s SqlTokenStore) GetByToken(tokenString string) (*model.Token, error) {
	var token model.Token

	query, args, err := s.tokenSelectQuery.
		Where(sq.Eq{"Token": tokenString}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "could not build sql query to get token store")
	}

	if err := s.GetReplica().Get(&token, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Token", fmt.Sprintf("Token=%s", tokenString))
		}
		return nil, errors.Wrapf(err, "failed to get Token with value %s", tokenString)
	}

	return &token, nil
}

func (s SqlTokenStore) Cleanup(expiryTime int64) {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE CreateAt < ?", expiryTime); err != nil {
		mlog.Error("Unable to cleanup token store.")
	}
}

func (s SqlTokenStore) GetAllTokensByType(tokenType string) ([]*model.Token, error) {
	tokens := []*model.Token{}
	query, args, err := s.tokenSelectQuery.
		Where(sq.Eq{"Type": tokenType}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "could not build sql query to get all tokens by type")
	}

	if err := s.GetReplica().Select(&tokens, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get all tokens of Type=%s", tokenType)
	}
	return tokens, nil
}

func (s SqlTokenStore) RemoveAllTokensByType(tokenType string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Type = ?", tokenType); err != nil {
		return errors.Wrapf(err, "failed to remove all Tokens with Type=%s", tokenType)
	}
	return nil
}
