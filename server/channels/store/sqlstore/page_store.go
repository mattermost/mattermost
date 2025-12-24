// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"maps"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPageStore struct {
	*SqlStore
	pageContentQuery sq.SelectBuilder
}

func newSqlPageStore(sqlStore *SqlStore) store.PageStore {
	s := &SqlPageStore{
		SqlStore: sqlStore,
	}

	s.pageContentQuery = s.getQueryBuilder().
		Select(
			"PageId",
			"Content",
			"SearchText",
			"CreateAt",
			"UpdateAt",
			"DeleteAt",
		).
		From("PageContents")

	return s
}

func (s *SqlPageStore) CreatePage(rctx request.CTX, post *model.Post, content, searchText string) (*model.Post, error) {
	if post.Type != model.PostTypePage {
		return nil, store.NewErrInvalidInput("Post", "Type", post.Type)
	}

	post.PreSave()
	if err := post.IsValid(0); err != nil {
		return nil, err
	}
	post.ValidateProps(rctx.Logger())

	var createdPost *model.Post
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		insertQuery := s.getQueryBuilder().
			Insert("Posts").
			Columns(postSliceColumns()...).
			Values(postToSlice(post)...)

		query, args, buildErr := insertQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build insert post query")
		}

		if _, execErr := transaction.Exec(query, args...); execErr != nil {
			return errors.Wrap(execErr, "failed to save Post")
		}

		pageContent := &model.PageContent{
			PageId: post.Id,
		}
		if setErr := pageContent.SetDocumentJSON(content); setErr != nil {
			return errors.Wrap(setErr, "invalid_content")
		}

		if searchText != "" {
			pageContent.SearchText = searchText
		} else {
			pageContent.PreSave()
		}

		contentJSON, jsonErr := pageContent.GetDocumentJSON()
		if jsonErr != nil {
			return errors.Wrap(jsonErr, "failed to serialize content")
		}

		now := model.GetMillis()
		contentInsertQuery := s.getQueryBuilder().
			Insert("PageContents").
			Columns("PageId", "UserId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
			Values(post.Id, "", contentJSON, pageContent.SearchText, now, now, 0)

		contentQuery, contentArgs, buildErr := contentInsertQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build insert content query")
		}

		if _, execErr := transaction.Exec(contentQuery, contentArgs...); execErr != nil {
			return errors.Wrap(execErr, "failed to save PageContent")
		}

		createdPost = post
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdPost, nil
}

func (s *SqlPageStore) GetPage(pageID string, includeDeleted bool) (*model.Post, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	query := s.getQueryBuilder().
		Select("p.Id", "p.CreateAt", "p.UpdateAt", "p.EditAt", "p.DeleteAt",
			"p.IsPinned", "p.UserId", "p.ChannelId", "p.RootId", "p.OriginalId",
			"p.PageParentId", "p.Message", "p.Type", "p.Props",
			"p.Hashtags", "p.Filenames", "p.FileIds",
			"p.HasReactions", "p.RemoteId").
		From("Posts p").
		Where(sq.And{
			sq.Eq{"p.Id": pageID},
			sq.Eq{"p.Type": model.PostTypePage},
		})

	if !includeDeleted {
		query = query.Where(sq.Eq{"p.DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build get page query")
	}

	var post model.Post
	if err := s.GetReplica().Get(&post, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", pageID)
		}
		return nil, errors.Wrap(err, "failed to get page")
	}

	return &post, nil
}

