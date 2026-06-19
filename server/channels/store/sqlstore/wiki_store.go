// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	maxLinkedWikisPerChannel = model.MaxLinkedWikisPerChannel

	// maxCommentsPerPageExport caps the number of comments exported per page.
	maxCommentsPerPageExport = 10000

	// maxWikisAllChannels caps GetForChannel when no channelId filter is applied.
	maxWikisAllChannels = 10000
)

type SqlWikiStore struct {
	*SqlStore
	tableSelectQuery sq.SelectBuilder
}

func newSqlWikiStore(sqlStore *SqlStore) store.WikiStore {
	s := &SqlWikiStore{SqlStore: sqlStore}

	s.tableSelectQuery = s.getQueryBuilder().
		Select("Id", "ChannelId", "TeamId", "CreatorId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt", "SortOrder").
		From("Wikis")

	return s
}

func (s *SqlWikiStore) Save(wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(wiki.GetProps())

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "TeamId", "CreatorId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt", "SortOrder").
		Values(wiki.Id, wiki.ChannelId, wiki.TeamId, wiki.CreatorId, wiki.Title, wiki.Description, wiki.Icon, propsJSON, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt, wiki.SortOrder)

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_save_wiki")
	}

	return wiki, nil
}

// Create atomically inserts the wiki row, its backing channel, the creator's
// channel membership, a join history entry, and (if defaultDraft != nil) a
// default page draft — all within a single database transaction. The caller is
// responsible for constructing and pre-validating the inputs (see app.CreateWiki
// which does PreSave/IsValid for channel, wiki, and member). Wiki backing
// channels are internal-only (ChannelTypeWiki) and bypass a.CreateChannel() to
// avoid firing the ChannelHasBeenCreated plugin hook.
func (s *SqlWikiStore) Create(rctx request.CTX, wiki *model.Wiki, backingChannel *model.Channel, creatorMember *model.ChannelMember, defaultDraft *model.Draft) (*model.Wiki, error) {
	wikiPropsJSON := model.StringInterfaceToJSON(wiki.GetProps())

	var savedWiki *model.Wiki
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Step 1: insert backing channel.
		channelInsert := s.getQueryBuilder().
			Insert("Channels").
			Columns(channelSliceColumns(false)...).
			Values(channelToSlice(backingChannel)...)
		if _, execErr := transaction.ExecBuilder(channelInsert); execErr != nil {
			return errors.Wrap(execErr, "save_backing_channel")
		}

		// Step 2: insert wiki row.
		wikiInsert := s.getQueryBuilder().
			Insert("Wikis").
			Columns("Id", "ChannelId", "TeamId", "CreatorId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt", "SortOrder").
			Values(wiki.Id, wiki.ChannelId, wiki.TeamId, wiki.CreatorId, wiki.Title, wiki.Description, wiki.Icon, wikiPropsJSON, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt, wiki.SortOrder)
		if _, execErr := transaction.ExecBuilder(wikiInsert); execErr != nil {
			return errors.Wrap(execErr, "save_wiki")
		}
		savedWiki = wiki

		if creatorMember == nil {
			return nil
		}

		// Step 3: insert creator as channel admin member.
		memberInsert := s.getQueryBuilder().
			Insert("ChannelMembers").
			Columns(channelMemberSliceColumns()...).
			Values(channelMemberToSlice(creatorMember)...)
		if _, execErr := transaction.ExecBuilder(memberInsert); execErr != nil {
			if IsUniqueConstraintError(execErr, []string{"ChannelId", "channelmembers_pkey", "PRIMARY"}) {
				return store.NewErrConflict("ChannelMembers", execErr, "")
			}
			return errors.Wrap(execErr, "save_channel_member")
		}

		// Step 4: log join history entry.
		historyInsert := s.getQueryBuilder().
			Insert("ChannelMemberHistory").
			Columns("UserId", "ChannelId", "JoinTime").
			Values(creatorMember.UserId, backingChannel.Id, model.GetMillis())
		if _, execErr := transaction.ExecBuilder(historyInsert); execErr != nil {
			return errors.Wrap(execErr, "log_join_event")
		}

		if defaultDraft == nil {
			return nil
		}

		// Step 5: insert default page draft. Reuse draftSliceColumns/draftToSlice
		// so the JSON-serializable fields (Props, FileIds, Priority) are encoded
		// the same way as DraftStore writes them.
		draftInsert := s.getQueryBuilder().
			Insert("Drafts").
			Columns(draftSliceColumns()...).
			Values(draftToSlice(defaultDraft)...)
		if _, execErr := transaction.ExecBuilder(draftInsert); execErr != nil {
			return errors.Wrap(execErr, "create_default_draft")
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return savedWiki, nil
}

func (s *SqlWikiStore) Get(id string) (*model.Wiki, error) {
	var wiki model.Wiki
	builder := s.tableSelectQuery.Where(sq.Eq{"Id": id, "DeleteAt": 0})

	if err := s.GetReplica().GetBuilder(&wiki, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Wiki", id)
		}
		return nil, errors.Wrap(err, "unable_to_get_wiki")
	}
	return &wiki, nil
}

