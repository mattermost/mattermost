// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
)

type SqlScheduledPostStore struct {
	*SqlStore
	maxMessageSizeOnce   sync.Once
	maxMessageSizeCached int
}

func newScheduledPostStore(sqlStore *SqlStore) *SqlScheduledPostStore {
	return &SqlScheduledPostStore{
		SqlStore:             sqlStore,
		maxMessageSizeCached: model.PostMessageMaxRunesV2,
	}
}

func (s *SqlScheduledPostStore) columns(prefix string) []string {
	if prefix != "" && !strings.HasSuffix(prefix, ".") {
		prefix = prefix + "."
	}

	return []string{
		prefix + "Id",
		prefix + "CreateAt",
		prefix + "UpdateAt",
		prefix + "UserId",
		prefix + "ChannelId",
		prefix + "RootId",
		prefix + "Message",
		prefix + "Props",
		prefix + "FileIds",
		prefix + "Priority",
		prefix + "ScheduledAt",
		prefix + "ProcessedAt",
		prefix + "ErrorCode",
	}
}

func (s *SqlScheduledPostStore) scheduledPostToSlice(scheduledPost *model.ScheduledPost) []any {
	return []any{
		scheduledPost.Id,
		scheduledPost.CreateAt,
		scheduledPost.UpdateAt,
		scheduledPost.UserId,
		scheduledPost.ChannelId,
		scheduledPost.RootId,
		scheduledPost.Message,
		model.StringInterfaceToJSON(scheduledPost.GetProps()),
		model.ArrayToJSON(scheduledPost.FileIds),
		model.StringInterfaceToJSON(scheduledPost.Priority),
		scheduledPost.ScheduledAt,
		scheduledPost.ProcessedAt,
		scheduledPost.ErrorCode,
	}
}

func (s *SqlScheduledPostStore) CreateScheduledPost(scheduledPost *model.ScheduledPost) (*model.ScheduledPost, error) {
	scheduledPost.PreSave()

	builder := s.getQueryBuilder().
		Insert("ScheduledPosts").
		Columns(s.columns("")...).
		Values(s.scheduledPostToSlice(scheduledPost)...)

	query, args, err := builder.ToSql()
	if err != nil {
		mlog.Error("SqlScheduledPostStore.CreateScheduledPost failed to generate SQL from query builder", mlog.Err(err))
		return nil, errors.Wrap(err, "SqlScheduledPostStore.CreateScheduledPost failed to generate SQL from query builder")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		mlog.Error("SqlScheduledPostStore.CreateScheduledPost failed to insert scheduled post", mlog.Err(err))
		return nil, errors.Wrap(err, "SqlScheduledPostStore.CreateScheduledPost failed to insert scheduled post")
	}

	return scheduledPost, nil
}

func (s *SqlScheduledPostStore) GetScheduledPostsForUser(userId, teamId string) ([]*model.ScheduledPost, error) {
	// return scheduled posts for this user for
	// specified team.
	//
	//An empty teamId fetches scheduled posts belonging to
	// DMs and GMs (DMs and GMs do not belong to any team

	// We're intentionally including scheduled posts from archived channels,
	// or channels the user no longer belongs to as we want to still show those
	// scheduled posts with appropriate error to the user.
	// This is why we're not joining with ChannelMembers, and directly
	// joining with Channels table.

	query := s.getQueryBuilder().
		Select(s.columns("sp")...).
		From("ScheduledPosts AS sp").
		InnerJoin("Channels as c on sp.ChannelId = c.Id").
		Where(sq.Eq{
			"sp.UserId": userId,
			"c.TeamId":  teamId,
		}).
		OrderBy("sp.ScheduledAt, sp.CreateAt")

	var scheduledPosts []*model.ScheduledPost

	if err := s.GetReplica().SelectBuilder(&scheduledPosts, query); err != nil {
		mlog.Error("SqlScheduledPostStore.GetScheduledPostsForUser: failed to fetch scheduled posts for user", mlog.String("user_id", userId), mlog.String("team_id", teamId), mlog.Err(err))

		return nil, errors.Wrapf(err, "SqlScheduledPostStore.GetScheduledPostsForUser: failed to fetch scheduled posts for user, userId: %s, teamID: %s", userId, teamId)
	}

	return scheduledPosts, nil
}

