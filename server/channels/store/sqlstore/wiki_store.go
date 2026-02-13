// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"strconv"
	"strings"

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
		Select("Id", "ChannelId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt", "SortOrder").
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

func (s *SqlWikiStore) getWikiPropertyIDs() (groupID string, fieldID string, err error) {
	groupID, err = s.getPagePropertyGroupID()
	if err != nil {
		return "", "", err
	}

	fieldID, err = s.getWikiPropertyFieldID(groupID)
	if err != nil {
		return "", "", err
	}

	return groupID, fieldID, nil
}

func (s *SqlWikiStore) Save(wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(wiki.GetProps())

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt", "SortOrder").
		Values(wiki.Id, wiki.ChannelId, wiki.Title, wiki.Description, wiki.Icon, propsJSON, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt, wiki.SortOrder)

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

	var savedWiki *model.Wiki
	err := s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
		var saveErr error
		savedWiki, saveErr = s.SaveWikiT(transaction, wiki)
		if saveErr != nil {
			return errors.Wrap(saveErr, "save_wiki")
		}

		pageId := model.NewId()
		now := model.GetMillis()

		contentJSON := model.EmptyTipTapJSON

		// Insert into PageContents table with UserId set (non-empty UserId = draft)
		contentBuilder := s.getQueryBuilder().
			Insert("PageContents").
			Columns("PageId", "UserId", "Content", "SearchText", "BaseUpdateAt", "CreateAt", "UpdateAt", "DeleteAt").
			Values(pageId, userId, contentJSON, "", 0, now, now, 0)

		if _, execErr := transaction.ExecBuilder(contentBuilder); execErr != nil {
			return errors.Wrap(execErr, "create_default_draft_content")
		}

		// Insert into Drafts table for metadata storage (FileIds, Props)
		// This ensures the draft can store file attachments before being published
		draftBuilder := s.getQueryBuilder().
			Insert("Drafts").
			Columns("CreateAt", "UpdateAt", "DeleteAt", "Message", "RootId", "ChannelId", "UserId", "FileIds", "Props", "Priority", "Type").
			Values(now, now, 0, "", pageId, savedWiki.Id, userId, "[]", `{"title":"Untitled page"}`, "{}", "")

		if _, execErr := transaction.ExecBuilder(draftBuilder); execErr != nil {
			return errors.Wrap(execErr, "create_default_draft_metadata")
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

// SaveWikiT saves a wiki within an existing transaction
func (s *SqlWikiStore) SaveWikiT(transaction *sqlxTxWrapper, wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	propsJSON := model.StringInterfaceToJSON(wiki.GetProps())

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "Title", "Description", "Icon", "Props", "CreateAt", "UpdateAt", "DeleteAt", "SortOrder").
		Values(wiki.Id, wiki.ChannelId, wiki.Title, wiki.Description, wiki.Icon, propsJSON, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt, wiki.SortOrder)

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

		// Soft delete posts if any exist
		if len(postIDs) > 0 {
			postsUpdateQuery := s.getQueryBuilder().
				Update("Posts").
				Set("DeleteAt", deleteAt).
				Where(sq.Eq{
					"Id":       postIDs,
					"DeleteAt": 0,
				})

			if _, execErr := transaction.ExecBuilder(postsUpdateQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to soft delete posts for wiki")
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

			if _, execErr := transaction.ExecBuilder(propertyValuesUpdateQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to soft delete property values for wiki")
			}

			// Soft delete page contents
			pageContentsUpdateQuery := s.getQueryBuilder().
				Update("PageContents").
				Set("DeleteAt", deleteAt).
				Where(sq.Eq{
					"PageId":   postIDs,
					"DeleteAt": 0,
				})

			if _, execErr := transaction.ExecBuilder(pageContentsUpdateQuery); execErr != nil {
				return errors.Wrap(execErr, "failed to soft delete page contents for wiki")
			}
		}

		// Delete all drafts from PageContents table for this wiki (hard delete since drafts are user-specific)
		// UserId != '' indicates a draft. WikiId is stored in Drafts.ChannelId for page drafts.
		pageDraftsDeleteQuery := s.getQueryBuilder().
			Delete("PageContents").
			Where(sq.Expr("PageId IN (SELECT RootId FROM Drafts WHERE ChannelId = ?)", wikiId)).
			Where(sq.NotEq{"UserId": ""})

		if _, execErr := transaction.ExecBuilder(pageDraftsDeleteQuery); execErr != nil {
			return errors.Wrap(execErr, "failed to delete page drafts for wiki")
		}

		// Soft delete the wiki itself within the same transaction
		wikiDeleteQuery := s.getQueryBuilder().
			Update("Wikis").
			Set("DeleteAt", deleteAt).
			Where(sq.Eq{"Id": wikiId, "DeleteAt": 0})

		result, execErr := transaction.ExecBuilder(wikiDeleteQuery)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to soft delete wiki")
		}

		rowsAffected, execErr := result.RowsAffected()
		if execErr != nil {
			return errors.Wrap(execErr, "failed to get rows affected for wiki delete")
		}
		if rowsAffected == 0 {
			return store.NewErrNotFound("Wiki", wikiId)
		}

		return nil
	})
}

