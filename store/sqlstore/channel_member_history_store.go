// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlChannelMemberHistoryStore struct {
	SqlStore
}

func NewSqlChannelMemberHistoryStore(sqlStore SqlStore) store.ChannelMemberHistoryStore {
	s := &SqlChannelMemberHistoryStore{
		SqlStore: sqlStore,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.ChannelMemberHistory{}, "ChannelMemberHistory").SetKeys(false, "ChannelId", "UserId", "JoinTime")
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("JoinTime").SetNotNull(true)
	}

	return s
}

func (s SqlChannelMemberHistoryStore) LogJoinEvent(userId string, channelId string, joinTime int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		channelMemberHistory := &model.ChannelMemberHistory{
			UserId:    userId,
			ChannelId: channelId,
			JoinTime:  joinTime,
		}

		if err := s.GetMaster().Insert(channelMemberHistory); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.LogJoinEvent", "store.sql_channel_member_history.log_join_event.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelMemberHistoryStore) LogLeaveEvent(userId string, channelId string, leaveTime int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := `
			UPDATE ChannelMemberHistory
			SET LeaveTime = :LeaveTime
			WHERE UserId = :UserId
			AND ChannelId = :ChannelId
			AND LeaveTime IS NULL`

		params := map[string]interface{}{"UserId": userId, "ChannelId": channelId, "LeaveTime": leaveTime}
		if sqlResult, err := s.GetMaster().Exec(query, params); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.LogLeaveEvent", "store.sql_channel_member_history.log_leave_event.update_error", params, err.Error(), http.StatusInternalServerError)
		} else if rows, err := sqlResult.RowsAffected(); err == nil && rows != 1 {
			// there was no join event to update - this is best effort, so no need to raise an error
			l4g.Warn("Channel join event for user %v and channel %v not found", userId, channelId)
		}
	})
}

func (s SqlChannelMemberHistoryStore) GetUsersInChannelDuring(startTime int64, endTime int64, channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := `
			SELECT
				cmh.*,
				u.Email
			FROM ChannelMemberHistory cmh
			INNER JOIN Users u ON cmh.UserId = u.Id
			WHERE cmh.ChannelId = :ChannelId
			AND cmh.JoinTime <= :EndTime
			AND (cmh.LeaveTime IS NULL OR cmh.LeaveTime >= :StartTime)
			ORDER BY cmh.JoinTime ASC`

		params := map[string]interface{}{"ChannelId": channelId, "StartTime": startTime, "EndTime": endTime}
		var histories []*model.ChannelMemberHistory
		if _, err := s.GetReplica().Select(&histories, query, params); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.GetUsersInChannelAt", "store.sql_channel_member_history.get_users_in_channel_during.app_error", params, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = histories
		}
	})
}

func (s SqlChannelMemberHistoryStore) PermanentDeleteBatch(endTime int64, limit int64) store.StoreChannel {
	// when the data retention job runs, it deletes ChannelMemberHistory records for all channels, but that's very
	// destructive while testing, so this helper function is used by data retention, but not tested, which allows the
	// PermanentDeleteBatchForChannel function to be unit tested on a more specific set of data
	return store.Do(func(result *store.StoreResult) {
		var channelIds []string
		var query = `SELECT DISTINCT ChannelId FROM ChannelMemberHistory`
		if _, err := s.GetReplica().Select(&channelIds, query, nil); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.PermanentDeleteBatch", "store.sql_channel_member_history.permanent_delete_batch.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		} else {
			var numDeleted int64
			for _, channelId := range channelIds {
				if res := <-s.PermanentDeleteBatchForChannel(channelId, endTime, limit-numDeleted); res.Err != nil {
					result.Err = model.NewAppError("SqlChannelMemberHistoryStore.PermanentDeleteBatch", "store.sql_channel_member_history.permanent_delete_batch.app_error", nil, err.Error(), http.StatusInternalServerError)
					return
				} else {
					numDeleted += res.Data.(int64)
				}
				if limit-numDeleted <= int64(0) {
					break
				}
			}
			result.Data = numDeleted
		}
	})
}

func (s SqlChannelMemberHistoryStore) PermanentDeleteBatchForChannel(channelId string, endTime int64, limit int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var query string
		if s.DriverName() == "postgres" {
			query =
				`DELETE FROM ChannelMemberHistory
				 WHERE ctid IN (
				 	SELECT ctid FROM ChannelMemberHistory
					WHERE ChannelId = :ChannelId
					AND LeaveTime IS NOT NULL
					AND LeaveTime <= :EndTime
					LIMIT :Limit
				);`
		} else {
			query =
				`DELETE FROM ChannelMemberHistory
				 WHERE ChannelId = :ChannelId
				 AND LeaveTime IS NOT NULL
				 AND LeaveTime <= :EndTime
				 LIMIT :Limit`
		}

		params := map[string]interface{}{"ChannelId": channelId, "EndTime": endTime, "Limit": limit}
		if sqlResult, err := s.GetMaster().Exec(query, params); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.PermanentDeleteBatchForChannel", "store.sql_channel_member_history.permanent_delete_batch.app_error", params, err.Error(), http.StatusInternalServerError)
		} else {
			if rowsAffected, err1 := sqlResult.RowsAffected(); err1 != nil {
				result.Err = model.NewAppError("SqlChannelMemberHistoryStore.PermanentDeleteBatchForChannel", "store.sql_channel_member_history.permanent_delete_batch.app_error", params, err.Error(), http.StatusInternalServerError)
				result.Data = int64(0)
			} else {
				result.Data = rowsAffected
			}
		}
	})
}
