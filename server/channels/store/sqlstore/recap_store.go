// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

var (
	recapColumns = []string{
		"Id",
		"UserId",
		"Title",
		"CreateAt",
		"UpdateAt",
		"DeleteAt",
		"ReadAt",
		"ViewedAt",
		"TotalMessageCount",
		"Status",
		"BotID",
		"ScheduledRecapId",
		"SkipReason",
	}

	recapChannelColumns = []string{
		"Id",
		"RecapId",
		"ChannelId",
		"ChannelName",
		"Highlights",
		"ActionItems",
		"SourcePostIds",
		"CreateAt",
	}
)

type SqlRecapStore struct {
	*SqlStore

	recapSelectQuery        sq.SelectBuilder
	recapChannelSelectQuery sq.SelectBuilder
}

func newSqlRecapStore(sqlStore *SqlStore) store.RecapStore {
	s := &SqlRecapStore{
		SqlStore: sqlStore,
	}

	s.recapSelectQuery = s.getQueryBuilder().
		Select(recapColumns...).
		From("Recaps")

	s.recapChannelSelectQuery = s.getQueryBuilder().
		Select(recapChannelColumns...).
		From("RecapChannels")

	return s
}

func (s *SqlRecapStore) recapToMap(recap *model.Recap) map[string]any {
	return map[string]any{
		"Id":                recap.Id,
		"UserId":            recap.UserId,
		"Title":             recap.Title,
		"CreateAt":          recap.CreateAt,
		"UpdateAt":          recap.UpdateAt,
		"DeleteAt":          recap.DeleteAt,
		"ReadAt":            recap.ReadAt,
		"ViewedAt":          recap.ViewedAt,
		"TotalMessageCount": recap.TotalMessageCount,
		"Status":            recap.Status,
		"BotID":             recap.BotID,
		"ScheduledRecapId":  recap.ScheduledRecapId,
		"SkipReason":        recap.SkipReason,
	}
}

func (s *SqlRecapStore) recapChannelToMap(rc *model.RecapChannel) (map[string]any, error) {
	highlightsJSON, err := json.Marshal(rc.Highlights)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal Highlights")
	}

	actionItemsJSON, err := json.Marshal(rc.ActionItems)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal ActionItems")
	}

	sourcePostIdsJSON, err := json.Marshal(rc.SourcePostIds)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal SourcePostIds")
	}

	return map[string]any{
		"Id":            rc.Id,
		"RecapId":       rc.RecapId,
		"ChannelId":     rc.ChannelId,
		"ChannelName":   rc.ChannelName,
		"Highlights":    string(highlightsJSON),
		"ActionItems":   string(actionItemsJSON),
		"SourcePostIds": string(sourcePostIdsJSON),
		"CreateAt":      rc.CreateAt,
	}, nil
}

func (s *SqlRecapStore) SaveRecap(recap *model.Recap) (*model.Recap, error) {
	if err := s.saveRecapWithExecutor(s.GetMaster(), recap); err != nil {
		return nil, err
	}

	return recap, nil
}

func (s *SqlRecapStore) SaveRecapIfUnderDailyLimit(recap *model.Recap, since int64, limit int) (*model.Recap, error) {
	// SERIALIZABLE prevents the COUNT/INSERT check from racing under READ COMMITTED;
	// the retry layer retries the serialization failures this can surface.
	tx, err := s.GetMaster().BeginWithIsolation(&sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin transaction for SaveRecapIfUnderDailyLimit")
	}
	defer finalizeTransactionX(tx, &err)

	count, err := s.countForUserSinceWithExecutor(tx, recap.UserId, since)
	if err != nil {
		return nil, err
	}
	if count >= int64(limit) {
		return nil, store.NewErrLimitExceeded("recaps_per_day", int(count), fmt.Sprintf("userId=%s limit=%d", recap.UserId, limit))
	}

	if err = s.saveRecapWithExecutor(tx, recap); err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit transaction for SaveRecapIfUnderDailyLimit")
	}

	return recap, nil
}

func (s *SqlRecapStore) saveRecapWithExecutor(executor sqlxExecutor, recap *model.Recap) error {
	query := s.getQueryBuilder().
		Insert("Recaps").
		SetMap(s.recapToMap(recap))

	if _, err := executor.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to save Recap")
	}

	return nil
}

