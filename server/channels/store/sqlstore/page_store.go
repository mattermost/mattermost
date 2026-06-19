// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
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

// pageColumns returns the ordered column list for SELECT/INSERT on the Pages table.
// Must stay in sync with pageToSlice.
func pageColumns() []string {
	return []string{
		"Id", "WikiId", "ChannelId", "ParentId", "Type",
		"Title", "Body", "SearchText",
		"UserId", "LastModifiedBy", "SortOrder",
		"CreateAt", "UpdateAt", "EditAt", "DeleteAt", "OriginalId",
		"HasEffectiveViewRestriction", "HasLocalEditRestriction",
		"Props",
		"ReparentedParentOnDelete", "ReparentedChildrenOnDelete",
	}
}

// pageColumnsWithAlias returns columns prefixed with the given alias.
func pageColumnsWithAlias(alias string) []string {
	cols := pageColumns()
	out := make([]string, len(cols))
	for i, c := range cols {
		out[i] = alias + "." + c
	}
	return out
}

// pageToSlice converts a Page struct to an ordered value slice for INSERT.
// Must stay in sync with pageColumns.
func pageToSlice(p *model.Page) []any {
	return []any{
		p.Id, p.WikiId, p.ChannelId, p.ParentId, p.Type,
		p.Title, p.Body, p.SearchText,
		p.UserId, p.LastModifiedBy, p.SortOrder,
		p.CreateAt, p.UpdateAt, p.EditAt, p.DeleteAt, p.OriginalId,
		p.HasEffectiveViewRestriction, p.HasLocalEditRestriction,
		p.Props,
		p.ReparentedParentOnDelete, p.ReparentedChildrenOnDelete,
	}
}

type SqlPageStore struct {
	*SqlStore
}

func newSqlPageStore(sqlStore *SqlStore) store.PageStore {
	return &SqlPageStore{
		SqlStore: sqlStore,
	}
}

// CreatePage inserts a new page row into the Pages table.
// It assigns a sort order that is one gap higher than the current max among siblings,
// using an advisory lock + sibling FOR UPDATE to serialize concurrent creates.
func (s *SqlPageStore) CreatePage(rctx request.CTX, page *model.Page) (*model.Page, error) {
	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		// Acquire an advisory lock keyed on (channelId, parentId) to serialize concurrent
		// page creates under the same parent.
		lockKey := page.ChannelId + ":" + page.ParentId
		if _, lockErr := tx.Exec(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, lockKey); lockErr != nil {
			return errors.Wrap(lockErr, "failed to acquire advisory lock for page create")
		}

		// Lock existing siblings to serialize concurrent creates under the same parent.
		siblingsQuery := s.getQueryBuilder().
			Select(pageColumnsWithAlias("p")...).
			From("Pages p").
			Where(sq.Eq{
				"p.ChannelId": page.ChannelId,
				"p.ParentId":  page.ParentId,
				"p.DeleteAt":  0,
			}).
			OrderBy("p.Id").
			Suffix("FOR UPDATE")

		var siblings []*model.Page
		if selectErr := tx.SelectBuilder(&siblings, siblingsQuery); selectErr != nil {
			return errors.Wrap(selectErr, "failed to lock siblings for sort order")
		}

		var maxOrder int64
		for _, sib := range siblings {
			if sib.SortOrder > maxOrder {
				maxOrder = sib.SortOrder
			}
		}
		page.SortOrder = maxOrder + model.PageSortOrderGap

		page.PreSave()
		if err := page.IsValid(); err != nil {
			return err
		}

		insertQuery := s.getQueryBuilder().
			Insert("Pages").
			Columns(pageColumns()...).
			Values(pageToSlice(page)...)

		query, args, buildErr := insertQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build insert page query")
		}

		if _, execErr := tx.Exec(query, args...); execErr != nil {
			return errors.Wrap(execErr, "failed to save Page")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return page, nil
}

// GetPage fetches a live page by ID.
// Uses DBXFromContext to respect RequestContextWithMaster flag for read-after-write consistency.
func (s *SqlPageStore) GetPage(rctx request.CTX, pageID string, includeDeleted bool) (*model.Page, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Page", "pageID", pageID)
	}

	query := s.getQueryBuilder().
		Select(pageColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.Eq{"p.Id": pageID})

	if !includeDeleted {
		query = query.Where(sq.Eq{"p.DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build get page query")
	}

	var page model.Page
	if err := s.DBXFromContext(rctx.Context()).Get(&page, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Page", pageID)
		}
		return nil, errors.Wrap(err, "failed to get page")
	}

	return &page, nil
}

// maxGetPagesByIDsBatch limits the IN-clause size for GetPagesByIDs to prevent
// OOM on pathologically large inputs.
const maxGetPagesByIDsBatch = 500

// GetPagesByIDs fetches multiple live pages by their IDs. Missing IDs are silently omitted.
func (s *SqlPageStore) GetPagesByIDs(rctx request.CTX, pageIDs []string) ([]*model.Page, error) {
	if len(pageIDs) == 0 {
		return nil, nil
	}
	if len(pageIDs) > maxGetPagesByIDsBatch {
		return nil, errors.Errorf("GetPagesByIDs: too many IDs requested (%d > %d)", len(pageIDs), maxGetPagesByIDsBatch)
	}

	query := s.getQueryBuilder().
		Select(pageColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.And{
			sq.Eq{"p.Id": pageIDs},
			sq.Eq{"p.DeleteAt": 0},
		})

	pages := []*model.Page{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&pages, query); err != nil {
		return nil, errors.Wrap(err, "failed to get pages by IDs")
	}

	return pages, nil
}

