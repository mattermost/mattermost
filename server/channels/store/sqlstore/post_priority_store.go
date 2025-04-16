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

	// First delete any existing priority for this post
	if _, err := tx.Exec("DELETE FROM PostsPriority WHERE PostId = ?", priority.PostId); err != nil {
		return nil, errors.Wrap(err, "delete_existing_priority")
	}

	// Then insert the new priority
	if _, err := tx.Exec(
		`INSERT INTO PostsPriority 
			(PostId, ChannelId, Priority, RequestedAck, PersistentNotifications) 
		VALUES 
			(?, ?, ?, ?, ?)`,
		priority.PostId,
		priority.ChannelId,
		priority.Priority,
		priority.RequestedAck,
		priority.PersistentNotifications,
	); err != nil {
		return nil, errors.Wrap(err, "insert_priority")
	}

	// Handle persistent notifications if specified
	if priority.PersistentNotifications != nil && *priority.PersistentNotifications {
		// Delete any existing persistent notification entry
		if _, err := tx.Exec("DELETE FROM PersistentNotifications WHERE PostId = ?", priority.PostId); err != nil {
			return nil, errors.Wrap(err, "delete_existing_persistent_notification")
		}

		// Add persistent notification entry
		if _, err := tx.Exec(
			"INSERT INTO PersistentNotifications (PostId, CreateAt, LastSentAt, DeleteAt, SentCount) VALUES (?, ?, 0, 0, 0)",
			priority.PostId,
			model.GetMillis(),
		); err != nil {
			return nil, errors.Wrap(err, "insert_persistent_notification")
		}
	} else {
		// If persistent notifications are disabled, ensure any existing entry is deleted
		if _, err := tx.Exec("DELETE FROM PersistentNotifications WHERE PostId = ?", priority.PostId); err != nil {
			return nil, errors.Wrap(err, "delete_persistent_notification")
		}
	}

	// Handle requested acknowledgements if specified
	if priority.RequestedAck != nil && *priority.RequestedAck {
		// We don't have to do anything special for RequestedAck here
		// The flag is already stored in the PostsPriority table
		// The actual acknowledgements are created by users when they acknowledge the post
	} else {
		// If acknowledgements are being disabled, clear any existing acknowledgements
		// This ensures consistency between the RequestedAck flag and actual acknowledgements
		if _, err := tx.Exec("UPDATE PostAcknowledgements SET AcknowledgedAt = 0 WHERE PostId = ?", priority.PostId); err != nil {
			return nil, errors.Wrap(err, "clear_acknowledgements")
		}
	}

	// Update the post's UpdateAt to trigger clients to refresh
	if _, err := tx.Exec(
		"UPDATE Posts SET UpdateAt = ? WHERE Id = ?",
		model.GetMillis(),
		priority.PostId,
	); err != nil {
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

	// Delete the priority
	if _, err := tx.Exec("DELETE FROM PostsPriority WHERE PostId = ?", postId); err != nil {
		return errors.Wrap(err, "delete_priority")
	}

	// Also delete any persistent notification entry for this post
	if _, err := tx.Exec("DELETE FROM PersistentNotifications WHERE PostId = ?", postId); err != nil {
		return errors.Wrap(err, "delete_persistent_notification")
	}

	// Clear any acknowledgements for this post
	if _, err := tx.Exec("UPDATE PostAcknowledgements SET AcknowledgedAt = 0 WHERE PostId = ?", postId); err != nil {
		return errors.Wrap(err, "clear_acknowledgements")
	}

	// Update the post's UpdateAt to trigger clients to refresh
	if _, err := tx.Exec(
		"UPDATE Posts SET UpdateAt = ? WHERE Id = ?",
		model.GetMillis(),
		postId,
	); err != nil {
		return errors.Wrap(err, "update_post")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