func (s *SqlRecapStore) GetRecap(id string) (*model.Recap, error) {
	var recap model.Recap
	query := s.recapSelectQuery.Where(sq.Eq{"Id": id, "DeleteAt": 0})

	if err := s.GetReplica().GetBuilder(&recap, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Recap", id)
		}
		return nil, errors.Wrapf(err, "failed to get Recap with id=%s", id)
	}

	return &recap, nil
}

func (s *SqlRecapStore) GetRecapsForUser(userId string, page, perPage int) ([]*model.Recap, error) {
	offset := page * perPage
	var recaps []*model.Recap

	query := s.recapSelectQuery.
		Where(sq.Eq{"UserId": userId, "DeleteAt": 0}).
		Where(sq.NotEq{"Status": model.RecapStatusSkipped}). // Skipped recaps are internal audit records, not client-facing.
		OrderBy("CreateAt DESC").
		Limit(uint64(perPage)).
		Offset(uint64(offset))

	if err := s.GetReplica().SelectBuilder(&recaps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get Recaps for userId=%s", userId)
	}

	return recaps, nil
}

func (s *SqlRecapStore) UpdateRecap(recap *model.Recap) (*model.Recap, error) {
	query := s.getQueryBuilder().
		Update("Recaps").
		SetMap(map[string]any{
			"Title":             recap.Title,
			"UpdateAt":          recap.UpdateAt,
			"TotalMessageCount": recap.TotalMessageCount,
			"Status":            recap.Status,
			"ReadAt":            recap.ReadAt,
			"ViewedAt":          recap.ViewedAt,
		}).
		Where(sq.Eq{"Id": recap.Id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrapf(err, "failed to update Recap with id=%s", recap.Id)
	}

	return recap, nil
}

func (s *SqlRecapStore) UpdateRecapStatus(id, status string) error {
	updateAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("Recaps").
		SetMap(map[string]any{
			"Status":   status,
			"UpdateAt": updateAt,
		}).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to update Recap status for id=%s", id)
	}

	return nil
}

// MarkRecapSkipped flips a still-pending recap to skipped. Scoped to pending so a
// recap a worker has already started processing is never clobbered.
func (s *SqlRecapStore) MarkRecapSkipped(id, reason string) error {
	query := s.getQueryBuilder().
		Update("Recaps").
		SetMap(map[string]any{
			"Status":     model.RecapStatusSkipped,
			"SkipReason": reason,
			"UpdateAt":   model.GetMillis(),
		}).
		Where(sq.Eq{"Id": id, "Status": model.RecapStatusPending})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to mark Recap as skipped for id=%s", id)
	}

	return nil
}

func (s *SqlRecapStore) MarkRecapAsRead(id string) error {
	now := model.GetMillis()

	query := s.getQueryBuilder().
		Update("Recaps").
		SetMap(map[string]any{
			"ReadAt":   now,
			"UpdateAt": now,
		}).
		Where(sq.Eq{"Id": id, "ReadAt": 0})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to mark Recap as read for id=%s", id)
	}

	return nil
}

func (s *SqlRecapStore) MarkRecapsAsViewed(userId string, statuses []string) ([]string, error) {
	if len(statuses) == 0 {
		return nil, nil
	}

	now := model.GetMillis()

	query, args, err := s.getQueryBuilder().
		Update("Recaps").
		SetMap(map[string]any{
			"ViewedAt": now,
			"UpdateAt": now,
		}).
		Where(sq.Eq{"UserId": userId, "ViewedAt": 0, "DeleteAt": 0, "Status": statuses}).
		Suffix("RETURNING Id").
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build MarkRecapsAsViewed query")
	}

	var ids []string
	if err := s.GetMaster().Select(&ids, query, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to mark recaps as viewed for userId=%s", userId)
	}

	return ids, nil
}

func (s *SqlRecapStore) DeleteRecap(id string) error {
	deleteAt := model.GetMillis()

	query := s.getQueryBuilder().
		Update("Recaps").
		SetMap(map[string]any{
			"DeleteAt": deleteAt,
		}).
		Where(sq.Eq{"Id": id})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to delete Recap with id=%s", id)
	}

	return nil
}

func (s *SqlRecapStore) DeleteRecapChannels(recapId string) error {
	query := s.getQueryBuilder().
		Delete("RecapChannels").
		Where(sq.Eq{"RecapId": recapId})

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to delete RecapChannels for recapId=%s", recapId)
	}

	return nil
}