func (s *SqlWikiStore) GetForChannel(channelId string, includeDeleted bool) ([]*model.Wiki, error) {
	builder := s.tableSelectQuery

	// Only filter by channelId if it's provided (empty string means "all channels")
	if channelId != "" {
		builder = builder.Where(sq.Eq{"ChannelId": channelId})
	} else {
		builder = builder.Limit(maxWikisAllChannels)
	}

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	builder = builder.OrderBy("SortOrder ASC", "CreateAt DESC")

	wikis := []*model.Wiki{}
	if err := s.GetReplica().SelectBuilder(&wikis, builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_get_wikis_for_channel")
	}
	return wikis, nil
}

func (s *SqlWikiStore) GetForChannels(channelIds []string, includeDeleted bool) ([]*model.Wiki, error) {
	if len(channelIds) == 0 {
		return []*model.Wiki{}, nil
	}

	for _, id := range channelIds {
		if !model.IsValidId(id) {
			return nil, store.NewErrInvalidInput("Wiki", "channelId", id)
		}
	}

	builder := s.tableSelectQuery.Where(sq.Eq{"ChannelId": channelIds})

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	builder = builder.OrderBy("SortOrder ASC", "CreateAt DESC")

	wikis := []*model.Wiki{}
	if err := s.GetReplica().SelectBuilder(&wikis, builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_get_wikis_for_channels")
	}
	return wikis, nil
}

func (s *SqlWikiStore) Update(wiki *model.Wiki) (*model.Wiki, error) {
	var existing model.Wiki
	builder := s.tableSelectQuery.Where(sq.Eq{"Id": wiki.Id, "DeleteAt": 0})
	if err := s.GetMaster().GetBuilder(&existing, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Wiki", wiki.Id)
		}
		return nil, errors.Wrap(err, "failed to get wiki for update")
	}

	oldUpdateAt := existing.UpdateAt

	existing.Title = wiki.Title
	existing.Description = wiki.Description
	existing.Icon = wiki.Icon
	existing.Props = wiki.Props

	existing.PreUpdate()
	if err := existing.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(existing.GetProps())

	updateBuilder := s.getQueryBuilder().
		Update("Wikis").
		Set("Title", existing.Title).
		Set("Description", existing.Description).
		Set("Icon", existing.Icon).
		Set("Props", propsJSON).
		Set("UpdateAt", existing.UpdateAt).
		Where(sq.Eq{"Id": existing.Id, "DeleteAt": 0, "UpdateAt": oldUpdateAt})

	result, err := s.GetMaster().ExecBuilder(updateBuilder)
	if err != nil {
		return nil, errors.Wrap(err, "unable_to_update_wiki")
	}

	rowsAffected, raErr := result.RowsAffected()
	if raErr != nil {
		return nil, errors.Wrap(raErr, "failed to get rows affected")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrConflict("Wiki", nil, "id="+existing.Id)
	}

	return &existing, nil
}

