// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"strconv"
	"time"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"
	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// JoinedThread allows querying the Threads + Posts table in a single query, before looking up
// users and unpacking into a model.ThreadResponse.
type JoinedThread struct {
	PostId         string
	ReplyCount     int64
	LastReplyAt    int64
	LastViewedAt   int64
	UnreadReplies  int64
	UnreadMentions int64
	Participants   model.StringArray
	ThreadDeleteAt int64
	TeamId         string
	IsUrgent       bool
	model.Post
}

func (thread *JoinedThread) toThreadResponse(users map[string]*model.User) *model.ThreadResponse {
	threadParticipants := make([]*model.User, 0, len(thread.Participants))
	for _, participantUserId := range thread.Participants {
		if participant, ok := users[participantUserId]; ok {
			threadParticipants = append(threadParticipants, participant)
		}
	}

	return &model.ThreadResponse{
		PostId:         thread.PostId,
		ReplyCount:     thread.ReplyCount,
		LastReplyAt:    thread.LastReplyAt,
		LastViewedAt:   thread.LastViewedAt,
		UnreadReplies:  thread.UnreadReplies,
		UnreadMentions: thread.UnreadMentions,
		Participants:   threadParticipants,
		Post:           thread.Post.ToNilIfInvalid(),
		DeleteAt:       thread.ThreadDeleteAt,
		IsUrgent:       thread.IsUrgent,
	}
}

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
			"COALESCE(Threads.ThreadDeleteAt, 0) AS DeleteAt",
			"COALESCE(Threads.ThreadTeamId, '') AS TeamId",
		).
		From("Threads")

	s.threadsAndPostsSelectQuery = s.getQueryBuilder().
		Select(
			"Threads.PostId",
			"Threads.ChannelId",
			"Threads.ReplyCount",
			"Threads.LastReplyAt",
			"Threads.Participants",
			"COALESCE(Threads.ThreadDeleteAt, 0) AS ThreadDeleteAt",
			"COALESCE(Threads.ThreadTeamId, '') AS TeamId",
		).
		From("Threads")
}

func (s *SqlThreadStore) Get(id string) (*model.Thread, error) {
	var thread model.Thread

	query := s.threadsSelectQuery.
		Where(sq.Eq{"PostId": id})

	err := s.GetReplicaX().GetBuilder(&thread, query)
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
		if opts.ExcludeDirect {
			query = query.Where(sq.Eq{"Threads.ThreadTeamId": teamId})
		} else {
			query = query.Where(
				sq.Or{
					sq.Eq{"Threads.ThreadTeamId": teamId},
					sq.Eq{"Threads.ThreadTeamId": ""},
				},
			)
		}
	}

	if !opts.Deleted {
		query = query.Where(sq.Eq{"COALESCE(Threads.ThreadDeleteAt, 0)": 0})
	}

	return query
}

// GetTotalUnreadThreads counts the number of unread threads for the given user, optionally
// constrained to the given team + DMs/GMs.
func (s *SqlThreadStore) GetTotalUnreadThreads(userId, teamId string, opts model.GetUserThreadsOpts) (int64, error) {
	query := s.getTotalThreadsQuery(userId, teamId, opts).
		Where(sq.Expr("ThreadMemberships.LastViewed < Threads.LastReplyAt"))

	var totalUnreadThreads int64
	err := s.GetReplicaX().GetBuilder(&totalUnreadThreads, query)
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

	var totalThreads int64
	err := s.GetReplicaX().GetBuilder(&totalThreads, query)
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
		if opts.ExcludeDirect {
			query = query.Where(sq.Eq{"Threads.ThreadTeamId": teamId})
		} else {
			query = query.Where(
				sq.Or{
					sq.Eq{"Threads.ThreadTeamId": teamId},
					sq.Eq{"Threads.ThreadTeamId": ""},
				},
			)
		}
	}

	if !opts.Deleted {
		query = query.Where(sq.Eq{"COALESCE(Threads.ThreadDeleteAt, 0)": 0})
	}

	err := s.GetReplicaX().GetBuilder(&totalUnreadMentions, query)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count unread mentions for user id=%s", userId)
	}

	return totalUnreadMentions, nil
}

