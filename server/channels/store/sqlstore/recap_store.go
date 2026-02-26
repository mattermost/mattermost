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
		"TotalMessageCount",
		"Status",
		"BotID",
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
		"TotalMessageCount": recap.TotalMessageCount,
		"Status":            recap.Status,
		"BotID":             recap.BotID,
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
	query := s.getQueryBuilder().
		Insert("Recaps").
		SetMap(s.recapToMap(recap))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to save Recap")
	}

	return recap, nil
}

func (s *SqlRecapStore) GetRecap(id string) (*model.Recap, error) {
	var recap model.Recap
	query := s.recapSelectQuery.Where(sq.Eq{"Id": id})

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
