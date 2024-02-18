// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlOutgoingOAuthConnectionStore struct {
	*SqlStore
}

func newSqlOutgoingOAuthConnectionStore(sqlStore *SqlStore) store.OutgoingOAuthConnectionStore {
	return &SqlOutgoingOAuthConnectionStore{sqlStore}
}

func (s *SqlOutgoingOAuthConnectionStore) SaveConnection(c request.CTX, conn *model.OutgoingOAuthConnection) (*model.OutgoingOAuthConnection, error) {
	if conn.Id != "" {
		return nil, store.NewErrInvalidInput("OutgoingOAuthConnection", "Id", conn.Id)
	}

	conn.PreSave()
	if err := conn.IsValid(); err != nil {
		return nil, err
	}

	if _, err := s.GetMasterX().NamedExec(`INSERT INTO OutgoingOAuthConnections
	(Id, Name, ClientId, ClientSecret, CreateAt, UpdateAt, CreatorId, OAuthTokenURL, GrantType, Audiences)
	VALUES
	(:Id, :Name, :ClientId, :ClientSecret, :CreateAt, :UpdateAt, :CreatorId, :OAuthTokenURL, :GrantType, :Audiences)`, conn); err != nil {
		return nil, errors.Wrap(err, "failed to save OutgoingOAuthConnection")
	}
	return conn, nil
}

func (s *SqlOutgoingOAuthConnectionStore) UpdateConnection(c request.CTX, conn *model.OutgoingOAuthConnection) (*model.OutgoingOAuthConnection, error) {
	if conn.Id == "" {
		return nil, store.NewErrInvalidInput("OutgoingOAuthConnection", "Id", conn.Id)
	}

	conn.PreUpdate()
	if err := conn.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().Update("OutgoingOAuthConnections").Where(sq.Eq{"Id": conn.Id}).Set("UpdateAt", conn.UpdateAt)
	if conn.Name != "" {
		query = query.Set("Name", conn.Name)
	}
	if conn.ClientId != "" {
		query = query.Set("ClientId", conn.ClientId)
	}
	if conn.ClientSecret != "" {
		query = query.Set("ClientSecret", conn.ClientSecret)
	}
	if conn.OAuthTokenURL != "" {
		query = query.Set("OAuthTokenURL", conn.OAuthTokenURL)
	}
	if conn.GrantType != "" {
		query = query.Set("GrantType", conn.GrantType)
	}
	if len(conn.Audiences) > 0 {
		query = query.Set("Audiences", conn.Audiences)
	}
	if conn.CredentialsUsername != nil {
		query = query.Set("CredentialsUsername", conn.CredentialsUsername)
	}
	if conn.CredentialsPassword != nil {
		query = query.Set("CredentialsPassword", conn.CredentialsPassword)
	}

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to update OutgoingOAuthConnection")
	}
	return conn, nil
}

func (s *SqlOutgoingOAuthConnectionStore) GetConnection(c request.CTX, id string) (*model.OutgoingOAuthConnection, error) {
	conn := &model.OutgoingOAuthConnection{}
	if err := s.GetReplicaX().Get(conn, `SELECT * FROM OutgoingOAuthConnections WHERE Id=?`, id); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("OutgoingOAuthConnection", id)
		}
		return nil, errors.Wrap(err, "failed to get OutgoingOAuthConnection")
	}
	return conn, nil
}

func (s *SqlOutgoingOAuthConnectionStore) GetConnections(c request.CTX, filters model.OutgoingOAuthConnectionGetConnectionsFilter) ([]*model.OutgoingOAuthConnection, error) {
	filters.SetDefaults()

	conns := []*model.OutgoingOAuthConnection{}
	query := s.getQueryBuilder().
		Select("*").
		From("OutgoingOAuthConnections").
		OrderBy("Id").
		Limit(uint64(filters.Limit))

	if filters.OffsetId != "" {
		query = query.Where("Id > ?", filters.OffsetId)
	}

	if filters.Audience != "" {
		query = query.Where(sq.Like{"Audiences": fmt.Sprint("%", filters.Audience, "%")})
	}

	if err := s.GetReplicaX().SelectBuilder(&conns, query); err != nil {
		return nil, errors.Wrap(err, "failed to get OutgoingOAuthConnections")
	}

	return conns, nil
}

func (s *SqlOutgoingOAuthConnectionStore) DeleteConnection(c request.CTX, id string) error {
	if _, err := s.GetMasterX().Exec(`DELETE FROM OutgoingOAuthConnections WHERE Id=?`, id); err != nil {
		return errors.Wrap(err, "failed to delete OutgoingOAuthConnection")
	}
	return nil
}