// DeletePage soft-deletes a page and all its associated data.
// Atomically reparents children, soft-deletes page_comment Posts+Threads,
// hard-deletes ThreadMemberships, PageReactions, and Drafts.
// FileInfo rows are left intact so restore keeps files.
func (s *SqlPageStore) DeletePage(pageID string, deleteByID string, newParentID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Page", "pageID", pageID)
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		now := model.GetMillis()

		// Capture child IDs before reparenting so they can be re-attached on restore.
		childIDsQuery := s.getQueryBuilder().
			Select("Id").
			From("Pages").
			Where(sq.And{
				sq.Eq{"ParentId": pageID},
				sq.Eq{"DeleteAt": 0},
			})
		childIDsSQL, childIDsArgs, err := childIDsQuery.ToSql()
		if err != nil {
			return errors.Wrap(err, "failed to build child IDs query")
		}
		var childIDs []string
		if err = transaction.Select(&childIDs, childIDsSQL, childIDsArgs...); err != nil {
			return errors.Wrap(err, "failed to fetch child page IDs")
		}

		// Reparent children inside the transaction to prevent race conditions.
		reparentQuery := s.getQueryBuilder().
			Update("Pages").
			Set("ParentId", newParentID).
			Set("UpdateAt", now).
			Where(sq.And{
				sq.Eq{"ParentId": pageID},
				sq.Eq{"DeleteAt": 0},
			})
		if _, err = transaction.ExecBuilder(reparentQuery); err != nil {
			return errors.Wrap(err, "failed to reparent children")
		}

		// Delete drafts (page drafts store pageId in RootId).
		deleteDraftsQuery := s.getQueryBuilder().
			Delete("Drafts").
			Where(sq.Eq{"RootId": pageID})
		if _, err = transaction.ExecBuilder(deleteDraftsQuery); err != nil {
			return errors.Wrap(err, "failed to delete page drafts")
		}

		// Hard-delete PageReactions for the page (PageReactions has no DeleteAt).
		deleteReactionsQuery := s.getQueryBuilder().
			Delete("PageReactions").
			Where(sq.Eq{"PageId": pageID})
		if _, err = transaction.ExecBuilder(deleteReactionsQuery); err != nil {
			return errors.Wrap(err, "failed to delete page reactions")
		}

		// Hard-delete ThreadMemberships for page comments (ThreadMemberships has no DeleteAt).
		deleteThreadMembershipsQuery := s.getQueryBuilder().
			Delete("ThreadMemberships").
			Where(sq.Expr(
				"PostId IN (SELECT Id FROM Posts WHERE Props->>'page_id' = ? AND Type = ?)",
				pageID, model.PostTypePageComment,
			))
		if _, err = transaction.ExecBuilder(deleteThreadMembershipsQuery); err != nil {
			return errors.Wrap(err, "failed to delete ThreadMemberships for page comments")
		}

		// Soft-delete Threads for page comments (Threads has ThreadDeleteAt column).
		softDeleteThreadsQuery := s.getQueryBuilder().
			Update("Threads").
			Set("ThreadDeleteAt", now).
			Where(sq.Expr(
				"PostId IN (SELECT Id FROM Posts WHERE Props->>'page_id' = ? AND Type = ?)",
				pageID, model.PostTypePageComment,
			))
		if _, err = transaction.ExecBuilder(softDeleteThreadsQuery); err != nil {
			return errors.Wrap(err, "failed to soft-delete Threads for page comments")
		}

		// Soft-delete page_comment posts.
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

		// Soft-delete the page row, storing reparent bookkeeping in the columns.
		childIDsJSON, err := json.Marshal(childIDs)
		if err != nil {
			return errors.Wrap(err, "failed to marshal child IDs for deletion record")
		}
		childIDsJSONStr := string(childIDsJSON)
		deletePageQuery := s.getQueryBuilder().
			Update("Pages").
			Set("DeleteAt", now).
			Set("UpdateAt", now).
			Set("ReparentedParentOnDelete", newParentID).
			Set("ReparentedChildrenOnDelete", childIDsJSONStr).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
			})

		result, err := transaction.ExecBuilder(deletePageQuery)
		if err != nil {
			return errors.Wrap(err, "failed to delete Page")
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "failed to get rows affected")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Page", pageID)
		}

		return nil
	})
}

// RestorePage restores a soft-deleted page and re-attaches children that were
// reparented when the page was deleted. Also un-soft-deletes page_comment posts
// and their Threads/ThreadMemberships.
func (s *SqlPageStore) RestorePage(pageID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Page", "pageID", pageID)
	}

	now := model.GetMillis()

	// Read the deleted page's stored child IDs and reparented-to parent from columns.
	childIDs, reparentedToID, err := s.readReparentedChildInfo(pageID)
	if err != nil {
		return errors.Wrap(err, "failed to read page reparent info for restore")
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Restore the live page row (OriginalId='' is the live-row discriminator).
		restorePageQuery := s.getQueryBuilder().
			Update("Pages").
			Set("DeleteAt", 0).
			Set("UpdateAt", now).
			Set("ReparentedParentOnDelete", nil).
			Set("ReparentedChildrenOnDelete", nil).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"OriginalId": ""},
				sq.NotEq{"DeleteAt": 0},
			})
		result, err := transaction.ExecBuilder(restorePageQuery)
		if err != nil {
			return errors.Wrap(err, "failed to restore Page")
		}
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "failed to get rows affected")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Page", pageID)
		}

		// Re-parent only children whose ParentId still matches the value they were
		// reparented to at delete time (skip children intentionally moved after deletion).
		if len(childIDs) > 0 {
			reparentQuery := s.getQueryBuilder().
				Update("Pages").
				Set("ParentId", pageID).
				Set("UpdateAt", now).
				Where(sq.And{
					sq.Eq{"Id": childIDs},
					sq.Eq{"ParentId": reparentedToID},
					sq.Eq{"DeleteAt": 0},
				})
			if _, err := transaction.ExecBuilder(reparentQuery); err != nil {
				return errors.Wrap(err, "failed to re-parent children on restore")
			}
		}

		// Un-soft-delete page_comment posts.
		restoreCommentsQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", 0).
			Set("UpdateAt", now).
			Where(sq.And{
				sq.Expr("Props->>'page_id' = ?", pageID),
				sq.Eq{"Type": model.PostTypePageComment},
				sq.NotEq{"DeleteAt": 0},
			})
		if _, err := transaction.ExecBuilder(restoreCommentsQuery); err != nil {
			return errors.Wrap(err, "failed to restore page comments")
		}

		// Restore Threads for page comments (clear ThreadDeleteAt).
		restoreThreadsSQL := `
			UPDATE Threads SET ThreadDeleteAt = 0
			WHERE PostId IN (
				SELECT Id FROM Posts
				WHERE Props->>'page_id' = $1 AND Type = 'page_comment'
			)`
		if _, err := transaction.Exec(restoreThreadsSQL, pageID); err != nil {
			return errors.Wrap(err, "failed to restore Threads for page comments")
		}

		// Re-create ThreadMemberships for restored page comments.
		// (ThreadMemberships were hard-deleted on page-delete; re-insert them fresh.
		// Read-state resets to zero — accepted divergence per plan.)
		restoreMembershipsSQL := `
			INSERT INTO ThreadMemberships (PostId, UserId, Following, LastViewed, UnreadMentions, LastUpdated)
			SELECT DISTINCT t.PostId, cm.UserId, true, 0, 0, $1::bigint
			FROM Threads t
			JOIN ChannelMembers cm ON cm.ChannelId = (
				SELECT ChannelId FROM Posts WHERE Id = t.PostId LIMIT 1
			)
			WHERE t.PostId IN (
				SELECT Id FROM Posts
				WHERE Props->>'page_id' = $2 AND Type = 'page_comment'
			)
			ON CONFLICT (PostId, UserId) DO NOTHING`
		if _, err := transaction.Exec(restoreMembershipsSQL, now, pageID); err != nil {
			return errors.Wrap(err, "failed to restore ThreadMemberships for page comments")
		}

		return nil
	})
}

