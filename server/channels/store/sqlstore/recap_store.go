// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

type SqlRecapStore struct {
	*SqlStore
}

func NewSqlRecapStore(sqlStore *SqlStore) store.RecapStore {
	return &SqlRecapStore{sqlStore}
}

func (s *SqlRecapStore) SaveRecap(recap *model.Recap) (*model.Recap, error) {
	query := `
		INSERT INTO Recaps
		(Id, UserId, Title, CreateAt, UpdateAt, DeleteAt, ReadAt, TotalMessageCount, Status, BotID)
		VALUES (:Id, :UserId, :Title, :CreateAt, :UpdateAt, :DeleteAt, :ReadAt, :TotalMessageCount, :Status, :BotID)
	`

	if _, err := s.GetMaster().NamedExec(query, recap); err != nil {
		return nil, errors.Wrap(err, "failed to save Recap")
	}

	return recap, nil
}

func (s *SqlRecapStore) GetRecap(id string) (*model.Recap, error) {
	var recap model.Recap
	query := `
		SELECT Id, UserId, Title, CreateAt, UpdateAt, DeleteAt, ReadAt, TotalMessageCount, Status, BotID
		FROM Recaps
		WHERE Id = ?
	`

	if err := s.GetReplica().Get(&recap, query, id); err != nil {
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

	query := `
		SELECT Id, UserId, Title, CreateAt, UpdateAt, DeleteAt, ReadAt, TotalMessageCount, Status, BotID
		FROM Recaps
		WHERE UserId = ? AND DeleteAt = 0
		ORDER BY CreateAt DESC
		LIMIT ? OFFSET ?
	`

	if err := s.GetReplica().Select(&recaps, query, userId, perPage, offset); err != nil {
		return nil, errors.Wrapf(err, "failed to get Recaps for userId=%s", userId)
	}

	return recaps, nil
}

func (s *SqlRecapStore) UpdateRecap(recap *model.Recap) (*model.Recap, error) {
	query := `
		UPDATE Recaps
		SET Title = ?, UpdateAt = ?, TotalMessageCount = ?, Status = ?
		WHERE Id = ?
	`

	if _, err := s.GetMaster().Exec(query, recap.Title, recap.UpdateAt, recap.TotalMessageCount, recap.Status, recap.Id); err != nil {
		return nil, errors.Wrapf(err, "failed to update Recap with id=%s", recap.Id)
	}

	return recap, nil
}

func (s *SqlRecapStore) UpdateRecapStatus(id, status string) error {
	query := `
		UPDATE Recaps
		SET Status = ?, UpdateAt = ?
		WHERE Id = ?
	`

	updateAt := model.GetMillis()
	if _, err := s.GetMaster().Exec(query, status, updateAt, id); err != nil {
		return errors.Wrapf(err, "failed to update Recap status for id=%s", id)
	}

	return nil
}

func (s *SqlRecapStore) MarkRecapAsRead(id string) error {
	query := `
		UPDATE Recaps
		SET ReadAt = ?, UpdateAt = ?
		WHERE Id = ? AND ReadAt = 0
	`

	now := model.GetMillis()
	if _, err := s.GetMaster().Exec(query, now, now, id); err != nil {
		return errors.Wrapf(err, "failed to mark Recap as read for id=%s", id)
	}

	return nil
}

func (s *SqlRecapStore) DeleteRecap(id string) error {
	query := `
		UPDATE Recaps
		SET DeleteAt = ?
		WHERE Id = ?
	`

	deleteAt := model.GetMillis()
	if _, err := s.GetMaster().Exec(query, deleteAt, id); err != nil {
		return errors.Wrapf(err, "failed to delete Recap with id=%s", id)
	}

	return nil
}

func (s *SqlRecapStore) DeleteRecapChannels(recapId string) error {
	query := `
		DELETE FROM RecapChannels
		WHERE RecapId = ?
	`

	if _, err := s.GetMaster().Exec(query, recapId); err != nil {
		return errors.Wrapf(err, "failed to delete RecapChannels for recapId=%s", recapId)
	}

	return nil
}

func (s *SqlRecapStore) SaveRecapChannel(recapChannel *model.RecapChannel) error {
	// Convert arrays to JSON strings for storage
	highlightsJSON, err := json.Marshal(recapChannel.Highlights)
	if err != nil {
		return errors.Wrap(err, "failed to marshal Highlights")
	}

	actionItemsJSON, err := json.Marshal(recapChannel.ActionItems)
	if err != nil {
		return errors.Wrap(err, "failed to marshal ActionItems")
	}

	sourcePostIdsJSON, err := json.Marshal(recapChannel.SourcePostIds)
	if err != nil {
		return errors.Wrap(err, "failed to marshal SourcePostIds")
	}

	query := `
		INSERT INTO RecapChannels
		(Id, RecapId, ChannelId, ChannelName, Highlights, ActionItems, SourcePostIds, CreateAt)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	if _, err := s.GetMaster().Exec(query,
		recapChannel.Id,
		recapChannel.RecapId,
		recapChannel.ChannelId,
		recapChannel.ChannelName,
		string(highlightsJSON),
		string(actionItemsJSON),
		string(sourcePostIdsJSON),
		recapChannel.CreateAt,
	); err != nil {
		return errors.Wrap(err, "failed to save RecapChannel")
	}

	return nil
}

func (s *SqlRecapStore) GetRecapChannelsByRecapId(recapId string) ([]*model.RecapChannel, error) {
	query := `
		SELECT Id, RecapId, ChannelId, ChannelName, Highlights, ActionItems, SourcePostIds, CreateAt
		FROM RecapChannels
		WHERE RecapId = ?
		ORDER BY CreateAt ASC
	`

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

	if err := s.GetReplica().Select(&dbRecapChannels, query, recapId); err != nil {
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
