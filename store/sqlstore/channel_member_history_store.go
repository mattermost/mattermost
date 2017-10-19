package sqlstore

import (
	"net/http"

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
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.LogJoinEvent", "store.sql_channel_member_history.log_join_event.app_error", map[string]interface{}{"ChannelMemberHistory": channelMemberHistory}, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlChannelMemberHistoryStore) LogLeaveEvent(userId string, channelId string, leaveTime int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := `
			SELECT
				cmh.*,
				u.Email
			FROM ChannelMemberHistory cmh
			INNER JOIN Users u ON cmh.UserId = u.Id
			WHERE cmh.UserId = :UserId
			AND cmh.ChannelId = :ChannelId
			AND cmh.LeaveTime IS NULL
			ORDER BY cmh.JoinTime ASC
			LIMIT 1`

		params := map[string]interface{}{"UserId": userId, "ChannelId": channelId}
		channelMemberHistory := new(model.ChannelMemberHistory)
		if err := s.GetReplica().SelectOne(&channelMemberHistory, query, params); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.LogLeaveEvent", "store.sql_channel_member_history.log_leave_event.select_error", params, err.Error(), http.StatusInternalServerError)
		} else {
			channelMemberHistory.LeaveTime = &leaveTime

			if _, err := s.GetMaster().Update(channelMemberHistory); err != nil {
				result.Err = model.NewAppError("SqlChannelMemberHistoryStore.LogLeaveEvent", "store.sql_channel_member_history.log_leave_event.update_error", map[string]interface{}{"ChannelMemberHistory": channelMemberHistory}, err.Error(), http.StatusInternalServerError)
			}
		}
	})
}

func (s SqlChannelMemberHistoryStore) GetUsersInChannelAt(time int64, channelId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := `
			SELECT
				cmh.*,
				u.Email
			FROM ChannelMemberHistory cmh
			INNER JOIN Users u ON cmh.UserId = u.Id
			WHERE cmh.ChannelId = :ChannelId
			AND cmh.JoinTime <= :AtTime
			AND (cmh.LeaveTime IS NULL OR cmh.LeaveTime >= :AtTime)
			ORDER BY cmh.JoinTime ASC`

		params := map[string]interface{}{"ChannelId": channelId, "AtTime": time}
		var histories []*model.ChannelMemberHistory
		if _, err := s.GetReplica().Select(&histories, query, params); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.GetUsersInChannelAt", "store.sql_channel_member_history.get_users_in_channel_at.app_error", params, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = histories
		}
	})
}

func (s SqlChannelMemberHistoryStore) PurgeHistoryBefore(time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query := `
			DELETE FROM ChannelMemberHistory
			WHERE LeaveTime <= :AtTime`

		params := map[string]interface{}{"AtTime": time}
		if _, err := s.GetReplica().Exec(query, params); err != nil {
			result.Err = model.NewAppError("SqlChannelMemberHistoryStore.PurgeHistoryBefore", "store.sql_channel_member_history.purge_history_before.app_error", params, err.Error(), http.StatusInternalServerError)
		}
	})
}
