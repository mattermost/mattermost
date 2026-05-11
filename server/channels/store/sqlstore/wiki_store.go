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
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

func (s *SqlWikiStore) getPagePropertyGroupID() (string, error) {
	var groupID string
	query := s.getQueryBuilder().
		Select("ID").
		From("PropertyGroups").
		Where(sq.Eq{"Name": "pages"}).
		Limit(1)

	if err := s.GetMaster().GetBuilder(&groupID, query); err != nil {
		return "", errors.Wrap(err, "failed to get pages property group")
	}
	return groupID, nil
}

func (s *SqlWikiStore) getWikiPropertyFieldID(groupID string) (string, error) {
	var fieldID string
	query := s.getQueryBuilder().
		Select("ID").
		From("PropertyFields").
		Where(sq.Eq{
			"GroupID":  groupID,
			"Name":     "wiki",
			"DeleteAt": 0,
		}).
		Limit(1)

	if err := s.GetMaster().GetBuilder(&fieldID, query); err != nil {
		return "", errors.Wrap(err, "failed to get wiki property field")
	}
	return fieldID, nil
}

// getWikiPropertyIDs resolves the "pages" PropertyGroup and its "wiki" field
// IDs by direct PK lookup. Both rows are unique-indexed — the cost is two
// trivial DB hits, the same pattern other stores follow when they need to
// reach into property tables. We intentionally do not cache here: the
// PropertyService layer above already caches groups/fields with a proper
// invalidation hook on registration; replicating that with an unsynchronised
// store-local cache produced stale-ID bugs across test resets.
func (s *SqlWikiStore) getWikiPropertyIDs() (string, string, error) {
	gID, err := s.getPagePropertyGroupID()
	if err != nil {
		return "", "", err
	}
	fID, err := s.getWikiPropertyFieldID(gID)
	if err != nil {
		return "", "", err
	}
	return gID, fID, nil
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

func (s *SqlWikiStore) GetPages(wikiId string, offset, limit int) ([]*model.Post, error) {
	if !model.IsValidId(wikiId) {
		return nil, store.NewErrInvalidInput("Wiki", "wikiId", wikiId)
	}

	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return nil, err
	}

	var columns []string
	for _, c := range postSliceColumns() {
		columns = append(columns, "p."+c)
	}
	builder := s.getQueryBuilder().
		Select(columns...).
		From("Posts p").
		Join("PropertyValues v ON v.TargetType = 'post' AND v.TargetID = p.Id").
		Where(sq.Eq{
			"v.FieldID":  fieldID,
			"v.GroupID":  groupID,
			"v.DeleteAt": 0,
			"p.Type":     model.PostTypePage,
			"p.DeleteAt": 0,
		}).
		Where("v.Value = to_jsonb(?::text)", wikiId).
		OrderBy("p.CreateAt ASC, p.Id ASC").
		Offset(uint64(offset))

	if limit > 0 {
		builder = builder.Limit(uint64(limit))
	}

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_get_wiki_pages")
	}

	return posts, nil
}

func (s *SqlWikiStore) GetPageByTitleInWiki(wikiId, title string) (*model.Post, error) {
	if !model.IsValidId(wikiId) {
		return nil, store.NewErrInvalidInput("Wiki", "wikiId", wikiId)
	}

	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return nil, err
	}

	var columns []string
	for _, c := range postSliceColumns() {
		columns = append(columns, "p."+c)
	}

	builder := s.getQueryBuilder().
		Select(columns...).
		From("Posts p").
		Join("PropertyValues v ON v.TargetType = 'post' AND v.TargetID = p.Id").
		Where(sq.Eq{
			"v.FieldID":  fieldID,
			"v.GroupID":  groupID,
			"v.DeleteAt": 0,
			"p.Type":     model.PostTypePage,
			"p.DeleteAt": 0,
		}).
		Where("v.Value = to_jsonb(?::text)", wikiId).
		Where("LOWER(p.Props->>'title') = LOWER(?)", title).
		Limit(1)

	var post model.Post
	if err := s.GetReplica().GetBuilder(&post, builder); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Post", "title="+title)
		}
		return nil, errors.Wrap(err, "unable_to_get_page_by_title")
	}

	return &post, nil
}