// GetTotalUnreadUrgentMentions counts the number of unread mentions for the given user, optionally
// constrained to the given team + DMs/GMs.
func (s *SqlThreadStore) GetTotalUnreadUrgentMentions(userId, teamId string, opts model.GetUserThreadsOpts) (int64, error) {
	var totalUnreadUrgentMentions int64

	query := s.getQueryBuilder().
		Select("COALESCE(SUM(ThreadMemberships.UnreadMentions),0)").
		From("ThreadMemberships").
		Join("PostsPriority ON PostsPriority.PostId = ThreadMemberships.PostId").
		Where(sq.Eq{
			"ThreadMemberships.UserId":    userId,
			"ThreadMemberships.Following": true,
			"PostsPriority.Priority":      model.PostPriorityUrgent,
		})

	if teamId != "" || !opts.Deleted {
		query = query.Join("Threads ON Threads.PostId = ThreadMemberships.PostId")
	}

	if teamId != "" {
		if opts.ExcludeDirect {
			query = query.Where(sq.Eq{"Threads.ThreadTeamId": teamId})
		} else {
			query = query.Where(
				sq.Or{
					sq.Eq{"Threads.ThreadTeamId": teamId},
					sq.Eq{"Threads.ThreadTeamId": ""},
				},
			)
		}
	}

	if !opts.Deleted {
		query = query.
			Where(sq.Eq{"COALESCE(Threads.ThreadDeleteAt, 0)": 0})
	}

	err := s.GetReplicaX().GetBuilder(&totalUnreadUrgentMentions, query)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count unread urgent mentions for user id=%s", userId)
	}

	return totalUnreadUrgentMentions, nil
}

func (s *SqlThreadStore) GetThreadsForUser(userId, teamId string, opts model.GetUserThreadsOpts) ([]*model.ThreadResponse, error) {
	pageSize := uint64(30)
	if opts.PageSize != 0 {
		pageSize = opts.PageSize
	}

	unreadRepliesQuery := sq.
		Select("COUNT(Posts.Id)").
		From("Posts").
		Where(sq.Expr("Posts.RootId = ThreadMemberships.PostId")).
		Where(sq.Expr("Posts.CreateAt > ThreadMemberships.LastViewed"))

	if !opts.Deleted {
		unreadRepliesQuery = unreadRepliesQuery.Where(sq.Eq{"Posts.DeleteAt": 0})
	}

	query := s.threadsAndPostsSelectQuery.
		Column(postSliceCoalesceQuery()).
		Columns(
			"ThreadMemberships.LastViewed as LastViewedAt",
			"ThreadMemberships.UnreadMentions as UnreadMentions",
		).
		Column(sq.Alias(unreadRepliesQuery, "UnreadReplies")).
		Join("Posts ON Posts.Id = Threads.PostId").
		Join("ThreadMemberships ON ThreadMemberships.PostId = Threads.PostId")

	query = query.
		Where(sq.Eq{"ThreadMemberships.UserId": userId}).
		Where(sq.Eq{"ThreadMemberships.Following": true})

	if opts.IncludeIsUrgent {
		urgencyCase := sq.
			Case().
			When(sq.Eq{"PostsPriority.Priority": model.PostPriorityUrgent}, "true").
			Else("false")

		query = query.
			Column(sq.Alias(urgencyCase, "IsUrgent")).
			LeftJoin("PostsPriority ON PostsPriority.PostId = Threads.PostId")
	}

	// If a team is specified, constrain to channels in that team and if not excluded also return DMs/GMs without
	// a team at all.
	if teamId != "" {
		if opts.ExcludeDirect {
			query = query.Where(sq.Eq{"Threads.ThreadTeamId": teamId})
		} else {
			query = query.Where(
				sq.Or{
					sq.Eq{"Threads.ThreadTeamId": teamId},
					sq.Eq{"Threads.ThreadTeamId": ""},
				},
			)
		}
	}

	if !opts.Deleted {
		query = query.Where(sq.Or{
			sq.Eq{"Threads.ThreadDeleteAt": nil},
			sq.Eq{"Threads.ThreadDeleteAt": 0},
		})
	}

	if opts.Since > 0 {
		query = query.
			Where(sq.Or{
				sq.GtOrEq{"ThreadMemberships.LastUpdated": opts.Since},
				sq.GtOrEq{"Threads.LastReplyAt": opts.Since},
			})
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

	var threads []*JoinedThread
	err := s.GetReplicaX().SelectBuilder(&threads, query)
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
		result = append(result, thread.toThreadResponse(allParticipants))
	}

	return result, nil
}

