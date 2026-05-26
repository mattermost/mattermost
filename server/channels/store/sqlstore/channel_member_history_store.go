// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelMemberHistoryStore struct {
	*SqlStore

	channelMemberHistoryQuery sq.SelectBuilder
}

func newSqlChannelMemberHistoryStore(sqlStore *SqlStore) store.ChannelMemberHistoryStore {
	s := &SqlChannelMemberHistoryStore{
		SqlStore: sqlStore,
	}

	s.channelMemberHistoryQuery = s.getQueryBuilder().
		Select(
			"ChannelMemberHistory.ChannelId",
			"ChannelMemberHistory.UserId",
			"ChannelMemberHistory.JoinTime",
			"ChannelMemberHistory.LeaveTime",
		).
		From("ChannelMemberHistory")

	return s
}

func (s SqlChannelMemberHistoryStore) LogJoinEvent(userId string, channelId string, joinTime int64) error {
	channelMemberHistory := &model.ChannelMemberHistory{
		UserId:    userId,
		ChannelId: channelId,
		JoinTime:  joinTime,
	}

	if _, err := s.GetMaster().NamedExec(`INSERT INTO ChannelMemberHistory
		(UserId, ChannelId, JoinTime)
		VALUES
		(:UserId, :ChannelId, :JoinTime)`, channelMemberHistory); err != nil {
		return fmt.Errorf("LogJoinEvent userId=%s channelId=%s joinTime=%d: %w", userId, channelId, joinTime, err)
	}
	return nil
}

func (s SqlChannelMemberHistoryStore) LogLeaveEvent(userId string, channelId string, leaveTime int64) error {
	query, params, err := s.getQueryBuilder().
		Update("ChannelMemberHistory").
		Set("LeaveTime", leaveTime).
		Where(sq.And{
			sq.Eq{"UserId": userId},
			sq.Eq{"ChannelId": channelId},
			sq.Eq{"LeaveTime": nil},
		}).ToSql()
	if err != nil {
		return fmt.Errorf("channel_member_history_to_sql: %w", err)
	}
	sqlResult, err := s.GetMaster().Exec(query, params...)
	if err != nil {
		return fmt.Errorf("LogLeaveEvent userId=%s channelId=%s leaveTime=%d: %w", userId, channelId, leaveTime, err)
	}

	if rows, err := sqlResult.RowsAffected(); err == nil && rows != 1 {
		// there was no join event to update - this is best effort, so no need to raise an error
		mlog.Warn("Channel join event for user and channel not found", mlog.String("user", userId), mlog.String("channel", channelId))
	}
	return nil
}

// GetEverMembersInChannel returns user IDs that have at least one membership history row in the channel.
func (s SqlChannelMemberHistoryStore) GetEverMembersInChannel(channelID string, userIDs []string) ([]string, error) {
	if len(userIDs) == 0 {
		return []string{}, nil
	}

	query, args, err := s.getQueryBuilder().
		Select("UserId").
		Distinct().
		From("ChannelMemberHistory").
		Where(sq.And{
			sq.Eq{"ChannelId": channelID},
			sq.Eq{"UserId": userIDs},
		}).
		OrderBy("UserId ASC").
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}

	everMembers := []string{}
	if err := s.GetReplica().Select(&everMembers, query, args...); err != nil {
		return nil, fmt.Errorf("GetEverMembersInChannel channelId=%s users=%d: %w", channelID, len(userIDs), err)
	}

	return everMembers, nil
}

func (s SqlChannelMemberHistoryStore) GetChannelsWithActivityDuring(startTime int64, endTime int64) ([]string, error) {
	// ChannelMemberHistory has been in production for long enough that we are assuming the export period
	// starts after the ChannelMemberHistory table was first introduced
	subqueryPosts := s.getSubQueryBuilder().
		Select("p.ChannelId AS ChannelId").
		Distinct().
		From("Posts AS p").
		Where(
			sq.And{
				sq.GtOrEq{"p.UpdateAt": startTime},
				sq.LtOrEq{"p.UpdateAt": endTime},
				sq.NotLike{"p.Type": "system_%"},
			})

	subqueryCMH := s.getSubQueryBuilder().
		Select("cmh.ChannelId AS ChannelId").
		Distinct().
		From("ChannelMemberHistory AS cmh").
		Where(
			sq.Or{
				sq.And{
					sq.GtOrEq{"cmh.JoinTime": startTime},
					sq.LtOrEq{"cmh.JoinTime": endTime},
				},
				sq.And{
					sq.GtOrEq{"cmh.LeaveTime": startTime},
					sq.LtOrEq{"cmh.LeaveTime": endTime},
				},
			})

	unionExpr, args, err := sq.Expr("(? UNION ?) AS cm", subqueryPosts, subqueryCMH).ToSql()
	if err != nil {
		return nil, fmt.Errorf("GetChannelsWithActivityDuring unionExpr to sql: %w", err)
	}

	query, _, err := s.getQueryBuilder().
		Select("ChannelId").
		From(unionExpr).ToSql()
	if err != nil {
		return nil, fmt.Errorf("GetChannelsWithActivityDuring query to sql: %w", err)
	}

	channelIds := make([]string, 0)
	if err := s.GetReplica().Select(&channelIds, query, args...); err != nil {
		return nil, err
	}

	return channelIds, nil
}

