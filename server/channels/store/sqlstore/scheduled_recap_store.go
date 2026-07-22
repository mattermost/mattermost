// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

var scheduledRecapColumns = []string{
	"Id", "UserId", "Title",
	"DaysOfWeek", "TimeOfDay", "Timezone", "TimePeriod",
	"NextRunAt", "LastRunAt", "RunCount",
	"ChannelMode", "ChannelIds",
	"CustomInstructions", "AgentId",
	"IsRecurring", "Enabled",
	"CreateAt", "UpdateAt", "DeleteAt",
}

type SqlScheduledRecapStore struct {
	*SqlStore
	selectQuery sq.SelectBuilder
}

func newSqlScheduledRecapStore(sqlStore *SqlStore) store.ScheduledRecapStore {
	s := &SqlScheduledRecapStore{
		SqlStore: sqlStore,
	}
	s.selectQuery = s.getQueryBuilder().
		Select(scheduledRecapColumns...).
		From("ScheduledRecaps")
	return s
}

// toMap converts a ScheduledRecap to a map for INSERT/UPDATE operations.
// ChannelIds is a Postgres jsonb column; model.StringArray serializes it via
// driver.Valuer, so no manual JSON marshaling is needed here.
func (s *SqlScheduledRecapStore) toMap(sr *model.ScheduledRecap) map[string]any {
	return map[string]any{
		"Id":                 sr.Id,
		"UserId":             sr.UserId,
		"Title":              sr.Title,
		"DaysOfWeek":         sr.DaysOfWeek,
		"TimeOfDay":          sr.TimeOfDay,
		"Timezone":           sr.Timezone,
		"TimePeriod":         sr.TimePeriod,
		"NextRunAt":          sr.NextRunAt,
		"LastRunAt":          sr.LastRunAt,
		"RunCount":           sr.RunCount,
		"ChannelMode":        sr.ChannelMode,
		"ChannelIds":         sr.ChannelIds,
		"CustomInstructions": sr.CustomInstructions,
		"AgentId":            sr.AgentId,
		"IsRecurring":        sr.IsRecurring,
		"Enabled":            sr.Enabled,
		"CreateAt":           sr.CreateAt,
		"UpdateAt":           sr.UpdateAt,
		"DeleteAt":           sr.DeleteAt,
	}
}

// Save inserts a new ScheduledRecap into the database.
func (s *SqlScheduledRecapStore) Save(scheduledRecap *model.ScheduledRecap) (*model.ScheduledRecap, error) {
	if err := s.saveWithExecutor(s.GetMaster(), scheduledRecap); err != nil {
		return nil, err
	}

	return scheduledRecap, nil
}

func (s *SqlScheduledRecapStore) SaveIfUnderLimit(scheduledRecap *model.ScheduledRecap, limit int) (*model.ScheduledRecap, error) {
	// SERIALIZABLE prevents the COUNT/INSERT check from racing under READ COMMITTED;
	// the retry layer retries the serialization failures this can surface.
	tx, err := s.GetMaster().BeginWithIsolation(&sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin transaction for SaveIfUnderLimit")
	}
	defer finalizeTransactionX(tx, &err)

	count, err := s.countForUserWithExecutor(tx, scheduledRecap.UserId)
	if err != nil {
		return nil, err
	}
	if count >= int64(limit) {
		return nil, store.NewErrLimitExceeded("scheduled_recaps_per_user", int(count), "userId="+scheduledRecap.UserId)
	}

	if err = s.saveWithExecutor(tx, scheduledRecap); err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit transaction for SaveIfUnderLimit")
	}

	return scheduledRecap, nil
}

func (s *SqlScheduledRecapStore) saveWithExecutor(executor sqlxExecutor, scheduledRecap *model.ScheduledRecap) error {
	query := s.getQueryBuilder().
		Insert("ScheduledRecaps").
		SetMap(s.toMap(scheduledRecap))

	if _, err := executor.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to save ScheduledRecap")
	}

	return nil
}

// Get retrieves a ScheduledRecap by ID.
func (s *SqlScheduledRecapStore) Get(id string) (*model.ScheduledRecap, error) {
	var sr model.ScheduledRecap
	query := s.selectQuery.Where(sq.Eq{"Id": id, "DeleteAt": 0})

	if err := s.GetReplica().GetBuilder(&sr, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ScheduledRecap", id)
		}
		return nil, errors.Wrapf(err, "failed to get ScheduledRecap with id=%s", id)
	}

	return &sr, nil
}

