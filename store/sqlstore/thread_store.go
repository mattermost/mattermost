// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"strconv"
	"sync"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/utils"
)

type SqlThreadStore struct {
	*SqlStore

	// threadsSelectQuery is for querying directly into model.Thread
	threadsSelectQuery sq.SelectBuilder

	// threadsAndPostsSelectQuery is for querying into a struct embedding fields from
	// model.Thread and model.Post.
	threadsAndPostsSelectQuery sq.SelectBuilder
}

func (s *SqlThreadStore) ClearCaches() {
}

func newSqlThreadStore(sqlStore *SqlStore) store.ThreadStore {
	s := SqlThreadStore{
		SqlStore: sqlStore,
	}

	s.initializeQueries()

	return &s
}

func (s *SqlThreadStore) initializeQueries() {
	s.threadsSelectQuery = s.getQueryBuilder().
		Select(
			"Threads.PostId",
			"Threads.ChannelId",
			"Threads.ReplyCount",
			"Threads.LastReplyAt",
			"Threads.Participants",
			"COALESCE(Threads.DeleteAt, 0) AS DeleteAt",
		).
		From("Threads")

	s.threadsAndPostsSelectQuery = s.getQueryBuilder().
		Select(
			"Threads.PostId",
			"Threads.ChannelId",
			"Threads.ReplyCount",
			"Threads.LastReplyAt",
			"Threads.Participants",
			"COALESCE(Threads.DeleteAt, 0) AS ThreadDeleteAt",
		).
		From("Threads")
}

func (s *SqlThreadStore) Get(id string) (*model.Thread, error) {
	var thread model.Thread

	query, args, err := s.threadsSelectQuery.
		Where(sq.Eq{"PostId": id}).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "thread_tosql")
	}

	err = s.GetReplicaX().Get(&thread, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}

		return nil, errors.Wrapf(err, "failed to get thread with id=%s", id)
	}
	return &thread, nil
}

func (s *SqlThreadStore) getTotalThreadsQuery(userId, teamId string, opts model.GetUserThreadsOpts) sq.SelectBuilder {
	query := s.getQueryBuilder().
		Select("COUNT(ThreadMemberships.PostId)").
		From("ThreadMemberships").
		LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
		Where(sq.Eq{
			"ThreadMemberships.UserId":    userId,
			"ThreadMemberships.Following": true,
		})

	if teamId != "" {
		query = query.
			LeftJoin("Channels ON Threads.ChannelId = Channels.Id").
			Where(sq.Or{
				sq.Eq{"Channels.TeamId": teamId},
				sq.Eq{"Channels.TeamId": ""},
			})
	}

	if !opts.Deleted {
		query = query.Where(sq.Eq{"COALESCE(Threads.DeleteAt, 0)": 0})
	}

	return query
}

// GetTotalUnreadThreads counts the number of unread threads for the given user, optionally
// constrained to the given team + DMs/GMs.
func (s *SqlThreadStore) GetTotalUnreadThreads(userId, teamId string, opts model.GetUserThreadsOpts) (int64, error) {
	query := s.getTotalThreadsQuery(userId, teamId, opts).
		Where(sq.Expr("ThreadMemberships.LastViewed < Threads.LastReplyAt"))

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to build query to count unread threads for user id=%s", userId)
	}

	var totalUnreadThreads int64
	err = s.GetReplicaX().Get(&totalUnreadThreads, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count unread threads for user id=%s", userId)
	}

	return totalUnreadThreads, nil
}

// GetTotalUnreadThreads counts the number of threads for the given user, optionally constrained
// to the given team + DMs/GMs.
func (s *SqlThreadStore) GetTotalThreads(userId, teamId string, opts model.GetUserThreadsOpts) (int64, error) {
	if opts.Unread {
		return 0, errors.New("GetTotalThreads does not support the Unread flag; use GetTotalUnreadThreads instead")
	}

	query := s.getTotalThreadsQuery(userId, teamId, opts)

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to build query to count threads for user id=%s", userId)
	}

	var totalThreads int64
	err = s.GetReplicaX().Get(&totalThreads, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count threads for user id=%s", userId)
	}

	return totalThreads, nil
}