// GetAbandonedPages retrieves empty pages older than cutoff (for cleanup)
func (s *SqlWikiStore) GetAbandonedPages(cutoffTime int64) ([]*model.Post, error) {
	query := s.getQueryBuilder().
		Select(postSliceColumnsWithName("p")...).
		From("Posts p").
		Where(sq.And{
			sq.Eq{"p.Type": model.PostTypePage},
			sq.Eq{"p.Message": ""},
			sq.Lt{"p.UpdateAt": cutoffTime},
			sq.Eq{"p.DeleteAt": 0},
		}).
		OrderBy("p.UpdateAt ASC").
		Limit(100)

	posts := []*model.Post{}
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrap(err, "failed to get abandoned pages")
	}

	return posts, nil
}

func (s *SqlWikiStore) DeleteAllPagesForWiki(wikiId string) error {
	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return err
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		var count int
		countQuery := s.getQueryBuilder().
			Select("COUNT(*)").
			From("Wikis").
			Where(sq.Eq{"Id": wikiId})

		if err := transaction.GetBuilder(&count, countQuery); err != nil {
			return errors.Wrap(err, "failed to check wiki existence")
		}
		if count == 0 {
			return store.NewErrNotFound("Wiki", wikiId)
		}

		deleteAt := model.GetMillis()

		// Find all post IDs linked to this wiki
		var postIDs []string
		propertyQuery := s.getQueryBuilder().
			Select("pv.TargetID").
			From("PropertyValues pv").
			Where(sq.Eq{
				"pv.TargetType": "post",
				"pv.FieldID":    fieldID,
				"pv.GroupID":    groupID,
				"pv.DeleteAt":   0,
			}).
			Where("pv.Value = to_jsonb(?::text)", wikiId)

		if selectErr := transaction.SelectBuilder(&postIDs, propertyQuery); selectErr != nil {
			return errors.Wrap(selectErr, "failed to find posts for wiki")
		}

		// Soft delete posts if any exist, processing in chunks to avoid unbounded IN clauses
		const chunkSize = 1000
		for i := 0; i < len(postIDs); i += chunkSize {
			end := min(i+chunkSize, len(postIDs))
			chunk := postIDs[i:end]

			postsUpdateQuery := s.getQueryBuilder().
				Update("Posts").
				Set("DeleteAt", deleteAt).
				Where(sq.Eq{
					"Id":       chunk,
					"DeleteAt": 0,
				})

			if _, execErr := transaction.ExecBuilder(postsUpdateQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to soft delete posts for wiki")
			}

			propertyValuesUpdateQuery := s.getQueryBuilder().
				Update("PropertyValues").
				Set("DeleteAt", deleteAt).
				Where(sq.Eq{
					"TargetType": "post",
					"TargetID":   chunk,
					"FieldID":    fieldID,
					"GroupID":    groupID,
					"DeleteAt":   0,
				})

			if _, execErr := transaction.ExecBuilder(propertyValuesUpdateQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to soft delete property values for wiki")
			}
		}
		// Delete all page drafts for this wiki (WikiId is stored in Drafts.ChannelId for page drafts)
		pageDraftsDeleteQuery := s.getQueryBuilder().
			Delete("Drafts").
			Where(sq.Eq{"ChannelId": wikiId}).
			Where(sq.Expr("jsonb_exists(Props::jsonb, 'page_id')"))

		if _, execErr := transaction.ExecBuilder(pageDraftsDeleteQuery); execErr != nil {
			return errors.Wrap(execErr, "failed to delete page drafts for wiki")
		}

		return nil
	})
}