// GetTeamsUnreadForUser returns the total unread threads and unread mentions
// for a user from all teams.
func (s *SqlThreadStore) GetTeamsUnreadForUser(userID string, teamIDs []string, includeUrgentMentionCount bool) (map[string]*model.TeamUnread, error) {
	fetchConditions := sq.And{
		sq.Eq{"ThreadMemberships.UserId": userID},
		sq.Eq{"ThreadMemberships.Following": true},
		sq.Eq{"Threads.ThreadTeamId": teamIDs},
		sq.Eq{"COALESCE(Threads.ThreadDeleteAt, 0)": 0},
	}

	var eg errgroup.Group

	unreadThreads := []struct {
		Count  int64
		TeamId string
	}{}
	unreadMentions := []struct {
		Count  int64
		TeamId string
	}{}
	unreadUrgentMentions := []struct {
		Count  int64
		TeamId string
	}{}

	// Running these concurrently hasn't shown any major downside
	// than running them serially. So using a bit of perf boost.
	// In any case, they will be replaced by computed columns later.
	eg.Go(func() error {
		repliesQuery := s.getQueryBuilder().
			Select("COUNT(Threads.PostId) AS Count, ThreadTeamId AS TeamId").
			From("Threads").
			LeftJoin("ThreadMemberships ON Threads.PostId = ThreadMemberships.PostId").
			Where(fetchConditions).
			Where("Threads.LastReplyAt > ThreadMemberships.LastViewed").
			GroupBy("Threads.ThreadTeamId")

		return errors.Wrap(s.GetReplicaX().SelectBuilder(&unreadThreads, repliesQuery), "failed to get total unread threads")
	})

	eg.Go(func() error {
		mentionsQuery := s.getQueryBuilder().
			Select("COALESCE(SUM(ThreadMemberships.UnreadMentions),0) AS Count, ThreadTeamId AS TeamId").
			From("ThreadMemberships").
			LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
			Where(fetchConditions).
			GroupBy("Threads.ThreadTeamId")

		return errors.Wrap(s.GetReplicaX().SelectBuilder(&unreadMentions, mentionsQuery), "failed to get total unread mentions")
	})

	if includeUrgentMentionCount {
		eg.Go(func() error {
			urgentMentionsQuery := s.getQueryBuilder().
				Select("COALESCE(SUM(ThreadMemberships.UnreadMentions),0) AS Count, ThreadTeamId AS TeamId").
				From("ThreadMemberships").
				LeftJoin("Threads ON Threads.PostId = ThreadMemberships.PostId").
				Join("PostsPriority ON PostsPriority.PostId = ThreadMemberships.PostId").
				Where(sq.Eq{"PostsPriority.Priority": model.PostPriorityUrgent}).
				Where(fetchConditions).
				GroupBy("Threads.ThreadTeamId")

			return errors.Wrap(s.GetReplicaX().SelectBuilder(&unreadUrgentMentions, urgentMentionsQuery), "failed to get total unread urgent mentions")
		})
	}

	// Wait for them to be over
	if err := eg.Wait(); err != nil {
		return nil, err
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
	for _, item := range unreadUrgentMentions {
		if _, ok := res[item.TeamId]; ok {
			res[item.TeamId].ThreadUrgentMentionCount = item.Count
		} else {
			res[item.TeamId] = &model.TeamUnread{
				ThreadUrgentMentionCount: item.Count,
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

	query := s.getQueryBuilder().
		Select("ThreadMemberships.UserId").
		From("ThreadMemberships").
		Where(fetchConditions)

	err := s.GetReplicaX().SelectBuilder(&users, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get thread followers for thread id=%s", threadID)
	}

	return users, nil
}

func (s *SqlThreadStore) GetThreadMembershipsForExport(postID string) ([]*model.ThreadMembershipForExport, error) {
	members := []*model.ThreadMembershipForExport{}

	fetchConditions := sq.And{
		sq.Eq{"PostId": postID},
		sq.Eq{"Following": true},
	}

	query := s.getQueryBuilder().
		Select("Users.Username, ThreadMemberships.LastViewed, ThreadMemberships.UnreadMentions").
		From("ThreadMemberships").
		InnerJoin("Users ON ThreadMemberships.UserId = Users.Id").
		Where(fetchConditions)

	err := s.GetReplicaX().SelectBuilder(&members, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get thread members for thread id=%s", postID)
	}

	return members, nil
}

func (s *SqlThreadStore) GetThreadForUser(threadMembership *model.ThreadMembership, extended, postPriorityEnabled bool) (*model.ThreadResponse, error) {
	if !threadMembership.Following {
		return nil, store.NewErrNotFound("ThreadMembership", "<following>")
	}

	unreadRepliesQuery := sq.
		Select("COUNT(Posts.Id)").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Posts.RootId": threadMembership.PostId},
			sq.Gt{"Posts.CreateAt": threadMembership.LastViewed},
			sq.Eq{"Posts.DeleteAt": 0},
		})

	query := s.threadsAndPostsSelectQuery

	for _, c := range postSliceColumns() {
		query = query.Column("Posts." + c)
	}

	var thread JoinedThread
	query = query.
		Column(sq.Alias(unreadRepliesQuery, "UnreadReplies")).
		LeftJoin("Posts ON Posts.Id = Threads.PostId").
		Where(sq.Eq{"Threads.PostId": threadMembership.PostId})

	if postPriorityEnabled {
		urgencyCase := sq.
			Case().
			When(sq.Eq{"PostsPriority.Priority": model.PostPriorityUrgent}, "true").
			Else("false")

		query = query.
			Column(sq.Alias(urgencyCase, "IsUrgent")).
			LeftJoin("PostsPriority ON PostsPriority.PostId = Threads.PostId")
	}

	err := s.GetReplicaX().GetBuilder(&thread, query)
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

	usersMap := make(map[string]*model.User)
	for _, user := range users {
		usersMap[user.Id] = user
	}

	return thread.toThreadResponse(usersMap), nil
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

	if _, err := s.GetMasterX().ExecBuilder(query); err != nil {
		return errors.Wrapf(err, "failed to mark all threads as read by channels for user id=%s", userID)
	}

	return nil
}

func (s *SqlThreadStore) MarkAllAsRead(userId string, threadIds []string) error {
	timestamp := model.GetMillis()

	query := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"PostId": threadIds}).
		Set("LastViewed", timestamp).
		Set("UnreadMentions", 0).
		Set("LastUpdated", model.GetMillis())

	_, err := s.GetMasterX().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to mark %d threads as read for user id=%s", len(threadIds), userId)
	}

	return nil
}