// GetTotalUnreadMentions counts the number of unread mentions for the given user, optionally
// constrained to the given team + DMs/GMs.
func (s *SqlThreadStore) GetTotalUnreadMentions(userId, teamId string, opts model.GetUserThreadsOpts) (int64, error) {
	var totalUnreadMentions int64

	query := s.getQueryBuilder().
		Select("COALESCE(SUM(ThreadMemberships.UnreadMentions),0)").
		From("ThreadMemberships").
		LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
		Where(sq.Eq{
			"ThreadMemberships.UserId":    userId,
			"ThreadMemberships.Following": true,
		})

	if teamId != "" {
		query = query.
			LeftJoin("Channels ON Threads.ChannelId = Channels.Id").
			Where(sq.Or{
				sq.Eq{"Channels.TeamId": teamId},
				sq.Eq{"Channels.TeamId": ""},
			})
	}

	if !opts.Deleted {
		query = query.Where(sq.Eq{"COALESCE(Threads.DeleteAt, 0)": 0})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to build query to count unread mentions for user id=%s", userId)
	}

	err = s.GetReplicaX().Get(&totalUnreadMentions, sql, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count unread mentions for user id=%s", userId)
	}

	return totalUnreadMentions, nil
}

func (s *SqlThreadStore) GetThreadsForUser(userId, teamId string, opts model.GetUserThreadsOpts) ([]*model.ThreadResponse, error) {
	pageSize := uint64(30)
	if opts.PageSize != 0 {
		pageSize = opts.PageSize
	}

	var threads []*struct {
		PostId         string
		ReplyCount     int64
		LastReplyAt    int64
		LastViewedAt   int64
		UnreadReplies  int64
		UnreadMentions int64
		Participants   model.StringArray
		ThreadDeleteAt int64
		model.Post
	}

	unreadRepliesQuery := sq.
		Select("COUNT(Posts.Id)").
		From("Posts").
		Where(sq.Expr("Posts.RootId = ThreadMemberships.PostId")).
		Where(sq.Expr("Posts.CreateAt > ThreadMemberships.LastViewed"))

	if !opts.Deleted {
		unreadRepliesQuery = unreadRepliesQuery.Where(sq.Eq{"Posts.DeleteAt": 0})
	}

	unreadRepliesSql, unreadRepliesArgs, err := unreadRepliesQuery.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build subquery to count unread replies when getting threads for user id=%s", userId)
	}

	query := s.threadsAndPostsSelectQuery.
		Column(postSliceCoalesceQuery()).
		Columns(
			"ThreadMemberships.LastViewed as LastViewedAt",
			"ThreadMemberships.UnreadMentions as UnreadMentions",
		).
		Column(sq.Alias(sq.Expr(unreadRepliesSql, unreadRepliesArgs...), "UnreadReplies")).
		Join("Posts ON Posts.Id = Threads.PostId").
		Join("ThreadMemberships ON ThreadMemberships.PostId = Threads.PostId")

	query = query.
		Where(sq.Eq{"ThreadMemberships.UserId": userId}).
		Where(sq.Eq{"ThreadMemberships.Following": true})

	// If a team is specified, constrain to channels in that team or DMs/GMs without
	// a team at all.
	if teamId != "" {
		query = query.
			Join("Channels ON Threads.ChannelId = Channels.Id").
			Where(sq.Or{
				sq.Eq{"Channels.TeamId": teamId},
				sq.Eq{"Channels.TeamId": ""},
			})
	}

	if !opts.Deleted {
		query = query.Where(sq.Or{
			sq.Eq{"Threads.DeleteAt": nil},
			sq.Eq{"Threads.DeleteAt": 0},
		})
	}

	if opts.Since > 0 {
		query = query.Where(sq.GtOrEq{"ThreadMemberships.LastUpdated": opts.Since})
	}

	if opts.Unread {
		query = query.Where(sq.Expr("ThreadMemberships.LastViewed < Threads.LastReplyAt"))
	}

	order := "DESC"
	if opts.Before != "" {
		query = query.Where(sq.Expr(`Threads.LastReplyAt < (SELECT LastReplyAt FROM Threads WHERE PostId = ?)`, opts.Before))
	}
	if opts.After != "" {
		order = "ASC"
		query = query.Where(sq.Expr(`Threads.LastReplyAt > (SELECT LastReplyAt FROM Threads WHERE PostId = ?)`, opts.After))
	}

	query = query.
		OrderBy("Threads.LastReplyAt " + order).
		Limit(pageSize)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to fetch threads for user id=%s", userId)
	}

	err = s.GetReplicaX().Select(&threads, sql, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch threads for user id=%s", userId)
	}

	// Build the de-duplicated set of user ids representing participants across all threads.
	var participantUserIds []string
	for _, thread := range threads {
		for _, participantUserId := range thread.Participants {
			participantUserIds = append(participantUserIds, participantUserId)
		}
	}
	participantUserIds = model.RemoveDuplicateStrings(participantUserIds)

	// Resolve the user objects for all participants, with extended metadata if requested.
	allParticipants := make(map[string]*model.User, len(participantUserIds))
	if opts.Extended {
		users, err := s.User().GetProfileByIds(context.Background(), participantUserIds, &store.UserGetByIdsOpts{}, true)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get %d thread profiles for user id=%s", len(participantUserIds), userId)
		}
		for _, user := range users {
			allParticipants[user.Id] = user
		}
	} else {
		for _, participantUserId := range participantUserIds {
			allParticipants[participantUserId] = &model.User{Id: participantUserId}
		}
	}

	result := make([]*model.ThreadResponse, 0, len(threads))
	for _, thread := range threads {
		// Find only this thread's participants
		threadParticipants := make([]*model.User, 0, len(thread.Participants))
		for _, participantUserId := range thread.Participants {
			participant, ok := allParticipants[participantUserId]
			if !ok {
				return nil, errors.Errorf("cannot find participant with user id=%s for thread id=%s", participantUserId, thread.PostId)
			}
			threadParticipants = append(threadParticipants, participant)
		}

		result = append(result, &model.ThreadResponse{
			PostId:         thread.PostId,
			ReplyCount:     thread.ReplyCount,
			LastReplyAt:    thread.LastReplyAt,
			LastViewedAt:   thread.LastViewedAt,
			UnreadReplies:  thread.UnreadReplies,
			UnreadMentions: thread.UnreadMentions,
			Participants:   threadParticipants,
			Post:           thread.Post.ToNilIfInvalid(),
			DeleteAt:       thread.ThreadDeleteAt,
		})
	}

	return result, nil
}