func (s *SqlWikiStore) MovePageToWiki(pageId, targetWikiId, targetChannelId string, parentPageId *string) error {
	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return err
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		updateAt := model.GetMillis()

		// Squirrel does not support recursive CTEs; this is the documented escape
		// hatch. MaxPageHierarchyDepth is a compile-time constant interpolated via
		// fmt.Sprintf, never user input. Page IDs and post type pass through
		// parameterized placeholders.
		recursiveCTE := fmt.Sprintf(`
			WITH RECURSIVE page_subtree AS (
				SELECT Id, 1 AS depth FROM Posts WHERE Id = ? AND Type = ? AND DeleteAt = 0
				UNION ALL
				SELECT p.Id, ps.depth + 1 FROM Posts p
				INNER JOIN page_subtree ps ON p.PageParentId = ps.Id
				WHERE p.Type = ? AND p.DeleteAt = 0 AND ps.depth < %d
			)
			SELECT Id FROM page_subtree
		`, MaxPageHierarchyDepth)

		var pageIDs []string
		if selectErr := transaction.Select(&pageIDs, recursiveCTE, pageId, model.PostTypePage, model.PostTypePage); selectErr != nil {
			return errors.Wrap(selectErr, "failed to find page subtree")
		}

		if len(pageIDs) == 0 {
			return store.NewErrNotFound("Page", pageId)
		}

		newParentId := ""
		if parentPageId != nil && *parentPageId != "" {
			newParentId = *parentPageId
		}

		updatePostQuery := s.getQueryBuilder().
			Update("Posts").
			Set("PageParentId", newParentId).
			Set("UpdateAt", updateAt).
			Where(sq.Eq{"Id": pageId, "DeleteAt": 0})

		updatePostSQL, updatePostArgs, buildErr := updatePostQuery.ToSql()
		if buildErr != nil {
			return errors.Wrap(buildErr, "failed to build update page parent query")
		}

		if _, execErr := transaction.Exec(updatePostSQL, updatePostArgs...); execErr != nil {
			return errors.Wrap(execErr, "failed to update page parent")
		}

		valueJSON := []byte(strconv.Quote(targetWikiId))
		if s.IsBinaryParamEnabled() {
			valueJSON = AppendBinaryFlag(valueJSON)
		}

		// Process pageIDs in chunks to avoid unbounded IN clauses
		const chunkSize = 1000
		var totalRowsAffected int64
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateQuery := s.getQueryBuilder().
				Update("PropertyValues").
				Set("Value", valueJSON).
				Set("UpdateAt", updateAt).
				Where(sq.Eq{
					"TargetID":   chunk,
					"TargetType": "post",
					"FieldID":    fieldID,
					"GroupID":    groupID,
					"DeleteAt":   0,
				})

			result, execErr := transaction.ExecBuilder(updateQuery)
			if execErr != nil {
				return errors.Wrap(execErr, "failed to update property values for page subtree")
			}

			rows, rowsErr := result.RowsAffected()
			if rowsErr != nil {
				return errors.Wrap(rowsErr, "failed to get rows affected")
			}
			totalRowsAffected += rows
		}

		if int(totalRowsAffected) < len(pageIDs) {
			missingCount := len(pageIDs) - int(totalRowsAffected)
			mlog.Warn("Some pages in subtree missing wiki PropertyValues, creating them",
				mlog.Int("missing_count", missingCount),
				mlog.String("page_id", pageId))

			for i := 0; i < len(pageIDs); i += chunkSize {
				end := min(i+chunkSize, len(pageIDs))
				chunk := pageIDs[i:end]

				insertBuilder := s.getQueryBuilder().
					Insert("PropertyValues").
					Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt")

				for _, pid := range chunk {
					insertBuilder = insertBuilder.Values(model.NewId(), pid, "post", groupID, fieldID, valueJSON, updateAt, updateAt, 0)
				}

				insertBuilder = insertBuilder.SuffixExpr(sq.Expr("ON CONFLICT (GroupID, TargetID, FieldID) WHERE DeleteAt = 0 DO NOTHING"))

				if _, insertErr := transaction.ExecBuilder(insertBuilder); insertErr != nil {
					return errors.Wrap(insertErr, "failed to create property values for orphaned pages")
				}
			}
		}

		// Update wiki_id in Post.Props for all pages in subtree (optimization for fast lookup)
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updatePostPropsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?)", jsonKeyPath("wiki_id"), jsonStringVal(targetWikiId))).
				Set("UpdateAt", updateAt).
				Where(sq.Eq{"Id": chunk, "DeleteAt": 0})

			if targetChannelId != "" {
				updatePostPropsQuery = updatePostPropsQuery.Set("ChannelId", targetChannelId)
			}

			if _, propsErr := transaction.ExecBuilder(updatePostPropsQuery); propsErr != nil {
				return errors.Wrap(propsErr, "failed to update wiki_id in Post.Props for page subtree")
			}
		}

		// Update wiki_id in Props for top-level comments (comments where RootId is a page in the subtree)
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateTopLevelCommentsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?)", jsonKeyPath("wiki_id"), jsonStringVal(targetWikiId))).
				Set("UpdateAt", updateAt).
				Where(sq.Eq{
					"Type":     model.PostTypePageComment,
					"RootId":   chunk,
					"DeleteAt": 0,
				})

			if targetChannelId != "" {
				updateTopLevelCommentsQuery = updateTopLevelCommentsQuery.Set("ChannelId", targetChannelId)
			}

			if _, commentsErr := transaction.ExecBuilder(updateTopLevelCommentsQuery); commentsErr != nil {
				return errors.Wrap(commentsErr, "failed to update wiki_id in Props for top-level comments")
			}
		}

		// Update wiki_id in Props for inline comments (RootId is empty, page_id is in Props)
		for i := 0; i < len(pageIDs); i += chunkSize {
			end := min(i+chunkSize, len(pageIDs))
			chunk := pageIDs[i:end]

			updateInlineCommentsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?)", jsonKeyPath("wiki_id"), jsonStringVal(targetWikiId))).
				Set("UpdateAt", updateAt).
				Where(sq.Eq{
					"Type":     model.PostTypePageComment,
					"RootId":   "",
					"DeleteAt": 0,
				}).
				Where(sq.Expr("Props->>'page_id' = ANY(?)", pq.Array(chunk)))

			if targetChannelId != "" {
				updateInlineCommentsQuery = updateInlineCommentsQuery.Set("ChannelId", targetChannelId)
			}

			if _, inlineErr := transaction.ExecBuilder(updateInlineCommentsQuery); inlineErr != nil {
				return errors.Wrap(inlineErr, "failed to update wiki_id in Props for inline comments")
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
		Join("WikiLinks cml ON cml.DestinationId = w.ChannelId").
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

	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get wiki property IDs for export")
	}

	// Wiki-page association is stored in PropertyValues, not in Post.Props.
	// Join on PropertyValues to find pages belonging to the given wiki.
	// Note: Page title is stored in Props->>'title', not in Message column
	// Note: Content is stored in Post.Message (TipTap JSON)
	// Note: pp is the parent post, used to get parent's import_source_id for hierarchy export
	query := s.getQueryBuilder().
		Select(
			`p.Id AS "Id"`, `t.Name AS "TeamName"`, `c.Name AS "ChannelName"`, `u.Username AS "Username"`,
			`COALESCE(p.Props->>'title', '') AS "Title"`, `COALESCE(p.Message, '') AS "Content"`,
			`COALESCE(p.Props->>'page_parent_id', '') AS "PageParentId"`,
			// For parent's import_source_id: use the parent's import_source_id if it was imported, otherwise use its page ID
			`COALESCE(pp.Props->>'import_source_id', pp.Id, '') AS "ParentImportSourceId"`,
			`p.Props AS "Props"`, `p.CreateAt AS "CreateAt"`, `p.UpdateAt AS "UpdateAt"`, `p.FileIds AS "FileIds"`,
		).
		From("Posts p").
		Join("PropertyValues v ON v.TargetType = 'post' AND v.TargetID = p.Id").
		Join("Channels c ON p.ChannelId = c.Id").
		Join("Teams t ON c.TeamId = t.Id").
		Join("Users u ON p.UserId = u.Id").
		LeftJoin("Posts pp ON p.Props->>'page_parent_id' = pp.Id").
		Where(sq.Eq{
			"v.FieldID":  fieldID,
			"v.GroupID":  groupID,
			"v.DeleteAt": 0,
			"p.Type":     model.PostTypePage,
			"p.DeleteAt": 0,
		}).
		Where("v.Value = to_jsonb(?::text)", wikiId).
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