// readReparentedChildInfo reads the child IDs and reparented-to parent ID stored in
// the deleted page's ReparentedParentOnDelete / ReparentedChildrenOnDelete columns.
func (s *SqlPageStore) readReparentedChildInfo(pageID string) (childIDs []string, reparentedToID string, retErr error) {
	query := s.getQueryBuilder().
		Select("ReparentedParentOnDelete", "ReparentedChildrenOnDelete").
		From("Pages").
		Where(sq.And{
			sq.Eq{"Id": pageID},
			sq.Eq{"OriginalId": ""},
			sq.NotEq{"DeleteAt": 0},
		})
	queryStr, args, err := query.ToSql()
	if err != nil {
		return nil, "", errors.Wrap(err, "failed to build select query")
	}

	var reparentedParent, reparentedChildren *string
	if err := s.GetMaster().QueryRow(queryStr, args...).Scan(&reparentedParent, &reparentedChildren); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", store.NewErrNotFound("Page", pageID)
		}
		return nil, "", errors.Wrap(err, "failed to read page reparent info")
	}

	if reparentedParent != nil {
		reparentedToID = *reparentedParent
	}
	if reparentedChildren != nil && *reparentedChildren != "" {
		if err := json.Unmarshal([]byte(*reparentedChildren), &childIDs); err != nil {
			return nil, "", errors.Wrap(err, "failed to parse reparented child IDs")
		}
	}

	return childIDs, reparentedToID, nil
}

// Update updates a page with optimistic locking using EditAt for compare-and-swap.
// The page.EditAt field MUST contain the EditAt value the caller read before making changes.
// Returns store.ErrNotFound if page doesn't exist, was deleted, or EditAt doesn't match.
// The update allowlist excludes HasEffectiveViewRestriction / HasLocalEditRestriction —
// those are only written by the dedicated SetRestrictionMarkers path.
func (s *SqlPageStore) Update(rctx request.CTX, page *model.Page) (*model.Page, error) {
	if page.Id == "" {
		return nil, store.NewErrInvalidInput("Page", "Id", page.Id)
	}

	var updatedPage model.Page
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Fetch current page before update (for version history).
		selectQuery := s.getQueryBuilder().
			Select(pageColumns()...).
			From("Pages").
			Where(sq.And{
				sq.Eq{"Id": page.Id},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
			})

		queryString, args, buildErr := selectQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select query")
		}

		var currentPage model.Page
		if txErr := transaction.Get(&currentPage, queryString, args...); txErr != nil {
			if txErr == sql.ErrNoRows {
				return store.NewErrNotFound("Page", page.Id)
			}
			return errors.Wrap(txErr, "failed to get current page")
		}

		// Preserve SearchText for title-only updates (content unchanged).
		searchText := currentPage.SearchText
		if page.Body != currentPage.Body {
			searchText = page.SearchText
		}
		now := model.GetMillis()

		// Explicit allowlist — excludes HasEffectiveViewRestriction / HasLocalEditRestriction.
		updateQuery := s.getQueryBuilder().
			Update("Pages").
			Set("Title", page.Title).
			Set("Body", page.Body).
			Set("SearchText", searchText).
			Set("SortOrder", page.SortOrder).
			Set("LastModifiedBy", page.LastModifiedBy).
			Set("Props", page.Props).
			Set("UpdateAt", now).
			Set("EditAt", now).
			Where(sq.And{
				sq.Eq{"Id": page.Id},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
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
			return store.NewErrNotFound("Page", page.Id)
		}

		// Create version history snapshot.
		oldPage := currentPage.Clone()
		if historyErr := s.createPageVersionHistory(rctx, transaction, oldPage, now, page.Id); historyErr != nil {
			return historyErr
		}

		// Fetch the updated page.
		selectUpdatedQuery := s.getQueryBuilder().
			Select(pageColumnsWithAlias("p")...).
			From("Pages p").
			Where(sq.Eq{"p.Id": page.Id})

		selectUpdatedSQL, selectUpdatedArgs, buildErr := selectUpdatedQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select updated query")
		}

		if txErr := transaction.Get(&updatedPage, selectUpdatedSQL, selectUpdatedArgs...); txErr != nil {
			return errors.Wrap(txErr, "failed to fetch updated page")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &updatedPage, nil
}

// GetPageChildren fetches direct live children of a page, ordered by CreateAt DESC.
func (s *SqlPageStore) GetPageChildren(pageID string, options model.GetPostsOptions) ([]*model.Page, error) {
	query := s.getQueryBuilder().
		Select(pageColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.Eq{
			"p.ParentId": pageID,
			"p.DeleteAt": 0,
		}).
		OrderBy("p.CreateAt DESC")

	if options.PerPage > 0 {
		query = query.Limit(uint64(options.PerPage))
		if options.Page > 0 {
			query = query.Offset(uint64(options.Page * options.PerPage))
		}
	}

	pages := []*model.Page{}
	if err := s.GetReplica().SelectBuilder(&pages, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find children for page_id=%s", pageID)
	}

	return pages, nil
}

// GetPageDescendants fetches all live descendants of a page (entire subtree).
func (s *SqlPageStore) GetPageDescendants(pageID string) ([]*model.Page, error) {
	query := buildPageHierarchyCTE(PageHierarchyDescendants, true, true) +
		fmt.Sprintf(" LIMIT %d", MaxPageDescendantsLimit)

	pages := []*model.Page{}
	if err := s.GetReplica().Select(&pages, query, pageID); err != nil {
		return nil, errors.Wrapf(err, "failed to find descendants for page_id=%s", pageID)
	}

	return pages, nil
}