// GetTeamsUnreadForUser returns the total unread threads and unread mentions
// for a user from all teams.
func (s *SqlThreadStore) GetTeamsUnreadForUser(userID string, teamIDs []string) (map[string]*model.TeamUnread, error) {
	fetchConditions := sq.And{
		sq.Eq{"ThreadMemberships.UserId": userID},
		sq.Eq{"ThreadMemberships.Following": true},
		sq.Eq{"Channels.TeamId": teamIDs},
		sq.Eq{"COALESCE(Threads.DeleteAt, 0)": 0},
	}

	var wg sync.WaitGroup
	var err1, err2 error

	unreadThreads := []struct {
		Count  int64
		TeamId string
	}{}
	unreadMentions := []struct {
		Count  int64
		TeamId string
	}{}

	// Running these concurrently hasn't shown any major downside
	// than running them serially. So using a bit of perf boost.
	// In any case, they will be replaced by computed columns later.
	wg.Add(1)
	go func() {
		defer wg.Done()
		repliesQuery, repliesQueryArgs, err := s.getQueryBuilder().
			Select("COUNT(Threads.PostId) AS Count, TeamId").
			From("Threads").
			LeftJoin("ThreadMemberships ON Threads.PostId = ThreadMemberships.PostId").
			LeftJoin("Channels ON Threads.ChannelId = Channels.Id").
			Where(fetchConditions).
			Where("Threads.LastReplyAt > ThreadMemberships.LastViewed").
			GroupBy("Channels.TeamId").
			ToSql()
		if err != nil {
			err1 = errors.Wrap(err, "GetTotalUnreadThreads_Tosql")
			return
		}

		err = s.GetReplicaX().Select(&unreadThreads, repliesQuery, repliesQueryArgs...)
		if err != nil {
			err1 = errors.Wrap(err, "failed to get total unread threads")
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		mentionsQuery, mentionsQueryArgs, err := s.getQueryBuilder().
			Select("COALESCE(SUM(ThreadMemberships.UnreadMentions),0) AS Count, TeamId").
			From("ThreadMemberships").
			LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
			LeftJoin("Channels ON Threads.ChannelId = Channels.Id").
			Where(fetchConditions).
			GroupBy("Channels.TeamId").
			ToSql()
		if err != nil {
			err2 = errors.Wrap(err, "GetTotalUnreadMentions_Tosql")
		}

		err = s.GetReplicaX().Select(&unreadMentions, mentionsQuery, mentionsQueryArgs...)
		if err != nil {
			err2 = errors.Wrap(err, "failed to get total unread mentions")
		}
	}()

	// Wait for them to be over
	wg.Wait()

	if err1 != nil {
		return nil, err1
	}
	if err2 != nil {
		return nil, err2
	}

	res := make(map[string]*model.TeamUnread)
	// A bit of linear complexity here to create and return the map.
	// This makes it easy to consume the output in the app layer.
	for _, item := range unreadThreads {
		res[item.TeamId] = &model.TeamUnread{
			ThreadCount: item.Count,
		}
	}
	for _, item := range unreadMentions {
		if _, ok := res[item.TeamId]; ok {
			res[item.TeamId].ThreadMentionCount = item.Count
		} else {
			res[item.TeamId] = &model.TeamUnread{
				ThreadMentionCount: item.Count,
			}
		}
	}

	return res, nil
}

func (s *SqlThreadStore) GetThreadFollowers(threadID string, fetchOnlyActive bool) ([]string, error) {
	users := []string{}

	fetchConditions := sq.And{
		sq.Eq{"PostId": threadID},
	}

	if fetchOnlyActive {
		fetchConditions = sq.And{
			sq.Eq{"Following": true},
			fetchConditions,
		}
	}

	query, args, err := s.getQueryBuilder().
		Select("ThreadMemberships.UserId").
		From("ThreadMemberships").
		Where(fetchConditions).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to get thread followers for thread id=%s", threadID)
	}

	err = s.GetReplicaX().Select(&users, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get thread followers for thread id=%s", threadID)
	}

	return users, nil
}

