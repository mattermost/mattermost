// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
		var oldContent *model.PageContent // Store old content for history

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

			// First, fetch current PageContents to save as history
			var currentContent model.PageContent
			selectQuery := s.getQueryBuilder().
				Select("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
				From("PageContents").
				Where(sq.Eq{"PageId": pageID})

			selectSQL, selectArgs, buildErr := selectQuery.ToSql()
			if buildErr != nil {
				return errors.Wrap(buildErr, "failed to build get current content query")
			}

			getErr := transaction.Get(&currentContent, selectSQL, selectArgs...)

			if getErr != nil && getErr != sql.ErrNoRows {
				return errors.Wrap(getErr, "failed to get current content")
			}

			// If PageContents exists, save it for history (will insert after creating oldPost)
			if getErr != sql.ErrNoRows {
				oldContent = &currentContent
				needsHistory = true
			}

			// Now update current PageContents
			updateQuery := s.getQueryBuilder().
				Update("PageContents").
				Set("Content", contentJSON).
				Set("SearchText", pageContent.SearchText).
				Set("UpdateAt", now).
				Where(sq.Eq{"PageId": pageID})

			updateSQL, updateArgs, buildErr := updateQuery.ToSql()
			if buildErr != nil {
				return errors.Wrap(buildErr, "failed to build update content query")
			}

			result, execErr := transaction.Exec(updateSQL, updateArgs...)

			if execErr != nil {
				return errors.Wrap(execErr, "failed to update content")
			}

			rowsAffected, _ := result.RowsAffected()
			if rowsAffected == 0 {
				// First-time content creation, no history needed
				insertQuery := s.getQueryBuilder().
					Insert("PageContents").
					Columns("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
					Values(pageID, contentJSON, pageContent.SearchText, now, now, 0)

				insertSQL, insertArgs, buildErr := insertQuery.ToSql()
				if buildErr != nil {
					return errors.Wrap(buildErr, "failed to build insert content query")
				}

				_, execErr = transaction.Exec(insertSQL, insertArgs...)
				if execErr != nil {
					return errors.Wrap(execErr, "failed to insert content")
				}
			}
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

			// If we have old content, insert it as historical PageContents
			// linked to the historical Post via PageId
			if oldContent != nil {
				oldContentJSON, jsonErr := oldContent.GetDocumentJSON()
				if jsonErr != nil {
					return errors.Wrap(jsonErr, "failed to serialize old content")
				}

				historyInsertQuery := s.getQueryBuilder().
					Insert("PageContents").
					Columns("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
					Values(
						oldPost.Id, // Link to historical Post ID
						oldContentJSON,
						oldContent.SearchText,
						oldContent.CreateAt,
						now, // UpdateAt = when history was created
						now) // DeleteAt = marks as historical

				historyInsertSQL, historyInsertArgs, buildErr := historyInsertQuery.ToSql()
				if buildErr != nil {
					return errors.Wrap(buildErr, "failed to build insert content history query")
				}

				_, execErr := transaction.Exec(historyInsertSQL, historyInsertArgs...)

				if execErr != nil {
					return errors.Wrap(execErr, "failed to insert content history")
				}

				// Prune old versions: Keep only last N versions per page (as defined by PostEditHistoryLimit)
				// Find PageContents where:
				// - The PageId corresponds to a Post with OriginalId = current page ID
				// - DeleteAt > 0 (historical versions only)
				// - Keep only the most recent versions by UpdateAt
				// Note: Using complex subquery with window function, which requires Expr
				pruneQuery := s.getQueryBuilder().
					Delete("PageContents").
					Where(sq.Expr(fmt.Sprintf(`PageId IN (
						SELECT pc.PageId
						FROM PageContents pc
						INNER JOIN (
							SELECT p.Id, p.UpdateAt,
								   ROW_NUMBER() OVER (PARTITION BY p.OriginalId ORDER BY p.UpdateAt DESC) as rn
							FROM Posts p
							WHERE p.OriginalId = ? AND p.DeleteAt > 0
						) ranked ON pc.PageId = ranked.Id
						WHERE ranked.rn > %d
					)`, model.PostEditHistoryLimit), pageID))

				pruneSQL, pruneArgs, buildErr := pruneQuery.ToSql()
				if buildErr != nil {
					// Log error but don't fail the update
					rctx.Logger().Warn("Failed to build prune old page content versions query",
						mlog.String("page_id", pageID),
						mlog.Err(buildErr))
				} else {
					_, execErr = transaction.Exec(pruneSQL, pruneArgs...)

					if execErr != nil {
						// Log error but don't fail the update
						rctx.Logger().Warn("Failed to prune old page content versions",
							mlog.String("page_id", pageID),
							mlog.Err(execErr))
					}
				}
			}
		}

		return nil
	})

	return &currentPost, err
}

func (s *SqlPageStore) GetPageVersionHistory(pageId string) ([]*model.Post, error) {
	builder := s.getQueryBuilder().
		Select("Id", "CreateAt", "UpdateAt", "EditAt", "DeleteAt", "IsPinned", "UserId",
			"ChannelId", "RootId", "OriginalId", "PageParentId", "Message", "Type", "Props",
			"Hashtags", "Filenames", "FileIds", "HasReactions", "RemoteId").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Posts.OriginalId": pageId},
			sq.Gt{"Posts.DeleteAt": 0},
		}).
		OrderBy("Posts.EditAt DESC").
		Limit(uint64(model.PostEditHistoryLimit))

	queryString, args, err := builder.ToSql()
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Page", pageId)
		}
		return nil, errors.Wrap(err, "failed to find page version history")
	}

	posts := []*model.Post{}
	err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "error getting page version history with pageId=%s", pageId)
	}

	if len(posts) == 0 {
		return nil, store.NewErrNotFound("failed to find page version history", pageId)
	}

	return posts, nil
}