func (s *SqlPageStore) DeletePage(pageID string, deleteByID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	now := model.GetMillis()

	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		deleteContentQuery := s.getQueryBuilder().
			Update("PageContents").
			Set("DeleteAt", now).
			Where(sq.Eq{"PageId": pageID})

		contentSQL, contentArgs, buildErr := deleteContentQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build delete content query")
		}

		if _, execErr := transaction.Exec(contentSQL, contentArgs...); execErr != nil {
			return errors.Wrap(execErr, "failed to delete PageContent")
		}

		deleteCommentsQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Set("Props", sq.Expr("jsonb_set(Props, ?, ?)", jsonKeyPath(model.PostPropsDeleteBy), jsonStringVal(deleteByID))).
			Where(sq.And{
				sq.Expr("Props->>'page_id' = ?", pageID),
				sq.Eq{"Type": model.PostTypePageComment},
				sq.Eq{"DeleteAt": 0},
			})

		commentsSQL, commentsArgs, buildErr := deleteCommentsQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build delete comments query")
		}

		if _, execErr := transaction.Exec(commentsSQL, commentsArgs...); execErr != nil {
			return errors.Wrap(execErr, "failed to delete page comments")
		}

		deletePostQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Set("Props", sq.Expr("jsonb_set(Props, ?, ?)", jsonKeyPath(model.PostPropsDeleteBy), jsonStringVal(deleteByID))).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
			})

		postSQL, postArgs, buildErr := deletePostQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build delete post query")
		}

		result, execErr := transaction.Exec(postSQL, postArgs...)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to delete Post")
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			return store.NewErrNotFound("Post", pageID)
		}

		return nil
	})

	return err
}

