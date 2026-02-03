// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"maps"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// PublishedPageContentUserId is the UserId value for published page content.
// Published content has empty UserId; draft content has non-empty UserId (the author's ID).
const PublishedPageContentUserId = ""

// pageContentInsertColumns returns the columns for inserting page content.
func pageContentInsertColumns() []string {
	return []string{"PageId", "UserId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt"}
}

// pageContentSelectColumns returns the columns for selecting page content (excludes UserId).
func pageContentSelectColumns() []string {
	return []string{"PageId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt"}
}

type SqlPageStore struct {
	*SqlStore
	pageContentQuery sq.SelectBuilder
}

func newSqlPageStore(sqlStore *SqlStore) store.PageStore {
	s := &SqlPageStore{
		SqlStore: sqlStore,
	}

	s.pageContentQuery = s.getQueryBuilder().
		Select(pageContentSelectColumns()...).
		From("PageContents")

	return s
}

// pagePostExists checks if a Post with Type='page' exists for the given pageID.
// This is used by standalone PageContent methods to ensure referential integrity.
func (s *SqlPageStore) pagePostExists(pageID string) (bool, error) {
	query := s.getQueryBuilder().
		Select("1").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Id": pageID},
			sq.Eq{"Type": model.PostTypePage},
		}).
		Limit(1)

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, errors.Wrap(err, "page_post_exists_tosql")
	}

	var exists int
	// Use GetMaster() for read-after-write consistency in HA mode.
	// This method is called during page creation/update flows where the post was just written.
	if err := s.GetMaster().QueryRow(queryString, args...).Scan(&exists); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, errors.Wrap(err, "failed to check page post existence")
	}

	return true, nil
}