func (s *SqlThreadStore) GetThreadForUser(teamId string, threadMembership *model.ThreadMembership, extended bool) (*model.ThreadResponse, error) {
	if !threadMembership.Following {
		return nil, nil // in case the thread is not followed anymore - return nil error to be interpreted as 404
	}

	type JoinedThread struct {
		PostId         string
		Following      bool
		ReplyCount     int64
		LastReplyAt    int64
		LastViewedAt   int64
		UnreadReplies  int64
		UnreadMentions int64
		Participants   model.StringArray
		ThreadDeleteAt int64
		model.Post
	}

	unreadRepliesQuery, unreadRepliesArgs, err := sq.
		Select("COUNT(Posts.Id)").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Posts.RootId": threadMembership.PostId},
			sq.Gt{"Posts.CreateAt": threadMembership.LastViewed},
			sq.Eq{"Posts.DeleteAt": 0},
		}).ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build subquery to count unread replies for getting thread for user id=%s, post id=%s", threadMembership.UserId, threadMembership.PostId)
	}

	fetchConditions := sq.And{
		sq.Or{sq.Eq{"Channels.TeamId": teamId}, sq.Eq{"Channels.TeamId": ""}},
		sq.Eq{"Threads.PostId": threadMembership.PostId},
	}

	query := s.threadsAndPostsSelectQuery

	for _, c := range postSliceColumns() {
		query = query.Column("Posts." + c)
	}

	var thread JoinedThread
	querySQL, threadArgs, err := query.
		Column(sq.Alias(sq.Expr(unreadRepliesQuery), "UnreadReplies")).
		LeftJoin("Posts ON Posts.Id = Threads.PostId").
		LeftJoin("Channels ON Posts.ChannelId = Channels.Id").
		Where(fetchConditions).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to get thread for user id=%s, post id=%s", threadMembership.UserId, threadMembership.PostId)
	}

	args := append(unreadRepliesArgs, threadArgs...)

	err = s.GetReplicaX().Get(&thread, querySQL, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", threadMembership.PostId)
		}
		return nil, errors.Wrapf(err, "failed to get thread for user id=%s, post id=%s", threadMembership.UserId, threadMembership.PostId)
	}

	thread.LastViewedAt = threadMembership.LastViewed
	thread.UnreadMentions = threadMembership.UnreadMentions

	users := []*model.User{}
	if extended {
		var err error
		users, err = s.User().GetProfileByIds(context.Background(), thread.Participants, &store.UserGetByIdsOpts{}, true)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get thread for user id=%s", threadMembership.UserId)
		}
	} else {
		for _, userId := range thread.Participants {
			users = append(users, &model.User{Id: userId})
		}
	}

	participants := []*model.User{}
	for _, participantId := range thread.Participants {
		var participant *model.User
		for _, u := range users {
			if u.Id == participantId {
				participant = u
				break
			}
		}
		if participant != nil {
			participants = append(participants, participant)
		}
	}

	result := &model.ThreadResponse{
		PostId:         thread.PostId,
		ReplyCount:     thread.ReplyCount,
		LastReplyAt:    thread.LastReplyAt,
		LastViewedAt:   thread.LastViewedAt,
		UnreadReplies:  thread.UnreadReplies,
		UnreadMentions: thread.UnreadMentions,
		Participants:   participants,
		Post:           thread.Post.ToNilIfInvalid(),
		DeleteAt:       thread.ThreadDeleteAt,
	}

	return result, nil
}

