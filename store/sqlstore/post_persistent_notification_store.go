// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

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
	andCond := sq.And{
		sq.Eq{"DeleteAt": 0},
	}

	if params.PostID != "" {
		andCond = append(andCond, sq.Eq{"PostId": params.PostID})
	}
	if params.MaxCreateAt > 0 {
		andCond = append(andCond, sq.LtOrEq{"CreateAt": params.MaxCreateAt})
	}
	if params.MaxLastSentAt > 0 {
		andCond = append(andCond, sq.LtOrEq{"LastSentAt": params.MaxLastSentAt})
	}

	builder := s.getQueryBuilder().
		Select("*").
		From("PersistentNotifications").
		Where(andCond)

	builder = getPersistentNotificationsPaginationBuilder(builder, params.Pagination)

	var posts []*model.PostPersistentNotifications
	err := s.GetReplicaX().SelectBuilder(&posts, builder)
	if err != nil {
		if err == sql.ErrNoRows {
			return []*model.PostPersistentNotifications{}, false, nil
		}
		return nil, false, errors.Wrap(err, "failed to get notifications")
	}

	var hasNext bool
	if params.Pagination.PerPage != 0 {
		if len(posts) == utils.MinInt(params.Pagination.PerPage, paginationLimit)+1 {
			// Shave off the next-page item.
			posts = posts[:len(posts)-1]
			hasNext = true
		}
	}
	return posts, hasNext, nil
}

// Delete in batches of 1000
func (s *SqlPostPersistentNotificationStore) Delete(postIds []string) error {
	count := len(postIds)
	if count == 0 {
		return nil
	}

	deleteAt := model.GetMillis()
	for i := 0; i < count; i += paginationLimit {
		j := utils.MinInt(i+paginationLimit, count)

		builder := s.getQueryBuilder().
			Update("PersistentNotifications").
			Set("DeleteAt", deleteAt).
			Where(sq.Eq{"PostId": postIds[i:j]})

		_, err := s.GetMasterX().ExecBuilder(builder)
		if err != nil {
			return errors.Wrapf(err, "failed to delete notifications for posts %s", postIds[i:j])
		}
	}

	return nil
}

// UpdateLastSentAt in batches of 1000
func (s *SqlPostPersistentNotificationStore) UpdateLastSentAt(postIds []string) error {
	count := len(postIds)
	if count == 0 {
		return nil
	}

	lastSentAt := model.GetMillis()
	for i := 0; i < count; i += paginationLimit {
		j := utils.MinInt(i+paginationLimit, count)

		builder := s.getQueryBuilder().
			Update("PersistentNotifications").
			Set("LastSentAt", lastSentAt).
			Where(sq.Eq{"PostId": postIds[i:j]})

		_, err := s.GetMasterX().ExecBuilder(builder)
		if err != nil {
			return errors.Wrapf(err, "failed to update lastSentAt for posts %s", postIds[i:j])
		}
	}

	return nil
}

// DeleteByChannel in batches of 1000
func (s *SqlPostPersistentNotificationStore) DeleteByChannel(channelIds []string) error {
	count := len(channelIds)
	if count == 0 {
		return nil
	}

	deleteAt := model.GetMillis()
	for i := 0; i < count; i += paginationLimit {
		j := utils.MinInt(i+paginationLimit, count)

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
			sq.Eq{"ChannelId": channelIds[i:j]},
		})

		_, err := s.GetMasterX().ExecBuilder(builder)
		if err != nil {
			return errors.Wrapf(err, "failed to delete notifications for channels %s", channelIds[i:j])
		}
	}

	return nil
}

// DeleteByTeam in batches of 1000
func (s *SqlPostPersistentNotificationStore) DeleteByTeam(teamIds []string) error {
	count := len(teamIds)
	if count == 0 {
		return nil
	}

	deleteAt := model.GetMillis()
	for i := 0; i < count; i += paginationLimit {
		j := utils.MinInt(i+paginationLimit, count)

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
			sq.Eq{"Channels.TeamId": teamIds[i:j]},
		})

		_, err := s.GetMasterX().ExecBuilder(builder)
		if err != nil {
			return errors.Wrapf(err, "failed to delete notifications for teams %s", teamIds[i:j])
		}
	}

	return nil
}

func getPersistentNotificationsPaginationBuilder(builder sq.SelectBuilder, pagination model.CursorPagination) sq.SelectBuilder {
	var sort string
	if pagination.Direction != "" {
		if pagination.Direction == "up" {
			sort = "DESC"
		} else if pagination.Direction == "down" {
			sort = "ASC"
		}
	}
	if sort != "" {
		builder = builder.OrderBy("CreateAt " + sort + ", PostId " + sort)
	}

	if pagination.FromCreateAt != 0 {
		if pagination.Direction == "down" {
			direction := sq.Gt{"CreateAt": pagination.FromCreateAt}
			if pagination.FromID != "" {
				builder = builder.Where(sq.Or{
					direction,
					sq.And{
						sq.Eq{"CreateAt": pagination.FromCreateAt},
						sq.Gt{"PostId": pagination.FromID},
					},
				})
			} else {
				builder = builder.Where(direction)
			}
		} else {
			direction := sq.Lt{"CreateAt": pagination.FromCreateAt}
			if pagination.FromID != "" {
				builder = builder.Where(sq.Or{
					direction,
					sq.And{
						sq.Eq{"CreateAt": pagination.FromCreateAt},
						sq.Lt{"PostId": pagination.FromID},
					},
				})

			} else {
				builder = builder.Where(direction)
			}
		}
	}

	if pagination.PerPage != 0 {
		builder = builder.Limit(uint64(utils.MinInt(pagination.PerPage, paginationLimit) + 1))
	} else {
		builder = builder.Limit(uint64(paginationLimit + 1))
	}

	return builder
}
