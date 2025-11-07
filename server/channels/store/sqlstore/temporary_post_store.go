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

func (s *SqlTemporaryPostStore) Save(rctx request.CTX, post *model.TemporaryPost) (*model.TemporaryPost, error) {
	if err := post.PreSave(); err != nil {
		return nil, fmt.Errorf("failed to save TemporaryPost: %w", err)
	}

	fileIdsJSON := model.ArrayToJSON(post.FileIDs)

	query := s.getQueryBuilder().
		Insert("TemporaryPosts").
		Columns(temporaryPostSliceColumns()...).
		Values(
			post.ID,
			post.Type,
			post.ExpireAt,
			post.Message,
			fileIdsJSON,
		)

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, fmt.Errorf("failed to save TemporaryPost: %w", err)
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
	err := s.GetReplica().GetBuilder(&row, query)
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

func (s *SqlTemporaryPostStore) DeleteExpired(rctx request.CTX, expireAt int64) error {
	query := s.getQueryBuilder().
		Delete("TemporaryPosts").
		Where(sq.LtOrEq{"ExpireAt": expireAt})

	_, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return fmt.Errorf("failed to delete expired TemporaryPosts with expireAt<=%d: %w", expireAt, err)
	}

	return nil
}
