// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/lib/pq"
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlWikiStore struct {
	*SqlStore
	tableSelectQuery sq.SelectBuilder
}

func newSqlWikiStore(sqlStore *SqlStore) store.WikiStore {
	s := &SqlWikiStore{SqlStore: sqlStore}

	s.tableSelectQuery = s.getQueryBuilder().
		Select("Id", "ChannelId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt").
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

	if err := s.GetReplica().GetBuilder(&groupID, query); err != nil {
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

	if err := s.GetReplica().GetBuilder(&fieldID, query); err != nil {
		return "", errors.Wrap(err, "failed to get wiki property field")
	}
	return fieldID, nil
}

func (s *SqlWikiStore) Save(wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(wiki.GetProps())

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt").
		Values(wiki.Id, wiki.ChannelId, wiki.Title, wiki.Description, wiki.Icon, propsJSON, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt)

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_save_wiki")
	}

	return wiki, nil
}

// CreateWikiWithDefaultPage creates a wiki and its default draft page in a single transaction
func (s *SqlWikiStore) CreateWikiWithDefaultPage(wiki *model.Wiki, userId string) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	var err error
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	savedWiki, err := s.SaveWikiT(transaction, wiki)
	if err != nil {
		return nil, errors.Wrap(err, "save_wiki")
	}

	draftId := model.NewId()
	now := model.GetMillis()

	contentJSON := `{"type":"doc","content":[]}`

	// Insert into PageDraftContents table (content only)
	contentBuilder := s.getQueryBuilder().
		Insert("PageDraftContents").
		Columns("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		Values(userId, savedWiki.Id, draftId, "Untitled page", contentJSON, now, now)

	if _, err = transaction.ExecBuilder(contentBuilder); err != nil {
		return nil, errors.Wrap(err, "create_default_draft_content")
	}

	// Insert into Drafts table (metadata) - page drafts store WikiId in ChannelId field
	draftBuilder := s.getQueryBuilder().
		Insert("Drafts").
		Columns("CreateAt", "UpdateAt", "DeleteAt", "UserId", "ChannelId", "RootId", "WikiId", "Message", "Props", "FileIds").
		Values(now, now, 0, userId, savedWiki.Id, draftId, savedWiki.Id, "", "{}", "[]")

	if _, err = transaction.ExecBuilder(draftBuilder); err != nil {
		return nil, errors.Wrap(err, "create_default_draft_metadata")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
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
	builder := s.tableSelectQuery.Where(sq.Eq{"ChannelId": channelId})

	if !includeDeleted {
		builder = builder.Where(sq.Eq{"DeleteAt": 0})
	}

	builder = builder.OrderBy("CreateAt DESC")

	wikis := []*model.Wiki{}
	if err := s.GetReplica().SelectBuilder(&wikis, builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_get_wikis_for_channel")
	}
	return wikis, nil
}

func (s *SqlWikiStore) Update(wiki *model.Wiki) (*model.Wiki, error) {
	existing, err := s.Get(wiki.Id)
	if err != nil {
		return nil, err
	}

	existing.Title = wiki.Title
	existing.Description = wiki.Description
	existing.Icon = wiki.Icon
	existing.Props = wiki.Props

	existing.PreUpdate()
	if err := existing.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(existing.GetProps())

	builder := s.getQueryBuilder().
		Update("Wikis").
		Set("Title", existing.Title).
		Set("Description", existing.Description).
		Set("Icon", existing.Icon).
		Set("Props", propsJSON).
		Set("UpdateAt", existing.UpdateAt).
		Where(sq.Eq{"Id": existing.Id, "DeleteAt": 0})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return nil, errors.Wrap(err, "unable_to_update_wiki")
	}

	if err := s.checkRowsAffected(result, "Wiki", existing.Id); err != nil {
		return nil, err
	}

	return existing, nil
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
	groupID, err := s.getPagePropertyGroupID()
	if err != nil {
		return nil, err
	}

	fieldID, err := s.getWikiPropertyFieldID(groupID)
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

	// Debug logging
	for _, p := range posts {
		title := p.GetPageTitle()
		mlog.Debug("GetPages loaded post from DB", mlog.String("post_id", p.Id), mlog.String("page_parent_id", p.PageParentId), mlog.String("title", title))
	}

	return posts, nil
}