// GetPageAncestors fetches all live ancestors of a page up to the root.
func (s *SqlPageStore) GetPageAncestors(pageID string) ([]*model.Page, error) {
	query := buildPageHierarchyCTE(PageHierarchyAncestors, true, true)

	pages := []*model.Page{}
	if err := s.GetReplica().Select(&pages, query, pageID); err != nil {
		return nil, errors.Wrapf(err, "failed to find ancestors for page_id=%s", pageID)
	}

	return pages, nil
}

// pageMetaColumns returns page columns without Body, for list views where content is not needed.
func pageMetaColumns() []string {
	cols := make([]string, 0, len(pageColumns()))
	for _, c := range pageColumns() {
		if c == "Body" {
			continue
		}
		cols = append(cols, c)
	}
	return cols
}

// pageMetaColumnsWithAlias returns pageMetaColumns prefixed with alias.
func pageMetaColumnsWithAlias(alias string) []string {
	cols := pageMetaColumns()
	out := make([]string, len(cols))
	for i, c := range cols {
		out[i] = alias + "." + c
	}
	return out
}

// GetChannelPages fetches a paginated set of full-content live pages ordered by CreateAt DESC.
// When limit <= 0, all pages are returned (for import/export paths that need full content).
func (s *SqlPageStore) GetChannelPages(channelID string, offset, limit int) ([]*model.Page, error) {
	query := s.getQueryBuilder().
		Select(pageColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.Eq{
			"p.ChannelId":  channelID,
			"p.DeleteAt":   0,
			"p.OriginalId": "",
		}).
		OrderBy("p.CreateAt DESC, p.Id DESC")

	if limit > 0 {
		query = query.Limit(uint64(limit)).Offset(uint64(offset))
	}

	pages := []*model.Page{}
	if err := s.GetReplica().SelectBuilder(&pages, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find pages for channel_id=%s", channelID)
	}

	return pages, nil
}

// GetChannelPagesMeta fetches all live pages in a channel without the Body field.
// Results are sorted in-memory by sort order, CreateAt, then Id.
// Used for cross-wiki list views where content is not needed.
func (s *SqlPageStore) GetChannelPagesMeta(channelID string) ([]*model.Page, error) {
	query := s.getQueryBuilder().
		Select(pageMetaColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.Eq{
			"p.ChannelId":  channelID,
			"p.DeleteAt":   0,
			"p.OriginalId": "",
		}).
		Limit(uint64(MaxChannelPagesLimit + 1))

	pages := []*model.Page{}
	if err := s.GetReplica().SelectBuilder(&pages, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find page metadata for channel_id=%s", channelID)
	}

	sort.Slice(pages, func(i, j int) bool {
		if pages[i].SortOrder != pages[j].SortOrder {
			return pages[i].SortOrder < pages[j].SortOrder
		}
		if pages[i].CreateAt != pages[j].CreateAt {
			return pages[i].CreateAt < pages[j].CreateAt
		}
		return pages[i].Id < pages[j].Id
	})

	return pages, nil
}

// GetSiblingPages fetches all live sibling pages (pages with the same parent).
// If parentID is empty, returns root-level pages in the channel.
// Results are sorted by SortOrder, then CreateAt, then Id.
func (s *SqlPageStore) GetSiblingPages(parentID, channelID string) ([]*model.Page, error) {
	if channelID == "" {
		return nil, store.NewErrInvalidInput("Page", "channelID", channelID)
	}
	if parentID != "" && !model.IsValidId(parentID) {
		return nil, store.NewErrInvalidInput("Page", "parentID", parentID)
	}

	query := s.getQueryBuilder().
		Select(pageColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.Eq{
			"p.ChannelId": channelID,
			"p.ParentId":  parentID,
			"p.DeleteAt":  0,
		}).
		Limit(uint64(MaxChannelPagesLimit + 1))

	pages := []*model.Page{}
	if err := s.GetMaster().SelectBuilder(&pages, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get sibling pages for parent_id=%s channel_id=%s", parentID, channelID)
	}

	sort.Slice(pages, func(i, j int) bool {
		if pages[i].SortOrder != pages[j].SortOrder {
			return pages[i].SortOrder < pages[j].SortOrder
		}
		if pages[i].CreateAt != pages[j].CreateAt {
			return pages[i].CreateAt < pages[j].CreateAt
		}
		return pages[i].Id < pages[j].Id
	})

	return pages, nil
}

// haveCanonicalSortOrders reports whether all siblings already have distinct,
// non-zero sort orders in strictly increasing order.
func haveCanonicalSortOrders(siblings []*model.Page) bool {
	prev := int64(0)
	for _, p := range siblings {
		if p.SortOrder <= prev {
			return false
		}
		prev = p.SortOrder
	}
	return true
}

// UpdatePageSortOrder reorders a page among its siblings.
// Moves the page to newIndex position (0-indexed) and recalculates sort orders for all siblings.
// Uses SELECT FOR UPDATE to prevent concurrent modification issues.
// Returns the updated list of siblings with their new sort orders.
func (s *SqlPageStore) UpdatePageSortOrder(pageID, parentID, channelID string, newIndex int64) ([]*model.Page, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Page", "pageID", pageID)
	}
	if channelID == "" {
		return nil, store.NewErrInvalidInput("Page", "channelID", channelID)
	}
	if parentID != "" && !model.IsValidId(parentID) {
		return nil, store.NewErrInvalidInput("Page", "parentID", parentID)
	}

	var result []*model.Page
	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		var txErr error
		result, txErr = s.updatePageSortOrderInTx(tx, pageID, parentID, channelID, newIndex)
		return txErr
	})
	return result, err
}

