// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchlayer"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

// Regex to get quoted strings
var quotedStringsRegex = regexp.MustCompile(`("[^"]*")`)

type SqlPostStore struct {
	*SqlStore
	metrics           einterfaces.MetricsInterface
	maxPostSizeOnce   sync.Once
	maxPostSizeCached int
}

type postWithExtra struct {
	ThreadReplyCount   int64
	IsFollowing        *bool
	ThreadParticipants model.StringArray
	model.Post
}

func (s *SqlPostStore) ClearCaches() {
}

func postSliceColumnsWithTypes() []struct {
	Name string
	Type reflect.Kind
} {
	return []struct {
		Name string
		Type reflect.Kind
	}{
		{"Id", reflect.String},
		{"CreateAt", reflect.Int64},
		{"UpdateAt", reflect.Int64},
		{"EditAt", reflect.Int64},
		{"DeleteAt", reflect.Int64},
		{"IsPinned", reflect.Bool},
		{"UserId", reflect.String},
		{"ChannelId", reflect.String},
		{"RootId", reflect.String},
		{"OriginalId", reflect.String},
		{"Message", reflect.String},
		{"Type", reflect.String},
		{"Props", reflect.Map},
		{"Hashtags", reflect.String},
		{"Filenames", reflect.Slice},
		{"FileIds", reflect.Slice},
		{"HasReactions", reflect.Bool},
		{"RemoteId", reflect.String},
	}
}

func postToSlice(post *model.Post) []any {
	return []any{
		post.Id,
		post.CreateAt,
		post.UpdateAt,
		post.EditAt,
		post.DeleteAt,
		post.IsPinned,
		post.UserId,
		post.ChannelId,
		post.RootId,
		post.OriginalId,
		post.Message,
		post.Type,
		model.StringInterfaceToJSON(post.Props),
		post.Hashtags,
		model.ArrayToJSON(post.Filenames),
		model.ArrayToJSON(post.FileIds),
		post.HasReactions,
		post.RemoteId,
	}
}

func postSliceColumns() []string {
	colInfos := postSliceColumnsWithTypes()
	cols := make([]string, len(colInfos))
	for i, colInfo := range colInfos {
		cols[i] = colInfo.Name
	}
	return cols
}

func postSliceColumnsWithName(name string) []string {
	colInfos := postSliceColumnsWithTypes()
	cols := make([]string, len(colInfos))
	for i, colInfo := range colInfos {
		cols[i] = name + "." + colInfo.Name
	}
	return cols
}

func postSliceCoalesceQuery() string {
	colInfos := postSliceColumnsWithTypes()
	cols := make([]string, len(colInfos))
	for i, colInfo := range colInfos {
		var defaultValue string
		switch colInfo.Type {
		case reflect.String:
			defaultValue = "''"
		case reflect.Int64:
			defaultValue = "0"
		case reflect.Bool:
			defaultValue = "false"
		case reflect.Map:
			defaultValue = "'{}'"
		case reflect.Slice:
			defaultValue = "'[]'"
		}
		cols[i] = "COALESCE(Posts." + colInfo.Name + "," + defaultValue + ") AS " + colInfo.Name
	}
	return strings.Join(cols, ",")
}

func newSqlPostStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.PostStore {
	return &SqlPostStore{
		SqlStore:          sqlStore,
		metrics:           metrics,
		maxPostSizeCached: model.PostMessageMaxRunesV1,
	}
}

func (s *SqlPostStore) SaveMultiple(posts []*model.Post) ([]*model.Post, int, error) {
	channelNewPosts := make(map[string]int)
	channelNewRootPosts := make(map[string]int)
	maxDateNewPosts := make(map[string]int64)
	maxDateNewRootPosts := make(map[string]int64)
	rootIds := make(map[string]int)
	maxDateRootIds := make(map[string]int64)
	for idx, post := range posts {
		if post.Id != "" && !post.IsRemote() {
			return nil, idx, store.NewErrInvalidInput("Post", "id", post.Id)
		}
		post.PreSave()
		maxPostSize := s.GetMaxPostSize()
		if err := post.IsValid(maxPostSize); err != nil {
			return nil, idx, err
		}

		if currentChannelCount, ok := channelNewPosts[post.ChannelId]; !ok {
			if post.IsJoinLeaveMessage() {
				channelNewPosts[post.ChannelId] = 0
			} else {
				channelNewPosts[post.ChannelId] = 1
			}
			maxDateNewPosts[post.ChannelId] = post.CreateAt
		} else {
			if !post.IsJoinLeaveMessage() {
				channelNewPosts[post.ChannelId] = currentChannelCount + 1
			}
			if post.CreateAt > maxDateNewPosts[post.ChannelId] {
				maxDateNewPosts[post.ChannelId] = post.CreateAt
			}
		}

		if post.RootId == "" {
			if currentChannelCount, ok := channelNewRootPosts[post.ChannelId]; !ok {
				if post.IsJoinLeaveMessage() {
					channelNewRootPosts[post.ChannelId] = 0
				} else {
					channelNewRootPosts[post.ChannelId] = 1
				}
				maxDateNewRootPosts[post.ChannelId] = post.CreateAt
			} else {
				if !post.IsJoinLeaveMessage() {
					channelNewRootPosts[post.ChannelId] = currentChannelCount + 1
				}
				if post.CreateAt > maxDateNewRootPosts[post.ChannelId] {
					maxDateNewRootPosts[post.ChannelId] = post.CreateAt
				}
			}
			continue
		}

		if currentRootCount, ok := rootIds[post.RootId]; !ok {
			rootIds[post.RootId] = 1
			maxDateRootIds[post.RootId] = post.CreateAt
		} else {
			rootIds[post.RootId] = currentRootCount + 1
			if post.CreateAt > maxDateRootIds[post.RootId] {
				maxDateRootIds[post.RootId] = post.CreateAt
			}
		}
	}

	builder := s.getQueryBuilder().Insert("Posts").Columns(postSliceColumns()...)
	for _, post := range posts {
		builder = builder.Values(postToSlice(post)...)
	}
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, -1, errors.Wrap(err, "post_tosql")
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return posts, -1, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	if _, err = transaction.Exec(query, args...); err != nil {
		return nil, -1, errors.Wrap(err, "failed to save Post")
	}

	if err = s.updateThreadsFromPosts(transaction, posts); err != nil {
		return nil, -1, errors.Wrap(err, "update thread from posts failed")
	}

	if err = s.savePostsPriority(transaction, posts); err != nil {
		return nil, -1, errors.Wrap(err, "failed to save PostPriority")
	}

	if err = s.savePostsPersistentNotifications(transaction, posts); err != nil {
		return nil, -1, errors.Wrap(err, "failed to save posts persistent notifications")
	}

	if err = transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return posts, -1, errors.Wrap(err, "commit_transaction")
	}

	for channelId, count := range channelNewPosts {
		countRoot := channelNewRootPosts[channelId]

		if _, err = s.GetMaster().NamedExec(`UPDATE Channels
			SET LastPostAt = GREATEST(:lastpostat, LastPostAt),
				LastRootPostAt = GREATEST(:lastrootpostat, LastRootPostAt),
				TotalMsgCount = TotalMsgCount + :count,
				TotalMsgCountRoot = TotalMsgCountRoot + :countroot
			WHERE Id = :channelid`, map[string]any{
			"lastpostat":     maxDateNewPosts[channelId],
			"lastrootpostat": maxDateNewRootPosts[channelId],
			"channelid":      channelId,
			"count":          count,
			"countroot":      countRoot,
		}); err != nil {
			mlog.Warn("Error updating Channel LastPostAt.", mlog.Err(err))
		}
	}

	for rootId := range rootIds {
		if _, err = s.GetMaster().Exec("UPDATE Posts SET UpdateAt = ? WHERE Id = ?", maxDateRootIds[rootId], rootId); err != nil {
			mlog.Warn("Error updating Post UpdateAt.", mlog.Err(err))
		}
	}

	var unknownRepliesPosts []*model.Post
	for _, post := range posts {
		if post.RootId == "" {
			count, ok := rootIds[post.Id]
			if ok {
				post.ReplyCount += int64(count)
			}
		} else {
			unknownRepliesPosts = append(unknownRepliesPosts, post)
		}
	}

	if len(unknownRepliesPosts) > 0 {
		if err := s.populateReplyCount(unknownRepliesPosts); err != nil {
			mlog.Warn("Unable to populate the reply count in some posts.", mlog.Err(err))
		}
	}

	return posts, -1, nil
}

func (s *SqlPostStore) Save(rctx request.CTX, post *model.Post) (*model.Post, error) {
	posts, _, err := s.SaveMultiple([]*model.Post{post})
	if err != nil {
		return nil, err
	}
	return posts[0], nil
}

func (s *SqlPostStore) populateReplyCount(posts []*model.Post) error {
	rootIds := []string{}
	for _, post := range posts {
		rootIds = append(rootIds, post.RootId)
	}
	countList := []struct {
		RootId string
		Count  int64
	}{}
	query := s.getQueryBuilder().
		Select("RootId, COUNT(Id) AS Count").
		From("Posts").
		Where(sq.Eq{"RootId": rootIds}).
		Where(sq.Eq{"Posts.DeleteAt": 0}).
		GroupBy("RootId")

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "post_tosql")
	}
	err = s.GetMaster().Select(&countList, queryString, args...)
	if err != nil {
		return errors.Wrap(err, "failed to count Posts")
	}

	counts := map[string]int64{}
	for _, count := range countList {
		counts[count.RootId] = count.Count
	}

	for _, post := range posts {
		count, ok := counts[post.RootId]
		if !ok {
			post.ReplyCount = 0
		}
		post.ReplyCount = count
	}

	return nil
}

func (s *SqlPostStore) Update(rctx request.CTX, newPost *model.Post, oldPost *model.Post) (*model.Post, error) {
	newPost.UpdateAt = model.GetMillis()
	newPost.PreCommit()

	oldPost.DeleteAt = newPost.UpdateAt
	oldPost.UpdateAt = newPost.UpdateAt
	oldPost.OriginalId = oldPost.Id
	oldPost.Id = model.NewId()
	oldPost.PreCommit()

	maxPostSize := s.GetMaxPostSize()

	if err := newPost.IsValid(maxPostSize); err != nil {
		return nil, err
	}

	if _, err := s.GetMaster().NamedExec(`UPDATE Posts
		SET CreateAt=:CreateAt,
			UpdateAt=:UpdateAt,
			EditAt=:EditAt,
			DeleteAt=:DeleteAt,
			IsPinned=:IsPinned,
			UserId=:UserId,
			ChannelId=:ChannelId,
			RootId=:RootId,
			OriginalId=:OriginalId,
			Message=:Message,
			Type=:Type,
			Props=:Props,
			Hashtags=:Hashtags,
			Filenames=:Filenames,
			FileIds=:FileIds,
			HasReactions=:HasReactions,
			RemoteId=:RemoteId
		WHERE
			Id=:Id
		`, newPost); err != nil {
		return nil, errors.Wrapf(err, "failed to update Post with id=%s", newPost.Id)
	}

	time := model.GetMillis()
	if _, err := s.GetMaster().Exec("UPDATE Channels SET LastPostAt = ?  WHERE Id = ? AND LastPostAt < ?", time, newPost.ChannelId, time); err != nil {
		return nil, errors.Wrap(err, "failed to update lastpostat of channels")
	}

	if newPost.RootId != "" {
		if _, err := s.GetMaster().Exec("UPDATE Posts SET UpdateAt = ? WHERE Id = ? AND UpdateAt < ?", time, newPost.RootId, time); err != nil {
			return nil, errors.Wrap(err, "failed to update updateAt of posts")
		}
	}

	// mark the old post as deleted
	builder := s.getQueryBuilder().
		Insert("Posts").
		Columns(postSliceColumns()...).
		Values(postToSlice(oldPost)...)
	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}
	_, err = s.GetMaster().Exec(query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to insert the old post")
	}

	return newPost, nil
}

func (s *SqlPostStore) OverwriteMultiple(posts []*model.Post) (_ []*model.Post, _ int, err error) {
	updateAt := model.GetMillis()
	maxPostSize := s.GetMaxPostSize()
	for idx, post := range posts {
		post.UpdateAt = updateAt
		if appErr := post.IsValid(maxPostSize); appErr != nil {
			return nil, idx, appErr
		}
	}

	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, -1, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(tx, &err)

	for idx, post := range posts {
		if _, err2 := tx.NamedExec(`UPDATE Posts
				SET CreateAt=:CreateAt,
					UpdateAt=:UpdateAt,
					EditAt=:EditAt,
					DeleteAt=:DeleteAt,
					IsPinned=:IsPinned,
					UserId=:UserId,
					ChannelId=:ChannelId,
					RootId=:RootId,
					OriginalId=:OriginalId,
					Message=:Message,
					Type=:Type,
					Props=:Props,
					Hashtags=:Hashtags,
					Filenames=:Filenames,
					FileIds=:FileIds,
					HasReactions=:HasReactions,
					RemoteId=:RemoteId
				WHERE
					Id=:Id
			`, post); err2 != nil {
			return nil, idx, errors.Wrapf(err2, "failed to update Post with id=%s", post.Id)
		}
		if post.RootId != "" {
			if _, err2 := tx.Exec("UPDATE Threads SET LastReplyAt = ? WHERE PostId = ?", updateAt, post.Id); err2 != nil {
				return nil, idx, errors.Wrapf(err2, "failed to update Threads with postid=%s", post.Id)
			}
		}
	}
	err = tx.Commit()
	if err != nil {
		return nil, -1, errors.Wrap(err, "commit_transaction")
	}

	return posts, -1, nil
}

