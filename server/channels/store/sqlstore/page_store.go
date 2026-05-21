// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// MaxChannelPagesLimit is a safety limit for GetChannelPagesMeta to warn when a channel
// exceeds a large number of pages. It does not truncate results.
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

	post.Message = content

	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		// Acquire an advisory lock keyed on (channelId, parentId) to serialize concurrent
		// page creates under the same parent. FOR UPDATE on the sibling rows provides no
		// mutual exclusion when there are no existing siblings (empty result set = no rows
		// locked), so two concurrent first-child creates both read maxOrder=0.
		// pg_advisory_xact_lock is transaction-scoped and released automatically on commit/rollback.
		lockKey := post.ChannelId + ":" + post.PageParentId
		if _, lockErr := tx.Exec(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, lockKey); lockErr != nil {
			return errors.Wrap(lockErr, "failed to acquire advisory lock for page create")
		}

		// Lock existing siblings to serialize concurrent creates under the same parent.
		// FOR UPDATE prevents two concurrent transactions from both reading the same MAX
		// sort order and producing duplicate values.
		// ORDER BY Id ensures deterministic lock acquisition order to prevent deadlocks.
		siblingsQuery := s.getQueryBuilder().
			Select(postSliceColumnsWithName("p")...).
			From("Posts p").
			Where(sq.Eq{
				"p.ChannelId":    post.ChannelId,
				"p.PageParentId": post.PageParentId,
				"p.Type":         model.PostTypePage,
				"p.DeleteAt":     0,
			}).
			OrderBy("p.Id").
			Suffix("FOR UPDATE")

		var siblings []*model.Post
		if selectErr := tx.SelectBuilder(&siblings, siblingsQuery); selectErr != nil {
			return errors.Wrap(selectErr, "failed to lock siblings for sort order")
		}

		var maxOrder int64
		for _, sib := range siblings {
			if order := sib.GetPageSortOrder(); order > maxOrder {
				maxOrder = order
			}
		}
		post.SetPageSortOrder(maxOrder + model.PageSortOrderGap)

		post.PreSave()
		if err := post.IsValid(model.PostMessageMaxRunesV2); err != nil {
			return err
		}
		post.ValidateProps(rctx.Logger())

		insertQuery := s.getQueryBuilder().
			Insert("Posts").
			Columns(postSliceColumns()...).
			Values(postToSlice(post)...)

		query, args, buildErr := insertQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build insert post query")
		}

		if _, execErr := tx.Exec(query, args...); execErr != nil {
			return errors.Wrap(execErr, "failed to save Post")
		}
		return nil
	})
	if err != nil {
		return nil, err
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
			"p.HasReactions", "p.RemoteId", "p.PageSearchText").
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

// maxGetPagesByIDsBatch limits the IN-clause size for GetPagesByIDs to prevent
// OOM on pathologically large inputs.
const maxGetPagesByIDsBatch = 500

