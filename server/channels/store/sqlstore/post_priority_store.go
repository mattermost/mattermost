// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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
		Select("PostId", "ChannelId", "Priority", "RequestedAck", "PersistentNotifications").
		From("PostsPriority").
		Where(sq.Eq{"PostId": postId})

	var postPriority model.PostPriority
	err := s.GetReplica().GetBuilder(&postPriority, query)
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
			Select("PostId", "ChannelId", "Priority", "RequestedAck", "PersistentNotifications").
			From("PostsPriority").
			Where(sq.Eq{"PostId": postIds[i:j]})

		var priorityBatch []*model.PostPriority
		err := s.GetReplica().SelectBuilder(&priorityBatch, query)

		if err != nil {
			return nil, err
		}

		priority = append(priority, priorityBatch...)
	}

	return priority, nil
}

func (s *SqlPostPriorityStore) Save(priority *model.PostPriority) (*model.PostPriority, error) {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx, &err)

	// Delete existing priority
	deleteQuery := s.getQueryBuilder().
		Delete("PostsPriority").
		Where(sq.Eq{"PostId": priority.PostId})

	if _, err := tx.ExecBuilder(deleteQuery); err != nil {
		return nil, errors.Wrap(err, "delete_existing_priority")
	}

	// Insert new priority
	insertQuery := s.getQueryBuilder().
		Insert("PostsPriority").
		Columns("PostId", "ChannelId", "Priority", "RequestedAck", "PersistentNotifications").
		Values(priority.PostId, priority.ChannelId, priority.Priority, priority.RequestedAck, priority.PersistentNotifications)

	if _, err := tx.ExecBuilder(insertQuery); err != nil {
		return nil, errors.Wrap(err, "insert_priority")
	}

	// Handle persistent notifications - always delete first, then insert if enabled
	deletePersistentQuery := s.getQueryBuilder().
		Delete("PersistentNotifications").
		Where(sq.Eq{"PostId": priority.PostId})

	if _, err := tx.ExecBuilder(deletePersistentQuery); err != nil {
		return nil, errors.Wrap(err, "delete_persistent_notification")
	}

	if priority.PersistentNotifications != nil && *priority.PersistentNotifications {
		insertPersistentQuery := s.getQueryBuilder().
			Insert("PersistentNotifications").
			Columns("PostId", "CreateAt", "LastSentAt", "DeleteAt", "SentCount").
			Values(priority.PostId, model.GetMillis(), 0, 0, 0)

		if _, err := tx.ExecBuilder(insertPersistentQuery); err != nil {
			return nil, errors.Wrap(err, "insert_persistent_notification")
		}
	}

	// Clear acknowledgements if not requested
	if priority.RequestedAck == nil || !*priority.RequestedAck {
		clearAckQuery := s.getQueryBuilder().
			Update("PostAcknowledgements").
			Set("AcknowledgedAt", 0).
			Where(sq.Eq{"PostId": priority.PostId})

		if _, err := tx.ExecBuilder(clearAckQuery); err != nil {
			return nil, errors.Wrap(err, "clear_acknowledgements")
		}
	}

	// Update the post's UpdateAt to trigger clients to refresh
	updatePostQuery := s.getQueryBuilder().
		Update("Posts").
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": priority.PostId})

	if _, err := tx.ExecBuilder(updatePostQuery); err != nil {
		return nil, errors.Wrap(err, "update_post")
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return priority, nil
}

func (s *SqlPostPriorityStore) Delete(postId string) error {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx, &err)

	// Delete from PostsPriority
	deletePriorityQuery := s.getQueryBuilder().
		Delete("PostsPriority").
		Where(sq.Eq{"PostId": postId})

	if _, err := tx.ExecBuilder(deletePriorityQuery); err != nil {
		return errors.Wrap(err, "delete_priority")
	}

	// Delete from PersistentNotifications
	deletePersistentQuery := s.getQueryBuilder().
		Delete("PersistentNotifications").
		Where(sq.Eq{"PostId": postId})

	if _, err := tx.ExecBuilder(deletePersistentQuery); err != nil {
		return errors.Wrap(err, "delete_persistent_notification")
	}

	// Clear acknowledgements
	clearAckQuery := s.getQueryBuilder().
		Update("PostAcknowledgements").
		Set("AcknowledgedAt", 0).
		Where(sq.Eq{"PostId": postId})

	if _, err := tx.ExecBuilder(clearAckQuery); err != nil {
		return errors.Wrap(err, "clear_acknowledgements")
	}

	// Update post
	updatePostQuery := s.getQueryBuilder().
		Update("Posts").
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": postId})

	if _, err := tx.ExecBuilder(updatePostQuery); err != nil {
		return errors.Wrap(err, "update_post")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