func (s *SqlPageStore) CreatePage(rctx request.CTX, post *model.Post, content, searchText string) (*model.Post, error) {
	if post.Type != model.PostTypePage {
		return nil, store.NewErrInvalidInput("Post", "Type", post.Type)
	}

	post.PreSave()
	if err := post.IsValid(model.PostMessageMaxRunesV2); err != nil {
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
			Columns(pageContentInsertColumns()...).
			Values(post.Id, PublishedPageContentUserId, contentJSON, pageContent.SearchText, now, now, 0)

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

func (s *SqlPageStore) GetPage(rctx request.CTX, pageID string, includeDeleted bool) (*model.Post, error) {
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
	// Use DBXFromContext to respect RequestContextWithMaster flag for read-after-write consistency.
	if err := s.DBXFromContext(rctx.Context()).Get(&post, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", pageID)
		}
		return nil, errors.Wrap(err, "failed to get page")
	}

	return &post, nil
}

// SoftDeletePageComments soft-deletes all comments for a page.
// This is a pure data access method - the App layer decides when to call it.
func (s *SqlPageStore) SoftDeletePageComments(pageID, deleteByID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	now := model.GetMillis()

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

	if _, execErr := s.GetMaster().Exec(commentsSQL, commentsArgs...); execErr != nil {
		return errors.Wrap(execErr, "failed to delete page comments")
	}

	return nil
}

// SoftDeletePagePost soft-deletes the page post itself.
// This is a pure data access method - the App layer decides when to call it.
func (s *SqlPageStore) SoftDeletePagePost(pageID, deleteByID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	now := model.GetMillis()

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

	result, execErr := s.GetMaster().Exec(postSQL, postArgs...)
	if execErr != nil {
		return errors.Wrap(execErr, "failed to delete Post")
	}

	rowsAffected, rowsErr := result.RowsAffected()
	if rowsErr != nil {
		return errors.Wrap(rowsErr, "failed to get rows affected")
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("Post", pageID)
	}

	return nil
}

// DeletePage soft-deletes a page and all its associated data (content, comments, and drafts).
// It also atomically reparents any child pages to newParentID (or makes them root pages if empty).
// All operations are performed in a single transaction to ensure data consistency and prevent
// race conditions where a new child could be added between reparenting and deletion.
func (s *SqlPageStore) DeletePage(pageID string, deleteByID string, newParentID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		now := model.GetMillis()

		// FIRST: Reparent children INSIDE the transaction to prevent race conditions.
		// This must happen before deleting the page to ensure no orphaned children.
		// If a concurrent request tries to add a child, it will either:
		// - See the page as deleted (if it checks after our delete) and fail
		// - Get its child reparented (if it succeeds before our reparent runs)
		reparentQuery := s.getQueryBuilder().
			Update("Posts").
			Set("PageParentId", newParentID).
			Set("UpdateAt", now).
			Where(sq.And{
				sq.Eq{"PageParentId": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"Type": model.PostTypePage},
			})
		if _, err := transaction.ExecBuilder(reparentQuery); err != nil {
			return errors.Wrap(err, "failed to reparent children")
		}

		// Soft-delete published content only (UserId=''), preserving for potential page restore
		softDeletePublishedQuery := s.getQueryBuilder().
			Update("PageContents").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Where(sq.Eq{"PageId": pageID, "UserId": "", "DeleteAt": 0})
		if _, err := transaction.ExecBuilder(softDeletePublishedQuery); err != nil {
			return errors.Wrap(err, "failed to soft-delete published PageContent")
		}

		// Hard-delete draft content (UserId!='') - drafts are orphaned when page is deleted
		// and serve no purpose (matches Confluence behavior)
		hardDeleteDraftsQuery := s.getQueryBuilder().
			Delete("PageContents").
			Where(sq.And{
				sq.Eq{"PageId": pageID},
				sq.NotEq{"UserId": ""},
			})
		if _, err := transaction.ExecBuilder(hardDeleteDraftsQuery); err != nil {
			return errors.Wrap(err, "failed to hard-delete draft PageContents")
		}

		// Delete drafts metadata from Drafts table (page drafts store pageId in RootId)
		deleteDraftsMetadataQuery := s.getQueryBuilder().
			Delete("Drafts").
			Where(sq.Eq{"RootId": pageID})
		if _, err := transaction.ExecBuilder(deleteDraftsMetadataQuery); err != nil {
			return errors.Wrap(err, "failed to delete page drafts metadata")
		}

		// Get all page comment IDs for thread cleanup (before soft-deleting them)
		commentIDsSubquery := s.getQueryBuilder().
			Select("Id").
			From("Posts").
			Where(sq.And{
				sq.Expr("Props->>'page_id' = ?", pageID),
				sq.Eq{"Type": model.PostTypePageComment},
			})

		subquerySQL, subqueryArgs, err := commentIDsSubquery.ToSql()
		if err != nil {
			return errors.Wrap(err, "failed to build comment IDs subquery")
		}

		// Delete ThreadMemberships for page comments (must happen before Thread deletion)
		deleteThreadMembershipsSQL := "DELETE FROM ThreadMemberships WHERE PostId IN (" + subquerySQL + ")"
		if _, err = transaction.Exec(deleteThreadMembershipsSQL, subqueryArgs...); err != nil {
			return errors.Wrap(err, "failed to delete ThreadMemberships for page comments")
		}

		// Delete Threads for page comments
		deleteThreadsSQL := "DELETE FROM Threads WHERE PostId IN (" + subquerySQL + ")"
		if _, err = transaction.Exec(deleteThreadsSQL, subqueryArgs...); err != nil {
			return errors.Wrap(err, "failed to delete Threads for page comments")
		}

		// Delete comments (may not exist, which is OK)
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

		if _, err = transaction.ExecBuilder(deleteCommentsQuery); err != nil {
			return errors.Wrap(err, "failed to delete page comments")
		}

		// Delete the page post itself
		deletePostQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Set("Props", sq.Expr("jsonb_set(Props, ?, ?)", jsonKeyPath(model.PostPropsDeleteBy), jsonStringVal(deleteByID))).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
			})

		result, err := transaction.ExecBuilder(deletePostQuery)
		if err != nil {
			return errors.Wrap(err, "failed to delete Post")
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "failed to get rows affected")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Post", pageID)
		}

		return nil
	})
}

// RestorePage restores a soft-deleted page and its content in a single transaction.
// Content restore is optional (may not exist), but page post restore is required.
func (s *SqlPageStore) RestorePage(pageID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		now := model.GetMillis()

		// Restore content first (may not exist, which is OK)
		restoreContentQuery := s.buildRestoreQuery("PageContents", "PageId", pageID)
		if _, err := transaction.ExecBuilder(restoreContentQuery); err != nil {
			return errors.Wrap(err, "failed to restore PageContent")
		}

		// Restore the page post itself
		restorePostQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", 0).
			Set("UpdateAt", now).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
				sq.NotEq{"DeleteAt": 0},
			})

		result, err := transaction.ExecBuilder(restorePostQuery)
		if err != nil {
			return errors.Wrap(err, "failed to restore Post")
		}

		rowsAffected, rowsErr := result.RowsAffected()
		if rowsErr != nil {
			return errors.Wrap(rowsErr, "failed to get rows affected")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Post", pageID)
		}

		return nil
	})
}