// MarkAllAsReadByChannels marks thread membership for the given users in the given channels
// as read. This is used by the application layer to keep threads up-to-date when CRT is disabled
// for the enduser, avoiding an influx of unread threads when first turning the feature on.
func (s *SqlThreadStore) MarkAllAsReadByChannels(userID string, channelIDs []string) error {
	if len(channelIDs) == 0 {
		return nil
	}

	now := model.GetMillis()

	var query sq.UpdateBuilder
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = s.getQueryBuilder().Update("ThreadMemberships").From("Threads")

	} else {
		query = s.getQueryBuilder().Update("ThreadMemberships", "Threads")
	}

	query = query.Set("LastViewed", now).
		Set("UnreadMentions", 0).
		Set("LastUpdated", now).
		Where(sq.Eq{"ThreadMemberships.UserId": userID}).
		Where(sq.Expr("Threads.PostId = ThreadMemberships.PostId")).
		Where(sq.Eq{"Threads.ChannelId": channelIDs}).
		Where(sq.Expr("Threads.LastReplyAt > ThreadMemberships.LastViewed"))

	sql, args, err := query.ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to build query to mark all as read by %d channels for user id=%s", len(channelIDs), userID)
	}

	if _, err := s.GetMasterX().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to mark all threads as read by channels for user id=%s", userID)
	}

	return nil
}

func (s *SqlThreadStore) MarkAllAsRead(userId string, threadIds []string) error {
	timestamp := model.GetMillis()

	query, args, err := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"PostId": threadIds}).
		Set("LastViewed", timestamp).
		Set("UnreadMentions", 0).
		Set("LastUpdated", model.GetMillis()).
		ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to build query to mark %d threads as read for user id=%s", len(threadIds), userId)
	}

	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to mark %d threads as read for user id=%s", len(threadIds), userId)
	}

	return nil
}

