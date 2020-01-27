// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgChannelMemberHistoryStore struct {
	sqlstore.SqlChannelMemberHistoryStore
}

func (s PgChannelMemberHistoryStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError) {
	query :=
		`DELETE FROM ChannelMemberHistory
				WHERE ctid IN (
				SELECT ctid FROM ChannelMemberHistory
				WHERE LeaveTime IS NOT NULL
				AND LeaveTime <= :EndTime
				LIMIT :Limit
			);`
	params := map[string]interface{}{"EndTime": endTime, "Limit": limit}
	sqlResult, err := s.GetMaster().Exec(query, params)
	if err != nil {
		return int64(0), model.NewAppError("SqlChannelMemberHistoryStore.PermanentDeleteBatchForChannel", "store.sql_channel_member_history.permanent_delete_batch.app_error", params, err.Error(), http.StatusInternalServerError)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return int64(0), model.NewAppError("SqlChannelMemberHistoryStore.PermanentDeleteBatchForChannel", "store.sql_channel_member_history.permanent_delete_batch.app_error", params, err.Error(), http.StatusInternalServerError)
	}
	return rowsAffected, nil
}
