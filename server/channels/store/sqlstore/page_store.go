// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPageStore struct {
	*SqlStore
}

func newSqlPageStore(sqlStore *SqlStore) store.PageStore {
	return &SqlPageStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPageStore) GetPageChildren(postID string, options model.GetPostsOptions) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select("p.*").
		From("Posts p").
		Where(sq.Eq{
			"p.PageParentId": postID,
			"p.Type":         model.PostTypePage,
			"p.DeleteAt":     0,
		}).
		OrderBy("p.CreateAt DESC")

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find children for post_id=%s", postID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) GetPageDescendants(postID string) (*model.PostList, error) {
	query := `
		WITH RECURSIVE descendants AS (
			SELECT Id, PageParentId
			FROM Posts WHERE Id = $1
			UNION ALL
			SELECT p.Id, p.PageParentId
			FROM Posts p
			INNER JOIN descendants d ON p.PageParentId = d.Id
			WHERE p.Type = 'page' AND p.DeleteAt = 0
		)
		SELECT p.Id, p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.IsPinned, p.UserId, p.ChannelId, p.RootId, p.OriginalId,
		       p.Message, p.Type, p.Props, p.Hashtags, p.Filenames, p.FileIds, p.HasReactions, p.RemoteId, p.PageParentId
		FROM descendants d
		INNER JOIN Posts p ON p.Id = d.Id
		WHERE d.Id != $1
		ORDER BY p.CreateAt
	`

	posts := []*model.Post{}
	if err := s.GetReplica().Select(&posts, query, postID); err != nil {
		return nil, errors.Wrapf(err, "failed to find descendants for post_id=%s", postID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) GetPageAncestors(postID string) (*model.PostList, error) {
	query := `
		WITH RECURSIVE ancestors AS (
			SELECT Id, PageParentId
			FROM Posts WHERE Id = $1
			UNION ALL
			SELECT p.Id, p.PageParentId
			FROM Posts p
			INNER JOIN ancestors a ON p.Id = a.PageParentId
			WHERE a.PageParentId IS NOT NULL AND a.PageParentId != '' AND p.Type = 'page' AND p.DeleteAt = 0
		)
		SELECT p.Id, p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.IsPinned, p.UserId, p.ChannelId, p.RootId, p.OriginalId,
		       p.Message, p.Type, p.Props, p.Hashtags, p.Filenames, p.FileIds, p.HasReactions, p.RemoteId, p.PageParentId
		FROM ancestors a
		INNER JOIN Posts p ON p.Id = a.Id
		WHERE a.Id != $1
		ORDER BY p.CreateAt
	`

	posts := []*model.Post{}
	if err := s.GetReplica().Select(&posts, query, postID); err != nil {
		return nil, errors.Wrapf(err, "failed to find ancestors for post_id=%s", postID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) GetChannelPages(channelID string) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select("p.*").
		From("Posts p").
		Where(sq.Eq{
			"p.ChannelId": channelID,
			"p.Type":      model.PostTypePage,
			"p.DeleteAt":  0,
		}).
		OrderBy("p.CreateAt ASC")

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find pages for channel_id=%s", channelID)
	}

	postList := model.NewPostList()
	for _, post := range posts {
		postList.AddPost(post)
		postList.AddOrder(post.Id)
	}

	return postList, nil
}

func (s *SqlPageStore) ChangePageParent(postID string, newParentID string) error {
	updateQuery := s.getQueryBuilder().
		Update("Posts").
		Set("PageParentId", newParentID).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": postID})

	result, err := s.GetMaster().ExecBuilder(updateQuery)
	if err != nil {
		return errors.Wrapf(err, "failed to update parent for post_id=%s", postID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("Post", postID)
	}

	return nil
}

func (s *SqlPageStore) UpdatePageWithContent(rctx request.CTX, pageID, title, content, searchText string) (post *model.Post, err error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	query := s.getQueryBuilder().
		Select(
			"Id", "CreateAt", "UpdateAt", "EditAt", "DeleteAt",
			"IsPinned", "UserId", "ChannelId", "RootId", "OriginalId",
			"PageParentId", "Message", "MessageSource", "Type", "Props",
			"Hashtags", "Filenames", "FileIds", "PendingPostId",
			"HasReactions", "RemoteId",
		).
		From("Posts").
		Where(sq.And{
			sq.Eq{"Id": pageID},
			sq.Eq{"Type": model.PostTypePage},
		})

	queryString, args, buildErr := query.ToSql()
	if buildErr != nil {
		return nil, errors.Wrap(buildErr, "failed to build get page query")
	}

	var currentPost model.Post
	if err = transaction.Get(&currentPost, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", pageID)
		}
		return nil, errors.Wrap(err, "failed to get page")
	}

	// Clone the old post for history before making changes
	oldPost := currentPost.Clone()
	needsHistory := false

	if title != "" {
		if currentPost.Props == nil {
			currentPost.Props = make(model.StringInterface)
		}
		currentPost.Props["title"] = title
		needsHistory = true
	}

	if content != "" {
		pageContent := &model.PageContent{PageId: pageID}
		if setErr := pageContent.SetDocumentJSON(content); setErr != nil {
			return nil, errors.Wrap(setErr, "invalid_content")
		}

		if searchText != "" {
			pageContent.SearchText = searchText
		}

		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			return nil, errors.Wrap(jsonErr, "failed to serialize content")
		}

		now := model.GetMillis()

		result, execErr := transaction.Exec(
			"UPDATE PageContents SET Content = ?, SearchText = ?, UpdateAt = ? WHERE PageId = ?",
			contentJSON, pageContent.SearchText, now, pageID)

		if execErr != nil {
			return nil, errors.Wrap(execErr, "failed to update content")
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			_, execErr = transaction.Exec(
				"INSERT INTO PageContents (PageId, Content, SearchText, CreateAt, UpdateAt) VALUES (?, ?, ?, ?, ?)",
				pageID, contentJSON, pageContent.SearchText, now, now)
			if execErr != nil {
				return nil, errors.Wrap(execErr, "failed to insert content")
			}
		}
		needsHistory = true
	}

	if needsHistory {
		now := model.GetMillis()
		currentPost.EditAt = now
		currentPost.UpdateAt = now

		if _, execErr := transaction.NamedExec(`UPDATE Posts
			SET EditAt=:EditAt,
				UpdateAt=:UpdateAt,
				Props=:Props
			WHERE Id=:Id`, &currentPost); execErr != nil {
			return nil, errors.Wrap(execErr, "failed to update post with EditAt")
		}

		oldPost.DeleteAt = currentPost.UpdateAt
		oldPost.UpdateAt = currentPost.UpdateAt
		oldPost.OriginalId = oldPost.Id
		oldPost.Id = model.NewId()

		insertQuery := s.getQueryBuilder().
			Insert("Posts").
			Columns(postSliceColumns()...).
			Values(postToSlice(oldPost)...)

		query, args, buildErr := insertQuery.ToSql()
		if buildErr != nil {
			return nil, errors.Wrap(buildErr, "failed to build history insert query")
		}

		if _, execErr := transaction.Exec(query, args...); execErr != nil {
			return nil, errors.Wrap(execErr, "failed to insert history entry")
		}
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return &currentPost, nil
}
