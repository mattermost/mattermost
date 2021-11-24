// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/gorp"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/searchlayer"
	"github.com/mattermost/mattermost-server/v6/utils"
)

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

func postToSlice(post *model.Post) []interface{} {
	return []interface{}{
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
	s := &SqlPostStore{
		SqlStore:          sqlStore,
		metrics:           metrics,
		maxPostSizeCached: model.PostMessageMaxRunesV1,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Post{}, "Posts").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("ChannelId").SetMaxSize(26)
		table.ColMap("RootId").SetMaxSize(26)
		table.ColMap("OriginalId").SetMaxSize(26)
		table.ColMap("Message").SetMaxSize(model.PostMessageMaxBytesV2)
		table.ColMap("Type").SetMaxSize(26)
		table.ColMap("Hashtags").SetMaxSize(1000)
		table.ColMap("Props").SetDataType(sqlStore.jsonDataType())
		table.ColMap("Filenames").SetMaxSize(model.PostFilenamesMaxRunes)
		table.ColMap("FileIds").SetMaxSize(model.PostFileidsMaxRunes)
		table.ColMap("RemoteId").SetMaxSize(26)
	}

	return s
}

func (s *SqlPostStore) createIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_posts_update_at", "Posts", "UpdateAt")
	s.CreateIndexIfNotExists("idx_posts_create_at", "Posts", "CreateAt")
	s.CreateIndexIfNotExists("idx_posts_delete_at", "Posts", "DeleteAt")
	s.CreateIndexIfNotExists("idx_posts_user_id", "Posts", "UserId")
	s.CreateIndexIfNotExists("idx_posts_is_pinned", "Posts", "IsPinned")

	s.CreateCompositeIndexIfNotExists("idx_posts_channel_id_update_at", "Posts", []string{"ChannelId", "UpdateAt"})
	s.CreateCompositeIndexIfNotExists("idx_posts_channel_id_delete_at_create_at", "Posts", []string{"ChannelId", "DeleteAt", "CreateAt"})
	s.CreateCompositeIndexIfNotExists("idx_posts_root_id_delete_at", "Posts", []string{"RootId", "DeleteAt"})

	s.CreateFullTextIndexIfNotExists("idx_posts_message_txt", "Posts", "Message")
	s.CreateFullTextIndexIfNotExists("idx_posts_hashtags_txt", "Posts", "Hashtags")
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

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return posts, -1, errors.Wrap(err, "begin_transaction")
	}

	defer finalizeTransaction(transaction)

	if _, err = transaction.Exec(query, args...); err != nil {
		return nil, -1, errors.Wrap(err, "failed to save Post")
	}

	if err = s.updateThreadsFromPosts(transaction, posts); err != nil {
		mlog.Warn("Error updating posts, thread update failed", mlog.Err(err))
	}

	if err = transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return posts, -1, errors.Wrap(err, "commit_transaction")
	}

	for channelId, count := range channelNewPosts {
		countRoot := channelNewRootPosts[channelId]

		if _, err = s.GetMaster().Exec("UPDATE Channels SET LastPostAt = GREATEST(:LastPostAt, LastPostAt), LastRootPostAt = GREATEST(:LastRootPostAt, LastRootPostAt), TotalMsgCount = TotalMsgCount + :Count, TotalMsgCountRoot = TotalMsgCountRoot + :CountRoot WHERE Id = :ChannelId", map[string]interface{}{"LastPostAt": maxDateNewPosts[channelId], "LastRootPostAt": maxDateNewRootPosts[channelId], "ChannelId": channelId, "Count": count, "CountRoot": countRoot}); err != nil {
			mlog.Warn("Error updating Channel LastPostAt.", mlog.Err(err))
		}
	}

	for rootId := range rootIds {
		if _, err = s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId", map[string]interface{}{"UpdateAt": maxDateRootIds[rootId], "RootId": rootId}); err != nil {
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

func (s *SqlPostStore) Save(post *model.Post) (*model.Post, error) {
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
	query := s.getQueryBuilder().Select("RootId, COUNT(Id) AS Count").From("Posts").Where(sq.Eq{"RootId": rootIds}).Where(sq.Eq{"DeleteAt": 0}).GroupBy("RootId")

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "post_tosql")
	}
	_, err = s.GetMaster().Select(&countList, queryString, args...)
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

func (s *SqlPostStore) Update(newPost *model.Post, oldPost *model.Post) (*model.Post, error) {
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

	if _, err := s.GetMaster().Update(newPost); err != nil {
		return nil, errors.Wrapf(err, "failed to update Post with id=%s", newPost.Id)
	}

	time := model.GetMillis()
	s.GetMaster().Exec("UPDATE Channels SET LastPostAt = :LastPostAt  WHERE Id = :ChannelId AND LastPostAt < :LastPostAt", map[string]interface{}{"LastPostAt": time, "ChannelId": newPost.ChannelId})

	if newPost.RootId != "" {
		s.GetMaster().Exec("UPDATE Posts SET UpdateAt = :UpdateAt WHERE Id = :RootId AND UpdateAt < :UpdateAt", map[string]interface{}{"UpdateAt": time, "RootId": newPost.RootId})
	}

	// mark the old post as deleted
	s.GetMaster().Insert(oldPost)

	return newPost, nil
}

func (s *SqlPostStore) OverwriteMultiple(posts []*model.Post) ([]*model.Post, int, error) {
	updateAt := model.GetMillis()
	maxPostSize := s.GetMaxPostSize()
	for idx, post := range posts {
		post.UpdateAt = updateAt
		if appErr := post.IsValid(maxPostSize); appErr != nil {
			return nil, idx, appErr
		}
	}

	tx, err := s.GetMaster().Begin()
	if err != nil {
		return nil, -1, errors.Wrap(err, "begin_transaction")
	}
	for idx, post := range posts {
		if _, err = tx.Update(post); err != nil {
			txErr := tx.Rollback()
			if txErr != nil {
				return nil, idx, errors.Wrap(txErr, "rollback_transaction")
			}

			return nil, idx, errors.Wrap(err, "failed to update Post")
		}
		if post.RootId != "" {
			tx.Exec("UPDATE Threads SET LastReplyAt = :UpdateAt WHERE PostId = :RootId", map[string]interface{}{"UpdateAt": updateAt, "RootId": post.Id})
		}
	}
	err = tx.Commit()
	if err != nil {
		return nil, -1, errors.Wrap(err, "commit_transaction")
	}

	return posts, -1, nil
}

func (s *SqlPostStore) Overwrite(post *model.Post) (*model.Post, error) {
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

func (s *SqlPostStore) getFlaggedPosts(userId, channelId, teamId string, offset int, limit int) (*model.PostList, error) {
	pl := model.NewPostList()

	var posts []*model.Post
	query := `
            SELECT
                A.*, (SELECT count(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN A.RootId = '' THEN A.Id ELSE A.RootId END) AND Posts.DeleteAt = 0) as ReplyCount
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
							UserId = :UserId
							AND Category = :Category
					)
					CHANNEL_FILTER
					AND DeleteAt = 0
                ) as A
            INNER JOIN Channels as B
                ON B.Id = A.ChannelId
			WHERE
				ChannelId IN (
					SELECT
						Id
					FROM
						Channels,
						ChannelMembers
					WHERE
						Id = ChannelId
						AND UserId = :UserId
				)
				TEAM_FILTER
            ORDER BY CreateAt DESC
            LIMIT :Limit OFFSET :Offset`

	queryParams := map[string]interface{}{
		"UserId":   userId,
		"Category": model.PreferenceCategoryFlaggedPost,
		"Offset":   offset,
		"Limit":    limit,
	}

	teamClause, queryParams := s.buildFlaggedPostTeamFilterClause(teamId, queryParams)
	query = strings.Replace(query, "TEAM_FILTER", teamClause, 1)

	channelClause, queryParams := s.buildFlaggedPostChannelFilterClause(channelId, queryParams)
	query = strings.Replace(query, "CHANNEL_FILTER", channelClause, 1)

	if _, err := s.GetReplica().Select(&posts, query, queryParams); err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}

	for _, post := range posts {
		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}

	return pl, nil
}

