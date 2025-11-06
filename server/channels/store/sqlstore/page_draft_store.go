// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPageDraftStore struct {
	*SqlStore
}

func newSqlPageDraftStore(sqlStore *SqlStore) store.PageDraftStore {
	return &SqlPageDraftStore{
		SqlStore: sqlStore,
	}
}

func (s *SqlPageDraftStore) Upsert(pageDraft *model.PageDraft) (*model.PageDraft, error) {
	pageDraft.PreSave()

	if err := pageDraft.IsValid(); err != nil {
		return nil, err
	}

	contentJSON, err := pageDraft.GetDocumentJSON()
	if err != nil {
		return nil, errors.Wrap(err, "failed to serialize PageDraft content")
	}

	propsJSON := model.StringInterfaceToJSON(pageDraft.GetProps())
	fileIdsJSON := model.ArrayToJSON(pageDraft.FileIds)

	builder := s.getQueryBuilder().Insert("PageDrafts").
		Columns("UserId", "WikiId", "DraftId", "Title", "Content", "FileIds", "Props", "CreateAt", "UpdateAt").
		Values(pageDraft.UserId, pageDraft.WikiId, pageDraft.DraftId, pageDraft.Title, contentJSON, fileIdsJSON, propsJSON, pageDraft.CreateAt, pageDraft.UpdateAt).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, wikiid, draftid) DO UPDATE SET Title = ?, Content = ?, FileIds = ?, Props = ?, UpdateAt = ? RETURNING UserId, WikiId, DraftId, Title, Content, FileIds, Props, CreateAt, UpdateAt",
			pageDraft.Title, contentJSON, fileIdsJSON, propsJSON, pageDraft.UpdateAt))

	query, args, err := builder.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_upsert_tosql")
	}

	// Use QueryRow with RETURNING to get the actual database row
	var result model.PageDraft
	var resultContentJSON string
	var resultFileIdsJSON string
	var resultPropsJSON string

	err = s.GetMaster().QueryRow(query, args...).Scan(
		&result.UserId,
		&result.WikiId,
		&result.DraftId,
		&result.Title,
		&resultContentJSON,
		&resultFileIdsJSON,
		&resultPropsJSON,
		&result.CreateAt,
		&result.UpdateAt,
	)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to upsert PageDraft with userId=%s, wikiId=%s, draftId=%s", pageDraft.UserId, pageDraft.WikiId, pageDraft.DraftId)
	}

	// Deserialize JSON fields
	if err := result.SetDocumentJSON(resultContentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to deserialize returned content")
	}

	if resultFileIdsJSON != "" && resultFileIdsJSON != "null" {
		if err := json.Unmarshal([]byte(resultFileIdsJSON), &result.FileIds); err != nil {
			return nil, errors.Wrap(err, "failed to deserialize returned file IDs")
		}
	}

	if resultPropsJSON != "" && resultPropsJSON != "null" {
		var props map[string]any
		if err := json.Unmarshal([]byte(resultPropsJSON), &props); err != nil {
			return nil, errors.Wrap(err, "failed to deserialize returned props")
		}
		result.SetProps(props)
	}

	return &result, nil
}

func (s *SqlPageDraftStore) Get(userId, wikiId, draftId string) (*model.PageDraft, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "FileIds", "Props", "CreateAt", "UpdateAt").
		From("PageDrafts").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_get_tosql")
	}

	var pageDraft model.PageDraft
	var contentJSON string
	var fileIdsJSON string
	var propsJSON string

	if err := s.GetReplica().QueryRow(queryString, args...).Scan(
		&pageDraft.UserId,
		&pageDraft.WikiId,
		&pageDraft.DraftId,
		&pageDraft.Title,
		&contentJSON,
		&fileIdsJSON,
		&propsJSON,
		&pageDraft.CreateAt,
		&pageDraft.UpdateAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("PageDraft", draftId)
		}
		return nil, errors.Wrapf(err, "failed to get PageDraft with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	if err := pageDraft.SetDocumentJSON(contentJSON); err != nil {
		return nil, errors.Wrap(err, "failed to parse PageDraft content")
	}

	if fileIdsJSON != "" {
		pageDraft.FileIds = model.ArrayFromJSON(strings.NewReader(fileIdsJSON))
	}

	if propsJSON != "" {
		var props map[string]any
		if err := json.Unmarshal([]byte(propsJSON), &props); err != nil {
			return nil, errors.Wrap(err, "failed to parse PageDraft props")
		}
		pageDraft.SetProps(props)
	}

	return &pageDraft, nil
}

func (s *SqlPageDraftStore) Delete(userId, wikiId, draftId string) error {
	query := s.getQueryBuilder().
		Delete("PageDrafts").
		Where(sq.Eq{
			"UserId":  userId,
			"WikiId":  wikiId,
			"DraftId": draftId,
		})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "page_draft_delete_tosql")
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return errors.Wrapf(err, "failed to delete PageDraft with userId=%s, wikiId=%s, draftId=%s", userId, wikiId, draftId)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("PageDraft", draftId)
	}

	return nil
}

func (s *SqlPageDraftStore) GetForWiki(userId, wikiId string) ([]*model.PageDraft, error) {
	query := s.getQueryBuilder().
		Select("UserId", "WikiId", "DraftId", "Title", "Content", "FileIds", "Props", "CreateAt", "UpdateAt").
		From("PageDrafts").
		Where(sq.Eq{
			"UserId": userId,
			"WikiId": wikiId,
		}).
		OrderBy("UpdateAt DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "page_draft_get_for_wiki_tosql")
	}

	rows, err := s.GetReplica().Query(queryString, args...)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get PageDrafts for userId=%s, wikiId=%s", userId, wikiId)
	}
	defer rows.Close()

	var drafts []*model.PageDraft

	for rows.Next() {
		var pageDraft model.PageDraft
		var contentJSON sql.NullString
		var fileIdsJSON sql.NullString
		var propsJSON sql.NullString

		err = rows.Scan(
			&pageDraft.UserId,
			&pageDraft.WikiId,
			&pageDraft.DraftId,
			&pageDraft.Title,
			&contentJSON,
			&fileIdsJSON,
			&propsJSON,
			&pageDraft.CreateAt,
			&pageDraft.UpdateAt,
		)
		if err != nil {
			return nil, errors.Wrap(err, "failed to scan PageDraft row")
		}

		if contentJSON.Valid && contentJSON.String != "" {
			err = pageDraft.SetDocumentJSON(contentJSON.String)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageDraft content")
			}
		}

		if fileIdsJSON.Valid && fileIdsJSON.String != "" {
			pageDraft.FileIds = model.ArrayFromJSON(strings.NewReader(fileIdsJSON.String))
		}

		if propsJSON.Valid && propsJSON.String != "" {
			var props map[string]any
			err = json.Unmarshal([]byte(propsJSON.String), &props)
			if err != nil {
				return nil, errors.Wrap(err, "failed to parse PageDraft props")
			}
			pageDraft.SetProps(props)
		}

		drafts = append(drafts, &pageDraft)
	}

	if err = rows.Err(); err != nil {
		return nil, errors.Wrap(err, "error iterating PageDraft rows")
	}

	return drafts, nil
}