// MarkAllAsReadByTeam marks all threads for the given user in the given team as read from the
// current time.
func (s *SqlThreadStore) MarkAllAsReadByTeam(userId, teamId string) error {
	timestamp := model.GetMillis()

	var query sq.UpdateBuilder
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = s.getQueryBuilder().Update("ThreadMemberships").From("Threads")
	} else {
		query = s.getQueryBuilder().Update("ThreadMemberships", "Threads")
	}

	query = query.
		Where("Threads.PostId = ThreadMemberships.PostId").
		Where(sq.Eq{"ThreadMemberships.UserId": userId}).
		Where(sq.Or{sq.Eq{"Threads.ThreadTeamId": teamId}, sq.Eq{"Threads.ThreadTeamId": ""}}).
		Set("LastViewed", timestamp).
		Set("UnreadMentions", 0).
		Set("LastUpdated", timestamp)

	_, err := s.GetMasterX().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s", userId)
	}

	return nil
}

// MarkAsRead marks the given thread for the given user as unread from the given timestamp.
func (s *SqlThreadStore) MarkAsRead(userId, threadId string, timestamp int64) error {
	query := s.getQueryBuilder().
		Update("ThreadMemberships").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"PostId": threadId}).
		Set("LastViewed", timestamp).
		Set("LastUpdated", model.GetMillis())

	_, err := s.GetMasterX().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to update thread read state for user id=%s thread_id=%v", userId, threadId)
	}
	return nil
}

