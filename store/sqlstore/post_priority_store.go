// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	sq "github.com/mattermost/squirrel"
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
	query := s.getQueryBuilder().
		Select("Priority", "RequestedAck", "PersistentNotifications").
		From("PostsPriority").
		Where(sq.Eq{"PostId": postId})

	var postPriority model.PostPriority
	err := s.GetReplicaX().GetBuilder(&postPriority, query)
	if err != nil {
		return nil, err
	}

	return &postPriority, nil
}

func (s *SqlPostPriorityStore) GetForPosts(postIds []string) ([]*model.PostPriority, error) {
	var priority []*model.PostPriority

	perPage := 200
	for i := 0; i < len(postIds); i += perPage {
		j := i + perPage
		if len(postIds) < j {
			j = len(postIds)
		}

		query := s.getQueryBuilder().
			Select("PostId", "Priority", "RequestedAck", "PersistentNotifications").
			From("PostsPriority").
			Where(sq.Eq{"PostId": postIds[i:j]})

		var priorityBatch []*model.PostPriority
		err := s.GetReplicaX().SelectBuilder(&priority, query)

		if err != nil {
			return nil, err
		}

		priority = append(priority, priorityBatch...)
	}

	return priority, nil
}