func (s *SqlWikiStore) MovePageToWiki(pageId, targetWikiId string, parentPageId *string) error {
	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return err
	}

	return s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
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

		updateQuery := s.getQueryBuilder().
			Update("PropertyValues").
			Set("Value", valueJSON).
			Set("UpdateAt", updateAt).
			Where(sq.Eq{
				"TargetID":   pageIDs,
				"TargetType": "post",
				"FieldID":    fieldID,
				"GroupID":    groupID,
				"DeleteAt":   0,
			})

		result, execErr := transaction.ExecBuilder(updateQuery)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to update property values for page subtree")
		}

		rowsAffected, rowsErr := result.RowsAffected()
		if rowsErr != nil {
			return errors.Wrap(rowsErr, "failed to get rows affected")
		}

		if int(rowsAffected) < len(pageIDs) {
			missingCount := len(pageIDs) - int(rowsAffected)
			mlog.Warn("Some pages in subtree missing wiki PropertyValues, creating them",
				mlog.Int("missing_count", missingCount),
				mlog.String("page_id", pageId))

			// Use batch insert with ON CONFLICT DO NOTHING to insert PropertyValues only for pages that don't have them
			insertBuilder := s.getQueryBuilder().
				Insert("PropertyValues").
				Columns("ID", "TargetID", "TargetType", "GroupID", "FieldID", "Value", "CreateAt", "UpdateAt", "DeleteAt")

			for _, pid := range pageIDs {
				insertBuilder = insertBuilder.Values(model.NewId(), pid, "post", groupID, fieldID, valueJSON, updateAt, updateAt, 0)
			}

			// ON CONFLICT uses the unique partial index: idx_propertyvalues_unique (GroupID, TargetID, FieldID) WHERE DeleteAt = 0
			insertBuilder = insertBuilder.SuffixExpr(sq.Expr("ON CONFLICT (GroupID, TargetID, FieldID) WHERE DeleteAt = 0 DO NOTHING"))

			if _, insertErr := transaction.ExecBuilder(insertBuilder); insertErr != nil {
				return errors.Wrap(insertErr, "failed to create property values for orphaned pages")
			}
		}

		// Update wiki_id in Post.Props for all pages in subtree (optimization for fast lookup)
		updatePostPropsQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?::jsonb)", jsonKeyPath("wiki_id"), valueJSON)).
			Set("UpdateAt", updateAt).
			Where(sq.Eq{"Id": pageIDs, "DeleteAt": 0})

		if _, propsErr := transaction.ExecBuilder(updatePostPropsQuery); propsErr != nil {
			return errors.Wrap(propsErr, "failed to update wiki_id in Post.Props for page subtree")
		}

		// Update wiki_id in Props for top-level comments (comments where RootId is a page in the subtree)
		updateTopLevelCommentsQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?::jsonb)", jsonKeyPath("wiki_id"), valueJSON)).
			Set("UpdateAt", updateAt).
			Where(sq.Eq{
				"Type":     model.PostTypePageComment,
				"RootId":   pageIDs,
				"DeleteAt": 0,
			})

		if _, commentsErr := transaction.ExecBuilder(updateTopLevelCommentsQuery); commentsErr != nil {
			return errors.Wrap(commentsErr, "failed to update wiki_id in Props for top-level comments")
		}

		// Update wiki_id in Props for inline comments (RootId is empty, page_id is in Props)
		updateInlineCommentsQuery := s.getQueryBuilder().
			Update("Posts").
			Set("Props", sq.Expr("jsonb_set(COALESCE(Props, '{}'::jsonb), ?, ?::jsonb)", jsonKeyPath("wiki_id"), valueJSON)).
			Set("UpdateAt", updateAt).
			Where(sq.Eq{
				"Type":     model.PostTypePageComment,
				"RootId":   "",
				"DeleteAt": 0,
			}).
			Where(sq.Expr("Props->>'page_id' = ANY(?)", pq.Array(pageIDs)))

		if _, inlineErr := transaction.ExecBuilder(updateInlineCommentsQuery); inlineErr != nil {
			return errors.Wrap(inlineErr, "failed to update wiki_id in Props for inline comments")
		}

		return nil
	})
}