func (s *SqlPageStore) GetPagesByIDs(rctx request.CTX, pageIDs []string) ([]*model.Post, error) {
	if len(pageIDs) == 0 {
		return nil, nil
	}
	if len(pageIDs) > maxGetPagesByIDsBatch {
		return nil, errors.Errorf("GetPagesByIDs: too many IDs requested (%d > %d)", len(pageIDs), maxGetPagesByIDsBatch)
	}

	query := s.getQueryBuilder().
		Select(postSliceColumnsWithName("p")...).
		From("Posts p").
		Where(sq.And{
			sq.Eq{"p.Id": pageIDs},
			sq.Eq{"p.Type": model.PostTypePage},
			sq.Eq{"p.DeleteAt": 0},
		})

	posts := []*model.Post{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrap(err, "failed to get pages by IDs")
	}

	return posts, nil
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

		// Capture child IDs before reparenting so they can be re-attached on restore.
		childIDsQuery := s.getQueryBuilder().
			Select("Id").
			From("Posts").
			Where(sq.And{
				sq.Eq{"PageParentId": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"Type": model.PostTypePage},
			})
		childIDsSQL, childIDsArgs, err := childIDsQuery.ToSql()
		if err != nil {
			return errors.Wrap(err, "failed to build child IDs query")
		}
		var childIDs []string
		if err := transaction.Select(&childIDs, childIDsSQL, childIDsArgs...); err != nil {
			return errors.Wrap(err, "failed to fetch child page IDs")
		}

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
		deleteThreadMembershipsQuery := s.getQueryBuilder().
			Delete("ThreadMemberships").
			Where(sq.Expr("PostId IN ("+subquerySQL+")", subqueryArgs...))
		if _, err = transaction.ExecBuilder(deleteThreadMembershipsQuery); err != nil {
			return errors.Wrap(err, "failed to delete ThreadMemberships for page comments")
		}

		// Delete Threads for page comments
		deleteThreadsQuery := s.getQueryBuilder().
			Delete("Threads").
			Where(sq.Expr("PostId IN ("+subquerySQL+")", subqueryArgs...))
		if _, err = transaction.ExecBuilder(deleteThreadsQuery); err != nil {
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

		// Delete the page post itself, storing child IDs and newParentID in Props for future restoration.
		childIDsJSON, err := json.Marshal(childIDs)
		if err != nil {
			return errors.Wrap(err, "failed to marshal child IDs for deletion record")
		}
		deletePostQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Set("Props", sq.Expr(
				"jsonb_set(jsonb_set(jsonb_set(Props, ?, ?), ?, ?::jsonb), ?, ?)",
				jsonKeyPath(model.PostPropsDeleteBy), jsonStringVal(deleteByID),
				jsonKeyPath(model.PagePropsReparentedChildrenOnDelete), string(childIDsJSON),
				jsonKeyPath(model.PagePropsReparentedParentOnDelete), jsonStringVal(newParentID),
			)).
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

// RestorePage restores a soft-deleted page post and re-attaches children that were
// reparented when the page was deleted.
func (s *SqlPageStore) RestorePage(pageID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "pageID", pageID)
	}

	now := model.GetMillis()

	// Read the deleted page's stored child IDs and the parent they were reparented to from Props.
	// We use GetMaster to read committed data from the previous delete transaction.
	childIDs, reparentedToID, err := s.readReparentedChildInfo(pageID)
	if err != nil {
		return errors.Wrap(err, "failed to read page props for restore")
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Restore the page post.
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
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "failed to get rows affected")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Post", pageID)
		}

		// Re-parent only those children whose PageParentId still matches the value they were
		// reparented to at delete time. This skips children that were intentionally moved after
		// the parent was deleted.
		if len(childIDs) > 0 {
			reparentQuery := s.getQueryBuilder().
				Update("Posts").
				Set("PageParentId", pageID).
				Set("UpdateAt", now).
				Where(sq.And{
					sq.Eq{"Id": childIDs},
					sq.Eq{"PageParentId": reparentedToID},
					sq.Eq{"DeleteAt": 0},
					sq.Eq{"Type": model.PostTypePage},
				})
			if _, err := transaction.ExecBuilder(reparentQuery); err != nil {
				return errors.Wrap(err, "failed to re-parent children on restore")
			}
		}

		return nil
	})
}

// readReparentedChildInfo reads the child IDs and reparented-to parent ID stored in a
// soft-deleted page's Props. Selecting only the two needed columns avoids fetching the
// full post row (message, file IDs, etc.).
func (s *SqlPageStore) readReparentedChildInfo(pageID string) (childIDs []string, reparentedToID string, retErr error) {
	type propsRow struct {
		Props model.StringInterface `db:"props"`
	}

	query := s.getQueryBuilder().
		Select("p.Props").
		From("Posts p").
		Where(sq.And{
			sq.Eq{"p.Id": pageID},
			sq.Eq{"p.Type": model.PostTypePage},
			sq.NotEq{"p.DeleteAt": 0},
		})
	queryStr, args, err := query.ToSql()
	if err != nil {
		return nil, "", errors.Wrap(err, "failed to build select query")
	}

	var row propsRow
	if err := s.GetMaster().Get(&row, queryStr, args...); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", store.NewErrNotFound("Post", pageID)
		}
		return nil, "", errors.Wrap(err, "failed to read page props")
	}

	if row.Props != nil {
		if raw, ok := row.Props[model.PagePropsReparentedChildrenOnDelete]; ok {
			switch v := raw.(type) {
			case []interface{}:
				for _, item := range v {
					if id, ok := item.(string); ok && id != "" {
						childIDs = append(childIDs, id)
					}
				}
			case string:
				if err := json.Unmarshal([]byte(v), &childIDs); err != nil {
					return nil, "", errors.Wrap(err, "failed to parse reparented child IDs")
				}
			}
		}
		if parentRaw, ok := row.Props[model.PagePropsReparentedParentOnDelete]; ok {
			if parentStr, ok := parentRaw.(string); ok {
				reparentedToID = parentStr
			}
		}
	}

	return childIDs, reparentedToID, nil
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
		// Preserve the existing PageSearchText for title-only updates (content unchanged).
		searchText := currentPost.PageSearchText
		if page.Message != currentPost.Message {
			searchText = page.PageSearchText
		}
		now := model.GetMillis()
		updateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Message", page.Message).
			Set("PageSearchText", searchText).
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

	if options.PerPage > 0 {
		query = query.Limit(uint64(options.PerPage))
		if options.Page > 0 {
			query = query.Offset(uint64(options.Page * options.PerPage))
		}
	}

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

