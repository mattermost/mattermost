// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

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
// ChannelIds is serialized as JSON.
func (s *SqlScheduledRecapStore) toMap(sr *model.ScheduledRecap) map[string]any {
	channelIdsJSON, _ := json.Marshal(sr.ChannelIds)
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
		"ChannelIds":         string(channelIdsJSON),
		"CustomInstructions": sr.CustomInstructions,
		"AgentId":            sr.AgentId,
		"IsRecurring":        sr.IsRecurring,
		"Enabled":            sr.Enabled,
		"CreateAt":           sr.CreateAt,
		"UpdateAt":           sr.UpdateAt,
		"DeleteAt":           sr.DeleteAt,
	}
}

// dbScheduledRecap is an intermediate struct for scanning TEXT fields that need JSON unmarshal.
type dbScheduledRecap struct {
	Id                 string
	UserId             string
	Title              string
	DaysOfWeek         int
	TimeOfDay          string
	Timezone           string
	TimePeriod         string
	NextRunAt          int64
	LastRunAt          int64
	RunCount           int
	ChannelMode        string
	ChannelIds         string // JSON string in DB
	CustomInstructions string
	AgentId            string
	IsRecurring        bool
	Enabled            bool
	CreateAt           int64
	UpdateAt           int64
	DeleteAt           int64
}

// fromDB converts a dbScheduledRecap to a model.ScheduledRecap, handling JSON deserialization.
func (s *SqlScheduledRecapStore) fromDB(dbSR *dbScheduledRecap) (*model.ScheduledRecap, error) {
	sr := &model.ScheduledRecap{
		Id:                 dbSR.Id,
		UserId:             dbSR.UserId,
		Title:              dbSR.Title,
		DaysOfWeek:         dbSR.DaysOfWeek,
		TimeOfDay:          dbSR.TimeOfDay,
		Timezone:           dbSR.Timezone,
		TimePeriod:         dbSR.TimePeriod,
		NextRunAt:          dbSR.NextRunAt,
		LastRunAt:          dbSR.LastRunAt,
		RunCount:           dbSR.RunCount,
		ChannelMode:        dbSR.ChannelMode,
		CustomInstructions: dbSR.CustomInstructions,
		AgentId:            dbSR.AgentId,
		IsRecurring:        dbSR.IsRecurring,
		Enabled:            dbSR.Enabled,
		CreateAt:           dbSR.CreateAt,
		UpdateAt:           dbSR.UpdateAt,
		DeleteAt:           dbSR.DeleteAt,
	}
	if dbSR.ChannelIds != "" {
		if err := json.Unmarshal([]byte(dbSR.ChannelIds), &sr.ChannelIds); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal ChannelIds")
		}
	}
	return sr, nil
}

// Save inserts a new ScheduledRecap into the database.
func (s *SqlScheduledRecapStore) Save(scheduledRecap *model.ScheduledRecap) (*model.ScheduledRecap, error) {
	scheduledRecap.PreSave()

	query := s.getQueryBuilder().
		Insert("ScheduledRecaps").
		SetMap(s.toMap(scheduledRecap))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to save ScheduledRecap")
	}

	return scheduledRecap, nil
}

// Get retrieves a ScheduledRecap by ID.
func (s *SqlScheduledRecapStore) Get(id string) (*model.ScheduledRecap, error) {
	var dbSR dbScheduledRecap
	query := s.selectQuery.Where(sq.Eq{"Id": id})

	if err := s.GetReplica().GetBuilder(&dbSR, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ScheduledRecap", id)
		}
		return nil, errors.Wrapf(err, "failed to get ScheduledRecap with id=%s", id)
	}

	return s.fromDB(&dbSR)
}

// Update updates an existing ScheduledRecap.
func (s *SqlScheduledRecapStore) Update(scheduledRecap *model.ScheduledRecap) (*model.ScheduledRecap, error) {
	scheduledRecap.PreUpdate()

	channelIdsJSON, _ := json.Marshal(scheduledRecap.ChannelIds)

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
			"ChannelIds":         string(channelIdsJSON),
			"CustomInstructions": scheduledRecap.CustomInstructions,
			"AgentId":            scheduledRecap.AgentId,
			"IsRecurring":        scheduledRecap.IsRecurring,
			"Enabled":            scheduledRecap.Enabled,
			"UpdateAt":           scheduledRecap.UpdateAt,
		}).
		Where(sq.Eq{"Id": scheduledRecap.Id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrapf(err, "failed to update ScheduledRecap with id=%s", scheduledRecap.Id)
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
	var dbRecaps []dbScheduledRecap

	query := s.selectQuery.
		Where(sq.Eq{"UserId": userId, "DeleteAt": 0}).
		OrderBy("CreateAt DESC").
		Limit(uint64(perPage)).
		Offset(uint64(offset))

	if err := s.GetReplica().SelectBuilder(&dbRecaps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get ScheduledRecaps for userId=%s", userId)
	}

	recaps := make([]*model.ScheduledRecap, 0, len(dbRecaps))
	for i := range dbRecaps {
		recap, err := s.fromDB(&dbRecaps[i])
		if err != nil {
			return nil, err
		}
		recaps = append(recaps, recap)
	}

	return recaps, nil
}

// GetDueBefore retrieves enabled, non-deleted ScheduledRecaps that are due before the given timestamp.
// Results are ordered by NextRunAt ASC to process oldest first.
func (s *SqlScheduledRecapStore) GetDueBefore(timestamp int64, limit int) ([]*model.ScheduledRecap, error) {
	var dbRecaps []dbScheduledRecap

	query := s.selectQuery.
		Where(sq.Eq{"Enabled": true, "DeleteAt": 0}).
		Where(sq.LtOrEq{"NextRunAt": timestamp}).
		OrderBy("NextRunAt ASC").
		Limit(uint64(limit))

	if err := s.GetReplica().SelectBuilder(&dbRecaps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get due ScheduledRecaps before timestamp=%d", timestamp)
	}

	recaps := make([]*model.ScheduledRecap, 0, len(dbRecaps))
	for i := range dbRecaps {
		recap, err := s.fromDB(&dbRecaps[i])
		if err != nil {
			return nil, err
		}
		recaps = append(recaps, recap)
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
