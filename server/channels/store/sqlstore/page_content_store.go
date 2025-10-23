// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPageContentStore struct {
	*SqlStore

	pageContentQuery sq.SelectBuilder
}

func newSqlPageContentStore(sqlStore *SqlStore) store.PageContentStore {
	s := &SqlPageContentStore{
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

func (s SqlPageContentStore) Save(pageContent *model.PageContent) (*model.PageContent, error) {
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

func (s SqlPageContentStore) Get(pageID string) (*model.PageContent, error) {
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageID, "DeleteAt": 0})

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

func (s SqlPageContentStore) GetWithDeleted(pageID string) (*model.PageContent, error) {
	query := s.pageContentQuery.Where(sq.Eq{"PageId": pageID})

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

func (s SqlPageContentStore) Update(pageContent *model.PageContent) (*model.PageContent, error) {
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

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_content_update_tosql")
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update PageContent with pageId=%s", pageContent.PageId)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get rows affected")
	}
	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("PageContent", pageContent.PageId)
	}

	return pageContent, nil
}

func (s SqlPageContentStore) Delete(pageID string) error {
	query := s.getQueryBuilder().
		Update("PageContents").
		Set("DeleteAt", model.GetMillis()).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"PageId": pageID, "DeleteAt": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "page_content_delete_tosql")
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to soft-delete PageContent with pageId=%s", pageID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("PageContent", pageID)
	}

	return nil
}

func (s SqlPageContentStore) PermanentDelete(pageID string) error {
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

func (s SqlPageContentStore) Restore(pageID string) error {
	query := s.getQueryBuilder().
		Update("PageContents").
		Set("DeleteAt", 0).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.And{
			sq.Eq{"PageId": pageID},
			sq.NotEq{"DeleteAt": 0},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "page_content_restore_tosql")
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to restore PageContent with pageId=%s", pageID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}
	if rowsAffected == 0 {
		return store.NewErrNotFound("PageContent", pageID)
	}

	return nil
}
