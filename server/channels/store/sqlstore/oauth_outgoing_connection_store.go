// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlOAuthOutgoingConnectionStore struct {
	*SqlStore
}

func NewSqlOAuthOutgoingConnectionStore(sqlStore *SqlStore) store.OAuthOutgoingConnectionStore {
	return &SqlOAuthOutgoingConnectionStore{sqlStore}
}

func (s *SqlOAuthOutgoingConnectionStore) SaveConnection(c request.CTX, conn *model.OAuthOutgoingConnection) (*model.OAuthOutgoingConnection, error) {
	if conn.Id != "" {
		return nil, store.NewErrInvalidInput("OAuthOutgoingConnection", "Id", conn.Id)
	}

	conn.PreSave()
	if err := conn.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO OAuthOutgoingConnection
	(Id, Name, ClientId, ClientSecret, CreateAt, UpdateAt, CreatorId, OAuthTokenURL, GrantType, Audiences)
	VALUES
	(:Id, :Name, :ClientId, :ClientSecret, :CreateAt, :UpdateAt, :CreatorId, :OAuthTokenURL, :GrantType, :Audiences)`, conn); err != nil {
		return nil, errors.Wrap(err, "failed to save OAuthOutgoingConnection")
	}
	return conn, nil
}

func (s *SqlOAuthOutgoingConnectionStore) UpdateConnection(c request.CTX, conn *model.OAuthOutgoingConnection) (*model.OAuthOutgoingConnection, error) {
	if conn.Id == "" {
		return nil, store.NewErrInvalidInput("OAuthOutgoingConnection", "Id", conn.Id)
	}

	conn.PreUpdate()
	if err := conn.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMasterX().NamedExec(`UPDATE OAuthOutgoingConnection SET
	Name=:Name, ClientId=:ClientId, ClientSecret=:ClientSecret, UpdateAt=:UpdateAt, OAuthTokenURL=:OAuthTokenURL, GrantType=:GrantType, Audiences=:Audiences
	WHERE Id=:Id`, conn); err != nil {
		return nil, errors.Wrap(err, "failed to update OAuthOutgoingConnection")
	}
	return conn, nil
}

func (s *SqlOAuthOutgoingConnectionStore) GetConnection(c request.CTX, id string) (*model.OAuthOutgoingConnection, error) {
	conn := &model.OAuthOutgoingConnection{}
	if err := s.GetReplicaX().Get(conn, `SELECT * FROM OAuthOutgoingConnection WHERE Id=?`, id); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("OAuthOutgoingConnection", id)
		}
		return nil, errors.Wrap(err, "failed to get OAuthOutgoingConnection")
	}
	return conn, nil
}

func (s *SqlOAuthOutgoingConnectionStore) GetConnections(c request.CTX, filters model.OAuthOutgoingConnectionGetConnectionsFilter) ([]*model.OAuthOutgoingConnection, error) {
	filters.SetDefaults()

	conns := []*model.OAuthOutgoingConnection{}
	query := s.getQueryBuilder().
		Select("*").
		From("OAuthOutgoingConnection").
		OrderBy("Id").
		Limit(uint64(filters.Limit))

	if filters.OffsetId != "" {
		query = query.Where("Id > ?", filters.OffsetId)
	}

	if err := s.GetReplicaX().SelectBuilder(&conns, query); err != nil {
		return nil, errors.Wrap(err, "failed to get OAuthOutgoingConnections")
	}

	return conns, nil
}

func (s *SqlOAuthOutgoingConnectionStore) DeleteConnection(c request.CTX, id string) error {
	if _, err := s.GetMasterX().Exec(`DELETE FROM OAuthOutgoingConnection WHERE Id=?`, id); err != nil {
		return errors.Wrap(err, "failed to delete OAuthOutgoingConnection")
	}
	return nil
}