func (s *SqlWikiStore) Delete(id string, hard bool) error {
	if hard {
		deleteBuilder := s.getQueryBuilder().
			Delete("Wikis").
			Where(sq.Eq{"Id": id})

		result, err := s.GetMaster().ExecBuilder(deleteBuilder)
		if err != nil {
			return errors.Wrap(err, "unable_to_delete_wiki")
		}

		return s.checkRowsAffected(result, "Wiki", id)
	}

	query := s.buildSoftDeleteQuery("Wikis", "Id", id, false)

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrap(err, "unable_to_delete_wiki")
	}

	return s.checkRowsAffected(result, "Wiki", id)
}

// DeleteWikiCascade atomically removes all page data for a wiki in a single transaction.
// Step ordering: (0) soft-delete/lock the Wikis row first so no new page can be created
// mid-cascade; (1) collect page IDs including already-soft-deleted rows so their snapshots
// are purged; (2) soft-delete Pages rows + their page_comment Posts + Threads; (3) delete
// PageReactions, FileInfo (scoped to pageIds, not channelId), and Drafts; (4) delete
// version-snapshot rows (WHERE OriginalId IN pageIds).
func (s *SqlWikiStore) DeleteWikiCascade(wikiId string) error {
	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		// Step 0: soft-delete/lock the Wikis row to prevent new pages being created mid-cascade.
		now := model.GetMillis()
		lockWikiQuery := s.getQueryBuilder().
			Update("Wikis").
			Set("DeleteAt", now).
			Where(sq.And{
				sq.Eq{"Id": wikiId},
				sq.Eq{"DeleteAt": 0},
			})
		result, err := transaction.ExecBuilder(lockWikiQuery)
		if err != nil {
			return errors.Wrap(err, "failed to soft-delete wiki for cascade")
		}
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "failed to get rows affected for wiki lock")
		}
		if rowsAffected == 0 {
			// Wiki already deleted or does not exist — check which.
			var count int
			checkQuery := s.getQueryBuilder().
				Select("COUNT(*)").
				From("Wikis").
				Where(sq.Eq{"Id": wikiId})
			if cntErr := transaction.GetBuilder(&count, checkQuery); cntErr != nil {
				return errors.Wrap(cntErr, "failed to check wiki existence")
			}
			if count == 0 {
				return store.NewErrNotFound("Wiki", wikiId)
			}
			// Already soft-deleted — still proceed to cascade orphan cleanup.
		}

		// Step 1: collect page IDs (live + already-soft-deleted) so their snapshots are purged.
		var pageIDs []string
		pageIDsQuery := s.getQueryBuilder().
			Select("Id").
			From("Pages").
			Where(sq.And{
				sq.Eq{"WikiId": wikiId},
				sq.Eq{"OriginalId": ""},
			})
		if selectErr := transaction.SelectBuilder(&pageIDs, pageIDsQuery); selectErr != nil {
			return errors.Wrap(selectErr, "failed to collect page IDs for wiki cascade")
		}

		if len(pageIDs) > 0 {
			const chunkSize = 1000

			// Step 2a: soft-delete live Pages rows.
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				softDeletePagesQuery := s.getQueryBuilder().
					Update("Pages").
					Set("DeleteAt", now).
					Set("UpdateAt", now).
					Where(sq.And{
						sq.Eq{"Id": chunk},
						sq.Eq{"DeleteAt": 0},
					})
				if _, execErr := transaction.ExecBuilder(softDeletePagesQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to soft-delete pages for wiki cascade")
				}
			}

			// Step 2b: soft-delete page_comment Posts for pages in this wiki.
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				softDeleteCommentsQuery := s.getQueryBuilder().
					Update("Posts").
					Set("DeleteAt", now).
					Set("UpdateAt", now).
					Where(sq.And{
						sq.Eq{"Type": model.PostTypePageComment},
						sq.Eq{"DeleteAt": 0},
					}).
					Where(sq.Expr("Props->>'page_id' = ANY(?)", pq.Array(chunk)))
				if _, execErr := transaction.ExecBuilder(softDeleteCommentsQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to soft-delete page comments for wiki cascade")
				}
			}

			// Step 2c: soft-delete Threads for those comment posts.
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				softDeleteThreadsQuery := s.getQueryBuilder().
					Update("Threads").
					Set("ThreadDeleteAt", now).
					Where(sq.Expr(
						"PostId IN (SELECT Id FROM Posts WHERE Props->>'page_id' = ANY(?) AND Type = ?)",
						pq.Array(chunk), model.PostTypePageComment,
					))
				if _, execErr := transaction.ExecBuilder(softDeleteThreadsQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to soft-delete threads for wiki cascade")
				}
			}

			// Step 3a: hard-delete PageReactions for these pages (PageReactions has no DeleteAt).
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				deleteReactionsQuery := s.getQueryBuilder().
					Delete("PageReactions").
					Where(sq.Eq{"PageId": chunk})
				if _, execErr := transaction.ExecBuilder(deleteReactionsQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to delete PageReactions for wiki cascade")
				}
			}

			// Step 3b: hard-delete FileInfo rows owned by these pages (scoped to pageIds,
			// NOT to channelId — FileInfo.ChannelId is the backing channel for all files
			// including comment files, so channel-scoping would wipe non-page files).
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				deleteFileInfoQuery := s.getQueryBuilder().
					Delete("FileInfo").
					Where(sq.Eq{"PageId": chunk})
				if _, execErr := transaction.ExecBuilder(deleteFileInfoQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to delete FileInfo for wiki cascade")
				}
			}

			// Step 3c: delete page Drafts (WikiId stored in Drafts.ChannelId; RootId = pageId).
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				deleteDraftsQuery := s.getQueryBuilder().
					Delete("Drafts").
					Where(sq.Eq{"RootId": chunk})
				if _, execErr := transaction.ExecBuilder(deleteDraftsQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to delete page drafts for wiki cascade")
				}
			}

			// Step 4: hard-delete version-snapshot rows (OriginalId IN pageIds).
			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				deleteSnapshotsQuery := s.getQueryBuilder().
					Delete("Pages").
					Where(sq.Eq{"OriginalId": chunk})
				if _, execErr := transaction.ExecBuilder(deleteSnapshotsQuery); execErr != nil {
					return errors.Wrap(execErr, "failed to delete page snapshots for wiki cascade")
				}
			}
		}

		// Also delete wiki-level Drafts (e.g. default page draft stored with ChannelId=wikiId).
		pageDraftsDeleteQuery := s.getQueryBuilder().
			Delete("Drafts").
			Where(sq.Eq{"ChannelId": wikiId}).
			Where(sq.Expr("jsonb_exists(Props::jsonb, 'page_id')"))
		if _, execErr := transaction.ExecBuilder(pageDraftsDeleteQuery); execErr != nil {
			return errors.Wrap(execErr, "failed to delete wiki-level page drafts for cascade")
		}

		return nil
	})
}