func (s *SqlThreadStore) saveMembership(ex sqlxExecutor, membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	query := s.getQueryBuilder().
		Insert("ThreadMemberships").
		Columns("PostId", "UserId", "Following", "LastViewed", "LastUpdated", "UnreadMentions").
		Values(membership.PostId, membership.UserId, membership.Following, membership.LastViewed, membership.LastUpdated, membership.UnreadMentions)

	_, err := ex.ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to save thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	return membership, nil
}

func (s *SqlThreadStore) UpdateMembership(membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	return s.updateMembership(s.GetMasterX(), membership)
}

func (s *SqlThreadStore) DeleteMembershipsForChannel(userID, channelID string) error {
	subQuery := s.getSubQueryBuilder().
		Select("1").
		From("Threads").
		Where(sq.And{
			sq.Expr("Threads.PostId = ThreadMemberships.PostId"),
			sq.Eq{"Threads.ChannelId": channelID},
		})

	query := s.getQueryBuilder().
		Delete("ThreadMemberships").
		Where(sq.Eq{"UserId": userID}).
		Where(sq.Expr("EXISTS (?)", subQuery))

	_, err := s.GetMasterX().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to remove thread memberships with userid=%s channelid=%s", userID, channelID)
	}

	return nil
}

func (s *SqlThreadStore) updateMembership(ex sqlxExecutor, membership *model.ThreadMembership) (*model.ThreadMembership, error) {
	query := s.getQueryBuilder().
		Update("ThreadMemberships").
		Set("Following", membership.Following).
		Set("LastViewed", membership.LastViewed).
		Set("LastUpdated", membership.LastUpdated).
		Set("UnreadMentions", membership.UnreadMentions).
		Where(sq.And{
			sq.Eq{"PostId": membership.PostId},
			sq.Eq{"UserId": membership.UserId},
		})

	_, err := ex.ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update thread membership with postid=%s userid=%s", membership.PostId, membership.UserId)
	}

	return membership, nil
}

func (s *SqlThreadStore) GetMembershipsForUser(userId, teamId string) ([]*model.ThreadMembership, error) {
	memberships := []*model.ThreadMembership{}

	query := s.getQueryBuilder().
		Select(
			"ThreadMemberships.PostId",
			"ThreadMemberships.UserId",
			"ThreadMemberships.Following",
			"ThreadMemberships.LastUpdated",
			"ThreadMemberships.LastViewed",
			"ThreadMemberships.UnreadMentions",
		).
		Join("Threads ON Threads.PostId = ThreadMemberships.PostId").
		From("ThreadMemberships").
		Where(sq.Or{sq.Eq{"Threads.ThreadTeamId": teamId}, sq.Eq{"Threads.ThreadTeamId": ""}}).
		Where(sq.Eq{"ThreadMemberships.UserId": userId})

	err := s.GetReplicaX().SelectBuilder(&memberships, query)
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
	query := s.getQueryBuilder().
		Select(
			"PostId",
			"UserId",
			"Following",
			"LastUpdated",
			"LastViewed",
			"UnreadMentions",
		).
		From("ThreadMemberships").
		Where(sq.And{
			sq.Eq{"PostId": postId},
			sq.Eq{"UserId": userId},
		})

	err := ex.GetBuilder(&membership, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Thread", postId)
		}
		return nil, errors.Wrapf(err, "failed to get thread membership with userid=%s postid=%s", userId, postId)
	}

	return &membership, nil
}

