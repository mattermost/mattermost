// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
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

func (s *SqlThreadStore) GetThreadsForUser(userId, teamId string, opts model.GetUserThreadsOpts) (*model.Threads, error) {
	type JoinedThread struct {
		PostId         string
		ReplyCount     int64
		LastReplyAt    int64
		LastViewedAt   int64
		UnreadReplies  int64
		UnreadMentions int64
		Participants   model.StringArray
		model.Post
	}

	unreadRepliesQuery := "SELECT COUNT(Posts.Id) From Posts Where Posts.RootId=ThreadMemberships.PostId AND Posts.UpdateAt >= ThreadMemberships.LastViewed"
	fetchConditions := sq.And{
		sq.Or{sq.Eq{"Channels.TeamId": teamId}, sq.Eq{"Channels.TeamId": ""}},
		sq.Eq{"ThreadMemberships.UserId": userId},
		sq.Eq{"ThreadMemberships.Following": true},
	}
	if !opts.Deleted {
		fetchConditions = sq.And{fetchConditions, sq.Eq{"Posts.DeleteAt": 0}}
	}

	pageSize := uint64(30)
	if opts.PageSize != 0 {
		pageSize = opts.PageSize
	}

	totalUnreadThreadsChan := make(chan store.StoreResult, 1)
	totalCountChan := make(chan store.StoreResult, 1)
	totalUnreadMentionsChan := make(chan store.StoreResult, 1)
	threadsChan := make(chan store.StoreResult, 1)
	go func() {
		repliesQuery, repliesQueryArgs, _ := s.getQueryBuilder().
			Select("COUNT(Posts.Id)").
			From("Posts").
			LeftJoin("ThreadMemberships ON Posts.Id = ThreadMemberships.PostId").
			LeftJoin("Channels ON Posts.ChannelId = Channels.Id").
			Where(fetchConditions).
			Where("Posts.UpdateAt >= ThreadMemberships.LastViewed").ToSql()

		totalUnreadThreads, err := s.GetMaster().SelectInt(repliesQuery, repliesQueryArgs...)
		totalUnreadThreadsChan <- store.StoreResult{Data: totalUnreadThreads, NErr: errors.Wrapf(err, "failed to get count unread on threads for user id=%s", userId)}
		close(totalUnreadThreadsChan)
	}()
	go func() {
		newFetchConditions := fetchConditions

		if opts.Unread {
			newFetchConditions = sq.And{newFetchConditions, sq.Expr("ThreadMemberships.LastViewed < Threads.LastReplyAt")}
		}

		threadsQuery, threadsQueryArgs, _ := s.getQueryBuilder().
			Select("COUNT(ThreadMemberships.PostId)").
			LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
			LeftJoin("Channels ON Threads.ChannelId = Channels.Id").
			LeftJoin("Posts ON Posts.Id = ThreadMemberships.PostId").
			From("ThreadMemberships").
			Where(newFetchConditions).ToSql()

		totalCount, err := s.GetMaster().SelectInt(threadsQuery, threadsQueryArgs...)
		totalCountChan <- store.StoreResult{Data: totalCount, NErr: err}
		close(totalCountChan)
	}()
	go func() {
		mentionsQuery, mentionsQueryArgs, _ := s.getQueryBuilder().
			Select("COALESCE(SUM(ThreadMemberships.UnreadMentions),0)").
			From("ThreadMemberships").
			LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
			LeftJoin("Posts ON Posts.Id = ThreadMemberships.PostId").
			LeftJoin("Channels ON Threads.ChannelId = Channels.Id").
			Where(fetchConditions).ToSql()
		totalUnreadMentions, err := s.GetMaster().SelectInt(mentionsQuery, mentionsQueryArgs...)
		totalUnreadMentionsChan <- store.StoreResult{Data: totalUnreadMentions, NErr: err}
		close(totalUnreadMentionsChan)
	}()
	go func() {
		newFetchConditions := fetchConditions
		if opts.Since > 0 {
			newFetchConditions = sq.And{newFetchConditions, sq.GtOrEq{"ThreadMemberships.LastUpdated": opts.Since}}
		}
		order := "DESC"
		if opts.Before != "" {
			newFetchConditions = sq.And{
				newFetchConditions,
				sq.Expr(`LastReplyAt < (SELECT LastReplyAt FROM Threads WHERE PostId = ?)`, opts.Before),
			}
		}
		if opts.After != "" {
			order = "ASC"
			newFetchConditions = sq.And{
				newFetchConditions,
				sq.Expr(`LastReplyAt > (SELECT LastReplyAt FROM Threads WHERE PostId = ?)`, opts.After),
			}
		}
		if opts.Unread {
			newFetchConditions = sq.And{newFetchConditions, sq.Expr("ThreadMemberships.LastViewed < Threads.LastReplyAt")}
		}
		var threads []*JoinedThread
		query, args, _ := s.getQueryBuilder().
			Select("Threads.*, Posts.*, ThreadMemberships.LastViewed as LastViewedAt, ThreadMemberships.UnreadMentions as UnreadMentions").
			From("Threads").
			Column(sq.Alias(sq.Expr(unreadRepliesQuery), "UnreadReplies")).
			LeftJoin("Posts ON Posts.Id = Threads.PostId").
			LeftJoin("Channels ON Posts.ChannelId = Channels.Id").
			LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Threads.PostId").
			Where(newFetchConditions).
			OrderBy("Threads.LastReplyAt " + order).
			Limit(pageSize).ToSql()

		_, err := s.GetReplica().Select(&threads, query, args...)
		threadsChan <- store.StoreResult{Data: threads, NErr: err}
		close(threadsChan)
	}()

	threadsResult := <-threadsChan
	if threadsResult.NErr != nil {
		return nil, threadsResult.NErr
	}
	threads := threadsResult.Data.([]*JoinedThread)

	totalUnreadMentionsResult := <-totalUnreadMentionsChan
	if totalUnreadMentionsResult.NErr != nil {
		return nil, totalUnreadMentionsResult.NErr
	}
	totalUnreadMentions := totalUnreadMentionsResult.Data.(int64)

	totalCountResult := <-totalCountChan
	if totalCountResult.NErr != nil {
		return nil, totalCountResult.NErr
	}
	totalCount := totalCountResult.Data.(int64)

	totalUnreadThreadsResult := <-totalUnreadThreadsChan
	if totalUnreadThreadsResult.NErr != nil {
		return nil, totalUnreadThreadsResult.NErr
	}
	totalUnreadThreads := totalUnreadThreadsResult.Data.(int64)

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
		var err error
		users, err = s.User().GetProfileByIds(userIds, &store.UserGetByIdsOpts{}, true)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get threads for user id=%s", userId)
		}
	} else {
		for _, userId := range userIds {
			users = append(users, &model.User{Id: userId})
		}
	}

	result := &model.Threads{
		Total:               totalCount,
		Threads:             nil,
		TotalUnreadMentions: totalUnreadMentions,
		TotalUnreadThreads:  totalUnreadThreads,
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
			PostId:         thread.PostId,
			ReplyCount:     thread.ReplyCount,
			LastReplyAt:    thread.LastReplyAt,
			LastViewedAt:   thread.LastViewedAt,
			UnreadReplies:  thread.UnreadReplies,
			UnreadMentions: thread.UnreadMentions,
			Participants:   participants,
			Post:           &thread.Post,
		})
	}

	return result, nil
}
func (s *SqlThreadStore) GetThreadForUser(userId, teamId, threadId string, extended bool) (*model.ThreadResponse, error) {
	type JoinedThread struct {
		PostId         string
		Following      bool
		ReplyCount     int64
		LastReplyAt    int64
		LastViewedAt   int64
		UnreadReplies  int64
		UnreadMentions int64
		Participants   model.StringArray
		model.Post
	}

	unreadRepliesQuery := "SELECT COUNT(Posts.Id) From Posts Where Posts.RootId=ThreadMemberships.PostId AND Posts.UpdateAt >= ThreadMemberships.LastViewed AND Posts.DeleteAt=0"
	fetchConditions := sq.And{
		sq.Or{sq.Eq{"Channels.TeamId": teamId}, sq.Eq{"Channels.TeamId": ""}},
		sq.Eq{"ThreadMemberships.UserId": userId},
		sq.Eq{"Threads.PostId": threadId},
	}

	var thread JoinedThread
	query, args, _ := s.getQueryBuilder().
		Select("Threads.*, Posts.*, ThreadMemberships.LastViewed as LastViewedAt, ThreadMemberships.UnreadMentions as UnreadMentions, ThreadMemberships.Following").
		From("Threads").
		Column(sq.Alias(sq.Expr(unreadRepliesQuery), "UnreadReplies")).
		LeftJoin("Posts ON Posts.Id = Threads.PostId").
		LeftJoin("Channels ON Posts.ChannelId = Channels.Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Threads.PostId").
		Where(fetchConditions).ToSql()
	err := s.GetReplica().SelectOne(&thread, query, args...)

	if err != nil {
		return nil, err
	}

	if !thread.Following {
		return nil, nil // in case the thread is not followed anymore - return nil error to be interpreted as 404
	}

	var users []*model.User
	if extended {
		var err error
		users, err = s.User().GetProfileByIds(thread.Participants, &store.UserGetByIdsOpts{}, true)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get threads for user id=%s", userId)
		}
	} else {
		for _, userId := range thread.Participants {
			users = append(users, &model.User{Id: userId})
		}
	}

	result := &model.ThreadResponse{
		PostId:         thread.PostId,
		ReplyCount:     thread.ReplyCount,
		LastReplyAt:    thread.LastReplyAt,
		LastViewedAt:   thread.LastViewedAt,
		UnreadReplies:  thread.UnreadReplies,
		UnreadMentions: thread.UnreadMentions,
		Participants:   users,
		Post:           &thread.Post,
	}

	return result, nil
}

