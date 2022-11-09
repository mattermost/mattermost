// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlPostPriorityStore struct {
	*SqlStore
}

func newSqlPostPriorityStore(sqlStore *SqlStore) store.PostPriorityStore {
	return &SqlPostPriorityStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPostPriorityStore) GetForPost(postId string) (*model.PostPriority, error) {
	query, args, err := s.getQueryBuilder().
		Select("Priority", "RequestedAck", "PersistentNotifications").
		From("PostsPriority").
		Where(sq.Eq{"PostId": postId}).
		ToSql()

	if err != nil {
		return nil, err
	}

	var postPriority model.PostPriority

	err = s.GetReplicaX().Get(&postPriority, query, args...)

	if err != nil {
		return nil, err
	}

	return &postPriority, nil
}

func (s *SqlPostPriorityStore) GetPersistentNotificationsPosts(minCreateAt int64) ([]*model.PostPersistentNotifications, error) {
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("PersistenceNotifications").
		Where(sq.And{
			sq.GtOrEq{"CreateAt": minCreateAt},
			sq.Eq{"DeleteAt": 0},
		}).
		ToSql()

	if err != nil {
		return nil, err
	}

	var posts []*model.PostPersistentNotifications
	err = s.GetReplicaX().Select(&posts, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return make([]*model.PostPersistentNotifications, 0), nil
		}
		return nil, errors.Wrap(err, "failed to get posts for persistent notifications")
	}

	return posts, nil
}

func (s *SqlPostPriorityStore) DeletePersistentNotificationsPosts(postIds []string) error {
	if len(postIds) == 0 {
		return nil
	}

	query, args, err := s.getQueryBuilder().
		Update("PersistenceNotifications").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"PostId": postIds}).
		ToSql()

	if err != nil {
		return err
	}

	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to mark posts %s as deleted", postIds)
	}

	return nil
}