func (s *SqlPostStore) buildFlaggedPostTeamFilterClause(teamId string, queryParams map[string]interface{}) (string, map[string]interface{}) {
	if teamId == "" {
		return "", queryParams
	}

	queryParams["TeamId"] = teamId

	return "AND B.TeamId = :TeamId OR B.TeamId = ''", queryParams
}

func (s *SqlPostStore) buildFlaggedPostChannelFilterClause(channelId string, queryParams map[string]interface{}) (string, map[string]interface{}) {
	if channelId == "" {
		return "", queryParams
	}

	queryParams["ChannelId"] = channelId

	return "AND ChannelId = :ChannelId", queryParams
}

func (s *SqlPostStore) getPostWithCollapsedThreads(id, userID string, extended bool) (*model.PostList, error) {
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

	postFetchQuery, args, _ := s.getQueryBuilder().
		Select(columns...).
		From("Posts").
		LeftJoin("Threads ON Threads.PostId = Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Id AND ThreadMemberships.UserId = ?", userID).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"Id": id}).ToSql()

	err := s.GetReplica().SelectOne(&post, postFetchQuery, args...)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", id)
		}

		return nil, errors.Wrapf(err, "failed to get Post with id=%s", id)
	}

	var posts []*model.Post
	_, err = s.GetReplica().Select(&posts, "SELECT * FROM Posts WHERE Posts.RootId = :RootId AND DeleteAt = 0", map[string]interface{}{"RootId": id})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts for thread %s", id)
	}

	list, err := s.prepareThreadedResponse([]*postWithExtra{&post}, extended, false)
	if err != nil {
		return nil, err
	}
	for _, p := range posts {
		list.AddPost(p)
		list.AddOrder(p.Id)
	}
	return list, nil
}

func (s *SqlPostStore) Get(ctx context.Context, id string, skipFetchThreads, collapsedThreads, collapsedThreadsExtended bool, userID string) (*model.PostList, error) {
	if collapsedThreads {
		return s.getPostWithCollapsedThreads(id, userID, collapsedThreadsExtended)
	}
	pl := model.NewPostList()

	if id == "" {
		return nil, store.NewErrInvalidInput("Post", "id", id)
	}

	var post model.Post
	postFetchQuery := "SELECT p.*, (SELECT count(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount FROM Posts p WHERE p.Id = :Id AND p.DeleteAt = 0"
	err := s.DBFromContext(ctx).SelectOne(&post, postFetchQuery, map[string]interface{}{"Id": id})
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", id)
		}

		return nil, errors.Wrapf(err, "failed to get Post with id=%s", id)
	}
	pl.AddPost(&post)
	pl.AddOrder(id)
	if !skipFetchThreads {
		rootId := post.RootId

		if rootId == "" {
			rootId = post.Id
		}

		if rootId == "" {
			return nil, errors.Wrapf(err, "invalid rootId with value=%s", rootId)
		}

		var posts []*model.Post
		_, err = s.GetReplica().Select(&posts, "SELECT *, (SELECT count(Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount FROM Posts p WHERE (Id = :Id OR RootId = :RootId) AND DeleteAt = 0", map[string]interface{}{"Id": rootId, "RootId": rootId})
		if err != nil {
			return nil, errors.Wrap(err, "failed to find Posts")
		}

		for _, p := range posts {
			pl.AddPost(p)
			pl.AddOrder(p.Id)
		}
	}
	return pl, nil
}

func (s *SqlPostStore) GetSingle(id string, inclDeleted bool) (*model.Post, error) {
	query := s.getQueryBuilder().
		Select("p.*").
		From("Posts p").
		Where(sq.Eq{"p.Id": id})

	replyCountSubQuery := s.getQueryBuilder().
		Select("COUNT(Posts.Id)").
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
	err = s.GetReplica().SelectOne(&post, queryString, args...)
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
	sql, args, _ := q.ToSql()

	var et etagPosts
	err := s.GetReplica().SelectOne(&et, sql, args...)
	var result string
	if err != nil {
		result = fmt.Sprintf("%v.%v", model.CurrentVersion, model.GetMillis())
	} else {
		result = fmt.Sprintf("%v.%v", model.CurrentVersion, et.UpdateAt)
	}

	return result
}

func (s *SqlPostStore) Delete(postID string, time int64, deleteByID string) error {
	var err error
	if s.DriverName() == model.DatabaseDriverPostgres {
		_, err = s.GetMaster().Exec(`UPDATE Posts
			SET DeleteAt = $1,
				UpdateAt = $1,
				Props = jsonb_set(Props, $2, $3)
			WHERE Id = $4 OR RootId = $4`, time, jsonKeyPath(model.PostPropsDeleteBy), jsonStringVal(deleteByID), postID)
	} else {
		_, err = s.GetMaster().Exec(`UPDATE Posts
			SET DeleteAt = ?,
			UpdateAt = ?,
			Props = JSON_SET(Props, ?, ?)
			Where Id = ? OR RootId = ?`, time, time, "$."+model.PostPropsDeleteBy, deleteByID, postID, postID)
	}

	if err != nil {
		return errors.Wrap(err, "failed to update Posts")
	}

	ids := postIds{}
	// TODO: change this to later delete thread directly from postID
	err = s.GetReplica().SelectOne(&ids, "SELECT RootId, UserId FROM Posts WHERE Id = :Id", map[string]interface{}{"Id": postID})
	if err != nil {
		if err == sql.ErrNoRows {
			return store.NewErrNotFound("Post", postID)
		}

		return errors.Wrapf(err, "failed to delete Post with id=%s", postID)
	}

	return s.cleanupThreads(postID, ids.RootId, false, ids.UserId)
}

func (s *SqlPostStore) permanentDelete(postId string) error {
	var post model.Post
	err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts WHERE Id = :Id", map[string]interface{}{"Id": postId})
	if err != nil && err != sql.ErrNoRows {
		return errors.Wrapf(err, "failed to get Post with id=%s", postId)
	}
	if err = s.cleanupThreads(post.Id, post.RootId, true, post.UserId); err != nil {
		return errors.Wrapf(err, "failed to cleanup threads for Post with id=%s", postId)
	}

	if _, err = s.GetMaster().Exec("DELETE FROM Posts WHERE Id = :Id OR RootId = :RootId", map[string]interface{}{"Id": postId, "RootId": postId}); err != nil {
		return errors.Wrapf(err, "failed to delete Post with id=%s", postId)
	}

	return nil
}

type postIds struct {
	Id     string
	RootId string
	UserId string
}

func (s *SqlPostStore) permanentDeleteAllCommentByUser(userId string) error {
	results := []postIds{}
	_, err := s.GetMaster().Select(&results, "Select Id, RootId FROM Posts WHERE UserId = :UserId AND RootId != ''", map[string]interface{}{"UserId": userId})
	if err != nil {
		return errors.Wrapf(err, "failed to fetch Posts with userId=%s", userId)
	}

	for _, ids := range results {
		if err = s.cleanupThreads(ids.Id, ids.RootId, true, userId); err != nil {
			return err
		}
	}

	_, err = s.GetMaster().Exec("DELETE FROM Posts WHERE UserId = :UserId AND RootId != ''", map[string]interface{}{"UserId": userId})
	if err != nil {
		return errors.Wrapf(err, "failed to delete Posts with userId=%s", userId)
	}
	return nil
}

