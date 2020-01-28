// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgCommandStore struct {
	sqlstore.SqlCommandStore
}

func (s PgCommandStore) GetByTrigger(teamId string, trigger string) (*model.Command, *model.AppError) {
	var command model.Command

	query := "SELECT * FROM Commands WHERE TeamId = :TeamId AND \"trigger\" = :Trigger AND DeleteAt = 0"

	if err := s.GetReplica().SelectOne(&command, query, map[string]interface{}{"TeamId": teamId, "Trigger": trigger}); err != nil {
		return nil, model.NewAppError("SqlCommandStore.GetByTrigger", "store.sql_command.get_by_trigger.app_error", nil, "teamId="+teamId+", trigger="+trigger+", err="+err.Error(), http.StatusInternalServerError)
	}

	return &command, nil
}