func (s SqlChannelMemberHistoryStore) GetUsersInChannelDuring(startTime int64, endTime int64, channelIds []string) ([]*model.ChannelMemberHistoryResult, error) {
	useChannelMemberHistory, err := s.hasDataAtOrBefore(startTime)
	if err != nil {
		return nil, fmt.Errorf("hasDataAtOrBefore startTime=%d endTime=%d channelId=%v: %w", startTime, endTime, channelIds, err)
	}

	if useChannelMemberHistory {
		// the export period starts after the ChannelMemberHistory table was first introduced, so we can use the
		// data from it for our export
		channelMemberHistories, err2 := s.getFromChannelMemberHistoryTable(startTime, endTime, channelIds)
		if err2 != nil {
			return nil, fmt.Errorf("getFromChannelMemberHistoryTable startTime=%d endTime=%d channelId=%v: %w", startTime, endTime, channelIds, err2)
		}
		return channelMemberHistories, nil
	}
	// the export period starts before the ChannelMemberHistory table was introduced, so we need to fake the
	// data by assuming that anybody who has ever joined the channel in question was present during the export period.
	// this may not always be true, but it's better than saying that somebody wasn't there when they were
	channelMemberHistories, err := s.getFromChannelMembersTable(startTime, endTime, channelIds)
	if err != nil {
		return nil, fmt.Errorf("getFromChannelMembersTable startTime=%d endTime=%d channelId=%v: %w", startTime, endTime, channelIds, err)
	}
	return channelMemberHistories, nil
}

func (s SqlChannelMemberHistoryStore) hasDataAtOrBefore(time int64) (bool, error) {
	type NullableCountResult struct {
		Min sql.NullInt64
	}
	query, _, err := s.getQueryBuilder().Select("MIN(JoinTime) as Min").From("ChannelMemberHistory").ToSql()
	if err != nil {
		return false, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}
	var result NullableCountResult
	if err := s.GetReplica().Get(&result, query); err != nil {
		return false, err
	} else if result.Min.Valid {
		return result.Min.Int64 <= time, nil
	}
	// if the result was null, there are no rows in the table, so there is no data from before
	return false, nil
}

func (s SqlChannelMemberHistoryStore) getFromChannelMemberHistoryTable(startTime int64, endTime int64, channelIds []string) ([]*model.ChannelMemberHistoryResult, error) {
	query := s.channelMemberHistoryQuery.
		Column("u.Email AS \"Email\"").
		Column("u.Username").
		Column("Bots.UserId IS NOT NULL AS IsBot").
		Column("u.DeleteAt AS UserDeleteAt").
		Join("Users u ON ChannelMemberHistory.UserId = u.Id").
		LeftJoin("Bots ON Bots.UserId = u.Id").
		Where(sq.And{
			sq.Eq{"ChannelMemberHistory.ChannelId": channelIds},
			sq.LtOrEq{"ChannelMemberHistory.JoinTime": endTime},
			sq.Or{
				sq.Eq{"ChannelMemberHistory.LeaveTime": nil},
				sq.GtOrEq{"ChannelMemberHistory.LeaveTime": startTime},
			},
		}).
		OrderBy("ChannelMemberHistory.JoinTime ASC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}

	histories := []*model.ChannelMemberHistoryResult{}
	if err := s.GetReplica().Select(&histories, queryString, args...); err != nil {
		return nil, err
	}

	return histories, nil
}

func (s SqlChannelMemberHistoryStore) getFromChannelMembersTable(startTime int64, endTime int64, channelIds []string) ([]*model.ChannelMemberHistoryResult, error) {
	query, args, err := s.getQueryBuilder().
		Select(`ch.ChannelId, ch.UserId, u.Email AS "Email", u.Username, Bots.UserId IS NOT NULL AS IsBot, u.DeleteAt AS UserDeleteAt`).
		Distinct().
		From("ChannelMembers ch").
		Join("Users u ON ch.UserId = u.id").
		LeftJoin("Bots ON Bots.UserId = u.id").
		Where(sq.Eq{"ch.ChannelId": channelIds}).ToSql()
	if err != nil {
		return nil, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}

	histories := []*model.ChannelMemberHistoryResult{}
	if err := s.GetReplica().Select(&histories, query, args...); err != nil {
		return nil, err
	}
	// we have to fill in the join/leave times, because that data doesn't exist in the channel members table
	for _, channelMemberHistory := range histories {
		channelMemberHistory.JoinTime = startTime
		channelMemberHistory.LeaveTime = new(endTime)
	}
	return histories, nil
}

// PermanentDeleteBatchForRetentionPolicies deletes a batch of records which are affected by
// the global or a granular retention policy.
// See `genericPermanentDeleteBatchForRetentionPolicies` for details.
func (s SqlChannelMemberHistoryStore) PermanentDeleteBatchForRetentionPolicies(retentionPolicyBatchConfigs model.RetentionPolicyBatchConfigs, cursor model.RetentionPolicyCursor) (int64, model.RetentionPolicyCursor, error) {
	builder := s.getQueryBuilder().
		Select("ChannelMemberHistory.ChannelId, ChannelMemberHistory.UserId, ChannelMemberHistory.JoinTime").
		From("ChannelMemberHistory")
	return genericPermanentDeleteBatchForRetentionPolicies(RetentionPolicyBatchDeletionInfo{
		BaseBuilder:         builder,
		Table:               "ChannelMemberHistory",
		TimeColumn:          "LeaveTime",
		PrimaryKeys:         []string{"ChannelId", "UserId", "JoinTime"},
		ChannelIDTable:      "ChannelMemberHistory",
		NowMillis:           retentionPolicyBatchConfigs.Now,
		GlobalPolicyEndTime: retentionPolicyBatchConfigs.GlobalPolicyEndTime,
		Limit:               retentionPolicyBatchConfigs.Limit,
		StoreDeletedIds:     false,
	}, s.SqlStore, cursor)
}

// DeleteOrphanedRows removes entries from ChannelMemberHistory when a corresponding channel no longer exists.
func (s SqlChannelMemberHistoryStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	const query = `
	DELETE FROM ChannelMemberHistory WHERE ctid IN (
		SELECT ChannelMemberHistory.ctid FROM ChannelMemberHistory
		LEFT JOIN Channels ON ChannelMemberHistory.ChannelId = Channels.Id
		WHERE Channels.Id IS NULL
		LIMIT $1
	)`
	result, err := s.GetMaster().Exec(query, limit)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}

func (s SqlChannelMemberHistoryStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	innerSelect, args, err := s.getQueryBuilder().
		Select("ctid").
		From("ChannelMemberHistory").
		Where(sq.And{
			sq.NotEq{"LeaveTime": nil},
			sq.LtOrEq{"LeaveTime": endTime},
		}).Limit(uint64(limit)).
		ToSql()
	if err != nil {
		return 0, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}
	query, _, err := s.getQueryBuilder().
		Delete("ChannelMemberHistory").
		Where(fmt.Sprintf(
			"ctid IN (%s)", innerSelect,
		)).ToSql()
	if err != nil {
		return 0, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}
	sqlResult, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return 0, fmt.Errorf("PermanentDeleteBatch endTime=%d limit=%d: %w", endTime, limit, err)
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("PermanentDeleteBatch endTime=%d limit=%d: %w", endTime, limit, err)
	}
	return rowsAffected, nil
}