func (s *SqlPostStore) PermanentDeleteByUser(userId string) error {
	// First attempt to delete all the comments for a user
	if err := s.permanentDeleteAllCommentByUser(userId); err != nil {
		return err
	}

	// Now attempt to delete all the root posts for a user. This will also
	// delete all the comments for each post
	found := true
	count := 0

	for found {
		var ids []string
		_, err := s.GetMaster().Select(&ids, "SELECT Id FROM Posts WHERE UserId = :UserId LIMIT 1000", map[string]interface{}{"UserId": userId})
		if err != nil {
			return errors.Wrapf(err, "failed to find Posts with userId=%s", userId)
		}

		found = false
		for _, id := range ids {
			found = true
			if err = s.permanentDelete(id); err != nil {
				return err
			}
		}

		// This is a fail safe, give up if more than 10k messages
		count++
		if count >= 10 {
			return errors.Wrapf(err, "too many Posts to delete with userId=%s", userId)
		}
	}

	return nil
}

func (s *SqlPostStore) PermanentDeleteByChannel(channelId string) error {
	results := []postIds{}
	_, err := s.GetMaster().Select(&results, "SELECT Id, RootId, UserId FROM Posts WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return errors.Wrapf(err, "failed to fetch Posts with channelId=%s", channelId)
	}

	for _, ids := range results {
		if err = s.cleanupThreads(ids.Id, ids.RootId, true, ids.UserId); err != nil {
			return err
		}
	}

	if _, err := s.GetMaster().Exec("DELETE FROM Posts WHERE ChannelId = :ChannelId", map[string]interface{}{"ChannelId": channelId}); err != nil {
		return errors.Wrapf(err, "failed to delete Posts with channelId=%s", channelId)
	}
	return nil
}

func (s *SqlPostStore) prepareThreadedResponse(posts []*postWithExtra, extended, reversed bool) (*model.PostList, error) {
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
			p.Post.IsFollowing = model.NewBool(*p.IsFollowing)
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
		list.AddPost(&posts[idx].Post)
		list.AddOrder(posts[idx].Id)
	}

	return list, nil
}

func (s *SqlPostStore) getPostsCollapsedThreads(options model.GetPostsOptions) (*model.PostList, error) {
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
		LeftJoin("Threads ON Threads.PostId = Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Id AND ThreadMemberships.UserId = ?", options.UserId).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"Posts.ChannelId": options.ChannelId}).
		Where(sq.Eq{"RootId": ""}).
		Limit(uint64(options.PerPage)).
		Offset(uint64(offset)).
		OrderBy("CreateAt DESC").ToSql()

	_, err := s.GetReplica().Select(&posts, postFetchQuery, args...)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", options.ChannelId)
	}

	return s.prepareThreadedResponse(posts, options.CollapsedThreadsExtended, false)
}

