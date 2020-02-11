package helper

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

func ChannelMemberHistoryPermanentDeleteBatch(s sqlstore.SqlChannelMemberHistoryStore, endTime int64, limit int64, buildQuery func() string) (int64, *model.AppError) {
	query := buildQuery()

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