func (s *SqlPostStore) Overwrite(rctx request.CTX, post *model.Post) (*model.Post, error) {
	posts, _, err := s.OverwriteMultiple([]*model.Post{post})
	if err != nil {
		return nil, err
	}

	return posts[0], nil
}

func (s *SqlPostStore) GetFlaggedPosts(userId string, offset int, limit int) (*model.PostList, error) {
	return s.getFlaggedPosts(userId, "", "", offset, limit)
}

func (s *SqlPostStore) GetFlaggedPostsForTeam(userId, teamId string, offset int, limit int) (*model.PostList, error) {
	return s.getFlaggedPosts(userId, "", teamId, offset, limit)
}

func (s *SqlPostStore) GetFlaggedPostsForChannel(userId, channelId string, offset int, limit int) (*model.PostList, error) {
	return s.getFlaggedPosts(userId, channelId, "", offset, limit)
}

// TODO: convert to squirrel HW
func (s *SqlPostStore) getFlaggedPosts(userId, channelId, teamId string, offset int, limit int) (*model.PostList, error) {
	pl := model.NewPostList()

	posts := []*model.Post{}
	query := `
            SELECT
                A.*, (SELECT count(*) FROM Posts WHERE Posts.RootId = (CASE WHEN A.RootId = '' THEN A.Id ELSE A.RootId END) AND Posts.DeleteAt = 0) as ReplyCount
            FROM
                (SELECT
                    *
                FROM
                    Posts
                WHERE
                    Id
                IN
                    (
						SELECT
							Name
						FROM
							Preferences
						WHERE
							UserId = ?
							AND Category = ?
					)
					CHANNEL_FILTER
					AND Posts.DeleteAt = 0
                ) as A
            INNER JOIN Channels as B
                ON B.Id = A.ChannelId
			WHERE
				ChannelId IN (
					SELECT
						ChannelId
					FROM
						ChannelMembers
					WHERE UserId = ?
				)
				TEAM_FILTER
            ORDER BY CreateAt DESC
            LIMIT ? OFFSET ?`

	queryParams := []any{userId, model.PreferenceCategoryFlaggedPost}

	var channelClause, teamClause string
	channelClause, queryParams = s.buildFlaggedPostChannelFilterClause(channelId, queryParams)
	query = strings.Replace(query, "CHANNEL_FILTER", channelClause, 1)

	queryParams = append(queryParams, userId)

	teamClause, queryParams = s.buildFlaggedPostTeamFilterClause(teamId, queryParams)
	query = strings.Replace(query, "TEAM_FILTER", teamClause, 1)

	queryParams = append(queryParams, limit, offset)

	if err := s.GetReplica().Select(&posts, query, queryParams...); err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}

	for _, post := range posts {
		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}

	return pl, nil
}

func (s *SqlPostStore) buildFlaggedPostTeamFilterClause(teamId string, queryParams []any) (string, []any) {
	if teamId == "" {
		return "", queryParams
	}

	return "AND B.TeamId = ? OR B.TeamId = ''", append(queryParams, teamId)
}

func (s *SqlPostStore) buildFlaggedPostChannelFilterClause(channelId string, queryParams []any) (string, []any) {
	if channelId == "" {
		return "", queryParams
	}

	return "AND ChannelId = ?", append(queryParams, channelId)
}

func (s *SqlPostStore) getPostWithCollapsedThreads(id, userID string, opts model.GetPostsOptions, sanitizeOptions map[string]bool) (*model.PostList, error) {
	if id == "" {
		return nil, store.NewErrInvalidInput("Post", "id", id)
	}

	var columns []string
	for _, c := range postSliceColumns() {
		columns = append(columns, "Posts."+c)
	}
	columns = append(columns,
		"COALESCE(Threads.ReplyCount, 0) as ThreadReplyCount",
		"COALESCE(Threads.LastReplyAt, 0) as LastReplyAt",
		"COALESCE(Threads.Participants, '[]') as ThreadParticipants",
		"ThreadMemberships.Following as IsFollowing",
	)
	var post postWithExtra

	postFetchQuery, args, err := s.getQueryBuilder().
		Select(columns...).
		From("Posts").
		LeftJoin("Threads ON Threads.PostId = Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Id AND ThreadMemberships.UserId = ?", userID).
		Where(sq.Eq{"Posts.DeleteAt": 0}).
		Where(sq.Eq{"Posts.Id": id}).ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "getPostWithCollapsedThreads_ToSql2")
	}

	err = s.GetReplica().Get(&post, postFetchQuery, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", id)
		}

		return nil, errors.Wrapf(err, "failed to get Post with id=%s", id)
	}

	posts := []*model.Post{}
	query := s.getQueryBuilder().
		Select("*").
		From("Posts").
		Where(sq.Eq{
			"Posts.RootId":   id,
			"Posts.DeleteAt": 0,
		})

	var sort string
	if opts.Direction != "" {
		if opts.Direction == "up" {
			sort = "DESC"
		} else if opts.Direction == "down" {
			sort = "ASC"
		}
	}
	if sort != "" {
		query = query.OrderBy("CreateAt " + sort + ", Id " + sort)
	}

	if opts.FromCreateAt != 0 {
		if opts.Direction == "down" {
			direction := sq.Gt{"Posts.CreateAt": opts.FromCreateAt}
			if opts.FromPost != "" {
				query = query.Where(sq.Or{
					direction,
					sq.And{
						sq.Eq{"Posts.CreateAt": opts.FromCreateAt},
						sq.Gt{"Posts.Id": opts.FromPost},
					},
				})
			} else {
				query = query.Where(direction)
			}
		} else {
			direction := sq.Lt{"Posts.CreateAt": opts.FromCreateAt}
			if opts.FromPost != "" {
				query = query.Where(sq.Or{
					direction,
					sq.And{
						sq.Eq{"Posts.CreateAt": opts.FromCreateAt},
						sq.Lt{"Posts.Id": opts.FromPost},
					},
				})
			} else {
				query = query.Where(direction)
			}
		}
	}

	if opts.PerPage != 0 {
		query = query.Limit(uint64(opts.PerPage + 1))
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "getPostWithCollapsedThreads_Tosql2")
	}
	err = s.GetReplica().Select(&posts, sql, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts for thread %s", id)
	}

	var hasNext bool
	if opts.PerPage != 0 {
		if len(posts) == opts.PerPage+1 {
			hasNext = true
		}
	}
	if hasNext {
		// Shave off the last item.
		posts = posts[:len(posts)-1]
	}

	list, err := s.prepareThreadedResponse([]*postWithExtra{&post}, opts.CollapsedThreadsExtended, false, sanitizeOptions)
	if err != nil {
		return nil, err
	}
	for _, p := range posts {
		list.AddPost(p)
		list.AddOrder(p.Id)
	}
	list.HasNext = &hasNext

	return list, nil
}

func (s *SqlPostStore) Get(ctx context.Context, id string, opts model.GetPostsOptions, userID string, sanitizeOptions map[string]bool) (*model.PostList, error) {
	if opts.CollapsedThreads {
		return s.getPostWithCollapsedThreads(id, userID, opts, sanitizeOptions)
	}
	pl := model.NewPostList()

	if id == "" {
		return nil, store.NewErrInvalidInput("Post", "id", id)
	}
	var post model.Post
	postFetchQuery := "SELECT p.*, (SELECT count(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount FROM Posts p WHERE p.Id = ? AND p.DeleteAt = 0"
	err := s.DBXFromContext(ctx).Get(&post, postFetchQuery, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", id)
		}

		return nil, errors.Wrapf(err, "failed to get Post with id=%s", id)
	}
	pl.AddPost(&post)
	pl.AddOrder(id)
	if !opts.SkipFetchThreads {
		rootId := post.RootId

		if rootId == "" {
			rootId = post.Id
		}

		if rootId == "" {
			return nil, errors.Wrapf(err, "invalid rootId with value=%s", rootId)
		}

		var query sq.SelectBuilder
		if s.DriverName() == model.DatabaseDriverMysql {
			query = s.getQueryBuilder().
				Select("p.*, (SELECT count(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount").
				From("Posts p").
				Where(sq.And{
					sq.Or{
						sq.Eq{"p.Id": rootId},
						sq.Eq{"p.RootId": rootId},
					},
					sq.Eq{"p.DeleteAt": 0},
				})
		} else {
			query = s.getQueryBuilder().
				Select("p.*, replycount.num as ReplyCount").
				PrefixExpr(s.getQueryBuilder().
					Select().
					Prefix("WITH replycount as (").
					Columns("count(*) as num").
					From("posts").
					Where(sq.And{
						sq.Eq{"RootId": rootId},
						sq.Eq{"DeleteAt": 0},
					}).Suffix(")"),
				).
				From("Posts p, replycount").
				Where(sq.And{
					sq.Or{
						sq.Eq{"p.Id": rootId},
						sq.Eq{"p.RootId": rootId},
					},
					sq.Eq{"p.DeleteAt": 0},
				})
		}

		var sort string
		if opts.Direction != "" {
			if opts.Direction == "up" {
				sort = "DESC"
			} else if opts.Direction == "down" {
				sort = "ASC"
			}
		}
		if sort != "" {
			query = query.OrderBy("CreateAt " + sort + ", Id " + sort)
		}

		if opts.FromCreateAt != 0 {
			if opts.Direction == "down" {
				direction := sq.Gt{"p.CreateAt": opts.FromCreateAt}
				if opts.FromPost != "" {
					query = query.Where(sq.Or{
						direction,
						sq.And{
							sq.Eq{"p.CreateAt": opts.FromCreateAt},
							sq.Gt{"p.Id": opts.FromPost},
						},
					})
				} else {
					query = query.Where(direction)
				}
			} else {
				direction := sq.Lt{"p.CreateAt": opts.FromCreateAt}
				if opts.FromPost != "" {
					query = query.Where(sq.Or{
						direction,
						sq.And{
							sq.Eq{"p.CreateAt": opts.FromCreateAt},
							sq.Lt{"p.Id": opts.FromPost},
						},
					})
				} else {
					query = query.Where(direction)
				}
			}
		}

		if opts.PerPage != 0 {
			query = query.Limit(uint64(opts.PerPage + 1))
		}

		sql, args, err := query.ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "Get_Tosql")
		}

		posts := []*model.Post{}
		err = s.GetReplica().Select(&posts, sql, args...)
		if err != nil {
			return nil, errors.Wrap(err, "failed to find Posts")
		}

		var hasNext bool
		if opts.PerPage != 0 {
			if len(posts) == opts.PerPage+1 {
				hasNext = true
			}
		}
		if hasNext {
			// Shave off the last item
			posts = posts[:len(posts)-1]
		}

		for _, p := range posts {
			if p.Id == id {
				// Based on the conditions above such as sq.Or{ sq.Eq{"p.Id": rootId}, sq.Eq{"p.RootId": rootId}, }
				// posts may contain the "id" post which has already been fetched and added in the "pl"
				// So, skip the "id" to avoid duplicate entry of the post
				continue
			}

			pl.AddPost(p)
			pl.AddOrder(p.Id)
		}
		pl.HasNext = &hasNext
	}
	return pl, nil
}

func (s *SqlPostStore) GetSingle(rctx request.CTX, id string, inclDeleted bool) (*model.Post, error) {
	query := s.getQueryBuilder().
		Select("p.*").
		From("Posts p").
		Where(sq.Eq{"p.Id": id})

	replyCountSubQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From("Posts").
		Where(sq.Expr("Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0"))

	if !inclDeleted {
		query = query.Where(sq.Eq{"p.DeleteAt": 0})
	}
	query = query.Column(sq.Alias(replyCountSubQuery, "ReplyCount"))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "getsingleincldeleted_tosql")
	}

	var post model.Post
	err = s.DBXFromContext(rctx.Context()).Get(&post, queryString, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", id)
		}

		return nil, errors.Wrapf(err, "failed to get Post with id=%s", id)
	}
	return &post, nil
}

type etagPosts struct {
	Id       string
	UpdateAt int64
}

//nolint:unparam
func (s *SqlPostStore) InvalidateLastPostTimeCache(channelId string) {
}