// MarkAllAsReadByTeam marks all threads for the given user in the given team as read from the
// current time.
func (s *SqlThreadStore) MarkAllAsReadByTeam(userId, teamId string) error {
	memberships, err := s.GetMembershipsForUser(userId, teamId)
	if err != nil {
		return err
	}
	membershipIds := []string{}
	for _, m := range memberships {
		membershipIds = append(membershipIds, m.PostId)
	}
	timestamp := model.GetMillis()
	query, args, err := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"PostId": membershipIds}).
		Where(sq.Eq{"UserId": userId}).
		Set("LastViewed", timestamp).
		Set("UnreadMentions", 0).
		Set("LastUpdated", model.GetMillis()).
		ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to build query to update thread read state for user id=%s", userId)
	}

	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s", userId)
	}
	return nil
}

// MarkAsRead marks the given thread for the given user as unread from the given timestamp.
func (s *SqlThreadStore) MarkAsRead(userId, threadId string, timestamp int64) error {
	query, args, err := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"PostId": threadId}).
		Set("LastViewed", timestamp).
		Set("LastUpdated", model.GetMillis()).
		ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to build query to update thread read state for user id=%s thread_id=%v", userId, threadId)
	}

	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s thread_id=%v", userId, threadId)
	}
	return nil
}

func (s *SqlThreadStore) saveMembership(ex sqlxExecutor, membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	query, args, err := s.getQueryBuilder().
		Insert("ThreadMemberships").
		Columns("PostId", "UserId", "Following", "LastViewed", "LastUpdated", "UnreadMentions").
		Values(membership.PostId, membership.UserId, membership.Following, membership.LastViewed, membership.LastUpdated, membership.UnreadMentions).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to save thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	_, err = ex.Exec(query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to save thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	return membership, nil
}

func (s *SqlThreadStore) UpdateMembership(membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	return s.updateMembership(s.GetMasterX(), membership)
}

func (s *SqlThreadStore) updateMembership(ex sqlxExecutor, membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	query, args, err := s.getQueryBuilder().
		Update("ThreadMemberships").
		Set("Following", membership.Following).
		Set("LastViewed", membership.LastViewed).
		Set("LastUpdated", membership.LastUpdated).
		Set("UnreadMentions", membership.UnreadMentions).
		Where(sq.And{
			sq.Eq{"PostId": membership.PostId},
			sq.Eq{"UserId": membership.UserId},
		}).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to update thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	_, err = ex.Exec(query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	return membership, nil
}

func (s *SqlThreadStore) GetMembershipsForUser(userId, teamId string) ([]*model.ThreadMembership, error) {
	memberships := []*model.ThreadMembership{}

	query, args, err := s.getQueryBuilder().
		Select("ThreadMemberships.*").
		Join("Threads ON Threads.PostId = ThreadMemberships.PostId").
		Join("Channels ON Threads.ChannelId = Channels.Id").
		From("ThreadMemberships").
		Where(sq.Or{sq.Eq{"Channels.TeamId": teamId}, sq.Eq{"Channels.TeamId": ""}}).
		Where(sq.Eq{"ThreadMemberships.UserId": userId}).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to get thread membership with userid=%s", userId)
	}

	err = s.GetReplicaX().Select(&memberships, query, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get thread membership with userid=%s", userId)
	}
	return memberships, nil
}

func (s *SqlThreadStore) GetMembershipForUser(userId, postId string) (*model.ThreadMembership, error) {
	return s.getMembershipForUser(s.GetReplicaX(), userId, postId)
}

func (s *SqlThreadStore) getMembershipForUser(ex sqlxExecutor, userId, postId string) (*model.ThreadMembership, error) {
	var membership model.ThreadMembership
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("ThreadMemberships").
		Where(sq.And{
			sq.Eq{"PostId": postId},
			sq.Eq{"UserId": userId},
		}).
		ToSql()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to build query to get thread membership with userid=%s postid=%s", userId, postId)
	}

	err = ex.Get(&membership, query, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", postId)
		}
		return nil, errors.Wrapf(err, "failed to get thread membership with userid=%s postid=%s", userId, postId)
	}

	return &membership, nil
}

