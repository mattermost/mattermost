// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"maps"
	"slices"
	"sort"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// MaxChannelPagesLimit is a safety limit for GetChannelPages to prevent
// unbounded memory allocation. Channels with more pages need pagination.
const MaxChannelPagesLimit = 10000

// MaxPageDescendantsLimit is the maximum number of descendants to return
// from GetPageDescendants to prevent unbounded recursion.
const MaxPageDescendantsLimit = 5000

type SqlPageStore struct {
	*SqlStore
}

func newSqlPageStore(sqlStore *SqlStore) store.PageStore {
	return &SqlPageStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPageStore) CreatePage(rctx request.CTX, post *model.Post, content string) (*model.Post, error) {
	if post.Type != model.PostTypePage {
		return nil, store.NewErrInvalidInput("Post", "Type", post.Type)
	}

	// Store content in Post.Message
	post.Message = content

	post.PreSave()
	if err := post.IsValid(model.PostMessageMaxRunesV2); err != nil {
		return nil, err
	}
	post.ValidateProps(rctx.Logger())

	insertQuery := s.getQueryBuilder().
		Insert("Posts").
		Columns(postSliceColumns()...).
		Values(postToSlice(post)...)

	query, args, buildErr := insertQuery.ToSql()
	if buildErr != nil {
		return nil, errors.Wrap(buildErr, "failed to build insert post query")
	}

	if _, execErr := s.GetMaster().Exec(query, args...); execErr != nil {
		return nil, errors.Wrap(execErr, "failed to save Post")
	}

	return post, nil
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

// DeletePage soft-deletes a page and all its associated data (comments and drafts).
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

		// Delete drafts from Drafts table (page drafts store pageId in RootId)
		deleteDraftsQuery := s.getQueryBuilder().
			Delete("Drafts").
			Where(sq.Eq{"RootId": pageID})
		if _, err := transaction.ExecBuilder(deleteDraftsQuery); err != nil {
			return errors.Wrap(err, "failed to delete page drafts")
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

// RestorePage restores a soft-deleted page post.
func (s *SqlPageStore) RestorePage(pageID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	now := model.GetMillis()

	restorePostQuery := s.getQueryBuilder().
		Update("Posts").
		Set("DeleteAt", 0).
		Set("UpdateAt", now).
		Where(sq.And{
			sq.Eq{"Id": pageID},
			sq.Eq{"Type": model.PostTypePage},
			sq.NotEq{"DeleteAt": 0},
		})

	result, err := s.GetMaster().ExecBuilder(restorePostQuery)
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
			Select(postSliceColumns()...).
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

		// Update the Post with optimistic locking via EditAt.
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
				sq.Eq{"EditAt": page.EditAt},
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

		// Create version history
		oldPost := currentPost.Clone()
		if historyErr := s.createPageVersionHistory(rctx, transaction, oldPost, now, page.Id); historyErr != nil {
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
	// Build CTE with depth limit (enforced in CTE itself) and add result limit
	query := buildPageHierarchyCTE(PageHierarchyDescendants, true, true) +
		fmt.Sprintf(" LIMIT %d", MaxPageDescendantsLimit)

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
		Limit(MaxChannelPagesLimit + 1) // +1 to detect if limit is exceeded

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find pages for channel_id=%s", channelID)
	}

	// Safety check: if we got more than the limit, truncate to prevent memory issues
	if len(posts) > MaxChannelPagesLimit {
		posts = posts[:MaxChannelPagesLimit]
	}

	// Sort in-memory by page_sort_order, then CreateAt, then Id
	// This allows sorting by Props value which can't be done efficiently in SQL
	sort.Slice(posts, func(i, j int) bool {
		// First by PageParentId for grouping (optional, but consistent)
		if posts[i].PageParentId != posts[j].PageParentId {
			return posts[i].PageParentId < posts[j].PageParentId
		}
		// Then by sort order
		iOrder := posts[i].GetPageSortOrder()
		jOrder := posts[j].GetPageSortOrder()
		if iOrder != jOrder {
			return iOrder < jOrder
		}
		// Fallback to CreateAt
		if posts[i].CreateAt != posts[j].CreateAt {
			return posts[i].CreateAt < posts[j].CreateAt
		}
		// Final tiebreaker by Id for stability
		return posts[i].Id < posts[j].Id
	})

	return postsToPostList(posts), nil
}

// GetSiblingPages fetches all sibling pages (pages with the same parent) for a given parent.
// If parentID is empty, returns root-level pages in the channel.
// Results are sorted by page_sort_order, then CreateAt, then Id.
func (s *SqlPageStore) GetSiblingPages(parentID, channelID string) ([]*model.Post, error) {
	if channelID == "" {
		return nil, store.NewErrInvalidInput("Post", "channelID", channelID)
	}
	if parentID != "" && !model.IsValidId(parentID) {
		return nil, store.NewErrInvalidInput("Post", "parentID", parentID)
	}

	query := s.getQueryBuilder().
		Select(postSliceColumnsWithName("p")...).
		From("Posts p").
		Where(sq.Eq{
			"p.ChannelId":    channelID,
			"p.PageParentId": parentID,
			"p.Type":         model.PostTypePage,
			"p.DeleteAt":     0,
		})

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get sibling pages for parent_id=%s channel_id=%s", parentID, channelID)
	}

	// Sort in-memory by page_sort_order, then CreateAt, then Id
	sort.Slice(posts, func(i, j int) bool {
		iOrder := posts[i].GetPageSortOrder()
		jOrder := posts[j].GetPageSortOrder()
		if iOrder != jOrder {
			return iOrder < jOrder
		}
		if posts[i].CreateAt != posts[j].CreateAt {
			return posts[i].CreateAt < posts[j].CreateAt
		}
		return posts[i].Id < posts[j].Id
	})

	return posts, nil
}

// UpdatePageSortOrder reorders a page among its siblings.
// Moves the page to newIndex position (0-indexed) and recalculates sort orders for all siblings.
// Uses SELECT FOR UPDATE to prevent concurrent modification issues.
// Returns the updated list of siblings with their new sort orders.
func (s *SqlPageStore) UpdatePageSortOrder(pageID, parentID, channelID string, newIndex int64) ([]*model.Post, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}
	if channelID == "" {
		return nil, store.NewErrInvalidInput("Post", "channelID", channelID)
	}
	if parentID != "" && !model.IsValidId(parentID) {
		return nil, store.NewErrInvalidInput("Post", "parentID", parentID)
	}

	var result []*model.Post
	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		var txErr error
		result, txErr = s.updatePageSortOrderInTx(tx, pageID, parentID, channelID, newIndex)
		return txErr
	})
	return result, err
}