func (s *SqlPageStore) updatePageSortOrderInTx(tx *sqlxTxWrapper, pageID, parentID, channelID string, newIndex int64) ([]*model.Page, error) {
	// 1. Fetch siblings with FOR UPDATE lock to prevent concurrent modifications.
	//    OrderBy ensures deterministic lock acquisition order to prevent deadlocks.
	query := s.getQueryBuilder().
		Select(pageColumnsWithAlias("p")...).
		From("Pages p").
		Where(sq.Eq{
			"p.ChannelId": channelID,
			"p.ParentId":  parentID,
			"p.DeleteAt":  0,
		}).
		OrderBy("p.Id").
		Suffix("FOR UPDATE")

	siblings := []*model.Page{}
	if err := tx.SelectBuilder(&siblings, query); err != nil {
		return nil, errors.Wrap(err, "failed to fetch siblings for sort order update")
	}

	// 2. Sort by current order.
	sort.Slice(siblings, func(i, j int) bool {
		if siblings[i].SortOrder != siblings[j].SortOrder {
			return siblings[i].SortOrder < siblings[j].SortOrder
		}
		if siblings[i].CreateAt != siblings[j].CreateAt {
			return siblings[i].CreateAt < siblings[j].CreateAt
		}
		return siblings[i].Id < siblings[j].Id
	})

	// 3. Find the page to move.
	currentIndex := -1
	for i, p := range siblings {
		if p.Id == pageID {
			currentIndex = i
			break
		}
	}
	if currentIndex == -1 {
		return nil, store.NewErrNotFound("Page", pageID)
	}

	// 4. Clamp newIndex to valid bounds.
	if newIndex < 0 {
		newIndex = 0
	}
	if newIndex >= int64(len(siblings)) {
		newIndex = int64(len(siblings) - 1)
	}

	// 5. No-op if already at target position with canonical sort orders.
	if int64(currentIndex) == newIndex && haveCanonicalSortOrders(siblings) {
		return siblings, nil
	}

	// 6. Remove from current position and insert at new position.
	page := siblings[currentIndex]
	siblings = slices.Delete(siblings, currentIndex, currentIndex+1)
	siblings = slices.Insert(siblings, int(newIndex), page)

	// 7. Recalculate sort orders with gaps and batch update.
	now := model.GetMillis()
	for i, p := range siblings {
		newOrder := int64(i+1) * model.PageSortOrderGap
		p.SortOrder = newOrder
		p.UpdateAt = now

		updateQuery := s.getQueryBuilder().
			Update("Pages").
			Set("SortOrder", newOrder).
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
func (s *SqlPageStore) MovePage(pageID, channelID string, newParentID *string, newIndex *int64, expectedUpdateAt int64) ([]*model.Page, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Page", "pageID", pageID)
	}
	if channelID == "" {
		return nil, store.NewErrInvalidInput("Page", "channelID", channelID)
	}

	var result []*model.Page
	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		now := model.GetMillis()

		// If a new parent is specified, lock pages in consistent order to prevent deadlocks.
		if newParentID != nil && *newParentID != "" && *newParentID != pageID {
			firstID, secondID := pageID, *newParentID
			if firstID > secondID {
				firstID = secondID
			}
			if firstID != pageID {
				prelockQuery := s.getQueryBuilder().
					Select("Id").
					From("Pages").
					Where(sq.And{
						sq.Eq{"Id": firstID},
						sq.Eq{"DeleteAt": 0},
					}).
					Suffix("FOR UPDATE")
				var prelockID string
				if err := tx.GetBuilder(&prelockID, prelockQuery); err != nil {
					if err == sql.ErrNoRows {
						return store.NewErrNotFound("Page", firstID)
					}
					return errors.Wrap(err, "failed to acquire preliminary lock")
				}
			}
		}

		// Fetch current parent and lock the row to prevent concurrent modifications.
		var currentParentID string
		selectQuery := s.getQueryBuilder().
			Select("ParentId").
			From("Pages").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
				sq.Eq{"UpdateAt": expectedUpdateAt},
			}).
			Suffix("FOR UPDATE")

		queryString, args, buildErr := selectQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build select query")
		}

		if err := tx.Get(&currentParentID, queryString, args...); err != nil {
			if err == sql.ErrNoRows {
				return store.NewErrNotFound("Page", pageID)
			}
			return errors.Wrap(err, "failed to get current parent")
		}

		effectiveParentID := currentParentID
		parentChanging := false
		if newParentID != nil {
			effectiveParentID = *newParentID
			parentChanging = effectiveParentID != currentParentID
		}

		if parentChanging {
			if effectiveParentID != "" {
				if effectiveParentID == pageID {
					return store.NewErrInvalidInput("Page", "ParentId", "cannot set page as its own parent")
				}

				// Lock the new parent row to prevent concurrent moves that could create cycles.
				lockParentQuery := s.getQueryBuilder().
					Select("Id").
					From("Pages").
					Where(sq.And{
						sq.Eq{"Id": effectiveParentID},
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
						return store.NewErrNotFound("Page", effectiveParentID)
					}
					return errors.Wrap(err, "failed to lock new parent page")
				}

				// Check for cycle: is pageID an ancestor of effectiveParentID?
				cycleCheckQuery := `
				WITH RECURSIVE ancestors AS (
					SELECT Id, ParentId
					FROM Pages WHERE Id = $1 AND DeleteAt = 0
					UNION ALL
					SELECT p.Id, p.ParentId
					FROM Pages p
					INNER JOIN ancestors a ON p.Id = a.ParentId
					WHERE a.ParentId IS NOT NULL AND a.ParentId != ''
					  AND p.DeleteAt = 0
				)
				SELECT 1 FROM ancestors WHERE Id = $2 LIMIT 1`

				var cycleExists int
				err := tx.Get(&cycleExists, cycleCheckQuery, effectiveParentID, pageID)
				if err == nil {
					return store.NewErrInvalidInput("Page", "ParentId", "would create cycle in hierarchy")
				} else if err != sql.ErrNoRows {
					return errors.Wrap(err, "failed to check for cycle")
				}
			}

			// Update parent with optimistic locking.
			updateQuery := s.getQueryBuilder().
				Update("Pages").
				Set("ParentId", effectiveParentID).
				Set("UpdateAt", now).
				Where(sq.And{
					sq.Eq{"Id": pageID},
					sq.Eq{"DeleteAt": 0},
					sq.Eq{"OriginalId": ""},
					sq.Eq{"UpdateAt": expectedUpdateAt},
				})

			updateResult, err := tx.ExecBuilder(updateQuery)
			if err != nil {
				return errors.Wrapf(err, "failed to update parent for page_id=%s", pageID)
			}

			if err := s.checkRowsAffected(updateResult, "Page", pageID); err != nil {
				return err
			}
		}

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
func (s *SqlPageStore) ChangePageParent(pageID string, newParentID string, expectedUpdateAt int64) error {
	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Lock pages in consistent order to prevent deadlocks.
		if newParentID != "" && newParentID != pageID {
			firstID, secondID := pageID, newParentID
			if firstID > secondID {
				firstID = secondID
			}
			if firstID != pageID {
				prelockQuery := s.getQueryBuilder().
					Select("Id").
					From("Pages").
					Where(sq.And{
						sq.Eq{"Id": firstID},
						sq.Eq{"DeleteAt": 0},
					}).
					Suffix("FOR UPDATE")
				var prelockID string
				if err := transaction.GetBuilder(&prelockID, prelockQuery); err != nil {
					if err == sql.ErrNoRows {
						return store.NewErrNotFound("Page", firstID)
					}
					return errors.Wrap(err, "failed to acquire preliminary lock")
				}
			}
		}

		// Lock the page being moved.
		lockPageQuery := s.getQueryBuilder().
			Select("Id").
			From("Pages").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
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
				return store.NewErrNotFound("Page", pageID)
			}
			return errors.Wrap(err, "failed to lock page for parent change")
		}

		if newParentID != "" {
			if newParentID == pageID {
				return store.NewErrInvalidInput("Page", "ParentId", "cannot set page as its own parent")
			}

			// Lock the new parent.
			lockParentQuery := s.getQueryBuilder().
				Select("Id").
				From("Pages").
				Where(sq.And{
					sq.Eq{"Id": newParentID},
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
					return store.NewErrNotFound("Page", newParentID)
				}
				return errors.Wrap(err, "failed to lock new parent page")
			}

			// Cycle detection.
			cycleCheckQuery := `
			WITH RECURSIVE ancestors AS (
				SELECT Id, ParentId
				FROM Pages WHERE Id = $1 AND DeleteAt = 0
				UNION ALL
				SELECT p.Id, p.ParentId
				FROM Pages p
				INNER JOIN ancestors a ON p.Id = a.ParentId
				WHERE a.ParentId IS NOT NULL AND a.ParentId != ''
				  AND p.DeleteAt = 0
			)
			SELECT 1 FROM ancestors WHERE Id = $2 LIMIT 1`

			var cycleExists int
			err := transaction.Get(&cycleExists, cycleCheckQuery, newParentID, pageID)
			if err == nil {
				return store.NewErrInvalidInput("Page", "ParentId", "would create cycle in hierarchy")
			} else if err != sql.ErrNoRows {
				return errors.Wrap(err, "failed to check for cycle")
			}
		}

		updateQuery := s.getQueryBuilder().
			Update("Pages").
			Set("ParentId", newParentID).
			Set("UpdateAt", model.GetMillis()).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
				sq.Eq{"UpdateAt": expectedUpdateAt},
			})

		result, err := transaction.ExecBuilder(updateQuery)
		if err != nil {
			return errors.Wrapf(err, "failed to update parent for page_id=%s", pageID)
		}

		return s.checkRowsAffected(result, "Page", pageID)
	})
}

