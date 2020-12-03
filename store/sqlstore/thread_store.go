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
	*SqlStore
}

func (s *SqlThreadStore) ClearCaches() {
}

func newSqlThreadStore(sqlStore *SqlStore) store.ThreadStore {
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

func (s *SqlThreadStore) GetThreadsForUser(userId string, opts model.GetUserThreadsOpts) (*model.Threads, error) {
	type JoinedThread struct {
		PostId       string
		ReplyCount   int64
		LastReplyAt  int64
		LastViewedAt int64
		Participants model.StringArray
		model.Post
	}
	var threads []*JoinedThread

	fetchConditions := sq.And{
		sq.Eq{"ThreadMemberships.UserId": userId},
		sq.Eq{"ThreadMemberships.Following": true},
	}
	if !opts.Deleted {
		fetchConditions = sq.And{fetchConditions, sq.Eq{"Posts.DeleteAt": 0}}
	}
	if opts.Since > 0 {
		fetchConditions = sq.And{fetchConditions, sq.GtOrEq{"Threads.LastReplyAt": opts.Since}}
	}
	pageSize := uint64(30)
	if opts.PageSize == 0 {
		pageSize = opts.PageSize
	}
	query, args, _ := s.getQueryBuilder().
		Select("Threads.*, Posts.*, ThreadMemberships.LastViewed as LastViewedAt").
		From("Threads").
		LeftJoin("Posts ON Posts.Id = Threads.PostId").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Threads.PostId").
		OrderBy("Threads.LastReplyAt DESC").
		Offset(pageSize * opts.Page).
		Limit(pageSize).
		Where(fetchConditions).ToSql()
	_, err := s.GetReplica().Select(&threads, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get threads for user id=%s", userId)
	}

	var userIds []string
	userIdMap := map[string]bool{}
	for _, thread := range threads {
		for _, participantId := range thread.Participants {
			if _, ok := userIdMap[participantId]; !ok {
				userIdMap[participantId] = true
				userIds = append(userIds, participantId)
			}
		}
	}
	var users []*model.User
	if opts.Extended {
		query, args, _ = s.getQueryBuilder().Select("*").From("Users").Where(sq.Eq{"Id": userIds}).ToSql()
		_, err = s.GetReplica().Select(&users, query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get threads for user id=%s", userId)
		}
	} else {
		for _, userId := range userIds {
			users = append(users, &model.User{Id: userId})
		}
	}

	result := &model.Threads{
		Total:   0,
		Threads: nil,
	}

	for _, thread := range threads {
		var participants []*model.User
		for _, participantId := range thread.Participants {
			var participant *model.User
			for _, u := range users {
				if u.Id == participantId {
					participant = u
					break
				}
			}
			if participant == nil {
				return nil, errors.New("cannot find thread participant with id=" + participantId)
			}
			participants = append(participants, participant)
		}
		result.Threads = append(result.Threads, &model.ThreadResponse{
			PostId:       thread.PostId,
			ReplyCount:   thread.ReplyCount,
			LastReplyAt:  thread.LastReplyAt,
			LastViewedAt: thread.LastViewedAt,
			Participants: participants,
			Post:         &thread.Post,
		})
	}

	return result, nil
}

func (s *SqlThreadStore) MarkAllAsRead(userId string, timestamp int64) error {
	query, args, _ := s.getQueryBuilder().Update("ThreadMemberships").Where(sq.Eq{"UserId": userId}).Set("LastViewed", timestamp).ToSql()
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s", userId)
	}
	return nil
}

func (s *SqlThreadStore) MarkAsRead(userId, threadId string, timestamp int64) error {
	query, args, _ := s.getQueryBuilder().Update("ThreadMemberships").Where(sq.Eq{"UserId": userId}, sq.Eq{"PostId": threadId}).Set("LastViewed", timestamp).ToSql()
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s thread_id=%v", userId, threadId)
	}
	return nil
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

func (s *SqlThreadStore) CreateMembershipIfNeeded(userId, postId string, following, incrementMentions, updateFollowing bool) error {
	membership, err := s.GetMembershipForUser(userId, postId)
	now := utils.MillisFromTime(time.Now())
	if err == nil {
		if (updateFollowing && !membership.Following || membership.Following != following) || incrementMentions {
			if updateFollowing {
				membership.Following = following
			}
			membership.LastUpdated = now
			if incrementMentions {
				membership.UnreadMentions += 1
			}
			_, err = s.UpdateMembership(membership)
		}
		return err
	}

	var nfErr *store.ErrNotFound

	if !errors.As(err, &nfErr) {
		return errors.Wrap(err, "failed to get thread membership")
	}
	mentions := 0
	if incrementMentions {
		mentions = 1
	}
	_, err = s.SaveMembership(&model.ThreadMembership{
		PostId:         postId,
		UserId:         userId,
		Following:      following,
		LastViewed:     0,
		LastUpdated:    now,
		UnreadMentions: int64(mentions),
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

func (s *SqlThreadStore) UpdateUnreadsByChannel(userId string, changedThreads []string, timestamp int64, updateViewedTimestamp bool) error {
	if len(changedThreads) == 0 {
		return nil
	}

	qb := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId, "PostId": changedThreads}).
		Set("LastUpdated", timestamp)

	if updateViewedTimestamp {
		qb = qb.Set("LastViewed", timestamp)
	}
	updateQuery, updateArgs, _ := qb.ToSql()

	if _, err := s.GetMaster().Exec(updateQuery, updateArgs...); err != nil {
		return errors.Wrap(err, "failed to update thread membership")
	}

	return nil
}

func (s *SqlThreadStore) GetPosts(threadId string, since int64) ([]*model.Post, error) {
	query, args, _ := s.getQueryBuilder().
		Select("*").
		From("Posts").
		Where(sq.Eq{"RootId": threadId}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.GtOrEq{"UpdateAt": since}).ToSql()
	var result []*model.Post
	if _, err := s.GetReplica().Select(&result, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to fetch thread posts")
	}
	return result, nil
}