// Update updates a page (following MM pattern - no business logic, just UPDATE)
// Returns store.ErrNotFound if page doesn't exist or was deleted
func (s *SqlPageStore) Update(rctx request.CTX, page *model.Post) (*model.Post, error) {
	if page.Type != model.PostTypePage {
		return nil, store.NewErrInvalidInput("Post", "Type", page.Type)
	}

	if page.Id == "" {
		return nil, store.NewErrInvalidInput("Post", "Id", page.Id)
	}

	var updatedPost model.Post
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Fetch current post before update (for version history)
		selectQuery := s.getQueryBuilder().
			Select(
				"Id", "CreateAt", "UpdateAt", "EditAt", "DeleteAt",
				"IsPinned", "UserId", "ChannelId", "RootId", "OriginalId",
				"PageParentId", "Message", "Type", "Props",
				"Hashtags", "Filenames", "FileIds",
				"HasReactions", "RemoteId",
			).
			From("Posts").
			Where(sq.Eq{"Id": page.Id, "Type": model.PostTypePage})

		queryString, args, buildErr := selectQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select query")
		}

		var currentPost model.Post
		if txErr := transaction.Get(&currentPost, queryString, args...); txErr != nil {
			if txErr == sql.ErrNoRows {
				return store.NewErrNotFound("Post", page.Id)
			}
			return errors.Wrap(txErr, "failed to get current page")
		}

		if currentPost.DeleteAt != 0 {
			return store.NewErrNotFound("Post", page.Id)
		}

		// Fetch current PageContent before update (for version history)
		// UserId = '' means published content (drafts have non-empty UserId)
		var currentContent model.PageContent
		selectContentQuery := s.getQueryBuilder().
			Select("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
			From("PageContents").
			Where(sq.Eq{"PageId": page.Id, "UserId": ""})

		selectContentSQL, selectContentArgs, buildErr := selectContentQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select content query")
		}

		getContentErr := transaction.Get(&currentContent, selectContentSQL, selectContentArgs...)
		hasContent := (getContentErr == nil)
		var oldContent *model.PageContent
		if hasContent {
			oldContent = &currentContent
		}

		// Update the Post
		now := model.GetMillis()
		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Message", page.Message).
			Set("Props", model.StringInterfaceToJSON(page.Props)).
			Set("UpdateAt", now).
			Set("EditAt", now).
			Where(sq.Eq{"Id": page.Id})

		updateSQL, updateArgs, buildErr := updateQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build update query")
		}

		result, execErr := transaction.Exec(updateSQL, updateArgs...)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to update page")
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			return store.NewErrNotFound("Post", page.Id)
		}

		// Update PageContents if content exists
		// UserId = '' means published content (drafts have non-empty UserId)
		if hasContent {
			contentUpdateQuery := s.getQueryBuilder().
				Update("PageContents").
				Set("Content", page.Message).
				Set("UpdateAt", now).
				Where(sq.Eq{"PageId": page.Id, "UserId": ""})

			contentUpdateSQL, contentUpdateArgs, contentBuildErr := contentUpdateQuery.ToSql()
			if contentBuildErr != nil {
				return errors.Wrap(contentBuildErr, "failed to build content update query")
			}

			_, contentErr := transaction.Exec(contentUpdateSQL, contentUpdateArgs...)
			if contentErr != nil {
				return errors.Wrap(contentErr, "failed to update page content")
			}
		}

		// Create version history using the helper
		oldPost := currentPost.Clone()
		if historyErr := s.createPageVersionHistory(rctx, transaction, oldPost, oldContent, now, page.Id); historyErr != nil {
			return historyErr
		}

		// Fetch updated post
		selectUpdatedQuery := s.getQueryBuilder().
			Select("p.*").
			From("Posts p").
			Where(sq.Eq{"p.Id": page.Id})

		selectUpdatedSQL, selectUpdatedArgs, buildErr := selectUpdatedQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select updated query")
		}

		if txErr := transaction.Get(&updatedPost, selectUpdatedSQL, selectUpdatedArgs...); txErr != nil {
			return errors.Wrap(txErr, "failed to fetch updated page")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &updatedPost, nil
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
			} else {
				// Deep copy Props to avoid modifying oldPost.Props
				newProps := make(model.StringInterface, len(currentPost.Props))
				maps.Copy(newProps, currentPost.Props)
				currentPost.Props = newProps
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
			} else {
				// Extract SearchText from content if not provided
				pageContent.PreSave()
			}

			contentJSON, jsonErr := pageContent.GetDocumentJSON()
			if jsonErr != nil {
				return errors.Wrap(jsonErr, "failed to serialize content")
			}

			now := model.GetMillis()

			// First, fetch current PageContents to save as history
			// UserId = '' means published content (drafts have non-empty UserId)
			var currentContent model.PageContent
			selectQuery := s.getQueryBuilder().
				Select("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
				From("PageContents").
				Where(sq.Eq{"PageId": pageID, "UserId": ""})

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
			// UserId = '' means published content (drafts have non-empty UserId)
			updateQuery := s.getQueryBuilder().
				Update("PageContents").
				Set("Content", contentJSON).
				Set("SearchText", pageContent.SearchText).
				Set("UpdateAt", now).
				Where(sq.Eq{"PageId": pageID, "UserId": ""})

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
				// UserId is not specified, so it defaults to '' (empty = published content)
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

			updateQuery := s.getQueryBuilder().
				Update("Posts").
				Set("EditAt", currentPost.EditAt).
				Set("UpdateAt", currentPost.UpdateAt).
				Set("Props", model.StringInterfaceToJSON(currentPost.Props)).
				Where(sq.Eq{"Id": currentPost.Id})

			updateSQL, updateArgs, buildErr := updateQuery.ToSql()
			if buildErr != nil {
				return errors.Wrap(buildErr, "failed to build update post query")
			}

			if _, execErr := transaction.Exec(updateSQL, updateArgs...); execErr != nil {
				return errors.Wrap(execErr, "failed to update post with EditAt")
			}

			// Use the helper to create version history
			if historyErr := s.createPageVersionHistory(rctx, transaction, oldPost, oldContent, now, pageID); historyErr != nil {
				return historyErr
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return &currentPost, nil
}

// createPageVersionHistory creates a historical snapshot of a page and its content
// Must be called within a transaction
func (s *SqlPageStore) createPageVersionHistory(
	rctx request.CTX,
	transaction *sqlxTxWrapper,
	oldPost *model.Post,
	oldContent *model.PageContent,
	now int64,
	pageID string,
) error {
	// Create historical Post
	oldPost.DeleteAt = now
	oldPost.UpdateAt = now
	oldPost.OriginalId = oldPost.Id
	oldPost.Id = model.NewId()

	insertHistoryQuery := s.getQueryBuilder().
		Insert("Posts").
		Columns(postSliceColumns()...).
		Values(postToSlice(oldPost)...)

	historySQL, historyArgs, buildErr := insertHistoryQuery.ToSql()
	if buildErr != nil {
		return errors.Wrap(buildErr, "failed to build history insert query")
	}

	if _, execErr := transaction.Exec(historySQL, historyArgs...); execErr != nil {
		return errors.Wrap(execErr, "failed to insert history entry")
	}

	// Create historical PageContent if it exists
	if oldContent != nil {
		oldContentJSON, jsonErr := oldContent.GetDocumentJSON()
		if jsonErr != nil {
			return errors.Wrap(jsonErr, "failed to serialize old content")
		}

		historyContentInsertQuery := s.getQueryBuilder().
			Insert("PageContents").
			Columns("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
			Values(
				oldPost.Id,
				oldContentJSON,
				oldContent.SearchText,
				oldContent.CreateAt,
				now,
				now,
			)

		historyContentSQL, historyContentArgs, buildErr := historyContentInsertQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build content history insert query")
		}

		_, execErr := transaction.Exec(historyContentSQL, historyContentArgs...)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to insert content history")
		}

		// Prune old versions
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
			rctx.Logger().Warn("Failed to build prune old page content versions query",
				mlog.String("page_id", pageID),
				mlog.Err(buildErr))
		} else {
			_, execErr = transaction.Exec(pruneSQL, pruneArgs...)
			if execErr != nil {
				rctx.Logger().Warn("Failed to prune old page content versions",
					mlog.String("page_id", pageID),
					mlog.Err(execErr))
			}
		}
	}

	return nil
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