// UpdatePageWithContent updates a page's title and/or content and creates edit history.
// The update allowlist excludes HasEffectiveViewRestriction / HasLocalEditRestriction.
func (s *SqlPageStore) UpdatePageWithContent(rctx request.CTX, pageID, title, content string) (*model.Page, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Page", "pageID", pageID)
	}

	var currentPage model.Page
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// FOR UPDATE locks the row to prevent concurrent modifications.
		query := s.getQueryBuilder().
			Select(pageColumns()...).
			From("Pages").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
			}).
			Suffix("FOR UPDATE")

		queryString, args, buildErr := query.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build get page query")
		}

		if txErr := transaction.Get(&currentPage, queryString, args...); txErr != nil {
			if txErr == sql.ErrNoRows {
				return store.NewErrNotFound("Page", pageID)
			}
			return errors.Wrap(txErr, "failed to get page")
		}

		// Clone the old page for history before making changes.
		oldPage := currentPage.Clone()
		needsHistory := false

		if title != "" {
			currentPage.Title = title
			needsHistory = true
		}

		if content != "" {
			if !json.Valid([]byte(content)) {
				return store.NewErrInvalidInput("Page", "content", "invalid JSON")
			}
			currentPage.Body = content
			if doc, parseErr := model.ParseTipTapDocument(content); parseErr == nil {
				currentPage.SearchText = model.BuildSearchText(doc)
			} else {
				currentPage.SearchText = ""
			}
			needsHistory = true
		}

		if needsHistory {
			now := model.GetMillis()
			if now <= currentPage.UpdateAt {
				now = currentPage.UpdateAt + 1
			}
			currentPage.EditAt = now
			currentPage.UpdateAt = now

			// Explicit allowlist — excludes HasEffectiveViewRestriction / HasLocalEditRestriction.
			updateQuery := s.getQueryBuilder().
				Update("Pages").
				Set("Title", currentPage.Title).
				Set("Body", currentPage.Body).
				Set("SearchText", currentPage.SearchText).
				Set("EditAt", currentPage.EditAt).
				Set("UpdateAt", currentPage.UpdateAt).
				Where(sq.And{
					sq.Eq{"Id": currentPage.Id},
					sq.Eq{"DeleteAt": 0},
					sq.Eq{"OriginalId": ""},
				})

			updateSQL, updateArgs, buildErr := updateQuery.ToSql()
			if buildErr != nil {
				return errors.Wrap(buildErr, "failed to build update page query")
			}

			if _, execErr := transaction.Exec(updateSQL, updateArgs...); execErr != nil {
				return errors.Wrap(execErr, "failed to update page")
			}

			if historyErr := s.createPageVersionHistory(rctx, transaction, oldPage, now, pageID); historyErr != nil {
				return historyErr
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return &currentPage, nil
}

// createPageVersionHistory creates a historical snapshot of a page row.
// The snapshot carries the pre-edit state: DeleteAt=now, OriginalId=pageID, new Id.
// The snapshot DOES carry the marker columns (HasEffectiveViewRestriction / HasLocalEditRestriction)
// so a snapshot remembers its restriction state at the time of the edit.
// Must be called within a transaction.
func (s *SqlPageStore) createPageVersionHistory(
	rctx request.CTX,
	transaction *sqlxTxWrapper,
	oldPage *model.Page,
	now int64,
	pageID string,
) error {
	oldPage.DeleteAt = now
	oldPage.UpdateAt = now
	oldPage.OriginalId = oldPage.Id
	oldPage.Id = model.NewId()

	insertHistoryQuery := s.getQueryBuilder().
		Insert("Pages").
		Columns(pageColumns()...).
		Values(pageToSlice(oldPage)...)

	historySQL, historyArgs, buildErr := insertHistoryQuery.ToSql()
	if buildErr != nil {
		return errors.Wrap(buildErr, "failed to build history insert query")
	}

	if _, execErr := transaction.Exec(historySQL, historyArgs...); execErr != nil {
		return errors.Wrap(execErr, "failed to insert history entry")
	}

	// Prune old version history entries beyond PostEditHistoryLimit.
	oldVersionsSubquery := `
		SELECT p.Id
		FROM Pages p
		WHERE p.Id IN (
			SELECT ranked.Id
			FROM (
				SELECT p2.Id, p2.UpdateAt,
					   ROW_NUMBER() OVER (ORDER BY p2.UpdateAt DESC) as rn
				FROM Pages p2
				WHERE p2.OriginalId = ? AND p2.DeleteAt > 0
			) ranked
			WHERE ranked.rn > ?
		)`

	pruneQuery := s.getQueryBuilder().
		Delete("Pages").
		Where(sq.Expr(`Id IN (`+oldVersionsSubquery+`)`, pageID, model.PostEditHistoryLimit))

	pruneSQL, pruneArgs, buildErr := pruneQuery.ToSql()
	if buildErr != nil {
		rctx.Logger().Warn("Failed to build prune old page version query",
			mlog.String("page_id", pageID),
			mlog.Err(buildErr))
	} else {
		if _, execErr := transaction.Exec(pruneSQL, pruneArgs...); execErr != nil {
			rctx.Logger().Warn("Failed to prune old page versions",
				mlog.String("page_id", pageID),
				mlog.Err(execErr))
		}
	}

	return nil
}

// GetPageVersionHistory fetches version snapshots for a page (DeleteAt>0, OriginalId=pageId),
// ordered newest-first by EditAt.
func (s *SqlPageStore) GetPageVersionHistory(pageID string, offset, limit int) ([]*model.Page, error) {
	builder := s.getQueryBuilder().
		Select(pageColumns()...).
		From("Pages").
		Where(sq.And{
			sq.Eq{"Pages.OriginalId": pageID},
			sq.Gt{"Pages.DeleteAt": 0},
		}).
		OrderBy("Pages.EditAt DESC")

	effectiveLimit := limit
	if effectiveLimit <= 0 {
		effectiveLimit = model.PostEditHistoryLimit
	}
	builder = builder.Offset(uint64(offset)).Limit(uint64(effectiveLimit))

	queryString, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build page version history query")
	}

	pages := []*model.Page{}
	err = s.GetReplica().Select(&pages, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "error getting page version history with pageId=%s", pageID)
	}

	return pages, nil
}