// GetMembershipChanges returns all membership events (joins and leaves) for a channel since the given timestamp.
// Uses inclusive comparison (>=) so events at the cursor timestamp are re-fetched rather than lost at batch
// boundaries. This may cause redundant re-sends when consecutive batches share a boundary timestamp, but the
// receiver is idempotent so duplicates are harmless. A composite cursor (timestamp + ID) like posts use would
// eliminate duplicates, but would require a schema change to SharedChannelRemotes; the current trade-off avoids that.
func (s SqlChannelMemberHistoryStore) GetMembershipChanges(channelID string, since int64, limit int) ([]*model.ChannelMemberHistory, error) {
	query, args, err := s.getQueryBuilder().
		Select("ChannelId", "UserId", "JoinTime", "LeaveTime").
		From("ChannelMemberHistory").
		Where(sq.And{
			sq.Eq{"ChannelId": channelID},
			sq.Or{
				sq.GtOrEq{"JoinTime": since},
				sq.And{
					sq.NotEq{"LeaveTime": nil},
					sq.GtOrEq{"LeaveTime": since},
				},
			},
		}).
		OrderBy("GREATEST(JoinTime, COALESCE(LeaveTime, 0)) ASC", "UserId ASC").
		Limit(uint64(limit)).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}

	histories := []*model.ChannelMemberHistory{}
	if err := s.GetReplica().Select(&histories, query, args...); err != nil {
		return nil, fmt.Errorf("GetMembershipChanges channelId=%s since=%d limit=%d: %w", channelID, since, limit, err)
	}

	return histories, nil
}

// GetChannelsLeftSince returns list of channels that the user has left after a given time,
// but has not rejoined again.
func (s SqlChannelMemberHistoryStore) GetChannelsLeftSince(userID string, since int64) ([]string, error) {
	query, params, err := s.getQueryBuilder().
		Select("ChannelId").
		From("ChannelMemberHistory").
		GroupBy("ChannelId").
		Where(sq.Eq{"UserId": userID}).
		Having("MAX(LeaveTime) > MAX(JoinTime) AND MAX(LeaveTime) IS NOT NULL AND MAX(LeaveTime) >= ?", since).ToSql()
	if err != nil {
		return nil, fmt.Errorf("channel_member_history_to_sql: %w", err)
	}
	channelIds := []string{}
	err = s.GetReplica().Select(&channelIds, query, params...)
	if err != nil {
		return nil, fmt.Errorf("GetChannelsLeftSince userId=%s since=%d: %w", userID, since, err)
	}

	return channelIds, nil
}