// Update updates an existing ScheduledRecap.
func (s *SqlScheduledRecapStore) Update(scheduledRecap *model.ScheduledRecap) (*model.ScheduledRecap, error) {
	scheduledRecap.PreUpdate()

	query := s.getQueryBuilder().
		Update("ScheduledRecaps").
		SetMap(map[string]any{
			"Title":              scheduledRecap.Title,
			"DaysOfWeek":         scheduledRecap.DaysOfWeek,
			"TimeOfDay":          scheduledRecap.TimeOfDay,
			"Timezone":           scheduledRecap.Timezone,
			"TimePeriod":         scheduledRecap.TimePeriod,
			"NextRunAt":          scheduledRecap.NextRunAt,
			"LastRunAt":          scheduledRecap.LastRunAt,
			"RunCount":           scheduledRecap.RunCount,
			"ChannelMode":        scheduledRecap.ChannelMode,
			"ChannelIds":         scheduledRecap.ChannelIds,
			"CustomInstructions": scheduledRecap.CustomInstructions,
			"AgentId":            scheduledRecap.AgentId,
			"IsRecurring":        scheduledRecap.IsRecurring,
			"Enabled":            scheduledRecap.Enabled,
			"UpdateAt":           scheduledRecap.UpdateAt,
		}).
		Where(sq.Eq{"Id": scheduledRecap.Id, "DeleteAt": 0})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update ScheduledRecap with id=%s", scheduledRecap.Id)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to retrieve affected rows for ScheduledRecap update")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("ScheduledRecap", scheduledRecap.Id)
	}

	return scheduledRecap, nil
}

// Delete performs a soft delete by setting DeleteAt.
func (s *SqlScheduledRecapStore) Delete(id string) error {
	deleteAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("ScheduledRecaps").
		SetMap(map[string]any{
			"DeleteAt": deleteAt,
			"UpdateAt": deleteAt,
		}).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to delete ScheduledRecap with id=%s", id)
	}

	return nil
}

// GetForUser retrieves paginated ScheduledRecaps for a user (excluding soft-deleted).
func (s *SqlScheduledRecapStore) GetForUser(userId string, page, perPage int) ([]*model.ScheduledRecap, error) {
	offset := page * perPage
	recaps := []*model.ScheduledRecap{}

	query := s.selectQuery.
		Where(sq.Eq{"UserId": userId, "DeleteAt": 0}).
		OrderBy("CreateAt DESC").
		Limit(uint64(perPage)).
		Offset(uint64(offset))

	if err := s.GetReplica().SelectBuilder(&recaps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get ScheduledRecaps for userId=%s", userId)
	}

	return recaps, nil
}

// GetDueBefore retrieves enabled, non-deleted ScheduledRecaps that are due before the given timestamp.
// It reads from master so the scheduler does not enqueue from replica-lagged NextRunAt values.
// Results are ordered by NextRunAt ASC to process oldest first.
func (s *SqlScheduledRecapStore) GetDueBefore(timestamp int64, limit int) ([]*model.ScheduledRecap, error) {
	recaps := []*model.ScheduledRecap{}

	query := s.selectQuery.
		Where(sq.Eq{"Enabled": true, "DeleteAt": 0}).
		Where(sq.LtOrEq{"NextRunAt": timestamp}).
		OrderBy("NextRunAt ASC").
		Limit(uint64(limit))

	if err := s.GetMaster().SelectBuilder(&recaps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get due ScheduledRecaps before timestamp=%d", timestamp)
	}

	return recaps, nil
}

// UpdateNextRunAt updates only the NextRunAt field (and UpdateAt).
func (s *SqlScheduledRecapStore) UpdateNextRunAt(id string, nextRunAt int64) error {
	updateAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("ScheduledRecaps").
		SetMap(map[string]any{
			"NextRunAt": nextRunAt,
			"UpdateAt":  updateAt,
		}).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to update NextRunAt for ScheduledRecap id=%s", id)
	}

	return nil
}

// MarkExecuted updates LastRunAt, NextRunAt, increments RunCount, and sets UpdateAt.
func (s *SqlScheduledRecapStore) MarkExecuted(id string, lastRunAt int64, nextRunAt int64) error {
	updateAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("ScheduledRecaps").
		Set("LastRunAt", lastRunAt).
		Set("NextRunAt", nextRunAt).
		Set("RunCount", sq.Expr("RunCount + 1")).
		Set("UpdateAt", updateAt).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to mark ScheduledRecap as executed for id=%s", id)
	}

	return nil
}

// CountForUser returns count of active (non-deleted, enabled) scheduled recaps for a user.
func (s *SqlScheduledRecapStore) CountForUser(userId string) (int64, error) {
	return s.countForUserWithExecutor(s.GetReplica(), userId)
}

func (s *SqlScheduledRecapStore) countForUserWithExecutor(executor sqlxExecutor, userId string) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ScheduledRecaps").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"Enabled": true})

	var count int64
	err := executor.GetBuilder(&count, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count scheduled recaps for user")
	}
	return count, nil
}

// SetEnabled updates only the Enabled field (and UpdateAt).
func (s *SqlScheduledRecapStore) SetEnabled(id string, enabled bool) error {
	updateAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("ScheduledRecaps").
		SetMap(map[string]any{
			"Enabled":  enabled,
			"UpdateAt": updateAt,
		}).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to set Enabled=%v for ScheduledRecap id=%s", enabled, id)
	}

	return nil
}
