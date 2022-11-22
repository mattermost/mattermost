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

	builder := s.getQueryBuilder().
		Select("*").
		From("PersistentNotifications").
		Where(andCond)

	builder = getPersistentNotificationsPaginationBuilder(builder, params.Pagination)

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, false, err
	}

	var posts []*model.PostPersistentNotifications
	err = s.GetReplicaX().Select(&posts, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return []*model.PostPersistentNotifications{}, false, nil
		}
		return nil, false, errors.Wrap(err, "failed to get posts for persistent notifications")
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

func (s *SqlPostPersistentNotificationStore) Delete(postIds []string) error {
	if len(postIds) == 0 {
		return nil
	}

	query, args, err := s.getQueryBuilder().
		Update("PersistentNotifications").
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
