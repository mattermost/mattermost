// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/pkg/errors"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelJoinRequestStore struct {
	*SqlStore
}

func newSqlChannelJoinRequestStore(sqlStore *SqlStore) store.ChannelJoinRequestStore {
	return &SqlChannelJoinRequestStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlChannelJoinRequestStore) Save(request *model.ChannelJoinRequest) (*model.ChannelJoinRequest, error) {
	request.PreSave()
	if err := request.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Insert("ChannelJoinRequests").
		Columns("Id", "ChannelId", "UserId", "Status", "CreateAt", "UpdateAt", "ReviewedBy").
		Values(request.Id, request.ChannelId, request.UserId, request.Status, request.CreateAt, request.UpdateAt, request.ReviewedBy)

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_join_request_save_tosql")
	}

	if _, err = s.GetMaster().Exec(sqlStr, args...); err != nil {
		return nil, errors.Wrap(err, "failed to save channel join request")
	}

	return request, nil
}

func (s *SqlChannelJoinRequestStore) GetById(id string) (*model.ChannelJoinRequest, error) {
	query := s.getQueryBuilder().
		Select("Id", "ChannelId", "UserId", "Status", "CreateAt", "UpdateAt", "ReviewedBy").
		From("ChannelJoinRequests").
		Where(sq.Eq{"Id": id})

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_join_request_get_tosql")
	}

	var request model.ChannelJoinRequest
	if err = s.GetReplica().Get(&request, sqlStr, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ChannelJoinRequest", id)
		}
		return nil, errors.Wrap(err, "failed to get channel join request")
	}

	return &request, nil
}

func (s *SqlChannelJoinRequestStore) GetByChannelId(channelId string, status string, offset, limit int) ([]*model.ChannelJoinRequest, error) {
	query := s.getQueryBuilder().
		Select("Id", "ChannelId", "UserId", "Status", "CreateAt", "UpdateAt", "ReviewedBy").
		From("ChannelJoinRequests").
		Where(sq.Eq{"ChannelId": channelId}).
		OrderBy("CreateAt ASC").
		Offset(uint64(offset)).
		Limit(uint64(limit))

	if status != "" {
		query = query.Where(sq.Eq{"Status": status})
	}

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_join_request_get_by_channel_tosql")
	}

	var requests []*model.ChannelJoinRequest
	if err = s.GetReplica().Select(&requests, sqlStr, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get channel join requests")
	}

	return requests, nil
}

func (s *SqlChannelJoinRequestStore) GetPendingByChannelAndUser(channelId, userId string) (*model.ChannelJoinRequest, error) {
	query := s.getQueryBuilder().
		Select("Id", "ChannelId", "UserId", "Status", "CreateAt", "UpdateAt", "ReviewedBy").
		From("ChannelJoinRequests").
		Where(sq.Eq{
			"ChannelId": channelId,
			"UserId":    userId,
			"Status":    model.JoinRequestStatusPending,
		})

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_join_request_get_pending_tosql")
	}

	var request model.ChannelJoinRequest
	if err = s.GetReplica().Get(&request, sqlStr, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, errors.Wrap(err, "failed to get pending channel join request")
	}

	return &request, nil
}

func (s *SqlChannelJoinRequestStore) Update(request *model.ChannelJoinRequest) (*model.ChannelJoinRequest, error) {
	request.PreUpdate()

	query := s.getQueryBuilder().
		Update("ChannelJoinRequests").
		Set("Status", request.Status).
		Set("UpdateAt", request.UpdateAt).
		Set("ReviewedBy", request.ReviewedBy).
		Where(sq.Eq{"Id": request.Id})

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "channel_join_request_update_tosql")
	}

	result, err := s.GetMaster().Exec(sqlStr, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update channel join request")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get rows affected")
	}
	if count == 0 {
		return nil, store.NewErrNotFound("ChannelJoinRequest", request.Id)
	}

	return request, nil
}

func (s *SqlChannelJoinRequestStore) Delete(id string) error {
	query := s.getQueryBuilder().
		Delete("ChannelJoinRequests").
		Where(sq.Eq{"Id": id})

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "channel_join_request_delete_tosql")
	}

	if _, err = s.GetMaster().Exec(sqlStr, args...); err != nil {
		return errors.Wrap(err, "failed to delete channel join request")
	}

	return nil
}

func (s *SqlChannelJoinRequestStore) CountPendingByChannelId(channelId string) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ChannelJoinRequests").
		Where(sq.Eq{
			"ChannelId": channelId,
			"Status":    model.JoinRequestStatusPending,
		})

	sqlStr, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "channel_join_request_count_tosql")
	}

	var count int64
	if err = s.GetReplica().Get(&count, sqlStr, args...); err != nil {
		return 0, errors.Wrap(err, "failed to count pending channel join requests")
	}

	return count, nil
}
