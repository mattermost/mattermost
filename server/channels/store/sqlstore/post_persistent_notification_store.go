// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlPostPersistentNotificationStore struct {
	*SqlStore
}

func newSqlPostPersistentNotificationStore(sqlStore *SqlStore) store.PostPersistentNotificationStore {
	return &SqlPostPersistentNotificationStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPostPersistentNotificationStore) GetSingle(postID string) (*model.PostPersistentNotifications, error) {
	builder := s.getQueryBuilder().
		Select("PostId, CreateAt, LastSentAt, DeleteAt, SentCount").
		From("PersistentNotifications").
		Where(sq.And{
			sq.Eq{"DeleteAt": 0},
			sq.Eq{"PostId": postID},
		})

	post := &model.PostPersistentNotifications{}
	err := s.GetReplicaX().GetBuilder(post, builder)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Persistent Notification Post", postID)
		}
		return nil, errors.Wrapf(err, "failed to get the persistent notification post=%s", postID)
	}
	return post, nil
}

// Get returns only valid posts and then updates the tracking-counters for the returned posts.
func (s *SqlPostPersistentNotificationStore) Get(params model.GetPersistentNotificationsPostsParams) ([]*model.PostPersistentNotifications, error) {
	if params.PerPage == 0 {
		params.PerPage = 1000
	}

	var transaction *sqlxTxWrapper
	var err error

	if transaction, err = s.GetMasterX().Beginx(); err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	builder := s.getQueryBuilder().
		Select("PostId, CreateAt, LastSentAt, DeleteAt, SentCount").
		From("PersistentNotifications").
		Where(sq.And{
			sq.Eq{"DeleteAt": 0},
			sq.LtOrEq{"CreateAt": params.MaxCreateAt},
			sq.LtOrEq{"LastSentAt": params.MaxLastSentAt},
			sq.Lt{"SentCount": params.MaxSentCount},
		}).
		Limit(uint64(params.PerPage)).
		Suffix("for update")

	var posts []*model.PostPersistentNotifications
	err = transaction.SelectBuilder(&posts, builder)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get notifications")
	}

	postIds := make([]string, len(posts))
	for i := range posts {
		postIds[i] = posts[i].PostId
	}

	s.updateLastActivity(transaction, postIds)

	if err := transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}
	return posts, nil
}

func (s *SqlPostPersistentNotificationStore) updateLastActivity(transaction *sqlxTxWrapper, postIds []string) error {
	builder := s.getQueryBuilder().
		Update("PersistentNotifications").
		Set("LastSentAt", model.GetMillis()).
		Set("SentCount", sq.Expr("SentCount+1")).
		Where(sq.Eq{"PostId": postIds})

	_, err := transaction.ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to update last activity for posts %s", postIds)
	}

	return nil
}

func (s *SqlPostPersistentNotificationStore) Delete(postIds []string) error {
	count := len(postIds)
	if count == 0 {
		return nil
	}

	builder := s.getQueryBuilder().
		Update("PersistentNotifications").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"PostId": postIds})

	_, err := s.GetMasterX().ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to delete notifications for posts %s", postIds)
	}

	return nil
}

func (s *SqlPostPersistentNotificationStore) DeleteExpired(maxSentCount int16) error {
	builder := s.getQueryBuilder().
		Update("PersistentNotifications").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.And{
			sq.Eq{"DeleteAt": 0},
			sq.GtOrEq{"SentCount": maxSentCount},
		})

	_, err := s.GetMasterX().ExecBuilder(builder)
	if err != nil {
		return errors.Wrap(err, "failed to delete notifications")
	}

	return nil
}

func (s *SqlPostPersistentNotificationStore) DeleteByChannel(channelIds []string) error {
	count := len(channelIds)
	if count == 0 {
		return nil
	}

	deleteAt := model.GetMillis()
	var builder sq.UpdateBuilder
	builderType := s.getQueryBuilder()
	if s.DriverName() == model.DatabaseDriverMysql {
		builder = builderType.
			Update("PersistentNotifications, Posts").
			Set("PersistentNotifications.DeleteAt", deleteAt)
	}

	if s.DriverName() == model.DatabaseDriverPostgres {
		builder = builderType.
			Update("PersistentNotifications").
			Set("DeleteAt", deleteAt).
			From("Posts")
	}

	builder = builder.Where(sq.And{
		sq.Expr("Posts.Id = PersistentNotifications.PostId"),
		sq.Eq{"Posts.ChannelId": channelIds},
	})

	_, err := s.GetMasterX().ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to delete notifications for channels %s", channelIds)
	}

	return nil
}

func (s *SqlPostPersistentNotificationStore) DeleteByTeam(teamIds []string) error {
	count := len(teamIds)
	if count == 0 {
		return nil
	}

	deleteAt := model.GetMillis()
	var builder sq.UpdateBuilder
	builderType := s.getQueryBuilder()
	if s.DriverName() == model.DatabaseDriverMysql {
		builder = builderType.
			Update("PersistentNotifications, Posts, Channels").
			Set("PersistentNotifications.DeleteAt", deleteAt)
	}

	if s.DriverName() == model.DatabaseDriverPostgres {
		builder = builderType.
			Update("PersistentNotifications").
			Set("DeleteAt", deleteAt).
			From("Posts, Channels")
	}

	builder = builder.Where(sq.And{
		sq.Expr("Posts.Id = PersistentNotifications.PostId"),
		sq.Expr("Posts.ChannelId = Channels.Id"),
		sq.Eq{"Channels.TeamId": teamIds},
	})

	_, err := s.GetMasterX().ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to delete notifications for teams %s", teamIds)
	}

	return nil
}
