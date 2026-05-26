// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"

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
		return fmt.Errorf("token_tosql: %w", err)
	}
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return fmt.Errorf("failed to save Token: %w", err)
	}
	return nil
}

func (s SqlTokenStore) Delete(token string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Token = ?", token); err != nil {
		return fmt.Errorf("failed to delete Token with value %s: %w", token, err)
	}
	return nil
}

func (s SqlTokenStore) GetByToken(tokenString string) (*model.Token, error) {
	var token model.Token

	query, args, err := s.tokenSelectQuery.
		Where(sq.Eq{"Token": tokenString}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("could not build sql query to get token store: %w", err)
	}

	if err := s.GetReplica().Get(&token, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Token", fmt.Sprintf("Token=%s", tokenString))
		}
		return nil, fmt.Errorf("failed to get Token with value %s: %w", tokenString, err)
	}

	return &token, nil
}

func (s SqlTokenStore) ConsumeOnce(tokenType, tokenStr string) (*model.Token, error) {
	var token model.Token

	query := `DELETE FROM Tokens WHERE Type = ? AND Token = ? RETURNING *`

	if err := s.GetMaster().Get(&token, query, tokenType, tokenStr); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Token", tokenStr)
		}
		return nil, fmt.Errorf("failed to consume token with type %s: %w", tokenType, err)
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
		return nil, fmt.Errorf("could not build sql query to get all tokens by type: %w", err)
	}

	if err := s.GetReplica().Select(&tokens, query, args...); err != nil {
		return nil, fmt.Errorf("failed to get all tokens of Type=%s: %w", tokenType, err)
	}
	return tokens, nil
}

func (s SqlTokenStore) RemoveAllTokensByType(tokenType string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Type = ?", tokenType); err != nil {
		return fmt.Errorf("failed to remove all Tokens with Type=%s: %w", tokenType, err)
	}
	return nil
}

func (s SqlTokenStore) GetTokenByTypeAndEmail(tokenType string, email string) (*model.Token, error) {
	// Since we are storing the extra information as a plain string, (JSON)
	// we need to compare with the JSON string representation.
	var token model.Token
	query, args, err := s.tokenSelectQuery.
		Where(sq.Eq{"Type": tokenType, "Extra": model.MapToJSON(map[string]string{"email": email})}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("could not build sql query to get token by type and email: %w", err)
	}
	if err := s.GetReplica().Get(&token, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Token", fmt.Sprintf("Type=%s, Email=%s", tokenType, email))
		}
		return nil, fmt.Errorf("failed to get Token with Type=%s and Email=%s: %w", tokenType, email, err)
	}
	return &token, nil
}