// Update updates a page with optimistic locking using EditAt for compare-and-swap.
// The page.EditAt field MUST contain the EditAt value the caller read before making changes.
// Returns store.ErrNotFound if page doesn't exist, was deleted, or EditAt doesn't match (concurrent modification).
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
			Where(sq.Eq{"PageId": page.Id, "UserId": PublishedPageContentUserId})

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

		// Update the Post with optimistic locking via EditAt.
		// The WHERE clause includes EditAt to ensure no concurrent modification occurred
		// between when the caller read the page and now (compare-and-swap pattern).
		now := model.GetMillis()
		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Message", page.Message).
			Set("Props", model.StringInterfaceToJSON(page.Props)).
			Set("UpdateAt", now).
			Set("EditAt", now).
			Where(sq.And{
				sq.Eq{"Id": page.Id},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"EditAt": page.EditAt}, // Optimistic lock: fail if EditAt changed
			})

		updateSQL, updateArgs, buildErr := updateQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build update query")
		}

		result, execErr := transaction.Exec(updateSQL, updateArgs...)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to update page")
		}

		rowsAffected, rowsErr := result.RowsAffected()
		if rowsErr != nil {
			return errors.Wrap(rowsErr, "failed to get rows affected")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Post", page.Id)
		}

		// Update PageContents only if there's new content to save.
		// When doing a metadata-only update (e.g., rename), page.Message is empty
		// and we should NOT overwrite the existing content.
		// UserId = '' means published content (drafts have non-empty UserId)
		if hasContent && page.Message != "" {
			contentUpdateQuery := s.getQueryBuilder().
				Update("PageContents").
				Set("Content", page.Message).
				Set("UpdateAt", now).
				Where(sq.And{
					sq.Eq{"PageId": page.Id},
					sq.Eq{"UserId": PublishedPageContentUserId},
					sq.Eq{"DeleteAt": 0},
				})

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
			Select(postSliceColumnsWithName("p")...).
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

// GetPageChildren fetches direct children of a page.
// Uses GetReplica() as this is a listing operation that doesn't require
// read-after-write consistency - callers are querying existing hierarchy data.
func (s *SqlPageStore) GetPageChildren(postID string, options model.GetPostsOptions) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select(postSliceColumnsWithName("p")...).
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
		Select(postSliceColumnsWithName("p")...).
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

// ChangePageParent updates the parent of a page using optimistic locking.
// Only updates if UpdateAt matches expectedUpdateAt to prevent concurrent modifications.
// Returns ErrNotFound if no rows affected (page not found or concurrent modification).
// Returns ErrInvalidInput if the move would create a cycle in the hierarchy.
//
// Uses a transaction with cycle detection to prevent race conditions where concurrent
// move operations could create cycles (e.g., moving P1 under P2 while P2 is moved under P1).
func (s *SqlPageStore) ChangePageParent(postID string, newParentID string, expectedUpdateAt int64) error {
	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// If setting a parent, check for cycles atomically within the transaction
		if newParentID != "" {
			// Direct self-reference check
			if newParentID == postID {
				return store.NewErrInvalidInput("Post", "PageParentId", "cannot set page as its own parent")
			}

			// Check if postID is an ancestor of newParentID (would create cycle)
			cycleCheckQuery := `
			WITH RECURSIVE ancestors AS (
				SELECT Id, PageParentId
				FROM Posts WHERE Id = $1 AND Type = 'page' AND DeleteAt = 0
				UNION ALL
				SELECT p.Id, p.PageParentId
				FROM Posts p
				INNER JOIN ancestors a ON p.Id = a.PageParentId
				WHERE a.PageParentId IS NOT NULL AND a.PageParentId != ''
				  AND p.Type = 'page' AND p.DeleteAt = 0
			)
			SELECT 1 FROM ancestors WHERE Id = $2 LIMIT 1`

			var cycleExists int
			err := transaction.Get(&cycleExists, cycleCheckQuery, newParentID, postID)
			if err == nil {
				// Row found means postID is an ancestor of newParentID - cycle detected
				return store.NewErrInvalidInput("Post", "PageParentId", "would create cycle in hierarchy")
			} else if err != sql.ErrNoRows {
				return errors.Wrap(err, "failed to check for cycle")
			}
			// sql.ErrNoRows means no cycle - proceed with update
		}

		// Perform the update with optimistic locking
		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("PageParentId", newParentID).
			Set("UpdateAt", model.GetMillis()).
			Where(sq.And{
				sq.Eq{"Id": postID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"UpdateAt": expectedUpdateAt},
			})

		result, err := transaction.ExecBuilder(updateQuery)
		if err != nil {
			return errors.Wrapf(err, "failed to update parent for post_id=%s", postID)
		}

		return s.checkRowsAffected(result, "Post", postID)
	})
}