func (s *SqlRecapStore) SaveRecapChannel(recapChannel *model.RecapChannel) error {
	rcMap, err := s.recapChannelToMap(recapChannel)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder().
		Insert("RecapChannels").
		SetMap(rcMap)

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to save RecapChannel")
	}

	return nil
}

func (s *SqlRecapStore) GetRecapChannelsByRecapId(recapId string) ([]*model.RecapChannel, error) {
	query := s.recapChannelSelectQuery.
		Where(sq.Eq{"RecapId": recapId}).
		OrderBy("CreateAt ASC")

	var dbRecapChannels []struct {
		Id            string
		RecapId       string
		ChannelId     string
		ChannelName   string
		Highlights    string
		ActionItems   string
		SourcePostIds string
		CreateAt      int64
	}

	if err := s.GetReplica().SelectBuilder(&dbRecapChannels, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get RecapChannels for recapId=%s", recapId)
	}

	recapChannels := make([]*model.RecapChannel, 0, len(dbRecapChannels))
	for _, dbRC := range dbRecapChannels {
		rc := &model.RecapChannel{
			Id:          dbRC.Id,
			RecapId:     dbRC.RecapId,
			ChannelId:   dbRC.ChannelId,
			ChannelName: dbRC.ChannelName,
			CreateAt:    dbRC.CreateAt,
		}

		// Unmarshal JSON strings back to arrays
		if err := json.Unmarshal([]byte(dbRC.Highlights), &rc.Highlights); err != nil {
			return nil, errors.Wrap(err, fmt.Sprintf("failed to unmarshal Highlights for recapChannel id=%s", dbRC.Id))
		}

		if err := json.Unmarshal([]byte(dbRC.ActionItems), &rc.ActionItems); err != nil {
			return nil, errors.Wrap(err, fmt.Sprintf("failed to unmarshal ActionItems for recapChannel id=%s", dbRC.Id))
		}

		if err := json.Unmarshal([]byte(dbRC.SourcePostIds), &rc.SourcePostIds); err != nil {
			return nil, errors.Wrap(err, fmt.Sprintf("failed to unmarshal SourcePostIds for recapChannel id=%s", dbRC.Id))
		}

		recapChannels = append(recapChannels, rc)
	}

	return recapChannels, nil
}

// CountForUserSince returns count of recaps created by user since given timestamp.
// Excludes skipped recaps from the count, but still counts soft-deleted recaps
// because they already consumed AI usage.
func (s *SqlRecapStore) CountForUserSince(userId string, since int64) (int64, error) {
	return s.countForUserSinceWithExecutor(s.GetReplica(), userId, since)
}

func (s *SqlRecapStore) countForUserSinceWithExecutor(executor sqlxExecutor, userId string, since int64) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("Recaps").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.GtOrEq{"CreateAt": since}).
		Where(sq.NotEq{"Status": model.RecapStatusSkipped}) // Don't count skipped recaps

	var count int64
	err := executor.GetBuilder(&count, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count recaps for user since timestamp")
	}
	return count, nil
}

func (s *SqlRecapStore) SumTotalMessageCountForUserSince(userId string, since int64) (int64, error) {
	query := s.getQueryBuilder().
		Select("COALESCE(SUM(TotalMessageCount), 0)").
		From("Recaps").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.GtOrEq{"CreateAt": since}).
		Where(sq.NotEq{"Status": model.RecapStatusSkipped})

	var total int64
	err := s.GetReplica().GetBuilder(&total, query)
	if err != nil {
		return 0, errors.Wrap(err, "failed to sum recap message count for user since timestamp")
	}
	return total, nil
}

// GetLastCompletedManualRecap returns the most recent completed manual recap for user.
// Manual recap = ScheduledRecapId is empty. Used for cooldown checking, including
// soft-deleted recaps because deleting a recap should not bypass cooldown.
// Returns nil, nil if no manual recap exists.
func (s *SqlRecapStore) GetLastCompletedManualRecap(userId string) (*model.Recap, error) {
	var recap model.Recap
	query := s.recapSelectQuery.
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Status": model.RecapStatusCompleted}).
		Where(sq.Or{sq.Eq{"ScheduledRecapId": ""}, sq.Expr("ScheduledRecapId IS NULL")}). // Manual = no scheduled recap ID (NULL for pre-migration rows)
		OrderBy("CreateAt DESC").
		Limit(1)

	err := s.GetReplica().GetBuilder(&recap, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No manual recap found - not an error
		}
		return nil, errors.Wrap(err, "failed to get last completed manual recap")
	}
	return &recap, nil
}
