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

const channelJoinRequestsTable = "ChannelJoinRequests"

var channelJoinRequestColumns = []string{
	"Id",
	"ChannelId",
	"UserId",
	"Message",
	"Status",
	"DenialReason",
	"CreateAt",
	"UpdateAt",
	"ReviewedBy",
	"ReviewedAt",
}

type SqlChannelJoinRequestStore struct {
	*SqlStore

	selectQuery sq.SelectBuilder
}

func newSqlChannelJoinRequestStore(sqlStore *SqlStore) store.ChannelJoinRequestStore {
	s := &SqlChannelJoinRequestStore{SqlStore: sqlStore}
	s.selectQuery = s.getQueryBuilder().
		Select(channelJoinRequestColumns...).
		From(channelJoinRequestsTable)
	return s
}

func (s *SqlChannelJoinRequestStore) toMap(r *model.ChannelJoinRequest) map[string]any {
	return map[string]any{
		"Id":           r.Id,
		"ChannelId":    r.ChannelId,
		"UserId":       r.UserId,
		"Message":      r.Message,
		"Status":       r.Status,
		"DenialReason": r.DenialReason,
		"CreateAt":     r.CreateAt,
		"UpdateAt":     r.UpdateAt,
		"ReviewedBy":   r.ReviewedBy,
		"ReviewedAt":   r.ReviewedAt,
	}
}

// Save inserts a new join request. The partial unique index in Postgres
// (channelid, userid) WHERE status = 'pending' enforces at-most-one pending
// row per (channel, user). On conflict we translate the unique-violation into
// a store.ErrConflict so the app layer can return 409.
func (s *SqlChannelJoinRequestStore) Save(req *model.ChannelJoinRequest) (*model.ChannelJoinRequest, error) {
	req.PreSave()

	if err := req.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Insert(channelJoinRequestsTable).
		SetMap(s.toMap(req))

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		if IsUniqueConstraintError(err, []string{"idx_channeljoinrequests_pending_unique"}) {
			return nil, store.NewErrConflict("ChannelJoinRequest", err, "channel_id="+req.ChannelId+" user_id="+req.UserId)
		}
		return nil, errors.Wrap(err, "failed to save ChannelJoinRequest")
	}

	return req, nil
}

func (s *SqlChannelJoinRequestStore) Get(id string) (*model.ChannelJoinRequest, error) {
	var req model.ChannelJoinRequest
	query := s.selectQuery.Where(sq.Eq{"Id": id})

	if err := s.GetReplica().GetBuilder(&req, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ChannelJoinRequest", id)
		}
		return nil, errors.Wrapf(err, "failed to get ChannelJoinRequest with id=%s", id)
	}

	return &req, nil
}

func (s *SqlChannelJoinRequestStore) GetPendingForChannelAndUser(channelId, userId string) (*model.ChannelJoinRequest, error) {
	var req model.ChannelJoinRequest
	query := s.selectQuery.Where(sq.Eq{
		"ChannelId": channelId,
		"UserId":    userId,
		"Status":    model.ChannelJoinRequestStatusPending,
	})

	if err := s.GetReplica().GetBuilder(&req, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ChannelJoinRequest", "channel_id="+channelId+" user_id="+userId)
		}
		return nil, errors.Wrapf(err, "failed to get pending ChannelJoinRequest for channel_id=%s user_id=%s", channelId, userId)
	}

	return &req, nil
}

// applyStatusFilter applies the opts.Status filter (defaulting to pending if empty)
// to both the select and count queries. Returning the two filtered builders keeps
// list and count perfectly in sync.
func applyJoinRequestStatusFilter(opts model.GetChannelJoinRequestsOpts) sq.Eq {
	status := opts.Status
	if status == "" {
		status = model.ChannelJoinRequestStatusPending
	}
	return sq.Eq{"Status": status}
}

