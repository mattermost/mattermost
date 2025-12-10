// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

type SqlTemporaryPostStore struct {
	*SqlStore
	metrics einterfaces.MetricsInterface

	selectQueryBuilder sq.SelectBuilder
}

func newSqlTemporaryPostStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.TemporaryPostStore {
	s := &SqlTemporaryPostStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	s.selectQueryBuilder = s.getQueryBuilder().Select(temporaryPostSliceColumns()...).From("TemporaryPosts")

	return s
}

func temporaryPostSliceColumns() []string {
	return []string{
		"PostId",
		"Type",
		"ExpireAt",
		"Message",
		"FileIds",
	}
}

func (s *SqlTemporaryPostStore) InvalidateTemporaryPost(id string) {
}

func (s *SqlTemporaryPostStore) Save(rctx request.CTX, post *model.TemporaryPost) (_ *model.TemporaryPost, err error) {
	if err = post.IsValid(); err != nil {
		return nil, fmt.Errorf("failed to save TemporaryPost: %w", err)
	}

	var tx *sqlxTxWrapper
	tx, err = s.GetMaster().Beginx()
	if err != nil {
		return nil, err
	}
	defer finalizeTransactionX(tx, &err)

	_, err = s.saveT(tx, post)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return post, nil
}

func (s *SqlTemporaryPostStore) saveT(tx *sqlxTxWrapper, post *model.TemporaryPost) (*model.TemporaryPost, error) {
	query := s.getQueryBuilder().
		Insert("TemporaryPosts").
		Columns(temporaryPostSliceColumns()...).
		Values(
			post.ID,
			post.Type,
			post.ExpireAt,
			post.Message,
			model.ArrayToJSON(post.FileIDs),
		).SuffixExpr(sq.Expr("ON CONFLICT (PostId) DO UPDATE SET Type = ?, ExpireAt = ?, Message = ?, FileIds = ?", post.Type, post.ExpireAt, post.Message, model.ArrayToJSON(post.FileIDs)))

	_, err := tx.ExecBuilder(query)
	if err != nil {
		return nil, err
	}

	return post, nil
}

func (s *SqlTemporaryPostStore) Get(rctx request.CTX, id string) (*model.TemporaryPost, error) {
	query := s.selectQueryBuilder.
		Where(sq.Eq{"PostId": id})

	// Use a struct with FileIds as string for scanning
	// Map PostId column to Id field
	type temporaryPostRow struct {
		PostID   string
		Type     string
		ExpireAt int64
		Message  string
		FileIDs  string
	}

	var row temporaryPostRow
	err := s.DBXFromContext(rctx.Context()).GetBuilder(&row, query)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("TemporaryPost", id)
		}

		return nil, fmt.Errorf("failed to get TemporaryPost with id=%s: %w", id, err)
	}

	// Parse FileIds from JSON string
	var fileIds model.StringArray
	if err := json.Unmarshal([]byte(row.FileIDs), &fileIds); err != nil {
		return nil, fmt.Errorf("failed to parse FileIds for TemporaryPost with id=%s: %w", id, err)
	}

	post := &model.TemporaryPost{
		ID:       row.PostID,
		Type:     row.Type,
		ExpireAt: row.ExpireAt,
		Message:  row.Message,
		FileIDs:  fileIds,
	}

	return post, nil
}

func (s *SqlTemporaryPostStore) Delete(rctx request.CTX, id string) error {
	query := s.getQueryBuilder().
		Delete("TemporaryPosts").
		Where(sq.Eq{"PostId": id})

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return fmt.Errorf("failed to delete TemporaryPost with id=%s: %w", id, err)
	}

	return nil
}

func (s *SqlTemporaryPostStore) GetExpiredPosts(rctx request.CTX) ([]string, error) {
	now := model.GetMillis()

	query := s.getQueryBuilder().
		Select("PostId").
		From("TemporaryPosts").
		Where(sq.LtOrEq{"ExpireAt": now})

	ids := []string{}
	err := s.GetMaster().SelectBuilder(&ids, query)
	if err != nil {
		return nil, fmt.Errorf("failed to select expired TemporaryPosts with expireAt<=%d: %w", now, err)
	}
	return ids, nil
}
