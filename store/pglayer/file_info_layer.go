// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgFileInfoStore struct {
	sqlstore.SqlFileInfoStore
}

func (s PgFileInfoStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError) {
	query := "DELETE from FileInfo WHERE Id = any (array (SELECT Id FROM FileInfo WHERE CreateAt < :EndTime LIMIT :Limit))"

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		return 0, model.NewAppError("SqlFileInfoStore.PermanentDeleteBatch", "store.sql_file_info.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, model.NewAppError("SqlFileInfoStore.PermanentDeleteBatch", "store.sql_file_info.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}

	return rowsAffected, nil
}