// MovePageToWiki moves a page subtree to a different wiki in a single transaction.
// The recursive CTE runs on the Pages table (not Posts). Both WikiId and ChannelId
// are updated together (FK + denormalized cache) on live rows AND version-snapshot rows
// (WHERE OriginalId IN subtree) so restore lands in the correct wiki. The page-row UPDATE
// touches only WikiId/ChannelId/ParentId — HasEffectiveViewRestriction/HasLocalEditRestriction
// are carried verbatim (no SELECT *-then-rewrite).
func (s *SqlWikiStore) MovePageToWiki(pageId, targetWikiId, targetChannelId string, parentPageId *string) error {
	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		updateAt := model.GetMillis()

		// Squirrel does not support recursive CTEs; use fmt.Sprintf with compile-time
		// constant MaxPageHierarchyDepth. pageId passes through a parameterized placeholder.
		// The CTE now queries Pages (not Posts) and uses ParentId (not PageParentId).
		recursiveCTE := fmt.Sprintf(`
			WITH RECURSIVE page_subtree AS (
				SELECT Id, 1 AS depth FROM Pages WHERE Id = ? AND DeleteAt = 0 AND OriginalId = ''
				UNION ALL
				SELECT p.Id, ps.depth + 1 FROM Pages p
				INNER JOIN page_subtree ps ON p.ParentId = ps.Id
				WHERE p.DeleteAt = 0 AND p.OriginalId = '' AND ps.depth < %d
			)
			SELECT Id FROM page_subtree
		`, MaxPageHierarchyDepth)

		var pageIDs []string
		if selectErr := transaction.Select(&pageIDs, recursiveCTE, pageId); selectErr != nil {
			return errors.Wrap(selectErr, "failed to find page subtree")
		}

		if len(pageIDs) == 0 {
			return store.NewErrNotFound("Page", pageId)
		}

		newParentId := ""
		if parentPageId != nil && *parentPageId != "" {
			newParentId = *parentPageId
		}

		// Update the moved root's ParentId only (targeted column — must NOT touch restriction markers).
		updateRootParentQuery := s.getQueryBuilder().
			Update("Pages").
			Set("ParentId", newParentId).
			Set("UpdateAt", updateAt).
			Where(sq.Eq{"Id": pageId, "DeleteAt": 0, "OriginalId": ""})

		if _, execErr := transaction.ExecBuilder(updateRootParentQuery); execErr != nil {
			return errors.Wrap(execErr, "failed to update page parent")
		}

		const chunkSize = 1000

		// Update WikiId + ChannelId on live page rows in subtree.
		// Targeted SET — does NOT touch HasEffectiveViewRestriction/HasLocalEditRestriction.
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateLivePagesQuery := s.getQueryBuilder().
				Update("Pages").
				Set("WikiId", targetWikiId).
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", updateAt).
				Where(sq.Eq{"Id": chunk, "DeleteAt": 0, "OriginalId": ""})

			if _, execErr := transaction.ExecBuilder(updateLivePagesQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to update WikiId/ChannelId on live pages")
			}
		}

		// Update WikiId + ChannelId on version-snapshot rows (OriginalId IN subtree)
		// so restore lands the page in the new wiki.
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateSnapshotsQuery := s.getQueryBuilder().
				Update("Pages").
				Set("WikiId", targetWikiId).
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", updateAt).
				Where(sq.Eq{"OriginalId": chunk})

			if _, execErr := transaction.ExecBuilder(updateSnapshotsQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to update WikiId/ChannelId on page snapshots")
			}
		}

		// Update ChannelId and wiki_id prop on page_comment Posts (comments stay in Posts).
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateCommentsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", updateAt).
				Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?)", jsonKeyPath("wiki_id"), jsonStringVal(targetWikiId))).
				Where(sq.Eq{
					"Type":     model.PostTypePageComment,
					"DeleteAt": 0,
				}).
				Where(sq.Expr("Props->>'page_id' = ANY(?)", pq.Array(chunk)))

			if _, execErr := transaction.ExecBuilder(updateCommentsQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to update ChannelId and wiki_id on page comments")
			}
		}

		// Update ChannelId on FileInfo rows owned by these pages (FileInfo.PageId).
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateFileInfoQuery := s.getQueryBuilder().
				Update("FileInfo").
				Set("ChannelId", targetChannelId).
				Where(sq.Eq{"PageId": chunk})

			if _, execErr := transaction.ExecBuilder(updateFileInfoQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to update ChannelId on FileInfo for page move")
			}
		}

		// Update Drafts.ChannelId to the new WikiId (page drafts store WikiId in Drafts.ChannelId,
		// NOT the backing channel — page_draft.go:67). Re-key to targetWikiId so the draft
		// follows the page to its new wiki.
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateDraftsQuery := s.getQueryBuilder().
				Update("Drafts").
				Set("ChannelId", targetWikiId).
				Where(sq.Eq{"RootId": chunk})

			if _, execErr := transaction.ExecBuilder(updateDraftsQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to update Drafts.ChannelId for page move")
			}
		}

		return nil
	})
}

