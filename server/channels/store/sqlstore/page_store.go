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

	return postsToPostList(posts), nil
}

func (s *SqlPageStore) GetPageDescendants(postID string) (*model.PostList, error) {
	query := buildPageHierarchyCTE(PageHierarchyDescendants, true, true)

	posts := []*model.Post{}
	if err := s.GetReplica().Select(&posts, query, postID); err != nil {
		return nil, errors.Wrapf(err, "failed to find descendants for post_id=%s", postID)
	}

	return postsToPostList(posts), nil
}

func (s *SqlPageStore) GetPageAncestors(postID string) (*model.PostList, error) {
	query := buildPageHierarchyCTE(PageHierarchyAncestors, true, true)

	posts := []*model.Post{}
	if err := s.GetReplica().Select(&posts, query, postID); err != nil {
		return nil, errors.Wrapf(err, "failed to find ancestors for post_id=%s", postID)
	}

	return postsToPostList(posts), nil
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

	return postsToPostList(posts), nil
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

	return s.checkRowsAffected(result, "Post", postID)
}

func (s *SqlPageStore) UpdatePageWithContent(rctx request.CTX, pageID, title, content, searchText string) (post *model.Post, err error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	var currentPost model.Post
	err = s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		query := s.getQueryBuilder().
			Select(
				"Id", "CreateAt", "UpdateAt", "EditAt", "DeleteAt",
				"IsPinned", "UserId", "ChannelId", "RootId", "OriginalId",
				"PageParentId", "Message", "Type", "Props",
				"Hashtags", "Filenames", "FileIds",
				"HasReactions", "RemoteId",
			).
			From("Posts").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
			})

		queryString, args, buildErr := query.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build get page query")
		}

		if txErr := transaction.Get(&currentPost, queryString, args...); txErr != nil {
			if txErr == sql.ErrNoRows {
				return store.NewErrNotFound("Post", pageID)
			}
			return errors.Wrap(txErr, "failed to get page")
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
				return errors.Wrap(setErr, "invalid_content")
			}

			if searchText != "" {
				pageContent.SearchText = searchText
			}

			contentJSON, jsonErr := pageContent.GetDocumentJSON()
			if jsonErr != nil {
				return errors.Wrap(jsonErr, "failed to serialize content")
			}

			now := model.GetMillis()

			result, execErr := transaction.Exec(
				"UPDATE PageContents SET Content = ?, SearchText = ?, UpdateAt = ? WHERE PageId = ?",
				contentJSON, pageContent.SearchText, now, pageID)

			if execErr != nil {
				return errors.Wrap(execErr, "failed to update content")
			}

			rowsAffected, _ := result.RowsAffected()
			if rowsAffected == 0 {
				_, execErr = transaction.Exec(
					"INSERT INTO PageContents (PageId, Content, SearchText, CreateAt, UpdateAt) VALUES (?, ?, ?, ?, ?)",
					pageID, contentJSON, pageContent.SearchText, now, now)
				if execErr != nil {
					return errors.Wrap(execErr, "failed to insert content")
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
				return errors.Wrap(execErr, "failed to update post with EditAt")
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
				return errors.Wrap(buildErr, "failed to build history insert query")
			}

			if _, execErr := transaction.Exec(query, args...); execErr != nil {
				return errors.Wrap(execErr, "failed to insert history entry")
			}
		}

		return nil
	})

	return &currentPost, err
}
