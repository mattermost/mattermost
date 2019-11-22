// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store/sqlstore"
)

type PgAuditStore struct {
	sqlstore.SqlAuditStore
}

func (s PgAuditStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, *model.AppError) {
	query := "DELETE from Audits WHERE Id = any (array (SELECT Id FROM Audits WHERE CreateAt < :EndTime LIMIT :Limit))"

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
	if err != nil {
		return 0, model.NewAppError("PgAuditStore.PermanentDeleteBatch", "store.pg_audit.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, model.NewAppError("PgAuditStore.PermanentDeleteBatch", "store.pg_audit.permanent_delete_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}
	return rowsAffected, nil
}