func (s *SqlWikiStore) SetWikiIdInPostProps(pageId, wikiId string) error {
	updateQuery := s.getQueryBuilder().
		Update("Posts").
		Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?)", jsonKeyPath("wiki_id"), jsonStringVal(wikiId))).
		Where(sq.Eq{"Id": pageId, "DeleteAt": 0})

	result, err := s.GetMaster().ExecBuilder(updateQuery)
	if err != nil {
		return errors.Wrap(err, "failed to update wiki_id in Post.Props")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("Post", pageId)
	}

	return nil
}

// ResolveNamesToIDs converts wiki names/IDs to wiki IDs.
// Supports both direct wiki IDs and case-insensitive name matching.
// Team scoping is applied when teamId is provided.
func (s *SqlWikiStore) ResolveNamesToIDs(names []string, teamId string) ([]string, error) {
	if len(names) == 0 {
		return []string{}, nil
	}

	// Separate potential IDs from names
	var potentialIDs []string
	var lowerNames []string
	for _, name := range names {
		if model.IsValidId(name) {
			potentialIDs = append(potentialIDs, name)
		}
		lowerNames = append(lowerNames, strings.ToLower(name))
	}

	// Build query to resolve names to IDs
	query := s.getQueryBuilder().
		Select("DISTINCT w.Id").
		From("Wikis w").
		Join("Channels c ON w.ChannelId = c.Id").
		Where(sq.Eq{"w.DeleteAt": 0})

	// Match by ID or by title (case-insensitive)
	var conditions []sq.Sqlizer
	if len(potentialIDs) > 0 {
		conditions = append(conditions, sq.Eq{"w.Id": potentialIDs})
	}
	if len(lowerNames) > 0 {
		conditions = append(conditions, sq.Expr("LOWER(w.Title) IN ("+sq.Placeholders(len(lowerNames))+")", stringSliceToInterface(lowerNames)...))
	}

	if len(conditions) > 0 {
		query = query.Where(sq.Or(conditions))
	}

	// Apply team filter if provided
	if teamId != "" {
		query = query.Where(sq.Eq{"c.TeamId": teamId})
	}

	var wikiIDs []string
	if err := s.GetReplica().SelectBuilder(&wikiIDs, query); err != nil {
		return nil, errors.Wrap(err, "failed to resolve wiki names to IDs")
	}

	return wikiIDs, nil
}