// GetCommentsForPage fetches all comments and replies for a page.
// Comments remain in Posts; this method queries only comment posts (not the page itself).
// The first OR-arm that fetched the page-as-post is dropped — pages are no longer in Posts.
func (s *SqlPageStore) GetCommentsForPage(pageID string, includeDeleted bool, offset, limit int) (*model.PostList, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Page", "pageID", pageID)
	}

	pl := model.NewPostList()

	// Fetch only comments/replies: Props->>'page_id' = pageID AND Type = 'page_comment'.
	// (The page-as-post arm that used to appear here is dropped; pages are in Pages, not Posts.)
	query := s.getQueryBuilder().
		Select(postSliceColumns()...).
		From("Posts").
		Where(sq.And{
			sq.Expr("Props->>'page_id' = ?", pageID),
			sq.Eq{"Type": model.PostTypePageComment},
		}).
		OrderBy("CreateAt ASC")

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	if limit <= 0 {
		limit = 1000
	}
	query = query.Offset(uint64(offset)).Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build GetCommentsForPage query")
	}

	var posts []*model.Post
	err = s.GetReplica().Select(&posts, queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get comments for page with id=%s", pageID)
	}

	for _, post := range posts {
		pl.AddPost(post)
		pl.AddOrder(post.Id)
	}

	return pl, nil
}

// GetSinglePageComment fetches a single page_comment post by ID.
func (s *SqlPageStore) GetSinglePageComment(commentID string, includeDeleted bool) (*model.Post, error) {
	if commentID == "" {
		return nil, store.NewErrInvalidInput("Post", "Id", commentID)
	}

	query := s.getQueryBuilder().
		Select(postSliceColumns()...).
		From("Posts").
		Where(sq.Eq{"Id": commentID}).
		Where(sq.Eq{"Type": model.PostTypePageComment})

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "GetSinglePageComment_tosql")
	}

	var post model.Post
	if err = s.GetReplica().Get(&post, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", commentID)
		}
		return nil, errors.Wrapf(err, "failed to get page comment with id=%s", commentID)
	}

	return &post, nil
}

// UpdateCommentProps sets the Props field on a page comment and returns the refreshed post.
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

// UpdatePageFileIds reparents FileInfo rows to the live page (SET PageId=pageID)
// and returns the refreshed page. Guards that the target is a live page row.
func (s *SqlPageStore) UpdatePageFileIds(pageID string, fromPostID string, fileIds model.StringArray) (*model.Page, error) {
	if pageID == "" {
		return nil, store.NewErrInvalidInput("Page", "Id", pageID)
	}

	now := model.GetMillis()

	var page model.Page
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Guard: target must be a live page (not a snapshot).
		guardQuery := s.getQueryBuilder().
			Select("Id").
			From("Pages").
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
			})
		var guardID string
		if err := transaction.GetBuilder(&guardID, guardQuery); err != nil {
			if err == sql.ErrNoRows {
				return store.NewErrNotFound("Page", pageID)
			}
			return errors.Wrapf(err, "failed to verify live page id=%s", pageID)
		}

		// Bump UpdateAt on the page row.
		updateQuery := s.getQueryBuilder().
			Update("Pages").
			Set("UpdateAt", now).
			Where(sq.And{
				sq.Eq{"Id": pageID},
				sq.Eq{"DeleteAt": 0},
				sq.Eq{"OriginalId": ""},
			})
		result, txErr := transaction.ExecBuilder(updateQuery)
		if txErr != nil {
			return txErr
		}
		rowsAffected, txErr := result.RowsAffected()
		if txErr != nil || rowsAffected == 0 {
			if txErr != nil {
				return txErr
			}
			return store.NewErrNotFound("Page", pageID)
		}

		// Reparent FileInfo rows: SET PageId=pageID. fromPostID is "" for fresh page-editor
		// uploads (whose FileInfo.PostId is also "") and the source post id when migrating
		// files off a post — either way match by current PostId and the supplied file ids.
		if len(fileIds) > 0 {
			reparentQuery := s.getQueryBuilder().
				Update("FileInfo").
				Set("PageId", pageID).
				Where(sq.And{
					sq.Eq{"PostId": fromPostID},
					sq.Eq{"Id": []string(fileIds)},
				})
			if _, txErr = transaction.ExecBuilder(reparentQuery); txErr != nil {
				return errors.Wrapf(txErr, "failed to reparent FileInfo rows from post %s to page %s", fromPostID, pageID)
			}
		}

		// Fetch the updated page.
		selectQuery := s.getQueryBuilder().
			Select(pageColumns()...).
			From("Pages").
			Where(sq.Eq{"Id": pageID})
		return transaction.GetBuilder(&page, selectQuery)
	})
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, store.NewErrNotFound("Page", pageID)
		}
		return nil, errors.Wrapf(err, "failed to update FileIds for page id=%s", pageID)
	}
	return &page, nil
}