func (s *SqlPageStore) GetCommentsForPage(pageID string, includeDeleted bool) (*model.PostList, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	pl := model.NewPostList()

	// Build query: Get page + all comments/replies
	// - Page itself: Id = pageID AND Type = 'page'
	// - All comments: Props->>'page_id' = pageID AND Type = 'page_comment'
	//   (All comments have page_id in Props - root-level, inline, and replies)
	query := s.getQueryBuilder().
		Select(postSliceColumns()...).
		From("Posts").
		Where(sq.Or{
			sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
			},
			sq.And{
				sq.Expr("Props->>'page_id' = ?", pageID),
				sq.Eq{"Type": model.PostTypePageComment},
			},
		}).
		OrderBy("CreateAt ASC")

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	// Execute query
	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build GetCommentsForPage query")
	}

	var posts []*model.Post
	err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get comments for page with id=%s", pageID)
	}

	// Build PostList
	for _, post := range posts {
		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}

	return pl, nil
}

// PageContent operations
// PageStore owns both Posts (Type='page') and PageContents tables for transactional atomicity

func (s *SqlPageStore) SavePageContent(pageContent *model.PageContent) (*model.PageContent, error) {
	pageContent.PreSave()

	if err := pageContent.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, jsonErr := pageContent.GetDocumentJSON()
	if jsonErr != nil {
		return nil, errors.Wrap(jsonErr, "failed to serialize PageContent document")
	}

	query := s.getQueryBuilder().
		Insert("PageContents").
		Columns("PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
		Values(pageContent.PageId, contentJSON, pageContent.SearchText, pageContent.CreateAt, pageContent.UpdateAt, pageContent.DeleteAt)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_insert_tosql")
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to save PageContent with pageId=%s", pageContent.PageId)
	}

	return pageContent, nil
}

func (s *SqlPageStore) GetPageContent(pageID string) (*model.PageContent, error) {
	// UserId = '' means published content (drafts have non-empty UserId)
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageID, "UserId": "", "DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_tosql")
	}

	var pageContent model.PageContent
	var contentJSON string

	if err := s.GetReplica().QueryRow(queryString, args...).Scan(
		&pageContent.PageId,
		&contentJSON,
		&pageContent.SearchText,
		&pageContent.CreateAt,
		&pageContent.UpdateAt,
		&pageContent.DeleteAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageContent", pageID)
		}
		return nil, errors.Wrapf(err, "failed to get PageContent with pageId=%s", pageID)
	}

	if err := pageContent.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse PageContent document")
	}

	return &pageContent, nil
}

func (s *SqlPageStore) GetManyPageContents(pageIDs []string) ([]*model.PageContent, error) {
	if len(pageIDs) == 0 {
		return []*model.PageContent{}, nil
	}

	// UserId = '' means published content (drafts have non-empty UserId)
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageIDs, "UserId": "", "DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_getmany_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PageContents with pageIds=%v", pageIDs)
	}
	defer rows.Close()

	pageContents := []*model.PageContent{}
	for rows.Next() {
		var pageContent model.PageContent
		var contentJSON string

		if err := rows.Scan(
			&pageContent.PageId,
			&contentJSON,
			&pageContent.SearchText,
			&pageContent.CreateAt,
			&pageContent.UpdateAt,
			&pageContent.DeleteAt,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan PageContent row")
		}

		if err := pageContent.SetDocumentJSON(contentJSON); err != nil {
			return nil, errors.Wrapf(err, "failed to parse PageContent document for pageId=%s", pageContent.PageId)
		}

		pageContents = append(pageContents, &pageContent)
	}

	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageContent rows")
	}

	return pageContents, nil
}