// stringSliceToInterface converts a string slice to an any slice for SQL placeholders.
func stringSliceToInterface(s []string) []any {
	result := make([]any, len(s))
	for i, v := range s {
		result[i] = v
	}
	return result
}

func (s *SqlWikiStore) GetLinkedToChannel(channelId string) ([]*model.Wiki, error) {
	if !model.IsValidId(channelId) {
		return nil, store.NewErrInvalidInput("Wiki", "channelId", channelId)
	}

	builder := s.getQueryBuilder().
		Select("w.Id", "w.ChannelId", "w.TeamId", "w.CreatorId", "w.Title", "w.Description", "w.Icon", "w.Props", "w.CreateAt", "w.UpdateAt", "w.DeleteAt", "w.SortOrder").
		From("Wikis w").
		Join("ChannelMemberLinks cml ON cml.DestinationId = w.ChannelId").
		Where(sq.Eq{
			"cml.SourceId": channelId,
			"w.DeleteAt":   0,
		}).
		OrderBy("w.SortOrder ASC").
		Limit(maxLinkedWikisPerChannel)

	wikis := []*model.Wiki{}
	if err := s.GetReplica().SelectBuilder(&wikis, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get wikis linked to channel")
	}
	return wikis, nil
}

func (s *SqlWikiStore) GetByChannelId(channelId string) (*model.Wiki, error) {
	if !model.IsValidId(channelId) {
		return nil, store.NewErrInvalidInput("Wiki", "channelId", channelId)
	}

	var wiki model.Wiki
	builder := s.tableSelectQuery.Where(sq.Eq{"ChannelId": channelId, "DeleteAt": 0})

	if err := s.GetMaster().GetBuilder(&wiki, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Wiki", "channelId="+channelId)
		}
		return nil, errors.Wrap(err, "failed to get wiki by channel id")
	}
	return &wiki, nil
}