// PermanentDeletePage hard-deletes a page, its version snapshots, PageReactions,
// FileInfo, Drafts, and the comment posts' Threads/ThreadMemberships.
func (s *SqlPageStore) PermanentDeletePage(pageID string) error {
	if pageID == "" {
		return store.NewErrInvalidInput("Page", "Id", pageID)
	}

	return s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
		// Collect comment IDs for thread cleanup.
		commentIDsSQL := `SELECT Id FROM Posts WHERE Props->>'page_id' = $1 AND Type = 'page_comment'`

		// Delete ThreadMemberships for page comments.
		if _, err := tx.Exec(fmt.Sprintf(`DELETE FROM ThreadMemberships WHERE PostId IN (%s)`, commentIDsSQL), pageID); err != nil {
			return errors.Wrapf(err, "failed to delete ThreadMemberships for page id=%s", pageID)
		}

		// Delete Threads for page comments.
		if _, err := tx.Exec(fmt.Sprintf(`DELETE FROM Threads WHERE PostId IN (%s)`, commentIDsSQL), pageID); err != nil {
			return errors.Wrapf(err, "failed to delete Threads for page id=%s", pageID)
		}

		// Delete comment posts.
		if _, err := tx.Exec(`DELETE FROM Posts WHERE Props->>'page_id' = $1 AND Type = 'page_comment'`, pageID); err != nil {
			return errors.Wrapf(err, "failed to delete page comments for page id=%s", pageID)
		}

		// Hard-delete PageReactions.
		deleteReactions := s.getQueryBuilder().
			Delete("PageReactions").
			Where(sq.Eq{"PageId": pageID})
		if _, err := tx.ExecBuilder(deleteReactions); err != nil {
			return errors.Wrapf(err, "failed to delete PageReactions for page id=%s", pageID)
		}

		// Hard-delete FileInfo (using PageId, not PostId).
		deleteFileInfo := s.getQueryBuilder().
			Delete("FileInfo").
			Where(sq.Eq{"PageId": pageID})
		if _, err := tx.ExecBuilder(deleteFileInfo); err != nil {
			return errors.Wrapf(err, "failed to delete FileInfo for page id=%s", pageID)
		}

		// Delete Drafts.
		deleteDrafts := s.getQueryBuilder().
			Delete("Drafts").
			Where(sq.Eq{"RootId": pageID})
		if _, err := tx.ExecBuilder(deleteDrafts); err != nil {
			return errors.Wrapf(err, "failed to delete Drafts for page id=%s", pageID)
		}

		// Hard-delete version snapshot rows (WHERE OriginalId=pageID).
		deleteSnapshots := s.getQueryBuilder().
			Delete("Pages").
			Where(sq.Eq{"OriginalId": pageID})
		if _, err := tx.ExecBuilder(deleteSnapshots); err != nil {
			return errors.Wrapf(err, "failed to delete page snapshots id=%s", pageID)
		}

		// Hard-delete the live page row.
		deletePage := s.getQueryBuilder().
			Delete("Pages").
			Where(sq.Eq{"Id": pageID})
		if _, err := tx.ExecBuilder(deletePage); err != nil {
			return errors.Wrapf(err, "failed to hard-delete page id=%s", pageID)
		}

		return nil
	})
}

// AtomicUpdatePageNotification stays Posts-backed — it finds/updates a system_page_updated
// notification post in the channel feed, not a page row.
func (s *SqlPageStore) AtomicUpdatePageNotification(channelID, pageID, userID, username, pageTitle string, sinceTime int64) (*model.Post, error) {
	var result *model.Post

	err := s.ExecuteInTransaction(func(tx *sqlxTxWrapper) error {
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

		var notification *model.Post
		for _, post := range posts {
			if propPageID, ok := post.Props[model.PagePropsPageID].(string); ok && propPageID == pageID {
				notification = post
				break
			}
		}

		if notification == nil {
			return nil
		}

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

// BatchSetPageParent updates ParentId for multiple pages in a single batch.
// Intended for bulk import repair — cycle detection is the caller's responsibility.
// updates maps pageID -> newParentID (empty string = root/no parent).
// Single-column targeted update preserves HasEffectiveViewRestriction / HasLocalEditRestriction.
func (s *SqlPageStore) BatchSetPageParent(updates map[string]string) error {
	if len(updates) == 0 {
		return nil
	}

	now := model.GetMillis()

	// Build a CASE expression: UPDATE Pages SET ParentId = CASE Id WHEN '...' THEN '...' ... END
	ids := make([]string, 0, len(updates))
	var caseBuilder strings.Builder
	caseBuilder.WriteString("CASE Id")
	args := []any{}
	for pageID, parentID := range updates {
		caseBuilder.WriteString(" WHEN ? THEN ?")
		args = append(args, pageID, parentID)
		ids = append(ids, pageID)
	}
	caseBuilder.WriteString(" ELSE ParentId END")
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
		"UPDATE Pages SET ParentId = %s, UpdateAt = ? WHERE %s AND DeleteAt = 0",
		caseExpr, inClause,
	)

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrap(err, "failed to batch update page parents")
	}
	return nil
}
