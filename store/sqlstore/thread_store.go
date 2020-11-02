// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/pkg/errors"

	sq "github.com/Masterminds/squirrel"
)

type SqlThreadStore struct {
	SqlStore
}

func (s *SqlThreadStore) ClearCaches() {
}

func newSqlThreadStore(sqlStore SqlStore) store.ThreadStore {
	s := &SqlThreadStore{
		SqlStore: sqlStore,
	}

	for _, db := range sqlStore.GetAllConns() {
		tableThreads := db.AddTableWithName(model.Thread{}, "Threads").SetKeys(false, "PostId")
		tableThreads.ColMap("PostId").SetMaxSize(26)
		tableThreads.ColMap("ChannelId").SetMaxSize(26)
		tableThreads.ColMap("Participants").SetMaxSize(0)
		tableThreadMemberships := db.AddTableWithName(model.ThreadMembership{}, "ThreadMemberships").SetKeys(false, "PostId", "UserId")
		tableThreadMemberships.ColMap("PostId").SetMaxSize(26)
		tableThreadMemberships.ColMap("UserId").SetMaxSize(26)
	}

	return s
}

func threadSliceColumns() []string {
	return []string{"PostId", "ChannelId", "LastReplyAt", "ReplyCount", "Participants"}
}

func threadToSlice(thread *model.Thread) []interface{} {
	return []interface{}{
		thread.PostId,
		thread.ChannelId,
		thread.LastReplyAt,
		thread.ReplyCount,
		thread.Participants,
	}
}

func (s *SqlThreadStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_thread_memberships_last_update_at", "ThreadMemberships", "LastUpdated")
	s.CreateIndexIfNotExists("idx_thread_memberships_last_view_at", "ThreadMemberships", "LastViewed")
	s.CreateIndexIfNotExists("idx_thread_memberships_user_id", "ThreadMemberships", "UserId")
	s.CreateIndexIfNotExists("idx_threads_channel_id", "Threads", "ChannelId")
}

func (s *SqlThreadStore) SaveMultiple(threads []*model.Thread) ([]*model.Thread, int, error) {
	builder := s.getQueryBuilder().Insert("Threads").Columns(threadSliceColumns()...)
	for _, thread := range threads {
		builder = builder.Values(threadToSlice(thread)...)
	}
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, -1, errors.Wrap(err, "thread_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return nil, -1, errors.Wrap(err, "failed to save Post")
	}

	return threads, -1, nil
}

func (s *SqlThreadStore) Save(thread *model.Thread) (*model.Thread, error) {
	threads, _, err := s.SaveMultiple([]*model.Thread{thread})
	if err != nil {
		return nil, err
	}
	return threads[0], nil
}

func (s *SqlThreadStore) Update(thread *model.Thread) (*model.Thread, error) {
	if _, err := s.GetMaster().Update(thread); err != nil {
		return nil, errors.Wrapf(err, "failed to update thread with id=%s", thread.PostId)
	}

	return thread, nil
}

func (s *SqlThreadStore) Get(id string) (*model.Thread, error) {
	var thread model.Thread
	query, args, _ := s.getQueryBuilder().Select("*").From("Threads").Where(sq.Eq{"PostId": id}).ToSql()
	err := s.GetReplica().SelectOne(&thread, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", id)
		}

		return nil, errors.Wrapf(err, "failed to get thread with id=%s", id)
	}
	return &thread, nil
}

func (s *SqlThreadStore) Delete(threadId string) error {
	query, args, _ := s.getQueryBuilder().Delete("Threads").Where(sq.Eq{"PostId": threadId}).ToSql()
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to update threads")
	}

	return nil
}

func (s *SqlThreadStore) SaveMembership(membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	if err := s.GetMaster().Insert(membership); err != nil {
		return nil, errors.Wrapf(err, "failed to save thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	return membership, nil
}

func (s *SqlThreadStore) UpdateMembership(membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	if _, err := s.GetMaster().Update(membership); err != nil {
		return nil, errors.Wrapf(err, "failed to update thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	return membership, nil
}

func (s *SqlThreadStore) GetMembershipsForUser(userId string) ([]*model.ThreadMembership, error) {
	var memberships []*model.ThreadMembership
	_, err := s.GetReplica().Select(&memberships, "SELECT * from ThreadMemberships WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get thread membership with userid=%s", userId)
	}
	return memberships, nil
}

func (s *SqlThreadStore) GetMembershipForUser(userId, postId string) (*model.ThreadMembership, error) {
	var membership model.ThreadMembership
	err := s.GetReplica().SelectOne(&membership, "SELECT * from ThreadMemberships WHERE UserId = :UserId AND PostId = :PostId", map[string]interface{}{"UserId": userId, "PostId": postId})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", postId)
		}
		return nil, errors.Wrapf(err, "failed to get thread membership with userid=%s postid=%s", userId, postId)
	}
	return &membership, nil
}

func (s *SqlThreadStore) DeleteMembershipForUser(userId string, postId string) error {
	if _, err := s.GetMaster().Exec("DELETE FROM ThreadMemberships Where PostId = :PostId AND UserId = :UserId", map[string]interface{}{"PostId": postId, "UserId": userId}); err != nil {
		return errors.Wrap(err, "failed to update thread membership")
	}

	return nil
}

func (s *SqlThreadStore) CreateMembershipIfNeeded(userId, postId string) error {
	membership, err := s.GetMembershipForUser(userId, postId)
	now := utils.MillisFromTime(time.Now())
	if err == nil {
		if !membership.Following {
			membership.Following = true
			membership.LastUpdated = now
			_, err = s.UpdateMembership(membership)
		}
		return err
	}

	var nfErr *store.ErrNotFound

	if !errors.As(err, &nfErr) {
		return errors.Wrap(err, "failed to get thread membership")
	}
	_, err = s.SaveMembership(&model.ThreadMembership{
		PostId:      postId,
		UserId:      userId,
		Following:   true,
		LastViewed:  0,
		LastUpdated: now,
	})
	return err
}

func (s *SqlThreadStore) CollectThreadsWithNewerReplies(userId string, channelIds []string, timestamp int64) ([]string, error) {
	var changedThreads []string
	query, args, _ := s.getQueryBuilder().
		Select("Threads.PostId").
		From("Threads").
		LeftJoin("ChannelMembers ON ChannelMembers.ChannelId=Threads.ChannelId").
		Where(sq.And{
			sq.Eq{"Threads.ChannelId": channelIds},
			sq.Eq{"ChannelMembers.UserId": userId},
			sq.Or{
				sq.Expr("Threads.LastReplyAt >= ChannelMembers.LastViewedAt"),
				sq.GtOrEq{"Threads.LastReplyAt": timestamp},
			},
		}).
		ToSql()
	if _, err := s.GetReplica().Select(&changedThreads, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to fetch threads")
	}
	return changedThreads, nil
}

func (s *SqlThreadStore) UpdateUnreadsByChannel(userId string, changedThreads []string, timestamp int64) error {
	if len(changedThreads) == 0 {
		return nil
	}
	updateQuery, updateArgs, _ := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId, "PostId": changedThreads}).
		Set("LastUpdated", timestamp).
		Set("LastViewed", timestamp).
		ToSql()
	if _, err := s.GetMaster().Exec(updateQuery, updateArgs...); err != nil {
		return errors.Wrap(err, "failed to update thread membership")
	}

	return nil
}
