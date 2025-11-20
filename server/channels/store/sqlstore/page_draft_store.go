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

type SqlPageDraftContentStore struct {
	*SqlStore
}

func newSqlPageDraftContentStore(sqlStore *SqlStore) store.PageDraftContentStore {
	return &SqlPageDraftContentStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPageDraftContentStore) Upsert(content *model.PageDraftContent) (*model.PageDraftContent, error) {
	content.PreSave()

	if err := content.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, err := content.GetDocumentJSON()
	if err != nil {
		return nil, errors.Wrap(err, "failed to serialize PageDraftContent content")
	}

	builder := s.getQueryBuilder().Insert("PageDraftContents").
		Columns("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		Values(content.UserId, content.WikiId, content.DraftId, content.Title, contentJSON, content.CreateAt, content.UpdateAt).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, wikiid, draftid) DO UPDATE SET Title = ?, Content = ?, UpdateAt = ? RETURNING UserId, WikiId, DraftId, Title, Content, CreateAt, UpdateAt",
			content.Title, contentJSON, content.UpdateAt))

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_upsert_tosql")
	}

	var result model.PageDraftContent
	var resultContentJSON string

	err = s.GetMaster().QueryRow(query, args...).Scan(
		&result.UserId,
		&result.WikiId,
		&result.DraftId,
		&result.Title,
		&resultContentJSON,
		&result.CreateAt,
		&result.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to upsert PageDraftContent with userId=%s, wikiId=%s, draftId=%s", content.UserId, content.WikiId, content.DraftId)
	}

	if err := result.SetDocumentJSON(resultContentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to deserialize returned content")
	}

	return &result, nil
}

func (s *SqlPageDraftContentStore) Get(userId, wikiId, draftId string) (*model.PageDraftContent, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		From("PageDraftContents").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_get_tosql")
	}

	var content model.PageDraftContent
	var contentJSON string

	if err := s.GetReplica().QueryRow(queryString, args...).Scan(
		&content.UserId,
		&content.WikiId,
		&content.DraftId,
		&content.Title,
		&contentJSON,
		&content.CreateAt,
		&content.UpdateAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageDraftContent", draftId)
		}
		return nil, errors.Wrapf(err, "failed to get PageDraftContent with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	if err := content.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse PageDraftContent content")
	}

	return &content, nil
}

func (s *SqlPageDraftContentStore) Delete(userId, wikiId, draftId string) error {
	query := s.getQueryBuilder().
		Delete("PageDraftContents").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrapf(err, "failed to delete PageDraftContent with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	return s.checkRowsAffected(result, "PageDraftContent", draftId)
}

func (s *SqlPageDraftContentStore) GetForWiki(userId, wikiId string) ([]*model.PageDraftContent, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		From("PageDraftContents").
		Where(sq.Eq{
			"UserId": userId,
			"WikiId": wikiId,
		}).
		OrderBy("UpdateAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_get_for_wiki_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PageDraftContents for userId=%s, wikiId=%s", userId, wikiId)
	}
	defer rows.Close()

	contents := []*model.PageDraftContent{}

	for rows.Next() {
		var content model.PageDraftContent
		var contentJSON sql.NullString

		err = rows.Scan(
			&content.UserId,
			&content.WikiId,
			&content.DraftId,
			&content.Title,
			&contentJSON,
			&content.CreateAt,
			&content.UpdateAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageDraftContent row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = content.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageDraftContent content")
			}
		}

		contents = append(contents, &content)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageDraftContent rows")
	}

	return contents, nil
}

func (s *SqlPageDraftContentStore) GetActiveEditorsForPage(pageId string, minUpdateAt int64) ([]*model.PageDraftContent, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "CreateAt", "UpdateAt").
		From("PageDraftContents").
		Where(sq.And{
			sq.Eq{"DraftId": pageId},
			sq.GtOrEq{"UpdateAt": minUpdateAt},
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_content_get_active_editors_tosql")
	}

	// DEBUG: Log the actual SQL query being executed
	mlog.Info("Executing GetActiveEditorsForPage query", mlog.String("sql", queryString), mlog.Any("args", args))

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get active editors for pageId=%s", pageId)
	}
	defer rows.Close()

	contents := []*model.PageDraftContent{}

	for rows.Next() {
		var content model.PageDraftContent
		var contentJSON sql.NullString

		err = rows.Scan(
			&content.UserId,
			&content.WikiId,
			&content.DraftId,
			&content.Title,
			&contentJSON,
			&content.CreateAt,
			&content.UpdateAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageDraftContent row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = content.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageDraftContent content")
			}
		}

		contents = append(contents, &content)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageDraftContent rows")
	}

	return contents, nil
}