func (s *SqlThreadStore) DeleteMembershipForUser(userId string, postId string) error {
	query, args, err := s.getQueryBuilder().
		Delete("ThreadMemberships").
		Where(sq.And{
			sq.Eq{"PostId": postId},
			sq.Eq{"UserId": userId},
		}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build query to delete thread membership")
	}

	_, err = s.GetMasterX().Exec(query, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete thread membership")
	}

	return nil
}

// MaintainMembership creates or updates a thread membership for the given user
// and post. This method is used to update the state of a membership in response
// to some events like:
// - post creation (mentions handling)
// - channel marked unread
// - user explicitly following a thread
func (s *SqlThreadStore) MaintainMembership(userId, postId string, opts store.ThreadMembershipOpts) (*model.ThreadMembership, error) {
	trx, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(trx)

	membership, err := s.getMembershipForUser(trx, userId, postId)
	now := utils.MillisFromTime(time.Now())
	// if membership exists, update it if:
	// a. user started/stopped following a thread
	// b. mention count changed
	// c. user viewed a thread
	if err == nil {
		followingNeedsUpdate := (opts.UpdateFollowing && (membership.Following != opts.Following))
		if followingNeedsUpdate || opts.IncrementMentions || opts.UpdateViewedTimestamp {
			if followingNeedsUpdate {
				membership.Following = opts.Following
			}
			if opts.UpdateViewedTimestamp {
				membership.LastViewed = now
				membership.UnreadMentions = 0
			} else if opts.IncrementMentions {
				membership.UnreadMentions += 1
			}
			membership.LastUpdated = now
			if _, err = s.updateMembership(trx, membership); err != nil {
				return nil, err
			}
		}

		if err = trx.Commit(); err != nil {
			return nil, errors.Wrap(err, "commit_transaction")
		}

		return membership, err
	}

	var nfErr *store.ErrNotFound
	if !errors.As(err, &nfErr) {
		return nil, errors.Wrap(err, "failed to get thread membership")
	}

	membership = &model.ThreadMembership{
		PostId:      postId,
		UserId:      userId,
		Following:   opts.Following,
		LastUpdated: now,
	}
	if opts.IncrementMentions {
		membership.UnreadMentions = 1
	}
	if opts.UpdateViewedTimestamp {
		membership.LastViewed = now
	}
	membership, err = s.saveMembership(trx, membership)
	if err != nil {
		return nil, err
	}

	if opts.UpdateParticipants {
		if s.DriverName() == model.DatabaseDriverPostgres {
			if _, err2 := trx.ExecRaw(`UPDATE Threads
                        SET participants = participants || $1::jsonb
                        WHERE postid=$2
                        AND NOT participants ? $3`, jsonArray([]string{userId}), postId, userId); err2 != nil {
				return nil, err2
			}
		} else {
			// CONCAT('$[', JSON_LENGTH(Participants), ']') just generates $[n]
			// which is the positional syntax required for appending.
			if _, err2 := trx.Exec(`UPDATE Threads
				SET Participants = JSON_ARRAY_INSERT(Participants, CONCAT('$[', JSON_LENGTH(Participants), ']'), ?)
				WHERE PostId=?
				AND NOT JSON_CONTAINS(Participants, ?)`, userId, postId, strconv.Quote(userId)); err2 != nil {
				return nil, err2
			}
		}
	}

	if err = trx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return membership, err
}

func (s *SqlThreadStore) GetPosts(threadId string, since int64) ([]*model.Post, error) {
	query, args, err := s.getQueryBuilder().
		Select("*").
		From("Posts").
		Where(sq.Eq{"RootId": threadId}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.GtOrEq{"CreateAt": since}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query to fetch thread posts")
	}

	result := []*model.Post{}
	err = s.GetReplicaX().Select(&result, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to fetch thread posts")
	}

	return result, nil
}