// pageMetaColumnsWithName returns all post columns except Message, prefixed with alias.
// Used by GetChannelPagesMeta to avoid loading TipTap JSON content for list views.
func pageMetaColumnsWithName(alias string) []string {
	cols := make([]string, 0, len(postSliceColumnsWithTypes()))
	for _, col := range postSliceColumnsWithTypes() {
		if col.Name == "Message" {
			continue
		}
		cols = append(cols, alias+"."+col.Name)
	}
	return cols
}

// GetChannelPages fetches a paginated set of full-content pages ordered by CreateAt DESC.
// When limit <= 0, all pages are returned (for import/export paths that need full content).
func (s *SqlPageStore) GetChannelPages(channelID string, offset, limit int) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select(postSliceColumnsWithName("p")...).
		From("Posts p").
		Where(sq.Eq{
			"p.ChannelId": channelID,
			"p.Type":      model.PostTypePage,
			"p.DeleteAt":  0,
		}).
		OrderBy("p.CreateAt DESC, p.Id DESC")

	if limit > 0 {
		query = query.Limit(uint64(limit)).Offset(uint64(offset))
	}

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find pages for channel_id=%s", channelID)
	}

	return postsToPostList(posts), nil
}

// GetChannelPagesMeta fetches all pages in a channel without the Message field.
// Results are sorted in-memory by sort order, CreateAt, then Id — the same order used
// by the hierarchy tree. Used for cross-wiki list views where content is not needed.
func (s *SqlPageStore) GetChannelPagesMeta(channelID string) (*model.PostList, error) {
	query := s.getQueryBuilder().
		Select(pageMetaColumnsWithName("p")...).
		From("Posts p").
		Where(sq.Eq{
			"p.ChannelId": channelID,
			"p.Type":      model.PostTypePage,
			"p.DeleteAt":  0,
		}).
		Limit(uint64(MaxChannelPagesLimit + 1))

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find page metadata for channel_id=%s", channelID)
	}

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
		}).
		Limit(uint64(MaxChannelPagesLimit + 1))

	posts := []*model.Post{}
	if err := s.GetMaster().SelectBuilder(&posts, query); err != nil {
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

// haveCanonicalSortOrders reports whether all siblings already have distinct,
// non-zero sort orders in strictly increasing order. Used to skip reorder writes
// when no actual change is needed.
func haveCanonicalSortOrders(siblings []*model.Post) bool {
	prev := int64(0)
	for _, p := range siblings {
		order := p.GetPageSortOrder()
		if order <= prev {
			return false
		}
		prev = order
	}
	return true
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

	// 5. If already at the target position AND existing sort orders are canonical
	// (all distinct, non-zero, in increasing order), no-op. Otherwise fall through to
	// recalculation — newly-created pages have sort_order=0, so position-based sorting
	// is ambiguous and we must assign real orders.
	if int64(currentIndex) == newIndex && haveCanonicalSortOrders(siblings) {
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

		// If a new parent is specified, lock pages in consistent order to prevent deadlocks.
		// Without ordering, two concurrent moves (A→B and B→A) could deadlock by acquiring
		// locks in opposite orders (AB vs BA). Lock the lower ID first unconditionally.
		if newParentID != nil && *newParentID != "" && *newParentID != pageID {
			firstID, secondID := pageID, *newParentID
			if firstID > secondID {
				firstID = secondID
			}
			// Lock the lower-ID page first (bare lock, no UpdateAt check)
			if firstID != pageID {
				prelockQuery := s.getQueryBuilder().
					Select("Id").
					From("Posts").
					Where(sq.And{
						sq.Eq{"Id": firstID},
						sq.Eq{"Type": model.PostTypePage},
						sq.Eq{"DeleteAt": 0},
					}).
					Suffix("FOR UPDATE")
				var prelockID string
				if err := tx.GetBuilder(&prelockID, prelockQuery); err != nil {
					if err == sql.ErrNoRows {
						return store.NewErrNotFound("Post", firstID)
					}
					return errors.Wrap(err, "failed to acquire preliminary lock")
				}
			}
		}

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
		// Lock pages in consistent order to prevent deadlocks.
		// Without ordering, two concurrent moves (A→B and B→A) could deadlock by acquiring
		// locks in opposite orders (AB vs BA). Lock the lower ID first unconditionally.
		if newParentID != "" && newParentID != postID {
			firstID, secondID := postID, newParentID
			if firstID > secondID {
				firstID = secondID
			}
			// Lock the lower-ID page first (bare lock, no UpdateAt check)
			if firstID != postID {
				prelockQuery := s.getQueryBuilder().
					Select("Id").
					From("Posts").
					Where(sq.And{
						sq.Eq{"Id": firstID},
						sq.Eq{"Type": model.PostTypePage},
						sq.Eq{"DeleteAt": 0},
					}).
					Suffix("FOR UPDATE")
				var prelockID string
				if err := transaction.GetBuilder(&prelockID, prelockQuery); err != nil {
					if err == sql.ErrNoRows {
						return store.NewErrNotFound("Post", firstID)
					}
					return errors.Wrap(err, "failed to acquire preliminary lock")
				}
			}
		}

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
				sq.Eq{"DeleteAt": 0},
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
			if !json.Valid([]byte(content)) {
				return store.NewErrInvalidInput("Post", "content", "invalid JSON")
			}
			currentPost.Message = content
			if doc, parseErr := model.ParseTipTapDocument(content); parseErr == nil {
				currentPost.PageSearchText = model.BuildSearchText(doc)
			} else {
				currentPost.PageSearchText = ""
			}
			needsHistory = true
		}

		if needsHistory {
			now := model.GetMillis()
			// Ensure UpdateAt strictly increases even if the previous write
			// happened within the same millisecond.
			if now <= currentPost.UpdateAt {
				now = currentPost.UpdateAt + 1
			}
			currentPost.EditAt = now
			currentPost.UpdateAt = now

			updateQuery := s.getQueryBuilder().
				Update("Posts").
				Set("Message", currentPost.Message).
				Set("PageSearchText", currentPost.PageSearchText).
				Set("EditAt", currentPost.EditAt).
				Set("UpdateAt", currentPost.UpdateAt).
				Set("Props", model.StringInterfaceToJSON(currentPost.Props)).
				Where(sq.And{
					sq.Eq{"Id": currentPost.Id},
					sq.Eq{"Type": model.PostTypePage},
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
			sq.Eq{"Posts.Type": model.PostTypePage},
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

	if limit <= 0 {
		limit = 1000
	}
	query = query.Offset(uint64(offset)).Limit(uint64(limit))

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

// UpdateCommentProps sets the Props field on a page comment and returns the refreshed post.
// Restricted to Type='page_comment' so callers cannot bypass post edit history on regular posts.
// Returns ErrNotFound if the post does not exist, is deleted, or is not a page type.
func (s *SqlPageStore) UpdateCommentProps(commentID string, props model.StringInterface) (*model.Post, error) {
	if commentID == "" {
		return nil, store.NewErrInvalidInput("Post", "Id", commentID)
	}

	now := model.GetMillis()
	updateQuery := s.getQueryBuilder().
		Update("Posts").
		Set("Props", model.StringInterfaceToJSON(props)).
		Set("UpdateAt", now).
		Where(sq.And{
			sq.Eq{"Id": commentID},
			sq.Eq{"Type": model.PostTypePageComment},
			sq.Eq{"DeleteAt": 0},
		})

	selectQuery := s.getQueryBuilder().
		Select(postSliceColumns()...).
		From("Posts").
		Where(sq.And{
			sq.Eq{"Id": commentID},
			sq.Eq{"Type": model.PostTypePageComment},
		})

	var post model.Post
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		result, txErr := transaction.ExecBuilder(updateQuery)
		if txErr != nil {
			return txErr
		}
		rowsAffected, txErr := result.RowsAffected()
		if txErr != nil || rowsAffected == 0 {
			if txErr != nil {
				return txErr
			}
			return store.NewErrNotFound("Post", commentID)
		}
		return transaction.GetBuilder(&post, selectQuery)
	})
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, store.NewErrNotFound("Post", commentID)
		}
		return nil, errors.Wrapf(err, "failed to update comment props id=%s", commentID)
	}
	return &post, nil
}

func (s *SqlPageStore) UpdatePageFileIds(pageID string, fileIds model.StringArray) (*model.Post, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Post", "Id", pageID)
	}

	now := model.GetMillis()
	updateQuery := s.getQueryBuilder().
		Update("Posts").
		Set("FileIds", model.ArrayToJSON(fileIds)).
		Set("UpdateAt", now).
		Where(sq.And{
			sq.Eq{"Id": pageID},
			sq.Eq{"Type": model.PostTypePage},
			sq.Eq{"DeleteAt": 0},
		})

	selectQuery := s.getQueryBuilder().
		Select(postSliceColumns()...).
		From("Posts").
		Where(sq.And{
			sq.Eq{"Id": pageID},
			sq.Eq{"Type": model.PostTypePage},
		})

	var post model.Post
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		result, txErr := transaction.ExecBuilder(updateQuery)
		if txErr != nil {
			return txErr
		}
		rowsAffected, txErr := result.RowsAffected()
		if txErr != nil || rowsAffected == 0 {
			if txErr != nil {
				return txErr
			}
			return store.NewErrNotFound("Post", pageID)
		}
		return transaction.GetBuilder(&post, selectQuery)
	})
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, store.NewErrNotFound("Post", pageID)
		}
		return nil, errors.Wrapf(err, "failed to update FileIds for page id=%s", pageID)
	}
	return &post, nil
}