func (s *SqlWikiStore) GetForTeam(teamId string, page, perPage int) ([]*model.Wiki, error) {
	if !model.IsValidId(teamId) {
		return nil, store.NewErrInvalidInput("Wiki", "teamId", teamId)
	}
	if page < 0 || perPage <= 0 {
		return nil, store.NewErrInvalidInput("Wiki", "pagination", "page must be >= 0 and perPage must be > 0")
	}

	builder := s.tableSelectQuery.
		Where(sq.Eq{"TeamId": teamId, "DeleteAt": 0}).
		OrderBy("Title ASC").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage))

	wikis := []*model.Wiki{}
	if err := s.GetReplica().SelectBuilder(&wikis, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get wikis for team")
	}
	return wikis, nil
}

func (s *SqlWikiStore) GetForUser(userId, teamId string, page, perPage int) ([]*model.Wiki, error) {
	if !model.IsValidId(userId) {
		return nil, store.NewErrInvalidInput("Wiki", "userId", userId)
	}
	if !model.IsValidId(teamId) {
		return nil, store.NewErrInvalidInput("Wiki", "teamId", teamId)
	}
	if page < 0 || perPage <= 0 {
		return nil, store.NewErrInvalidInput("Wiki", "pagination", "page must be >= 0 and perPage must be > 0")
	}

	channelMemberSubq := sq.Expr("EXISTS (SELECT 1 FROM ChannelMembers cm WHERE cm.ChannelId = w.ChannelId AND cm.UserId = ?)", userId)

	query, args, err := s.getQueryBuilder().
		Select("w.Id", "w.ChannelId", "w.TeamId", "w.CreatorId", "w.Title", "w.Description", "w.Icon", "w.Props", "w.CreateAt", "w.UpdateAt", "w.DeleteAt", "w.SortOrder").
		From("Wikis w").
		Where(sq.Eq{"w.TeamId": teamId, "w.DeleteAt": 0}).
		Where(channelMemberSubq).
		OrderBy("w.Title ASC").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage)).
		ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query for wikis for user")
	}

	// Note: Uses replica for read scalability. After link creation (which writes to
	// ChannelMembers), the replica may not yet reflect the new membership, causing
	// newly-linked wikis to be temporarily absent. This is an acceptable HA trade-off;
	// the next fetch will return correct results.
	wikis := []*model.Wiki{}
	if err := s.GetReplica().Select(&wikis, query, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get wikis for user")
	}
	return wikis, nil
}

// GetWikisForExport returns wikis in a channel with team/channel names for export
func (s *SqlWikiStore) GetWikisForExport(channelId string) ([]*model.WikiForExport, error) {
	if !model.IsValidId(channelId) {
		return nil, store.NewErrInvalidInput("Wiki", "channelId", channelId)
	}

	query := s.getQueryBuilder().
		Select(
			"w.Id", "w.ChannelId", "w.Title", "w.Description", "w.Icon", "w.Props",
			"w.CreateAt", "w.UpdateAt", "w.DeleteAt", "w.SortOrder",
			`t.Name AS "TeamName"`, `c.Name AS "ChannelName"`,
		).
		From("Wikis w").
		Join("Channels c ON w.ChannelId = c.Id").
		Join("Teams t ON c.TeamId = t.Id").
		Where(sq.Eq{"w.ChannelId": channelId}).
		Where(sq.Eq{"w.DeleteAt": 0}).
		OrderBy("w.SortOrder ASC")

	var wikis []*model.WikiForExport
	if err := s.GetReplica().SelectBuilder(&wikis, query); err != nil {
		return nil, errors.Wrap(err, "failed to get wikis for export")
	}

	return wikis, nil
}