func (s *SqlPostStore) GetPosts(options model.GetPostsOptions, _ bool) (*model.PostList, error) {
	if options.PerPage > 1000 {
		return nil, store.NewErrInvalidInput("Post", "<options.PerPage>", options.PerPage)
	}
	if options.CollapsedThreads {
		return s.getPostsCollapsedThreads(options)
	}
	offset := options.PerPage * options.Page

	rpc := make(chan store.StoreResult, 1)
	go func() {
		posts, err := s.getRootPosts(options.ChannelId, offset, options.PerPage, options.SkipFetchThreads)
		rpc <- store.StoreResult{Data: posts, NErr: err}
		close(rpc)
	}()
	cpc := make(chan store.StoreResult, 1)
	go func() {
		posts, err := s.getParentsPosts(options.ChannelId, offset, options.PerPage, options.SkipFetchThreads)
		cpc <- store.StoreResult{Data: posts, NErr: err}
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

	posts := rpr.Data.([]*model.Post)
	parents := cpr.Data.([]*model.Post)

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

func (s *SqlPostStore) getPostsSinceCollapsedThreads(options model.GetPostsSinceOptions) (*model.PostList, error) {
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

	postFetchQuery, args, _ := s.getQueryBuilder().
		Select(columns...).
		From("Posts").
		LeftJoin("Threads ON Threads.PostId = Id").
		LeftJoin("ThreadMemberships ON ThreadMemberships.PostId = Id AND ThreadMemberships.UserId = ?", options.UserId).
		Where(sq.Eq{"DeleteAt": 0}).
		Where(sq.Eq{"Posts.ChannelId": options.ChannelId}).
		Where(sq.Gt{"UpdateAt": options.Time}).
		Where(sq.Eq{"RootId": ""}).
		OrderBy("CreateAt DESC").ToSql()

	_, err := s.GetReplica().Select(&posts, postFetchQuery, args...)

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", options.ChannelId)
	}
	return s.prepareThreadedResponse(posts, options.CollapsedThreadsExtended, false)
}

//nolint:unparam
func (s *SqlPostStore) GetPostsSince(options model.GetPostsSinceOptions, allowFromCache bool) (*model.PostList, error) {
	if options.CollapsedThreads {
		return s.getPostsSinceCollapsedThreads(options)
	}

	var posts []*model.Post

	order := "DESC"
	if options.SortAscending {
		order = "ASC"
	}

	replyCountQuery1 := ""
	replyCountQuery2 := ""
	if options.SkipFetchThreads {
		replyCountQuery1 = `, (SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p1.RootId = '' THEN p1.Id ELSE p1.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
		replyCountQuery2 = `, (SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN cte.RootId = '' THEN cte.Id ELSE cte.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
	}
	var query string

	// union of IDs and then join to get full posts is faster in mysql
	if s.DriverName() == model.DatabaseDriverMysql {
		query = `SELECT *` + replyCountQuery1 + ` FROM Posts p1 JOIN (
			(SELECT
              Id
			  FROM
				  Posts p2
			  WHERE
				  (UpdateAt > :Time
					  AND ChannelId = :ChannelId)
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
						  UpdateAt > :Time
							  AND ChannelId = :ChannelId
					  LIMIT 1000) temp_tab))
			) j ON p1.Id = j.Id
          ORDER BY CreateAt ` + order
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		query = `WITH cte AS (SELECT
		       *
		FROM
		       Posts
		WHERE
		       UpdateAt > :Time AND ChannelId = :ChannelId
		       LIMIT 1000)
		(SELECT *` + replyCountQuery2 + ` FROM cte)
		UNION
		(SELECT *` + replyCountQuery1 + ` FROM Posts p1 WHERE id in (SELECT rootid FROM cte))
		ORDER BY CreateAt ` + order
	}
	_, err := s.GetReplica().Select(&posts, query, map[string]interface{}{"ChannelId": options.ChannelId, "Time": options.Time})

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
					UpdateAt >= :Time
					AND
					ChannelId = :ChannelId
					AND
					UserId = :UserId
					AND
					Type = :Type
				LIMIT 1)`

	var exist bool
	err := s.GetReplica().SelectOne(&exist, query, map[string]interface{}{
		"ChannelId": options.ChannelId,
		"Time":      options.Time,
		"UserId":    userId,
		"Type":      model.PostTypeAutoResponder,
	})

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
		Where(sq.Or{sq.Gt{"UpdateAt": cursor.LastPostUpdateAt}, sq.And{sq.Eq{"UpdateAt": cursor.LastPostUpdateAt}, sq.Gt{"Id": cursor.LastPostId}}}).
		OrderBy("UpdateAt", "Id").
		Limit(uint64(limit))

	if options.ChannelId != "" {
		query = query.Where(sq.Eq{"ChannelId": options.ChannelId})
	}

	if !options.IncludeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	if options.ExcludeRemoteId != "" {
		query = query.Where(sq.NotEq{"COALESCE(Posts.RemoteId,'')": options.ExcludeRemoteId})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, cursor, errors.Wrap(err, "getpostssinceforsync_tosql")
	}

	var posts []*model.Post
	_, err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, cursor, errors.Wrapf(err, "error getting Posts with channelId=%s", options.ChannelId)
	}

	if len(posts) != 0 {
		cursor.LastPostUpdateAt = posts[len(posts)-1].UpdateAt
		cursor.LastPostId = posts[len(posts)-1].Id
	}
	return posts, cursor, nil
}

func (s *SqlPostStore) GetPostsBefore(options model.GetPostsOptions) (*model.PostList, error) {
	return s.getPostsAround(true, options)
}

func (s *SqlPostStore) GetPostsAfter(options model.GetPostsOptions) (*model.PostList, error) {
	return s.getPostsAround(false, options)
}

func (s *SqlPostStore) getPostsAround(before bool, options model.GetPostsOptions) (*model.PostList, error) {
	if options.Page < 0 {
		return nil, store.NewErrInvalidInput("Post", "<options.Page>", options.Page)
	}

	if options.PerPage < 0 {
		return nil, store.NewErrInvalidInput("Post", "<options.PerPage>", options.PerPage)
	}

	offset := options.Page * options.PerPage
	var posts []*postWithExtra
	var parents []*model.Post

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
	replyCountSubQuery := s.getQueryBuilder().Select("COUNT(Posts.Id)").From("Posts").Where(sq.Expr("Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0"))

	conditions := sq.And{
		sq.Expr(`CreateAt `+direction+` (SELECT CreateAt FROM Posts WHERE Id = ?)`, options.PostId),
		sq.Eq{"p.ChannelId": options.ChannelId},
		sq.Eq{"DeleteAt": int(0)},
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
		OrderBy("p.ChannelId", "DeleteAt", "CreateAt "+sort).
		Limit(uint64(options.PerPage)).
		Offset(uint64(offset))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}
	_, err = s.GetMaster().Select(&posts, queryString, args...)
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
				sq.Eq{"ChannelId": options.ChannelId},
				sq.Eq{"DeleteAt": 0},
			}).
			OrderBy("CreateAt DESC")

		rootQueryString, rootArgs, nErr := rootQuery.ToSql()

		if nErr != nil {
			return nil, errors.Wrap(nErr, "post_tosql")
		}
		_, nErr = s.GetMaster().Select(&parents, rootQueryString, rootArgs...)
		if nErr != nil {
			return nil, errors.Wrapf(nErr, "failed to find Posts with channelId=%s", options.ChannelId)
		}
	}

	list, err := s.prepareThreadedResponse(posts, options.CollapsedThreadsExtended, !before)
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
		sq.Eq{"ChannelId": channelId},
		sq.Eq{"DeleteAt": int(0)},
	}
	if collapsedThreads {
		conditions = sq.And{conditions, sq.Eq{"RootId": ""}}
	}
	query := s.getQueryBuilder().
		Select("Id").
		From(table).
		Where(conditions).
		// Adding ChannelId and DeleteAt order columns
		// to let mysql choose the "idx_posts_channel_id_delete_at_create_at" index always.
		// See MM-23369.
		OrderBy("ChannelId", "DeleteAt", "CreateAt "+sort).
		Limit(1)

	queryString, args, err := query.ToSql()
	if err != nil {
		return "", errors.Wrap(err, "post_tosql")
	}

	var postId string
	if err := s.GetMaster().SelectOne(&postId, queryString, args...); err != nil {
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
		sq.Gt{"CreateAt": time},
		sq.Eq{"ChannelId": channelId},
		sq.Eq{"DeleteAt": int(0)},
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
		OrderBy("ChannelId", "DeleteAt", "CreateAt ASC").
		Limit(1)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}

	var post *model.Post
	if err := s.GetMaster().SelectOne(&post, queryString, args...); err != nil {
		if err != sql.ErrNoRows {
			return nil, errors.Wrapf(err, "failed to get Post with channelId=%s", channelId)
		}
	}

	return post, nil
}

func (s *SqlPostStore) getRootPosts(channelId string, offset int, limit int, skipFetchThreads bool) ([]*model.Post, error) {
	var posts []*model.Post
	var fetchQuery string
	if skipFetchThreads {
		fetchQuery = "SELECT p.*, (SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount FROM Posts p WHERE ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset"
	} else {
		fetchQuery = "SELECT * FROM Posts WHERE ChannelId = :ChannelId AND DeleteAt = 0 ORDER BY CreateAt DESC LIMIT :Limit OFFSET :Offset"
	}
	_, err := s.GetReplica().Select(&posts, fetchQuery, map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit})
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	return posts, nil
}

func (s *SqlPostStore) getParentsPosts(channelId string, offset int, limit int, skipFetchThreads bool) ([]*model.Post, error) {
	if s.DriverName() == model.DatabaseDriverPostgres {
		return s.getParentsPostsPostgreSQL(channelId, offset, limit, skipFetchThreads)
	}

	// query parent Ids first
	var roots []*struct {
		RootId string
	}
	rootQuery := `
		SELECT DISTINCT
			q.RootId
		FROM
			(SELECT
				RootId
			FROM
				Posts
			WHERE
				ChannelId = :ChannelId
					AND DeleteAt = 0
			ORDER BY CreateAt DESC
			LIMIT :Limit OFFSET :Offset) q
		WHERE q.RootId != ''`

	_, err := s.GetReplica().Select(&roots, rootQuery, map[string]interface{}{"ChannelId": channelId, "Offset": offset, "Limit": limit})
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	if len(roots) == 0 {
		return nil, nil
	}
	params := make(map[string]interface{})
	placeholders := make([]string, len(roots))
	for idx, r := range roots {
		key := fmt.Sprintf(":Root%v", idx)
		params[key[1:]] = r.RootId
		placeholders[idx] = key
	}
	placeholderString := strings.Join(placeholders, ", ")
	params["ChannelId"] = channelId
	replyCountQuery := ""
	whereStatement := "p.Id IN (" + placeholderString + ")"
	if skipFetchThreads {
		replyCountQuery = `, (SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
	} else {
		whereStatement += " OR p.RootId IN (" + placeholderString + ")"
	}
	var posts []*model.Post
	_, err = s.GetReplica().Select(&posts, `
		SELECT p.*`+replyCountQuery+`
		FROM
			Posts p
		WHERE
			(`+whereStatement+`)
				AND ChannelId = :ChannelId
				AND DeleteAt = 0
		ORDER BY CreateAt`,
		params)
	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	return posts, nil
}

func (s *SqlPostStore) getParentsPostsPostgreSQL(channelId string, offset int, limit int, skipFetchThreads bool) ([]*model.Post, error) {
	var posts []*model.Post
	replyCountQuery := ""
	onStatement := "q1.RootId = q2.Id"
	if skipFetchThreads {
		replyCountQuery = ` ,(SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END) AND Posts.DeleteAt = 0) as ReplyCount`
	} else {
		onStatement += " OR q1.RootId = q2.RootId"
	}
	_, err := s.GetReplica().Select(&posts,
		`SELECT q2.*`+replyCountQuery+`
        FROM
            Posts q2
                INNER JOIN
            (SELECT DISTINCT
                q3.RootId
            FROM
                (SELECT
                    RootId
                FROM
                    Posts
                WHERE
                    ChannelId = :ChannelId1
                        AND DeleteAt = 0
                ORDER BY CreateAt DESC
                LIMIT :Limit OFFSET :Offset) q3
            WHERE q3.RootId != '') q1
            ON `+onStatement+`
        WHERE
            ChannelId = :ChannelId2
                AND DeleteAt = 0
        ORDER BY CreateAt`,
		map[string]interface{}{"ChannelId1": channelId, "Offset": offset, "Limit": limit, "ChannelId2": channelId})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", channelId)
	}
	return posts, nil
}