func (s *SqlWikiStore) MoveWikiToChannel(wikiId string, targetChannelId string, timestamp int64) (*model.Wiki, error) {
	groupID, fieldID, err := s.getWikiPropertyIDs()
	if err != nil {
		return nil, err
	}

	err = s.ExecuteInTransaction(func(transaction *sqlxTxWrapper) error {
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
		if selectErr := transaction.Select(&pageIDs, recursiveCTE, fieldID, groupID, wikiId, model.PostTypePage, model.PostTypePage); selectErr != nil {
			return errors.Wrap(selectErr, "failed to find wiki pages")
		}

		updateWikiQuery := s.getQueryBuilder().
			Update("Wikis").
			Set("ChannelId", targetChannelId).
			Set("UpdateAt", timestamp).
			Where(sq.Eq{
				"Id":       wikiId,
				"DeleteAt": 0,
			})

		result, execErr := transaction.ExecBuilder(updateWikiQuery)
		if execErr != nil {
			return errors.Wrap(execErr, "failed to update wiki channel")
		}

		rowsAffected, rowsErr := result.RowsAffected()
		if rowsErr != nil {
			return errors.Wrap(rowsErr, "failed to get rows affected")
		}

		if rowsAffected == 0 {
			return store.NewErrNotFound("Wiki", wikiId)
		}

		if len(pageIDs) > 0 {
			updatePagesQuery := s.getQueryBuilder().
				Update("Posts").
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", timestamp).
				Where(sq.Eq{
					"Id":       pageIDs,
					"Type":     model.PostTypePage,
					"DeleteAt": 0,
				})

			if _, pagesErr := transaction.ExecBuilder(updatePagesQuery); pagesErr != nil {
				return errors.Wrap(pagesErr, "failed to update pages channel")
			}

			updateCommentsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", timestamp).
				Where(sq.Eq{
					"Type":     model.PostTypePageComment,
					"RootId":   pageIDs,
					"DeleteAt": 0,
				})

			if _, commentsErr := transaction.ExecBuilder(updateCommentsQuery); commentsErr != nil {
				return errors.Wrap(commentsErr, "failed to update comments channel")
			}

			// Update inline comments (comments with page_id in Props but empty RootId)
			updateInlineCommentsQuery := s.getQueryBuilder().
				Update("Posts").
				Set("ChannelId", targetChannelId).
				Set("UpdateAt", timestamp).
				Where(sq.Eq{
					"Type":     model.PostTypePageComment,
					"RootId":   "",
					"DeleteAt": 0,
				}).
				Where(sq.Expr("Props->>'page_id' = ANY(?)", pq.Array(pageIDs)))

			if _, inlineErr := transaction.ExecBuilder(updateInlineCommentsQuery); inlineErr != nil {
				return errors.Wrap(inlineErr, "failed to update inline comments")
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	var updatedWiki model.Wiki
	getQuery := s.tableSelectQuery.
		Where(sq.Eq{
			"Id":       wikiId,
			"DeleteAt": 0,
		})

	// Use GetMaster() to read the data we just wrote - replicas may have lag in HA setups
	if getErr := s.GetMaster().GetBuilder(&updatedWiki, getQuery); getErr != nil {
		if getErr == sql.ErrNoRows {
			return nil, store.NewErrNotFound("Wiki", wikiId)
		}
		return nil, errors.Wrap(getErr, "failed to fetch updated wiki")
	}

	return &updatedWiki, nil
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

	// Extract wiki_id, page_parent_id, title, and parent's import_source_id from Props JSON in SQL
	// Note: Page title is stored in Props->>'title', not in Message column
	// Note: pc.Content is JSONB, so we cast to text and use empty string as fallback
	// Note: pp is the parent post, used to get parent's import_source_id for hierarchy export
	query := s.getQueryBuilder().
		Select(
			"p.Id", `t.Name AS "TeamName"`, `c.Name AS "ChannelName"`, `u.Username AS "Username"`,
			`COALESCE(p.Props->>'title', '') AS "Title"`, `COALESCE(pc.Content::text, '') AS "Content"`, "p.Props",
			`p.Props->>'wiki_id' AS "WikiId"`,
			`COALESCE(p.Props->>'page_parent_id', '') AS "PageParentId"`,
			// For parent's import_source_id: use the parent's import_source_id if it was imported, otherwise use its page ID
			`COALESCE(pp.Props->>'import_source_id', pp.Id, '') AS "ParentImportSourceId"`,
			"p.CreateAt", "p.UpdateAt", "p.FileIds",
		).
		From("Posts p").
		Join("Channels c ON p.ChannelId = c.Id").
		Join("Teams t ON c.TeamId = t.Id").
		Join("Users u ON p.UserId = u.Id").
		LeftJoin("PageContents pc ON p.Id = pc.PageId AND pc.UserId = ''").
		LeftJoin("Posts pp ON p.Props->>'page_parent_id' = pp.Id").
		Where(sq.Eq{"p.Type": model.PostTypePage}).
		Where(sq.Eq{"p.DeleteAt": 0}).
		Where(sq.Expr("p.Props->>'wiki_id' = ?", wikiId)).
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

// GetPageCommentsForExport returns comments for a page with user info for export
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
		Where(sq.Eq{"p.RootId": pageId}).
		Where(sq.Eq{"p.Type": model.PostTypePageComment}).
		Where(sq.Eq{"p.DeleteAt": 0}).
		OrderBy("p.CreateAt ASC")

	var comments []*model.PageCommentForExport
	if err := s.GetReplica().SelectBuilder(&comments, query); err != nil {
		return nil, errors.Wrap(err, "failed to query page comments for export")
	}

	return comments, nil
}