func (s *SqlThreadStore) DeleteMembershipForUser(userId string, postId string) error {
	query := s.getQueryBuilder().
		Delete("ThreadMemberships").
		Where(sq.And{
			sq.Eq{"PostId": postId},
			sq.Eq{"UserId": userId},
		})

	_, err := s.GetMasterX().ExecBuilder(query)
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
func (s *SqlThreadStore) MaintainMembership(userID, postID string, opts store.ThreadMembershipOpts) (_ *model.ThreadMembership, err error) {
	trx, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(trx, &err)

	membership, err := s.maintainMembershipTx(trx, userID, postID, opts)
	if err != nil {
		return nil, err
	}

	if err = trx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return membership, nil
}

func (s *SqlThreadStore) MaintainMultipleFromImport(memberships []*model.ThreadMembership) (_ []*model.ThreadMembership, err error) {
	trx, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(trx, &err)

	for _, member := range memberships {
		membership, err2 := s.maintainMembershipTx(trx, member.UserId, member.PostId, store.ThreadMembershipOpts{
			ImportData: &store.ThreadMembershipImportData{
				UnreadMentions: member.UnreadMentions,
				LastViewed:     member.LastViewed,
			},
		})
		if err2 != nil {
			return nil, err2
		}

		memberships = append(memberships, membership)
	}

	if err = trx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return memberships, nil
}

func (s *SqlThreadStore) maintainMembershipTx(trx *sqlxTxWrapper, userID, postID string, opts store.ThreadMembershipOpts) (_ *model.ThreadMembership, err error) {
	membership, err := s.getMembershipForUser(trx, userID, postID)
	now := utils.MillisFromTime(time.Now())
	// if membership exists, update it if:
	// a. user started/stopped following a thread
	// b. mention count changed
	// c. user viewed a thread
	// d. the membership is imported
	if err == nil {
		followingNeedsUpdate := (opts.UpdateFollowing && (membership.Following != opts.Following))
		if imported := opts.ImportData; imported != nil {
			// Only the active followers are getting exported, so we can safely assume
			// that the user is following the thread.
			if membership.LastUpdated > imported.LastViewed {
				// User may have stopped following the thread,
				// we need to be smart if we should activate the membership
				return membership, nil
			}
			membership.Following = true
			membership.LastUpdated = now
			membership.UnreadMentions = imported.UnreadMentions
			membership.LastViewed = imported.LastViewed
			if _, err = s.updateMembership(trx, membership); err != nil {
				return nil, err
			}

			if err = s.updateThreadParticipantsForUserTx(trx, postID, userID); err != nil {
				return nil, err
			}
		} else if followingNeedsUpdate || opts.IncrementMentions || opts.UpdateViewedTimestamp {
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

		return membership, err
	}

	var nfErr *store.ErrNotFound
	if !errors.As(err, &nfErr) {
		return nil, errors.Wrap(err, "failed to get thread membership")
	}

	membership = &model.ThreadMembership{
		PostId:      postID,
		UserId:      userID,
		Following:   opts.Following,
		LastUpdated: now,
	}
	if opts.ImportData != nil {
		membership.UnreadMentions = opts.ImportData.UnreadMentions
		membership.LastViewed = opts.ImportData.LastViewed
		membership.Following = true
		// If we are importing data, we need to update the thread participants regardless
		// of what is given from the options.
		opts.UpdateParticipants = true
	} else {
		if opts.IncrementMentions {
			membership.UnreadMentions = 1
		}
		if opts.UpdateViewedTimestamp {
			membership.LastViewed = now
		}
	}
	membership, err = s.saveMembership(trx, membership)
	if err != nil {
		return nil, err
	}

	if opts.UpdateParticipants {
		if err = s.updateThreadParticipantsForUserTx(trx, postID, userID); err != nil {
			return nil, err
		}
	}

	return membership, err
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
		StoreDeletedIds:     false,
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
		StoreDeletedIds:     false,
	}, s.SqlStore, cursor)
}

