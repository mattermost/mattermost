// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelGuardStore struct {
	*SqlStore

	channelGuardSelectQuery sq.SelectBuilder
}

func newSqlChannelGuardStore(sqlStore *SqlStore) store.ChannelGuardStore {
	s := &SqlChannelGuardStore{SqlStore: sqlStore}

	s.channelGuardSelectQuery = s.getQueryBuilder().
		Select("ChannelId", "PluginId", "CreatedAt").
		From("ChannelGuards")

	return s
}

func (s *SqlChannelGuardStore) Save(rctx request.CTX, guard *store.ChannelGuard) error {
	builder := s.getQueryBuilder().
		Insert("ChannelGuards").
		Columns("ChannelId", "PluginId", "CreatedAt").
		Values(guard.ChannelId, guard.PluginId, guard.CreatedAt).
		SuffixExpr(sq.Expr("ON CONFLICT (ChannelId, PluginId) DO NOTHING"))

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return fmt.Errorf("failed to save channel guard for channel=%s plugin=%s: %w", guard.ChannelId, guard.PluginId, err)
	}

	return nil
}

func (s *SqlChannelGuardStore) Delete(rctx request.CTX, channelID, pluginID string) (int64, error) {
	builder := s.getQueryBuilder().
		Delete("ChannelGuards").
		Where(sq.Eq{
			"ChannelId": channelID,
			"PluginId":  pluginID,
		})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return 0, fmt.Errorf("failed to delete channel guard for channel=%s plugin=%s: %w", channelID, pluginID, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected for channel guard delete channel=%s plugin=%s: %w", channelID, pluginID, err)
	}

	return rowsAffected, nil
}

func (s *SqlChannelGuardStore) GetForChannel(rctx request.CTX, channelID string) ([]*store.ChannelGuard, error) {
	query := s.channelGuardSelectQuery.Where(sq.Eq{"ChannelId": channelID})

	guards := []*store.ChannelGuard{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&guards, query); err != nil {
		return nil, fmt.Errorf("failed to get channel guards for channel=%s: %w", channelID, err)
	}

	return guards, nil
}

func (s *SqlChannelGuardStore) GetAll(rctx request.CTX) ([]*store.ChannelGuard, error) {
	guards := []*store.ChannelGuard{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&guards, s.channelGuardSelectQuery); err != nil {
		return nil, fmt.Errorf("failed to get all channel guards: %w", err)
	}

	return guards, nil
}