func (s *SqlScheduledPostStore) GetMaxMessageSize() int {
	s.maxMessageSizeOnce.Do(func() {
		var err error
		s.maxMessageSizeCached, err = s.SqlStore.determineMaxColumnSize("ScheduledPosts", "Message")
		if err != nil {
			mlog.Error("SqlScheduledPostStore.getMaxMessageSize: error occurred during determining max column size for ScheduledPosts.Message column", mlog.Err(err))
			return
		}
	})

	return s.maxMessageSizeCached
}

func (s *SqlScheduledPostStore) GetPendingScheduledPosts(beforeTime, afterTime int64, lastScheduledPostId string, perPage uint64) ([]*model.ScheduledPost, error) {
	query := s.getQueryBuilder().
		Select(s.columns("")...).
		From("ScheduledPosts").
		Where(sq.Eq{"ErrorCode": ""}).
		OrderBy("ScheduledAt DESC", "Id").
		Limit(perPage)

	if lastScheduledPostId == "" {
		query = query.Where(sq.And{
			sq.LtOrEq{"ScheduledAt": beforeTime},
			sq.GtOrEq{"ScheduledAt": afterTime},
		})
	}
	if lastScheduledPostId != "" {
		query = query.
			Where(sq.Or{
				sq.And{
					sq.LtOrEq{"ScheduledAt": beforeTime},
					sq.GtOrEq{"ScheduledAt": afterTime},
				},
				sq.And{
					sq.Eq{"ScheduledAt": beforeTime},
					sq.Gt{"Id": lastScheduledPostId},
				},
			})
	}

	var scheduledPosts []*model.ScheduledPost
	if err := s.GetReplica().SelectBuilder(&scheduledPosts, query); err != nil {
		mlog.Error(
			"SqlScheduledPostStore.GetPendingScheduledPosts: failed to fetch pending scheduled posts for processing",
			mlog.Int("before_time", beforeTime),
			mlog.String("last_scheduled_post_id", lastScheduledPostId),
			mlog.Uint("items_per_page", perPage), mlog.Err(err),
		)

		return nil, errors.Wrapf(
			err,
			"SqlScheduledPostStore.GetPendingScheduledPosts: failed to fetch pending scheduled posts for processing, before_time: %d, last_scheduled_post_id: %s, items_per_page: %d",
			beforeTime, lastScheduledPostId, perPage,
		)
	}

	return scheduledPosts, nil
}

func (s *SqlScheduledPostStore) PermanentlyDeleteScheduledPosts(scheduledPostIDs []string) error {
	if len(scheduledPostIDs) == 0 {
		return nil
	}

	query := s.getQueryBuilder().
		Delete("ScheduledPosts").
		Where(sq.Eq{"Id": scheduledPostIDs})

	sql, params, err := query.ToSql()
	if err != nil {
		errToReturn := errors.Wrapf(err, "PermanentlyDeleteScheduledPosts: failed to generate SQL query for permanently deleting batch of scheduled posts")
		s.Logger().Error(errToReturn.Error())
		return errToReturn
	}

	if _, err := s.GetMaster().Exec(sql, params...); err != nil {
		errToReturn := errors.Wrapf(err, "PermanentlyDeleteScheduledPosts: failed to delete batch of scheduled posts from database")
		s.Logger().Error(errToReturn.Error())
		return errToReturn
	}

	return nil
}

