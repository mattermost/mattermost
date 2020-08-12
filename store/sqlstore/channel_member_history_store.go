// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/pkg/errors"
)

type SqlChannelMemberHistoryStore struct {
	SqlStore
}

func newSqlChannelMemberHistoryStore(sqlStore SqlStore) store.ChannelMemberHistoryStore {
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

func (s SqlChannelMemberHistoryStore) LogJoinEvent(userId string, channelId string, joinTime int64) error {
	channelMemberHistory := &model.ChannelMemberHistory{
		UserId:    userId,
		ChannelId: channelId,
		JoinTime:  joinTime,
	}

	if err := s.GetMaster().Insert(channelMemberHistory); err != nil {
		return errors.Wrapf(err, "LogJoinEvent userId=%s channelId=%s joinTime=%d", userId, channelId, joinTime)
	}
	return nil
}

func (s SqlChannelMemberHistoryStore) LogLeaveEvent(userId string, channelId string, leaveTime int64) error {
	query := `
		UPDATE ChannelMemberHistory
		SET LeaveTime = :LeaveTime
		WHERE UserId = :UserId
		AND ChannelId = :ChannelId
		AND LeaveTime IS NULL`

	params := map[string]interface{}{"UserId": userId, "ChannelId": channelId, "LeaveTime": leaveTime}
	sqlResult, err := s.GetMaster().Exec(query, params)
	if err != nil {
		return errors.Wrapf(err, "LogLeaveEvent userId=%s channelId=%s leaveTime=%d", userId, channelId, leaveTime)
	}

	if rows, err := sqlResult.RowsAffected(); err == nil && rows != 1 {
		// there was no join event to update - this is best effort, so no need to raise an error
		mlog.Warn("Channel join event for user and channel not found", mlog.String("user", userId), mlog.String("channel", channelId))
	}
	return nil
}

func (s SqlChannelMemberHistoryStore) GetUsersInChannelDuring(startTime int64, endTime int64, channelId string) ([]*model.ChannelMemberHistoryResult, error) {
	useChannelMemberHistory, err := s.hasDataAtOrBefore(startTime)
	if err != nil {
		return nil, errors.Wrapf(err, "hasDataAtOrBefore startTime=%d endTime=%d channelId=%s", startTime, endTime, channelId)
	}

	if useChannelMemberHistory {
		// the export period starts after the ChannelMemberHistory table was first introduced, so we can use the
		// data from it for our export
		channelMemberHistories, err2 := s.getFromChannelMemberHistoryTable(startTime, endTime, channelId)
		if err2 != nil {
			return nil, errors.Wrapf(err2, "getFromChannelMemberHistoryTable startTime=%d endTime=%d channelId=%s", startTime, endTime, channelId)
		}
		return channelMemberHistories, nil
	}

	// the export period starts before the ChannelMemberHistory table was introduced, so we need to fake the
	// data by assuming that anybody who has ever joined the channel in question was present during the export period.
	// this may not always be true, but it's better than saying that somebody wasn't there when they were
	channelMemberHistories, err := s.getFromChannelMembersTable(startTime, endTime, channelId)
	if err != nil {
		return nil, errors.Wrapf(err, "getFromChannelMembersTable startTime=%d endTime=%d channelId=%s", startTime, endTime, channelId)
	}
	return channelMemberHistories, nil
}

func (s SqlChannelMemberHistoryStore) hasDataAtOrBefore(time int64) (bool, error) {
	type NullableCountResult struct {
		Min sql.NullInt64
	}
	var result NullableCountResult
	query := "SELECT MIN(JoinTime) AS Min FROM ChannelMemberHistory"
	if err := s.GetReplica().SelectOne(&result, query); err != nil {
		return false, err
	} else if result.Min.Valid {
		return result.Min.Int64 <= time, nil
	} else {
		// if the result was null, there are no rows in the table, so there is no data from before
		return false, nil
	}
}

func (s SqlChannelMemberHistoryStore) getFromChannelMemberHistoryTable(startTime int64, endTime int64, channelId string) ([]*model.ChannelMemberHistoryResult, error) {
	query := `
			SELECT
				cmh.*,
				u.Email,
				u.Username,
				Bots.UserId IS NOT NULL AS IsBot,
				u.DeleteAt AS UserDeleteAt
			FROM ChannelMemberHistory cmh
			INNER JOIN Users u ON cmh.UserId = u.Id
			LEFT JOIN Bots ON Bots.UserId = u.Id
			WHERE cmh.ChannelId = :ChannelId
			AND cmh.JoinTime <= :EndTime
			AND (cmh.LeaveTime IS NULL OR cmh.LeaveTime >= :StartTime)
			ORDER BY cmh.JoinTime ASC`

	params := map[string]interface{}{"ChannelId": channelId, "StartTime": startTime, "EndTime": endTime}
	var histories []*model.ChannelMemberHistoryResult
	if _, err := s.GetReplica().Select(&histories, query, params); err != nil {
		return nil, err
	}

	return histories, nil
}

func (s SqlChannelMemberHistoryStore) getFromChannelMembersTable(startTime int64, endTime int64, channelId string) ([]*model.ChannelMemberHistoryResult, error) {
	query := `
		SELECT DISTINCT
			ch.ChannelId,
			ch.UserId,
			u.Email,
			u.Username,
		    Bots.UserId IS NOT NULL AS IsBot,
			u.DeleteAt AS UserDeleteAt
		FROM ChannelMembers AS ch
		INNER JOIN Users AS u ON ch.UserId = u.id
		LEFT JOIN Bots ON Bots.UserId = u.Id
		WHERE ch.ChannelId = :ChannelId`

	params := map[string]interface{}{"ChannelId": channelId}
	var histories []*model.ChannelMemberHistoryResult
	if _, err := s.GetReplica().Select(&histories, query, params); err != nil {
		return nil, err
	}
	// we have to fill in the join/leave times, because that data doesn't exist in the channel members table
	for _, channelMemberHistory := range histories {
		channelMemberHistory.JoinTime = startTime
		channelMemberHistory.LeaveTime = model.NewInt64(endTime)
	}
	return histories, nil
}

func (s SqlChannelMemberHistoryStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query =
			`DELETE FROM ChannelMemberHistory
				 WHERE ctid IN (
					SELECT ctid FROM ChannelMemberHistory
					WHERE LeaveTime IS NOT NULL
					AND LeaveTime <= :EndTime
					LIMIT :Limit
				);`
	} else {
		query =
			`DELETE FROM ChannelMemberHistory
				 WHERE LeaveTime IS NOT NULL
				 AND LeaveTime <= :EndTime
				 LIMIT :Limit`
	}

	params := map[string]interface{}{"EndTime": endTime, "Limit": limit}
	sqlResult, err := s.GetMaster().Exec(query, params)
	if err != nil {
		return 0, errors.Wrapf(err, "PermanentDeleteBatch endTime=%d limit=%d", endTime, limit)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrapf(err, "PermanentDeleteBatch endTime=%d limit=%d", endTime, limit)
	}
	return rowsAffected, nil
}