var specialSearchChar = []string{
	"<",
	">",
	"+",
	"-",
	"(",
	")",
	"~",
	"@",
	":",
}

func (s *SqlPostStore) buildCreateDateFilterClause(params *model.SearchParams, queryParams map[string]interface{}, builder sq.SelectBuilder) (sq.SelectBuilder, map[string]interface{}) {
	// handle after: before: on: filters
	if params.OnDate != "" {
		onDateStart, onDateEnd := params.GetOnDateMillis()
		queryParams["OnDateStart"] = strconv.FormatInt(onDateStart, 10)
		queryParams["OnDateEnd"] = strconv.FormatInt(onDateEnd, 10)

		// between `on date` start of day and end of day
		builder = builder.Where("CreateAt BETWEEN :OnDateStart AND :OnDateEnd")
		return builder, queryParams
	}

	if params.ExcludedDate != "" {
		excludedDateStart, excludedDateEnd := params.GetExcludedDateMillis()
		queryParams["ExcludedDateStart"] = strconv.FormatInt(excludedDateStart, 10)
		queryParams["ExcludedDateEnd"] = strconv.FormatInt(excludedDateEnd, 10)

		builder = builder.Where("CreateAt NOT BETWEEN :ExcludedDateStart AND :ExcludedDateEnd")
	}

	if params.AfterDate != "" {
		afterDate := params.GetAfterDateMillis()
		queryParams["AfterDate"] = strconv.FormatInt(afterDate, 10)

		// greater than `after date`
		builder = builder.Where("CreateAt >= :AfterDate")
	}

	if params.BeforeDate != "" {
		beforeDate := params.GetBeforeDateMillis()
		queryParams["BeforeDate"] = strconv.FormatInt(beforeDate, 10)

		// less than `before date`
		builder = builder.Where("CreateAt <= :BeforeDate")
	}

	if params.ExcludedAfterDate != "" {
		afterDate := params.GetExcludedAfterDateMillis()
		queryParams["ExcludedAfterDate"] = strconv.FormatInt(afterDate, 10)

		builder = builder.Where("CreateAt < :ExcludedAfterDate")
	}

	if params.ExcludedBeforeDate != "" {
		beforeDate := params.GetExcludedBeforeDateMillis()
		queryParams["ExcludedBeforeDate"] = strconv.FormatInt(beforeDate, 10)

		builder = builder.Where("CreateAt > :ExcludedBeforeDate")
	}

	return builder, queryParams
}

func (s *SqlPostStore) buildSearchTeamFilterClause(teamId string, queryParams map[string]interface{}, builder sq.SelectBuilder) (sq.SelectBuilder, map[string]interface{}) {
	if teamId == "" {
		return builder, queryParams
	}

	queryParams["TeamId"] = teamId

	return builder.Where("(TeamId = :TeamId OR TeamId = '')"), queryParams
}

func (s *SqlPostStore) buildSearchChannelFilterClause(channels []string, paramPrefix string, exclusion bool, queryParams map[string]interface{}, byName bool, builder sq.SelectBuilder) (sq.SelectBuilder, map[string]interface{}) {
	if len(channels) == 0 {
		return builder, queryParams
	}

	clauseSlice := []string{}
	for i, channel := range channels {
		paramName := paramPrefix + strconv.FormatInt(int64(i), 10)
		clauseSlice = append(clauseSlice, ":"+paramName)
		queryParams[paramName] = channel
	}
	clause := strings.Join(clauseSlice, ", ")
	if byName {
		if exclusion {
			return builder.Where("Name NOT IN (" + clause + ")"), queryParams
		}
		return builder.Where("Name IN (" + clause + ")"), queryParams
	}

	if exclusion {
		return builder.Where("Id NOT IN (" + clause + ")"), queryParams
	}
	return builder.Where("Id IN (" + clause + ")"), queryParams
}

func (s *SqlPostStore) buildSearchUserFilterClause(users []string, paramPrefix string, exclusion bool, queryParams map[string]interface{}, byUsername bool) (string, map[string]interface{}) {
	if len(users) == 0 {
		return "", queryParams
	}
	clauseSlice := []string{}
	for i, user := range users {
		paramName := paramPrefix + strconv.FormatInt(int64(i), 10)
		clauseSlice = append(clauseSlice, ":"+paramName)
		queryParams[paramName] = user
	}
	clause := strings.Join(clauseSlice, ", ")
	if byUsername {
		if exclusion {
			return "AND Username NOT IN (" + clause + ")", queryParams
		}
		return "AND Username IN (" + clause + ")", queryParams
	}
	if exclusion {
		return "AND Id NOT IN (" + clause + ")", queryParams
	}
	return "AND Id IN (" + clause + ")", queryParams
}

func (s *SqlPostStore) buildSearchPostFilterClause(fromUsers []string, excludedUsers []string, queryParams map[string]interface{}, userByUsername bool, builder sq.SelectBuilder) (sq.SelectBuilder, map[string]interface{}) {
	if len(fromUsers) == 0 && len(excludedUsers) == 0 {
		return builder, queryParams
	}

	filterQuery := `
		UserId IN (
			SELECT
				Id
			FROM
				Users,
				TeamMembers
			WHERE
				TeamMembers.TeamId = :TeamId
				AND Users.Id = TeamMembers.UserId
				FROM_USER_FILTER
				EXCLUDED_USER_FILTER)`

	fromUserClause, queryParams := s.buildSearchUserFilterClause(fromUsers, "FromUser", false, queryParams, userByUsername)
	filterQuery = strings.Replace(filterQuery, "FROM_USER_FILTER", fromUserClause, 1)

	excludedUserClause, queryParams := s.buildSearchUserFilterClause(excludedUsers, "ExcludedUser", true, queryParams, userByUsername)
	filterQuery = strings.Replace(filterQuery, "EXCLUDED_USER_FILTER", excludedUserClause, 1)

	return builder.Where(filterQuery), queryParams
}

func (s *SqlPostStore) Search(teamId string, userId string, params *model.SearchParams) (*model.PostList, error) {
	return s.search(teamId, userId, params, true, true)
}

