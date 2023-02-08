// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
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

func (s *SqlPostPersistentNotificationStore) Get(params model.GetPersistentNotificationsPostsParams) ([]*model.PostPersistentNotifications, bool, error) {
	if params.Pagination.PerPage == 0 {
		params.Pagination.PerPage = 1000
	}

	builder := s.getQueryBuilder().
		Select("PostId, CreateAt, LastSentAt, DeleteAt, SentCount").
		From("PersistentNotifications").
		Where(sq.Eq{"DeleteAt": 0})

	if params.PostID != "" {
		builder = builder.Where(sq.Eq{"PostId": params.PostID})
	}
	if params.MaxCreateAt > 0 {
		builder = builder.Where(sq.LtOrEq{"CreateAt": params.MaxCreateAt})
	}
	if params.MaxLastSentAt > 0 {
		builder = builder.Where(sq.LtOrEq{"LastSentAt": params.MaxLastSentAt})
	}

	builder = getPersistentNotificationsPaginationBuilder(builder, params.Pagination)

	var posts []*model.PostPersistentNotifications
	err := s.GetReplicaX().SelectBuilder(&posts, builder)
	if err != nil {
		return nil, false, errors.Wrap(err, "failed to get notifications")
	}

	var hasNext bool
	if len(posts) == utils.MinInt(params.Pagination.PerPage, 1000)+1 {
		// Shave off the next-page item.
		posts = posts[:len(posts)-1]
		hasNext = true
	}
	return posts, hasNext, nil
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

func (s *SqlPostPersistentNotificationStore) UpdateLastActivity(postIds []string) error {
	count := len(postIds)
	if count == 0 {
		return nil
	}

	builder := s.getQueryBuilder().
		Update("PersistentNotifications").
		Set("LastSentAt", model.GetMillis()).
		Set("SentCount", sq.Expr("SentCount+1")).
		Where(sq.Eq{"PostId": postIds})

	_, err := s.GetMasterX().ExecBuilder(builder)
	if err != nil {
		return errors.Wrapf(err, "failed to update lastSentAt for posts %s", postIds)
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
		sq.Expr("Id = PostId"),
		sq.Eq{"ChannelId": channelIds},
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

func getPersistentNotificationsPaginationBuilder(builder sq.SelectBuilder, pagination model.CursorPagination) sq.SelectBuilder {
	if pagination.Direction == "up" {
		builder = builder.OrderBy("CreateAt ASC, PostId ASC")
	} else if pagination.Direction == "down" {
		builder = builder.OrderBy("CreateAt DESC, PostId DESC")
	}

	if pagination.FromCreateAt == 0 {
		return builder.Limit(uint64(utils.MinInt(pagination.PerPage, 1000) + 1))
	}

	var whereCreateAt sq.Sqlizer
	var whereID sq.Sqlizer
	if pagination.Direction == "up" {
		whereCreateAt = sq.Gt{"CreateAt": pagination.FromCreateAt}
		whereID = sq.Gt{"PostId": pagination.FromID}
	} else {
		whereCreateAt = sq.Lt{"CreateAt": pagination.FromCreateAt}
		whereID = sq.Lt{"PostId": pagination.FromID}
	}

	if pagination.FromID == "" {
		return builder.Where(whereCreateAt)
	}

	return builder.Where(sq.Or{
		whereCreateAt,
		sq.And{
			sq.Eq{"CreateAt": pagination.FromCreateAt},
			whereID,
		},
	})
}