func (s *SqlPageStore) updatePageSortOrderInTx(tx *sqlxTxWrapper, pageID, parentID, channelID string, newIndex int64) ([]*model.Post, error) {
	// 1. Fetch siblings with FOR UPDATE lock to prevent concurrent modifications
	// OrderBy ensures deterministic lock acquisition order to prevent deadlocks
	query := s.getQueryBuilder().
		Select(postSliceColumnsWithName("p")...).
		From("Posts p").
		Where(sq.Eq{
			"p.ChannelId":    channelID,
			"p.PageParentId": parentID,
			"p.Type":         model.PostTypePage,
			"p.DeleteAt":     0,
		}).
		OrderBy("p.Id").
		Suffix("FOR UPDATE")

	siblings := []*model.Post{}
	if err := tx.SelectBuilder(&siblings, query); err != nil {
		return nil, errors.Wrap(err, "failed to fetch siblings for sort order update")
	}

	// 2. Sort by current order
	sort.Slice(siblings, func(i, j int) bool {
		iOrder := siblings[i].GetPageSortOrder()
		jOrder := siblings[j].GetPageSortOrder()
		if iOrder != jOrder {
			return iOrder < jOrder
		}
		if siblings[i].CreateAt != siblings[j].CreateAt {
			return siblings[i].CreateAt < siblings[j].CreateAt
		}
		return siblings[i].Id < siblings[j].Id
	})

	// 3. Find the page to move
	currentIndex := -1
	for i, p := range siblings {
		if p.Id == pageID {
			currentIndex = i
			break
		}
	}
	if currentIndex == -1 {
		return nil, store.NewErrNotFound("Post", pageID)
	}

	// 4. Clamp newIndex to valid bounds
	if newIndex < 0 {
		newIndex = 0
	}
	if newIndex >= int64(len(siblings)) {
		newIndex = int64(len(siblings) - 1)
	}

	// 5. If already at the target position, no-op (return current state)
	if int64(currentIndex) == newIndex {
		return siblings, nil
	}

	// 6. Remove from current position and insert at new position
	page := siblings[currentIndex]
	siblings = slices.Delete(siblings, currentIndex, currentIndex+1)
	siblings = slices.Insert(siblings, int(newIndex), page)

	// 7. Recalculate sort orders with gaps and batch update Props
	now := model.GetMillis()
	for i, p := range siblings {
		newOrder := int64(i+1) * model.PageSortOrderGap
		p.SetPageSortOrder(newOrder)
		p.UpdateAt = now

		propsJSON := model.StringInterfaceToJSON(p.GetProps())

		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Props", propsJSON).
			Set("UpdateAt", now).
			Where(sq.Eq{"Id": p.Id})

		if _, err := tx.ExecBuilder(updateQuery); err != nil {
			return nil, errors.Wrapf(err, "failed to update sort order for page_id=%s", p.Id)
		}
	}

	return siblings, nil
}