func (s *SqlThreadStore) MarkAllAsRead(userId, teamId string) error {
	memberships, err := s.GetMembershipsForUser(userId, teamId)
	if err != nil {
		return err
	}
	var membershipIds []string
	for _, m := range memberships {
		membershipIds = append(membershipIds, m.PostId)
	}
	timestamp := model.GetMillis()
	query, args, _ := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"PostId": membershipIds}).
		Where(sq.Eq{"UserId": userId}).
		Set("LastViewed", timestamp).
		Set("UnreadMentions", 0).
		ToSql()
	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s", userId)
	}
	return nil
}

func (s *SqlThreadStore) MarkAsRead(userId, threadId string, timestamp int64) error {
	query, args, _ := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"PostId": threadId}).
		Set("LastViewed", timestamp).
		ToSql()
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

func (s *SqlThreadStore) GetMembershipsForUser(userId, teamId string) ([]*model.ThreadMembership, error) {
	var memberships []*model.ThreadMembership

	query, args, _ := s.getQueryBuilder().
		Select("ThreadMemberships.*").
		Join("Threads ON Threads.PostId = ThreadMemberships.PostId").
		Join("Channels ON Threads.ChannelId = Channels.Id").
		From("ThreadMemberships").
		Where(sq.Or{sq.Eq{"Channels.TeamId": teamId}, sq.Eq{"Channels.TeamId": ""}}).
		Where(sq.Eq{"ThreadMemberships.UserId": userId}).
		ToSql()

	_, err := s.GetReplica().Select(&memberships, query, args...)
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
	if err != nil {
		return err
	}

	thread, err := s.Get(postId)
	if err != nil {
		return err
	}
	if !thread.Participants.Contains(userId) {
		thread.Participants = append(thread.Participants, userId)
		_, err = s.Update(thread)
	}
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