func (s *SqlWikiStore) GetPageByTitleInWiki(wikiId, title string) (*model.Post, error) {
	groupID, err := s.getPagePropertyGroupID()
	if err != nil {
		return nil, err
	}

	fieldID, err := s.getWikiPropertyFieldID(groupID)
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

// SaveWikiT saves a wiki within an existing transaction
func (s *SqlWikiStore) SaveWikiT(transaction *sqlxTxWrapper, wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(wiki.GetProps())

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt").
		Values(wiki.Id, wiki.ChannelId, wiki.Title, wiki.Description, wiki.Icon, propsJSON, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt)

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_save_wiki")
	}

	return wiki, nil
}

// SavePostT saves a post within an existing transaction
func (s *SqlWikiStore) SavePostT(transaction *sqlxTxWrapper, post *model.Post) (*model.Post, error) {
	post.PreSave()
	maxPostSize := s.Post().GetMaxPostSize()

	if err := post.IsValid(maxPostSize); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().Insert("Posts").Columns(postSliceColumns()...)
	builder = builder.Values(postToSlice(post)...)

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "failed to save Post")
	}

	return post, nil
}

// SavePropertyValueT saves a PropertyValue within an existing transaction
func (s *SqlWikiStore) SavePropertyValueT(transaction *sqlxTxWrapper, pv *model.PropertyValue) (*model.PropertyValue, error) {
	pv.PreSave()

	if err := pv.IsValid(); err != nil {
		return nil, errors.Wrap(err, "property_value_create_isvalid")
	}

	valueJSON := pv.Value
	if s.IsBinaryParamEnabled() {
		valueJSON = AppendBinaryFlag(valueJSON)
	}

	builder := s.getQueryBuilder().
		Insert("PropertyValues").
		Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt").
		Values(pv.ID, pv.TargetID, pv.TargetType, pv.GroupID, pv.FieldID, valueJSON, pv.CreateAt, pv.UpdateAt, pv.DeleteAt)

	if _, err := transaction.ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_save_property_value")
	}

	return pv, nil
}