// ReparentChildren updates all direct children of a page to a new parent.
// Used when deleting a page to avoid orphaning its children.
// If newParentID is empty, children become root pages.
func (s *SqlPageStore) ReparentChildren(pageID string, newParentID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	updateQuery := s.getQueryBuilder().
		Update("Posts").
		Set("PageParentId", newParentID).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.And{
			sq.Eq{"PageParentId": pageID},
			sq.Eq{"DeleteAt": 0},
			sq.Eq{"Type": model.PostTypePage},
		})

	_, err := s.GetMaster().ExecBuilder(updateQuery)
	if err != nil {
		return errors.Wrapf(err, "failed to reparent children for page_id=%s", pageID)
	}

	return nil
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
				Where(sq.Eq{"PageId": pageID, "UserId": PublishedPageContentUserId})

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

			// Two-step upsert to handle concurrent updates safely
			// Step 1: Try to insert, ignore if row already exists (handles both constraints)
			insertQuery := s.getQueryBuilder().
				Insert("PageContents").
				Columns("PageId", "UserId", "Content", "SearchText", "CreateAt", "UpdateAt", "DeleteAt").
				Values(pageID, PublishedPageContentUserId, contentJSON, pageContent.SearchText, now, now, 0).
				Suffix("ON CONFLICT DO NOTHING")

			insertSQL, insertArgs, buildErr := insertQuery.ToSql()
			if buildErr != nil {
				return errors.Wrap(buildErr, "failed to build insert content query")
			}

			_, execErr := transaction.Exec(insertSQL, insertArgs...)
			if execErr != nil {
				return errors.Wrap(execErr, "failed to insert content")
			}

			// Step 2: Update the row (either just inserted or already existed)
			updateQuery := s.getQueryBuilder().
				Update("PageContents").
				Set("Content", contentJSON).
				Set("SearchText", pageContent.SearchText).
				Set("UpdateAt", now).
				Where(sq.And{
					sq.Eq{"PageId": pageID},
					sq.Eq{"UserId": PublishedPageContentUserId},
				})

			updateSQL, updateArgs, buildErr := updateQuery.ToSql()
			if buildErr != nil {
				return errors.Wrap(buildErr, "failed to build update content query")
			}

			_, execErr = transaction.Exec(updateSQL, updateArgs...)
			if execErr != nil {
				return errors.Wrap(execErr, "failed to update content")
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
				Where(sq.And{
					sq.Eq{"Id": currentPost.Id},
					sq.Eq{"DeleteAt": 0},
				})

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

		// Prune old versions - first identify old version IDs, then delete from both tables
		// Raw SQL is used here because Squirrel doesn't support ROW_NUMBER() window functions
		oldVersionsSubquery := `
			SELECT p.Id
			FROM Posts p
			WHERE p.Id IN (
				SELECT ranked.Id
				FROM (
					SELECT p2.Id, p2.UpdateAt,
						   ROW_NUMBER() OVER (ORDER BY p2.UpdateAt DESC) as rn
					FROM Posts p2
					WHERE p2.OriginalId = ? AND p2.DeleteAt > 0
				) ranked
				WHERE ranked.rn > ?
			)`

		// Prune old PageContents
		pruneContentQuery := s.getQueryBuilder().
			Delete("PageContents").
			Where(sq.Expr(`PageId IN (`+oldVersionsSubquery+`)`, pageID, model.PostEditHistoryLimit))

		pruneContentSQL, pruneContentArgs, buildErr := pruneContentQuery.ToSql()
		if buildErr != nil {
			rctx.Logger().Warn("Failed to build prune old page content versions query",
				mlog.String("page_id", pageID),
				mlog.Err(buildErr))
		} else {
			_, execErr = transaction.Exec(pruneContentSQL, pruneContentArgs...)
			if execErr != nil {
				rctx.Logger().Warn("Failed to prune old page content versions",
					mlog.String("page_id", pageID),
					mlog.Err(execErr))
			}
		}

		// Prune old Posts (version history entries)
		prunePostsQuery := s.getQueryBuilder().
			Delete("Posts").
			Where(sq.Expr(`Id IN (`+oldVersionsSubquery+`)`, pageID, model.PostEditHistoryLimit))

		prunePostsSQL, prunePostsArgs, buildErr := prunePostsQuery.ToSql()
		if buildErr != nil {
			rctx.Logger().Warn("Failed to build prune old page version posts query",
				mlog.String("page_id", pageID),
				mlog.Err(buildErr))
		} else {
			_, execErr = transaction.Exec(prunePostsSQL, prunePostsArgs...)
			if execErr != nil {
				rctx.Logger().Warn("Failed to prune old page version posts",
					mlog.String("page_id", pageID),
					mlog.Err(execErr))
			}
		}
	}

	return nil
}