func (s *SqlPageStore) GetPageContentWithDeleted(pageID string) (*model.PageContent, error) {
	// UserId = '' means published content (drafts have non-empty UserId)
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageID, "UserId": ""})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_tosql")
	}

	var pageContent model.PageContent
	var contentJSON string

	if err := s.GetReplica().QueryRow(queryString, args...).Scan(
		&pageContent.PageId,
		&contentJSON,
		&pageContent.SearchText,
		&pageContent.CreateAt,
		&pageContent.UpdateAt,
		&pageContent.DeleteAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageContent", pageID)
		}
		return nil, errors.Wrapf(err, "failed to get PageContent with pageId=%s", pageID)
	}

	if err := pageContent.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse PageContent document")
	}

	return &pageContent, nil
}

func (s *SqlPageStore) GetManyPageContentsWithDeleted(pageIDs []string) ([]*model.PageContent, error) {
	if len(pageIDs) == 0 {
		return []*model.PageContent{}, nil
	}

	// UserId = '' means published content (drafts have non-empty UserId)
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageIDs, "UserId": ""})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_getmany_withdeleted_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PageContents (including deleted) with pageIds=%v", pageIDs)
	}
	defer rows.Close()

	pageContents := []*model.PageContent{}
	for rows.Next() {
		var pageContent model.PageContent
		var contentJSON string

		if err := rows.Scan(
			&pageContent.PageId,
			&contentJSON,
			&pageContent.SearchText,
			&pageContent.CreateAt,
			&pageContent.UpdateAt,
			&pageContent.DeleteAt,
		); err != nil {
			return nil, errors.Wrap(err, "failed to scan PageContent row")
		}

		if err := pageContent.SetDocumentJSON(contentJSON); err != nil {
			return nil, errors.Wrapf(err, "failed to parse PageContent document for pageId=%s", pageContent.PageId)
		}

		pageContents = append(pageContents, &pageContent)
	}

	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageContent rows")
	}

	return pageContents, nil
}

func (s *SqlPageStore) UpdatePageContent(pageContent *model.PageContent) (*model.PageContent, error) {
	pageContent.PreSave()

	if err := pageContent.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, jsonErr := pageContent.GetDocumentJSON()
	if jsonErr != nil {
		return nil, errors.Wrap(jsonErr, "failed to serialize PageContent document")
	}

	query := s.getQueryBuilder().
		Update("PageContents").
		Set("Content", contentJSON).
		Set("SearchText", pageContent.SearchText).
		Set("UpdateAt", pageContent.UpdateAt).
		Where(sq.Eq{"PageId": pageContent.PageId})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update PageContent with pageId=%s", pageContent.PageId)
	}

	if err := s.checkRowsAffected(result, "PageContent", pageContent.PageId); err != nil {
		return nil, err
	}

	return pageContent, nil
}

func (s *SqlPageStore) DeletePageContent(pageID string) error {
	query := s.buildSoftDeleteQuery("PageContents", "PageId", pageID, true)

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to soft-delete PageContent with pageId=%s", pageID)
	}

	return s.checkRowsAffected(result, "PageContent", pageID)
}

func (s *SqlPageStore) PermanentDeletePageContent(pageID string) error {
	query := s.getQueryBuilder().
		Delete("PageContents").
		Where(sq.Eq{"PageId": pageID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "page_content_permanent_delete_tosql")
	}

	_, err = s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to permanently delete PageContent with pageId=%s", pageID)
	}

	return nil
}

func (s *SqlPageStore) RestorePageContent(pageID string) error {
	query := s.buildRestoreQuery("PageContents", "PageId", pageID)

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to restore PageContent with pageId=%s", pageID)
	}

	return s.checkRowsAffected(result, "PageContent", pageID)
}