// PermanentDeleteBatchForRetentionPolicies deletes a batch of records which are affected by
// the global or a granular retention policy.
// See `genericPermanentDeleteBatchForRetentionPolicies` for details.
func (s *SqlThreadStore) PermanentDeleteBatchForRetentionPolicies(now, globalPolicyEndTime, limit int64, cursor model.RetentionPolicyCursor) (int64, model.RetentionPolicyCursor, error) {
	builder := s.getQueryBuilder().
		Select("Threads.PostId").
		From("Threads")
	return genericPermanentDeleteBatchForRetentionPolicies(RetentionPolicyBatchDeletionInfo{
		BaseBuilder:         builder,
		Table:               "Threads",
		TimeColumn:          "LastReplyAt",
		PrimaryKeys:         []string{"PostId"},
		ChannelIDTable:      "Threads",
		NowMillis:           now,
		GlobalPolicyEndTime: globalPolicyEndTime,
		Limit:               limit,
	}, s.SqlStore, cursor)
}

// PermanentDeleteBatchThreadMembershipsForRetentionPolicies deletes a batch of records
// which are affected by the global or a granular retention policy.
// See `genericPermanentDeleteBatchForRetentionPolicies` for details.
func (s *SqlThreadStore) PermanentDeleteBatchThreadMembershipsForRetentionPolicies(now, globalPolicyEndTime, limit int64, cursor model.RetentionPolicyCursor) (int64, model.RetentionPolicyCursor, error) {
	builder := s.getQueryBuilder().
		Select("ThreadMemberships.PostId").
		From("ThreadMemberships").
		InnerJoin("Threads ON ThreadMemberships.PostId = Threads.PostId")
	return genericPermanentDeleteBatchForRetentionPolicies(RetentionPolicyBatchDeletionInfo{
		BaseBuilder:         builder,
		Table:               "ThreadMemberships",
		TimeColumn:          "LastUpdated",
		PrimaryKeys:         []string{"PostId"},
		ChannelIDTable:      "Threads",
		NowMillis:           now,
		GlobalPolicyEndTime: globalPolicyEndTime,
		Limit:               limit,
	}, s.SqlStore, cursor)
}

// DeleteOrphanedRows removes orphaned rows from Threads and ThreadMemberships
func (s *SqlThreadStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	// We need the extra level of nesting to deal with MySQL's locking
	const threadsQuery = `
	DELETE FROM Threads WHERE PostId IN (
		SELECT * FROM (
			SELECT Threads.PostId FROM Threads
			LEFT JOIN Channels ON Threads.ChannelId = Channels.Id
			WHERE Channels.Id IS NULL
			LIMIT ?
		) AS A
	)`
	// We only delete a thread membership if the entire thread no longer exists,
	// not if the root post has been deleted
	const threadMembershipsQuery = `
	DELETE FROM ThreadMemberships WHERE PostId IN (
		SELECT * FROM (
			SELECT ThreadMemberships.PostId FROM ThreadMemberships
			LEFT JOIN Threads ON ThreadMemberships.PostId = Threads.PostId
			WHERE Threads.PostId IS NULL
			LIMIT ?
		) AS A
	)`
	result, err := s.GetMasterX().Exec(threadsQuery, limit)
	if err != nil {
		return
	}
	rpcDeleted, err := result.RowsAffected()
	if err != nil {
		return
	}
	result, err = s.GetMasterX().Exec(threadMembershipsQuery, limit)
	if err != nil {
		return
	}
	rptDeleted, err := result.RowsAffected()
	if err != nil {
		return
	}
	deleted = rpcDeleted + rptDeleted
	return
}

// return number of unread replies for a single thread
func (s *SqlThreadStore) GetThreadUnreadReplyCount(threadMembership *model.ThreadMembership) (unreadReplies int64, err error) {
	query, args, err := s.getQueryBuilder().
		Select("COUNT(Posts.Id)").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Posts.RootId": threadMembership.PostId},
			sq.Gt{"Posts.CreateAt": threadMembership.LastViewed},
			sq.Eq{"Posts.DeleteAt": 0},
		}).ToSql()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to build query to count unread reply count for post id=%s", threadMembership.PostId)
	}

	err = s.GetReplicaX().Get(&unreadReplies, query, args...)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count unread reply count for post id=%s", threadMembership.PostId)
	}

	return
}