func (s *SqlPageStore) PermanentDeletePage(pageID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Post", "Id", pageID)
	}

	return s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		// Delete FileInfo records associated with the page post
		deleteFileInfo := s.getQueryBuilder().
			Delete("FileInfo").
			Where(sq.Eq{"PostId": pageID})
		if _, err := tx.ExecBuilder(deleteFileInfo); err != nil {
			return errors.Wrapf(err, "failed to delete FileInfo for page id=%s", pageID)
		}

		// Delete ThreadMemberships and Threads for the page itself (if it was used as a thread root)
		deleteThreadMemberships := s.getQueryBuilder().
			Delete("ThreadMemberships").
			Where(sq.Eq{"PostId": pageID})
		if _, err := tx.ExecBuilder(deleteThreadMemberships); err != nil {
			return errors.Wrapf(err, "failed to delete ThreadMemberships for page id=%s", pageID)
		}

		deleteThread := s.getQueryBuilder().
			Delete("Threads").
			Where(sq.Eq{"PostId": pageID})
		if _, err := tx.ExecBuilder(deleteThread); err != nil {
			return errors.Wrapf(err, "failed to delete Thread for page id=%s", pageID)
		}

		// Hard-delete the post
		deletePost := s.getQueryBuilder().
			Delete("Posts").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"Type": model.PostTypePage},
			})
		if _, err := tx.ExecBuilder(deletePost); err != nil {
			return errors.Wrapf(err, "failed to hard-delete page post id=%s", pageID)
		}

		return nil
	})
}