func (s *SqlScheduledPostStore) UpdatedScheduledPost(scheduledPost *model.ScheduledPost) error {
	scheduledPost.PreUpdate()

	builder := s.getQueryBuilder().
		Update("ScheduledPosts").
		SetMap(s.toUpdateMap(scheduledPost)).
		Where(sq.Eq{"Id": scheduledPost.Id})

	query, args, err := builder.ToSql()
	if err != nil {
		mlog.Error("SqlScheduledPostStore.UpdatedScheduledPost failed to generate SQL from updating scheduled posts", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.Err(err))
		return errors.Wrap(err, "SqlScheduledPostStore.UpdatedScheduledPost failed to generate SQL from bulk updating scheduled posts")
	}

	_, err = s.GetMaster().Exec(query, args...)
	if err != nil {
		mlog.Error("SqlScheduledPostStore.UpdatedScheduledPost failed to update scheduled post", mlog.String("scheduled_post_id", scheduledPost.Id), mlog.Err(err))
		return errors.Wrap(err, "SqlScheduledPostStore.UpdatedScheduledPost failed to update scheduled post")
	}

	return nil
}

func (s *SqlScheduledPostStore) toUpdateMap(scheduledPost *model.ScheduledPost) map[string]any {
	now := model.GetMillis()
	return map[string]any{
		"UpdateAt":    now,
		"Message":     scheduledPost.Message,
		"Props":       model.StringInterfaceToJSON(scheduledPost.GetProps()),
		"FileIds":     model.ArrayToJSON(scheduledPost.FileIds),
		"Priority":    model.StringInterfaceToJSON(scheduledPost.Priority),
		"ScheduledAt": scheduledPost.ScheduledAt,
		"ProcessedAt": now,
		"ErrorCode":   scheduledPost.ErrorCode,
	}
}

func (s *SqlScheduledPostStore) Get(scheduledPostId string) (*model.ScheduledPost, error) {
	query := s.getQueryBuilder().
		Select(s.columns("")...).
		From("ScheduledPosts").
		Where(sq.Eq{
			"Id": scheduledPostId,
		})

	scheduledPost := &model.ScheduledPost{}

	if err := s.GetReplica().GetBuilder(scheduledPost, query); err != nil {
		mlog.Error("SqlScheduledPostStore.Get: failed to get single scheduled post by ID from database", mlog.String("scheduled_post_id", scheduledPostId), mlog.Err(err))

		return nil, errors.Wrapf(err, "SqlScheduledPostStore.Get: failed to get single scheduled post by ID from database, scheduledPostId: %s", scheduledPostId)
	}

	return scheduledPost, nil
}

func (s *SqlScheduledPostStore) UpdateOldScheduledPosts(beforeTime int64) error {
	builder := s.getQueryBuilder().
		Update("ScheduledPosts").
		Set("ErrorCode", model.ScheduledPostErrorUnableToSend).
		Set("ProcessedAt", model.GetMillis()).
		Where(sq.And{
			sq.Eq{"ErrorCode": ""},
			sq.Lt{"ScheduledAt": beforeTime},
		})

	query, args, err := builder.ToSql()
	if err != nil {
		mlog.Error("SqlScheduledPostStore.UpdateOldScheduledPosts failed to generate SQL from updating old scheduled posts", mlog.Err(err))
		return errors.Wrap(err, "SqlScheduledPostStore.UpdateOldScheduledPosts failed to generate SQL from updating old scheduled posts")
	}

	_, err = s.GetMaster().Exec(query, args...)
	if err != nil {
		mlog.Error("SqlScheduledPostStore.UpdateOldScheduledPosts failed to update old scheduled posts", mlog.Err(err))
		return errors.Wrap(err, "SqlScheduledPostStore.UpdateOldScheduledPosts failed to update old scheduled posts")
	}

	return nil
}

func (s *SqlScheduledPostStore) PermanentDeleteByUser(userId string) error {
	query := s.getQueryBuilder().
		Delete("ScheduledPosts").
		Where(sq.Eq{"UserId": userId})

	sql, params, err := query.ToSql()
	if err != nil {
		errToReturn := errors.Wrapf(err, "PermanentDeleteByUser: failed to generate SQL query for permanently deleting scheduled posts by user")
		s.Logger().Error(errToReturn.Error())
		return errToReturn
	}

	if _, err := s.GetMaster().Exec(sql, params...); err != nil {
		errToReturn := errors.Wrapf(err, "PermanentDeleteByUser: failed to delete scheduled posts by user from database")
		s.Logger().Error(errToReturn.Error())
		return errToReturn
	}

	return nil
}
