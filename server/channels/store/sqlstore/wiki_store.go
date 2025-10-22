// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

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
		Select("Id", "ChannelId", "Title", "Description", "Icon", "CreateAt", "UpdateAt", "DeleteAt").
		From("Wikis")

	return s
}

func (s *SqlWikiStore) Save(wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "Title", "Description", "Icon", "CreateAt", "UpdateAt", "DeleteAt").
		Values(wiki.Id, wiki.ChannelId, wiki.Title, wiki.Description, wiki.Icon, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt)

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

	defaultDraft := &model.Draft{
		CreateAt:  model.GetMillis(),
		UpdateAt:  model.GetMillis(),
		DeleteAt:  0,
		UserId:    userId,
		ChannelId: wiki.ChannelId,
		WikiId:    savedWiki.Id,
		RootId:    savedWiki.Id + ":" + draftId,
		Message:   "",
		Props: model.StringInterface{
			"wiki_id": savedWiki.Id,
			"title":   "Untitled page",
		},
		FileIds: []string{},
	}

	builder := s.getQueryBuilder().
		Insert("Drafts").
		Columns("CreateAt", "UpdateAt", "DeleteAt", "UserId", "ChannelId", "WikiId", "RootId", "Message", "Props", "FileIds", "Priority").
		Values(defaultDraft.CreateAt, defaultDraft.UpdateAt, defaultDraft.DeleteAt, defaultDraft.UserId, defaultDraft.ChannelId, defaultDraft.WikiId, defaultDraft.RootId, defaultDraft.Message, model.StringInterfaceToJSON(defaultDraft.Props), model.ArrayToJSON(defaultDraft.FileIds), defaultDraft.Priority)

	if _, err = transaction.ExecBuilder(builder); err != nil {
		return nil, errors.Wrap(err, "create_default_draft")
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

	var wikis []*model.Wiki
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

	existing.PreUpdate()
	if err := existing.IsValid(); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().
		Update("Wikis").
		Set("Title", existing.Title).
		Set("Description", existing.Description).
		Set("Icon", existing.Icon).
		Set("UpdateAt", existing.UpdateAt).
		Where(sq.Eq{"Id": existing.Id, "DeleteAt": 0})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return nil, errors.Wrap(err, "unable_to_update_wiki")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "wiki_update_rowsaffected")
	}
	if count == 0 {
		return nil, store.NewErrNotFound("Wiki", existing.Id)
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

		count, err := result.RowsAffected()
		if err != nil {
			return errors.Wrap(err, "wiki_hard_delete_rowsaffected")
		}
		if count == 0 {
			return store.NewErrNotFound("Wiki", id)
		}

		return nil
	}

	builder := s.getQueryBuilder().
		Update("Wikis").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"Id": id, "DeleteAt": 0})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return errors.Wrap(err, "unable_to_delete_wiki")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "wiki_soft_delete_rowsaffected")
	}
	if count == 0 {
		return store.NewErrNotFound("Wiki", id)
	}

	return nil
}

func (s *SqlWikiStore) GetPages(wikiId string, offset, limit int) ([]*model.Post, error) {
	// PropertyValues.Value is JSONB, so we need to cast and compare
	var columns []string
	for _, c := range postSliceColumns() {
		columns = append(columns, "p."+c)
	}
	builder := s.getQueryBuilder().
		Select(columns...).
		From("Posts p").
		Join("PropertyValues v ON v.TargetType = 'post' AND v.TargetID = p.Id").
		Where(sq.Eq{
			"v.FieldID":  model.WikiPropertyFieldID,
			"v.GroupID":  model.WikiPropertyGroupID,
			"v.DeleteAt": 0,
			"p.Type":     model.PostTypePage,
			"p.DeleteAt": 0,
		}).
		Where("v.Value = to_jsonb(?::text)", wikiId).
		OrderBy("p.CreateAt DESC").
		Offset(uint64(offset))

	if limit > 0 {
		builder = builder.Limit(uint64(limit))
	}

	var posts []*model.Post
	if err := s.GetReplica().SelectBuilder(&posts, builder); err != nil {
		return nil, errors.Wrap(err, "unable_to_get_wiki_pages")
	}

	// Debug logging
	for _, p := range posts {
		title := ""
		if t, ok := p.Props["title"].(string); ok {
			title = t
		}
		mlog.Debug("GetPages loaded post from DB", mlog.String("post_id", p.Id), mlog.String("page_parent_id", p.PageParentId), mlog.String("title", title))
	}

	return posts, nil
}

// SaveWikiT saves a wiki within an existing transaction
func (s *SqlWikiStore) SaveWikiT(transaction *sqlxTxWrapper, wiki *model.Wiki) (*model.Wiki, error) {
	wiki.PreSave()
	if err := wiki.IsValid(); err != nil {
		return nil, err
	}

	builder := s.getQueryBuilder().
		Insert("Wikis").
		Columns("Id", "ChannelId", "Title", "Description", "Icon", "CreateAt", "UpdateAt", "DeleteAt").
		Values(wiki.Id, wiki.ChannelId, wiki.Title, wiki.Description, wiki.Icon, wiki.CreateAt, wiki.UpdateAt, wiki.DeleteAt)

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

	var posts []*model.Post
	if err := s.GetReplica().SelectBuilder(&posts, query); err != nil {
		return nil, errors.Wrap(err, "failed to get abandoned pages")
	}

	return posts, nil
}

func (s *SqlWikiStore) DeleteAllPagesForWiki(wikiId string) error {
	deleteAt := model.GetMillis()

	var err error
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
			"pv.FieldID":    model.WikiPropertyFieldID,
			"pv.GroupID":    model.WikiPropertyGroupID,
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
				"FieldID":    model.WikiPropertyFieldID,
				"GroupID":    model.WikiPropertyGroupID,
				"DeleteAt":   0,
			})

		if _, err = transaction.ExecBuilder(propertyValuesUpdateQuery); err != nil {
			return errors.Wrap(err, "failed to soft delete property values for wiki")
		}
	}

	// Delete drafts associated with this wiki
	draftsDeleteQuery := s.getQueryBuilder().
		Delete("Drafts").
		Where(sq.Eq{"ChannelId": wikiId})

	if _, err = transaction.ExecBuilder(draftsDeleteQuery); err != nil {
		return errors.Wrap(err, "failed to delete drafts for wiki")
	}

	if err = transaction.Commit(); err != nil {
		return errors.Wrap(err, "commit_transaction")
	}

	return nil
}