func (s *SqlPostStore) search(teamId string, userId string, params *model.SearchParams, channelsByName bool, userByUsername bool) (*model.PostList, error) {
	queryParams := map[string]interface{}{
		"UserId": userId,
	}

	list := model.NewPostList()
	if params.Terms == "" && params.ExcludedTerms == "" &&
		len(params.InChannels) == 0 && len(params.ExcludedChannels) == 0 &&
		len(params.FromUsers) == 0 && len(params.ExcludedUsers) == 0 &&
		params.OnDate == "" && params.AfterDate == "" && params.BeforeDate == "" {
		return list, nil
	}

	baseQuery := s.getQueryBuilder().Select(
		"*",
		"(SELECT COUNT(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN q2.RootId = '' THEN q2.Id ELSE q2.RootId END) AND Posts.DeleteAt = 0) as ReplyCount",
	).From("Posts q2").
		Where("DeleteAt = 0").
		Where(fmt.Sprintf("Type NOT LIKE '%s%%'", model.PostSystemMessagePrefix)).
		OrderByClause("CreateAt DESC").
		Limit(100)

	baseQuery, queryParams = s.buildSearchPostFilterClause(params.FromUsers, params.ExcludedUsers, queryParams, userByUsername, baseQuery)
	baseQuery, queryParams = s.buildCreateDateFilterClause(params, queryParams, baseQuery)

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

	// these chars have special meaning and can be treated as spaces
	for _, c := range specialSearchChar {
		terms = strings.Replace(terms, c, " ", -1)
		excludedTerms = strings.Replace(excludedTerms, c, " ", -1)
	}

	if terms == "" && excludedTerms == "" {
		// we've already confirmed that we have a channel or user to search for
	} else if s.DriverName() == model.DatabaseDriverPostgres {
		// Parse text for wildcards
		if wildcard, err := regexp.Compile(`\*($| )`); err == nil {
			terms = wildcard.ReplaceAllLiteralString(terms, ":* ")
			excludedTerms = wildcard.ReplaceAllLiteralString(excludedTerms, ":* ")
		}

		excludeClause := ""
		if excludedTerms != "" {
			excludeClause = " & !(" + strings.Join(strings.Fields(excludedTerms), " | ") + ")"
		}

		if params.OrTerms {
			queryParams["Terms"] = "(" + strings.Join(strings.Fields(terms), " | ") + ")" + excludeClause
		} else if strings.HasPrefix(terms, `"`) && strings.HasSuffix(terms, `"`) {
			queryParams["Terms"] = "(" + strings.Join(strings.Fields(terms), " <-> ") + ")" + excludeClause
		} else {
			queryParams["Terms"] = "(" + strings.Join(strings.Fields(terms), " & ") + ")" + excludeClause
		}

		searchClause := fmt.Sprintf("to_tsvector('english', %s) @@  to_tsquery('english', :Terms)", searchType)
		baseQuery = baseQuery.Where(searchClause)
	} else if s.DriverName() == model.DatabaseDriverMysql {
		if searchType == "Message" {
			var err error
			terms, err = removeMysqlStopWordsFromTerms(terms)
			if err != nil {
				return nil, errors.Wrap(err, "failed to remove Mysql stop-words from terms")
			}

			if terms == "" {
				return list, nil
			}
		}

		searchClause := fmt.Sprintf("MATCH (%s) AGAINST (:Terms IN BOOLEAN MODE)", searchType)
		baseQuery = baseQuery.Where(searchClause)

		excludeClause := ""
		if excludedTerms != "" {
			excludeClause = " -(" + excludedTerms + ")"
		}

		if params.OrTerms {
			queryParams["Terms"] = terms + excludeClause
		} else {
			splitTerms := []string{}
			for _, t := range strings.Fields(terms) {
				splitTerms = append(splitTerms, "+"+t)
			}
			queryParams["Terms"] = strings.Join(splitTerms, " ") + excludeClause
		}
	}

	inQuery := s.getQueryBuilder().Select("Id").
		From("Channels, ChannelMembers").
		Where("Id = ChannelId")

	if !params.IncludeDeletedChannels {
		inQuery = inQuery.Where("DeleteAt = 0")
	}

	if !params.SearchWithoutUserId {
		inQuery = inQuery.Where("UserId = :UserId")
	}

	inQuery, queryParams = s.buildSearchTeamFilterClause(teamId, queryParams, inQuery)
	inQuery, queryParams = s.buildSearchChannelFilterClause(params.InChannels, "InChannel", false, queryParams, channelsByName, inQuery)
	inQuery, queryParams = s.buildSearchChannelFilterClause(params.ExcludedChannels, "ExcludedChannel", true, queryParams, channelsByName, inQuery)

	inQueryClause, _, err := inQuery.ToSql()
	if err != nil {
		return nil, err
	}

	baseQuery = baseQuery.Where(fmt.Sprintf("ChannelId IN (%s)", inQueryClause))

	searchQuery, _, err := baseQuery.ToSql()
	if err != nil {
		return nil, err
	}

	var posts []*model.Post

	_, err = s.GetSearchReplica().Select(&posts, searchQuery, queryParams)
	if err != nil {
		mlog.Warn("Query error searching posts.", mlog.Err(err))
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

func (s *SqlPostStore) AnalyticsUserCountsWithPostsByDay(teamId string) (model.AnalyticsRows, error) {
	query :=
		`SELECT DISTINCT
		        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
		        COUNT(DISTINCT Posts.UserId) AS Value
		FROM Posts`

	if teamId != "" {
		query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
	} else {
		query += " WHERE"
	}

	query += ` Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
		GROUP BY DATE(FROM_UNIXTIME(Posts.CreateAt / 1000))
		ORDER BY Name DESC
		LIMIT 30`

	if s.DriverName() == model.DatabaseDriverPostgres {
		query =
			`SELECT
				TO_CHAR(DATE(TO_TIMESTAMP(Posts.CreateAt / 1000)), 'YYYY-MM-DD') AS Name, COUNT(DISTINCT Posts.UserId) AS Value
			FROM Posts`

		if teamId != "" {
			query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
		} else {
			query += " WHERE"
		}

		query += ` Posts.CreateAt >= :StartTime AND Posts.CreateAt <= :EndTime
			GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
			ORDER BY Name DESC
			LIMIT 30`
	}

	end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
	start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))

	var rows model.AnalyticsRows
	_, err := s.GetReplica().Select(
		&rows,
		query,
		map[string]interface{}{"TeamId": teamId, "StartTime": start, "EndTime": end})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with teamId=%s", teamId)
	}
	return rows, nil
}