func (s *SqlPageStore) AtomicUpdatePageNotification(channelID, pageID, userID, username, pageTitle string, sinceTime int64) (*model.Post, error) {
	// TODO: The props aggregation logic below (counter increment, updater-ID deduplication)
	// is business logic that belongs in the app layer. Tracked as tech debt.
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
			Set("Props", model.StringInterfaceToJSON(notification.Props)).
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

// BatchSetPageParent updates PageParentId for multiple pages in a single batch.
// Intended for bulk import repair — cycle detection is the caller's responsibility.
// updates maps pageID -> newParentID (empty string = root/no parent).
func (s *SqlPageStore) BatchSetPageParent(updates map[string]string) error {
	if len(updates) == 0 {
		return nil
	}

	now := model.GetMillis()

	// Build a CASE expression: UPDATE Posts SET PageParentId = CASE Id WHEN '...' THEN '...' ... END
	// where Id IN (ids...)
	ids := make([]string, 0, len(updates))
	var caseBuilder strings.Builder
	caseBuilder.WriteString("CASE Id")
	args := []any{}
	for pageID, parentID := range updates {
		caseBuilder.WriteString(" WHEN ? THEN ?")
		args = append(args, pageID, parentID)
		ids = append(ids, pageID)
	}
	caseBuilder.WriteString(" ELSE PageParentId END")
	caseExpr := caseBuilder.String()
	args = append(args, now)

	inClause, inArgs, err := sq.Eq{"Id": ids}.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to build IN clause")
	}
	args = append(args, inArgs...)

	// Squirrel's Update builder cannot express multi-row CASE...END SET expressions;
	// using Rebind-compatible ? placeholders built from sq.Eq{}.ToSql() output.
	query := fmt.Sprintf(
		"UPDATE Posts SET PageParentId = %s, UpdateAt = ? WHERE %s AND Type = 'page' AND DeleteAt = 0",
		caseExpr, inClause,
	)

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to batch update page parents")
	}
	return nil
}