func (s *SqlPageStore) GetPageVersionHistory(pageId string, offset, limit int) ([]*model.Post, error) {
	builder := s.getQueryBuilder().
		Select("Id", "CreateAt", "UpdateAt", "EditAt", "DeleteAt", "IsPinned", "UserId",
			"ChannelId", "RootId", "OriginalId", "PageParentId", "Message", "Type", "Props",
			"Hashtags", "Filenames", "FileIds", "HasReactions", "RemoteId").
		From("Posts").
		Where(sq.And{
			sq.Eq{"Posts.OriginalId": pageId},
			sq.Gt{"Posts.DeleteAt": 0},
		}).
		OrderBy("Posts.EditAt DESC")

	// Apply pagination - use provided limit or default to PostEditHistoryLimit
	effectiveLimit := limit
	if effectiveLimit <= 0 {
		effectiveLimit = model.PostEditHistoryLimit
	}
	builder = builder.Offset(uint64(offset)).Limit(uint64(effectiveLimit))

	queryString, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build page version history query")
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

func (s *SqlPageStore) GetCommentsForPage(pageID string, includeDeleted bool, offset, limit int) (*model.PostList, error) {
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

	// Apply pagination if limit > 0
	if limit > 0 {
		query = query.Offset(uint64(offset)).Limit(uint64(limit))
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

	exists, err := s.pagePostExists(pageContent.PageId)
	if err != nil {
		return nil, errors.Wrap(err, "failed to verify page post exists")
	}
	if !exists {
		return nil, store.NewErrNotFound("Post", pageContent.PageId)
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
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageID, "UserId": PublishedPageContentUserId, "DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_tosql")
	}

	var pageContent model.PageContent
	var contentJSON string

	// Use GetMaster() for read-after-write consistency in HA mode.
	// This method is called in flows where content was just written (page creation,
	// content update, draft publish) and must return the current state immediately.
	// Replica lag could cause stale data to be returned to the user.
	if err := s.GetMaster().QueryRow(queryString, args...).Scan(
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

// GetManyPageContents fetches multiple page contents by IDs.
// Uses GetReplica() as this is a batch/export operation where slight replication
// lag is acceptable - callers are fetching existing content for export or bulk display.
func (s *SqlPageStore) GetManyPageContents(pageIDs []string) ([]*model.PageContent, error) {
	if len(pageIDs) == 0 {
		return []*model.PageContent{}, nil
	}

	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageIDs, "UserId": PublishedPageContentUserId, "DeleteAt": 0})

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

// GetPageContentWithDeleted fetches page content including soft-deleted content.
// Used for version history retrieval and restore operations.
// Uses GetReplica() as this reads historical data that was written well before
// the current request - no read-after-write consistency concerns.
func (s *SqlPageStore) GetPageContentWithDeleted(pageID string) (*model.PageContent, error) {
	// UserId = '' means published content (drafts have non-empty UserId)
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageID, "UserId": PublishedPageContentUserId})

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
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageIDs, "UserId": PublishedPageContentUserId})

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

	exists, err := s.pagePostExists(pageContent.PageId)
	if err != nil {
		return nil, errors.Wrap(err, "failed to verify page post exists")
	}
	if !exists {
		return nil, store.NewErrNotFound("Post", pageContent.PageId)
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
		Where(sq.And{
			sq.Eq{"PageId": pageContent.PageId},
			sq.Eq{"DeleteAt": 0},
		})

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
	exists, err := s.pagePostExists(pageID)
	if err != nil {
		return errors.Wrap(err, "failed to verify page post exists")
	}
	if !exists {
		return store.NewErrNotFound("Post", pageID)
	}

	query := s.buildRestoreQuery("PageContents", "PageId", pageID)

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to restore PageContent with pageId=%s", pageID)
	}

	return s.checkRowsAffected(result, "PageContent", pageID)
}