// GetAbandonedPages retrieves empty pages older than cutoff (for cleanup)
func (s *SqlWikiStore) GetAbandonedPages(cutoffTime int64) ([]*model.Post, error) {
	query := s.getQueryBuilder().
		Select("p.*").
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
	groupID, err := s.getPagePropertyGroupID()
	if err != nil {
		return err
	}

	fieldID, err := s.getWikiPropertyFieldID(groupID)
	if err != nil {
		return err
	}

	deleteAt := model.GetMillis()

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

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

	if err = transaction.SelectBuilder(&postIDs, propertyQuery); err != nil {
		return errors.Wrap(err, "failed to find posts for wiki")
	}

	// Soft delete posts if any exist
	if len(postIDs) > 0 {
		postsUpdateQuery := s.getQueryBuilder().
			Update("Posts").
			Set("DeleteAt", deleteAt).
			Where(sq.Eq{
				"Id":       postIDs,
				"DeleteAt": 0,
			})

		if _, err = transaction.ExecBuilder(postsUpdateQuery); err != nil {
			return errors.Wrap(err, "failed to soft delete posts for wiki")
		}

		// Soft delete property values
		propertyValuesUpdateQuery := s.getQueryBuilder().
			Update("PropertyValues").
			Set("DeleteAt", deleteAt).
			Where(sq.Eq{
				"TargetType": "post",
				"TargetID":   postIDs,
				"FieldID":    fieldID,
				"GroupID":    groupID,
				"DeleteAt":   0,
			})

		if _, err = transaction.ExecBuilder(propertyValuesUpdateQuery); err != nil {
			return errors.Wrap(err, "failed to soft delete property values for wiki")
		}

		// Soft delete page contents
		pageContentsUpdateQuery := s.getQueryBuilder().
			Update("PageContents").
			Set("DeleteAt", deleteAt).
			Where(sq.Eq{
				"PageId":   postIDs,
				"DeleteAt": 0,
			})

		if _, err = transaction.ExecBuilder(pageContentsUpdateQuery); err != nil {
			return errors.Wrap(err, "failed to soft delete page contents for wiki")
		}
	}

	// Delete page draft contents associated with this wiki
	pageDraftContentsDeleteQuery := s.getQueryBuilder().
		Delete("PageDraftContents").
		Where(sq.Eq{"WikiId": wikiId})

	if _, err = transaction.ExecBuilder(pageDraftContentsDeleteQuery); err != nil {
		return errors.Wrap(err, "failed to delete page draft contents for wiki")
	}

	// Delete page draft metadata from Drafts table
	draftsDeleteQuery := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{"WikiId": wikiId})

	if _, err = transaction.ExecBuilder(draftsDeleteQuery); err != nil {
		return errors.Wrap(err, "failed to delete page draft metadata for wiki")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlWikiStore) MovePageToWiki(pageId, targetWikiId string, parentPageId *string) error {
	groupID, err := s.getPagePropertyGroupID()
	if err != nil {
		return err
	}

	fieldID, err := s.getWikiPropertyFieldID(groupID)
	if err != nil {
		return err
	}

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	updateAt := model.GetMillis()

	recursiveCTE := `
		WITH RECURSIVE page_subtree AS (
			SELECT Id FROM Posts WHERE Id = ? AND Type = ? AND DeleteAt = 0
			UNION ALL
			SELECT p.Id FROM Posts p
			INNER JOIN page_subtree ps ON p.PageParentId = ps.Id
			WHERE p.Type = ? AND p.DeleteAt = 0
		)
		SELECT Id FROM page_subtree
	`

	var pageIDs []string
	if err = transaction.Select(&pageIDs, recursiveCTE, pageId, model.PostTypePage, model.PostTypePage); err != nil {
		return errors.Wrap(err, "failed to find page subtree")
	}

	if len(pageIDs) == 0 {
		return store.NewErrNotFound("Page", pageId)
	}

	newParentId := ""
	if parentPageId != nil && *parentPageId != "" {
		newParentId = *parentPageId
	}

	updatePostQuery := `
		UPDATE Posts
		SET PageParentId = ?, UpdateAt = ?
		WHERE Id = ? AND DeleteAt = 0
	`

	if _, err = transaction.Exec(updatePostQuery, newParentId, updateAt, pageId); err != nil {
		return errors.Wrap(err, "failed to update page parent")
	}

	valueJSON := []byte(`"` + targetWikiId + `"`)
	if s.IsBinaryParamEnabled() {
		valueJSON = AppendBinaryFlag(valueJSON)
	}

	updateQuery := `
		UPDATE PropertyValues
		SET Value = ?, UpdateAt = ?
		WHERE TargetID = ANY(?)
		  AND TargetType = 'post'
		  AND FieldID = ?
		  AND GroupID = ?
		  AND DeleteAt = 0
	`

	result, err := transaction.Exec(updateQuery, valueJSON, updateAt, pq.Array(pageIDs), fieldID, groupID)
	if err != nil {
		return errors.Wrap(err, "failed to update property values for page subtree")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if int(rowsAffected) < len(pageIDs) {
		missingCount := len(pageIDs) - int(rowsAffected)
		mlog.Warn("Some pages in subtree missing wiki PropertyValues, creating them",
			mlog.Int("missing_count", missingCount),
			mlog.String("page_id", pageId))

		insertQuery := `
			INSERT INTO PropertyValues (ID, TargetID, TargetType, GroupID, FieldID, Value, CreateAt, UpdateAt, DeleteAt)
			SELECT ?, ps.Id, 'post', ?, ?, ?, ?, ?, 0
			FROM unnest(?::text[]) ps(Id)
			WHERE NOT EXISTS (
				SELECT 1 FROM PropertyValues pv
				WHERE pv.TargetID = ps.Id
				  AND pv.FieldID = ?
				  AND pv.GroupID = ?
				  AND pv.DeleteAt = 0
			)
		`

		if _, err = transaction.Exec(insertQuery,
			model.NewId(),
			groupID,
			fieldID,
			valueJSON,
			updateAt,
			updateAt,
			pq.Array(pageIDs),
			fieldID,
			groupID,
		); err != nil {
			return errors.Wrap(err, "failed to create property values for orphaned pages")
		}
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}

func (s *SqlWikiStore) MoveWikiToChannel(wikiId string, targetChannelId string, timestamp int64) (*model.Wiki, error) {
	mlog.Debug("MoveWikiToChannel: Starting",
		mlog.String("wiki_id", wikiId),
		mlog.String("target_channel_id", targetChannelId))

	groupID, err := s.getPagePropertyGroupID()
	if err != nil {
		mlog.Error("MoveWikiToChannel: Failed to get property group ID", mlog.Err(err))
		return nil, err
	}
	mlog.Debug("MoveWikiToChannel: Got property group ID", mlog.String("group_id", groupID))

	fieldID, err := s.getWikiPropertyFieldID(groupID)
	if err != nil {
		mlog.Error("MoveWikiToChannel: Failed to get property field ID",
			mlog.Err(err),
			mlog.String("group_id", groupID))
		return nil, err
	}
	mlog.Debug("MoveWikiToChannel: Got property field ID", mlog.String("field_id", fieldID))

	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		mlog.Error("MoveWikiToChannel: Failed to begin transaction", mlog.Err(err))
		return nil, errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	recursiveCTE := `
		WITH RECURSIVE wiki_pages AS (
			SELECT DISTINCT pv.TargetID as page_id
			FROM PropertyValues pv
			WHERE pv.FieldID = ?
			  AND pv.GroupID = ?
			  AND pv.Value = to_jsonb(?::text)
			  AND pv.TargetType = 'post'
			  AND pv.DeleteAt = 0
		),
		page_subtree AS (
			SELECT p.Id, p.PageParentId, p.ChannelId
			FROM Posts p
			INNER JOIN wiki_pages wp ON p.Id = wp.page_id
			WHERE p.Type = ?
			  AND p.DeleteAt = 0

			UNION ALL

			SELECT p.Id, p.PageParentId, p.ChannelId
			FROM Posts p
			INNER JOIN page_subtree ps ON p.PageParentId = ps.Id
			WHERE p.Type = ?
			  AND p.DeleteAt = 0
		)
		SELECT Id FROM page_subtree
	`

	var pageIDs []string
	mlog.Debug("MoveWikiToChannel: Executing recursive CTE to find pages",
		mlog.String("field_id", fieldID),
		mlog.String("group_id", groupID),
		mlog.String("wiki_id", wikiId))
	if err = transaction.Select(&pageIDs, recursiveCTE, fieldID, groupID, wikiId, model.PostTypePage, model.PostTypePage); err != nil {
		mlog.Error("MoveWikiToChannel: Failed to find wiki pages", mlog.Err(err))
		return nil, errors.Wrap(err, "failed to find wiki pages")
	}

	mlog.Debug("MoveWikiToChannel: Found pages", mlog.Int("count", len(pageIDs)))
	if len(pageIDs) == 0 {
		mlog.Warn("No pages found for wiki", mlog.String("wiki_id", wikiId))
	}

	mlog.Debug("MoveWikiToChannel: Updating wiki channel")
	updateWikiQuery := s.getQueryBuilder().
		Update("Wikis").
		Set("ChannelId", targetChannelId).
		Set("UpdateAt", timestamp).
		Where(sq.Eq{
			"Id":       wikiId,
			"DeleteAt": 0,
		})

	result, err := transaction.ExecBuilder(updateWikiQuery)
	if err != nil {
		mlog.Error("MoveWikiToChannel: Failed to update wiki channel", mlog.Err(err))
		return nil, errors.Wrap(err, "failed to update wiki channel")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		mlog.Error("MoveWikiToChannel: Failed to get rows affected", mlog.Err(err))
		return nil, errors.Wrap(err, "failed to get rows affected")
	}

	mlog.Debug("MoveWikiToChannel: Wiki updated", mlog.Int("rows_affected", int(rowsAffected)))
	if rowsAffected == 0 {
		mlog.Error("MoveWikiToChannel: Wiki not found", mlog.String("wiki_id", wikiId))
		return nil, store.NewErrNotFound("Wiki", wikiId)
	}

	if len(pageIDs) > 0 {
		mlog.Debug("MoveWikiToChannel: Updating pages", mlog.Int("page_count", len(pageIDs)))
		updatePagesQuery := s.getQueryBuilder().
			Update("Posts").
			Set("ChannelId", targetChannelId).
			Set("UpdateAt", timestamp).
			Where(sq.Eq{
				"Id":       pageIDs,
				"Type":     model.PostTypePage,
				"DeleteAt": 0,
			})

		if _, err = transaction.ExecBuilder(updatePagesQuery); err != nil {
			mlog.Error("MoveWikiToChannel: Failed to update pages channel", mlog.Err(err))
			return nil, errors.Wrap(err, "failed to update pages channel")
		}
		mlog.Debug("MoveWikiToChannel: Pages updated successfully")

		mlog.Debug("MoveWikiToChannel: Updating regular comments")
		updateCommentsQuery := s.getQueryBuilder().
			Update("Posts").
			Set("ChannelId", targetChannelId).
			Set("UpdateAt", timestamp).
			Where(sq.Eq{
				"Type":     model.PostTypePageComment,
				"RootId":   pageIDs,
				"DeleteAt": 0,
			})

		if _, err = transaction.ExecBuilder(updateCommentsQuery); err != nil {
			mlog.Error("MoveWikiToChannel: Failed to update comments channel", mlog.Err(err))
			return nil, errors.Wrap(err, "failed to update comments channel")
		}
		mlog.Debug("MoveWikiToChannel: Regular comments updated successfully")

		mlog.Debug("MoveWikiToChannel: Updating inline comments")
		for _, pageID := range pageIDs {
			updateInlineCommentsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", timestamp).
				Where(sq.And{
					sq.Eq{"Type": model.PostTypePageComment},
					sq.Eq{"RootId": ""},
					sq.Expr("Props->>'page_id' = ?", pageID),
					sq.Eq{"DeleteAt": 0},
				})

			if _, err = transaction.ExecBuilder(updateInlineCommentsQuery); err != nil {
				mlog.Error("MoveWikiToChannel: Failed to update inline comments",
					mlog.Err(err),
					mlog.String("page_id", pageID))
				return nil, errors.Wrap(err, "failed to update inline comments")
			}
		}
		mlog.Debug("MoveWikiToChannel: Inline comments updated successfully")
	}

	if err = transaction.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	var updatedWiki model.Wiki
	getQuery := s.tableSelectQuery.
		Where(sq.Eq{
			"Id":       wikiId,
			"DeleteAt": 0,
		})

	if err = s.GetReplica().GetBuilder(&updatedWiki, getQuery); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Wiki", wikiId)
		}
		return nil, errors.Wrap(err, "failed to fetch updated wiki")
	}

	return &updatedWiki, nil
}