// GetPagesForExport returns pages for a wiki with content and user info for export.
// Uses cursor-based pagination - pass empty afterId for first page.
func (s *SqlWikiStore) GetPagesForExport(wikiId string, limit int, afterId string) ([]*model.PageForExport, error) {
	if !model.IsValidId(wikiId) {
		return nil, store.NewErrInvalidInput("Page", "wikiId", wikiId)
	}
	if limit <= 0 {
		return nil, store.NewErrInvalidInput("Page", "limit", strconv.Itoa(limit))
	}
	if afterId != "" && !model.IsValidId(afterId) {
		return nil, store.NewErrInvalidInput("Page", "afterId", afterId)
	}

	// Note: pp is the parent page, used to get the parent's import_source_id for hierarchy export.
	// Note: FileIds is derived from FileInfo.PageId (page attachments carry PageId, not a FileIds
	// column); the exporter only checks whether it is non-empty before loading the actual files.
	query := s.getQueryBuilder().
		Select(
			`p.Id AS "Id"`, `t.Name AS "TeamName"`, `c.Name AS "ChannelName"`, `u.Username AS "Username"`,
			`COALESCE(p.Title, '') AS "Title"`, `COALESCE(p.Body, '') AS "Content"`,
			`COALESCE(p.ParentId, '') AS "PageParentId"`,
			// For parent's import_source_id: use the parent's import_source_id if it was imported, otherwise use its page ID
			`COALESCE(pp.Props->>'import_source_id', pp.Id, '') AS "ParentImportSourceId"`,
			`p.Props AS "Props"`, `p.CreateAt AS "CreateAt"`, `p.UpdateAt AS "UpdateAt"`,
			`COALESCE((SELECT string_agg(fi.Id, ',') FROM FileInfo fi WHERE fi.PageId = p.Id AND fi.DeleteAt = 0), '') AS "FileIds"`,
		).
		From("Pages p").
		Join("Channels c ON p.ChannelId = c.Id").
		Join("Teams t ON c.TeamId = t.Id").
		Join("Users u ON p.UserId = u.Id").
		LeftJoin("Pages pp ON p.ParentId = pp.Id").
		Where(sq.Eq{
			"p.WikiId":     wikiId,
			"p.Type":       model.PostTypePage,
			"p.DeleteAt":   0,
			"p.OriginalId": "",
		}).
		OrderBy("p.Id ASC").
		Limit(uint64(limit))

	if afterId != "" {
		query = query.Where(sq.Gt{"p.Id": afterId})
	}

	var pages []*model.PageForExport
	if err := s.GetReplica().SelectBuilder(&pages, query); err != nil {
		return nil, errors.Wrap(err, "failed to query pages for export")
	}

	return pages, nil
}

// GetPageCommentsForExport returns comments for a page with user info for export.
// Hard-capped at maxCommentsPerPageExport; pages with more comments will have their
// oldest comments silently dropped. Cursor pagination is not yet supported here.
func (s *SqlWikiStore) GetPageCommentsForExport(pageId string) ([]*model.PageCommentForExport, error) {
	if !model.IsValidId(pageId) {
		return nil, store.NewErrInvalidInput("PageComment", "pageId", pageId)
	}

	// Note: ParentCommentId is stored in Props->>'parent_comment_id', not in a ParentId column
	// Use quoted column aliases to match struct db tags exactly (PostgreSQL lowercases unquoted identifiers)
	query := s.getQueryBuilder().
		Select(
			`p.Id AS "Id"`, `t.Name AS "TeamName"`, `c.Name AS "ChannelName"`, `u.Username AS "Username"`,
			`p.Message AS "Content"`, `p.RootId AS "PageId"`,
			`COALESCE(p.Props->>'parent_comment_id', '') AS "ParentCommentId"`,
			`p.Props AS "Props"`, `p.CreateAt AS "CreateAt"`,
		).
		From("Posts p").
		Join("Channels c ON p.ChannelId = c.Id").
		Join("Teams t ON c.TeamId = t.Id").
		Join("Users u ON p.UserId = u.Id").
		Where(sq.Expr("p.Props->>'page_id' = ?", pageId)).
		Where(sq.Eq{"p.Type": model.PostTypePageComment}).
		Where(sq.Eq{"p.DeleteAt": 0}).
		OrderBy("p.CreateAt ASC").
		Limit(maxCommentsPerPageExport)

	var comments []*model.PageCommentForExport
	if err := s.GetReplica().SelectBuilder(&comments, query); err != nil {
		return nil, errors.Wrap(err, "failed to query page comments for export")
	}

	return comments, nil
}
