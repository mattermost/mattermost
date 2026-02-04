// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlStatusLogStore struct {
	*SqlStore
}

func newSqlStatusLogStore(sqlStore *SqlStore) store.StatusLogStore {
	return &SqlStatusLogStore{
		SqlStore: sqlStore,
	}
}

// Save stores a new status log entry.
func (s *SqlStatusLogStore) Save(log *model.StatusLog) error {
	query := s.getQueryBuilder().
		Insert("statuslogs").
		Columns(
			"id",
			"createat",
			"userid",
			"username",
			"oldstatus",
			"newstatus",
			"reason",
			"windowactive",
			"channelid",
			"device",
			"logtype",
			"trigger",
			"manual",
			"source",
			"lastactivityat",
		).
		Values(
			log.Id,
			log.CreateAt,
			log.UserID,
			log.Username,
			log.OldStatus,
			log.NewStatus,
			log.Reason,
			log.WindowActive,
			log.ChannelID,
			log.Device,
			log.LogType,
			log.Trigger,
			log.Manual,
			log.Source,
			log.LastActivityAt,
		)

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to save StatusLog")
	}

	return nil
}

// Get retrieves status logs with filtering and pagination.
func (s *SqlStatusLogStore) Get(options model.StatusLogGetOptions) ([]*model.StatusLog, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"createat",
			"userid",
			"username",
			"oldstatus",
			"newstatus",
			"reason",
			"windowactive",
			"channelid",
			"device",
			"logtype",
			"trigger",
			"manual",
			"source",
			"lastactivityat",
		).
		From("statuslogs").
		OrderBy("createat DESC")

	// Apply filters
	if options.UserID != "" {
		query = query.Where(sq.Eq{"userid": options.UserID})
	}
	if options.Username != "" {
		query = query.Where(sq.ILike{"username": options.Username})
	}
	if options.LogType != "" {
		query = query.Where(sq.Eq{"logtype": options.LogType})
	}
	if options.Status != "" {
		query = query.Where(sq.Eq{"newstatus": options.Status})
	}
	if options.Since > 0 {
		query = query.Where(sq.GtOrEq{"createat": options.Since})
	}
	if options.Until > 0 {
		query = query.Where(sq.LtOrEq{"createat": options.Until})
	}
	if options.Search != "" {
		// Search across username, reason, and trigger fields
		searchPattern := "%" + options.Search + "%"
		query = query.Where(sq.Or{
			sq.ILike{"username": searchPattern},
			sq.ILike{"reason": searchPattern},
			sq.ILike{"trigger": searchPattern},
		})
	}

	// Apply pagination
	if options.PerPage > 0 {
		query = query.Limit(uint64(options.PerPage))
		if options.Page > 0 {
			query = query.Offset(uint64(options.Page * options.PerPage))
		}
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_log_get_tosql")
	}

	var logs []*model.StatusLog
	if err := s.GetReplica().Select(&logs, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get StatusLogs")
	}

	return logs, nil
}

// GetCount returns the total count of logs matching the filter options.
func (s *SqlStatusLogStore) GetCount(options model.StatusLogGetOptions) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("statuslogs")

	// Apply filters (same as Get, excluding pagination)
	if options.UserID != "" {
		query = query.Where(sq.Eq{"userid": options.UserID})
	}
	if options.Username != "" {
		query = query.Where(sq.ILike{"username": options.Username})
	}
	if options.LogType != "" {
		query = query.Where(sq.Eq{"logtype": options.LogType})
	}
	if options.Status != "" {
		query = query.Where(sq.Eq{"newstatus": options.Status})
	}
	if options.Since > 0 {
		query = query.Where(sq.GtOrEq{"createat": options.Since})
	}
	if options.Until > 0 {
		query = query.Where(sq.LtOrEq{"createat": options.Until})
	}
	if options.Search != "" {
		searchPattern := "%" + options.Search + "%"
		query = query.Where(sq.Or{
			sq.ILike{"username": searchPattern},
			sq.ILike{"reason": searchPattern},
			sq.ILike{"trigger": searchPattern},
		})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "status_log_get_count_tosql")
	}

	var count int64
	if err := s.GetReplica().Get(&count, queryString, args...); err != nil {
		return 0, errors.Wrap(err, "failed to get StatusLog count")
	}

	return count, nil
}

// GetStats returns statistics about status changes (counts by status type).
func (s *SqlStatusLogStore) GetStats(options model.StatusLogGetOptions) (map[string]int64, error) {
	// Build base conditions
	conditions := sq.And{sq.Eq{"logtype": model.StatusLogTypeStatusChange}}
	if options.Since > 0 {
		conditions = append(conditions, sq.GtOrEq{"createat": options.Since})
	}
	if options.Until > 0 {
		conditions = append(conditions, sq.LtOrEq{"createat": options.Until})
	}
	if options.UserID != "" {
		conditions = append(conditions, sq.Eq{"userid": options.UserID})
	}
	if options.Username != "" {
		conditions = append(conditions, sq.ILike{"username": options.Username})
	}
	if options.Search != "" {
		searchPattern := "%" + options.Search + "%"
		conditions = append(conditions, sq.Or{
			sq.ILike{"username": searchPattern},
			sq.ILike{"reason": searchPattern},
			sq.ILike{"trigger": searchPattern},
		})
	}

	// Get total count
	totalQuery, totalArgs, err := s.getQueryBuilder().
		Select("COUNT(*)").
		From("statuslogs").
		Where(conditions).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_log_stats_total_tosql")
	}

	var total int64
	if err := s.GetReplica().Get(&total, totalQuery, totalArgs...); err != nil {
		return nil, errors.Wrap(err, "failed to get total count for stats")
	}

	// Get counts by new status
	statsQuery, statsArgs, err := s.getQueryBuilder().
		Select("newstatus", "COUNT(*) as count").
		From("statuslogs").
		Where(conditions).
		GroupBy("newstatus").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_log_stats_by_status_tosql")
	}

	type statusCount struct {
		NewStatus string `db:"newstatus"`
		Count     int64  `db:"count"`
	}

	var counts []statusCount
	if err := s.GetReplica().Select(&counts, statsQuery, statsArgs...); err != nil {
		return nil, errors.Wrap(err, "failed to get status counts")
	}

	// Build result map
	stats := map[string]int64{
		"total":   total,
		"online":  0,
		"away":    0,
		"dnd":     0,
		"offline": 0,
	}

	for _, c := range counts {
		switch c.NewStatus {
		case model.StatusOnline:
			stats["online"] = c.Count
		case model.StatusAway:
			stats["away"] = c.Count
		case model.StatusDnd:
			stats["dnd"] = c.Count
		case model.StatusOffline:
			stats["offline"] = c.Count
		}
	}

	return stats, nil
}

// DeleteOlderThan removes all logs older than the given timestamp.
func (s *SqlStatusLogStore) DeleteOlderThan(timestamp int64) (int64, error) {
	query := s.getQueryBuilder().
		Delete("statuslogs").
		Where(sq.Lt{"createat": timestamp})

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "status_log_delete_older_tosql")
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete old StatusLogs")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to get rows affected")
	}

	return rowsAffected, nil
}

// DeleteAll removes all status logs.
func (s *SqlStatusLogStore) DeleteAll() error {
	query := s.getQueryBuilder().
		Delete("statuslogs")

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "status_log_delete_all_tosql")
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to delete all StatusLogs")
	}

	return nil
}