//nolint:unparam
func (s *SqlPostStore) GetEtag(channelId string, allowFromCache, collapsedThreads bool) string {
	q := s.getQueryBuilder().Select("Id", "UpdateAt").From("Posts").Where(sq.Eq{"ChannelId": channelId}).OrderBy("UpdateAt DESC").Limit(1)
	if collapsedThreads {
		q.Where(sq.Eq{"RootId": ""})
	}
	sql, args := q.MustSql()

	var et etagPosts
	err := s.GetReplica().Get(&et, sql, args...)
	var result string
	if err != nil {
		result = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	} else {
		result = fmt.Sprintf("%v.%v", model.CurrentVersion, et.UpdateAt)
	}

	return result
}

// Soft deletes a post
// and cleans up the thread if it's a comment
func (s *SqlPostStore) Delete(rctx request.CTX, postID string, time int64, deleteByID string) (err error) {
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	id := postIds{}
	// TODO: change this to later delete thread directly from postID
	err = transaction.Get(&id, "SELECT RootId, UserId FROM Posts WHERE Id = ?", postID)
	if err != nil {
		if err == sql.ErrNoRows {
			return store.NewErrNotFound("Post", postID)
		}

		return errors.Wrapf(err, "failed to delete Post with id=%s", postID)
	}

	if s.DriverName() == model.DatabaseDriverPostgres {
		_, err = transaction.Exec(`UPDATE Posts
			SET DeleteAt = $1,
				UpdateAt = $1,
				Props = jsonb_set(Props, $2, $3)
			WHERE Id = $4 OR RootId = $4`, time, jsonKeyPath(model.PostPropsDeleteBy), jsonStringVal(deleteByID), postID)
	} else {
		// We use ORDER BY clause for MySQL
		// to trigger filesort optimization in the index_merge.
		// Without it, MySQL does a temporary sort.
		// See: https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html#order-by-filesort.
		_, err = transaction.Exec(`UPDATE Posts
			SET DeleteAt = ?,
			UpdateAt = ?,
			Props = JSON_SET(Props, ?, ?)
			Where Id = ? OR RootId = ?
			ORDER BY Id`, time, time, "$."+model.PostPropsDeleteBy, deleteByID, postID, postID)
	}

	if err != nil {
		return errors.Wrap(err, "failed to update Posts")
	}

	if id.RootId == "" {
		err = s.deleteThread(transaction, postID, time)
	} else {
		err = s.updateThreadAfterReplyDeletion(transaction, id.RootId, id.UserId)
		updatePostQuery := s.getQueryBuilder().
			Update("Posts").
			Set("UpdateAt", time).
			Where(sq.Eq{"Id": id.RootId})
		if _, err = transaction.ExecBuilder(updatePostQuery); err != nil {
			mlog.Warn("Error updating Post UpdateAt.", mlog.Err(err))
		}
	}

	if err != nil {
		return errors.Wrapf(err, "failed to cleanup Thread with postid=%s", id.RootId)
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlPostStore) PermanentDelete(rctx request.CTX, postID string) (err error) {
	return s.permanentDelete([]string{postID})
}

func (s *SqlPostStore) permanentDelete(postIds []string) (err error) {
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	if err = s.permanentDeleteThreads(transaction, postIds); err != nil {
		return err
	}

	if err = s.permanentDeleteReactions(transaction, postIds); err != nil {
		return err
	}

	query := s.getQueryBuilder().
		Delete("Posts").
		Where(
			sq.Or{
				sq.Eq{"Id": postIds},
				sq.Eq{"RootId": postIds},
			},
		)
	if _, err = transaction.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete Posts")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

type postIds struct {
	Id     string
	RootId string
	UserId string
}

func (s *SqlPostStore) permanentDeleteAllCommentByUser(userId string) (err error) {
	results := []postIds{}
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	err = transaction.Select(&results, "Select Id, RootId FROM Posts WHERE UserId = ? AND RootId != ''", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to fetch Posts with userId=%s", userId)
	}

	_, err = transaction.Exec("DELETE FROM Posts WHERE UserId = ? AND RootId != ''", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete Posts with userId=%s", userId)
	}

	postIds := []string{}
	for _, ids := range results {
		if err = s.updateThreadAfterReplyDeletion(transaction, ids.RootId, userId); err != nil {
			return err
		}
		postIds = append(postIds, ids.Id)
	}

	// Delete all the reactions on the comments
	if err = s.permanentDeleteReactions(transaction, postIds); err != nil {
		return err
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

// Permanently deletes all comments by user,
// cleans up threads (removes said user from participants and decreases reply count),
// permanent delete all root posts by user,
// and delete threads and thread memberships for those root posts
func (s *SqlPostStore) PermanentDeleteByUser(rctx request.CTX, userId string) error {
	// First attempt to delete all the comments for a user
	if err := s.permanentDeleteAllCommentByUser(userId); err != nil {
		return err
	}

	// Now attempt to delete all the root posts for a user. This will also
	// delete all the comments for each post
	count := 0
	for {
		var ids []string
		err := s.GetMaster().Select(&ids, "SELECT Id FROM Posts WHERE UserId = ? LIMIT 1000", userId)
		if err != nil {
			return errors.Wrapf(err, "failed to find Posts with userId=%s", userId)
		}

		if len(ids) == 0 {
			break
		}

		if err = s.permanentDelete(ids); err != nil {
			return err
		}

		// This is a fail safe, give up if more than 10k messages
		count++
		if count >= 10 {
			return errors.Wrapf(err, "too many Posts to delete with userId=%s", userId)
		}
	}

	return nil
}

// Permanent deletes all channel root posts and comments,
// deletes all threads and thread memberships
// deletes all reactions
// no thread comment cleanup needed, since we are deleting threads and thread memberships
func (s *SqlPostStore) PermanentDeleteByChannel(rctx request.CTX, channelId string) (err error) {
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	id := ""
	for {
		ids := []string{}
		err = transaction.Select(&ids, "SELECT Id FROM Posts WHERE ChannelId = ? AND Id > ? ORDER BY Id ASC LIMIT 500", channelId, id)
		if err != nil {
			return errors.Wrapf(err, "failed to fetch Posts with channelId=%s", channelId)
		}

		if len(ids) == 0 {
			break
		}

		id = ids[len(ids)-1]

		if err = s.permanentDeleteThreads(transaction, ids); err != nil {
			return err
		}
		time.Sleep(10 * time.Millisecond)

		if err = s.permanentDeleteReactions(transaction, ids); err != nil {
			return err
		}
		time.Sleep(10 * time.Millisecond)

		query := s.getQueryBuilder().
			Delete("Posts").
			Where(
				sq.Eq{"Id": ids},
			)
		if _, err = transaction.ExecBuilder(query); err != nil {
			return errors.Wrap(err, "failed to delete Posts")
		}
		time.Sleep(10 * time.Millisecond)
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlPostStore) prepareThreadedResponse(posts []*postWithExtra, extended, reversed bool, sanitizeOptions map[string]bool) (*model.PostList, error) {
	list := model.NewPostList()
	var userIds []string
	userIdMap := map[string]bool{}
	for _, thread := range posts {
		for _, participantId := range thread.ThreadParticipants {
			if _, ok := userIdMap[participantId]; !ok {
				userIdMap[participantId] = true
				userIds = append(userIds, participantId)
			}
		}
	}
	// usersMap is the global profile map of all participants from all threads.
	usersMap := make(map[string]*model.User, len(userIds))
	if extended {
		users, err := s.User().GetProfileByIds(context.Background(), userIds, &store.UserGetByIdsOpts{}, true)
		if err != nil {
			return nil, err
		}
		for _, user := range users {
			user.SanitizeProfile(sanitizeOptions, false)
			usersMap[user.Id] = user
		}
	} else {
		for _, userId := range userIds {
			usersMap[userId] = &model.User{Id: userId}
		}
	}

	processPost := func(p *postWithExtra) error {
		p.Post.ReplyCount = p.ThreadReplyCount
		if p.IsFollowing != nil {
			p.Post.IsFollowing = model.NewPointer(*p.IsFollowing)
		}
		for _, userID := range p.ThreadParticipants {
			participant, ok := usersMap[userID]
			if !ok {
				return errors.New("cannot find thread participant with id=" + userID)
			}
			p.Post.Participants = append(p.Post.Participants, participant)
		}
		return nil
	}

	l := len(posts)
	for i := range posts {
		idx := i
		// We need to flip the order if we selected backwards

		if reversed {
			idx = l - i - 1
		}
		if err := processPost(posts[idx]); err != nil {
			return nil, err
		}
		post := &posts[idx].Post
		list.AddPost(post)
		list.AddOrder(posts[idx].Id)
	}

	return list, nil
}

func (s *SqlPostStore) getPostsCollapsedThreads(options model.GetPostsOptions, sanitizeOptions map[string]bool) (*model.PostList, error) {
	var columns []string
	for _, c := range postSliceColumns() {
		columns = append(columns, "Posts."+c)
	}
	columns = append(columns,
		"COALESCE(Threads.ReplyCount, 0) as ThreadReplyCount",
		"COALESCE(Threads.LastReplyAt, 0) as LastReplyAt",
		"COALESCE(Threads.Participants, '[]') as ThreadParticipants",
		"ThreadMemberships.Following as IsFollowing",
	)
	var posts []*postWithExtra
	offset := options.PerPage * options.Page

	postFetchQuery, args, _ := s.getQueryBuilder().
		Select(columns...).
		From("Posts").
		LeftJoin("Threads ON Threads.PostId = Posts.Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Posts.Id AND ThreadMemberships.UserId = ?", options.UserId).
		Where(sq.Eq{"Posts.DeleteAt": 0}).
		Where(sq.Eq{"Posts.ChannelId": options.ChannelId}).
		Where(sq.Eq{"Posts.RootId": ""}).
		Limit(uint64(options.PerPage)).
		Offset(uint64(offset)).
		OrderBy("Posts.CreateAt DESC").ToSql()

	err := s.GetReplica().Select(&posts, postFetchQuery, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", options.ChannelId)
	}

	return s.prepareThreadedResponse(posts, options.CollapsedThreadsExtended, false, sanitizeOptions)
}

func (s *SqlPostStore) GetPosts(options model.GetPostsOptions, _ bool, sanitizeOptions map[string]bool) (*model.PostList, error) {
	if options.PerPage > 1000 {
		return nil, store.NewErrInvalidInput("Post", "<options.PerPage>", options.PerPage)
	}
	if options.CollapsedThreads {
		return s.getPostsCollapsedThreads(options, sanitizeOptions)
	}
	offset := options.PerPage * options.Page

	rpc := make(chan store.StoreResult[[]*model.Post], 1)
	go func() {
		posts, err := s.getRootPosts(options.ChannelId, offset, options.PerPage, options.SkipFetchThreads, options.IncludeDeleted)
		rpc <- store.StoreResult[[]*model.Post]{Data: posts, NErr: err}
		close(rpc)
	}()
	cpc := make(chan store.StoreResult[[]*model.Post], 1)
	go func() {
		posts, err := s.getParentsPosts(options.ChannelId, offset, options.PerPage, options.SkipFetchThreads, options.IncludeDeleted)
		cpc <- store.StoreResult[[]*model.Post]{Data: posts, NErr: err}
		close(cpc)
	}()

	list := model.NewPostList()

	rpr := <-rpc
	if rpr.NErr != nil {
		return nil, rpr.NErr
	}

	cpr := <-cpc
	if cpr.NErr != nil {
		return nil, cpr.NErr
	}

	posts := rpr.Data
	parents := cpr.Data

	for _, p := range posts {
		list.AddPost(p)
		list.AddOrder(p.Id)
	}

	for _, p := range parents {
		list.AddPost(p)
	}

	list.MakeNonNil()

	return list, nil
}

func (s *SqlPostStore) getPostsSinceCollapsedThreads(options model.GetPostsSinceOptions, sanitizeOptions map[string]bool) (*model.PostList, error) {
	var columns []string
	for _, c := range postSliceColumns() {
		columns = append(columns, "Posts."+c)
	}
	columns = append(columns,
		"COALESCE(Threads.ReplyCount, 0) as ThreadReplyCount",
		"COALESCE(Threads.LastReplyAt, 0) as LastReplyAt",
		"COALESCE(Threads.Participants, '[]') as ThreadParticipants",
		"ThreadMemberships.Following as IsFollowing",
	)
	var posts []*postWithExtra

	postFetchQuery, args, err := s.getQueryBuilder().
		Select(columns...).
		From("Posts").
		LeftJoin("Threads ON Threads.PostId = Posts.Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Posts.Id AND ThreadMemberships.UserId = ?", options.UserId).
		Where(sq.Eq{"Posts.ChannelId": options.ChannelId}).
		Where(sq.Gt{"Posts.UpdateAt": options.Time}).
		Where(sq.Eq{"Posts.RootId": ""}).
		OrderBy("Posts.CreateAt DESC").
		Limit(1000).
		ToSql()

	if err != nil {
		return nil, errors.Wrapf(err, "getPostsSinceCollapsedThreads_ToSql")
	}

	err = s.GetReplica().Select(&posts, postFetchQuery, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", options.ChannelId)
	}
	return s.prepareThreadedResponse(posts, options.CollapsedThreadsExtended, false, sanitizeOptions)
}

//nolint:unparam
func (s *SqlPostStore) GetPostsSince(options model.GetPostsSinceOptions, allowFromCache bool, sanitizeOptions map[string]bool) (*model.PostList, error) {
	if options.CollapsedThreads {
		return s.getPostsSinceCollapsedThreads(options, sanitizeOptions)
	}

	posts := []*model.Post{}

	order := "DESC"
	if options.SortAscending {
		order = "ASC"
	}

	replyCountQuery1 := ""
	replyCountQuery2 := ""
	if options.SkipFetchThreads {
		replyCountQuery1 = `, (SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p1.RootId = '' THEN p1.Id ELSE p1.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
		replyCountQuery2 = `, (SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN cte.RootId = '' THEN cte.Id ELSE cte.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
	}
	var query string
	var params []any

	// union of IDs and then join to get full posts is faster in mysql
	if s.DriverName() == model.DatabaseDriverMysql {
		query = `SELECT *` + replyCountQuery1 + ` FROM Posts p1 JOIN (
			(SELECT
              Id
			  FROM
				  Posts p2
			  WHERE
				  (UpdateAt > ?
					  AND ChannelId = ?)
				  LIMIT 1000)
			  UNION
				  (SELECT
					  Id
				  FROM
					  Posts p3
				  WHERE
					  Id
				  IN
					  (SELECT * FROM (SELECT
						  RootId
					  FROM
						  Posts
					  WHERE
						  UpdateAt > ?
							  AND ChannelId = ?
					  LIMIT 1000) temp_tab))
			) j ON p1.Id = j.Id
          ORDER BY CreateAt ` + order

		params = []any{options.Time, options.ChannelId, options.Time, options.ChannelId}
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		query = `WITH cte AS (SELECT
		       *
		FROM
		       Posts
		WHERE
		       UpdateAt > ? AND ChannelId = ?
		       LIMIT 1000)
		(SELECT *` + replyCountQuery2 + ` FROM cte)
		UNION
		(SELECT *` + replyCountQuery1 + ` FROM Posts p1 WHERE id in (SELECT rootid FROM cte))
		ORDER BY CreateAt ` + order

		params = []any{options.Time, options.ChannelId}
	}
	err := s.GetReplica().Select(&posts, query, params...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", options.ChannelId)
	}

	list := model.NewPostList()

	for _, p := range posts {
		list.AddPost(p)
		if p.UpdateAt > options.Time {
			list.AddOrder(p.Id)
		}
	}

	return list, nil
}

func (s *SqlPostStore) HasAutoResponsePostByUserSince(options model.GetPostsSinceOptions, userId string) (bool, error) {
	query := `
		SELECT EXISTS (SELECT 1
				FROM
					Posts
				WHERE
					UpdateAt >= ?
					AND
					ChannelId = ?
					AND
					UserId = ?
					AND
					Type = ?
				LIMIT 1)`

	var exist bool
	err := s.GetReplica().Get(&exist, query, options.Time, options.ChannelId, userId, model.PostTypeAutoResponder)
	if err != nil {
		return false, errors.Wrapf(err,
			"failed to check if autoresponse posts in channelId=%s for userId=%s since %s", options.ChannelId, userId, model.GetTimeForMillis(options.Time))
	}

	return exist, nil
}

func (s *SqlPostStore) GetPostsSinceForSync(options model.GetPostsSinceForSyncOptions, cursor model.GetPostsSinceForSyncCursor, limit int) ([]*model.Post, model.GetPostsSinceForSyncCursor, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("Posts").
		OrderBy("Posts.UpdateAt", "Id").
		Limit(uint64(limit))

	if options.SinceCreateAt {
		query = query.Where(sq.Or{
			sq.Gt{"Posts.CreateAt": cursor.LastPostCreateAt},
			sq.And{
				sq.Eq{"Posts.CreateAt": cursor.LastPostCreateAt},
				sq.Gt{"Posts.Id": cursor.LastPostCreateID},
			},
		})
	} else {
		query = query.Where(sq.Or{sq.Gt{"Posts.UpdateAt": cursor.LastPostUpdateAt},
			sq.And{sq.Eq{"Posts.UpdateAt": cursor.LastPostUpdateAt}, sq.Gt{"Posts.Id": cursor.LastPostUpdateID}}})
	}

	if options.ChannelId != "" {
		query = query.Where(sq.Eq{"Posts.ChannelId": options.ChannelId})
	}

	if !options.IncludeDeleted {
		query = query.Where(sq.Eq{"Posts.DeleteAt": 0})
	}

	if options.ExcludeRemoteId != "" {
		query = query.Where(sq.NotEq{"COALESCE(Posts.RemoteId,'')": options.ExcludeRemoteId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, cursor, errors.Wrap(err, "getpostssinceforsync_tosql")
	}

	posts := []*model.Post{}
	err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, cursor, errors.Wrapf(err, "error getting Posts with channelId=%s", options.ChannelId)
	}

	if len(posts) != 0 {
		if options.SinceCreateAt {
			cursor.LastPostCreateAt = posts[len(posts)-1].CreateAt
			cursor.LastPostCreateID = posts[len(posts)-1].Id
		} else {
			cursor.LastPostUpdateAt = posts[len(posts)-1].UpdateAt
			cursor.LastPostUpdateID = posts[len(posts)-1].Id
		}
	}
	return posts, cursor, nil
}

func (s *SqlPostStore) GetPostsBefore(options model.GetPostsOptions, sanitizeOptions map[string]bool) (*model.PostList, error) {
	return s.getPostsAround(true, options, sanitizeOptions)
}

func (s *SqlPostStore) GetPostsAfter(options model.GetPostsOptions, sanitizeOptions map[string]bool) (*model.PostList, error) {
	return s.getPostsAround(false, options, sanitizeOptions)
}

func (s *SqlPostStore) GetPostsByThread(threadId string, since int64) ([]*model.Post, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("Posts").
		Where(sq.Eq{"RootId": threadId}).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.GtOrEq{"CreateAt": since})

	result := []*model.Post{}
	err := s.GetReplica().SelectBuilder(&result, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to fetch thread posts")
	}

	return result, nil
}

func (s *SqlPostStore) getPostsAround(before bool, options model.GetPostsOptions, sanitizeOptions map[string]bool) (*model.PostList, error) {
	if options.Page < 0 {
		return nil, store.NewErrInvalidInput("Post", "<options.Page>", options.Page)
	}

	if options.PerPage < 0 {
		return nil, store.NewErrInvalidInput("Post", "<options.PerPage>", options.PerPage)
	}

	offset := options.Page * options.PerPage
	posts := []*postWithExtra{}
	parents := []*model.Post{}

	var direction string
	var sort string
	if before {
		direction = "<"
		sort = "DESC"
	} else {
		direction = ">"
		sort = "ASC"
	}
	table := "Posts p"
	// We force MySQL to use the right index to prevent it from accidentally
	// using the index_merge_intersection optimization.
	// See MM-27575.
	if s.DriverName() == model.DatabaseDriverMysql {
		table += " USE INDEX(idx_posts_channel_id_delete_at_create_at)"
	}
	columns := []string{"p.*"}
	if options.CollapsedThreads {
		columns = append(columns,
			"COALESCE(Threads.ReplyCount, 0) as ThreadReplyCount",
			"COALESCE(Threads.LastReplyAt, 0) as LastReplyAt",
			"COALESCE(Threads.Participants, '[]') as ThreadParticipants",
			"ThreadMemberships.Following as IsFollowing",
		)
	}
	query := s.getQueryBuilder().Select(columns...)
	replyCountSubQuery := s.getQueryBuilder().Select("COUNT(*)").From("Posts").Where(sq.Expr("Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END)"))

	conditions := sq.And{
		sq.Expr(`CreateAt `+direction+` (SELECT CreateAt FROM Posts WHERE Id = ?)`, options.PostId),
		sq.Eq{"p.ChannelId": options.ChannelId},
	}

	if !options.IncludeDeleted {
		replyCountSubQuery = replyCountSubQuery.Where(sq.Expr("Posts.DeleteAt = 0"))
		conditions = append(conditions, sq.Eq{"p.DeleteAt": int(0)})
	}

	if options.CollapsedThreads {
		conditions = append(conditions, sq.Eq{"RootId": ""})
		query = query.LeftJoin("Threads ON Threads.PostId = p.Id").LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = p.Id AND ThreadMemberships.UserId=?", options.UserId)
	} else {
		query = query.Column(sq.Alias(replyCountSubQuery, "ReplyCount"))
	}
	query = query.From(table).
		Where(conditions).
		// Adding ChannelId and DeleteAt order columns
		// to let mysql choose the "idx_posts_channel_id_delete_at_create_at" index always.
		// See MM-24170.
		OrderBy("p.ChannelId", "p.DeleteAt", "p.CreateAt "+sort).
		Limit(uint64(options.PerPage)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}
	err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", options.ChannelId)
	}

	if !options.CollapsedThreads && len(posts) > 0 {
		rootIds := []string{}
		for _, post := range posts {
			rootIds = append(rootIds, post.Id)
			if post.RootId != "" {
				rootIds = append(rootIds, post.RootId)
			}
		}
		rootQuery := s.getQueryBuilder().Select("p.*")
		idQuery := sq.Or{
			sq.Eq{"Id": rootIds},
		}
		rootQuery = rootQuery.Column(sq.Alias(replyCountSubQuery, "ReplyCount"))
		if !options.SkipFetchThreads {
			idQuery = append(idQuery, sq.Eq{"RootId": rootIds}) // preserve original behaviour
		}

		rootQuery = rootQuery.From("Posts p").
			Where(sq.And{
				idQuery,
				sq.Eq{"p.ChannelId": options.ChannelId},
			}).
			OrderBy("CreateAt DESC")

		if !options.IncludeDeleted {
			rootQuery = rootQuery.Where(sq.Eq{"p.DeleteAt": 0})
		}

		rootQueryString, rootArgs, nErr := rootQuery.ToSql()

		if nErr != nil {
			return nil, errors.Wrap(nErr, "post_tosql")
		}
		nErr = s.GetReplica().Select(&parents, rootQueryString, rootArgs...)
		if nErr != nil {
			return nil, errors.Wrapf(nErr, "failed to find Posts with channelId=%s", options.ChannelId)
		}
	}

	list, err := s.prepareThreadedResponse(posts, options.CollapsedThreadsExtended, !before, sanitizeOptions)
	if err != nil {
		return nil, err
	}

	for _, p := range parents {
		list.AddPost(p)
	}

	return list, nil
}

func (s *SqlPostStore) GetPostIdBeforeTime(channelId string, time int64, collapsedThreads bool) (string, error) {
	return s.getPostIdAroundTime(channelId, time, true, collapsedThreads)
}

func (s *SqlPostStore) GetPostIdAfterTime(channelId string, time int64, collapsedThreads bool) (string, error) {
	return s.getPostIdAroundTime(channelId, time, false, collapsedThreads)
}

func (s *SqlPostStore) getPostIdAroundTime(channelId string, time int64, before bool, collapsedThreads bool) (string, error) {
	var direction sq.Sqlizer
	var sort string
	if before {
		direction = sq.Lt{"CreateAt": time}
		sort = "DESC"
	} else {
		direction = sq.Gt{"CreateAt": time}
		sort = "ASC"
	}

	table := "Posts"
	// We force MySQL to use the right index to prevent it from accidentally
	// using the index_merge_intersection optimization.
	// See MM-27575.
	if s.DriverName() == model.DatabaseDriverMysql {
		table += " USE INDEX(idx_posts_channel_id_delete_at_create_at)"
	}

	conditions := sq.And{
		direction,
		sq.Eq{"Posts.ChannelId": channelId},
		sq.Eq{"Posts.DeleteAt": int(0)},
	}
	if collapsedThreads {
		conditions = sq.And{conditions, sq.Eq{"Posts.RootId": ""}}
	}
	query := s.getQueryBuilder().
		Select("Id").
		From(table).
		Where(conditions).
		// Adding ChannelId and DeleteAt order columns
		// to let mysql choose the "idx_posts_channel_id_delete_at_create_at" index always.
		// See MM-23369.
		OrderBy("Posts.ChannelId", "Posts.DeleteAt", "Posts.CreateAt "+sort).
		Limit(1)

	queryString, args, err := query.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "post_tosql")
	}

	var postId string
	if err := s.GetMaster().Get(&postId, queryString, args...); err != nil {
		if err != sql.ErrNoRows {
			return "", errors.Wrapf(err, "failed to get Post id with channelId=%s", channelId)
		}
	}

	return postId, nil
}

func (s *SqlPostStore) GetPostAfterTime(channelId string, time int64, collapsedThreads bool) (*model.Post, error) {
	table := "Posts"
	// We force MySQL to use the right index to prevent it from accidentally
	// using the index_merge_intersection optimization.
	// See MM-27575.
	if s.DriverName() == model.DatabaseDriverMysql {
		table += " USE INDEX(idx_posts_channel_id_delete_at_create_at)"
	}
	conditions := sq.And{
		sq.Gt{"Posts.CreateAt": time},
		sq.Eq{"Posts.ChannelId": channelId},
		sq.Eq{"Posts.DeleteAt": int(0)},
	}
	if collapsedThreads {
		conditions = sq.And{conditions, sq.Eq{"RootId": ""}}
	}
	query := s.getQueryBuilder().
		Select("*").
		From(table).
		Where(conditions).
		// Adding ChannelId and DeleteAt order columns
		// to let mysql choose the "idx_posts_channel_id_delete_at_create_at" index always.
		// See MM-23369.
		OrderBy("Posts.ChannelId", "Posts.DeleteAt", "Posts.CreateAt ASC").
		Limit(1)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}

	var post model.Post
	if err := s.GetMaster().Get(&post, queryString, args...); err != nil {
		if err != sql.ErrNoRows {
			return nil, errors.Wrapf(err, "failed to get Post with channelId=%s", channelId)
		}
	}

	return &post, nil
}

func (s *SqlPostStore) getRootPosts(channelId string, offset int, limit int, skipFetchThreads bool, includeDeleted bool) ([]*model.Post, error) {
	posts := []*model.Post{}
	var fetchQuery string
	if skipFetchThreads {
		fetchQuery = "SELECT p.*, (SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END)) as ReplyCount FROM Posts p WHERE p.ChannelId = ? ORDER BY p.CreateAt DESC LIMIT ? OFFSET ?"
		if !includeDeleted {
			fetchQuery = "SELECT p.*, (SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount FROM Posts p WHERE p.ChannelId = ? AND p.DeleteAt = 0 ORDER BY p.CreateAt DESC LIMIT ? OFFSET ?"
		}
	} else {
		fetchQuery = "SELECT * FROM Posts WHERE Posts.ChannelId = ? ORDER BY Posts.CreateAt DESC LIMIT ? OFFSET ?"
		if !includeDeleted {
			fetchQuery = "SELECT * FROM Posts WHERE Posts.ChannelId = ? AND Posts.DeleteAt = 0 ORDER BY Posts.CreateAt DESC LIMIT ? OFFSET ?"
		}
	}

	err := s.GetReplica().Select(&posts, fetchQuery, channelId, limit, offset)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	return posts, nil
}

func (s *SqlPostStore) getParentsPosts(channelId string, offset int, limit int, skipFetchThreads bool, includeDeleted bool) ([]*model.Post, error) {
	if s.DriverName() == model.DatabaseDriverPostgres {
		return s.getParentsPostsPostgreSQL(channelId, offset, limit, skipFetchThreads, includeDeleted)
	}

	deleteAtCondition := "AND DeleteAt = 0"
	if includeDeleted {
		deleteAtCondition = ""
	}

	// query parent Ids first
	roots := []string{}
	rootQuery := `
		SELECT DISTINCT
			q.RootId
		FROM
			(SELECT
				Posts.RootId
			FROM
				Posts
			WHERE
				ChannelId = ? ` + deleteAtCondition + `
			ORDER BY CreateAt DESC
			LIMIT ? OFFSET ?) q
		WHERE q.RootId != ''`

	err := s.GetReplica().Select(&roots, rootQuery, channelId, limit, offset)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	if len(roots) == 0 {
		return nil, nil
	}

	cols := []string{"p.*"}
	var where sq.Sqlizer
	where = sq.Eq{"p.Id": roots}
	if skipFetchThreads {
		col := "(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END)) as ReplyCount"
		if !includeDeleted {
			col = "(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount"
		}
		cols = append(cols, col)
	} else {
		where = sq.Or{
			where,
			sq.Eq{"p.RootId": roots},
		}
	}

	query := s.getQueryBuilder().
		Select(cols...).
		From("Posts p").
		Where(sq.And{
			where,
			sq.Eq{"p.ChannelId": channelId},
		}).
		OrderBy("p.CreateAt")

	if !includeDeleted {
		query = query.Where(sq.Eq{"p.DeleteAt": 0})
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "ParentPosts_Tosql")
	}

	posts := []*model.Post{}
	err = s.GetReplica().Select(&posts, sql, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	return posts, nil
}

func (s *SqlPostStore) getParentsPostsPostgreSQL(channelId string, offset int, limit int, skipFetchThreads bool, includeDeleted bool) ([]*model.Post, error) {
	posts := []*model.Post{}
	replyCountQuery := ""
	onStatement := "q1.RootId = q2.Id"
	if skipFetchThreads {
		replyCountQuery = ` ,(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END)) as ReplyCount`
		if !includeDeleted {
			replyCountQuery = ` ,(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
		}
	} else {
		onStatement += " OR q1.RootId = q2.RootId"
	}

	deleteAtQueryCondition := "AND q2.DeleteAt = 0"
	deleteAtSubQueryCondition := "AND Posts.DeleteAt = 0"
	if includeDeleted {
		deleteAtQueryCondition, deleteAtSubQueryCondition = "", ""
	}

	err := s.GetReplica().Select(&posts,
		`SELECT q2.*`+replyCountQuery+`
        FROM
            Posts q2
                INNER JOIN
            (SELECT DISTINCT
                q3.RootId
            FROM
                (SELECT
                    Posts.RootId
                FROM
                    Posts
                WHERE
                    Posts.ChannelId = ? `+deleteAtSubQueryCondition+`
                ORDER BY Posts.CreateAt DESC
                LIMIT ? OFFSET ?) q3
            WHERE q3.RootId != '') q1
            ON `+onStatement+`
        WHERE
            q2.ChannelId = ? `+deleteAtQueryCondition+`
        ORDER BY q2.CreateAt`, channelId, limit, offset, channelId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", channelId)
	}
	return posts, nil
}

// GetNthRecentPostTime returns the CreateAt time of the nth most recent post.
func (s *SqlPostStore) GetNthRecentPostTime(n int64) (int64, error) {
	if n <= 0 {
		return 0, errors.New("n can't be less than 1")
	}

	builder := s.getQueryBuilder().
		Select("CreateAt").
		From("Posts p").
		// Consider users posts only for cloud limit
		Where(sq.And{
			sq.Eq{"p.Type": ""},
			sq.Expr("p.UserId NOT IN (SELECT UserId FROM Bots)"),
		}).
		OrderBy("p.CreateAt DESC").
		Limit(1).
		Offset(uint64(n - 1))

	query, queryArgs, err := builder.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "GetNthRecentPostTime_tosql")
	}

	var createAt int64
	if err := s.GetMaster().Get(&createAt, query, queryArgs...); err != nil {
		if err == sql.ErrNoRows {
			return 0, store.NewErrNotFound("Post", "none")
		}

		return 0, errors.Wrapf(err, "failed to get the Nth Post=%d", n)
	}

	return createAt, nil
}

func (s *SqlPostStore) buildCreateDateFilterClause(params *model.SearchParams, builder sq.SelectBuilder) sq.SelectBuilder {
	// handle after: before: on: filters
	if params.OnDate != "" {
		onDateStart, onDateEnd := params.GetOnDateMillis()
		// between `on date` start of day and end of day
		builder = builder.Where("CreateAt BETWEEN ? AND ?", onDateStart, onDateEnd)
		return builder
	}

	if params.ExcludedDate != "" {
		excludedDateStart, excludedDateEnd := params.GetExcludedDateMillis()
		builder = builder.Where("CreateAt NOT BETWEEN ? AND ?", excludedDateStart, excludedDateEnd)
	}

	if params.AfterDate != "" {
		afterDate := params.GetAfterDateMillis()
		// greater than `after date`
		builder = builder.Where("CreateAt >= ?", afterDate)
	}

	if params.BeforeDate != "" {
		beforeDate := params.GetBeforeDateMillis()
		// less than `before date`
		builder = builder.Where("CreateAt <= ?", beforeDate)
	}

	if params.ExcludedAfterDate != "" {
		afterDate := params.GetExcludedAfterDateMillis()
		builder = builder.Where("CreateAt < ?", afterDate)
	}

	if params.ExcludedBeforeDate != "" {
		beforeDate := params.GetExcludedBeforeDateMillis()
		builder = builder.Where("CreateAt > ?", beforeDate)
	}

	return builder
}

func (s *SqlPostStore) buildSearchTeamFilterClause(teamId string, builder sq.SelectBuilder) sq.SelectBuilder {
	if teamId == "" {
		return builder
	}

	return builder.Where(sq.Or{
		sq.Eq{"TeamId": teamId},
		sq.Eq{"TeamId": ""},
	})
}

func (s *SqlPostStore) buildSearchChannelFilterClause(channels []string, exclusion bool, byName bool, builder sq.SelectBuilder) sq.SelectBuilder {
	if len(channels) == 0 {
		return builder
	}

	if byName {
		if exclusion {
			return builder.Where(sq.NotEq{"Name": channels})
		}
		return builder.Where(sq.Eq{"Name": channels})
	}

	if exclusion {
		return builder.Where(sq.NotEq{"Id": channels})
	}
	return builder.Where(sq.Eq{"Id": channels})
}

func (s *SqlPostStore) buildSearchUserFilterClause(users []string, exclusion bool, byUsername bool, builder sq.SelectBuilder) sq.SelectBuilder {
	if len(users) == 0 {
		return builder
	}

	if byUsername {
		if exclusion {
			return builder.Where(sq.NotEq{"Username": users})
		}
		return builder.Where(sq.Eq{"Username": users})
	}

	if exclusion {
		return builder.Where(sq.NotEq{"Id": users})
	}
	return builder.Where(sq.Eq{"Id": users})
}

func (s *SqlPostStore) buildSearchPostFilterClause(teamID string, fromUsers []string, excludedUsers []string, userByUsername bool, builder sq.SelectBuilder) (sq.SelectBuilder, error) {
	if len(fromUsers) == 0 && len(excludedUsers) == 0 {
		return builder, nil
	}

	// Sub-query builder.
	sb := s.getSubQueryBuilder().Select("Id").From("Users, TeamMembers").Where(
		sq.And{
			sq.Eq{"TeamMembers.TeamId": teamID},
			sq.Expr("Users.Id = TeamMembers.UserId"),
		})
	sb = s.buildSearchUserFilterClause(fromUsers, false, userByUsername, sb)
	sb = s.buildSearchUserFilterClause(excludedUsers, true, userByUsername, sb)
	subQuery, subQueryArgs, err := sb.ToSql()
	if err != nil {
		return sq.SelectBuilder{}, err
	}

	/*
	 * Squirrel does not support a sub-query in the WHERE condition.
	 * https://github.com/Masterminds/squirrel/issues/299
	 */
	return builder.Where("UserId IN ("+subQuery+")", subQueryArgs...), nil
}

func (s *SqlPostStore) Search(teamId string, userId string, params *model.SearchParams) (*model.PostList, error) {
	return s.search(teamId, userId, params, true, true)
}

func (s *SqlPostStore) search(teamId string, userId string, params *model.SearchParams, channelsByName bool, userByUsername bool) (*model.PostList, error) {
	list := model.NewPostList()
	if params.Terms == "" && params.ExcludedTerms == "" &&
		len(params.InChannels) == 0 && len(params.ExcludedChannels) == 0 &&
		len(params.FromUsers) == 0 && len(params.ExcludedUsers) == 0 &&
		params.OnDate == "" && params.AfterDate == "" && params.BeforeDate == "" {
		return list, nil
	}

	baseQuery := s.getQueryBuilder().Select(
		"*",
		"(SELECT COUNT(*) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END) AND Posts.DeleteAt = 0) as ReplyCount",
	).From("Posts q2").
		Where("q2.DeleteAt = 0").
		Where(fmt.Sprintf("q2.Type NOT LIKE '%s%%'", model.PostSystemMessagePrefix)).
		OrderByClause("q2.CreateAt DESC").
		Limit(100)

	var err error
	baseQuery, err = s.buildSearchPostFilterClause(teamId, params.FromUsers, params.ExcludedUsers, userByUsername, baseQuery)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build search post filter clause")
	}
	baseQuery = s.buildCreateDateFilterClause(params, baseQuery)

	termMap := map[string]bool{}
	terms := params.Terms
	excludedTerms := params.ExcludedTerms

	searchType := "Message"
	if params.IsHashtag {
		searchType = "Hashtags"
		for _, term := range strings.Split(terms, " ") {
			termMap[strings.ToUpper(term)] = true
		}
	}

	for _, c := range s.specialSearchChars() {
		if !params.IsHashtag {
			terms = strings.Replace(terms, c, " ", -1)
		}
		excludedTerms = strings.Replace(excludedTerms, c, " ", -1)
	}

	if terms == "" && excludedTerms == "" {
		// we've already confirmed that we have a channel or user to search for
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		// Parse text for wildcards
		var wildcard *regexp.Regexp
		if wildcard, err = regexp.Compile(`\*($| )`); err == nil {
			terms = wildcard.ReplaceAllLiteralString(terms, ":* ")
			excludedTerms = wildcard.ReplaceAllLiteralString(excludedTerms, ":* ")
		}

		// Replace spaces with to_tsquery symbols
		replaceSpaces := func(input string, excludedInput bool) string {
			if input == "" {
				return input
			}

			// Remove extra spaces
			input = strings.Join(strings.Fields(input), " ")

			// Replace spaces within quoted strings with '<->'
			input = quotedStringsRegex.ReplaceAllStringFunc(input, func(match string) string {
				return strings.Replace(match, " ", "<->", -1)
			})

			// Replace spaces outside of quoted substrings with '&' or '|'
			replacer := "&"
			if excludedInput || params.OrTerms {
				replacer = "|"
			}
			input = strings.Replace(input, " ", replacer, -1)

			return input
		}

		tsQueryClause := replaceSpaces(terms, false)
		excludedClause := replaceSpaces(excludedTerms, true)
		if excludedClause != "" {
			tsQueryClause += " &!(" + excludedClause + ")"
		}

		searchClause := fmt.Sprintf("to_tsvector('%[1]s', %[2]s) @@  to_tsquery('%[1]s', ?)", s.pgDefaultTextSearchConfig, searchType)
		baseQuery = baseQuery.Where(searchClause, tsQueryClause)
	} else if s.DriverName() == model.DatabaseDriverMysql {
		if searchType == "Message" {
			terms, err = removeMysqlStopWordsFromTerms(terms)
			if err != nil {
				return nil, errors.Wrap(err, "failed to remove Mysql stop-words from terms")
			}

			if terms == "" {
				return list, nil
			}
		}

		excludeClause := ""
		if excludedTerms != "" {
			excludeClause = " -(" + excludedTerms + ")"
		}

		var termsClause string
		if params.OrTerms {
			termsClause = terms + excludeClause
		} else {
			splitTerms := []string{}
			for _, t := range strings.Fields(terms) {
				splitTerms = append(splitTerms, "+"+t)
			}
			termsClause = strings.Join(splitTerms, " ") + excludeClause
		}

		searchClause := fmt.Sprintf("MATCH (%s) AGAINST (? IN BOOLEAN MODE)", searchType)

		if params.IsHashtag {
			termsClause = "\"" + termsClause + "\""
		}

		baseQuery = baseQuery.Where(searchClause, termsClause)
	}

	inQuery := s.getSubQueryBuilder().Select("Id").
		From("Channels, ChannelMembers").
		Where("Id = ChannelId")

	if !params.IncludeDeletedChannels {
		inQuery = inQuery.Where("Channels.DeleteAt = 0")
	}

	if !params.SearchWithoutUserId {
		inQuery = inQuery.Where("ChannelMembers.UserId = ?", userId)
	}

	inQuery = s.buildSearchTeamFilterClause(teamId, inQuery)
	inQuery = s.buildSearchChannelFilterClause(params.InChannels, false, channelsByName, inQuery)
	inQuery = s.buildSearchChannelFilterClause(params.ExcludedChannels, true, channelsByName, inQuery)

	inQueryClause, inQueryClauseArgs, err := inQuery.ToSql()
	if err != nil {
		return nil, err
	}

	baseQuery = baseQuery.Where(fmt.Sprintf("ChannelId IN (%s)", inQueryClause), inQueryClauseArgs...)

	searchQuery, searchQueryArgs, err := baseQuery.ToSql()
	if err != nil {
		return nil, err
	}

	var posts []*model.Post

	if err := s.GetSearchReplicaX().Select(&posts, searchQuery, searchQueryArgs...); err != nil {
		mlog.Warn("Query error searching posts.", mlog.String("error", trimInput(err.Error())))
		// Don't return the error to the caller as it is of no use to the user. Instead return an empty set of search results.
	} else {
		for _, p := range posts {
			if searchType == "Hashtags" {
				exactMatch := false
				for _, tag := range strings.Split(p.Hashtags, " ") {
					if termMap[strings.ToUpper(tag)] {
						exactMatch = true
						break
					}
				}
				if !exactMatch {
					continue
				}
			}
			list.AddPost(p)
			list.AddOrder(p.Id)
		}
	}
	list.MakeNonNil()
	return list, nil
}

func removeMysqlStopWordsFromTerms(terms string) (string, error) {
	stopWords := make([]string, len(searchlayer.MySQLStopWords))
	copy(stopWords, searchlayer.MySQLStopWords)
	re, err := regexp.Compile(fmt.Sprintf(`^(%s)$`, strings.Join(stopWords, "|")))
	if err != nil {
		return "", err
	}

	newTerms := make([]string, 0)
	separatedTerms := strings.Fields(terms)
	for _, term := range separatedTerms {
		term = strings.TrimSpace(term)
		if term = re.ReplaceAllString(term, ""); term != "" {
			newTerms = append(newTerms, term)
		}
	}
	return strings.Join(newTerms, " "), nil
}

// TODO: convert to squirrel HW
func (s *SqlPostStore) AnalyticsUserCountsWithPostsByDay(teamId string) (model.AnalyticsRows, error) {
	var args []any
	query :=
		`SELECT DISTINCT
		        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
		        COUNT(DISTINCT Posts.UserId) AS Value
		FROM Posts`

	if teamId != "" {
		query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = ? AND"
		args = []any{teamId}
	} else {
		query += " WHERE"
	}

	query += ` Posts.CreateAt >= ? AND Posts.CreateAt <= ?
		GROUP BY DATE(FROM_UNIXTIME(Posts.CreateAt / 1000))
		ORDER BY Name DESC
		LIMIT 30`

	if s.DriverName() == model.DatabaseDriverPostgres {
		query =
			`SELECT
				TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, COUNT(DISTINCT Posts.UserId) AS Value
			FROM Posts`

		if teamId != "" {
			query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = ? AND"
			args = []any{teamId}
		} else {
			query += " WHERE"
		}

		query += ` Posts.CreateAt >= ? AND Posts.CreateAt <= ?
			GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
			ORDER BY Name DESC
			LIMIT 30`
	}

	end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
	start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))
	args = append(args, start, end)

	rows := model.AnalyticsRows{}
	err := s.GetReplica().Select(
		&rows,
		query,
		args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with teamId=%s", teamId)
	}
	return rows, nil
}

// TODO: convert to squirrel HW
func (s *SqlPostStore) AnalyticsPostCountsByDay(options *model.AnalyticsPostCountsOptions) (model.AnalyticsRows, error) {
	var args []any
	query :=
		`SELECT
		        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
		        COUNT(Posts.Id) AS Value
		    FROM Posts`

	if options.BotsOnly {
		query += " INNER JOIN Bots ON Posts.UserId = Bots.Userid"
	}

	if options.TeamId != "" {
		query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = ? AND"
		args = []any{options.TeamId}
	} else {
		query += " WHERE"
	}

	query += ` Posts.CreateAt <= ?
		            AND Posts.CreateAt >= ?
		GROUP BY DATE(FROM_UNIXTIME(Posts.CreateAt / 1000))
		ORDER BY Name DESC
		LIMIT 30`

	if s.DriverName() == model.DatabaseDriverPostgres {
		query =
			`SELECT
				TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, Count(Posts.Id) AS Value
			FROM Posts`

		if options.BotsOnly {
			query += " INNER JOIN Bots ON Posts.UserId = Bots.Userid"
		}

		if options.TeamId != "" {
			query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id  AND Channels.TeamId = ? AND"
			args = []any{options.TeamId}
		} else {
			query += " WHERE"
		}

		query += ` Posts.CreateAt <= ?
			            AND Posts.CreateAt >= ?
			GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
			ORDER BY Name DESC
			LIMIT 30`
	}

	end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
	start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))
	if options.YesterdayOnly {
		start = utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -1)))
	}
	args = append(args, end, start)

	rows := model.AnalyticsRows{}
	err := s.GetReplica().Select(
		&rows,
		query,
		args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with teamId=%s", options.TeamId)
	}
	return rows, nil
}

func (s *SqlPostStore) AnalyticsPostCount(options *model.PostCountOptions) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*) AS Value").
		From("Posts p")

	if options.TeamId != "" {
		query = query.
			Join("Channels c ON (c.Id = p.ChannelId)").
			Where(sq.Eq{"c.TeamId": options.TeamId})
	}

	if options.UsersPostsOnly {
		query = query.Where(sq.And{
			sq.Eq{"p.Type": ""},
			sq.Expr("p.UserId NOT IN (SELECT UserId FROM Bots)"),
		})
	}

	if options.MustHaveFile {
		query = query.Where(sq.Or{sq.NotEq{"p.FileIds": "[]"}, sq.NotEq{"p.Filenames": "[]"}})
	}

	if options.MustHaveHashtag {
		query = query.Where(sq.NotEq{"p.Hashtags": ""})
	}

	if options.ExcludeDeleted {
		query = query.Where(sq.Eq{"p.DeleteAt": 0})
	}

	if options.ExcludeSystemPosts {
		query = query.Where("p.Type NOT LIKE 'system_%'")
	}

	if options.SinceUpdateAt > 0 {
		query = query.Where(sq.Or{
			sq.Gt{"p.UpdateAt": options.SinceUpdateAt},
			sq.And{
				sq.Eq{"p.UpdateAt": options.SinceUpdateAt},
				sq.Gt{"p.Id": options.SincePostID},
			},
		})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "post_tosql")
	}

	var v int64
	err = s.GetReplica().Get(&v, queryString, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Posts")
	}

	return v, nil
}

func (s *SqlPostStore) GetPostsCreatedAt(channelId string, time int64) ([]*model.Post, error) {
	query := `SELECT * FROM Posts WHERE CreateAt = ? AND ChannelId = ?`

	posts := []*model.Post{}
	err := s.GetReplica().Select(&posts, query, time, channelId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", channelId)
	}
	return posts, nil
}

func (s *SqlPostStore) GetPostsByIds(postIds []string) ([]*model.Post, error) {
	baseQuery := s.getQueryBuilder().Select("p.*, (SELECT count(*) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount").
		From("Posts p").
		Where(sq.Eq{"p.Id": postIds}).
		OrderBy("CreateAt DESC")

	query, args, err := baseQuery.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "getPostsByIds_tosql")
	}
	posts := []*model.Post{}

	err = s.GetReplica().Select(&posts, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	if len(posts) == 0 {
		return nil, store.NewErrNotFound("Post", fmt.Sprintf("postIds=%v", postIds))
	}
	return posts, nil
}

func (s *SqlPostStore) GetEditHistoryForPost(postId string) ([]*model.Post, error) {
	builder := s.getQueryBuilder().
		Select("*").
		From("Posts").
		Where(sq.Eq{"Posts.OriginalId": postId}).
		OrderBy("Posts.EditAt DESC")

	queryString, args, err := builder.ToSql()
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", postId)
		}
		return nil, errors.Wrap(err, "failed to find post history")
	}

	posts := []*model.Post{}
	err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "error getting posts edit history with postId=%s", postId)
	}

	if len(posts) == 0 {
		return nil, store.NewErrNotFound("failed to find post history", postId)
	}

	return posts, nil
}

func (s *SqlPostStore) GetPostsBatchForIndexing(startTime int64, startPostID string, limit int) ([]*model.PostForIndexing, error) {
	posts := []*model.PostForIndexing{}

	var err error
	// In order to use an index scan for both MySQL and Postgres, we need to
	// diverge the implementation of the query, specifically in the WHERE
	// condition: for MySQL, we need to do
	//     (CreateAt > ?) OR (CreateAt = ? AND Id > ?)
	// while for Postgres we need
	//     (CreateAt, Id) > (?, ?)
	// The wrong choice for any of the two databases makes the query go from
	// milliseconds to dozens of seconds.
	// More information in: https://github.com/mattermost/mattermost/pull/26517
	// and https://community.mattermost.com/core/pl/ui5dz96shinetb8nq83myggbma
	if s.DriverName() == model.DatabaseDriverMysql {
		query := `SELECT
				Posts.*, Channels.TeamId
			FROM Posts USE INDEX(idx_posts_create_at_id)
			LEFT JOIN
				Channels
			ON
				Posts.ChannelId = Channels.Id
			WHERE
				Posts.CreateAt > ?
				OR
				(Posts.CreateAt = ? AND Posts.Id > ?)
			ORDER BY
				Posts.CreateAt ASC, Posts.Id ASC
			LIMIT
				?`
		err = s.GetSearchReplicaX().Select(&posts, query, startTime, startTime, startPostID, limit)
	} else {
		query := `SELECT
				Posts.*, Channels.TeamId
			FROM Posts
			LEFT JOIN
				Channels
			ON
				Posts.ChannelId = Channels.Id
			WHERE
				(Posts.CreateAt, Posts.Id) > (?, ?)
			ORDER BY
				Posts.CreateAt ASC, Posts.Id ASC
			LIMIT
				?`
		err = s.GetSearchReplicaX().Select(&posts, query, startTime, startPostID, limit)
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	return posts, nil
}

// PermanentDeleteBatchForRetentionPolicies deletes a batch of records which are affected by
// the global or a granular retention policy.
// See `genericPermanentDeleteBatchForRetentionPolicies` for details.
func (s *SqlPostStore) PermanentDeleteBatchForRetentionPolicies(now, globalPolicyEndTime, limit int64, cursor model.RetentionPolicyCursor) (int64, model.RetentionPolicyCursor, error) {
	builder := s.getQueryBuilder().
		Select("Posts.Id").
		From("Posts")
	return genericPermanentDeleteBatchForRetentionPolicies(RetentionPolicyBatchDeletionInfo{
		BaseBuilder:         builder,
		Table:               "Posts",
		TimeColumn:          "CreateAt",
		PrimaryKeys:         []string{"Id"},
		ChannelIDTable:      "Posts",
		NowMillis:           now,
		GlobalPolicyEndTime: globalPolicyEndTime,
		Limit:               limit,
		StoreDeletedIds:     true,
	}, s.SqlStore, cursor)
}

func (s *SqlPostStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Posts WHERE Id = any (array (SELECT Id FROM Posts WHERE CreateAt < ? LIMIT ?))"
	} else {
		query = "DELETE from Posts WHERE CreateAt < ? LIMIT ?"
	}

	sqlResult, err := s.GetMaster().Exec(query, endTime, limit)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete Posts")
	}

	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete Posts")
	}
	return rowsAffected, nil
}

func (s *SqlPostStore) GetOldest() (*model.Post, error) {
	var post model.Post
	err := s.GetReplica().Get(&post, "SELECT * FROM Posts ORDER BY CreateAt LIMIT 1")
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", "none")
		}

		return nil, errors.Wrap(err, "failed to get oldest Post")
	}

	return &post, nil
}

func (s *SqlPostStore) determineMaxPostSize() int {
	var maxPostSizeBytes int32

	if s.DriverName() == model.DatabaseDriverPostgres {
		// The Post.Message column in Postgres has historically been VARCHAR(4000), but
		// may be manually enlarged to support longer posts.
		if err := s.GetReplica().Get(&maxPostSizeBytes, `
			SELECT
				COALESCE(character_maximum_length, 0)
			FROM
				information_schema.columns
			WHERE
				table_name = 'posts'
			AND	column_name = 'message'
		`); err != nil {
			mlog.Warn("Unable to determine the maximum supported post size", mlog.Err(err))
		}
	} else if s.DriverName() == model.DatabaseDriverMysql {
		// The Post.Message column in MySQL has historically been TEXT, with a maximum
		// limit of 65535.
		if err := s.GetReplica().Get(&maxPostSizeBytes, `
			SELECT
				COALESCE(CHARACTER_MAXIMUM_LENGTH, 0)
			FROM
				INFORMATION_SCHEMA.COLUMNS
			WHERE
				table_schema = DATABASE()
			AND	table_name = 'Posts'
			AND	column_name = 'Message'
			LIMIT 0, 1
		`); err != nil {
			mlog.Warn("Unable to determine the maximum supported post size", mlog.Err(err))
		}
	} else {
		mlog.Warn("No implementation found to determine the maximum supported post size")
	}

	// Assume a worst-case representation of four bytes per rune.
	maxPostSize := int(maxPostSizeBytes) / 4

	// To maintain backwards compatibility, don't yield a maximum post
	// size smaller than the previous limit, even though it wasn't
	// actually possible to store 4000 runes in all cases.
	if maxPostSize < model.PostMessageMaxRunesV1 {
		maxPostSize = model.PostMessageMaxRunesV1
	}

	mlog.Info("Post.Message has size restrictions", mlog.Int("max_characters", maxPostSize), mlog.Int("max_bytes", maxPostSizeBytes))

	return maxPostSize
}

// GetMaxPostSize returns the maximum number of runes that may be stored in a post.
// For any changes, accordingly update the markdown maxLen here - markdown/inspect.go.
func (s *SqlPostStore) GetMaxPostSize() int {
	s.maxPostSizeOnce.Do(func() {
		s.maxPostSizeCached = s.determineMaxPostSize()
	})
	return s.maxPostSizeCached
}

func (s *SqlPostStore) GetParentsForExportAfter(limit int, afterId string, includeArchivedChannel bool) ([]*model.PostForExport, error) {
	for {
		rootIds := []string{}
		err := s.GetReplica().Select(&rootIds,
			`SELECT
				Id
			FROM
				Posts
			WHERE
				Posts.Id > ?
				AND Posts.RootId = ''
				AND Posts.DeleteAt = 0
			ORDER BY Posts.Id
			LIMIT ?`,
			afterId, limit)
		if err != nil {
			return nil, errors.Wrap(err, "failed to find Posts")
		}

		postsForExport := []*model.PostForExport{}
		if len(rootIds) == 0 {
			return postsForExport, nil
		}

		excludeDeletedCond := sq.And{
			sq.Eq{"Teams.DeleteAt": 0},
		}
		if !includeArchivedChannel {
			excludeDeletedCond = append(excludeDeletedCond, sq.Eq{"Channels.DeleteAt": 0})
		}

		aggFn := "COALESCE(json_agg(u1.username) FILTER (WHERE u1.username IS NOT NULL), '[]')"
		if s.DriverName() == model.DatabaseDriverMysql {
			aggFn = "IF (COUNT(u1.Username) = 0, JSON_ARRAY(), JSON_ARRAYAGG(u1.Username))"
		}
		result := []*model.PostForExport{}

		builder := s.getQueryBuilder().
			Select(fmt.Sprintf("%s, Users.Username as Username, Teams.Name as TeamName, Channels.Name as ChannelName, %s as FlaggedBy", strings.Join(postSliceColumnsWithName("p1"), ", "), aggFn)).
			FromSelect(sq.Select("*").From("Posts").Where(sq.Eq{"Posts.Id": rootIds}), "p1").
			LeftJoin("Preferences ON p1.Id = Preferences.Name").
			LeftJoin("Users u1 ON Preferences.UserId = u1.Id").
			InnerJoin("Channels ON p1.ChannelId = Channels.Id").
			InnerJoin("Teams ON Channels.TeamId = Teams.Id").
			InnerJoin("Users ON p1.UserId = Users.Id").
			Where(excludeDeletedCond).
			GroupBy(fmt.Sprintf("%s, Users.Username, Teams.Name, Channels.Name", strings.Join(postSliceColumnsWithName("p1"), ", "))).
			OrderBy("p1.Id")

		query, args, err := builder.ToSql()
		if err != nil {
			return nil, errors.Wrap(err, "postsForExport_toSql")
		}

		err = s.GetSearchReplicaX().Select(&result, query, args...)
		if err != nil {
			return nil, errors.Wrap(err, "failed to find Posts")
		}

		if len(result) == 0 {
			// All of the posts were in channels or teams that were deleted.
			// Update the afterId and try again.
			afterId = rootIds[len(rootIds)-1]
			continue
		}

		return result, nil
	}
}

func (s *SqlPostStore) GetRepliesForExport(rootId string) ([]*model.ReplyForExport, error) {
	aggFn := "COALESCE(json_agg(u1.username) FILTER (WHERE u1.username IS NOT NULL), '[]')"
	if s.DriverName() == model.DatabaseDriverMysql {
		aggFn = "IF (COUNT(u1.Username) = 0, JSON_ARRAY(), JSON_ARRAYAGG(u1.Username))"
	}
	result := []*model.ReplyForExport{}

	qb := s.getQueryBuilder().Select(fmt.Sprintf("Posts.*, u2.Username as Username, %s as FlaggedBy", aggFn)).
		From("Posts").
		LeftJoin("Preferences ON Posts.Id = Preferences.Name").
		LeftJoin("Users u1 ON Preferences.UserId = u1.Id").
		InnerJoin("Users u2 ON Posts.UserId = u2.Id").
		Where(sq.And{sq.Eq{"Posts.RootId": rootId}, sq.Eq{"Posts.DeleteAt": 0}}).
		GroupBy("Posts.Id, u2.Username").
		OrderBy("Posts.Id")

	query, args, err := qb.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "postsForExport_toSql")
	}

	err = s.GetSearchReplicaX().Select(&result, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}

	return result, nil
}

func (s *SqlPostStore) GetDirectPostParentsForExportAfter(limit int, afterId string, includeArchivedChannels bool) ([]*model.DirectPostForExport, error) {
	aggFn := "COALESCE(json_agg(u1.username) FILTER (WHERE u1.username IS NOT NULL), '[]')"
	if s.DriverName() == model.DatabaseDriverMysql {
		aggFn = "IF (COUNT(u1.Username) = 0, JSON_ARRAY(), JSON_ARRAYAGG(u1.Username))"
	}
	result := []*model.DirectPostForExport{}

	query := s.getQueryBuilder().
		Select(fmt.Sprintf("p.*, u2.Username as User, %s as FlaggedBy", aggFn)).
		From("Posts p").
		LeftJoin("Preferences ON p.Id = Preferences.Name").
		LeftJoin("Users u1 ON Preferences.UserId = u1.Id").
		Join("Channels ON p.ChannelId = Channels.Id").
		Join("Users u2 ON p.UserId = u2.Id").
		Where(sq.And{
			sq.Gt{"p.Id": afterId},
			sq.Eq{"p.RootId": ""},
			sq.Eq{"p.DeleteAt": 0},
			sq.Eq{"Channels.Type": []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup}},
		}).
		GroupBy("p.Id, u2.Username").
		OrderBy("p.Id").
		Limit(uint64(limit))

	if !includeArchivedChannels {
		query = query.Where(
			sq.Eq{"Channels.DeleteAt": 0},
		)
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}

	if err2 := s.GetReplica().Select(&result, queryString, args...); err2 != nil {
		return nil, errors.Wrap(err2, "failed to find Posts")
	}
	var channelIds []string
	for _, p := range result {
		channelIds = append(channelIds, p.ChannelId)
	}
	query = s.getQueryBuilder().
		Select("u.Username as Username, ChannelId, UserId, cm.Roles as Roles, LastViewedAt, MsgCount, MentionCount, MentionCountRoot, cm.NotifyProps as NotifyProps, LastUpdateAt, SchemeUser, SchemeAdmin, (SchemeGuest IS NOT NULL AND SchemeGuest) as SchemeGuest").
		From("ChannelMembers cm").
		Join("Users u ON ( u.Id = cm.UserId )").
		Where(sq.Eq{
			"cm.ChannelId": channelIds,
		})

	queryString, args, err = query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}

	channelMembers := []*model.ChannelMemberForExport{}
	if err = s.GetReplica().Select(&channelMembers, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	// Build a map of channels and their posts
	postsChannelMap := make(map[string][]*model.DirectPostForExport)
	for _, post := range result {
		post.ChannelMembers = &[]string{}
		postsChannelMap[post.ChannelId] = append(postsChannelMap[post.ChannelId], post)
	}

	// Build a map of channels and their members
	channelMembersMap := make(map[string][]string)
	for _, member := range channelMembers {
		channelMembersMap[member.ChannelId] = append(channelMembersMap[member.ChannelId], member.Username)
	}

	// Populate each post ChannelMembers extracting it from the channelMembersMap
	for channelId := range channelMembersMap {
		for _, post := range postsChannelMap[channelId] {
			*post.ChannelMembers = channelMembersMap[channelId]
		}
	}

	return result, nil
}

//nolint:unparam
func (s *SqlPostStore) SearchPostsForUser(rctx request.CTX, paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, error) {
	// Since we don't support paging for DB search, we just return nothing for later pages
	if page > 0 {
		return model.MakePostSearchResults(model.NewPostList(), nil), nil
	}

	if err := model.IsSearchParamsListValid(paramsList); err != nil {
		return nil, err
	}

	var wg sync.WaitGroup

	pchan := make(chan store.StoreResult[*model.PostList], len(paramsList))

	for _, params := range paramsList {
		// remove any unquoted term that contains only non-alphanumeric chars
		// ex: abcd "**" && abc     >>     abcd "**" abc
		params.Terms = removeNonAlphaNumericUnquotedTerms(params.Terms, " ")

		wg.Add(1)

		go func(params *model.SearchParams) {
			defer wg.Done()
			postList, err := s.search(teamId, userId, params, false, false)
			pchan <- store.StoreResult[*model.PostList]{Data: postList, NErr: err}
		}(params)
	}

	wg.Wait()
	close(pchan)

	posts := model.NewPostList()

	for result := range pchan {
		if result.NErr != nil {
			return nil, result.NErr
		}
		posts.Extend(result.Data)
	}

	posts.SortByCreateAt()

	return model.MakePostSearchResults(posts, nil), nil
}

func (s *SqlPostStore) GetOldestEntityCreationTime() (int64, error) {
	query := s.getQueryBuilder().Select("MIN(min_createat) min_createat").
		Suffix(`FROM (
					(SELECT MIN(createat) min_createat FROM Posts)
					UNION
					(SELECT MIN(createat) min_createat FROM Users)
					UNION
					(SELECT MIN(createat) min_createat FROM Channels)
				) entities`)
	queryString, args, err := query.ToSql()
	if err != nil {
		return -1, errors.Wrap(err, "post_tosql")
	}

	var oldest int64
	err = s.GetReplica().Get(&oldest, queryString, args...)
	if err != nil {
		return -1, errors.Wrap(err, "unable to scan oldest entity creation time")
	}
	return oldest, nil
}

// Deletes a thread and a thread membership if the postId is a root post
func (s *SqlPostStore) permanentDeleteThreads(transaction *sqlxTxWrapper, postIds []string) error {
	query := s.getQueryBuilder().
		Delete("Threads").
		Where(
			sq.Eq{"PostId": postIds},
		)
	if _, err := transaction.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete Threads")
	}

	query = s.getQueryBuilder().
		Delete("ThreadMemberships").
		Where(
			sq.Eq{"PostId": postIds},
		)
	if _, err := transaction.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete ThreadMemberships")
	}
	return nil
}

func (s *SqlPostStore) permanentDeleteReactions(transaction *sqlxTxWrapper, postIds []string) error {
	query := s.getQueryBuilder().
		Delete("Reactions").
		Where(
			sq.Eq{"PostId": postIds},
		)
	if _, err := transaction.ExecBuilder(query); err != nil {
		return errors.Wrap(err, "failed to delete Reactions")
	}

	return nil
}

// deleteThread marks a thread as deleted at the given time.
func (s *SqlPostStore) deleteThread(transaction *sqlxTxWrapper, postId string, deleteAtTime int64) error {
	queryString, args, err := s.getQueryBuilder().
		Update("Threads").
		Set("ThreadDeleteAt", deleteAtTime).
		Where(sq.Eq{"PostId": postId}).
		ToSql()
	if err != nil {
		return errors.Wrapf(err, "failed to create SQL query to mark thread for root post %s as deleted", postId)
	}

	_, err = transaction.Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to mark thread for root post %s as deleted", postId)
	}

	return s.deleteThreadFiles(transaction, postId, deleteAtTime)
}

func (s *SqlPostStore) deleteThreadFiles(transaction *sqlxTxWrapper, postID string, deleteAtTime int64) error {
	var query sq.UpdateBuilder
	if s.DriverName() == model.DatabaseDriverPostgres {
		query = s.getQueryBuilder().Update("FileInfo").
			Set("DeleteAt", deleteAtTime).
			From("Posts")
	} else {
		query = s.getQueryBuilder().Update("FileInfo", "Posts").
			Set("FileInfo.DeleteAt", deleteAtTime)
	}

	query = query.Where(sq.And{
		sq.Expr("FileInfo.PostId = Posts.Id"),
		sq.Eq{"Posts.RootId": postID},
	})

	_, err := transaction.ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to mark files of thread post %s as deleted", postID)
	}

	return nil
}

// updateThreadAfterReplyDeletion decrements the thread reply count and adjusts the participants
// list as necessary.
func (s *SqlPostStore) updateThreadAfterReplyDeletion(transaction *sqlxTxWrapper, rootId string, userId string) error {
	if rootId != "" {
		queryString, args, err := s.getQueryBuilder().
			Select("COUNT(Posts.Id)").
			From("Posts").
			Where(sq.And{
				sq.Eq{"Posts.RootId": rootId},
				sq.Eq{"Posts.UserId": userId},
				sq.Eq{"Posts.DeleteAt": 0},
			}).
			ToSql()

		if err != nil {
			return errors.Wrap(err, "failed to create SQL query to count user's posts")
		}

		var count int64
		err = transaction.Get(&count, queryString, args...)

		if err != nil {
			return errors.Wrap(err, "failed to count user's posts in thread")
		}

		// Updating replyCount, and reducing participants if this was the last post in the thread for the user
		updateQuery := s.getQueryBuilder().Update("Threads")

		if count == 0 {
			if s.DriverName() == model.DatabaseDriverPostgres {
				updateQuery = updateQuery.Set("Participants", sq.Expr("Participants - ?", userId))
			} else {
				updateQuery = updateQuery.
					Set("Participants", sq.Expr(
						`IFNULL(JSON_REMOVE(Participants, JSON_UNQUOTE(JSON_SEARCH(Participants, 'one', ?))), Participants)`, userId,
					))
			}
		}

		lastReplyAtSubquery := sq.Select("COALESCE(MAX(CreateAt), 0)").
			From("Posts").
			Where(sq.Eq{
				"RootId":   rootId,
				"DeleteAt": 0,
			})

		lastReplyCountSubquery := sq.Select("Count(*)").
			From("Posts").
			Where(sq.Eq{
				"RootId":   rootId,
				"DeleteAt": 0,
			})

		updateQueryString, updateArgs, err := updateQuery.
			Set("LastReplyAt", lastReplyAtSubquery).
			Set("ReplyCount", lastReplyCountSubquery).
			Where(sq.And{
				sq.Eq{"PostId": rootId},
				sq.Gt{"ReplyCount": 0},
			}).
			ToSql()

		if err != nil {
			return errors.Wrap(err, "failed to create SQL query to update thread")
		}

		_, err = transaction.Exec(updateQueryString, updateArgs...)

		if err != nil {
			return errors.Wrap(err, "failed to update Threads")
		}
	}
	return nil
}

func (s *SqlPostStore) savePostsPriority(transaction *sqlxTxWrapper, posts []*model.Post) error {
	for _, post := range posts {
		if post.GetPriority() != nil {
			postPriority := &model.PostPriority{
				PostId:                  post.Id,
				ChannelId:               post.ChannelId,
				Priority:                post.Metadata.Priority.Priority,
				RequestedAck:            post.Metadata.Priority.RequestedAck,
				PersistentNotifications: post.Metadata.Priority.PersistentNotifications,
			}
			if _, err := transaction.NamedExec(`INSERT INTO PostsPriority (PostId, ChannelId, Priority, RequestedAck, PersistentNotifications) VALUES (:PostId, :ChannelId, :Priority, :RequestedAck, :PersistentNotifications)`, postPriority); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *SqlPostStore) savePostsPersistentNotifications(transaction *sqlxTxWrapper, posts []*model.Post) error {
	for _, post := range posts {
		if priority := post.GetPriority(); priority != nil && priority.PersistentNotifications != nil && *priority.PersistentNotifications {
			if _, err := transaction.NamedExec(`INSERT INTO PersistentNotifications (PostId, CreateAt, LastSentAt, DeleteAt, SentCount) VALUES (:PostId, :CreateAt, :LastSentAt, :DeleteAt, :SentCount)`, &model.PostPersistentNotifications{
				PostId:   post.Id,
				CreateAt: post.CreateAt,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *SqlPostStore) updateThreadsFromPosts(transaction *sqlxTxWrapper, posts []*model.Post) error {
	postsByRoot := map[string][]*model.Post{}
	var rootIds []string
	for _, post := range posts {
		// skip if post is not a part of a thread
		if post.RootId == "" {
			continue
		}
		rootIds = append(rootIds, post.RootId)
		postsByRoot[post.RootId] = append(postsByRoot[post.RootId], post)
	}
	if len(rootIds) == 0 {
		return nil
	}
	threadsByRootsSql, threadsByRootsArgs, err := s.getQueryBuilder().
		Select(
			"Threads.PostId",
			"Threads.ChannelId",
			"Threads.ReplyCount",
			"Threads.LastReplyAt",
			"Threads.Participants",
			"COALESCE(Threads.ThreadDeleteAt, 0) AS DeleteAt",
		).
		From("Threads").
		Where(sq.Eq{"Threads.PostId": rootIds}).
		ToSql()
	if err != nil {
		return errors.Wrap(err, "updateThreadsFromPosts_ToSql")
	}

	threadsByRoots := []*model.Thread{}
	err = transaction.Select(&threadsByRoots, threadsByRootsSql, threadsByRootsArgs...)
	if err != nil {
		return err
	}

	threadByRoot := map[string]*model.Thread{}
	for _, thread := range threadsByRoots {
		threadByRoot[thread.PostId] = thread
	}

	teamIdByChannelId := map[string]string{}

	for rootId, posts := range postsByRoot {
		if thread, found := threadByRoot[rootId]; !found {
			data := []struct {
				UserId    string
				RepliedAt int64
			}{}

			// calculate participants
			if err := transaction.Select(&data, "SELECT Posts.UserId, MAX(Posts.CreateAt) as RepliedAt FROM Posts WHERE Posts.RootId=? AND Posts.DeleteAt=0 GROUP BY Posts.UserId ORDER BY RepliedAt ASC", rootId); err != nil {
				return err
			}

			var participants model.StringArray
			for _, item := range data {
				participants = append(participants, item.UserId)
			}

			// calculate reply count
			var count int64
			err := transaction.Get(&count, "SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId=? And Posts.DeleteAt=0", rootId)
			if err != nil {
				return err
			}
			// calculate last reply at
			var lastReplyAt int64
			err = transaction.Get(&lastReplyAt, "SELECT COALESCE(MAX(Posts.CreateAt), 0) FROM Posts WHERE Posts.RootID=? and Posts.DeleteAt=0", rootId)
			if err != nil {
				return err
			}

			channelId := posts[0].ChannelId
			teamId, ok := teamIdByChannelId[channelId]
			if !ok {
				// get teamId for channel
				err = transaction.Get(&teamId, "SELECT COALESCE(Channels.TeamId, '') FROM Channels WHERE Channels.Id=?", channelId)
				if err != nil {
					return err
				}

				// store teamId for channel for efficiency
				teamIdByChannelId[channelId] = teamId
			}
			// no metadata entry, create one
			if _, err := transaction.NamedExec(`INSERT INTO Threads
				(PostId, ChannelId, ReplyCount, LastReplyAt, Participants, ThreadTeamId)
				VALUES
				(:PostId, :ChannelId, :ReplyCount, :LastReplyAt, :Participants, :TeamId)`, &model.Thread{
				PostId:       rootId,
				ChannelId:    channelId,
				ReplyCount:   count,
				LastReplyAt:  lastReplyAt,
				Participants: participants,
				TeamId:       teamId,
			}); err != nil {
				return err
			}
		} else {
			// metadata exists, update it
			for _, post := range posts {
				thread.ReplyCount += 1
				if thread.Participants.Contains(post.UserId) {
					thread.Participants = thread.Participants.Remove(post.UserId)
				}
				thread.Participants = append(thread.Participants, post.UserId)
				if post.CreateAt > thread.LastReplyAt {
					thread.LastReplyAt = post.CreateAt
				}
			}
			if _, err := transaction.NamedExec(`UPDATE Threads
				SET ChannelId = :ChannelId,
					ReplyCount = :ReplyCount,
					LastReplyAt = :LastReplyAt,
					Participants = :Participants
				WHERE PostId=:PostId`, thread); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *SqlPostStore) SetPostReminder(reminder *model.PostReminder) error {
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	sql := `SELECT EXISTS (SELECT 1 FROM Posts	WHERE Id=?)`
	var exist bool
	err = transaction.Get(&exist, sql, reminder.PostId)
	if err != nil {
		return errors.Wrap(err, "failed to check for post")
	}
	if !exist {
		return store.NewErrNotFound("Post", reminder.PostId)
	}

	query := s.getQueryBuilder().
		Insert("PostReminders").
		Columns("PostId", "UserId", "TargetTime").
		Values(reminder.PostId, reminder.UserId, reminder.TargetTime)

	if s.DriverName() == model.DatabaseDriverMysql {
		query = query.SuffixExpr(sq.Expr("ON DUPLICATE KEY UPDATE TargetTime = ?", reminder.TargetTime))
	} else {
		query = query.SuffixExpr(sq.Expr("ON CONFLICT (postid, userid) DO UPDATE SET TargetTime = ?", reminder.TargetTime))
	}

	sql, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "setPostReminder_tosql")
	}
	if _, err2 := transaction.Exec(sql, args...); err2 != nil {
		return errors.Wrap(err2, "failed to insert post reminder")
	}
	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (s *SqlPostStore) GetPostReminders(now int64) (_ []*model.PostReminder, err error) {
	reminders := []*model.PostReminder{}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	err = transaction.Select(&reminders, `SELECT PostId, UserId
		FROM PostReminders
		WHERE TargetTime < ?`, now)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, "failed to get post reminders")
	}

	if err == sql.ErrNoRows {
		// No need to execute delete statement if there's nothing to delete.
		return reminders, nil
	}

	// Postgres supports RETURNING * in a DELETE statement, but MySQL doesn't.
	// So we are stuck with 2 queries. Not taking separate paths for Postgres
	// and MySQL for simplicity.
	_, err = transaction.Exec(`DELETE from PostReminders WHERE TargetTime < ?`, now)
	if err != nil {
		return nil, errors.Wrap(err, "failed to delete post reminders")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return reminders, nil
}

func (s *SqlPostStore) GetPostReminderMetadata(postID string) (*store.PostReminderMetadata, error) {
	meta := &store.PostReminderMetadata{}
	err := s.GetReplica().Get(meta, `SELECT c.id as ChannelID,
		COALESCE(t.name, '') as TeamName,
		u.locale as UserLocale, u.username as Username
	FROM Posts p
	JOIN Channels c ON p.ChannelId=c.Id
	LEFT JOIN Teams t ON c.TeamId=t.Id
	JOIN Users u ON p.UserId=u.Id
	AND p.Id=?`, postID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get post reminder metadata: postId %s", postID)
	}

	return meta, nil
}
