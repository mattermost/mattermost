// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"

	sq "github.com/mattermost/squirrel"
)

type SqlReadReceiptStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface

	selectQueryBuilder sq.SelectBuilder
}

func newSqlReadReceiptStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.ReadReceiptStore {
	s := &SqlReadReceiptStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	s.selectQueryBuilder = s.getQueryBuilder().Select(readReceiptSliceColumns()...).From("ReadReceipts")

	return s
}

func readReceiptSliceColumns() []string {
	return []string{
		"PostId",
		"UserId",
		"ExpireAt",
	}
}

func (s *SqlReadReceiptStore) InvalidateReadReceiptForPostsCache(postID string) {
}

func (s *SqlReadReceiptStore) Save(rctx request.CTX, receipt *model.ReadReceipt) (*model.ReadReceipt, error) {
	query := s.getQueryBuilder().
		Insert("ReadReceipts").
		Columns(readReceiptSliceColumns()...).
		Values(
			receipt.PostID,
			receipt.UserID,
			receipt.ExpireAt,
		)

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, err
	}

	return receipt, nil
}

func (s *SqlReadReceiptStore) Update(rctx request.CTX, receipt *model.ReadReceipt) (*model.ReadReceipt, error) {
	query := s.getQueryBuilder().
		Update("ReadReceipts").
		Set("ExpireAt", receipt.ExpireAt).
		Where(sq.Eq{"PostId": receipt.PostID, "UserId": receipt.UserID})

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, err
	}

	return receipt, nil
}

func (s *SqlReadReceiptStore) Delete(rctx request.CTX, postID, userID string) error {
	query := s.getQueryBuilder().
		Delete("ReadReceipts").
		Where(sq.Eq{"PostId": postID, "UserId": userID})

	_, err := s.GetMaster().ExecBuilder(query)
	return err
}

func (s *SqlReadReceiptStore) DeleteByPost(rctx request.CTX, postID string) error {
	query := s.getQueryBuilder().
		Delete("ReadReceipts").
		Where(sq.Eq{"PostId": postID})

	_, err := s.GetMaster().ExecBuilder(query)
	return err
}

func (s *SqlReadReceiptStore) Get(rctx request.CTX, postID, userID string) (*model.ReadReceipt, error) {
	query := s.selectQueryBuilder.
		Where(sq.Eq{"PostId": postID, "UserId": userID})

	var receipt model.ReadReceipt
	err := s.GetReplica().GetBuilder(&receipt, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("ReadReceipt", postID+"_"+userID)
		}

		return nil, errors.Wrapf(err, "failed to get ReadReceipt with id=%s", postID+"_"+userID)
	}

	return &receipt, nil
}

func (s *SqlReadReceiptStore) GetByPost(rctx request.CTX, postID string) ([]*model.ReadReceipt, error) {
	query := s.selectQueryBuilder.
		Where(sq.Eq{"PostId": postID})

	var receipts []*model.ReadReceipt
	err := s.GetReplica().SelectBuilder(&receipts, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get ReadReceipts for postId=%s", postID)
	}

	return receipts, nil
}

func (s *SqlReadReceiptStore) GetReadCountForPost(rctx request.CTX, postID string) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ReadReceipts").
		Where(sq.Eq{"PostId": postID})

	var count int64
	err := s.GetReplica().GetBuilder(&count, query)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *SqlReadReceiptStore) GetUnreadCountForPost(rctx request.CTX, post *model.Post) (int64, error) {
	// Count channel members who haven't read the post (excluding post author)
	// LEFT JOIN with ReadReceipts to find members without a read receipt for this post
	unreadQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ChannelMembers").
		LeftJoin("ReadReceipts ON ChannelMembers.UserId = ReadReceipts.UserId AND ReadReceipts.PostId = ?", post.Id).
		Where(sq.And{
			sq.Eq{"ChannelMembers.ChannelId": post.ChannelId},
			sq.NotEq{"ChannelMembers.UserId": post.UserId},
			sq.Eq{"ReadReceipts.UserId": nil},
		})

	var unreadCount int64
	// Use master to avoid stale data from replica after writing a read receipt
	err := s.GetMaster().GetBuilder(&unreadCount, unreadQuery)
	if err != nil {
		return -1, errors.Wrapf(err, "failed to get unread count for postId=%s channelId=%s", post.Id, post.ChannelId)
	}

	// Return true if no one is unread (all have read it)
	return unreadCount, nil
}
