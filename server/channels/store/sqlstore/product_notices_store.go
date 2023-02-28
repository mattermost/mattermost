// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
)

type SqlProductNoticesStore struct {
	*SqlStore
}

func newSqlProductNoticesStore(sqlStore *SqlStore) store.ProductNoticesStore {
	return &SqlProductNoticesStore{sqlStore}
}

func (s SqlProductNoticesStore) Clear(notices []string) error {
	sql, args, err := s.getQueryBuilder().Delete("ProductNoticeViewState").Where(sq.Eq{"NoticeId": notices}).ToSql()
	if err != nil {
		return errors.Wrap(err, "product_notice_view_state_tosql")
	}

	if _, err := s.GetMasterX().Exec(sql, args...); err != nil {
		return errors.Wrap(err, "failed to delete records from ProductNoticeViewState")
	}
	return nil
}

func (s SqlProductNoticesStore) ClearOldNotices(currentNotices model.ProductNotices) error {
	var notices []string
	for _, currentNotice := range currentNotices {
		notices = append(notices, currentNotice.ID)
	}
	sql, args, err := s.getQueryBuilder().Delete("ProductNoticeViewState").Where(sq.NotEq{"NoticeId": notices}).ToSql()
	if err != nil {
		return errors.Wrap(err, "product_notice_view_state_tosql")
	}

	if _, err := s.GetMasterX().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to delete records from ProductNoticeViewState")
	}
	return nil
}

func (s SqlProductNoticesStore) View(userId string, notices []string) (err error) {
	transaction, err := s.GetMasterX().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	noticeStates := []model.ProductNoticeViewState{}
	sql, args, err := s.getQueryBuilder().
		Select("*").
		From("ProductNoticeViewState").
		Where(sq.And{sq.Eq{"UserId": userId}, sq.Eq{"NoticeId": notices}}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "View_ToSql")
	}
	if err := transaction.Select(&noticeStates, sql, args...); err != nil {
		return errors.Wrapf(err, "failed to get ProductNoticeViewState with userId=%s", userId)
	}

	now := time.Now().UTC().Unix()

	// update existing records
	for i := range noticeStates {
		noticeStates[i].Viewed += 1
		noticeStates[i].Timestamp = now
		if _, err := transaction.NamedExec(`UPDATE ProductNoticeViewState
		  SET Viewed=:Viewed, Timestamp=:Timestamp WHERE UserId=:UserId AND NoticeId=:NoticeId`, &noticeStates[i]); err != nil {
			return errors.Wrapf(err, "failed to update ProductNoticeViewState")
		}
	}

	// add new ones
	haveNoticeState := func(n string) bool {
		for _, ns := range noticeStates {
			if ns.NoticeId == n {
				return true
			}
		}
		return false
	}

	for _, noticeId := range notices {
		if !haveNoticeState(noticeId) {
			productNoticeViewState := &model.ProductNoticeViewState{
				UserId:    userId,
				NoticeId:  noticeId,
				Viewed:    1,
				Timestamp: now,
			}
			if _, err := transaction.NamedExec(`INSERT INTO ProductNoticeViewState (UserId, NoticeId, Viewed, Timestamp)
			  VALUES (:UserId, :NoticeId, :Viewed, :Timestamp)`, productNoticeViewState); err != nil {
				return errors.Wrapf(err, "failed to insert ProductNoticeViewState")
			}
		}
	}

	if err := transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s SqlProductNoticesStore) GetViews(userId string) ([]model.ProductNoticeViewState, error) {
	noticeStates := []model.ProductNoticeViewState{}
	sql, args, err := s.getQueryBuilder().Select("*").From("ProductNoticeViewState").Where(sq.Eq{"UserId": userId}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "product_notice_view_state_tosql")
	}
	if err := s.GetReplicaX().Select(&noticeStates, sql, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to get ProductNoticeViewState with userId=%s", userId)
	}
	return noticeStates, nil
}