// MovePage atomically moves a page within the hierarchy.
// Combines parent change and sibling reordering in a single transaction.
// - newParentID: if non-nil, changes the page's parent (nil = keep current, empty string = root)
// - newIndex: if non-nil, reorders the page to this position among siblings
// Uses optimistic locking: only updates if UpdateAt matches expectedUpdateAt.
// Returns ErrNotFound if page not found or concurrent modification detected.
// Returns ErrInvalidInput if the move would create a cycle.
func (s *SqlPageStore) MovePage(pageID, channelID string, newParentID *string, newIndex *int64, expectedUpdateAt int64) ([]*model.Post, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}
	if channelID == "" {
		return nil, store.NewErrInvalidInput("Post", "channelID", channelID)
	}

	var result []*model.Post
	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		now := model.GetMillis()

		// Fetch current parent and lock the row to prevent concurrent modifications.
		// FOR UPDATE ensures no other transaction can modify this page until we commit.
		var currentParentID string
		selectQuery := s.getQueryBuilder().
			Select("PageParentId").
			From("Posts").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"UpdateAt": expectedUpdateAt},
			}).
			Suffix("FOR UPDATE")

		queryString, args, buildErr := selectQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select query")
		}

		if err := tx.Get(&currentParentID, queryString, args...); err != nil {
			if err == sql.ErrNoRows {
				return store.NewErrNotFound("Post", pageID)
			}
			return errors.Wrap(err, "failed to get current parent")
		}

		effectiveParentID := currentParentID
		parentChanging := false
		if newParentID != nil {
			effectiveParentID = *newParentID
			parentChanging = effectiveParentID != currentParentID
		}

		// If changing parent, validate and perform cycle detection
		if parentChanging {
			if effectiveParentID != "" {
				// Direct self-reference check
				if effectiveParentID == pageID {
					return store.NewErrInvalidInput("Post", "PageParentId", "cannot set page as its own parent")
				}

				// Lock the new parent row to prevent concurrent moves that could create cycles.
				// Without this lock, two concurrent moves (A→B and B→A) could both pass cycle
				// detection because each sees the pre-move state of the other.
				lockParentQuery := s.getQueryBuilder().
					Select("Id").
					From("Posts").
					Where(sq.And{
						sq.Eq{"Id": effectiveParentID},
						sq.Eq{"Type": model.PostTypePage},
						sq.Eq{"DeleteAt": 0},
					}).
					Suffix("FOR UPDATE")

				lockQueryStr, lockArgs, lockBuildErr := lockParentQuery.ToSql()
				if lockBuildErr != nil {
					return errors.Wrap(lockBuildErr, "failed to build lock parent query")
				}

				var lockedParentID string
				if err := tx.Get(&lockedParentID, lockQueryStr, lockArgs...); err != nil {
					if err == sql.ErrNoRows {
						return store.NewErrNotFound("Post", effectiveParentID)
					}
					return errors.Wrap(err, "failed to lock new parent page")
				}

				// Check if pageID is an ancestor of newParentID (would create cycle).
				// Safe from races because both the moved page and new parent are locked above.
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
				err := tx.Get(&cycleExists, cycleCheckQuery, effectiveParentID, pageID)
				if err == nil {
					return store.NewErrInvalidInput("Post", "PageParentId", "would create cycle in hierarchy")
				} else if err != sql.ErrNoRows {
					return errors.Wrap(err, "failed to check for cycle")
				}
			}

			// Update parent with optimistic locking
			updateQuery := s.getQueryBuilder().
				Update("Posts").
				Set("PageParentId", effectiveParentID).
				Set("UpdateAt", now).
				Where(sq.And{
					sq.Eq{"Id": pageID},
					sq.Eq{"DeleteAt": 0},
					sq.Eq{"UpdateAt": expectedUpdateAt},
				})

			updateResult, err := tx.ExecBuilder(updateQuery)
			if err != nil {
				return errors.Wrapf(err, "failed to update parent for post_id=%s", pageID)
			}

			if err := s.checkRowsAffected(updateResult, "Post", pageID); err != nil {
				return err
			}
		}

		// If newIndex provided, reorder among siblings
		if newIndex != nil {
			var txErr error
			result, txErr = s.updatePageSortOrderInTx(tx, pageID, effectiveParentID, channelID, *newIndex)
			if txErr != nil {
				return txErr
			}
		}

		return nil
	})

	return result, err
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
		// Lock the page being moved to prevent concurrent modifications
		lockPageQuery := s.getQueryBuilder().
			Select("Id").
			From("Posts").
			Where(sq.And{
				sq.Eq{"Id": postID},
				sq.Eq{"Type": model.PostTypePage},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"UpdateAt": expectedUpdateAt},
			}).
			Suffix("FOR UPDATE")

		lockQueryStr, lockArgs, lockBuildErr := lockPageQuery.ToSql()
		if lockBuildErr != nil {
			return errors.Wrap(lockBuildErr, "failed to build lock page query")
		}

		var lockedPageID string
		if err := transaction.Get(&lockedPageID, lockQueryStr, lockArgs...); err != nil {
			if err == sql.ErrNoRows {
				return store.NewErrNotFound("Post", postID)
			}
			return errors.Wrap(err, "failed to lock page for parent change")
		}

		// If setting a parent, check for cycles atomically within the transaction
		if newParentID != "" {
			// Direct self-reference check
			if newParentID == postID {
				return store.NewErrInvalidInput("Post", "PageParentId", "cannot set page as its own parent")
			}

			// Lock the new parent to prevent concurrent moves that could create cycles
			lockParentQuery := s.getQueryBuilder().
				Select("Id").
				From("Posts").
				Where(sq.And{
					sq.Eq{"Id": newParentID},
					sq.Eq{"Type": model.PostTypePage},
					sq.Eq{"DeleteAt": 0},
				}).
				Suffix("FOR UPDATE")

			lockParentStr, lockParentArgs, lockParentBuildErr := lockParentQuery.ToSql()
			if lockParentBuildErr != nil {
				return errors.Wrap(lockParentBuildErr, "failed to build lock parent query")
			}

			var lockedParentID string
			if err := transaction.Get(&lockedParentID, lockParentStr, lockParentArgs...); err != nil {
				if err == sql.ErrNoRows {
					return store.NewErrNotFound("Post", newParentID)
				}
				return errors.Wrap(err, "failed to lock new parent page")
			}

			// Check if postID is an ancestor of newParentID (would create cycle).
			// Safe from races because both pages are locked above.
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
		// Include Type filter for defense in depth (app layer already validates)
		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("PageParentId", newParentID).
			Set("UpdateAt", model.GetMillis()).
			Where(sq.And{
				sq.Eq{"Id": postID},
				sq.Eq{"Type": model.PostTypePage},
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

func (s *SqlPageStore) UpdatePageWithContent(rctx request.CTX, pageID, title, content string) (post *model.Post, err error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	var currentPost model.Post
	err = s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// FOR UPDATE locks the row to prevent concurrent modifications within this transaction.
		query := s.getQueryBuilder().
			Select(postSliceColumns()...).
			From("Posts").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
			}).
			Suffix("FOR UPDATE")

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
			} else {
				newProps := make(model.StringInterface, len(currentPost.Props))
				maps.Copy(newProps, currentPost.Props)
				currentPost.Props = newProps
			}
			currentPost.Props["title"] = title
			needsHistory = true
		}

		if content != "" {
			if vErr := model.ValidateTipTapDocument(content); vErr != nil {
				return errors.Wrap(vErr, "invalid_content")
			}
			currentPost.Message = content
			needsHistory = true
		}

		if needsHistory {
			now := model.GetMillis()
			currentPost.EditAt = now
			currentPost.UpdateAt = now

			updateQuery := s.getQueryBuilder().
				Update("Posts").
				Set("Message", currentPost.Message).
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
				return errors.Wrap(execErr, "failed to update post")
			}

			if historyErr := s.createPageVersionHistory(rctx, transaction, oldPost, now, pageID); historyErr != nil {
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

// createPageVersionHistory creates a historical snapshot of a page post.
// The old post (with Message containing content) is cloned as a history entry.
// Must be called within a transaction.
func (s *SqlPageStore) createPageVersionHistory(
	rctx request.CTX,
	transaction *sqlxTxWrapper,
	oldPost *model.Post,
	now int64,
	pageID string,
) error {
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

	// Prune old version history entries
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

	prunePostsQuery := s.getQueryBuilder().
		Delete("Posts").
		Where(sq.Expr(`Id IN (`+oldVersionsSubquery+`)`, pageID, model.PostEditHistoryLimit))

	prunePostsSQL, prunePostsArgs, buildErr := prunePostsQuery.ToSql()
	if buildErr != nil {
		rctx.Logger().Warn("Failed to build prune old page version posts query",
			mlog.String("page_id", pageID),
			mlog.Err(buildErr))
	} else {
		if _, execErr := transaction.Exec(prunePostsSQL, prunePostsArgs...); execErr != nil {
			rctx.Logger().Warn("Failed to prune old page version posts",
				mlog.String("page_id", pageID),
				mlog.Err(execErr))
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

// AtomicUpdatePageNotification atomically finds and updates an existing page update notification.
// Uses SELECT FOR UPDATE within a transaction to prevent lost updates from concurrent modifications.
// Returns the updated post, or nil if no matching notification was found.
func (s *SqlPageStore) AtomicUpdatePageNotification(channelID, pageID, userID, username, pageTitle string, sinceTime int64) (*model.Post, error) {
	var result *model.Post

	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		// Find all recent page_updated notifications in this channel, locking them.
		// We filter by Props in Go since the column type may not support JSONB operators.
		query := s.getQueryBuilder().
			Select(postSliceColumns()...).
			From("Posts").
			Where(sq.And{
				sq.Eq{"ChannelId": channelID},
				sq.Eq{"Type": model.PostTypePageUpdated},
				sq.Eq{"DeleteAt": 0},
				sq.Gt{"CreateAt": sinceTime},
			}).
			OrderBy("CreateAt DESC").
			Suffix("FOR UPDATE")

		posts := []*model.Post{}
		if err := tx.SelectBuilder(&posts, query); err != nil {
			return errors.Wrap(err, "failed to find page update notifications")
		}

		// Find the notification for this specific page
		var notification *model.Post
		for _, post := range posts {
			if propPageID, ok := post.Props[model.PagePropsPageID].(string); ok && propPageID == pageID {
				notification = post
				break
			}
		}

		if notification == nil {
			return nil // No existing notification; caller will create a new one
		}

		// Atomically update props on the locked row
		updateCount := 1
		if countProp, ok := notification.Props["update_count"].(float64); ok {
			updateCount = int(countProp) + 1
		} else if countProp, ok := notification.Props["update_count"].(int); ok {
			updateCount = countProp + 1
		}

		updaterIds := make(map[string]bool)
		if existingUpdaters, ok := notification.Props["updater_ids"].([]any); ok {
			for _, id := range existingUpdaters {
				if idStr, ok := id.(string); ok {
					updaterIds[idStr] = true
				}
			}
		}
		updaterIds[userID] = true

		updaterIdsList := make([]string, 0, len(updaterIds))
		for id := range updaterIds {
			updaterIdsList = append(updaterIdsList, id)
		}

		notification.Props["page_title"] = pageTitle
		notification.Props["update_count"] = updateCount
		notification.Props["last_update_time"] = model.GetMillis()
		notification.Props["updater_ids"] = updaterIdsList
		if username != "" {
			notification.Props["username_"+userID] = username
		}

		now := model.GetMillis()
		notification.UpdateAt = now

		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Props", notification.Props).
			Set("UpdateAt", now).
			Where(sq.Eq{"Id": notification.Id})

		if _, err := tx.ExecBuilder(updateQuery); err != nil {
			return errors.Wrapf(err, "failed to update notification post id=%s", notification.Id)
		}

		result = notification
		return nil
	})

	return result, err
}