func paginate(opts model.GetChannelJoinRequestsOpts) (limit, offset uint64) {
	perPage := opts.PerPage
	if perPage <= 0 {
		perPage = 60
	}
	page := max(opts.Page, 0)
	return uint64(perPage), uint64(page) * uint64(perPage)
}

func (s *SqlChannelJoinRequestStore) GetForChannel(channelId string, opts model.GetChannelJoinRequestsOpts) ([]*model.ChannelJoinRequest, int64, error) {
	where := sq.And{sq.Eq{"ChannelId": channelId}, applyJoinRequestStatusFilter(opts)}

	limit, offset := paginate(opts)
	listQuery := s.selectQuery.
		Where(where).
		OrderBy("CreateAt DESC", "Id DESC").
		Limit(limit).
		Offset(offset)

	var rows []*model.ChannelJoinRequest
	if err := s.GetReplica().SelectBuilder(&rows, listQuery); err != nil {
		return nil, 0, errors.Wrapf(err, "failed to list ChannelJoinRequests for channel_id=%s", channelId)
	}

	countQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From(channelJoinRequestsTable).
		Where(where)

	var total int64
	if err := s.GetReplica().GetBuilder(&total, countQuery); err != nil {
		return nil, 0, errors.Wrapf(err, "failed to count ChannelJoinRequests for channel_id=%s", channelId)
	}

	return rows, total, nil
}

func (s *SqlChannelJoinRequestStore) GetForUser(userId string, opts model.GetChannelJoinRequestsOpts) ([]*model.ChannelJoinRequest, int64, error) {
	where := sq.And{sq.Eq{"UserId": userId}, applyJoinRequestStatusFilter(opts)}

	limit, offset := paginate(opts)
	listQuery := s.selectQuery.
		Where(where).
		OrderBy("CreateAt DESC", "Id DESC").
		Limit(limit).
		Offset(offset)

	var rows []*model.ChannelJoinRequest
	if err := s.GetReplica().SelectBuilder(&rows, listQuery); err != nil {
		return nil, 0, errors.Wrapf(err, "failed to list ChannelJoinRequests for user_id=%s", userId)
	}

	countQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From(channelJoinRequestsTable).
		Where(where)

	var total int64
	if err := s.GetReplica().GetBuilder(&total, countQuery); err != nil {
		return nil, 0, errors.Wrapf(err, "failed to count ChannelJoinRequests for user_id=%s", userId)
	}

	return rows, total, nil
}

// Update writes the mutable fields back. Id/ChannelId/UserId/CreateAt are
// immutable post-create — the partial-unique index relies on (ChannelId, UserId)
// being stable for the lifetime of a row.
func (s *SqlChannelJoinRequestStore) Update(req *model.ChannelJoinRequest) (*model.ChannelJoinRequest, error) {
	req.PreUpdate()

	if err := req.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Update(channelJoinRequestsTable).
		SetMap(map[string]any{
			"Status":       req.Status,
			"Message":      req.Message,
			"DenialReason": req.DenialReason,
			"UpdateAt":     req.UpdateAt,
			"ReviewedBy":   req.ReviewedBy,
			"ReviewedAt":   req.ReviewedAt,
		}).
		Where(sq.Eq{"Id": req.Id})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update ChannelJoinRequest with id=%s", req.Id)
	}

	n, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RowsAffected on ChannelJoinRequest update")
	}
	if n == 0 {
		return nil, store.NewErrNotFound("ChannelJoinRequest", req.Id)
	}

	return req, nil
}

func (s *SqlChannelJoinRequestStore) CountPending(channelId string) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From(channelJoinRequestsTable).
		Where(sq.Eq{
			"ChannelId": channelId,
			"Status":    model.ChannelJoinRequestStatusPending,
		})

	var count int64
	if err := s.GetReplica().GetBuilder(&count, query); err != nil {
		return 0, errors.Wrapf(err, "failed to count pending ChannelJoinRequests for channel_id=%s", channelId)
	}
	return count, nil
}