func (s *SqlPostStore) AnalyticsPostCountsByDay(options *model.AnalyticsPostCountsOptions) (model.AnalyticsRows, error) {

	query :=
		`SELECT
		        DATE(FROM_UNIXTIME(Posts.CreateAt / 1000)) AS Name,
		        COUNT(Posts.Id) AS Value
		    FROM Posts`

	if options.BotsOnly {
		query += " INNER JOIN Bots ON Posts.UserId = Bots.Userid"
	}

	if options.TeamId != "" {
		query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id AND Channels.TeamId = :TeamId AND"
	} else {
		query += " WHERE"
	}

	query += ` Posts.CreateAt <= :EndTime
		            AND Posts.CreateAt >= :StartTime
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
			query += " INNER JOIN Channels ON Posts.ChannelId = Channels.Id  AND Channels.TeamId = :TeamId AND"
		} else {
			query += " WHERE"
		}

		query += ` Posts.CreateAt <= :EndTime
			            AND Posts.CreateAt >= :StartTime
			GROUP BY DATE(TO_TIMESTAMP(Posts.CreateAt / 1000))
			ORDER BY Name DESC
			LIMIT 30`
	}

	end := utils.MillisFromTime(utils.EndOfDay(utils.Yesterday()))
	start := utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -31)))
	if options.YesterdayOnly {
		start = utils.MillisFromTime(utils.StartOfDay(utils.Yesterday().AddDate(0, 0, -1)))
	}

	var rows model.AnalyticsRows
	_, err := s.GetReplica().Select(
		&rows,
		query,
		map[string]interface{}{"TeamId": options.TeamId, "StartTime": start, "EndTime": end})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with teamId=%s", options.TeamId)
	}
	return rows, nil
}

func (s *SqlPostStore) AnalyticsPostCount(teamId string, mustHaveFile bool, mustHaveHashtag bool) (int64, error) {
	query := s.getQueryBuilder().
		Select("COUNT(p.Id) AS Value").
		From("Posts p")

	if teamId != "" {
		query = query.
			Join("Channels c ON (c.Id = p.ChannelId)").
			Where(sq.Eq{"c.TeamId": teamId})
	}

	if mustHaveFile {
		query = query.Where(sq.Or{sq.NotEq{"p.FileIds": "[]"}, sq.NotEq{"p.Filenames": "[]"}})
	}

	if mustHaveHashtag {
		query = query.Where(sq.NotEq{"p.Hashtags": ""})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return 0, errors.Wrap(err, "post_tosql")
	}

	v, err := s.GetReplica().SelectInt(queryString, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to count Posts")
	}

	return v, nil
}

func (s *SqlPostStore) GetPostsCreatedAt(channelId string, time int64) ([]*model.Post, error) {
	query := `SELECT * FROM Posts WHERE CreateAt = :CreateAt AND ChannelId = :ChannelId`

	var posts []*model.Post
	_, err := s.GetReplica().Select(&posts, query, map[string]interface{}{"CreateAt": time, "ChannelId": channelId})

	if err != nil {
		return nil, errors.Wrapf(err, "failed to find Posts with channelId=%s", channelId)
	}
	return posts, nil
}

func (s *SqlPostStore) GetPostsByIds(postIds []string) ([]*model.Post, error) {
	keys, params := MapStringsToQueryParams(postIds, "Post")

	query := `SELECT p.*, (SELECT count(Posts.Id) FROM Posts WHERE Posts.RootId = (CASE WHEN p.RootId = '' THEN p.Id ELSE p.RootId END) AND Posts.DeleteAt = 0) as ReplyCount FROM Posts p WHERE p.Id IN ` + keys + ` ORDER BY CreateAt DESC`

	var posts []*model.Post
	_, err := s.GetReplica().Select(&posts, query, params)

	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	return posts, nil
}

func (s *SqlPostStore) GetPostsBatchForIndexing(startTime int64, endTime int64, limit int) ([]*model.PostForIndexing, error) {
	var posts []*model.PostForIndexing
	_, err := s.GetSearchReplica().Select(&posts,
		`SELECT
			PostsQuery.*, Channels.TeamId, ParentPosts.CreateAt ParentCreateAt
		FROM (
			SELECT
				*
			FROM
				Posts
			WHERE
				Posts.CreateAt >= :StartTime
			AND
				Posts.CreateAt < :EndTime
			ORDER BY
				CreateAt ASC
			LIMIT
				1000
			)
		AS
			PostsQuery
		LEFT JOIN
			Channels
		ON
			PostsQuery.ChannelId = Channels.Id
		LEFT JOIN
			Posts ParentPosts
		ON
			PostsQuery.RootId = ParentPosts.Id`,
		map[string]interface{}{"StartTime": startTime, "EndTime": endTime, "NumPosts": limit})

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
	}, s.SqlStore, cursor)
}

// DeleteOrphanedRows removes entries from Posts when a corresponding channel no longer exists.
func (s *SqlPostStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	// We need the extra level of nesting to deal with MySQL's locking
	const query = `
	DELETE FROM Posts WHERE Id IN (
		SELECT * FROM (
			SELECT Posts.Id FROM Posts
			LEFT JOIN Channels ON Posts.ChannelId = Channels.Id
			WHERE Channels.Id IS NULL
			LIMIT :Limit
		) AS A
	)`
	props := map[string]interface{}{"Limit": limit}
	result, err := s.GetMaster().Exec(query, props)
	if err != nil {
		return
	}
	deleted, err = result.RowsAffected()
	return
}

func (s *SqlPostStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	var query string
	if s.DriverName() == "postgres" {
		query = "DELETE from Posts WHERE Id = any (array (SELECT Id FROM Posts WHERE CreateAt < :EndTime LIMIT :Limit))"
	} else {
		query = "DELETE from Posts WHERE CreateAt < :EndTime LIMIT :Limit"
	}

	sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"EndTime": endTime, "Limit": limit})
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
	err := s.GetReplica().SelectOne(&post, "SELECT * FROM Posts ORDER BY CreateAt LIMIT 1")
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
		if err := s.GetReplica().SelectOne(&maxPostSizeBytes, `
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
		if err := s.GetReplica().SelectOne(&maxPostSizeBytes, `
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

	mlog.Info("Post.Message has size restrictions", mlog.Int("max_characters", maxPostSize), mlog.Int32("max_bytes", maxPostSizeBytes))

	return maxPostSize
}

// GetMaxPostSize returns the maximum number of runes that may be stored in a post.
func (s *SqlPostStore) GetMaxPostSize() int {
	s.maxPostSizeOnce.Do(func() {
		s.maxPostSizeCached = s.determineMaxPostSize()
	})
	return s.maxPostSizeCached
}

func (s *SqlPostStore) GetParentsForExportAfter(limit int, afterId string) ([]*model.PostForExport, error) {
	for {
		var rootIds []string
		_, err := s.GetReplica().Select(&rootIds,
			`SELECT
				Id
			FROM
				Posts
			WHERE
				Id > :AfterId
				AND RootId = ''
				AND DeleteAt = 0
			ORDER BY Id
			LIMIT :Limit`,
			map[string]interface{}{"Limit": limit, "AfterId": afterId})
		if err != nil {
			return nil, errors.Wrap(err, "failed to find Posts")
		}

		var postsForExport []*model.PostForExport
		if len(rootIds) == 0 {
			return postsForExport, nil
		}

		keys, params := MapStringsToQueryParams(rootIds, "PostId")
		_, err = s.GetSearchReplica().Select(&postsForExport, `
			SELECT
				p1.*,
				Users.Username as Username,
				Teams.Name as TeamName,
				Channels.Name as ChannelName
			FROM
				(Select * FROM Posts WHERE Id IN `+keys+`) p1
			INNER JOIN
				Channels ON p1.ChannelId = Channels.Id
			INNER JOIN
				Teams ON Channels.TeamId = Teams.Id
			INNER JOIN
				Users ON p1.UserId = Users.Id
			WHERE
				Channels.DeleteAt = 0
				AND Teams.DeleteAt = 0
			ORDER BY
				p1.Id`,
			params)
		if err != nil {
			return nil, errors.Wrap(err, "failed to find Posts")
		}

		if len(postsForExport) == 0 {
			// All of the posts were in channels or teams that were deleted.
			// Update the afterId and try again.
			afterId = rootIds[len(rootIds)-1]
			continue
		}

		return postsForExport, nil
	}
}

func (s *SqlPostStore) GetRepliesForExport(rootId string) ([]*model.ReplyForExport, error) {
	var posts []*model.ReplyForExport
	_, err := s.GetSearchReplica().Select(&posts, `
			SELECT
				Posts.*,
				Users.Username as Username
			FROM
				Posts
			INNER JOIN
				Users ON Posts.UserId = Users.Id
			WHERE
				Posts.RootId = :RootId
				AND Posts.DeleteAt = 0
			ORDER BY
				Posts.Id`,
		map[string]interface{}{"RootId": rootId})

	if err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}

	return posts, nil
}

func (s *SqlPostStore) GetDirectPostParentsForExportAfter(limit int, afterId string) ([]*model.DirectPostForExport, error) {
	query := s.getQueryBuilder().
		Select("p.*", "Users.Username as User").
		From("Posts p").
		Join("Channels ON p.ChannelId = Channels.Id").
		Join("Users ON p.UserId = Users.Id").
		Where(sq.And{
			sq.Gt{"p.Id": afterId},
			sq.Eq{"p.RootId": string("")},
			sq.Eq{"p.DeleteAt": int(0)},
			sq.Eq{"Channels.DeleteAt": int(0)},
			sq.Eq{"Users.DeleteAt": int(0)},
			sq.Eq{"Channels.Type": []string{"D", "G"}},
		}).
		OrderBy("p.Id").
		Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "post_tosql")
	}

	var posts []*model.DirectPostForExport
	if _, err = s.GetReplica().Select(&posts, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Posts")
	}
	var channelIds []string
	for _, post := range posts {
		channelIds = append(channelIds, post.ChannelId)
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

	var channelMembers []*model.ChannelMemberForExport
	if _, err := s.GetReplica().Select(&channelMembers, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find ChannelMembers")
	}

	// Build a map of channels and their posts
	postsChannelMap := make(map[string][]*model.DirectPostForExport)
	for _, post := range posts {
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
	return posts, nil
}

//nolint:unparam
func (s *SqlPostStore) SearchPostsForUser(paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, error) {
	// Since we don't support paging for DB search, we just return nothing for later pages
	if page > 0 {
		return model.MakePostSearchResults(model.NewPostList(), nil), nil
	}

	if err := model.IsSearchParamsListValid(paramsList); err != nil {
		return nil, err
	}

	var wg sync.WaitGroup

	pchan := make(chan store.StoreResult, len(paramsList))

	for _, params := range paramsList {
		// remove any unquoted term that contains only non-alphanumeric chars
		// ex: abcd "**" && abc     >>     abcd "**" abc
		params.Terms = removeNonAlphaNumericUnquotedTerms(params.Terms, " ")

		wg.Add(1)

		go func(params *model.SearchParams) {
			defer wg.Done()
			postList, err := s.search(teamId, userId, params, false, false)
			pchan <- store.StoreResult{Data: postList, NErr: err}
		}(params)
	}

	wg.Wait()
	close(pchan)

	posts := model.NewPostList()

	for result := range pchan {
		if result.NErr != nil {
			return nil, result.NErr
		}
		data := result.Data.(*model.PostList)
		posts.Extend(data)
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
	queryString, _, err := query.ToSql()
	if err != nil {
		return -1, errors.Wrap(err, "post_tosql")
	}
	row := s.GetReplica().Db.QueryRow(queryString)
	var oldest int64
	if err := row.Scan(&oldest); err != nil {
		return -1, errors.Wrap(err, "unable to scan oldest entity creation time")
	}
	return oldest, nil
}

func (s *SqlPostStore) cleanupThreads(postId, rootId string, permanent bool, userId string) error {
	if permanent {
		if _, err := s.GetMaster().Exec("DELETE FROM Threads WHERE PostId = :Id", map[string]interface{}{"Id": postId}); err != nil {
			return errors.Wrap(err, "failed to delete Threads")
		}
		if _, err := s.GetMaster().Exec("DELETE FROM ThreadMemberships WHERE PostId = :Id", map[string]interface{}{"Id": postId}); err != nil {
			return errors.Wrap(err, "failed to delete ThreadMemberships")
		}
		return nil
	}
	if rootId != "" {
		queryString, args, err := s.getQueryBuilder().
			Select("COUNT(Id)").
			From("Posts").
			Where(sq.And{
				sq.Eq{"RootId": rootId},
				sq.Eq{"UserId": userId},
				sq.Eq{"DeleteAt": 0},
			}).
			ToSql()

		if err != nil {
			return errors.Wrap(err, "failed to create SQL query to count user's posts")
		}

		count, err := s.GetReplica().SelectInt(queryString, args...)

		if err != nil {
			return errors.Wrap(err, "failed to count user's posts in thread")
		}

		updateQuery := s.getQueryBuilder().Update("Threads")

		if count == 0 {
			if s.DriverName() == model.DatabaseDriverPostgres {
				updateQuery = updateQuery.Set("Participants", sq.Expr("Participants - ?", userId))
			} else {
				// The .Where is because JSON_REMOVE returns null if the element to remove wasn't present
				updateQuery = updateQuery.
					Set("Participants", sq.Expr(
						`JSON_REMOVE(Participants, JSON_UNQUOTE(JSON_SEARCH(Participants, 'one', ?)))`, userId,
					)).
					Where(sq.Expr(`JSON_CONTAINS(Participants, ?)`, strconv.Quote(userId)))
			}
		}

		updateQueryString, updateArgs, err := updateQuery.
			Set("ReplyCount", sq.Expr("ReplyCount - 1")).
			Where(sq.And{
				sq.Eq{"PostId": rootId},
				sq.Gt{"ReplyCount": 0},
			}).
			ToSql()

		if err != nil {
			return errors.Wrap(err, "failed to create SQL query to update thread")
		}

		_, err = s.GetMaster().Exec(updateQueryString, updateArgs...)

		if err != nil {
			return errors.Wrap(err, "failed to update Threads")
		}
	}
	return nil
}

func (s *SqlPostStore) updateThreadsFromPosts(transaction *gorp.Transaction, posts []*model.Post) error {
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
	threadsByRootsSql, threadsByRootsArgs, _ := s.getQueryBuilder().Select("*").From("Threads").Where(sq.Eq{"PostId": rootIds}).ToSql()
	var threadsByRoots []*model.Thread
	if _, err := transaction.Select(&threadsByRoots, threadsByRootsSql, threadsByRootsArgs...); err != nil {
		return err
	}

	threadByRoot := map[string]*model.Thread{}
	for _, thread := range threadsByRoots {
		threadByRoot[thread.PostId] = thread
	}

	for rootId, posts := range postsByRoot {
		if thread, found := threadByRoot[rootId]; !found {
			var data []struct {
				UserId    string `db:"userid"`
				RepliedAt int64  `db:"mc"`
			}

			// calculate participants
			if _, err := transaction.Select(&data, "SELECT UserId, MAX(CreateAt) as mc FROM Posts WHERE RootId=:RootId AND DeleteAt=0 GROUP BY UserId ORDER BY mc ASC", map[string]interface{}{"RootId": rootId}); err != nil {
				return err
			}

			var participants model.StringArray
			for _, item := range data {
				participants = append(participants, item.UserId)
			}

			// calculate reply count
			count, err := transaction.SelectInt("SELECT COUNT(Id) FROM Posts WHERE RootId=:RootId And DeleteAt=0", map[string]interface{}{"RootId": rootId})
			if err != nil {
				return err
			}
			// calculate last reply at
			lastReplyAt, err := transaction.SelectInt("SELECT COALESCE(MAX(Posts.CreateAt), 0) FROM Posts WHERE RootID=:RootId and DeleteAt=0", map[string]interface{}{"RootId": rootId})
			if err != nil {
				return err
			}
			// no metadata entry, create one
			if err := transaction.Insert(&model.Thread{
				PostId:       rootId,
				ChannelId:    posts[0].ChannelId,
				ReplyCount:   count,
				LastReplyAt:  lastReplyAt,
				Participants: participants,
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
			if _, err := transaction.Update(thread); err != nil {
				return err
			}
		}
	}
	return nil
}

// GetUniquePostTypesSince returns the unique post types in a channel after the given timestamp
func (s *SqlPostStore) GetUniquePostTypesSince(channelId string, timestamp int64) ([]string, error) {
	query, args, err := s.getQueryBuilder().
		Select("DISTINCT Type").
		From("Posts").
		Where(sq.And{
			sq.Eq{"ChannelId": channelId},
			sq.GtOrEq{"CreateAt": timestamp},
			sq.Eq{"DeleteAt": 0},
		}).ToSql()
	if err != nil {
		return nil, err
	}
	var types []string
	if _, err := s.GetReplica().Select(&types, query, args...); err != nil {
		return nil, err
	}
	return types, nil
}