// DeleteOrphanedRows removes orphaned rows from Threads and ThreadMemberships
func (s *SqlThreadStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
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

	result, err := s.GetMasterX().Exec(threadMembershipsQuery, limit)
	if err != nil {
		return
	}
	deleted, err = result.RowsAffected()
	if err != nil {
		return
	}
	return
}

// return number of unread replies for a single thread
func (s *SqlThreadStore) GetThreadUnreadReplyCount(threadMembership *model.ThreadMembership) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(Posts.Id)").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Posts.RootId": threadMembership.PostId},
			sq.Gt{"Posts.CreateAt": threadMembership.LastViewed},
			sq.Eq{"Posts.DeleteAt": 0},
		})

	var unreadReplies int64
	err := s.GetReplicaX().GetBuilder(&unreadReplies, query)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to count unread reply count for post id=%s", threadMembership.PostId)
	}

	return unreadReplies, nil
}

// SaveMultipleMemberships saves multiple NEW thread memberships in a single query and meant to be used only in the import
// process. Unlike MaintainMembership, this method does not update the thread participants (which is handled separately
// in the post creation).
func (s *SqlThreadStore) SaveMultipleMemberships(memberships []*model.ThreadMembership) ([]*model.ThreadMembership, error) {
	if len(memberships) == 0 {
		return memberships, nil
	}

	query := s.getQueryBuilder().
		Insert("ThreadMemberships").
		Columns("PostId", "UserId", "Following", "LastViewed", "LastUpdated", "UnreadMentions")

	for _, member := range memberships {
		if err := member.IsValid(); err != nil {
			return memberships, err
		}
		member.LastUpdated = model.GetMillis()
		query = query.Values(member.PostId, member.UserId, member.Following, member.LastViewed, member.LastUpdated, member.UnreadMentions)
	}

	tx, err := s.GetMasterX().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx, &err)

	_, err = tx.ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to save thread memberships")
	}
	err = tx.Commit()
	if err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return memberships, nil
}

func (s *SqlThreadStore) updateThreadParticipantsForUserTx(trx *sqlxTxWrapper, postID, userID string) error {
	if s.DriverName() == model.DatabaseDriverPostgres {
		userIdParam, err := jsonArray([]string{userID}).Value()
		if err != nil {
			return err
		}
		if s.IsBinaryParamEnabled() {
			userIdParam = AppendBinaryFlag(userIdParam.([]byte))
		}

		if _, err := trx.ExecRaw(`UPDATE Threads
					SET participants = participants || $1::jsonb
					WHERE postid=$2
					AND NOT participants ? $3`, userIdParam, postID, userID); err != nil {
			return err
		}
	} else {
		// CONCAT('$[', JSON_LENGTH(Participants), ']') just generates $[n]
		// which is the positional syntax required for appending.
		if _, err := trx.Exec(`UPDATE Threads
			SET Participants = JSON_ARRAY_INSERT(Participants, CONCAT('$[', JSON_LENGTH(Participants), ']'), ?)
			WHERE PostId=?
			AND NOT JSON_CONTAINS(Participants, ?)`, userID, postID, strconv.Quote(userID)); err != nil {
			return err
		}
	}

	return nil
}
